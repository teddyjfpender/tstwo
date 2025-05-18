import { describe, it, expect } from "vitest";
import { CosetSubEvaluation } from "../../src/poly/circle/evaluation";


describe("CosetSubEvaluation", () => {
  it("indexes values correctly", () => {
    const data = [0,1,2,3,4,5,6,7];
    const sub = new CosetSubEvaluation<number>(data, 1, 2);
    expect(sub.at(0)).toBe(1);
    expect(sub.at(1)).toBe(3);
    expect(sub.get(2)).toBe(5);
  });
});

