import { describe, it, expect } from "vitest";
import { interpolateColumnsDefault, evaluatePolynomialsDefault } from "../../src/poly/circle/ops";
import { TwiddleTree } from "../../src/poly/twiddles";

class DummyEval {
  constructor(public vals: number[]) {}
  interpolateWithTwiddles(_: TwiddleTree<any, any>) {
    return new DummyPoly(this.vals);
  }
}

class DummyPoly {
  constructor(public coeffs: number[]) {}
  logSize() { return Math.log2(this.coeffs.length); }
  evaluateWithTwiddles(_: any, __: TwiddleTree<any, any>) {
    return new DummyEval(this.coeffs);
  }
}

class DummyCoset { constructor(public logSizeVal: number) {} circleDomain() { return {}; } }

describe("PolyOps defaults", () => {
  it("interpolateColumnsDefault maps evaluations", () => {
    const evals = [new DummyEval([1]), new DummyEval([2,3])];
    const res = interpolateColumnsDefault(evals, new TwiddleTree(null, null, null));
    expect(res.length).toBe(2);
    expect(res[0] instanceof DummyPoly).toBe(true);
  });

  it("evaluatePolynomialsDefault maps polynomials", () => {
    const polys = [new DummyPoly([1,2]), new DummyPoly([3,4])];
    const res = evaluatePolynomialsDefault(polys, 1, new TwiddleTree(null, null, null), DummyCoset);
    expect(res.length).toBe(2);
    expect(res[0] instanceof DummyEval).toBe(true);
  });
});
