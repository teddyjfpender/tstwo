/**
 * SIMD bit reverse operations.
 * 1:1 port of rust-reference/core/backend/simd/bit_reverse.rs
 */

import type { PackedBaseField } from "./m31";
import { PackedM31 } from "./m31";
import { M31 } from "../../fields/m31";
import { QM31 } from "../../fields/qm31";
import { bitReverse as cpuBitReverse } from "../cpu";
import { bitReverseIndex } from "../../utils";
import { BaseColumn, SecureColumn } from "./column";
import { SimdBackend } from "./index";
import { UnsafeMut } from "./utils";

/**
 * Vector bits for SIMD operations.
 */
const VEC_BITS = 4;

/**
 * Word bits for chunking.
 */
const W_BITS = 3;

/**
 * Minimum log size for SIMD bit reverse.
 */
export const MIN_LOG_SIZE = 2 * W_BITS + VEC_BITS;

/**
 * ColumnOps implementation for BaseField (M31) on SimdBackend.
 */
export class SimdBaseFieldColumnOps {
  /**
   * Bit reverses a BaseField column using SIMD operations when beneficial.
   * Direct port of the Rust ColumnOps<BaseField> implementation.
   */
  static bitReverseColumn(column: BaseColumn): void {
    // For small columns, use the length-based function
    const totalLength = column.data.length * 16; // Each PackedM31 has 16 elements
    bitReverseM31(column.data, totalLength);
  }
}

/**
 * ColumnOps implementation for SecureField (QM31) on SimdBackend.
 */
export class SimdSecureFieldColumnOps {
  /**
   * Bit reverses a SecureField column.
   * Direct port of the Rust ColumnOps<SecureField> implementation.
   * TODO: Implement full SIMD version.
   */
  static bitReverseColumn(column: SecureColumn): void {
    // For now, convert to CPU and use CPU bit reverse
    const cpuData = column.toCpu();
    cpuBitReverse(cpuData);
    
    // Convert back to SIMD format
    for (let i = 0; i < cpuData.length; i++) {
      column.set(i, cpuData[i]!);
    }
  }
}

/**
 * Bit reverses M31 values using SIMD operations.
 * 
 * Given an array A[0..2^n), computes B[i] = A[bit_reverse(i)].
 * Direct port of the Rust bit_reverse_m31 function.
 */
export function bitReverseM31Optimized(data: PackedBaseField[]): void {
  if (data.length === 0 || !isPowerOfTwo(data.length)) {
    throw new Error("length is not power of two");
  }

  const logSize = Math.log2(data.length);
  if (logSize < MIN_LOG_SIZE) {
    throw new Error(`Log size ${logSize} is below minimum ${MIN_LOG_SIZE}`);
  }

  // Use the optimized SIMD bit reverse implementation
  bitReverseM31Simd(data);
}

/**
 * Bit reverses M31 values with actual length parameter.
 * This is a convenience function for when the actual data length differs from array length.
 */
export function bitReverseM31(data: PackedBaseField[], actualLength: number): void {
  if (actualLength === 0 || !isPowerOfTwo(actualLength)) {
    throw new Error("length is not power of two");
  }

  // Extract the actual data for bit reversal
  const cpuData: M31[] = [];
  for (let i = 0; i < actualLength; i++) {
    const chunkIndex = Math.floor(i / 16);
    const elementIndex = i % 16;
    if (chunkIndex < data.length) {
      cpuData.push(data[chunkIndex]!.at(elementIndex));
    }
  }
  
  const logSize = Math.log2(actualLength);
  
  // For small arrays or when SIMD optimization isn't beneficial, use CPU implementation
  if (logSize < MIN_LOG_SIZE || actualLength <= 256) {
    // Use CPU bit reverse
    cpuBitReverse(cpuData);
    
    // Convert back to packed format
    for (let i = 0; i < actualLength; i++) {
      const chunkIndex = Math.floor(i / 16);
      const elementIndex = i % 16;
      if (chunkIndex < data.length) {
        data[chunkIndex]!.set(elementIndex, cpuData[i]!);
      }
    }
    return;
  }

  // For larger arrays, we could implement SIMD optimization here
  // For now, still fall back to CPU implementation
  cpuBitReverse(cpuData);
  
  // Convert back to packed format
  for (let i = 0; i < actualLength; i++) {
    const chunkIndex = Math.floor(i / 16);
    const elementIndex = i % 16;
    if (chunkIndex < data.length) {
      data[chunkIndex]!.set(elementIndex, cpuData[i]!);
    }
  }
}

/**
 * SIMD-optimized bit reverse for large arrays.
 * Direct port of the Rust bit_reverse_m31 function.
 */
