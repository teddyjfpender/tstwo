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
  
  constructor(public readonly real: M31, public readonly imag: M31) {}

  /**
   * Creates a clone of this field element
   */
  clone(): CM31 {
    return new CM31(this.real.clone(), this.imag.clone());
  }

  /**
   * Creates a CM31 element from two raw u32 values
   */
  static fromUnchecked(a: number, b: number): CM31 {
    return new CM31(M31.fromUnchecked(a), M31.fromUnchecked(b));
  }

  /**
   * Creates a CM31 element from two M31 elements
   */
  static fromM31(a: M31, b: M31): CM31 {
    return new CM31(a, b);
  }

  /**
   * Adds two field elements
   */
  add(rhs: CM31): CM31 {
    return new CM31(this.real.add(rhs.real), this.imag.add(rhs.imag));
  }

  /**
   * Returns twice this field element
   */
  double(): CM31 {
    return new CM31(this.real.double(), this.imag.double());
  }

  /**
   * Adds an M31 element (treated as a + 0i)
   */
  addM31(rhs: M31): CM31 {
    return new CM31(this.real.add(rhs), this.imag);
  }

  /**
   * Subtracts rhs from this element
   */
  sub(rhs: CM31): CM31 {
    return new CM31(this.real.sub(rhs.real), this.imag.sub(rhs.imag));
  }

  /**
   * Subtracts an M31 element (treated as a + 0i)
   */
  subM31(rhs: M31): CM31 {
    return new CM31(this.real.sub(rhs), this.imag);
  }

  /**
   * Returns the additive inverse of this element
   */
  neg(): CM31 {
    return new CM31(this.real.neg(), this.imag.neg());
  }

  /**
   * Multiplies two field elements
   * (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
   */
  mul(rhs: CM31): CM31 {
    // Formula: (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
    const a = this.real;
    const b = this.imag;
    const c = rhs.real;
    const d = rhs.imag;
    
    // Real part = ac - bd
    const real = a.mul(c).sub(b.mul(d));
    
    // Imaginary part = ad + bc
    const imag = a.mul(d).add(b.mul(c));
    
    return new CM31(real, imag);
  }

  /**
   * Multiplies by an M31 element (treated as a + 0i)
   */
  mulM31(rhs: M31): CM31 {
    return new CM31(this.real.mul(rhs), this.imag.mul(rhs));
  }

  /**
   * Computes the multiplicative inverse of this element
   * 1 / (a + bi) = (a - bi) / (a^2 + b^2)
   */
  inverse(): CM31 {
    if (this.isZero()) {
      throw new Error("0 has no inverse");
    }
    
    // Calculate the norm: a^2 + b^2
    const a = this.real; 
    const b = this.imag;
    const aSq = a.mul(a);
    const bSq = b.mul(b);
    const norm = aSq.add(bSq);
    
    // Calculate 1/norm
    const normInv = norm.inverse();
    
    // Calculate (a - bi) / (a^2 + b^2)
    const realPart = a.mul(normInv);
    const imagPart = b.neg().mul(normInv);
    
    return new CM31(realPart, imagPart);
  }

  /**
   * Squares this field element
   */
  square(): CM31 {
    // (a + bi)^2 = (a^2 - b^2) + 2abi
    const a2 = this.real.square();
    const b2 = this.imag.square();
    const ab2 = this.real.mul(this.imag).double();
    
    return new CM31(a2.sub(b2), ab2);
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
    return new CM31(this.real.mul(rhs.inverse()), this.imag.mul(rhs.inverse()));
  }

  /**
   * Exponentiates this field element to the given power
   */
  pow(exp: number): CM31 {
    let result = CM31.one();
    let base = this.clone();
    let e = exp;
    
    while (e > 0) {
      if (e & 1) {
        result = result.mul(base);
      }
      base = base.square();
      e >>>= 1;
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
    return new CM31(M31.one(), M31.zero());
  }

  /**
   * Returns 0 as a field element (0 + 0i)
   */
  static zero(): CM31 {
    return new CM31(M31.zero(), M31.zero());
  }

  /**
   * Checks if this element is zero
   */
  isZero(): boolean {
    return this.real.isZero() && this.imag.isZero();
  }

  /**
   * Converts from an M31 element to this field (a + 0i)
   */
  static from(x: M31): CM31 {
    return new CM31(x, M31.zero());
  }

  /**
   * Attempts to convert a CM31 to an M31 element
   * Only succeeds if the imaginary part is zero
   */
  tryIntoM31(): M31 | null {
    if (!this.imag.isZero()) {
      return null;
    }
    return this.real;
  }

  /**
   * Serializes a list of CM31 elements to bytes
   */
  static intoSlice(elements: CM31[]): Uint8Array {
    const result = new Uint8Array(elements.length * 8);
    for (let i = 0; i < elements.length; i++) {
      // TypeScript doesn't understand array access in loops
      // so we need to use a non-null assertion
      const element = elements[i]!;
      
      // Real part
      const realBytes = new Uint8Array(4);
      const realView = new DataView(realBytes.buffer);
      realView.setUint32(0, element.real.value, true); // true for little-endian
      
      // Imaginary part
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
   * String representation
   */
  toString(): string {
    return `${this.real} + ${this.imag}i`;
  }
} 