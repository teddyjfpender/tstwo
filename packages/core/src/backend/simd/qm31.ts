import type { SecureField } from "../../fields/qm31";
import { QM31 } from "../../fields/qm31";
import { M31 } from "../../fields/m31";
import { PackedM31, N_LANES } from "./m31";

/**
 * TypeScript implementation of PackedQM31 from Rust.
 * Represents a SIMD vector of QM31 (secure field) elements.
 */
export class PackedQM31 {
  private data: QM31[];

  constructor(data: QM31[]) {
    if (data.length !== N_LANES) {
      throw new Error(`PackedQM31 requires exactly ${N_LANES} elements, got ${data.length}`);
    }
    this.data = [...data]; // Clone for safety
  }

  /**
   * Constructs a new instance with all vector elements set to `value`.
   */
  static broadcast(value: QM31): PackedQM31 {
    return new PackedQM31(Array(N_LANES).fill(value));
  }

  /**
   * Creates a PackedQM31 from an array of QM31 values.
   */
  static fromArray(values: QM31[]): PackedQM31 {
    if (values.length !== N_LANES) {
      throw new Error(`Expected ${N_LANES} values, got ${values.length}`);
    }
    return new PackedQM31(values);
  }

  /**
   * Converts to an array of QM31 values.
   */
  toArray(): QM31[] {
    return [...this.data];
  }

  /**
   * Creates a zero-filled PackedQM31.
   */
  static zero(): PackedQM31 {
    return PackedQM31.broadcast(QM31.zero());
  }

  /**
   * Creates a one-filled PackedQM31.
   */
  static one(): PackedQM31 {
    return PackedQM31.broadcast(QM31.one());
  }

  /**
   * Creates a PackedQM31 from a PackedM31 (extension from base field).
   */
  static fromPackedM31(packed: PackedM31): PackedQM31 {
    const data = packed.toArray().map(m31 => QM31.from(m31));
    return new PackedQM31(data);
  }

  /**
   * Interleaves two vectors.
   */
  interleave(other: PackedQM31): [PackedQM31, PackedQM31] {
    const result1: QM31[] = [];
    const result2: QM31[] = [];
    
    for (let i = 0; i < N_LANES / 2; i++) {
      result1.push(this.data[i]!);
      result1.push(other.data[i]!);
      result2.push(this.data[i + N_LANES / 2]!);
      result2.push(other.data[i + N_LANES / 2]!);
    }
    
    return [new PackedQM31(result1), new PackedQM31(result2)];
  }

  /**
   * Deinterleaves two vectors.
   */
  deinterleave(other: PackedQM31): [PackedQM31, PackedQM31] {
    const result1: QM31[] = [];
    const result2: QM31[] = [];
    
    for (let i = 0; i < N_LANES; i += 2) {
      result1.push(this.data[i]!);
      result2.push(this.data[i + 1]!);
    }
    
    for (let i = 0; i < N_LANES; i += 2) {
      result1.push(other.data[i]!);
      result2.push(other.data[i + 1]!);
    }
    
    return [new PackedQM31(result1), new PackedQM31(result2)];
  }

  /**
   * Reverses the order of elements in the vector.
   */
  reverse(): PackedQM31 {
    return new PackedQM31([...this.data].reverse());
  }

  /**
   * Sums all elements in the vector.
   */
  pointwiseSum(): QM31 {
    return this.data.reduce((acc, val) => acc.add(val), QM31.zero());
  }

  /**
   * Addition operation.
   */
  add(other: PackedQM31): PackedQM31 {
    const result = this.data.map((val, i) => val.add(other.data[i]!));
    return new PackedQM31(result);
  }

  /**
   * Addition with PackedM31 (base field).
   */
  addPackedM31(other: PackedM31): PackedQM31 {
    const otherArray = other.toArray();
    const result = this.data.map((val, i) => val.add(QM31.from(otherArray[i]!)));
    return new PackedQM31(result);
  }

  /**
   * Subtraction operation.
   */
  sub(other: PackedQM31): PackedQM31 {
    const result = this.data.map((val, i) => val.sub(other.data[i]!));
    return new PackedQM31(result);
  }

  /**
   * Multiplication operation.
   */
  mul(other: PackedQM31): PackedQM31 {
    const result = this.data.map((val, i) => val.mul(other.data[i]!));
    return new PackedQM31(result);
  }

  /**
   * Multiplication with PackedM31 (base field).
   */
  mulPackedM31(other: PackedM31): PackedQM31 {
    const otherArray = other.toArray();
    const result = this.data.map((val, i) => val.mul(QM31.from(otherArray[i]!)));
    return new PackedQM31(result);
  }

  /**
   * Negation operation.
   */
  neg(): PackedQM31 {
    const result = this.data.map(val => val.neg());
    return new PackedQM31(result);
  }

  /**
   * Scalar addition.
   */
  addScalar(scalar: QM31): PackedQM31 {
    const result = this.data.map(val => val.add(scalar));
    return new PackedQM31(result);
  }

  /**
   * Scalar multiplication.
   */
  mulScalar(scalar: QM31): PackedQM31 {
    const result = this.data.map(val => val.mul(scalar));
    return new PackedQM31(result);
  }

  /**
   * Computes the inverse of each element.
   */
  inverse(): PackedQM31 {
    const result = this.data.map(val => val.inverse());
    return new PackedQM31(result);
  }

  /**
   * Batch inverse operation.
   */
  static batchInverse(columns: PackedQM31[]): PackedQM31[] {
    // For now, use individual inverses
    // TODO: Implement optimized batch inverse
    return columns.map(col => col.inverse());
  }

  /**
   * Checks if this PackedQM31 equals another.
   */
  equals(other: PackedQM31): boolean {
    return this.data.every((val, i) => val.equals(other.data[i]!));
  }

  /**
   * Checks if all elements are zero.
   */
  isZero(): boolean {
    return this.data.every(val => val.equals(QM31.zero()));
  }

  /**
   * Gets element at index.
   */
  at(index: number): QM31 {
    if (index < 0 || index >= N_LANES) {
      throw new Error(`Index ${index} out of bounds for PackedQM31`);
    }
    return this.data[index]!;
  }

  /**
   * Sets element at index.
   */
  set(index: number, value: QM31): void {
    if (index < 0 || index >= N_LANES) {
      throw new Error(`Index ${index} out of bounds for PackedQM31`);
    }
    this.data[index] = value;
  }

  /**
   * Creates a random PackedQM31.
   */
  static random(): PackedQM31 {
    const data = Array.from({ length: N_LANES }, () => {
      const a = M31.from(Math.floor(Math.random() * 2147483647));
      const b = M31.from(Math.floor(Math.random() * 2147483647));
      const c = M31.from(Math.floor(Math.random() * 2147483647));
      const d = M31.from(Math.floor(Math.random() * 2147483647));
      return QM31.fromM31Array([a, b, c, d]);
    });
    return new PackedQM31(data);
  }
}

/**
 * Type alias for PackedQM31 to match Rust naming.
 */
export type PackedSecureField = PackedQM31; 