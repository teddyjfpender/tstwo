import { describe, it, expect } from "vitest";
import { butterfly, ibutterfly } from "../src/fft";
import { M31, P } from "../src/fields/m31";

function rng(seed: number) {
  let state = seed;
  return () => {
    let x = state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state = x;
    return Math.abs(x);
  };
}

describe("fft butterfly", () => {
  it("butterfly and ibutterfly round trip up to scaling", () => {
    const r = rng(1);
    for (let i = 0; i < 100; i++) {
      const v0 = M31.fromUnchecked(r() % P);
      const v1 = M31.fromUnchecked(r() % P);
      const tw = M31.fromUnchecked(r() % P);
      const inv = tw.inverse();

      let a = v0.clone();
      let b = v1.clone();
      ;[a, b] = butterfly(a, b, tw);
      ;[a, b] = ibutterfly(a, b, inv);
      expect(a.value).toBe(v0.double().value);
      expect(b.value).toBe(v1.double().value);
    }
  });
});
