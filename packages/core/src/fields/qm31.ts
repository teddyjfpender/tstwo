import type { ComplexConjugate, ExtensionOf, Field, FieldExpOps } from './fields';
import { CM31 } from './cm31';
import { M31, P } from './m31';

export const P4: bigint = BigInt('21267647892944572736998860269687930881'); // (2 ** 31 - 1) ** 4
export const SECURE_EXTENSION_DEGREE = 4;

// R constant used in multiplication, mirroring Rust implementation
const R: CM31 = CM31.from_u32_unchecked(2, 1);

/**
 * Custom error class for field operations to provide programmatic catchability.
 */
export class FieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldError';
  }
}

/**
 * Extension field of CM31.
 * Equivalent to CM31[x] over (x^2 - 2 - i) as the irreducible polynomial.
 * Represented as ((a, b), (c, d)) of (a + bi) + (c + di)u.
 * 
 * This implementation exactly mirrors the Rust QM31 implementation.
 * See: https://github.com/starkware-libs/stwo/blob/main/crates/prover/src/core/fields/qm31.rs
 */
export class QM31 implements Field<QM31>, ExtensionOf<CM31, QM31> {
  readonly EXTENSION_DEGREE = 4;

  // Static constants mirroring the Rust API. These help integrate with code
  // that expects `SecureField.ZERO` and `SecureField.ONE` without calling the
  // corresponding methods.
  static readonly ZERO: QM31 = new QM31(CM31.zero(), CM31.zero());
  static readonly ONE: QM31 = new QM31(CM31.one(), CM31.zero());

  /**
   * Private constructor to force all construction through static factory methods.
   * This ensures proper validation and type safety.
   */
  private constructor(public readonly c0: CM31, public readonly c1: CM31) {}

  /**
   * Creates a clone of this field element
   */
  clone(): QM31 {
    return new QM31(this.c0.clone(), this.c1.clone());
  }

  /**
   * Validates a component value for use in QM31 construction.
   * @param value The value to validate
   * @param componentName The name of the component for error messages
   * @throws FieldError if value is not a valid component
   */
  private static validateComponent(value: number, componentName: string): void {
    if (!Number.isInteger(value) || value < 0 || value >= P) {
      throw new FieldError(`QM31.from_u32_unchecked: ${componentName} must be an integer in [0, P)`);
    }
  }

  /**
   * Constructs a QM31 element from raw u32 components with validation.
   * Mirrors the Rust `from_u32_unchecked` constructor but adds TypeScript safety.
   * Values must be integers in the range [0, P) where P = 2^31 - 1.
   * 
   * @param a First component as integer in [0, P)
   * @param b Second component as integer in [0, P)
   * @param c Third component as integer in [0, P)
   * @param d Fourth component as integer in [0, P)
   * @throws FieldError if values are not integers or outside valid range
   */
  static from_u32_unchecked(a: number, b: number, c: number, d: number): QM31 {
    QM31.validateComponent(a, 'first component');
    QM31.validateComponent(b, 'second component');
    QM31.validateComponent(c, 'third component');
    QM31.validateComponent(d, 'fourth component');
    return new QM31(CM31.from_u32_unchecked(a, b), CM31.from_u32_unchecked(c, d));
  }

  /**
   * Creates a QM31 element from four M31 elements.
   * Mirrors the Rust `from_m31` constructor.
   * This is the preferred way to construct QM31 from existing M31 field elements.
   * 
   * @param a First M31 component
   * @param b Second M31 component
   * @param c Third M31 component
   * @param d Fourth M31 component
   * @returns New QM31 element representing (a + bi) + (c + di)u
   */
  static from_m31(a: M31, b: M31, c: M31, d: M31): QM31 {
    return new QM31(CM31.from_m31(a, b), CM31.from_m31(c, d));
  }

  /**
   * Creates a QM31 element from an array of four M31 elements.
   * Mirrors the Rust `from_m31_array` constructor.
   * 
   * @param array Array of exactly 4 M31 elements
   * @returns New QM31 element
   */
  static from_m31_array(array: [M31, M31, M31, M31]): QM31 {
    return QM31.from_m31(array[0], array[1], array[2], array[3]);
  }

