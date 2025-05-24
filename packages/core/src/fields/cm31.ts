import type { ComplexConjugate, ExtensionOf, Field, FieldExpOps } from './fields';
import { M31, P } from './m31';

// Constants
export const P2: bigint = BigInt(4611686014132420609); // (2^31 - 1)^2

/**
 * Complex extension field of M31.
 * Equivalent to M31[x] over (x^2 + 1) as the irreducible polynomial.
 * Represented as (a, b) of a + bi.
 */
export class CM31 implements Field<CM31>, ExtensionOf<M31, CM31> {
  readonly EXTENSION_DEGREE = 2;
  
  // Provide static constants mirroring the Rust API
  static readonly ZERO: CM31 = new CM31(M31.ZERO, M31.ZERO);
  static readonly ONE: CM31 = new CM31(M31.ONE, M31.ZERO);

  /**
   * Private constructor to force all construction through static factory methods.
   * This ensures proper validation and type safety.
   */
  private constructor(public readonly real: M31, public readonly imag: M31) {}

  /**
   * Creates a clone of this field element
   */
  clone(): CM31 {
    return new CM31(this.real.clone(), this.imag.clone());
  }

  /**
   * Creates a CM31 element from two raw u32 values with validation.
   * Mirrors the Rust `from_u32_unchecked` constructor but adds TypeScript safety.
   * Values must be integers in the range [0, P) where P = 2^31 - 1.
   * 
   * @param a Real part as integer in [0, P)
   * @param b Imaginary part as integer in [0, P)
   * @throws Error if values are not integers or outside valid range
   */
  static from_u32_unchecked(a: number, b: number): CM31 {
    if (!Number.isInteger(a) || a < 0 || a >= P) {
      throw new Error("CM31.from_u32_unchecked: real part must be an integer in [0, P)");
    }
    if (!Number.isInteger(b) || b < 0 || b >= P) {
      throw new Error("CM31.from_u32_unchecked: imaginary part must be an integer in [0, P)");
    }
    return new CM31(M31.from_u32_unchecked(a), M31.from_u32_unchecked(b));
  }

  /**
   * Alias for from_u32_unchecked to maintain API compatibility.
   * @deprecated Use from_u32_unchecked instead for clarity and better naming consistency with Rust.
   * @param a Real part as integer in [0, P)
   * @param b Imaginary part as integer in [0, P)
   */
  static fromUnchecked(a: number, b: number): CM31 {
    return CM31.from_u32_unchecked(a, b);
  }

  /**
   * Creates a CM31 element from two M31 elements.
   * Mirrors the Rust `from_m31` constructor.
   * This is the preferred way to construct CM31 from existing M31 field elements.
   * 
   * @param a Real part as M31 field element
   * @param b Imaginary part as M31 field element
   * @returns New CM31 element representing a + bi
   */
  static from_m31(a: M31, b: M31): CM31 {
    return new CM31(a, b);
  }

  /**
   * Alias for from_m31 to maintain API compatibility.
   * @deprecated Use from_m31 instead for clarity and better naming consistency with Rust.
   * @param a Real part as M31 field element
   * @param b Imaginary part as M31 field element
   */
  static fromM31(a: M31, b: M31): CM31 {
    return CM31.from_m31(a, b);
  }

  /**
   * Adds two field elements componentwise.
   * (a + bi) + (c + di) = (a + c) + (b + d)i
   * 
   * @param rhs Right-hand side complex field element
   * @returns Sum of this and rhs
   */
  add(rhs: CM31): CM31 {
    const realSum = this.real.add(rhs.real);
    const imagSum = this.imag.add(rhs.imag);
    
    // Performance optimization: reuse static constants for common results
    if (realSum.isZero() && imagSum.isZero()) {
      return CM31.ZERO;
    }
    
    return new CM31(realSum, imagSum);
  }

  /**
   * Returns twice this field element.
   * Equivalent to adding the element to itself: 2 * (a + bi) = (2a) + (2b)i
   * 
   * @returns Double of this element
   */
  double(): CM31 {
    const realDouble = this.real.double();
    const imagDouble = this.imag.double();
    
    // Performance optimization: reuse static constants for common results
    if (realDouble.isZero() && imagDouble.isZero()) {
      return CM31.ZERO;
    }
    
    return new CM31(realDouble, imagDouble);
  }

