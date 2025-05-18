// TODO: import { CircleDomain } from "./domain";
// TODO: import { CirclePoly } from "./poly";
// TODO: import type { PolyOps } from "./ops";
// TODO: import type { ColumnOps } from "../../backend"; // placeholder path
// TODO: import type { SimdBackend, CpuBackend } from "../../backend";
// TODO: import { TwiddleTree } from "../twiddles";
// TODO: import type { ExtensionOf } from "../../fields";

/**
 * Below is the evaluation.rs file that needs to be ported. The TypeScript version
 * defines generic circle evaluation logic operating over a backend `B` and field `F`.
 */

export class NaturalOrder {}
export class BitReversedOrder {}

export interface ColumnOps<F> {
  bitReverseColumn(col: F[]): void;
  // Backend specific conversion utilities may be defined elsewhere
}

export class CircleEvaluation<B extends ColumnOps<F>, F, EvalOrder = NaturalOrder> {
  domain: any; // TODO: replace with CircleDomain
  values: F[];

  private _evalOrder!: EvalOrder;

  constructor(domain: any, values: F[]) {
    if ((domain as any).size() !== values.length) {
      throw new Error("CircleEvaluation: domain/values size mismatch");
    }
    this.domain = domain;
    this.values = values;
  }

  static new<B extends ColumnOps<F>, F, E = NaturalOrder>(
    domain: any,
    values: F[],
  ): CircleEvaluation<B, F, E> {
    return new CircleEvaluation<B, F, E>(domain, values);
  }

  bitReverse(this: CircleEvaluation<B, F, NaturalOrder>): CircleEvaluation<B, F, BitReversedOrder> {
    (this.constructor as unknown as { bitReverseColumn(col: F[]): void }).bitReverseColumn(this.values);
    return CircleEvaluation.new<B, F, BitReversedOrder>(this.domain, this.values);
  }

  bitReverseBack(this: CircleEvaluation<B, F, BitReversedOrder>): CircleEvaluation<B, F, NaturalOrder> {
    (this.constructor as unknown as { bitReverseColumn(col: F[]): void }).bitReverseColumn(this.values);
    return CircleEvaluation.new<B, F, NaturalOrder>(this.domain, this.values);
  }

  interpolate(this: CircleEvaluation<any, any, BitReversedOrder>): any {
    const BClass: any = this.constructor;
    const coset = (this.domain as any).halfCoset;
    return BClass.interpolate(this, BClass.precomputeTwiddles(coset));
  }

  interpolateWithTwiddles(this: CircleEvaluation<any, any, BitReversedOrder>, twiddles: any): any {
    const BClass: any = this.constructor;
    return BClass.interpolate(this, twiddles);
  }

  toCpu(this: CircleEvaluation<any, F, EvalOrder>): CircleEvaluation<any, F, EvalOrder> {
    const BClass: any = this.constructor;
    return CircleEvaluation.new(BClass.to_cpu(this.values), this.domain);
  }

  deref(): F[] {
    return this.values;
  }
}

/**
 * A sub-evaluation referencing a subset of the values.
 */
export class CosetSubEvaluation<F> {
  constructor(private evaluation: F[], private offset: number, private step: number) {}

  at(index: number): F {
    const idx = (this.offset + index * this.step) & (this.evaluation.length - 1);
    return this.evaluation[idx];
  }

  // Array indexer helpers
  get(index: number): F {
    return this.at(index);
  }
}
