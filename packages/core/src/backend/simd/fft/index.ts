/**
 * SIMD FFT operations.
 * 
 * TypeScript port of the Rust backend/simd/fft module.
 * Provides Circle Fast Fourier Transform (CFFT) and Inverse CFFT operations.
 */

import { PackedM31, type PackedBaseField, N_LANES, LOG_N_LANES } from "../m31";
import { UnsafeMut, UnsafeConst, parallelIter } from "../utils";
import { bitReverse } from "../../cpu";
import { Coset } from "../../../circle";
import { M31 } from "../../../fields/m31";
import { P } from "../../../fields/m31";

// Re-export FFT modules
export * from "./ifft";
export * from "./rfft";

/** Cached FFT log size threshold */
export const CACHED_FFT_LOG_SIZE = 16;

/** Minimum FFT log size */
export const MIN_FFT_LOG_SIZE = 5;

/**
 * Transposes the SIMD vectors in the given array.
 * 
 * Swaps the bit index abc <-> cba, where |a|=|c| and |b| = 0 or 1, according to the parity of
 * `log_n_vecs`.
 * When log_n_vecs is odd, transforms the index abc <-> cba.
 * 
 * @param values - Array of u32 values to transpose (treated as SIMD vectors)
 * @param log_n_vecs - The log of the number of SIMD vectors in the values array
 * 
 * # Safety
 * 
 * Behavior is undefined if `values` does not have the same alignment as u32x16.
 */
export function transposeVecs(values: number[], log_n_vecs: number): void {
  // Type safety: ensure log_n_vecs is a valid integer
  if (!Number.isInteger(log_n_vecs) || log_n_vecs < 0) {
    throw new Error(`log_n_vecs must be a non-negative integer, got ${log_n_vecs}`);
  }

  const half = Math.floor(log_n_vecs / 2);
  
  // Use parallelIter for consistency with Rust implementation
  const aValues = Array.from({ length: 1 << half }, (_, i) => i);
  parallelIter(aValues).forEach((a) => {
    for (let b = 0; b < (1 << (log_n_vecs & 1)); b++) {
      for (let c = 0; c < (1 << half); c++) {
        const i = (a << (log_n_vecs - half)) | (b << half) | c;
        const j = (c << (log_n_vecs - half)) | (b << half) | a;
        if (i >= j) {
          continue;
        }
        
        // Load and store 16 u32 values (one SIMD vector) - matching Rust exactly
        const val0 = load(values, i << 4);
        const val1 = load(values, j << 4);
        store(values, i << 4, val1);
        store(values, j << 4, val0);
      }
    }
  });
}

/**
 * Computes the twiddles for the first fft layer from the second, and loads both to SIMD registers.
 * 
 * Returns the twiddles for the first layer and the twiddles for the second layer.
 */
