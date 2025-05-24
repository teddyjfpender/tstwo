import type { Field } from './fields';

// Constants
export const MODULUS_BITS: number = 31;
export const N_BYTES_FELT: number = 4;
export const P: number = 2147483647; // 2^31 - 1

/**
 * M31 represents elements of a finite field with modulus 2^31-1 (prime field)
 */
export class M31 implements Field<M31> {
  public readonly value: number;
  
  // Provide static constants mirroring the Rust API. These are useful for
  // places in the codebase (e.g. fri.ts) that expect `SecureField.ZERO` and
  // `SecureField.ONE` style accessors instead of the `zero()`/`one()` methods.
  static readonly ZERO: M31 = new M31(0);
  static readonly ONE: M31 = new M31(1);

  /**
   * Private constructor to force all construction through static factory methods.
   * This ensures proper validation and reduction of inputs.
   */
  private constructor(value: number) {
    this.value = value;
  }
  
  /**
   * Creates a clone of this field element
   */
  clone(): M31 {
    return new M31(this.value);
  }

  /**
   * Returns `val % P` when `val` is in the range `[0, 2P)`.
   * Exact port of the Rust partial_reduce implementation.
   */
  static partialReduce(val: number): M31 {
    if (!Number.isInteger(val) || val < 0) {
      throw new Error("partialReduce: val must be a non-negative integer");
    }
    return new M31(val >= P ? val - P : val);
  }

  /**
   * Internal helper: Returns `val % P` when `val` is in the range `[0, 2P)` for BigInt inputs.
   */
  private static _partialReduceBig(valBig: bigint): M31 {
    const pBig = BigInt(P);
    const result = valBig >= pBig ? valBig - pBig : valBig;
    return new M31(Number(result));
  }

  /**
   * Returns `val % P` when `val` is in the range `[0, P^2)`.
   * Exact port of the Rust bitwise implementation:
   * ((((val >> MODULUS_BITS) + val + 1) >> MODULUS_BITS) + val) & P
   */
  static reduce(val: number | bigint): M31 {
    // Validate and normalize input
    const valBig = M31._validateAndNormalizeToBigInt(val);
    return M31._reduceBig(valBig);
  }

  /**
   * Internal helper: validates input and converts to BigInt for arithmetic.
   */
  private static _validateAndNormalizeToBigInt(val: number | bigint): bigint {
    if (typeof val === 'number') {
      if (!Number.isInteger(val)) {
        throw new Error("Value must be an integer");
      }
      if (val < 0) {
        throw new Error("Value must be non-negative for reduce operation");
      }
      return BigInt(val);
    } else {
      if (val < 0n) {
        throw new Error("Value must be non-negative for reduce operation");
      }
      return val;
    }
  }

  /**
   * Internal helper: applies the Rust reduce bit-trick to a BigInt in range [0, P^2).
   */
  private static _reduceBig(valBig: bigint): M31 {
    const modulusBitsBig = BigInt(MODULUS_BITS);
    const pBig = BigInt(P);
    
    // Apply the exact Rust formula: ((((val >> MODULUS_BITS) + val + 1) >> MODULUS_BITS) + val) & P
    const shifted1 = valBig >> modulusBitsBig;
    const step1 = shifted1 + valBig + 1n;
    const shifted2 = step1 >> modulusBitsBig;
    const step2 = shifted2 + valBig;
    const result = step2 & pBig;
    
    return new M31(Number(result));
  }

  /**
   * Constructs an M31 element from a raw unsigned 32‑bit value without
   * range checking. Mirrors the Rust `from_u32_unchecked` constructor.
   * Use this only when you know the value is already properly reduced.
   */
  static from_u32_unchecked(val: number): M31 {
    if (!Number.isInteger(val) || val < 0 || val >= P) {
      throw new Error("from_u32_unchecked: val must be an integer in [0, P)");
    }
    return new M31(val >>> 0); // Ensure it's treated as unsigned 32-bit
  }

  /**
   * Alias for from_u32_unchecked to maintain API compatibility.
   * @deprecated Use from_u32_unchecked instead for clarity.
   */
  static fromUnchecked(arg: number): M31 {
    return M31.from_u32_unchecked(arg);
  }

  /**
   * Returns the additive inverse of this element
   */
  neg(): M31 {
    if (this.value === 0) {
      return M31.ZERO;
    }
    return new M31(P - this.value);
  }

  /**
   * Returns the multiplicative inverse of this element
   * Uses pow2147483645 for exactly 37 multiplications, matching the Rust implementation
   */
  inverse(): M31 {
    if (this.isZero()) {
      throw new Error("0 has no inverse");
    }
    return pow2147483645(this);
  }

  /**
   * Adds two field elements
   */
  add(rhs: M31): M31 {
    return M31._partialReduceBig(BigInt(this.value) + BigInt(rhs.value));
  }
  
