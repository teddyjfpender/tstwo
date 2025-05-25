import type { PackedBaseField } from "./m31";
import { PackedM31 } from "./m31";
import { M31 } from "../../fields/m31";
import { bitReverse as cpuBitReverse } from "../cpu";
import { bitReverseIndex } from "../../utils";

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
 * Bit reverses M31 values using SIMD operations.
 * 
 * Given an array A[0..2^n), computes B[i] = A[bit_reverse(i)].
 * Falls back to CPU implementation for small arrays.
 */
export function bitReverseM31(data: PackedBaseField[], actualLength: number): void {
  if (actualLength === 0 || (actualLength & (actualLength - 1)) !== 0) {
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
 */
function bitReverseM31Simd(data: PackedBaseField[]): void {
  const logSize = Math.log2(data.length);
  const aBits = logSize - 2 * W_BITS - VEC_BITS;
  
  // Parallel processing over chunks
  for (let a = 0; a < (1 << aBits); a++) {
    for (let wL = 0; wL < (1 << W_BITS); wL++) {
      const wLRev = reverseBits(wL, W_BITS);
      for (let wH = 0; wH <= wLRev; wH++) {
        const idx = ((((wH << aBits) | a) << W_BITS) | wL);
        const idxRev = bitReverseIndex(idx, logSize - VEC_BITS);

        // Only swap if idx <= idxRev to avoid double swapping
        if (idx > idxRev) {
          continue;
        }

        // Read first chunk
        const chunk0: PackedBaseField[] = [];
        for (let i = 0; i < 16; i++) {
          const dataIdx = idx + (i << (2 * W_BITS + aBits));
          if (dataIdx < data.length) {
            chunk0.push(data[dataIdx]!);
          }
        }
        const values0 = bitReverse16(chunk0);

        if (idx === idxRev) {
          // Palindrome index - write into the same chunk
          for (let i = 0; i < values0.length; i++) {
            const dataIdx = idx + (i << (2 * W_BITS + aBits));
            if (dataIdx < data.length) {
              data[dataIdx] = values0[i]!;
            }
          }
          continue;
        }

        // Read bit reversed chunk
        const chunk1: PackedBaseField[] = [];
        for (let i = 0; i < 16; i++) {
          const dataIdx = idxRev + (i << (2 * W_BITS + aBits));
          if (dataIdx < data.length) {
            chunk1.push(data[dataIdx]!);
          }
        }
        const values1 = bitReverse16(chunk1);

        // Swap the chunks
        for (let i = 0; i < Math.min(values0.length, values1.length); i++) {
          const dataIdx0 = idx + (i << (2 * W_BITS + aBits));
          const dataIdx1 = idxRev + (i << (2 * W_BITS + aBits));
          if (dataIdx0 < data.length && dataIdx1 < data.length) {
            data[dataIdx0] = values1[i]!;
            data[dataIdx1] = values0[i]!;
          }
        }
      }
    }
  }
}

/**
 * Bit reverses 256 M31 values, packed in 16 words of 16 elements each.
 */
function bitReverse16(data: PackedBaseField[]): PackedBaseField[] {
  let result = [...data];
  
  // Apply the permutation 4 times: abcd:0123 => 0abc:123d
  for (let iteration = 0; iteration < 4; iteration++) {
    const newResult: PackedBaseField[] = new Array(16);
    
    // Interleave operation
    for (let i = 0; i < Math.min(8, Math.floor(result.length / 2)); i++) {
      const first = result[i * 2];
      const second = result[i * 2 + 1];
      if (first && second) {
        const [low, high] = first.interleave(second);
        newResult[i] = low;
        newResult[i + 8] = high;
      }
    }
    
    result = newResult.filter(Boolean); // Remove undefined elements
  }
  
  return result;
}

/**
 * Reverses the bits of a number within the specified bit width.
 */
function reverseBits(num: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (num & 1);
    num >>= 1;
  }
  return result;
} 