import { describe, it, expect, beforeAll } from "vitest";
import { CanonicCoset } from "../../src/poly/circle/canonic";

describe("CanonicCoset", () => {
  beforeAll(() => {
    (CanonicCoset as any)._odds = (log: number) => ({
      log_size: log,
      size: () => 1 << log,
      initial_index: 1,
      step_size: 2,
      step: "s",
      index_at: (i: number) => ({ idx: i, to_point: () => i }),
      at: (i: number) => i,
    });
    (CanonicCoset as any)._half_odds = (log: number) => ({ log_size: log });
    (CanonicCoset as any)._circle_domain = (c: any) => ({ from: c });
  });

  it("new validates logSize", () => {
    expect(() => CanonicCoset.new(0)).toThrow();
  });

  it("exposes coset utilities", () => {
    const c = CanonicCoset.new(3);
    expect(c.logSize()).toBe(3);
    expect(c.size()).toBe(8);
    expect(c.cosetFull().step_size).toBe(2);
    expect((c.halfCoset() as any).log_size).toBe(2);
    expect((c.circleDomain() as any).from.log_size).toBe(2);
    expect(c.initialIndex()).toBe(1);
    expect(c.stepSize()).toBe(2);
    expect(c.indexAt(1)).toEqual({ idx: 1, to_point: expect.any(Function) });
    expect(c.at(2)).toBe(2);
  });
});