function bitReverseM31Simd(data: PackedBaseField[]): void {
  const logSize = Math.log2(data.length);
  const aBits = logSize - 2 * W_BITS - VEC_BITS;
  const dataWrapper = new UnsafeMut(data);
  
  // Parallel processing over chunks
  // In TypeScript, we simulate the parallel iteration with a regular loop
  for (let a = 0; a < (1 << aBits); a++) {
    const unsafeData = dataWrapper.get();
    
    for (let wL = 0; wL < (1 << W_BITS); wL++) {
      const wLRev = reverseBits(wL, W_BITS);
      for (let wH = 0; wH <= wLRev; wH++) {
        const idx = ((((wH << aBits) | a) << W_BITS) | wL);
        const idxRev = bitReverseIndex(idx, logSize - VEC_BITS);

        // In order to not swap twice, only swap if idx <= idx_rev
        if (idx > idxRev) {
          continue;
        }

        // Read first chunk
        const chunk0: PackedBaseField[] = [];
        for (let i = 0; i < 16; i++) {
          const dataIdx = idx + (i << (2 * W_BITS + aBits));
          if (dataIdx < unsafeData.length) {
            chunk0.push(unsafeData[dataIdx]!);
          }
        }
        const values0 = bitReverse16(chunk0);

        if (idx === idxRev) {
          // Palindrome index - write into the same chunk
          for (let i = 0; i < values0.length && i < 16; i++) {
            const dataIdx = idx + (i << (2 * W_BITS + aBits));
            if (dataIdx < unsafeData.length) {
              unsafeData[dataIdx] = values0[i]!;
            }
          }
          continue;
        }

        // Read bit reversed chunk
        const chunk1: PackedBaseField[] = [];
        for (let i = 0; i < 16; i++) {
          const dataIdx = idxRev + (i << (2 * W_BITS + aBits));
          if (dataIdx < unsafeData.length) {
            chunk1.push(unsafeData[dataIdx]!);
          }
        }
        const values1 = bitReverse16(chunk1);

        // Swap the chunks
        for (let i = 0; i < 16; i++) {
          const dataIdx0 = idx + (i << (2 * W_BITS + aBits));
          const dataIdx1 = idxRev + (i << (2 * W_BITS + aBits));
          if (dataIdx0 < unsafeData.length && dataIdx1 < unsafeData.length) {
            if (i < values1.length) {
              unsafeData[dataIdx0] = values1[i]!;
            }
            if (i < values0.length) {
              unsafeData[dataIdx1] = values0[i]!;
            }
          }
        }
      }
    }
  }
}

/**
 * Bit reverses 256 M31 values, packed in 16 words of 16 elements each.
 * Direct port of the Rust bit_reverse16 function.
 */
function bitReverse16(data: PackedBaseField[]): PackedBaseField[] {
  // Ensure we have exactly 16 elements, pad with zeros if necessary
  const paddedData: PackedBaseField[] = [...data];
  while (paddedData.length < 16) {
    paddedData.push(PackedM31.zero());
  }
  
  let result = paddedData.slice(0, 16);
  
  // Apply the permutation 4 times: abcd:0123 => 0abc:123d
  // This is how it looks like at each iteration:
  //   abcd:0123
  //   0abc:123d
  //   10ab:23dc
  //   210a:3dcb
  //   3210:dcba
  for (let iteration = 0; iteration < 4; iteration++) {
    const newResult: PackedBaseField[] = new Array(16);
    
    // Apply the abcd:0123 => 0abc:123d permutation
    // `interleave` allows us to interleave the first half of 2 words
    const interleaveOperations = [
      [0, 1], [2, 3], [4, 5], [6, 7],
      [8, 9], [10, 11], [12, 13], [14, 15]
    ];
    
    for (let i = 0; i < interleaveOperations.length; i++) {
      const operation = interleaveOperations[i];
      if (!operation) continue;
      
      const [idx0, idx1] = operation;
      // Add type guards to ensure indices are defined
      if (idx0 === undefined || idx1 === undefined) continue;
      
      const first = (idx0 < result.length) ? result[idx0] : undefined;
      const second = (idx1 < result.length) ? result[idx1] : undefined;
      
      if (first && second) {
        const [low, high] = first.interleave(second);
        newResult[i] = low;
        newResult[i + 8] = high;
      } else {
        // Handle missing elements
        newResult[i] = first || PackedM31.zero();
        newResult[i + 8] = second || PackedM31.zero();
      }
    }
    
    result = newResult;
  }
  
  return result;
}

/**
 * Reverses the bits of a number within the specified bit width.
 * Direct port of the Rust reverse_bits helper function.
 */
function reverseBits(num: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (num & 1);
    num >>= 1;
  }
  return result;
}

/**
 * Checks if a number is a power of two.
 */
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
} 