/**
 * Regular (forward) Circle Fast Fourier Transform (CFFT) implementation.
 * 
 * TypeScript port of the Rust backend/simd/fft/rfft.rs module.
 */

import { PackedM31, type PackedBaseField, LOG_N_LANES } from "../m31";
import { UnsafeMut, UnsafeConst, parallelIter } from "../utils";
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
 * Performs a Circle Fast Fourier Transform (CFFT) on the given values.
 * 
 * @param src - Array of u32 values to transform (source)
 * @param dst - Array of u32 values for the result (destination)
 * @param twiddle_dbl - Array of doubled twiddle factors for each layer
 * @param log_n_elements - The log of the number of elements in the values array
 * 
 * # Panics
 * 
 * This function will panic if `log_n_elements` is less than `MIN_FFT_LOG_SIZE`.
 * 
 * # Safety
 * 
 * Behavior is undefined if `src` and `dst` do not have the same alignment as PackedBaseField.
 */
export function fft(src: number[], dst: number[], twiddle_dbl: number[][], log_n_elements: number): void {
  if (!Number.isInteger(log_n_elements) || log_n_elements < MIN_FFT_LOG_SIZE) {
    throw new Error(`log_n_elements must be at least ${MIN_FFT_LOG_SIZE}, got ${log_n_elements}`);
  }

  const log_n_vecs = log_n_elements - LOG_N_LANES;
  if (log_n_elements <= CACHED_FFT_LOG_SIZE) {
    fftLowerWithVecwise(src, dst, twiddle_dbl, log_n_elements, log_n_elements);
    return;
  }

  const fft_layers_pre_transpose = Math.ceil(log_n_vecs / 2);
  const fft_layers_post_transpose = Math.floor(log_n_vecs / 2);
  
  fftLowerWithoutVecwise(
    src,
    dst,
    twiddle_dbl.slice(3 + fft_layers_pre_transpose),
    log_n_elements,
    fft_layers_post_transpose
  );
  
  transposeVecs(dst, log_n_vecs);
  
  fftLowerWithVecwise(
    dst,
    dst,
    twiddle_dbl.slice(0, 3 + fft_layers_pre_transpose),
    log_n_elements,
    fft_layers_pre_transpose + LOG_N_LANES
  );
}

/**
 * Computes partial fft on 2^log_size M31 elements.
 * 
 * @param src - A pointer to the values to transform, aligned to 64 bytes.
 * @param dst - A pointer to the destination array, aligned to 64 bytes.
 * @param twiddle_dbl - The doubles of the twiddle factors for each layer of the fft. Layer `i`
 *   holds `2^(log_size - 1 - i)` twiddles.
 * @param log_size - The log of the number of number of M31 elements in the array.
 * @param fft_layers - The number of fft layers to apply, out of log_size.
 * 
 * # Panics
 * 
 * Panics if `log_size` is not at least 5.
 * 
 * # Safety
 * 
 * `src` and `dst` must have same alignment as PackedBaseField.
 * `fft_layers` must be at least 5.
 */
export function fftLowerWithVecwise(
  src: number[],
  dst: number[],
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
    let currentSrc = src;
    
    // Apply layers in reverse order (from high to low) - step by 3
    for (let layer = fft_layers - 3; layer >= VECWISE_FFT_BITS; layer -= 3) {
      const remaining = fft_layers - layer;
      if (remaining === 1) {
        fft1Loop(currentSrc, dst, twiddle_dbl.slice(layer - 1), layer, index_h);
      } else if (remaining === 2) {
        fft2Loop(currentSrc, dst, twiddle_dbl.slice(layer - 1), layer, index_h);
      } else {
        fft3Loop(currentSrc, dst, twiddle_dbl.slice(layer - 1), remaining - 3, layer, index_h);
      }
      currentSrc = dst;
    }
    
    fftVecwiseLoop(currentSrc, dst, twiddle_dbl, fft_layers - VECWISE_FFT_BITS, index_h);
  });
}

/**
 * Computes partial fft on 2^log_size M31 elements, skipping the vecwise layers (lower 4 bits of
 * the index).
 * 
 * @param src - A pointer to the values to transform, aligned to 64 bytes.
 * @param dst - A pointer to the destination array, aligned to 64 bytes.
 * @param twiddle_dbl - The doubles of the twiddle factors for each layer of the fft.
 * @param log_size - The log of the number of number of M31 elements in the array.
 * @param fft_layers - The number of fft layers to apply, out of log_size - VEC_LOG_SIZE.
 * 
 * # Panics
 * 
 * Panics if `log_size` is not at least 4.
 * 
 * # Safety
 * 
 * `src` and `dst` must have same alignment as PackedBaseField.
 * `fft_layers` must be at least 4.
 */
