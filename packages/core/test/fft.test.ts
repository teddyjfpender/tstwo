import { describe, it, expect } from "vitest";
import { butterfly, ibutterfly, fft, ifft } from "../src/fft";
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

describe("fft transform", () => {
  function genTwiddles(r: () => number, n: number): M31[] {
    const tw: M31[] = [];
    for (let m = 2; m <= n; m <<= 1) {
      for (let i = 0; i < m / 2; i++) {
        tw.push(M31.fromUnchecked(r() % P));
      }
    }
    return tw;
  }

  it("forward followed by inverse scales by length", () => {
    const n = 8;
    const r = rng(123);
    const values: M31[] = [];
    for (let i = 0; i < n; i++) {
      values.push(M31.fromUnchecked(r() % P));
    }
    const tw = genTwiddles(r, n);
    const itw = tw.map((t) => t.inverse());

    const orig = values.map((v) => v.clone());
    fft(values, tw);
    ifft(values, itw);

    const scale = M31.from(n);
    for (let i = 0; i < n; i++) {
      expect(values[i].value).toBe(orig[i].mul(scale).value);
    }
  });

  it("throws when length is not power of two", () => {
    const vals = [M31.one(), M31.one(), M31.one()];
    const tw = [M31.one(), M31.one()];
    expect(() => fft([...vals], tw)).toThrow();
    expect(() => ifft([...vals], tw)).toThrow();
  });

  it("throws when twiddles are insufficient", () => {
    const vals = [M31.one(), M31.one(), M31.one(), M31.one()];
    const tw = [M31.one()];
    expect(() => fft([...vals], tw)).toThrow();
    expect(() => ifft([...vals], tw)).toThrow();
  });
});
