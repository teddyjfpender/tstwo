/**
 * Inverse Circle Fast Fourier Transform (ICFFT) implementation.
 * 
 * TypeScript port of the Rust backend/simd/fft/ifft.rs module.
 */

import { PackedM31, type PackedBaseField, LOG_N_LANES } from "../m31";
import { UnsafeMut, parallelIter } from "../utils";
import { bitReverse } from "../../cpu";
import { Coset } from "../../../circle";
import { M31 } from "../../../fields/m31";
import { 
  computeFirstTwiddles, 
  mulTwiddle, 
  transposeVecs, 
  CACHED_FFT_LOG_SIZE, 
  MIN_FFT_LOG_SIZE 
} from "./index";

/**
 * Performs an Inverse Circle Fast Fourier Transform (ICFFT) on the given values.
 * 
 * @param values - Array of u32 values to transform (treated as SIMD vectors)
 * @param twiddle_dbl - Array of doubled twiddle factors for each layer
 * @param log_n_elements - The log of the number of elements in the values array
 * 
 * # Panics
 * 
 * Panic if `log_n_elements` is less than MIN_FFT_LOG_SIZE.
 * 
 * # Safety
 * 
 * Behavior is undefined if `values` does not have the same alignment as PackedBaseField.
 */
export function ifft(values: number[], twiddle_dbl: number[][], log_n_elements: number): void {
  if (!Number.isInteger(log_n_elements) || log_n_elements < MIN_FFT_LOG_SIZE) {
    throw new Error(`log_n_elements must be at least ${MIN_FFT_LOG_SIZE}, got ${log_n_elements}`);
  }

  const log_n_vecs = log_n_elements - LOG_N_LANES;
  if (log_n_elements <= CACHED_FFT_LOG_SIZE) {
    ifftLowerWithVecwise(values, twiddle_dbl, log_n_elements, log_n_elements);
    return;
  }

  const fft_layers_pre_transpose = Math.ceil(log_n_vecs / 2);
  const fft_layers_post_transpose = Math.floor(log_n_vecs / 2);
  
  ifftLowerWithVecwise(
    values,
    twiddle_dbl.slice(0, 3 + fft_layers_pre_transpose),
    log_n_elements,
    fft_layers_pre_transpose + LOG_N_LANES
  );
  
  transposeVecs(values, log_n_vecs);
  
  ifftLowerWithoutVecwise(
    values,
    twiddle_dbl.slice(3 + fft_layers_pre_transpose),
    log_n_elements,
    fft_layers_post_transpose
  );
}

/**
 * Computes partial ifft on 2^log_size M31 elements.
 * 
 * @param values - Pointer to the entire value array, aligned to 64 bytes.
 * @param twiddle_dbl - The doubles of the twiddle factors for each layer of the ifft. Layer i
 *   holds `2^(log_size - 1 - i)` twiddles.
 * @param log_size - The log of the number of number of M31 elements in the array.
 * @param fft_layers - The number of ifft layers to apply, out of log_size.
 * 
 * # Panics
 * 
 * Panics if `log_size` is not at least 5.
 * 
 * # Safety
 * 
 * `values` must have the same alignment as PackedBaseField.
 * `fft_layers` must be at least 5.
 */
export function ifftLowerWithVecwise(
  values: number[],
  twiddle_dbl: number[][],
  log_size: number,
  fft_layers: number
): void {
  const VECWISE_FFT_BITS = LOG_N_LANES + 1;
  if (log_size < VECWISE_FFT_BITS) {
    throw new Error(`log_size must be at least ${VECWISE_FFT_BITS}`);
  }

  if (twiddle_dbl[0]!.length !== (1 << (log_size - 2))) {
    throw new Error(`Invalid twiddle array length: expected ${1 << (log_size - 2)}, got ${twiddle_dbl[0]!.length}`);
  }

  const numIterations = 1 << (log_size - fft_layers);
  const iterationIndices = Array.from({ length: numIterations }, (_, i) => i);
  
  parallelIter(iterationIndices).forEach((index_h) => {
    ifftVecwiseLoop(values, twiddle_dbl, fft_layers - VECWISE_FFT_BITS, index_h);
    
    for (let layer = VECWISE_FFT_BITS; layer < fft_layers; layer += 3) {
      const remaining = fft_layers - layer;
      if (remaining === 1) {
        ifft1Loop(values, twiddle_dbl.slice(layer - 1), layer, index_h);
      } else if (remaining === 2) {
        ifft2Loop(values, twiddle_dbl.slice(layer - 1), layer, index_h);
      } else {
        ifft3Loop(values, twiddle_dbl.slice(layer - 1), remaining - 3, layer, index_h);
      }
    }
  });
}