export function fftLowerWithoutVecwise(
  src: number[],
  dst: number[],
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
    let currentSrc = src;
    
    // Apply layers in reverse order, stepping by 3
    // This matches the Rust: for layer in (0..fft_layers).step_by(3).rev()
    const layers = [];
    for (let layer = 0; layer < fft_layers; layer += 3) {
      layers.push(layer);
    }
    
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]!;
      const fixed_layer = layer + LOG_N_LANES;
      const remaining = fft_layers - layer;
      
      if (remaining === 1) {
        fft1Loop(currentSrc, dst, twiddle_dbl.slice(layer), fixed_layer, index_h);
      } else if (remaining === 2) {
        fft2Loop(currentSrc, dst, twiddle_dbl.slice(layer), fixed_layer, index_h);
      } else {
        fft3Loop(currentSrc, dst, twiddle_dbl.slice(layer), remaining - 3, fixed_layer, index_h);
      }
      currentSrc = dst;
    }
  });
}

/**
 * Runs the last 5 fft layers across the entire array.
 * 
 * @param src - A pointer to the values to transform, aligned to 64 bytes.
 * @param dst - A pointer to the destination array, aligned to 64 bytes.
 * @param twiddle_dbl - The doubles of the twiddle factors for each of the 5 fft layers.
 * @param loop_bits - The number of bits this loops needs to run on.
 * @param index_h - The higher part of the index, iterated by the caller.
 * 
 * # Safety
 * 
 * Behavior is undefined if `src` and `dst` do not have the same alignment as PackedBaseField.
 */
export function fftVecwiseLoop(
  src: number[],
  dst: number[],
  twiddle_dbl: number[][],
  loop_bits: number,
  index_h: number
): void {
  for (let index_l = 0; index_l < (1 << loop_bits); index_l++) {
    const index = (index_h << loop_bits) + index_l;
    
    // Load two PackedBaseField values (32 u32 values total)
    const val0_data = src.slice(index * 32, index * 32 + 16);
    const val1_data = src.slice(index * 32 + 16, index * 32 + 32);
    
    if (val0_data.length < 16 || val1_data.length < 16) continue;
    
    let val0 = PackedM31.fromArray(val0_data.map(v => M31.fromUnchecked(v)));
    let val1 = PackedM31.fromArray(val1_data.map(v => M31.fromUnchecked(v)));
    
    // Apply SIMD butterfly first
    const twiddle4 = Array(16).fill(twiddle_dbl[3]![index]!);
    [val0, val1] = simdButterfly(val0, val1, twiddle4);
    
    // Apply vecwise butterflies
    const twiddle1 = Array.from({ length: 8 }, (_, i) => twiddle_dbl[0]![index * 8 + i]!);
    const twiddle2 = Array.from({ length: 4 }, (_, i) => twiddle_dbl[1]![index * 4 + i]!);
    const twiddle3 = Array.from({ length: 2 }, (_, i) => twiddle_dbl[2]![index * 2 + i]!);
    
    [val0, val1] = vecwiseButterflies(val0, val1, twiddle1, twiddle2, twiddle3);
    
    // Store results back
    const result0 = val0.toArray().map(v => v.value);
    const result1 = val1.toArray().map(v => v.value);
    
    for (let i = 0; i < 16; i++) {
      if (index * 32 + i < dst.length) dst[index * 32 + i] = result0[i]!;
      if (index * 32 + 16 + i < dst.length) dst[index * 32 + 16 + i] = result1[i]!;
    }
  }
}

/**
 * FFT 3-layer loop.
 */
