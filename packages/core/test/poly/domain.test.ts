import { describe, it, expect } from "vitest";
import { CircleDomain } from "../../src/poly/circle/domain";

// Simple fake coset implementation for testing purposes
class FakeIndex {
  constructor(public value: number) {}
  to_point(): number {
    return this.value;
  }
  conjugate(): number {
    return -this.value;
  }
  valueOf(): number {
    return this.value;
  }
}

class FakeCoset {
  initial_index: number;
  log_size: number;
  step_size: number;
  constructor(initialIndex: number, logSize: number, stepSize: number) {
    this.initial_index = initialIndex;
    this.log_size = logSize;
    this.step_size = stepSize;
  }

  size(): number {
    return 1 << this.log_size;
  }

  index_at(i: number): FakeIndex {
    return new FakeIndex(this.initial_index + this.step_size * i);
  }

  iter(): number[] {
    return Array.from({ length: this.size() }, (_, i) => this.index_at(i).to_point());
  }

  iter_indices(): FakeIndex[] {
    return Array.from({ length: this.size() }, (_, i) => this.index_at(i));
  }

  conjugate(): FakeCoset {
    return new FakeCoset(-this.initial_index, this.log_size, -this.step_size);
  }

  shift(shift: number): FakeCoset {
    return new FakeCoset(this.initial_index + shift, this.log_size, this.step_size);
  }

  static new(initialIndex: number, logSize: number): FakeCoset {
    return new FakeCoset(initialIndex, logSize, 4); // constant step for tests
  }
}

describe("CircleDomain", () => {
  it("iterates over all points", () => {
    const coset = new FakeCoset(1, 2, 3);
    const domain = CircleDomain.new(coset);
    const expected = [...coset.iter(), ...coset.conjugate().iter()];
    expect(Array.from(domain.iter())).toEqual(expected);
  });

  it("is_canonic invalid domain", () => {
    const coset = new FakeCoset(1, 4, 2);
    const domain = CircleDomain.new(coset);
    expect(domain.isCanonic()).toBe(false);
  });

  it("is_canonic valid domain", () => {
    const coset = FakeCoset.new(1, 3);
    const domain = CircleDomain.new(coset);
    expect(domain.isCanonic()).toBe(true);
  });

  it("split produces subdomain and shifts", () => {
    const coset = FakeCoset.new(0, 3);
    const domain = CircleDomain.new(coset);
    const [subdomain, shifts] = domain.split(1);
    expect(subdomain.logSize()).toBe(domain.logSize() - 1);
    expect(shifts).toEqual([0, coset.step_size]);
  });

  it("shift offsets the domain", () => {
    const coset = FakeCoset.new(5, 2);
    const domain = CircleDomain.new(coset);
    const shifted = domain.shift(3);
    expect(shifted.halfCoset.initial_index).toBe(coset.initial_index + 3);
    expect(shifted.halfCoset.log_size).toBe(coset.log_size);
  });

  it("size and iterator work", () => {
    const coset = FakeCoset.new(1,2);
    const domain = CircleDomain.new(coset);
    expect(domain.size()).toBe(1 << domain.logSize());
    const points: number[] = [];
    for(const p of domain){ points.push(p); }
    expect(points.length).toBe(domain.size());
  });
  it("iterIndices yields indices then their conjugates", () => {
    const coset = FakeCoset.new(0, 2);
    const domain = CircleDomain.new(coset);
    const expected = [
      ...coset.iter_indices(),
      ...coset.conjugate().iter_indices(),
    ];
    expect(Array.from(domain.iterIndices())).toEqual(expected);
  });
  it("at and indexAt work", () => {
    const coset = FakeCoset.new(2, 2);
    const domain = CircleDomain.new(coset);
    expect(domain.indexAt(1).value).toBe(coset.index_at(1).value);
    expect(domain.at(1)).toBe(coset.index_at(1).to_point());
  });


});
