import type { BaseField } from "../../fields/m31";
import { M31, P } from "../../fields/m31";

/**
 * Number of lanes in a SIMD vector.
 * This corresponds to the Rust N_LANES constant.
 */
export const N_LANES = 16;

/**
 * Log base 2 of the number of lanes.
 */
export const LOG_N_LANES = 4;

/**
 * TypeScript implementation of PackedM31 from Rust.
 * Since JavaScript doesn't have native SIMD for M31 operations,
 * we simulate it with arrays while maintaining the same API.
 */
export class PackedM31 {
  private data: M31[];

  constructor(data: M31[]) {
    if (data.length !== N_LANES) {
      throw new Error(`PackedM31 requires exactly ${N_LANES} elements, got ${data.length}`);
    }
    this.data = [...data]; // Clone for safety
  }

  /**
   * Constructs a new instance with all vector elements set to `value`.
   */
  static broadcast(value: M31): PackedM31 {
    return new PackedM31(Array(N_LANES).fill(value));
  }

  /**
   * Creates a PackedM31 from an array of M31 values.
   */
  static fromArray(values: M31[]): PackedM31 {
    if (values.length !== N_LANES) {
      throw new Error(`Expected ${N_LANES} values, got ${values.length}`);
    }
    return new PackedM31(values);
  }

  /**
   * Converts to an array of M31 values.
   */
  toArray(): M31[] {
    return [...this.data];
  }

  /**
   * Creates a zero-filled PackedM31.
   */
  static zero(): PackedM31 {
    return PackedM31.broadcast(M31.zero());
  }

  /**
   * Creates a one-filled PackedM31.
   */
  static one(): PackedM31 {
    return PackedM31.broadcast(M31.one());
  }

  /**
   * Interleaves two vectors.
   * Returns (low_interleaved, high_interleaved).
   */
  interleave(other: PackedM31): [PackedM31, PackedM31] {
    const result1: M31[] = [];
    const result2: M31[] = [];
    
    for (let i = 0; i < N_LANES / 2; i++) {
      result1.push(this.data[i]!);
      result1.push(other.data[i]!);
      result2.push(this.data[i + N_LANES / 2]!);
      result2.push(other.data[i + N_LANES / 2]!);
    }
    
    return [new PackedM31(result1), new PackedM31(result2)];
  }

  /**
   * Deinterleaves two vectors.
   * Inverse operation of interleave.
   */
  deinterleave(other: PackedM31): [PackedM31, PackedM31] {
    const result1: M31[] = [];
    const result2: M31[] = [];
    
    for (let i = 0; i < N_LANES; i += 2) {
      result1.push(this.data[i]!);
      result2.push(this.data[i + 1]!);
    }
    
    for (let i = 0; i < N_LANES; i += 2) {
      result1.push(other.data[i]!);
      result2.push(other.data[i + 1]!);
    }
    
    return [new PackedM31(result1), new PackedM31(result2)];
  }

  /**
   * Reverses the order of elements in the vector.
   */
  reverse(): PackedM31 {
    return new PackedM31([...this.data].reverse());
  }

  /**
   * Sums all elements in the vector.
   */
  pointwiseSum(): M31 {
    return this.data.reduce((acc, val) => acc.add(val), M31.zero());
  }

  /**
   * Doubles each element in the vector.
   */
  double(): PackedM31 {
    return this.add(this);
  }

  /**
   * Addition operation.
   */
  add(other: PackedM31): PackedM31 {
    const result = this.data.map((val, i) => val.add(other.data[i]!));
    return new PackedM31(result);
  }

  /**
   * Subtraction operation.
   */
  sub(other: PackedM31): PackedM31 {
    const result = this.data.map((val, i) => val.sub(other.data[i]!));
    return new PackedM31(result);
  }

  /**
   * Multiplication operation.
   */
  mul(other: PackedM31): PackedM31 {
    const result = this.data.map((val, i) => val.mul(other.data[i]!));
    return new PackedM31(result);
  }

  /**
   * Negation operation.
   */
  neg(): PackedM31 {
    const result = this.data.map(val => val.neg());
    return new PackedM31(result);
  }

  /**
   * Scalar addition.
   */
  addScalar(scalar: M31): PackedM31 {
    const result = this.data.map(val => val.add(scalar));
    return new PackedM31(result);
  }

  /**
   * Scalar multiplication.
   */
  mulScalar(scalar: M31): PackedM31 {
    const result = this.data.map(val => val.mul(scalar));
    return new PackedM31(result);
  }

  /**
   * Computes the inverse of each element.
   */
  inverse(): PackedM31 {
    const result = this.data.map(val => val.inverse());
    return new PackedM31(result);
  }

  /**
   * Batch inverse operation.
   * More efficient than individual inverses for large arrays.
   */
  static batchInverse(columns: PackedM31[]): PackedM31[] {
    // For now, use individual inverses
    // TODO: Implement optimized batch inverse
    return columns.map(col => col.inverse());
  }

  /**
   * Checks if this PackedM31 equals another.
   */
  equals(other: PackedM31): boolean {
    return this.data.every((val, i) => val.equals(other.data[i]!));
  }

  /**
   * Checks if all elements are zero.
   */
  isZero(): boolean {
    return this.data.every(val => val.equals(M31.zero()));
  }

  /**
   * Gets element at index.
   */
  at(index: number): M31 {
    if (index < 0 || index >= N_LANES) {
      throw new Error(`Index ${index} out of bounds for PackedM31`);
    }
    return this.data[index]!;
  }

  /**
   * Sets element at index.
   */
  set(index: number, value: M31): void {
    if (index < 0 || index >= N_LANES) {
      throw new Error(`Index ${index} out of bounds for PackedM31`);
    }
    this.data[index] = value;
  }

  /**
   * Creates a random PackedM31.
   */
  static random(): PackedM31 {
    const data = Array.from({ length: N_LANES }, () => M31.from(Math.floor(Math.random() * 2147483647)));
    return new PackedM31(data);
  }

  /**
   * Multiplies PackedM31 by doubled twiddle factors.
   * TypeScript equivalent of mul_doubled_simd from Rust.
   * 
   * The twiddle_dbl values are already doubled, but this function
   * produces the result as if multiplying by the original (undoubled) twiddle.
   */
  static mulDoubled(a: PackedM31, twiddle_dbl: number[]): PackedM31 {
    if (twiddle_dbl.length !== N_LANES) {
      throw new Error(`Expected ${N_LANES} twiddle values, got ${twiddle_dbl.length}`);
    }
    
    const result = a.data.map((val, i) => {
      const twiddle_val = twiddle_dbl[i]!;
      if (twiddle_val === 0) {
        return M31.zero();
      }
      
      // The twiddle is already doubled (twiddle * 2), so we multiply by it directly
      // and then divide by 2 to get the result as if we multiplied by the original twiddle.
      // This matches the Rust mul_doubled implementation.
      const product = BigInt(val.value) * BigInt(twiddle_val);
      
      // Divide by 2 and handle modular reduction
      const divided = product / 2n;
      
      // Handle modular reduction properly for potentially large values
      if (divided >= BigInt(P)) {
        return M31.fromUnchecked(Number(divided % BigInt(P)));
      } else if (divided < 0n) {
        return M31.fromUnchecked(Number(((divided % BigInt(P)) + BigInt(P)) % BigInt(P)));
      } else {
        return M31.fromUnchecked(Number(divided));
      }
    });
    
    return new PackedM31(result);
  }
}

/**
 * Type alias for PackedM31 to match Rust naming.
 */
export type PackedBaseField = PackedM31; 