/**
 * Computes partial ifft on 2^log_size M31 elements, skipping the vecwise layers (lower 4 bits of
 * the index).
 * 
 * @param values - Pointer to the entire value array, aligned to 64 bytes.
 * @param twiddle_dbl - The doubles of the twiddle factors for each layer of the ifft.
 * @param log_size - The log of the number of number of M31 elements in the array.
 * @param fft_layers - The number of ifft layers to apply, out of `log_size - LOG_N_LANES`.
 * 
 * # Panics
 * 
 * Panics if `log_size` is not at least 4.
 * 
 * # Safety
 * 
 * `values` must have the same alignment as PackedBaseField.
 * `fft_layers` must be at least 4.
 */
export function ifftLowerWithoutVecwise(
  values: number[],
  twiddle_dbl: number[][],
  log_size: number,
  fft_layers: number
): void {
  if (log_size < LOG_N_LANES) {
    throw new Error(`log_size must be at least ${LOG_N_LANES}`);
  }

  const numIterations = 1 << (log_size - fft_layers - LOG_N_LANES);
  const iterationIndices = Array.from({ length: numIterations }, (_, i) => i);
  
  parallelIter(iterationIndices).forEach((index_h) => {
    for (let layer = 0; layer < fft_layers; layer += 3) {
      const fixed_layer = layer + LOG_N_LANES;
      const remaining = fft_layers - layer;
      
      if (remaining === 1) {
        ifft1Loop(values, twiddle_dbl.slice(layer), fixed_layer, index_h);
      } else if (remaining === 2) {
        ifft2Loop(values, twiddle_dbl.slice(layer), fixed_layer, index_h);
      } else {
        ifft3Loop(values, twiddle_dbl.slice(layer), remaining - 3, fixed_layer, index_h);
      }
    }
  });
}

/**
 * Runs the first 5 ifft layers across the entire array.
 * 
 * @param values - Pointer to the entire value array, aligned to 64 bytes.
 * @param twiddle_dbl - The doubles of the twiddle factors for each of the 5 ifft layers.
 * @param loop_bits - The number of bits this loops needs to run on.
 * @param index_h - The higher part of the index, iterated by the caller.
 * 
 * # Safety
 * 
 * Behavior is undefined if `values` does not have the same alignment as PackedBaseField.
 */
export function ifftVecwiseLoop(
  values: number[],
  twiddle_dbl: number[][],
  loop_bits: number,
  index_h: number
): void {
  for (let index_l = 0; index_l < (1 << loop_bits); index_l++) {
    const index = (index_h << loop_bits) + index_l;
    
    // Load two PackedBaseField values (32 u32 values total)
    const val0_data = values.slice(index * 32, index * 32 + 16);
    const val1_data = values.slice(index * 32 + 16, index * 32 + 32);
    
    if (val0_data.length < 16 || val1_data.length < 16) continue;
    
    let val0 = PackedM31.fromArray(val0_data.map(v => M31.fromUnchecked(v)));
    let val1 = PackedM31.fromArray(val1_data.map(v => M31.fromUnchecked(v)));
    
    // Apply vecwise butterflies
    const twiddle1 = Array.from({ length: 8 }, (_, i) => twiddle_dbl[0]![index * 8 + i]!);
    const twiddle2 = Array.from({ length: 4 }, (_, i) => twiddle_dbl[1]![index * 4 + i]!);
    const twiddle3 = Array.from({ length: 2 }, (_, i) => twiddle_dbl[2]![index * 2 + i]!);
    
    [val0, val1] = vecwiseIButterflies(val0, val1, twiddle1, twiddle2, twiddle3);
    
    // Apply SIMD butterfly
    const twiddle4 = Array(16).fill(twiddle_dbl[3]![index]!);
    [val0, val1] = simdIButterfly(val0, val1, twiddle4);
    
    // Store results back
    const result0 = val0.toArray().map(v => v.value);
    const result1 = val1.toArray().map(v => v.value);
    
    for (let i = 0; i < 16; i++) {
      if (index * 32 + i < values.length) values[index * 32 + i] = result0[i]!;
      if (index * 32 + 16 + i < values.length) values[index * 32 + 16 + i] = result1[i]!;
    }
  }
}

