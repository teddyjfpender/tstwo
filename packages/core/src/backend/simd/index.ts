import type { Backend, Column } from "../index";
import type { BaseField } from "../../fields/m31";
import type { SecureField } from "../../fields/qm31";
import { M31 } from "../../fields/m31";
import { QM31 } from "../../fields/qm31";

// Re-export all SIMD modules
export * from "./m31";
export * from "./qm31";
export * from "./cm31";
export * from "./column";
export * from "./bit_reverse";
export * from "./utils";
export * from "./very_packed_m31";
export * from "./fft";

// Import column types for the backend
import { BaseColumn, SecureColumn } from "./column";

// Core SIMD constants (also exported from m31.ts)
export const N_LANES = 16;
export const LOG_N_LANES = 4;

// Optimal chunk sizes determined empirically (from Rust implementation)
export const PACKED_M31_BATCH_INVERSE_CHUNK_SIZE = 1 << 9;
export const PACKED_CM31_BATCH_INVERSE_CHUNK_SIZE = 1 << 10;
export const PACKED_QM31_BATCH_INVERSE_CHUNK_SIZE = 1 << 11;

/**
 * TypeScript implementation of the SimdBackend from `backend/simd/mod.rs`.
 * This represents a SIMD-optimized backend for cryptographic computations.
 * 
 * Note: In TypeScript/JavaScript, true SIMD operations are limited compared to Rust.
 * This implementation provides the same API but may fall back to CPU operations
 * where SIMD is not available or practical.
 */
export class SimdBackend implements Backend {
  /** Backend identifier for debugging */
  readonly name = "SimdBackend";
  
  /**
   * Create a BaseField column from data array
   */
  createBaseFieldColumn(data: BaseField[]): Column<BaseField> {
    return BaseColumn.fromCpu(data);
  }

  /**
   * Create a SecureField column from data array
   */
  createSecureFieldColumn(data: SecureField[]): Column<SecureField> {
    return SecureColumn.fromCpu(data);
  }

  /**
   * Bit reverse a column in place.
   * This is required for FRI operations and ColumnOps interface.
   */
  bitReverseColumn<T>(column: Column<T>): void {
    if (column instanceof BaseColumn) {
      column.bitReverse();
    } else if (column instanceof SecureColumn) {
      column.bitReverse();
    } else {
      // Fallback for other column types
      const data = column.toCpu();
      const n = data.length;
      if (n === 0 || (n & (n - 1)) !== 0) {
        throw new Error("Array length must be a power of 2");
      }
      
      const logN = Math.log2(n);
      for (let i = 0; i < n; i++) {
        const j = this.bitReverseIndex(i, logN);
        if (i < j) {
          const temp = data[i]!;
          data[i] = data[j]!;
          data[j] = temp;
        }
      }
      
      // Update the column
      for (let i = 0; i < n; i++) {
        column.set(i, data[i]!);
      }
    }
  }
  
  private bitReverseIndex(index: number, logN: number): number {
    let result = 0;
    for (let i = 0; i < logN; i++) {
      result = (result << 1) | (index & 1);
      index >>= 1;
    }
    return result;
  }
}

/**
 * Default SIMD backend instance.
 */
export const simdBackend = new SimdBackend();

// Type aliases for compatibility
export type SimdBaseField = BaseField;
export type SimdSecureField = SecureField; 