import { describe, it, expect } from "vitest";
import { SecureCirclePoly, SecureEvaluation } from "../../src/poly/circle/secure_poly";
import { CircleEvaluation } from "../../src/poly/circle/evaluation";
import { TwiddleTree } from "../../src/poly/twiddles";

describe("SecureCirclePoly and Evaluation", () => {
  class DummyPoly {
    constructor(public v: number) {}
    evalAtPoint(p: number) { return this.v + p; }
    logSize() { return 1; }
    evaluateWithTwiddles(_: any, __: any) { return { values: [this.v] }; }
  }

  it("basic getters work", () => {
    const sp = new SecureCirclePoly<[DummyPoly, DummyPoly, DummyPoly, DummyPoly]>([
      new DummyPoly(1), new DummyPoly(2), new DummyPoly(3), new DummyPoly(4),
    ] as any);
    expect(sp.evalAtPoint(1)).toBe(2);
    expect(sp.evalColumnsAtPoint(1)).toEqual([2,3,4,5]);
    expect(sp.logSize()).toBe(1);
    expect(sp.intoCoordinatePolys().length).toBe(4);
  });

  it("SecureEvaluation helpers", () => {
    const domain = { size: () => 1 } as any;
    const se = new SecureEvaluation(domain, { len: 1, columns: [[0],[1],[2],[3]], to_cpu: () => ({ len:1, columns:[[9],[8],[7],[6]] }) } as any);
    const evals = se.intoCoordinateEvals();
    expect(evals.length).toBe(4);
    const cpu = se.toCpu();
    expect(cpu.values.columns[0][0]).toBe(9);
  });

  it("interpolateWithTwiddles maps columns", () => {
    const domain = { size: () => 1 } as any;
    const values = { len: 1, columns: [[5],[6],[7],[8]] } as any;
    const se = new SecureEvaluation(domain, values);
    const orig = CircleEvaluation.prototype.interpolateWithTwiddles;
    const seen: any[] = [];
    CircleEvaluation.prototype.interpolateWithTwiddles = function(tw) { seen.push(this.values[0]); return this.values[0]; };
    const res = se.interpolateWithTwiddles(new TwiddleTree(null,null,null));
    expect(seen).toEqual([5,6,7,8]);
    expect(res.intoCoordinatePolys()).toEqual([5,6,7,8]);
    CircleEvaluation.prototype.interpolateWithTwiddles = orig;
  });
});