  /**
   * Returns twice this field element
   */
  double(): M31 {
    return this.add(this);
  }

  /**
   * Subtracts rhs from this element
   */
  sub(rhs: M31): M31 {
    return M31._partialReduceBig(BigInt(this.value) + BigInt(P) - BigInt(rhs.value));
  }

  /**
   * Multiplies two field elements
   */
  mul(rhs: M31): M31 {
    // Use BigInt to avoid precision loss when the intermediate product
    // exceeds 2^53. The final result fits into a 32-bit integer.
    const product = BigInt(this.value) * BigInt(rhs.value);
    return M31._reduceBig(product);
  }

  /**
   * Squares this field element
   */
  square(): M31 {
    return this.mul(this);
  }

  /**
   * Exponentiates this field element to the given power
   * Matches the Rust FieldExpOps::pow implementation which uses u128
   */
  pow(exponent: number): M31 {
    if (!Number.isInteger(exponent) || exponent < 0) {
      throw new Error("Exponent must be a non-negative integer");
    }
    
    let result = M31.ONE;
    let base = this.clone();
    let exp = BigInt(exponent);

    while (exp > 0n) {
      if (exp & 1n) {
        result = result.mul(base);
      }
      base = base.square();
      exp >>= 1n;
    }

    return result;
  }

  /**
   * Returns the complex conjugate (which is just the element itself for this field)
   */
  complexConjugate(): M31 {
    return this;
  }

  /**
   * Checks if this element is equal to the given element
   */
  equals(other: M31): boolean {
    return this.value === other.value;
  }

  /**
   * Returns 1 as a field element (reuses static constant)
   */
  static one(): M31 {
    return M31.ONE;
  }

  /**
   * Returns 0 as a field element (reuses static constant)
   */
  static zero(): M31 {
    return M31.ZERO;
  }

  /**
   * Checks if this element is zero
   */
  isZero(): boolean {
    return this.value === 0;
  }

  /**
   * Alias for isZero() using snake_case naming to mirror the Rust API.
   */
  is_zero(): boolean {
    return this.isZero();
  }

  /**
   * Converts from a signed integer to a field element.
   * Handles negative numbers exactly like the Rust From<i32> implementation.
   */
  static from(value: number): M31 {
    if (!Number.isInteger(value)) {
      throw new Error("M31.from: value must be an integer");
    }
    
    if (value < 0) {
      // Handle negative numbers exactly like Rust implementation
      // Map negative values into [0, 2P) range, then reduce
      const P2 = BigInt(2) * BigInt(P);
      const absValue = BigInt(Math.abs(value));
      const normalized = P2 - absValue;
      return M31._reduceBig(normalized);
    }
    
    return M31._reduceBig(BigInt(value));
  }

  /**
   * Serializes a list of M31 elements to bytes
   */
  static intoSlice(elements: M31[]): Uint8Array {
    const result = new Uint8Array(elements.length * 4);
    for (let i = 0; i < elements.length; i++) {
      // TypeScript doesn't understand that our loop access is safe
      // so we use a non-null assertion
      const element = elements[i]!;
      const bytes = new Uint8Array(4);
      const view = new DataView(bytes.buffer);
      view.setUint32(0, element.value, true); // true for little-endian
      result.set(bytes, i * 4);
    }
    return result;
  }

  /**
   * String representation
   */
  toString(): string {
    return this.value.toString();
  }
}

// Type alias to match Rust naming convention
export type BaseField = M31;

/**
 * Computes `v^((2^31-1)-2)`.
 * Computes the multiplicative inverse of M31 elements with 37 multiplications vs naive 60 multiplications.
 * 
 * In a prime field with modulus p, Fermat's Little Theorem tells us that a^(p-1) ≡ 1 (mod p).
 * Thus, a^(p-2) ≡ a^(-1) (mod p).
 * For M31, p = 2^31-1, so we need to compute a^(2^31-3).
 */
export function pow2147483645(v: M31): M31 {
  // This is an optimized implementation based on the original Rust code
  // It computes v^(P-2) using a specific addition chain that minimizes multiplications
  const t0 = sqn(v, 2).mul(v);
  const t1 = sqn(t0, 1).mul(t0);
  const t2 = sqn(t1, 3).mul(t0);
  const t3 = sqn(t2, 1).mul(t0);
  const t4 = sqn(t3, 8).mul(t3);
  const t5 = sqn(t4, 8).mul(t3);
  return sqn(t5, 7).mul(t2);
}

/**
 * Computes `v^(2^n)` by squaring n times.
 */
function sqn(v: M31, n: number): M31 {
  let result = v.clone();
  for (let i = 0; i < n; i++) {
    result = result.square();
  }
  return result;
}
