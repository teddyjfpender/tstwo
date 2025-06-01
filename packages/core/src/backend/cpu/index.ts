/*
This is the Rust code from backend/cpu/mod.rs that needs to be ported to Typescript in this backend/cpu/index.ts file:
*/
import { bitReverseIndex } from "../../utils";
import type { Backend, Column, PolyOps, QuotientOps, FriOps, AccumulationOps, GkrOps } from "../index";
import type { BaseField } from "../../fields/m31";
import type { SecureField } from "../../fields/qm31";
import { Coset } from "../../circle";
import { M31 } from "../../fields/m31";
import { batchInverseInPlace } from "../../fields/fields";
import { TwiddleTree } from "../../poly/twiddles";
import { CirclePoly, CircleEvaluation } from "../../poly/circle";

/**
 * TypeScript implementation of the CpuBackend from `backend/cpu/mod.rs`.
 * This represents a CPU-based backend for cryptographic computations.
 */
export class CpuBackend implements Backend {
  /** Backend identifier for debugging */
  readonly name = "CpuBackend";
  
  /**
   * Bit reverse a column in place.
   * This is required for FRI operations and ColumnOps interface.
   */
  bitReverseColumn<T>(col: Column<T>): void {
    // Get the internal data and bit reverse it
    if (col instanceof CpuColumn) {
      bitReverse(col.getData());
    } else {
      // Fallback for other column implementations
      const data = col.toCpu();
      bitReverse(data);
      for (let i = 0; i < data.length; i++) {
        col.set(i, data[i]!);
      }
    }
  }

  /**
   * Create a BaseField column from data array
   */
  createBaseFieldColumn(data: BaseField[]): Column<BaseField> {
    return new CpuColumn(data);
  }

  /**
   * Create a SecureField column from data array
   */
  createSecureFieldColumn(data: SecureField[]): Column<SecureField> {
    return new CpuColumn(data);
  }
}

/**
 * BackendForChannel implementations to be added when channel types are available
 * TODO(Sonnet4): when Blake2sMerkleChannel is available, implement BackendForChannel<Blake2sMerkleChannel>
 * TODO(Sonnet4): when Poseidon252MerkleChannel is available, implement BackendForChannel<Poseidon252MerkleChannel>
 */

/** In-place bit reverse. Mirrors the Rust function `bit_reverse`. */
export function bitReverse<T>(arr: T[]): void {
  const n = arr.length;
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error("length is not power of two");
  }
  const logN = Math.floor(Math.log2(n));
  for (let i = 0; i < n; i++) {
    const j = bitReverseIndex(i, logN);
    if (j > i) {
      const tmp = arr[i];
      const tmpJ = arr[j];
      if (tmp !== undefined && tmpJ !== undefined) {
        arr[i] = tmpJ;
        arr[j] = tmp;
      }
    }
  }
}

/**
 * CPU implementation of Column trait using standard arrays.
 * This corresponds to the Rust `impl<T: Debug + Clone + Default> Column<T> for Vec<T>`.
 */
export class CpuColumn<T> implements Column<T> {
  private data: T[];

  constructor(data: T[]) {
    this.data = [...data]; // Clone the data for safety
  }

  /** Creates a column filled with default values. Mirrors `Vec::zeros`. */
  static zeros<T>(len: number, defaultFactory: () => T): CpuColumn<T> {
    return new CpuColumn(Array.from({ length: len }, defaultFactory));
  }

  /** Creates an uninitialized column. Mirrors `Vec::uninitialized`. */
  static uninitialized<T>(len: number, defaultFactory: () => T): CpuColumn<T> {
    // In TypeScript, we can't have truly uninitialized memory, so we fill with defaults
    return new CpuColumn(Array.from({ length: len }, defaultFactory));
  }

  /** Creates a column from an existing array. */
  static fromArray<T>(data: T[]): CpuColumn<T> {
    return new CpuColumn(data);
  }

  zeros(len: number): Column<T> {
    // This requires a default factory, which we can't provide generically
    // This method should be called through the backend's factory methods
    throw new Error("Use backend factory methods to create columns");
  }

  uninitialized(len: number): Column<T> {
    // This requires a default factory, which we can't provide generically
    // This method should be called through the backend's factory methods
    throw new Error("Use backend factory methods to create columns");
  }

