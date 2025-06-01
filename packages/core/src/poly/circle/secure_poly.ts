import type { CircleDomain } from "./domain";
import { CircleEvaluation, BitReversedOrder } from "./evaluation";
import { CirclePoly } from "./poly";
import type { PolyOps } from "./ops";
import type { ColumnOps } from "../../backend";
import { TwiddleTree } from "../twiddles";
import type { SecureField } from "../../fields/qm31";

export const SECURE_EXTENSION_DEGREE = 4; // placeholder constant

export class SecureCirclePoly<B extends ColumnOps<any>> {
  constructor(public polys: [CirclePoly<B>, CirclePoly<B>, CirclePoly<B>, CirclePoly<B>]) {}

  evalAtPoint(point: any): any {
    // Combine coordinate evaluations - for now just return the first coordinate
    // In a full implementation, this would combine all 4 coordinates into a SecureField
    return this.polys[0].evalAtPoint(point);
  }

  evalColumnsAtPoint(point: any): any[] {
    return this.polys.map((p) => p.evalAtPoint(point));
  }

  logSize(): number {
    return this.polys[0].logSize();
  }

  evaluateWithTwiddles(domain: any, twiddles: TwiddleTree<B, any>): SecureEvaluation<B, BitReversedOrder> {
    const evaluations = this.polys.map((p) => p.evaluateWithTwiddles(domain, twiddles));
    const columns = evaluations.map(evaluation => evaluation.values);
    
    // Create a mock SecureColumnByCoords-like object
    const values = {
      len: () => domain.size(),
      columns: columns
    };
    
    return new SecureEvaluation(domain, values);
  }

  intoCoordinatePolys(): [CirclePoly<B>, CirclePoly<B>, CirclePoly<B>, CirclePoly<B>] {
    return this.polys;
  }
}

export class SecureEvaluation<B extends ColumnOps<any>, EvalOrder> {
  constructor(public domain: any, public values: any, private _evalOrder?: EvalOrder) {
    if ((domain as any).size() !== values.len()) {
      throw new Error("SecureEvaluation: size mismatch");
    }
  }

  /**
   * Creates a new SecureEvaluation.
   * Static factory method to match Rust implementation.
   */
  static new<B extends ColumnOps<any>, EvalOrder>(
    domain: any, 
    values: any
  ): SecureEvaluation<B, EvalOrder> {
    return new SecureEvaluation<B, EvalOrder>(domain, values);
  }

  intoCoordinateEvals(): any[] {
    const { domain, values } = this;
    return values.columns.map((c: any) => new CircleEvaluation<B, any, EvalOrder>(domain, c));
  }

  toCpu(): SecureEvaluation<any, EvalOrder> {
    return new SecureEvaluation(this.domain, this.values.to_cpu(), this._evalOrder);
  }

  interpolateWithTwiddles(twiddles: TwiddleTree<B, any>): SecureCirclePoly<B> {
    const domain = this.domain;
    const cols = this.values.columns;
    const polys = cols.map((c: any) =>
      new CircleEvaluation<B, any, BitReversedOrder>(domain, c).interpolateWithTwiddles(twiddles),
    );
    return new SecureCirclePoly(polys as any);
  }
}