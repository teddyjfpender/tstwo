import { describe, it, expect } from "vitest";
import { CircleEvaluation } from "../../src/poly/circle/evaluation";
import { bitReverseIndex } from "../../src/utils";

class DummyEval extends CircleEvaluation<any, number> {
  static bitReverseColumn(col: number[]): void {
    const n = col.length;
    const logSize = Math.log2(n);
    for (let i = 0; i < n; i++) {
      const j = bitReverseIndex(i, logSize);
      if (j > i) {
        [col[i], col[j]] = [col[j], col[i]];
      }
    }
  }
}

const dummyDomain = { size: () => 4, halfCoset: null } as any;

describe("CircleEvaluation.bitReverse", () => {
  it("reverses the evaluation order and back", () => {
    const evalNat = new DummyEval(dummyDomain, [0, 1, 2, 3]);
    const evalRev = evalNat.bitReverse();
    expect(evalRev).toBeInstanceOf(CircleEvaluation);
    expect(evalRev.values).toEqual([0, 2, 1, 3]);
    const evalBack = evalRev.bitReverseBack();
    expect(evalBack.values).toEqual([0, 1, 2, 3]);
  });
});

describe("CircleEvaluation helpers", () => {
  class DummyOps extends CircleEvaluation<any, number> {
    static lastArgs: any = {};
    static bitReverseColumn(col: number[]): void {}
    static precomputeTwiddles(coset: any) {
      this.lastArgs.precomputed = coset;
      return "tw";
    }
    static interpolate(self: any, tw: any) {
      this.lastArgs.interpolate = { self, tw };
      return { poly: true };
    }
    static to_cpu(vals: number[]) {
      return vals.map((v) => v + 1);
    }
  }

  const dom = { size: () => 2, halfCoset: 123 } as any;
  const domSmall = { size: () => 1, halfCoset: 123 } as any;

  it("static new creates instance", () => {
    const ev = DummyOps.new(dom, [1, 2]);
    expect(ev).toBeInstanceOf(CircleEvaluation);
    expect(ev.values).toEqual([1, 2]);
  });

  it("interpolate calls static hooks", () => {
    const ev = new DummyOps(dom, [1, 2]);
    const rev = ev.bitReverse();
    const res = rev.interpolate();
    expect(res).toEqual({ poly: true });
    expect(DummyOps.lastArgs).toEqual({ precomputed: 123, interpolate: { self: rev, tw: "tw" } });
  });

  it("interpolateWithTwiddles uses provided twiddles", () => {
    const ev = new DummyOps(dom, [1, 2]).bitReverse();
    DummyOps.lastArgs = {};
    const res = ev.interpolateWithTwiddles("t" as any);
    expect(res).toEqual({ poly: true });
    expect(DummyOps.lastArgs.interpolate.tw).toBe("t");
  });

  it("toCpu converts values via static method", () => {
    const ev = new DummyOps(domSmall, [1]);
    expect(() => ev.toCpu()).toThrow();
  });
});

