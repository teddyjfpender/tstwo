import type { CircleDomain } from "./domain";
import { CircleEvaluation } from "./evaluation";
import type { ColumnOps } from "./evaluation";
import type { PolyOps } from "./ops";
import { TwiddleTree } from "../twiddles";
import type { M31 as BaseField } from "../../fields/m31";

/** A polynomial defined on a CircleDomain. */
export class CirclePoly<B extends ColumnOps<any>> {
  coeffs: any[]; // TODO: use proper Col<B, BaseField>
  private logSizeValue: number;

  constructor(coeffs: any[]) {
    if (coeffs.length === 0 || (coeffs.length & (coeffs.length - 1)) !== 0) {
      throw new Error("coeffs length must be a power of two");
    }
    this.coeffs = coeffs;
    this.logSizeValue = Math.log2(coeffs.length);
  }

  static new<B extends ColumnOps<any>>(coeffs: any[]): CirclePoly<B> {
    return new CirclePoly<B>(coeffs);
  }

  logSize(): number {
    return this.logSizeValue;
  }

  /** Alias for Rust-style `log_size` method name. */
  log_size(): number {
    return this.logSize();
  }

  evalAtPoint(point: any): any {
    const BClass: any = (this.constructor as any);
    return BClass.eval_at_point(this, point);
  }

  extend(logSize: number): CirclePoly<B> {
    const BClass: any = (this.constructor as any);
    return BClass.extend(this, logSize);
  }

  evaluate(domain: any): any {
    const BClass: any = (this.constructor as any);
    const tw = BClass.precomputeTwiddles(domain.halfCoset);
    return BClass.evaluate(this, domain, tw);
  }

  evaluateWithTwiddles(domain: any, twiddles: TwiddleTree<B, any>): any {
    const BClass: any = (this.constructor as any);
    return BClass.evaluate(this, domain, twiddles);
  }

  /** Check if the polynomial lies in the FFT space of size `2^logFftSize`. */
  isInFftSpace(logFftSize: number): boolean {
    const coeffs = [...this.coeffs];
    while (coeffs.length > 0 && typeof coeffs[coeffs.length - 1].isZero === "function" && coeffs[coeffs.length - 1].isZero()) {
      coeffs.pop();
    }
    const highest = 1 << logFftSize;
    return coeffs.length <= highest;
  }

  /** Check if the polynomial lies in the FRI space of size `2^logFftSize`. */
  isInFriSpace(logFftSize: number): boolean {
    const coeffs = [...this.coeffs];
    while (coeffs.length > 0 && typeof coeffs[coeffs.length - 1].isZero === "function" && coeffs[coeffs.length - 1].isZero()) {
      coeffs.pop();
    }
    const highest = (1 << logFftSize) + 1;
    return coeffs.length <= highest;
  }
}