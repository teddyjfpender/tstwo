// TODO: import { CircleDomain } from "./domain";
// TODO: import { CircleEvaluation } from "./evaluation";
// TODO: import type { PolyOps } from "./ops";
// TODO: import { TwiddleTree } from "../twiddles";
// TODO: import type { ColumnOps } from "../../backend";
// TODO: import type { M31 as BaseField } from "../../fields/m31";

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
}