  /**
   * Adds an M31 element to the real part (treated as a + 0i).
   * (a + bi) + c = (a + c) + bi
   * 
   * @param rhs M31 element to add to real part
   * @returns Result of adding rhs to real component
   */
  addM31(rhs: M31): CM31 {
    return new CM31(this.real.add(rhs), this.imag);
  }

  /**
   * Subtracts rhs from this element componentwise.
   * (a + bi) - (c + di) = (a - c) + (b - d)i
   * 
   * @param rhs Right-hand side complex field element to subtract
   * @returns Difference of this and rhs
   */
  sub(rhs: CM31): CM31 {
    const realDiff = this.real.sub(rhs.real);
    const imagDiff = this.imag.sub(rhs.imag);
    
    // Performance optimization: reuse static constants for common results
    if (realDiff.isZero() && imagDiff.isZero()) {
      return CM31.ZERO;
    }
    
    return new CM31(realDiff, imagDiff);
  }

  /**
   * Subtracts an M31 element from the real part (treated as a + 0i).
   * (a + bi) - c = (a - c) + bi
   * 
   * @param rhs M31 element to subtract from real part
   * @returns Result of subtracting rhs from real component
   */
  subM31(rhs: M31): CM31 {
    return new CM31(this.real.sub(rhs), this.imag);
  }

  /**
   * Returns the additive inverse of this element.
   * -(a + bi) = (-a) + (-b)i
   * 
   * @returns Negation of this element
   */
  neg(): CM31 {
    const realNeg = this.real.neg();
    const imagNeg = this.imag.neg();
    
    // Performance optimization: reuse static constants for common results
    if (realNeg.isZero() && imagNeg.isZero()) {
      return CM31.ZERO;
    }
    
    return new CM31(realNeg, imagNeg);
  }

  /**
   * Multiplies two field elements using complex multiplication.
   * (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
   * 
   * This is exact port of the Rust implementation using the standard
   * complex number multiplication formula over the M31 field.
   * 
   * @param rhs Right-hand side complex field element
   * @returns Product of this and rhs
   */
  mul(rhs: CM31): CM31 {
    // Special case optimizations for common values
    if (this.isZero() || rhs.isZero()) {
      return CM31.ZERO;
    }
    if (this.equals(CM31.ONE)) {
      return rhs;
    }
    if (rhs.equals(CM31.ONE)) {
      return this;
    }
    
    // (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
    const realPart = this.real.mul(rhs.real).sub(this.imag.mul(rhs.imag));
    const imagPart = this.real.mul(rhs.imag).add(this.imag.mul(rhs.real));
    return new CM31(realPart, imagPart);
  }

  /**
   * Multiplies by an M31 element (treated as c + 0i).
   * (a + bi) * c = (ac) + (bc)i
   * 
   * @param rhs M31 element to multiply by
   * @returns Product of this and rhs treated as real number
   */
  mulM31(rhs: M31): CM31 {
    // Special case optimizations
    if (this.isZero() || rhs.isZero()) {
      return CM31.ZERO;
    }
    if (rhs.equals(M31.ONE)) {
      return this;
    }
    
    return new CM31(this.real.mul(rhs), this.imag.mul(rhs));
  }

  /**
   * Computes the multiplicative inverse of this element.
   * Uses the formula: 1 / (a + bi) = (a - bi) / (a^2 + b^2)
   * 
   * This is the exact port of the Rust FieldExpOps::inverse implementation.
   * The method computes the complex conjugate and divides by the norm squared.
   * 
   * @returns Multiplicative inverse of this element
   * @throws Error if attempting to invert zero
   */
  inverse(): CM31 {
    if (this.isZero()) {
      throw new Error("0 has no inverse");
    }
    
    // Special case optimization: inverse of one is one
    if (this.equals(CM31.ONE)) {
      return CM31.ONE;
    }
    
    // 1 / (a + bi) = (a - bi) / (a^2 + b^2)
    const conjugate = new CM31(this.real, this.imag.neg());
    const norm = this.real.square().add(this.imag.square());
    return conjugate.mulM31(norm.inverse());
  }