  len(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  at(index: number): T {
    if (index < 0 || index >= this.data.length) {
      throw new Error(`Index ${index} out of bounds for length ${this.data.length}`);
    }
    return this.data[index]!; // Use non-null assertion since we've checked bounds
  }

  set(index: number, value: T): void {
    if (index < 0 || index >= this.data.length) {
      throw new Error(`Index ${index} out of bounds for length ${this.data.length}`);
    }
    this.data[index] = value;
  }

  toCpu(): T[] {
    return [...this.data];
  }

  /** Get internal data for operations (use with caution). */
  getData(): T[] {
    return this.data;
  }

  /** Iterate over the column values. */
  *[Symbol.iterator](): Iterator<T> {
    for (const item of this.data) {
      yield item;
    }
  }
}

// Type alias for CpuColumnOps to match what other files expect
export type CpuColumnOps<T> = CpuColumn<T>;

// Type aliases that correspond to Rust type definitions
// TODO(Sonnet4): Fix type constraints when Circle types are properly ported
// export type CpuCirclePoly = CirclePoly<CpuBackend>;
// export type CpuCircleEvaluation<F, EvalOrder = unknown> = CircleEvaluation<CpuBackend, F, EvalOrder>;
// TODO(Sonnet4): when lookups/mle.ts is ported, replace with: export type CpuMle<F> = Mle<CpuBackend, F>;
export type CpuMle<F> = unknown;

/**
 * Compute the FFT twiddle factors for the given coset using a straightforward
 * implementation. Mirrors the Rust `slow_precompute_twiddles` helper.
 */
export function slowPrecomputeTwiddles(coset: Coset): M31[] {
  let c = coset;
  const twiddles: M31[] = [];
  
  for (let i = 0; i < coset.log_size; i++) {
    const i0 = twiddles.length;
    const points = Array.from(c.iter()).slice(0, c.size() / 2).map((p) => p.x);
    twiddles.push(...points);
    
    // Bit reverse the slice we just added
    const slice = twiddles.slice(i0);
    bitReverse(slice);
    for (let j = 0; j < slice.length; j++) {
      const sliceValue = slice[j];
      if (sliceValue !== undefined) {
        twiddles[i0 + j] = sliceValue;
      }
    }
    
    c = c.double();
  }
  
  // Pad with an arbitrary value to make the length a power of 2
  twiddles.push(M31.one());
  return twiddles;
}

/**
 * Precomputes twiddle and inverse twiddle tables for the provided coset.
 * Mirrors the Rust `precompute_twiddles` function with optimized batch inversion.
 */
export function precomputeTwiddles(coset: Coset): TwiddleTree<CpuBackend, M31[]> {
  const CHUNK_LOG_SIZE = 12;
  const CHUNK_SIZE = 1 << CHUNK_LOG_SIZE;
  
  const rootCoset = coset;
  const twiddles = slowPrecomputeTwiddles(coset);

  // Generate inverse twiddles using optimized batch inversion
  if (CHUNK_SIZE > rootCoset.size()) {
    // Fallback to the non-chunked version if the domain is not big enough
    const itwiddles = twiddles.map((t) => t.inverse());
    return new TwiddleTree(rootCoset, twiddles, itwiddles);
  }

  // Use chunked batch inversion for better performance on large datasets
  const itwiddles: M31[] = new Array(twiddles.length);
  
  for (let i = 0; i < twiddles.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, twiddles.length);
    const src = twiddles.slice(i, end);
    const dst: M31[] = new Array(src.length);
    
    // Initialize dst array with zeros
    for (let k = 0; k < dst.length; k++) {
      dst[k] = M31.zero();
    }
    
    batchInverseInPlace(src, dst);
    
    for (let j = 0; j < dst.length; j++) {
      const dstValue = dst[j];
      if (dstValue !== undefined) {
        itwiddles[i + j] = dstValue;
      }
    }
  }

  return new TwiddleTree(rootCoset, twiddles, itwiddles);
}

/**
 * Default CPU backend instance.
 */
export const cpuBackend = new CpuBackend();

// Export everything needed for the CPU backend
export { bitReverseIndex } from "../../utils";
