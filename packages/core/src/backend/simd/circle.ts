/**
 * SIMD circle polynomial operations.
 * 1:1 port of rust-reference/core/backend/simd/circle.rs
 */

import { PackedM31, LOG_N_LANES, N_LANES } from "./m31";
import { PackedQM31 } from "./qm31";
import { BaseColumn } from "./column";
import { SimdBackend } from "./index";
import { ifft, CACHED_FFT_LOG_SIZE, MIN_FFT_LOG_SIZE } from "./fft";
import { CpuBackend, precomputeTwiddles as cpuPrecomputeTwiddles } from "../cpu";
import { CirclePoint, Coset, M31_CIRCLE_LOG_ORDER } from "../../circle";
import { M31 } from "../../fields/m31";
import { QM31 } from "../../fields/qm31";
import { batchInverse } from "../../fields/fields";
import { CanonicCoset } from "../../poly/circle/canonic";
import { CircleDomain } from "../../poly/circle/domain";
import { CircleEvaluation } from "../../poly/circle/evaluation";
import { CirclePoly } from "../../poly/circle/poly";
import { TwiddleTree } from "../../poly/twiddles";
import { domainLineTwiddlesFromTree, fold } from "../../poly/utils";
import { BitReversedOrder } from "../../poly";
import { bitReverseIndex } from "../../utils";

/**
 * Helper functions for SIMD circle polynomial operations.
 */
export class SimdCirclePolyOps {
  /**
   * TODO(Ohad): optimize.
   * Computes a twiddle factor at a given index using the provided mappings.
   */
  static twiddleAt(mappings: QM31[], index: number): QM31 {
    if ((1 << mappings.length) < index) {
      throw new Error(`Index out of bounds. mappings log len = ${Math.log2(mappings.length)}, index = ${index}`);
    }

    if (mappings.length === 0) {
      throw new Error("Mappings array cannot be empty");
    }

    let product = QM31.one();
    for (const num of mappings) {
      if ((index & 1) === 1) {
        product = product.mul(num);
      }
      index >>= 1;
      if (index === 0) {
        break;
      }
    }

    return product;
  }

  /**
   * TODO(Ohad): consider moving this to a more general place.
   * Note: CACHED_FFT_LOG_SIZE is specific to the backend.
   * Generates evaluation mappings for a given point and log size.
   */
  static generateEvaluationMappings(point: CirclePoint<QM31>, logSize: number): QM31[] {
    // Mappings are the factors used to compute the evaluation twiddle.
    // Every twiddle (i) is of the form (m[0])^b_0 * (m[1])^b_1 * ... * (m[log_size - 1])^b_log_size.
    // Where (m)_j are the mappings, and b_i is the j'th bit of i.
    const mappings: QM31[] = [point.y, point.x];
    let x = point.x;
    for (let i = 2; i < logSize; i++) {
      x = CirclePoint.double_x(x, QM31);
      mappings.push(x);
    }

    // The caller function expects the mapping in natural order. i.e. (y,x,h(x),h(h(x)),...).
    // If the polynomial is large, the fft does a transpose in the middle in a granularity of 16
    // (avx512). The coefficients would then be in transposed order of 16-sized chunks.
    // i.e. (a_(n-15), a_(n-14), ..., a_(n-1), a_(n-31), ..., a_(n-16), a_(n-32), ...).
    // To compute the twiddles in the correct order, we need to transpose the corresponding
    // 'transposed bits' in the mappings. The result order of the mappings would then be
    // (y, x, h(x), h^2(x), h^(log_n-1)(x), h^(log_n-2)(x) ...). To avoid code
    // complexity for now, we just reverse the mappings, transpose, then reverse back.
    // TODO(Ohad): optimize. consider changing the caller to expect the mappings in
    // reversed-transposed order.
    if (logSize > CACHED_FFT_LOG_SIZE) {
      mappings.reverse();
      const n = mappings.length;
      const n0 = Math.floor((n - LOG_N_LANES) / 2);
      const n1 = Math.ceil((n - LOG_N_LANES) / 2);
      
      // Split and swap content of a,c.
      const ab = mappings.slice(0, n1);
      const c = mappings.slice(n1);
      const a = ab.slice(0, n0);
      
      // Swap content of a,c with proper bounds checking.
      for (let i = 0; i < n0 && i < a.length && i < c.length; i++) {
        const temp = a[i]!;
        a[i] = c[i]!;
        c[i] = temp;
      }
      
      // Reconstruct mappings
      mappings.splice(0, n1, ...ab);
      mappings.splice(n1, c.length, ...c);
      mappings.reverse();
    }

    return mappings;
  }