  /**
   * Creates a QM31 element from an array of four M31 elements.
   * Alias for from_m31_array to match camelCase naming convention.
   * 
   * @param array Array of exactly 4 M31 elements
   * @returns New QM31 element
   */
  static fromM31Array(array: [M31, M31, M31, M31]): QM31 {
    return QM31.from_m31_array(array);
  }

  /**
   * Constructs a QM31 element from raw u32 components without validation.
   * Alias for from_u32_unchecked to match camelCase naming convention.
   * 
   * @param a First component as integer in [0, P)
   * @param b Second component as integer in [0, P)
   * @param c Third component as integer in [0, P)
   * @param d Fourth component as integer in [0, P)
   * @returns New QM31 element
   */
  static fromUnchecked(a: number, b: number, c: number, d: number): QM31 {
    return QM31.from_u32_unchecked(a, b, c, d);
  }

  /**
   * Converts this QM31 element to an array of four M31 elements.
   * Mirrors the Rust `to_m31_array` method.
   * 
   * @returns Array of four M31 elements [c0.real, c0.imag, c1.real, c1.imag]
   */
  to_m31_array(): [M31, M31, M31, M31] {
    return [this.c0.real, this.c0.imag, this.c1.real, this.c1.imag];
  }

  /**
   * Converts this QM31 element to an array of four M31 elements.
   * Alias for to_m31_array to match camelCase naming convention.
   * 
   * @returns Array of four M31 elements [c0.real, c0.imag, c1.real, c1.imag]
   */
  toM31Array(): [M31, M31, M31, M31] {
    return this.to_m31_array();
  }

  /**
   * Returns the combined value, given the values of its composing base field polynomials at that point.
   * Mirrors the Rust `from_partial_evals` method exactly.
   * 
   * References Rust implementation:
   * ```rust
   * let mut res = evals[0];
   * res += evals[1] * Self::from_u32_unchecked(0, 1, 0, 0);
   * res += evals[2] * Self::from_u32_unchecked(0, 0, 1, 0);
   * res += evals[3] * Self::from_u32_unchecked(0, 0, 0, 1);
   * ```
   * 
   * @param evals Array of exactly 4 QM31 elements representing partial evaluations
   * @returns Combined QM31 element
   */
  static from_partial_evals(evals: [QM31, QM31, QM31, QM31]): QM31 {
    let res = evals[0];
    res = res.add(evals[1].mul(QM31.from_u32_unchecked(0, 1, 0, 0)));
    res = res.add(evals[2].mul(QM31.from_u32_unchecked(0, 0, 1, 0)));
    res = res.add(evals[3].mul(QM31.from_u32_unchecked(0, 0, 0, 1)));
    return res;
  }

  /**
   * Adds two field elements componentwise.
   * (a + bu) + (c + du) = (a + c) + (b + d)u
   * 
   * @param rhs Right-hand side QM31 element
   * @returns Sum of this and rhs
   */
  add(rhs: QM31): QM31 {
    const c0Sum = this.c0.add(rhs.c0);
    const c1Sum = this.c1.add(rhs.c1);
    
    // Performance optimization: reuse static constants for common results
    if (c0Sum.isZero() && c1Sum.isZero()) {
      return QM31.ZERO;
    }
    
    return new QM31(c0Sum, c1Sum);
  }

  /**
   * Adds an M31 element to the real part (treated as a + 0i + 0u).
   * (a + bu) + c = (a + c) + bu
   * 
   * @param rhs M31 element to add to real component
   * @returns Result of adding rhs to real component
   */
  addM31(rhs: M31): QM31 {
    return new QM31(this.c0.addM31(rhs), this.c1);
  }

  /**
   * Returns twice this field element.
   * Equivalent to adding the element to itself: 2 * (a + bu) = (2a) + (2b)u
   * 
   * @returns Double of this element
   */
  double(): QM31 {
    return this.add(this);
  }

  /**
   * Subtracts rhs from this element componentwise.
   * (a + bu) - (c + du) = (a - c) + (b - d)u
   * 
   * @param rhs Right-hand side QM31 element to subtract
   * @returns Difference of this and rhs
   */
  sub(rhs: QM31): QM31 {
    const c0Diff = this.c0.sub(rhs.c0);
    const c1Diff = this.c1.sub(rhs.c1);
    
    // Performance optimization: reuse static constants for common results
    if (c0Diff.isZero() && c1Diff.isZero()) {
      return QM31.ZERO;
    }
    
    return new QM31(c0Diff, c1Diff);
  }