  /**
   * Squares this field element using optimized complex squaring.
   * (a + bi)^2 = (a^2 - b^2) + 2abi
   * 
   * This uses the more efficient squaring formula rather than general multiplication.
   * 
   * @returns Square of this element
   */
  square(): CM31 {
    // Special case optimizations
    if (this.isZero()) {
      return CM31.ZERO;
    }
    if (this.equals(CM31.ONE)) {
      return CM31.ONE;
    }
    
    // (a + bi)^2 = (a^2 - b^2) + 2abi
    const realPart = this.real.square().sub(this.imag.square());
    const imagPart = this.real.mul(this.imag).double();
    return new CM31(realPart, imagPart);
  }

  /**
   * Divides by another field element
   */
  div(rhs: CM31): CM31 {
    return this.mul(rhs.inverse());
  }
  
  /**
   * Divides by an M31 element (treated as a + 0i)
   */
  divM31(rhs: M31): CM31 {
    const rhsInverse = rhs.inverse();
    return new CM31(this.real.mul(rhsInverse), this.imag.mul(rhsInverse));
  }

  /**
   * Exponentiates this field element to the given power.
   * Matches the Rust FieldExpOps::pow implementation using binary exponentiation.
   */
  pow(exponent: number): CM31 {
    if (!Number.isInteger(exponent) || exponent < 0) {
      throw new Error("Exponent must be a non-negative integer");
    }
    
    let result = CM31.ONE;
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
   * Returns the complex conjugate (a - bi) of this element
   */
  complexConjugate(): CM31 {
    return new CM31(this.real, this.imag.neg());
  }

  /**
   * Checks if this element is equal to the given element
   */
  equals(other: CM31): boolean {
    return this.real.equals(other.real) && this.imag.equals(other.imag);
  }

  /**
   * Returns 1 as a field element (1 + 0i)
   */
  static one(): CM31 {
    return CM31.ONE;
  }

  /**
   * Returns 0 as a field element (0 + 0i)
   */
  static zero(): CM31 {
    return CM31.ZERO;
  }

  /**
   * Checks if this element is zero
   */
  isZero(): boolean {
    return this.real.isZero() && this.imag.isZero();
  }

  /**
   * Converts from an M31 element to this field (a + 0i).
   * This embeds the base field M31 into the extension field CM31.
   * 
   * @param x M31 element to embed as real part
   * @returns CM31 element with x as real part and zero imaginary part
   */
  static from(x: M31): CM31 {
    return new CM31(x, M31.ZERO);
  }

  /**
   * Attempts to convert a CM31 to an M31 element.
   * Only succeeds if the imaginary part is zero, allowing extraction of the real part.
   * 
   * This mirrors the Rust TryInto<M31> implementation and provides safe
   * conversion from the extension field back to the base field.
   * 
   * @returns M31 real part if imaginary part is zero, null otherwise
   */
  tryIntoM31(): M31 | null {
    if (!this.imag.isZero()) {
      return null;
    }
    return this.real;
  }

  /**
   * Serializes a list of CM31 elements to bytes.
   * Exact port of the Rust IntoSlice implementation.
   */
  static intoSlice(elements: CM31[]): Uint8Array {
    const result = new Uint8Array(elements.length * 8);
    
    for (let i = 0; i < elements.length; i++) {
      // TypeScript doesn't understand array access in loops
      // so we need to use a non-null assertion
      const element = elements[i]!;
      
      // Real part - 4 bytes little-endian
      const realBytes = new Uint8Array(4);
      const realView = new DataView(realBytes.buffer);
      realView.setUint32(0, element.real.value, true); // true for little-endian
      
      // Imaginary part - 4 bytes little-endian
      const imagBytes = new Uint8Array(4);
      const imagView = new DataView(imagBytes.buffer);
      imagView.setUint32(0, element.imag.value, true); // true for little-endian
      
      // Copy to result
      result.set(realBytes, i * 8);
      result.set(imagBytes, i * 8 + 4);
    }
    
    return result;
  }

  /**
   * String representation matching the Rust Display implementation
   */
  toString(): string {
    return `${this.real} + ${this.imag}i`;
  }
} 