  /**
   * Generates twiddle steps for efficiently computing the twiddles.
   * steps[i] = t_i/(t_0*t_1*...*t_i-1).
   */
  static twiddleSteps(mappings: QM31[]): QM31[] {
    if (mappings.length === 0) {
      return [];
    }

    const denominators: QM31[] = [mappings[0]!];

    for (let i = 1; i < mappings.length; i++) {
      const prevDenom = denominators[i - 1]!;
      const mapping = mappings[i]!;
      denominators.push(prevDenom.mul(mapping));
    }

    const denomInverses = batchInverse(denominators);
    const steps: QM31[] = [mappings[0]!];

    for (let i = 1; i < mappings.length; i++) {
      const denomInverse = denomInverses[i - 1]!;
      const mapping = mappings[i]!;
      steps.push(mapping.mul(denomInverse));
    }
    steps.push(QM31.one());
    
    return steps;
  }

  /**
   * Advances the twiddle by multiplying it by the next step. e.g:
   *      If idx(t) = 0b100..1010 , then f(t) = t * step[0]
   *      If idx(t) = 0b100..0111 , then f(t) = t * step[3]
   */
  static advanceTwiddle(twiddle: QM31, steps: QM31[], currIdx: number): QM31 {
    const trailingOnes = this.countTrailingOnes(currIdx);
    const step = steps[trailingOnes];
    if (!step) {
      throw new Error(`Step at index ${trailingOnes} is undefined`);
    }
    return twiddle.mul(step);
  }

  /**
   * Helper function to count trailing ones in a number's binary representation.
   */
  static countTrailingOnes(n: number): number {
    let count = 0;
    while ((n & 1) === 1) {
      count++;
      n >>= 1;
    }
    return count;
  }

  /**
   * Slow evaluation at a point (fallback for small polynomials).
   */
  static slowEvalAtPoint(poly: any, point: CirclePoint<QM31>): QM31 {
    // Convert to CPU and evaluate
    const cpuPoly = poly.toCpu();
    return cpuPoly.evalAtPoint(point);
  }

  /**
   * Computes twiddles for small cosets (fallback to CPU).
   */
  static computeSmallCosetTwiddles(coset: Coset): TwiddleTree<any, PackedM31[]> {
    // For small cosets, use CPU implementation and convert
    const cpuTwiddles = cpuPrecomputeTwiddles(coset);
    
    // Convert CPU twiddles to SIMD format
    const twiddles = cpuTwiddles.twiddles.map((t: any) => PackedM31.broadcast(t));
    const itwiddles = cpuTwiddles.itwiddles.map((t: any) => PackedM31.broadcast(t));
    
    return new TwiddleTree(coset, twiddles, itwiddles);
  }

  /**
   * Computes twiddles for a coset.
   */
  static computeCosetTwiddles(coset: Coset, twiddles: PackedM31[]): void {
    const logSize = coset.logSize();
    const size = 1 << logSize;
    
    // Generate twiddle factors
    for (let i = 0; i < size; i += N_LANES) {
      const twiddleArray: M31[] = [];
      for (let j = 0; j < N_LANES && i + j < size; j++) {
        const point = coset.at(i + j);
        twiddleArray.push(point.x);
      }
      
      // Pad with zeros if needed
      while (twiddleArray.length < N_LANES) {
        twiddleArray.push(M31.zero());
      }
      
      twiddles.push(PackedM31.fromArray(twiddleArray));
    }
  }
}

/**
 * SIMD backend implementation of polynomial operations for circle polynomials.
 * This provides optimized implementations using SIMD operations where possible.
 */
