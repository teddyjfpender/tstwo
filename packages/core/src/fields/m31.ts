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

  constructor(value: number) {
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
   */
  static partialReduce(val: number): M31 {
    return new M31(val >= P ? val - P : val);
  }

  /**
   * Returns `val % P` when `val` is in the range `[0, P^2)`.
   */
  static reduce(val: number): M31 {
    // For simplicity and correctness in JavaScript, we'll use a simple modulo operation
    // JavaScript can handle large integers before applying modulo
    let result = val % P;
    // Ensure the result is non-negative
    if (result < 0) {
      result += P;
    }
    return new M31(result);
  }

  static fromUnchecked(arg: number): M31 {
    return new M31(arg);
  }

  /**
   * Returns the additive inverse of this element
   */
  neg(): M31 {
    return M31.partialReduce(P - this.value);
  }

  /**
   * Returns the multiplicative inverse of this element
   * Uses the Extended Euclidean Algorithm for efficient inverse calculation
   * 
   * Note: For batch inverse operations, the approach in pow2147483645() might be more efficient
   * as it uses only 37 multiplications vs. O(log(p)) in the EEA.
   */
  inverse(): M31 {
    if (this.isZero()) {
      throw new Error("0 has no inverse");
    }
    
    // Using Extended Euclidean Algorithm for faster inverse calculation
    // This is more efficient than exponentiation for a single inverse
    let a = this.value;
    let b = P;
    let x = 1;
    let y = 0;
    
    while (a > 1) {
      const q = Math.floor(b / a);
      [a, b] = [b % a, a];
      [x, y] = [y - q * x, x];
    }
    
    // Make sure the result is positive
    if (x < 0) {
      x += P;
    }
    
    return new M31(x);
    
    // Alternative implementation using Fermat's Little Theorem:
    // return pow2147483645(this);
  }

  /**
   * Adds two field elements
   */
  add(rhs: M31): M31 {
    return M31.partialReduce(this.value + rhs.value);
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
    return M31.partialReduce(this.value + P - rhs.value);
  }

  /**
   * Multiplies two field elements
   */
  mul(rhs: M31): M31 {
    // Use BigInt to avoid precision loss when the intermediate product
    // exceeds 2^53. The final result fits into a 32-bit integer, so we
    // convert back to a number after applying the modulus.
    const product = BigInt(this.value) * BigInt(rhs.value);
    const reduced = Number(product % BigInt(P));
    return M31.reduce(reduced);
  }

  /**
   * Squares this field element
   */
  square(): M31 {
    return this.mul(this);
  }

  /**
   * Exponentiates this field element to the given power
   */
  pow(exponent: number): M31 {
    // For very large exponents, we need to handle them carefully
    if (exponent >= P) {
      // Using Fermat's Little Theorem: a^(p-1) ≡ 1 (mod p)
      // So we can compute a^(exponent mod (p-1))
      exponent = exponent % (P - 1);
      // Special case: if exponent becomes 0 after modulo (p-1), it should be (p-1)
      if (exponent === 0) {
        exponent = P - 1;
      }
    }

    let result = M31.one();
    let base = new M31(this.value);
    let exp = exponent;

    while (exp > 0) {
      if (exp & 1) {
        result = result.mul(base);
      }
      base = base.square();
      exp >>>= 1;
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
   * Returns 1 as a field element
   */
  static one(): M31 {
    return new M31(1);
  }

  /**
   * Returns 0 as a field element
   */
  static zero(): M31 {
    return new M31(0);
  }

  /**
   * Checks if this element is zero
   */
  isZero(): boolean {
    return this.value === 0;
  }

  /**
   * Converts from a number to a field element
   */
  static from(value: number): M31 {
    if (value < 0) {
      // Handle negative numbers similar to the Rust implementation
      const absValue = Math.abs(value);
      return M31.reduce(2 * P - absValue);
    }
    return M31.reduce(value);
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
  let result = new M31(v.value);
  for (let i = 0; i < n; i++) {
    result = result.square();
  }
  return result;
}