  /**
   * Subtracts an M31 element from the real part (treated as a + 0i + 0u).
   * (a + bu) - c = (a - c) + bu
   * 
   * @param rhs M31 element to subtract from real component
   * @returns Result of subtracting rhs from real component
   */
  subM31(rhs: M31): QM31 {
    return new QM31(this.c0.subM31(rhs), this.c1);
  }

  /**
   * Returns the additive inverse of this element.
   * -(a + bu) = (-a) + (-b)u
   * 
   * @returns Negation of this element
   */
  neg(): QM31 {
    const c0Neg = this.c0.neg();
    const c1Neg = this.c1.neg();
    
    // Performance optimization: reuse static constants for common results
    if (c0Neg.isZero() && c1Neg.isZero()) {
      return QM31.ZERO;
    }
    
    return new QM31(c0Neg, c1Neg);
  }

  /**
   * Multiplies two field elements using the irreducible polynomial x^2 - (2 + i).
   * (a + bu) * (c + du) = (ac + rbd) + (ad + bc)u
   * where r = 2 + i is the constant R.
   * 
   * References exact Rust implementation:
   * ```rust
   * Self(
   *     self.0 * rhs.0 + R * self.1 * rhs.1,
   *     self.0 * rhs.1 + self.1 * rhs.0,
   * )
   * ```
   * 
   * @param rhs Right-hand side QM31 element
   * @returns Product of this and rhs
   */
  mul(rhs: QM31): QM31 {
    // Special case optimizations for common values
    if (this.isZero() || rhs.isZero()) {
      return QM31.ZERO;
    }
    if (this.equals(QM31.ONE)) {
      return rhs;
    }
    if (rhs.equals(QM31.ONE)) {
      return this;
    }
    
    // (a + bu) * (c + du) = (ac + rbd) + (ad + bc)u
    // Exact port of Rust: self.0 * rhs.0 + R * self.1 * rhs.1, self.0 * rhs.1 + self.1 * rhs.0
    const ac_plus_rbd = this.c0.mul(rhs.c0).add(R.mul(this.c1).mul(rhs.c1));
    const ad_plus_bc = this.c0.mul(rhs.c1).add(this.c1.mul(rhs.c0));
    return new QM31(ac_plus_rbd, ad_plus_bc);
  }

  /**
   * Multiplies by an M31 element (treated as c + 0i + 0u).
   * (a + bu) * c = (ac) + (bc)u
   * 
   * @param rhs M31 element to multiply by
   * @returns Product of this and rhs treated as real number
   */
  mulM31(rhs: M31): QM31 {
    // Special case optimizations
    if (this.isZero() || rhs.isZero()) {
      return QM31.ZERO;
    }
    if (rhs.equals(M31.ONE)) {
      return this;
    }
    
    return new QM31(this.c0.mulM31(rhs), this.c1.mulM31(rhs));
  }

  /**
   * Multiplies this QM31 element by a CM31 element.
   * Mirrors the Rust `mul_cm31` method.
   * 
   * @param rhs CM31 element to multiply by
   * @returns Product of this and rhs
   */
  mul_cm31(rhs: CM31): QM31 {
    return new QM31(this.c0.mul(rhs), this.c1.mul(rhs));
  }

  /**
   * Multiplies this QM31 element by a CM31 element.
   * Alias for mul_cm31 to match camelCase naming convention.
   * 
   * @param rhs CM31 element to multiply by
   * @returns Product of this and rhs
   */
  mulCM31(rhs: CM31): QM31 {
    return this.mul_cm31(rhs);
  }

  /**
   * Divides by another field element
   */
  div(rhs: QM31): QM31 {
    return this.mul(rhs.inverse());
  }

  /**
   * Divides by an M31 element (treated as c + 0i + 0u)
   */
  divM31(rhs: M31): QM31 {
    return this.mulM31(rhs.inverse());
  }

  /**
   * Squares this field element using optimized multiplication.
   * 
   * @returns Square of this element
   */
  square(): QM31 {
    return this.mul(this);
  }