export function interpolate(
  evaluation: any,
  twiddles: TwiddleTree<any, PackedM31[]>
): any {
  const logSize = Math.log2(evaluation.values.length || evaluation.values.len?.() || 0);
  if (logSize < MIN_FFT_LOG_SIZE) {
    const cpuPoly = evaluation.toCpu().interpolate();
    return { coeffs: cpuPoly.coeffs };
  }

  const values = evaluation.values;
  const twiddleData = domainLineTwiddlesFromTree(evaluation.domain, twiddles.itwiddles);

  // Perform IFFT
  // Convert PackedM31 data to number arrays for FFT
  const valuesData = (values as any).data || values;
  const numberData: number[] = [];
  
  if (Array.isArray(valuesData) && valuesData[0] && typeof valuesData[0].toArray === 'function') {
    // Convert PackedM31 array to number array
    for (const packed of valuesData) {
      const arr = packed.toArray();
      for (const m31 of arr) {
        numberData.push(m31.value);
      }
    }
  } else {
    // Fallback: assume it's already a number array or can be converted
    for (let i = 0; i < valuesData.length; i++) {
      const val = valuesData[i];
      if (val && typeof val.value === 'number') {
        numberData.push(val.value);
      } else if (typeof val === 'number') {
        numberData.push(val);
      } else {
        numberData.push(0);
      }
    }
  }
  
  // Convert twiddle data to number arrays
  const numberTwiddleData: number[][] = [];
  for (const layer of twiddleData) {
    if (Array.isArray(layer) && layer[0] && typeof layer[0].toArray === 'function') {
      // Convert PackedM31 array to number array
      const layerNumbers: number[] = [];
      for (const packed of layer) {
        const arr = packed.toArray();
        for (const m31 of arr) {
          layerNumbers.push(m31.value);
        }
      }
      numberTwiddleData.push(layerNumbers);
    } else if (Array.isArray(layer)) {
      // Assume it's already numbers or can be converted
      const layerNumbers = layer.map((val: any) => {
        if (val && typeof val.value === 'number') {
          return val.value;
        } else if (typeof val === 'number') {
          return val;
        } else {
          return 0;
        }
      });
      numberTwiddleData.push(layerNumbers);
    } else {
      numberTwiddleData.push([]);
    }
  }
  
  ifft(numberData, numberTwiddleData, logSize);

  // TODO(alont): Cache this inversion.
  const inv = PackedM31.broadcast(M31.from(evaluation.domain.size()).inverse());
  const dataArray = (values as any).data || values;
  for (let i = 0; i < dataArray.length; i++) {
    dataArray[i] = dataArray[i].mul(inv);
  }

  return { coeffs: values };
}

/**
 * Evaluates a polynomial at a specific point.
 */
export function evalAtPoint(poly: any, point: CirclePoint<QM31>): QM31 {
  // If the polynomial is small, fallback to evaluate directly.
  // TODO(Ohad): it's possible to avoid falling back. Consider fixing.
  if (poly.logSize() <= 8) {
    return SimdCirclePolyOps.slowEvalAtPoint(poly, point);
  }

  const mappings = SimdCirclePolyOps.generateEvaluationMappings(point, poly.logSize());

  // 8 lowest mappings produce the first 2^8 twiddles. Separate to optimize each calculation.
  const mapLow = mappings.slice(0, 4);
  const mapMid = mappings.slice(4, 8);
  const mapHigh = mappings.slice(8);

  const twiddleLows = PackedQM31.fromArray(
    Array.from({ length: 16 }, (_, i) => SimdCirclePolyOps.twiddleAt(mapLow, i))
  );
  const twiddleMids = PackedQM31.fromArray(
    Array.from({ length: 16 }, (_, i) => SimdCirclePolyOps.twiddleAt(mapMid, i))
  );

  // Compute the high twiddle steps.
  const twiddleSteps = SimdCirclePolyOps.twiddleSteps(mapHigh);

  // Every twiddle is a product of mappings that correspond to '1's in the bit representation
  // of the current index. For every 2^n aligned chunk of 2^n elements, the twiddle
  // array is the same, denoted twiddle_low. Use this to compute sums of (coeff *
  // twiddle_high) mod 2^n, then multiply by twiddle_low, and sum to get the final result.
  const computeChunkSum = (
    coeffChunk: PackedM31[],
    twiddleMids: PackedQM31,
    offset: number
  ): PackedQM31 => {
    let sum = PackedQM31.zero();
    let twiddleHigh = SimdCirclePolyOps.twiddleAt(mappings, offset * N_LANES);
    
    for (let i = 0; i < coeffChunk.length; i += N_LANES) {
      const chunk = coeffChunk.slice(i, i + N_LANES);
      // For every chunk of 2^4 * 2^4 = 2^8 elements, the twiddle high is the same.
      // Multiply it by every mid twiddle factor to get the factors for the current chunk.
      const highTwiddleFactors = PackedQM31.broadcast(twiddleHigh).mul(twiddleMids).toArray();

      // Sum the coefficients multiplied by each corresponding twiddle.
      for (let j = 0; j < chunk.length && j < highTwiddleFactors.length; j++) {
        const packedCoeffs = chunk[j];
        const midTwiddle = highTwiddleFactors[j];
        if (packedCoeffs && midTwiddle) {
          // Convert PackedM31 to PackedQM31 for multiplication
          const packedQM31 = PackedQM31.fromPackedM31(packedCoeffs);
          sum = sum.add(packedQM31.mul(PackedQM31.broadcast(midTwiddle)));
        }
      }

      // Advance to the next high twiddle.
      twiddleHigh = SimdCirclePolyOps.advanceTwiddle(twiddleHigh, twiddleSteps, (i / N_LANES) + 1);
    }

    return sum;
  };

  // Process all coefficient chunks
  const coeffsData = (poly.coeffs as any).data || poly.coeffs;
  let result = PackedQM31.zero();
  
  for (let offset = 0; offset < coeffsData.length; offset += N_LANES * N_LANES) {
    const chunk = coeffsData.slice(offset, offset + N_LANES * N_LANES);
    const chunkSum = computeChunkSum(chunk, twiddleMids, offset / (N_LANES * N_LANES));
    result = result.add(chunkSum.mul(twiddleLows));
  }

  // Sum all lanes to get the final result
  return result.pointwiseSum();
}

