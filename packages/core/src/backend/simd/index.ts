import type { Backend, Column, ColumnOps, PolyOps, QuotientOps, FriOps, AccumulationOps, GkrOps, BackendForChannel, MerkleChannel } from "../index";
import type { BaseField } from "../../fields/m31";
import type { SecureField } from "../../fields/qm31";

// Re-export all SIMD modules
export * from "./m31";
export * from "./qm31";
export * from "./cm31";
export * from "./column";
export * from "./bit_reverse";
export * from "./utils";
export * from "./very_packed_m31";
export * from "./conversion";
export * from "./domain";
export * from "./accumulation";
export * from "./circle";
export * from "./quotients";
export * from "./fri";
export * from "./grind";
export * from "./prefix_sum";
export * from "./blake2s";
export * from "./poseidon252";
export * from "./fft";
export * from "./lookups";

// Import column types
import { BaseColumn, SecureColumn } from "./column";

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
      this.bitReverseBaseColumn(column as BaseColumn);
    } else if (column instanceof SecureColumn) {
      this.bitReverseSecureColumn(column as SecureColumn);
    } else {
      throw new Error("Unsupported column type for SIMD bit reverse");
    }
  }

  private bitReverseBaseColumn(column: BaseColumn): void {
    column.bitReverse();
  }

  private bitReverseSecureColumn(column: SecureColumn): void {
    column.bitReverse();
  }
}

// Optimal chunk sizes determined empirically (from Rust implementation)
export const PACKED_M31_BATCH_INVERSE_CHUNK_SIZE = 1 << 9;
export const PACKED_CM31_BATCH_INVERSE_CHUNK_SIZE = 1 << 10;
export const PACKED_QM31_BATCH_INVERSE_CHUNK_SIZE = 1 << 11;

/**
 * Default SIMD backend instance.
 */
export const simdBackend = new SimdBackend();

// Type aliases for compatibility
export type SimdBaseField = BaseField;
export type SimdSecureField = SecureField; 