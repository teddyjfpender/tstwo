import type { ComplexConjugate, ExtensionOf, Field, FieldExpOps } from './fields';
import { CM31 } from './cm31';
import { M31, P } from './m31';

export const P4: bigint = BigInt('21267647892944572736998860269687930881');
export const SECURE_EXTENSION_DEGREE = 4;

// Equivalent to CM31[x] over (x^2 - 2 - i)
// Represented as ((a, b), (c, d)) of (a + bi) + (c + di)u.
export class QM31 implements Field<QM31>, ExtensionOf<CM31, QM31> {
  readonly EXTENSION_DEGREE = 4;

  constructor(public readonly c0: CM31, public readonly c1: CM31) {}

  clone(): QM31 {
    return new QM31(this.c0.clone(), this.c1.clone());
  }

  static fromUnchecked(a: number, b: number, c: number, d: number): QM31 {
    return new QM31(CM31.fromUnchecked(a, b), CM31.fromUnchecked(c, d));
  }

  /**
   * Constructs a QM31 element from raw u32 components without range checks.
   * Mirrors the Rust `from_u32_unchecked` helper.
   */
  static from_u32_unchecked(a: number, b: number, c: number, d: number): QM31 {
    return new QM31(CM31.fromUnchecked(a, b), CM31.fromUnchecked(c, d));
  }

  static fromM31(a: M31, b: M31, c: M31, d: M31): QM31 {
    return new QM31(CM31.fromM31(a, b), CM31.fromM31(c, d));
  }

  static fromM31Array(arr: [M31, M31, M31, M31]): QM31 {
    return QM31.fromM31(arr[0], arr[1], arr[2], arr[3]);
  }

  toM31Array(): [M31, M31, M31, M31] {
    return [this.c0.real, this.c0.imag, this.c1.real, this.c1.imag];
  }

  static fromPartialEvals(evals: [QM31, QM31, QM31, QM31]): QM31 {
    const e0 = evals[0];
    const e1 = evals[1].mul(QM31.fromUnchecked(0, 1, 0, 0));
    const e2 = evals[2].mul(QM31.fromUnchecked(0, 0, 1, 0));
    const e3 = evals[3].mul(QM31.fromUnchecked(0, 0, 0, 1));
    return e0.add(e1).add(e2).add(e3);
  }

  add(rhs: QM31): QM31 {
    return new QM31(this.c0.add(rhs.c0), this.c1.add(rhs.c1));
  }

  addM31(rhs: M31): QM31 {
    return new QM31(this.c0.addM31(rhs), this.c1);
  }

  double(): QM31 {
    return this.add(this);
  }

  sub(rhs: QM31): QM31 {
    return new QM31(this.c0.sub(rhs.c0), this.c1.sub(rhs.c1));
  }

  subM31(rhs: M31): QM31 {
    return new QM31(this.c0.subM31(rhs), this.c1);
  }

  neg(): QM31 {
    return new QM31(this.c0.neg(), this.c1.neg());
  }

  mul(rhs: QM31): QM31 {
    // (a + bu) * (c + du) = (ac + rbd) + (ad + bc)u
    const R = new CM31(M31.from(2), M31.from(1));
    const ac = this.c0.mul(rhs.c0);
    const rbd = R.mul(this.c1).mul(rhs.c1);
    const ad_bc = this.c0.mul(rhs.c1).add(this.c1.mul(rhs.c0));
    return new QM31(ac.add(rbd), ad_bc);
  }

  mulM31(rhs: M31): QM31 {
    return new QM31(this.c0.mulM31(rhs), this.c1.mulM31(rhs));
  }

  mulCM31(rhs: CM31): QM31 {
    return new QM31(this.c0.mul(rhs), this.c1.mul(rhs));
  }

  div(rhs: QM31): QM31 {
    return this.mul(rhs.inverse());
  }

  divM31(rhs: M31): QM31 {
    return this.mulM31(rhs.inverse());
  }

  square(): QM31 {
    return this.mul(this);
  }

  pow(exp: number): QM31 {
    let result = QM31.one();
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

  inverse(): QM31 {
    if (this.isZero()) {
      throw new Error('0 has no inverse');
    }
    const b2 = this.c1.square();
    const ib2 = new CM31(b2.imag.neg(), b2.real);
    const denom = this.c0.square().sub(b2.add(b2).add(ib2));
    const denomInv = denom.inverse();
    return new QM31(this.c0.mul(denomInv), this.c1.neg().mul(denomInv));
  }

  complexConjugate(): QM31 {
    return new QM31(this.c0.complexConjugate(), this.c1.complexConjugate());
  }

  equals(other: QM31): boolean {
    return this.c0.equals(other.c0) && this.c1.equals(other.c1);
  }

  isZero(): boolean {
    return this.c0.isZero() && this.c1.isZero();
  }

  static one(): QM31 {
    return new QM31(CM31.one(), CM31.zero());
  }

  static zero(): QM31 {
    return new QM31(CM31.zero(), CM31.zero());
  }

  static from(x: M31): QM31 {
    return new QM31(CM31.from(x), CM31.zero());
  }

  tryIntoM31(): M31 | null {
    if (!this.c1.isZero()) {
      return null;
    }
    return this.c0.tryIntoM31();
  }

  static intoSlice(elements: QM31[]): Uint8Array {
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

  toString(): string {
    return `(${this.c0}) + (${this.c1})u`;
  }
}

