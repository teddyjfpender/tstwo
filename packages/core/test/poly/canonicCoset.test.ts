import { describe, it, expect } from "vitest";
import { CanonicCoset } from "../../src/poly/circle/canonic";
import { Coset } from "../../src/circle";

describe("CanonicCoset", () => {

  it("new validates logSize", () => {
    expect(() => CanonicCoset.new(0)).toThrow();
  });

  it("exposes coset utilities", () => {
    const c = CanonicCoset.new(3);
    const expectedFull = Coset.odds(3);
    const expectedHalf = Coset.half_odds(2);
    expect(c.logSize()).toBe(3);
    expect(c.size()).toBe(8);
    expect(c.cosetFull().equals(expectedFull)).toBe(true);
    expect(c.halfCoset().equals(expectedHalf)).toBe(true);
    expect(c.circleDomain().halfCoset.equals(expectedHalf)).toBe(true);
    expect(c.initialIndex().value).toBe(expectedFull.initial_index.value);
    expect(c.stepSize().value).toBe(expectedFull.step_size.value);
    expect(c.indexAt(1).value).toBe(expectedFull.index_at(1).value);
    expect(c.at(2).x.value).toBe(expectedFull.at(2).x.value);
  });
});
