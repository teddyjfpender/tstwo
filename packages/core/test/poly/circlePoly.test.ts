import { describe, it, expect } from "vitest";
import { CirclePoly } from "../../src/poly/circle/poly";
import { TwiddleTree } from "../../src/poly/twiddles";

describe("CirclePoly", () => {
  class DummyPoly extends CirclePoly<any> {
    static last: any;
    static eval_at_point(poly: any, point: number) {
      this.last = { kind: "eval", poly, point };
      return point + 1;
    }
    static extend(poly: any, log: number) {
      this.last = { kind: "extend", poly, log };
      return new DummyPoly([0, 0]);
    }
    static precomputeTwiddles(hc: any) {
      this.last = { kind: "pre", hc };
      return "tw";
    }
    static evaluate(poly: any, domain: any, tw: any) {
      this.last = { kind: "evalDomain", poly, domain, tw };
      return "res";
    }
  }

  it("constructor validates power of two", () => {
    expect(() => new DummyPoly([1, 2, 3])).toThrow();
  });

  it("methods delegate to static hooks", () => {
    const poly = new DummyPoly([1, 2, 3, 4]);
    expect(poly.logSize()).toBe(2);
    expect(poly.evalAtPoint(5)).toBe(6);
    expect(DummyPoly.last.kind).toBe("eval");
    poly.extend(4);
    expect(DummyPoly.last.kind).toBe("extend");
    const domain = { halfCoset: 7 };
    poly.evaluate(domain as any);
    expect(DummyPoly.last).toEqual({ kind: "evalDomain", poly, domain, tw: "tw" });
    DummyPoly.last = null;
    poly.evaluateWithTwiddles(domain as any, "tw2" as any);
    expect(DummyPoly.last).toEqual({ kind: "evalDomain", poly, domain, tw: "tw2" });
  });
});
