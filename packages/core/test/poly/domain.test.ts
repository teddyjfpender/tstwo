import { describe, it, expect } from "vitest";
import { CircleDomain } from "../../src/poly/circle/domain";
import { Coset, CirclePointIndex } from "../../src/circle";
import { CanonicCoset } from "../../src/poly/circle/canonic";

describe("CircleDomain", () => {
  it("iterates over all points", () => {
    const coset = Coset.new(new CirclePointIndex(1), 2);
    const domain = CircleDomain.new(coset);
    const expected = [...coset.iter(), ...coset.conjugate().iter()].map(p => p.x.value);
    expect(Array.from(domain.iter()).map(p => p.x.value)).toEqual(expected);
  });

  it("is_canonic invalid domain", () => {
    const coset = Coset.new(new CirclePointIndex(1), 4);
    const domain = CircleDomain.new(coset);
    expect(domain.isCanonic()).toBe(false);
  });

  it("is_canonic valid domain", () => {
    const domain = CircleDomain.new(Coset.half_odds(3));
    expect(domain.isCanonic()).toBe(true);
  });

  it("split produces subdomain and shifts", () => {
    const coset = Coset.new(CirclePointIndex.generator(), 3);
    const domain = CircleDomain.new(coset);
    const [subdomain, shifts] = domain.split(1);
    expect(subdomain.logSize()).toBe(domain.logSize() - 1);
    expect(shifts.map(s => s.value)).toEqual([0, coset.step_size.value]);
  });

  it("shift offsets the domain", () => {
    const coset = Coset.new(new CirclePointIndex(5), 2);
    const domain = CircleDomain.new(coset);
    const shifted = domain.shift(new CirclePointIndex(3));
    expect(shifted.halfCoset.initial_index.value).toBe(coset.initial_index.add(new CirclePointIndex(3)).value);
    expect(shifted.halfCoset.log_size).toBe(coset.log_size);
  });

  it("size and iterator work", () => {
    const coset = Coset.new(new CirclePointIndex(1), 2);
    const domain = CircleDomain.new(coset);
    expect(domain.size()).toBe(1 << domain.logSize());
    const points: number[] = [];
    for(const p of domain){ points.push(p.x.value); }
    expect(points.length).toBe(domain.size());
  });
  it("iterIndices yields indices then their conjugates", () => {
    const coset = Coset.new(CirclePointIndex.zero(), 2);
    const domain = CircleDomain.new(coset);
    const expected = [
      ...coset.iter_indices(),
      ...coset.conjugate().iter_indices(),
    ].map(i => i.value);
    expect(Array.from(domain.iterIndices()).map(i => i.value)).toEqual(expected);
  });
  it("at and indexAt work", () => {
    const coset = Coset.new(new CirclePointIndex(2), 2);
    const domain = CircleDomain.new(coset);
    expect(domain.indexAt(1).value).toBe(coset.index_at(1).value);
    expect(domain.at(1).x.value).toBe(coset.index_at(1).to_point().x.value);
  });


});
