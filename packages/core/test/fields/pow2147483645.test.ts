import { describe, it, expect } from "vitest";
import { M31, P, pow2147483645 } from "../../src/fields/m31";

class SimpleRng {
  private state: number;
  constructor(seed: number) { this.state = seed; }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x;
    return Math.abs(x);
  }
  nextRange(max: number): number { return this.next() % max; }
}

describe("pow2147483645", () => {
  it("matches generic pow for random elements", () => {
    const rng = new SimpleRng(42);
    for (let i = 0; i < 1000; i++) {
      const x = rng.nextRange(P - 1) + 1; // nonzero
      const v = M31.fromUnchecked(x);
      const expected = v.pow(P - 2);
      const actual = pow2147483645(v);
      expect(actual.value).toBe(expected.value);
    }
  });
});