export function fft3Loop(
  src: number[],
  dst: number[],
  twiddle_dbl: number[][],
  loop_bits: number,
  layer: number,
  index_h: number
): void {
  for (let index_l = 0; index_l < (1 << loop_bits); index_l++) {
    const index = (index_h << loop_bits) + index_l;
    const offset = index << (layer + 3);
    const log_step = layer;
    
    // Extract twiddles for each layer - use modulo to handle out-of-bounds
    const twiddles0 = Array.from({ length: 4 }, (_, i) => {
      const idx = (index * 4 + i) % twiddle_dbl[0]!.length;
      return twiddle_dbl[0]![idx] ?? 0;
    });
    
    const twiddles1 = Array.from({ length: 2 }, (_, i) => {
      const idx = (index * 2 + i) % twiddle_dbl[1]!.length;
      return twiddle_dbl[1]![idx] ?? 0;
    });
    
    const twiddles2 = [twiddle_dbl[2]![index % twiddle_dbl[2]!.length] ?? 0];
    
    fft3(src, dst, offset, log_step, twiddles0, twiddles1, twiddles2);
  }
}

/**
 * FFT 2-layer loop.
 */
export function fft2Loop(
  src: number[],
  dst: number[],
  twiddle_dbl: number[][],
  layer: number,
  index: number
): void {
  const offset = index << (layer + 2);
  const log_step = layer;
  
  const twiddles0 = Array.from({ length: 2 }, (_, i) => twiddle_dbl[0]![index * 2 + i]!);
  const twiddles1 = [twiddle_dbl[1]![index]!];
  
  fft2(src, dst, offset, log_step, twiddles0, twiddles1);
}

/**
 * FFT 1-layer loop.
 */
export function fft1Loop(
  src: number[],
  dst: number[],
  twiddle_dbl: number[][],
  layer: number,
  index_h: number
): void {
  const offset = index_h << (layer + 1);
  const log_step = layer;
  
  const twiddles0 = [twiddle_dbl[0]![index_h]!];
  
  fft1(src, dst, offset, log_step, twiddles0);
}

/**
 * SIMD butterfly operation.
 * 
 * Performs the butterfly operation: (val0, val1) -> (val0 + val1 * twiddle, val0 - val1 * twiddle)
 */
export function simdButterfly(
  val0: PackedM31,
  val1: PackedM31,
  twiddle_dbl: number[]
): [PackedM31, PackedM31] {
  if (twiddle_dbl.length !== 16) {
    throw new Error(`Expected 16 twiddle values, got ${twiddle_dbl.length}`);
  }
  
  const tmp = mulTwiddle(val1, twiddle_dbl);
  const new_val1 = val0.sub(tmp);
  const new_val0 = val0.add(tmp);
  
  return [new_val0, new_val1];
}

/**
 * Vecwise butterfly operations.
 * 
 * Performs multiple layers of butterfly operations within SIMD vectors.
 */
export function vecwiseButterflies(
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
  
  // Apply the first twiddles computation
  const [t0, t1] = computeFirstTwiddles(twiddle1_dbl);
  
  // Apply butterflies in the correct order (matching Rust implementation)
  [val0, val1] = simdButterfly(val0, val1, t1);
  [val0, val1] = simdButterfly(val0, val1, t0);
  
  // Apply remaining twiddles
  const twiddle2_expanded = Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      twiddle2_expanded[i * 4 + j] = twiddle2_dbl[i]!;
    }
  }
  [val0, val1] = simdButterfly(val0, val1, twiddle2_expanded);
  
  const twiddle3_expanded = Array(16).fill(0);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 8; j++) {
      twiddle3_expanded[i * 8 + j] = twiddle3_dbl[i]!;
    }
  }
  [val0, val1] = simdButterfly(val0, val1, twiddle3_expanded);
  
  return [val0, val1];
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
 * 3-layer FFT operation.
 * 
 * @param src - Source array
 * @param dst - Destination array
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
export function fft3(
  src: number[],
  dst: number[],
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
  const values: PackedM31[] = [];
  for (let i = 0; i < 8; i++) {
    const data = src.slice(offset + (i << log_step), offset + (i << log_step) + 16);
    if (data.length < 16) {
      // Pad with zeros if needed
      while (data.length < 16) data.push(0);
    }
    values.push(PackedM31.fromArray(data.map(v => M31.fromUnchecked(v))));
  }

  // Apply 3 layers of butterflies
  // Layer 2 (step 4)
  for (let i = 0; i < 4; i++) {
    const twiddle = Array(16).fill(twiddles_dbl2[0]!);
    [values[i]!, values[i + 4]!] = simdButterfly(values[i]!, values[i + 4]!, twiddle);
  }

  // Layer 1 (step 2)
  for (let i = 0; i < 8; i += 4) {
    for (let j = 0; j < 2; j++) {
      const twiddle = Array(16).fill(twiddles_dbl1[i / 4]!);
      [values[i + j]!, values[i + j + 2]!] = simdButterfly(values[i + j]!, values[i + j + 2]!, twiddle);
    }
  }

  // Layer 0 (step 1)
  for (let i = 0; i < 8; i += 2) {
    const twiddle = Array(16).fill(twiddles_dbl0[i / 2]!);
    [values[i]!, values[i + 1]!] = simdButterfly(values[i]!, values[i + 1]!, twiddle);
  }

  // Store the 8 SIMD vectors back to the array
  for (let i = 0; i < 8; i++) {
    const result = values[i]!.toArray().map(v => v.value);
    for (let j = 0; j < 16; j++) {
      const idx = offset + (i << log_step) + j;
      if (idx < dst.length) {
        dst[idx] = result[j]!;
      }
    }
  }
}

