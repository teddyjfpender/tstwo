import type { BaseField } from '../fields/m31';
import type { SecureField } from '../fields/qm31';

// Re-export backends
export { CpuBackend } from './cpu';
export { SimdBackend } from './simd';

/**
 * Column operations trait.
 * This is a 1:1 port of the Rust ColumnOps trait.
 */
export interface ColumnOps<F> {
  bitReverseColumn(col: Column<F>): void;
}

/**
 * Core Backend trait that all backend implementations must satisfy.
 * This is a 1:1 port of the Rust Backend trait.
 */
export interface Backend extends 
  ColumnOps<BaseField>,
  PolyOps,
  QuotientOps,
  FriOps,
  AccumulationOps,
  GkrOps {
  
  // Column type factory methods
  createBaseFieldColumn(data: BaseField[]): Column<BaseField>;
  createSecureFieldColumn(data: SecureField[]): Column<SecureField>;
}

/**
 * Backend trait for specific Merkle channels.
 * This is a 1:1 port of the Rust BackendForChannel trait.
 */
export interface BackendForChannel<MC extends MerkleChannel> extends 
  Backend,
  MerkleOps<MC['H']>,
  GrindOps<MC['C']> {
}

/**
 * Type alias for extracting Column type from Backend.
 * This is a 1:1 port of the Rust Col<B, T> type alias.
 */
export type Col<B extends Backend, T> = Column<T>;

/**
 * Column trait interface.
 * This is a 1:1 port of the Rust Column trait with TypeScript safety improvements.
 */
export interface Column<T> {
  /** Creates a new column of zeros with the given length */
  zeros(len: number): Column<T>;
  
  /** Creates a new column of uninitialized values with the given length */
  uninitialized(len: number): Column<T>;
  
  /** Returns a CPU vector of the column */
  toCpu(): T[];
  
  /** Returns the length of the column */
  len(): number;
  
  /** Returns true if the column is empty */
  isEmpty(): boolean;
  
  /** Retrieves the element at the given index */
  at(index: number): T;
  
  /** Sets the element at the given index */
  set(index: number, value: T): void;
}

// Forward declarations for traits that will be implemented by backends
export interface PolyOps {
  // Will be implemented based on poly/circle operations
}

export interface QuotientOps {
  // Will be implemented based on pcs/quotients operations
}

export interface FriOps {
  // Will be implemented based on fri operations
}

export interface AccumulationOps {
  // Will be implemented based on air/accumulation operations
}

export interface GkrOps {
  // Will be implemented based on lookups/gkr_prover operations
}

export interface MerkleOps<H> {
  // Will be implemented based on vcs/ops operations
}

export interface GrindOps<C> {
  // Will be implemented based on proof_of_work operations
}

export interface MerkleChannel {
  readonly H: unknown; // Hash type
  readonly C: unknown; // Commitment type
}