  /**
   * Exponentiates this field element to the given power.
   * Matches the Rust FieldExpOps::pow implementation using binary exponentiation.
   */
  pow(exponent: number): QM31 {
    if (!Number.isInteger(exponent) || exponent < 0) {
      throw new FieldError("Exponent must be a non-negative integer");
    }
    
    let result = QM31.ONE;
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
   * Computes the multiplicative inverse of this element.
   * Uses the formula: (a + bu)^-1 = (a - bu) / (a^2 - (2+i)b^2)
   * 
   * References exact Rust FieldExpOps::inverse implementation:
   * ```rust
   * let b2 = self.1.square();
   * let ib2 = CM31(-b2.1, b2.0);
   * let denom = self.0.square() - (b2 + b2 + ib2);
   * let denom_inverse = denom.inverse();
   * Self(self.0 * denom_inverse, -self.1 * denom_inverse)
   * ```
   * 
   * @returns Multiplicative inverse of this element
   * @throws FieldError if attempting to invert zero
   */
  inverse(): QM31 {
    if (this.isZero()) {
      throw new FieldError("0 has no inverse");
    }
    
    // Special case optimization: inverse of one is one
    if (this.equals(QM31.ONE)) {
      return QM31.ONE;
    }
    
    // (a + bu)^-1 = (a - bu) / (a^2 - (2+i)b^2)
    // Exact port of Rust implementation
    const b2 = this.c1.square();
    const ib2 = CM31.from_u32_unchecked(b2.imag.neg().value, b2.real.value); // CM31(-b2.1, b2.0)
    const denom = this.c0.square().sub(b2.add(b2).add(ib2));
    const denomInverse = denom.inverse();
    return new QM31(this.c0.mul(denomInverse), this.c1.neg().mul(denomInverse));
  }

  /**
   * Returns the complex conjugate of this element
   */
  complexConjugate(): QM31 {
    return new QM31(this.c0.complexConjugate(), this.c1.complexConjugate());
  }

  /**
   * Checks if this element is equal to the given element
   */
  equals(other: QM31): boolean {
    return this.c0.equals(other.c0) && this.c1.equals(other.c1);
  }

  /**
   * Returns 1 as a field element (reuses static constant)
   */
  static one(): QM31 {
    return QM31.ONE;
  }

  /**
   * Returns 0 as a field element (reuses static constant)
   */
  static zero(): QM31 {
    return QM31.ZERO;
  }

  /**
   * Checks if this element is zero
   */
  isZero(): boolean {
    return this.c0.isZero() && this.c1.isZero();
  }

  /**
   * Alias for isZero() using snake_case naming to mirror the Rust API.
   */
  is_zero(): boolean {
    return this.isZero();
  }

  /**
   * Converts from an M31 element to this field (a + 0u).
   * This embeds the base field M31 into the extension field QM31.
   * 
   * @param x M31 element to embed
   * @returns QM31 element with x embedded as CM31 real part
   */
  static from(x: M31): QM31 {
    return new QM31(CM31.from(x), CM31.zero());
  }

  /**
   * Attempts to convert a QM31 to an M31 element.
   * Only succeeds if c1 is zero and c0 can be converted to M31.
   * 
   * This mirrors the Rust TryInto<M31> implementation and provides safe
   * conversion from the extension field back to the base field.
   * 
   * @returns M31 element if conversion is possible, null otherwise
   */
  tryIntoM31(): M31 | null {
    if (!this.c1.isZero()) {
      return null;
    }
    return this.c0.tryIntoM31();
  }

  /**
   * Serializes a list of QM31 elements to bytes.
   * Exact port of the Rust IntoSlice implementation.
   */
  static into_slice(elements: QM31[]): Uint8Array {
    const result = new Uint8Array(elements.length * 16);
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]!;
      const view = new DataView(result.buffer, i * 16, 16);
      view.setUint32(0, el.c0.real.value, true);
      view.setUint32(4, el.c0.imag.value, true);
      view.setUint32(8, el.c1.real.value, true);
      view.setUint32(12, el.c1.imag.value, true);
    }
    return result;
  }

  /**
   * String representation matching the Rust Display implementation
   */
  toString(): string {
    return `(${this.c0}) + (${this.c1})u`;
  }
}

// Type alias to match Rust naming convention
export type SecureField = QM31;