/**
 * IFFT 3-layer loop.
 */
export function ifft3Loop(
  values: number[],
  twiddle_dbl: number[][],
  loop_bits: number,
  layer: number,
  index_h: number
): void {
  for (let index_l = 0; index_l < (1 << loop_bits); index_l++) {
    const index = (index_h << loop_bits) + index_l;
    const offset = index << (layer + 3);
    const log_step = layer;
    
    const twiddles0 = Array.from({ length: 4 }, (_, i) => twiddle_dbl[0]![index * 4 + i]!);
    const twiddles1 = Array.from({ length: 2 }, (_, i) => twiddle_dbl[1]![index * 2 + i]!);
    const twiddles2 = [twiddle_dbl[2]![index]!];
    
    ifft3(values, offset, log_step, twiddles0, twiddles1, twiddles2);
  }
}

/**
 * IFFT 2-layer loop.
 */
export function ifft2Loop(
  values: number[],
  twiddle_dbl: number[][],
  layer: number,
  index: number
): void {
  const offset = index << (layer + 2);
  const log_step = layer;
  
  const twiddles0 = Array.from({ length: 2 }, (_, i) => twiddle_dbl[0]![index * 2 + i]!);
  const twiddles1 = [twiddle_dbl[1]![index]!];
  
  ifft2(values, offset, log_step, twiddles0, twiddles1);
}

/**
 * IFFT 1-layer loop.
 */
export function ifft1Loop(
  values: number[],
  twiddle_dbl: number[][],
  layer: number,
  index_h: number
): void {
  const offset = index_h << (layer + 1);
  const log_step = layer;
  
  const twiddles0 = [twiddle_dbl[0]![index_h]!];
  
  ifft1(values, offset, log_step, twiddles0);
}

/**
 * SIMD inverse butterfly operation.
 * 
 * Performs the inverse butterfly operation: (val0, val1) -> (val0 + val1, (val0 - val1) * twiddle)
 */
export function simdIButterfly(
  val0: PackedM31,
  val1: PackedM31,
  twiddle_dbl: number[]
): [PackedM31, PackedM31] {
  if (twiddle_dbl.length !== 16) {
    throw new Error(`Expected 16 twiddle values, got ${twiddle_dbl.length}`);
  }
  
  const sum = val0.add(val1);
  const diff = val0.sub(val1);
  const new_val1 = mulTwiddle(diff, twiddle_dbl);
  
  return [sum, new_val1];
}

/**
 * Vecwise inverse butterfly operations.
 * 
 * Performs multiple layers of inverse butterfly operations within SIMD vectors.
 */
export function vecwiseIButterflies(
  val0: PackedM31,
  val1: PackedM31,
  twiddle1_dbl: number[],
  twiddle2_dbl: number[],
  twiddle3_dbl: number[]
): [PackedM31, PackedM31] {
  if (twiddle1_dbl.length !== 8) {
    throw new Error(`Expected 8 twiddle1 values, got ${twiddle1_dbl.length}`);
  }
  if (twiddle2_dbl.length !== 4) {
    throw new Error(`Expected 4 twiddle2 values, got ${twiddle2_dbl.length}`);
  }
  if (twiddle3_dbl.length !== 2) {
    throw new Error(`Expected 2 twiddle3 values, got ${twiddle3_dbl.length}`);
  }
  
  // Apply inverse butterflies in reverse order compared to forward FFT
  const twiddle3_expanded = Array(16).fill(0);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 8; j++) {
      twiddle3_expanded[i * 8 + j] = twiddle3_dbl[i]!;
    }
  }
  [val0, val1] = simdIButterfly(val0, val1, twiddle3_expanded);
  
  const twiddle2_expanded = Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      twiddle2_expanded[i * 4 + j] = twiddle2_dbl[i]!;
    }
  }
  [val0, val1] = simdIButterfly(val0, val1, twiddle2_expanded);
  
  // Apply the first twiddles computation
  const [t0, t1] = computeFirstTwiddles(twiddle1_dbl);
  
  // Apply butterflies in reverse order (matching Rust implementation)
  [val0, val1] = simdIButterfly(val0, val1, t0);
  [val0, val1] = simdIButterfly(val0, val1, t1);
  
  return [val0, val1];
}