/**
 * Extends a polynomial to a larger size.
 */
export function extend(poly: any, logSize: number): any {
  if (poly.logSize() >= logSize) {
    return poly;
  }
  
  const newSize = 1 << logSize;
  const newCoeffs = (BaseColumn as any).zeros?.(newSize) || new Array(newSize).fill(M31.zero());
  
  // Copy existing coefficients
  const polyCoeffs = poly.coeffs;
  const coeffsLength = polyCoeffs.length || polyCoeffs.len?.() || 0;
  for (let i = 0; i < coeffsLength; i++) {
    const coeff = polyCoeffs[i] || polyCoeffs.at?.(i);
    if (newCoeffs.set) {
      newCoeffs.set(i, coeff);
    } else {
      newCoeffs[i] = coeff;
    }
  }
  
  return { coeffs: newCoeffs };
}

/**
 * Evaluates a polynomial over a domain.
 */
export function evaluate(
  poly: any,
  domain: CircleDomain,
  twiddles: TwiddleTree<any, PackedM31[]>
): any {
  const logSize = Math.log2(domain.size());
  if (logSize < MIN_FFT_LOG_SIZE) {
    const cpuEval = poly.toCpu().evaluate(domain, twiddles);
    return {
      domain,
      values: (BaseColumn as any).fromCpu?.(cpuEval.values.toCpu()) || cpuEval.values
    };
  }

  let values = poly.coeffs.clone?.() || [...poly.coeffs];
  const twiddleData = domainLineTwiddlesFromTree(domain, twiddles.twiddles);

  // Perform FFT - convert to number array first
  const valuesData = (values as any).data || values;
  const numberData: number[] = [];
  
  if (Array.isArray(valuesData) && valuesData[0] && typeof valuesData[0].toArray === 'function') {
    // Convert PackedM31 array to number array
    for (const packed of valuesData) {
      const arr = packed.toArray();
      for (const m31 of arr) {
        numberData.push(m31.value);
      }
    }
  } else {
    // Fallback: assume it's already a number array or can be converted
    for (let i = 0; i < valuesData.length; i++) {
      const val = valuesData[i];
      if (val && typeof val.value === 'number') {
        numberData.push(val.value);
      } else if (typeof val === 'number') {
        numberData.push(val);
      } else {
        numberData.push(0);
      }
    }
  }
  
  // Convert twiddle data to number arrays
  const numberTwiddleData: number[][] = [];
  for (const layer of twiddleData) {
    if (Array.isArray(layer) && layer[0] && typeof layer[0].toArray === 'function') {
      // Convert PackedM31 array to number array
      const layerNumbers: number[] = [];
      for (const packed of layer) {
        const arr = packed.toArray();
        for (const m31 of arr) {
          layerNumbers.push(m31.value);
        }
      }
      numberTwiddleData.push(layerNumbers);
    } else if (Array.isArray(layer)) {
      // Assume it's already numbers or can be converted
      const layerNumbers = layer.map((val: any) => {
        if (val && typeof val.value === 'number') {
          return val.value;
        } else if (typeof val === 'number') {
          return val;
        } else {
          return 0;
        }
      });
      numberTwiddleData.push(layerNumbers);
    } else {
      numberTwiddleData.push([]);
    }
  }
  
  ifft(numberData, numberTwiddleData, logSize);

  return {
    domain,
    values
  };
}

/**
 * Precomputes twiddles for efficient polynomial operations.
 */
export function precomputeTwiddles(coset: Coset): TwiddleTree<any, PackedM31[]> {
  // For now, delegate to the small coset implementation
  // TODO: Implement optimized SIMD twiddle computation for large cosets
  return SimdCirclePolyOps.computeSmallCosetTwiddles(coset);
} 