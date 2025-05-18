import { describe, it, expect } from "vitest";
import { repeatValue, fold } from "../../src/poly/utils";
import { M31 } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";

describe("repeatValue", () => {
  it("repeat 0 times works", () => {
    expect(repeatValue([1, 2, 3], 0)).toEqual([]);
  });

  it("repeat 2 times works", () => {
    expect(repeatValue([1, 2, 3], 2)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("repeat 3 times works", () => {
    expect(repeatValue([1, 2], 3)).toEqual([1, 1, 1, 2, 2, 2]);
  });
});

describe("fold", () => {
  it("folds values recursively", () => {
    const vals = [
      CM31.fromM31(M31.from(1), M31.zero()),
      CM31.fromM31(M31.from(2), M31.zero()),
      CM31.fromM31(M31.from(3), M31.zero()),
      CM31.fromM31(M31.from(4), M31.zero()),
    ];
    const z = CM31.fromM31(M31.from(5), M31.zero());
    const y = CM31.fromM31(M31.from(6), M31.zero());
    const res = fold(vals, [y, z]);
    const expected =
      vals[0]
        .add(vals[1].mul(z))
        .add(vals[2].add(vals[3].mul(z)).mul(y));
    expect(res.real.value).toBe(expected.real.value);
    expect(res.imag.value).toBe(expected.imag.value);
  });
});