/**
 * Gets inverse twiddle doubles for inverse FFT.
 * Matches the Rust get_itwiddle_dbls function exactly.
 */
export function getITwiddleDbls(coset: Coset): number[][] {
  const result: number[][] = [];
  let currentCoset = coset;
  
  for (let layer = 0; layer < coset.logSize(); layer++) {
    const layerTwiddles: number[] = [];
    const stepSize = currentCoset.size() / 2;
    
    for (let i = 0; i < stepSize; i++) {
      const point = currentCoset.at(i);
      // Use x coordinate, take inverse, then double it
      const twiddle = point.x.inverse();
      layerTwiddles.push((twiddle.value * 2) >>> 0);
    }
    
    // Apply bit reversal to match Rust implementation
    bitReverse(layerTwiddles);
    
    result.push(layerTwiddles);
    currentCoset = currentCoset.double();
  }
  
  return result;
}

/**
 * 3-layer IFFT operation.
 * 
 * @param values - Values array (in-place operation)
 * @param offset - Offset in the array
 * @param log_step - Log of the step size
 * @param twiddles_dbl0 - First layer twiddles (4 elements)
 * @param twiddles_dbl1 - Second layer twiddles (2 elements)
 * @param twiddles_dbl2 - Third layer twiddles (1 element)
 * 
 * # Safety
 * 
 * Behavior is undefined if arrays don't have proper alignment.
 */
export function ifft3(
  values: number[],
  offset: number,
  log_step: number,
  twiddles_dbl0: number[],
  twiddles_dbl1: number[],
  twiddles_dbl2: number[]
): void {
  if (twiddles_dbl0.length !== 4) {
    throw new Error(`Expected 4 twiddles_dbl0, got ${twiddles_dbl0.length}`);
  }
  if (twiddles_dbl1.length !== 2) {
    throw new Error(`Expected 2 twiddles_dbl1, got ${twiddles_dbl1.length}`);
  }
  if (twiddles_dbl2.length !== 1) {
    throw new Error(`Expected 1 twiddles_dbl2, got ${twiddles_dbl2.length}`);
  }

  // Load the 8 SIMD vectors from the array
  const vals: PackedM31[] = [];
  for (let i = 0; i < 8; i++) {
    const data = values.slice(offset + (i << log_step), offset + (i << log_step) + 16);
    if (data.length < 16) {
      while (data.length < 16) data.push(0);
    }
    vals.push(PackedM31.fromArray(data.map(v => M31.fromUnchecked(v))));
  }

  // Apply 3 layers of inverse butterflies (reverse order compared to forward FFT)
  // Layer 0 (step 1)
  for (let i = 0; i < 8; i += 2) {
    const twiddle = Array(16).fill(twiddles_dbl0[i / 2]!);
    [vals[i]!, vals[i + 1]!] = simdIButterfly(vals[i]!, vals[i + 1]!, twiddle);
  }

  // Layer 1 (step 2)
  for (let i = 0; i < 8; i += 4) {
    for (let j = 0; j < 2; j++) {
      const twiddle = Array(16).fill(twiddles_dbl1[i / 4]!);
      [vals[i + j]!, vals[i + j + 2]!] = simdIButterfly(vals[i + j]!, vals[i + j + 2]!, twiddle);
    }
  }

  // Layer 2 (step 4)
  for (let i = 0; i < 4; i++) {
    const twiddle = Array(16).fill(twiddles_dbl2[0]!);
    [vals[i]!, vals[i + 4]!] = simdIButterfly(vals[i]!, vals[i + 4]!, twiddle);
  }

  // Store the 8 SIMD vectors back to the array
  for (let i = 0; i < 8; i++) {
    const result = vals[i]!.toArray().map(v => v.value);
    for (let j = 0; j < 16; j++) {
      const idx = offset + (i << log_step) + j;
      if (idx < values.length) {
        values[idx] = result[j]!;
      }
    }
  }
}

