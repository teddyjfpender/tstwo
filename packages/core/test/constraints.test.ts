import { describe, it, expect } from "vitest";
import { cosetVanishing, pointExcluder, pairVanishing, pointVanishing } from "../src/constraints";
import { Coset, CirclePointIndex } from "../src/circle";
import { M31 } from "../src/fields/m31";

const F = M31;

function isZero(f: M31) {
  return f.isZero();
}

describe("cosetVanishing", () => {
  it("vanishes on coset elements and not on others", () => {
    const cosets = [
      Coset.half_odds(5),
      Coset.odds(5),
      Coset.new(CirclePointIndex.zero(), 5),
      Coset.half_odds(5).conjugate(),
    ];
    for (const c0 of cosets) {
      for (const el of c0.iter()) {
        expect(isZero(cosetVanishing(c0, el, F))).toBe(true);
        for (const c1 of cosets) {
          if (c1 === c0) continue;
          expect(isZero(cosetVanishing(c1, el, F))).toBe(false);
        }
      }
    }
  });
});

describe("pointExcluder", () => {
  it("matches expected relation", () => {
    const excluded = Coset.half_odds(5).at(10);
    const point = CirclePointIndex.generator().mul(4).to_point();
    const num = pointExcluder(excluded, point, F).mul(
      pointExcluder(excluded.conjugate(), point, F)
    );
    const denom = point.x.sub(excluded.x).pow(2);
    expect(num.equals(denom)).toBe(true);
  });
});

describe("pairVanishing", () => {
  it("vanishes at excluded points", () => {
    const e0 = Coset.half_odds(5).at(10);
    const e1 = Coset.half_odds(5).at(13);
    const point = CirclePointIndex.generator().mul(4).to_point();
    expect(pairVanishing(e0, e1, point).isZero()).toBe(false);
    expect(pairVanishing(e0, e1, e0).isZero()).toBe(true);
    expect(pairVanishing(e0, e1, e1).isZero()).toBe(true);
  });
});

describe("pointVanishing", () => {
  it("vanishes on given point except antipode", () => {
    const coset = Coset.odds(5);
    const vanish = coset.at(2);
    for (const el of coset.iter()) {
      if (el.x.equals(vanish.x) && el.y.equals(vanish.y)) {
        expect(pointVanishing(vanish, el, x => x, F).isZero()).toBe(true);
        continue;
      }
      if (el.x.equals(vanish.antipode().x) && el.y.equals(vanish.antipode().y)) {
        continue;
      }
      expect(pointVanishing(vanish, el, x => x, F).isZero()).toBe(false);
    }
  });

  it("fails on antipode", () => {
    const coset = Coset.half_odds(6);
    const point = coset.at(4);
    expect(() => pointVanishing(point, point.antipode(), x => x, F)).toThrow();
  });
});