/**
 * 2-layer FFT operation.
 * 
 * @param src - Source array
 * @param dst - Destination array
 * @param offset - Offset in the array
 * @param log_step - Log of the step size
 * @param twiddles_dbl0 - First layer twiddles (2 elements)
 * @param twiddles_dbl1 - Second layer twiddles (1 element)
 * 
 * # Safety
 * 
 * Behavior is undefined if arrays don't have proper alignment.
 */
export function fft2(
  src: number[],
  dst: number[],
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
  const values: PackedM31[] = [];
  for (let i = 0; i < 4; i++) {
    const data = src.slice(offset + (i << log_step), offset + (i << log_step) + 16);
    if (data.length < 16) {
      while (data.length < 16) data.push(0);
    }
    values.push(PackedM31.fromArray(data.map(v => M31.fromUnchecked(v))));
  }

  // Apply 2 layers of butterflies
  // Layer 1 (step 2)
  for (let i = 0; i < 2; i++) {
    const twiddle = Array(16).fill(twiddles_dbl1[0]!);
    [values[i]!, values[i + 2]!] = simdButterfly(values[i]!, values[i + 2]!, twiddle);
  }

  // Layer 0 (step 1)
  for (let i = 0; i < 4; i += 2) {
    const twiddle = Array(16).fill(twiddles_dbl0[i / 2]!);
    [values[i]!, values[i + 1]!] = simdButterfly(values[i]!, values[i + 1]!, twiddle);
  }

  // Store the 4 SIMD vectors back to the array
  for (let i = 0; i < 4; i++) {
    const result = values[i]!.toArray().map(v => v.value);
    for (let j = 0; j < 16; j++) {
      const idx = offset + (i << log_step) + j;
      if (idx < dst.length) {
        dst[idx] = result[j]!;
      }
    }
  }
}

/**
 * 1-layer FFT operation.
 * 
 * @param src - Source array
 * @param dst - Destination array
 * @param offset - Offset in the array
 * @param log_step - Log of the step size
 * @param twiddles_dbl0 - Twiddles (1 element)
 * 
 * # Safety
 * 
 * Behavior is undefined if arrays don't have proper alignment.
 */
export function fft1(
  src: number[],
  dst: number[],
  offset: number,
  log_step: number,
  twiddles_dbl0: number[]
): void {
  if (twiddles_dbl0.length !== 1) {
    throw new Error(`Expected 1 twiddles_dbl0, got ${twiddles_dbl0.length}`);
  }

  // Load the 2 SIMD vectors from the array
  const data0 = src.slice(offset + (0 << log_step), offset + (0 << log_step) + 16);
  const data1 = src.slice(offset + (1 << log_step), offset + (1 << log_step) + 16);
  
  if (data0.length < 16) while (data0.length < 16) data0.push(0);
  if (data1.length < 16) while (data1.length < 16) data1.push(0);
  
  let val0 = PackedM31.fromArray(data0.map(v => M31.fromUnchecked(v)));
  let val1 = PackedM31.fromArray(data1.map(v => M31.fromUnchecked(v)));

  const twiddle = Array(16).fill(twiddles_dbl0[0]!);
  [val0, val1] = simdButterfly(val0, val1, twiddle);

  // Store the 2 SIMD vectors back to the array
  const result0 = val0.toArray().map(v => v.value);
  const result1 = val1.toArray().map(v => v.value);
  
  for (let i = 0; i < 16; i++) {
    const idx0 = offset + (0 << log_step) + i;
    const idx1 = offset + (1 << log_step) + i;
    if (idx0 < dst.length) dst[idx0] = result0[i]!;
    if (idx1 < dst.length) dst[idx1] = result1[i]!;
  }
} 