export function computeFirstTwiddles(twiddle1_dbl: number[]): [number[], number[]] {
  if (twiddle1_dbl.length !== 8) {
    throw new Error("Expected 8 twiddle values for second layer");
  }
  
  // Type safety: ensure all twiddles are valid u32 values
  for (let i = 0; i < twiddle1_dbl.length; i++) {
    const val = twiddle1_dbl[i]!;
    if (!Number.isInteger(val) || val < 0 || val > 0xFFFFFFFF) {
      throw new Error(`Invalid twiddle value at index ${i}: ${val}`);
    }
  }
  
  // Start by loading the twiddles for the second layer (layer 1):
  // simd_swizzle equivalent: repeat the 8 values to make 16
  const t1: number[] = [
    ...twiddle1_dbl, // First 8 elements
    ...twiddle1_dbl  // Repeat for 16 total elements
  ];

  // The twiddles for layer 0 can be computed from the twiddles for layer 1.
  // Since the twiddles are bit reversed, we consider the circle domain in bit reversed order.
  // Each consecutive 4 points in the bit reversed order of a coset form a circle coset of size 4.
  // A circle coset of size 4 in bit reversed order looks like this:
  //   [(x, y), (-x, -y), (y, -x), (-y, x)]
  // Note: This is related to the choice of M31_CIRCLE_GEN, and the fact the a quarter rotation
  //   is (0,-1) and not (0,1). (0,1) would yield another relation.
  // The twiddles for layer 0 are the y coordinates:
  //   [y, -y, -x, x]
  // The twiddles for layer 1 in bit reversed order are the x coordinates:
  //   [x, y]
  // Works also for inverse of the twiddles.

  // The twiddles for layer 0 are computed like this:
  //   t0[4i:4i+3] = [t1[2i+1], -t1[2i+1], -t1[2i], t1[2i]]
  // Xoring a double twiddle with P*2 transforms it to the double of its negation.
  // Note that this keeps the values as a double of a value in the range [0, P].
  const P2 = P * 2;
  const NEGATION_MASK = [0, P2, P2, 0, 0, P2, P2, 0, 0, P2, P2, 0, 0, P2, P2, 0];
  
  const t0: number[] = [];
  // simd_swizzle equivalent mapping
  const swizzle_indices = [1, 1, 0, 0, 3, 3, 2, 2, 5, 5, 4, 4, 7, 7, 6, 6];
  
  for (let i = 0; i < 16; i++) {
    const sourceIdx = swizzle_indices[i]!;
    const val = t1[sourceIdx]! ^ NEGATION_MASK[i]!;
    // Ensure result is a valid u32
    t0.push(val >>> 0);
  }
  
  return [t0, t1];
}

/**
 * Computes `v * twiddle` using the appropriate multiplication method.
 * In TypeScript, we use a simplified approach since we don't have architecture-specific SIMD.
 */
export function mulTwiddle(v: PackedBaseField, twiddle_dbl: number[]): PackedBaseField {
  // Type safety: ensure twiddle_dbl has correct length
  if (twiddle_dbl.length !== 16) {
    throw new Error(`Expected 16 twiddle values, got ${twiddle_dbl.length}`);
  }
  
  return PackedM31.mulDoubled(v, twiddle_dbl);
}

// Helper functions for load/store operations (matching Rust unsafe operations)
function load(values: number[], index: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < 16; i++) {
    result.push(values[index + i] ?? 0);
  }
  return result;
}

function store(values: number[], index: number, data: number[]): void {
  for (let i = 0; i < 16; i++) {
    if (index + i < values.length) {
      values[index + i] = data[i] ?? 0;
    }
  }
}

/**
 * Gets twiddle doubles for forward FFT.
 * Matches the Rust get_twiddle_dbls function exactly.
 */
export function getTwiddleDbls(coset: Coset): number[][] {
  const result: number[][] = [];
  let currentCoset = coset;
  
  for (let layer = 0; layer < coset.logSize(); layer++) {
    const layerTwiddles: number[] = [];
    const stepSize = currentCoset.size() / 2;
    
    for (let i = 0; i < stepSize; i++) {
      const point = currentCoset.at(i);
      // Use x coordinate and double it (matching Rust implementation)
      layerTwiddles.push((point.x.value * 2) >>> 0);
    }
    
    // Apply bit reversal to match Rust implementation
    bitReverse(layerTwiddles);
    
    result.push(layerTwiddles);
    currentCoset = currentCoset.double();
  }
  
  return result;
}

/**
 * Gets inverse twiddle doubles for inverse FFT.
 * Matches the Rust get_itwiddle_dbls function exactly.
 */
export function getITwiddleDbls(coset: Coset): number[][] {
  const forwardTwiddles = getTwiddleDbls(coset);
  
  // For inverse FFT, we need the multiplicative inverses
  return forwardTwiddles.map(layer => 
    layer.map(twiddle => {
      if (twiddle === 0) {
        return 0;
      }
      const m31Val = M31.fromUnchecked(twiddle >>> 1); // Undouble first (use >>> for unsigned)
      const inverse = m31Val.inverse();
      return (inverse.value * 2) >>> 0; // Double again and ensure u32
    })
  );
} 