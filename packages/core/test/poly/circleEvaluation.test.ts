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