/**
 * 2-layer IFFT operation.
 * 
 * @param values - Values array (in-place operation)
 * @param offset - Offset in the array
 * @param log_step - Log of the step size
 * @param twiddles_dbl0 - First layer twiddles (2 elements)
 * @param twiddles_dbl1 - Second layer twiddles (1 element)
 * 
 * # Safety
 * 
 * Behavior is undefined if arrays don't have proper alignment.
 */
export function ifft2(
  values: number[],
  offset: number,
  log_step: number,
  twiddles_dbl0: number[],
  twiddles_dbl1: number[]
): void {
  if (twiddles_dbl0.length !== 2) {
    throw new Error(`Expected 2 twiddles_dbl0, got ${twiddles_dbl0.length}`);
  }
  if (twiddles_dbl1.length !== 1) {
    throw new Error(`Expected 1 twiddles_dbl1, got ${twiddles_dbl1.length}`);
  }

  // Load the 4 SIMD vectors from the array
  const vals: PackedM31[] = [];
  for (let i = 0; i < 4; i++) {
    const data = values.slice(offset + (i << log_step), offset + (i << log_step) + 16);
    if (data.length < 16) {
      while (data.length < 16) data.push(0);
    }
    vals.push(PackedM31.fromArray(data.map(v => M31.fromUnchecked(v))));
  }

  // Apply 2 layers of inverse butterflies
  // Layer 0 (step 1)
  for (let i = 0; i < 4; i += 2) {
    const twiddle = Array(16).fill(twiddles_dbl0[i / 2]!);
    [vals[i]!, vals[i + 1]!] = simdIButterfly(vals[i]!, vals[i + 1]!, twiddle);
  }

  // Layer 1 (step 2)
  for (let i = 0; i < 2; i++) {
    const twiddle = Array(16).fill(twiddles_dbl1[0]!);
    [vals[i]!, vals[i + 2]!] = simdIButterfly(vals[i]!, vals[i + 2]!, twiddle);
  }

  // Store the 4 SIMD vectors back to the array
  for (let i = 0; i < 4; i++) {
    const result = vals[i]!.toArray().map(v => v.value);
    for (let j = 0; j < 16; j++) {
      const idx = offset + (i << log_step) + j;
      if (idx < values.length) {
        values[idx] = result[j]!;
      }
    }
  }
}

/**
 * 1-layer IFFT operation.
 * 
 * @param values - Values array (in-place operation)
 * @param offset - Offset in the array
 * @param log_step - Log of the step size
 * @param twiddles_dbl0 - Twiddles (1 element)
 * 
 * # Safety
 * 
 * Behavior is undefined if arrays don't have proper alignment.
 */
export function ifft1(
  values: number[],
  offset: number,
  log_step: number,
  twiddles_dbl0: number[]
): void {
  if (twiddles_dbl0.length !== 1) {
    throw new Error(`Expected 1 twiddles_dbl0, got ${twiddles_dbl0.length}`);
  }

  // Load the 2 SIMD vectors from the array
  const data0 = values.slice(offset + (0 << log_step), offset + (0 << log_step) + 16);
  const data1 = values.slice(offset + (1 << log_step), offset + (1 << log_step) + 16);
  
  if (data0.length < 16) while (data0.length < 16) data0.push(0);
  if (data1.length < 16) while (data1.length < 16) data1.push(0);
  
  let val0 = PackedM31.fromArray(data0.map(v => M31.fromUnchecked(v)));
  let val1 = PackedM31.fromArray(data1.map(v => M31.fromUnchecked(v)));

  const twiddle = Array(16).fill(twiddles_dbl0[0]!);
  [val0, val1] = simdIButterfly(val0, val1, twiddle);

  // Store the 2 SIMD vectors back to the array
  const result0 = val0.toArray().map(v => v.value);
  const result1 = val1.toArray().map(v => v.value);
  
  for (let i = 0; i < 16; i++) {
    const idx0 = offset + (0 << log_step) + i;
    const idx1 = offset + (1 << log_step) + i;
    if (idx0 < values.length) values[idx0] = result0[i]!;
    if (idx1 < values.length) values[idx1] = result1[i]!;
  }
} 