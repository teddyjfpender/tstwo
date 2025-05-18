import { describe, it, expect } from "vitest";
import { LineDomain } from "../../src/poly/line";

class FakePoint { constructor(public x: number) {} }
class FakeCoset {
  constructor(public logSizeVal: number) {}
  size() { return 1 << this.logSizeVal; }
  get log_size() { return this.logSizeVal; }
  at(i: number) { return new FakePoint(i); }
  iter(): FakePoint[] { return Array.from({ length: this.size() }, (_, i) => new FakePoint(i)); }
  double() { return new FakeCoset(this.logSizeVal - 1); }
}

describe("LineDomain", () => {
  it("size and logSize reflect coset", () => {
    const coset = new FakeCoset(3);
    const domain = LineDomain.new(coset);
    expect(domain.size()).toBe(8);
    expect(domain.logSize()).toBe(3);
  });

  it("iter yields x coordinates", () => {
    const coset = new FakeCoset(2);
    const domain = LineDomain.new(coset);
    expect(Array.from(domain.iter())).toEqual([0,1,2,3]);
  });

  it("at returns x and cosetValue exposes coset", () => {
    const coset = new FakeCoset(2);
    const domain = LineDomain.new(coset);
    expect(domain.at(1)).toBe(1);
    expect(domain.cosetValue()).toBe(coset);
  });
  it("double halves the domain size", () => {
    const coset = new FakeCoset(4);
    const domain = LineDomain.new(coset);
    const doubled = domain.double();
    expect(doubled.size()).toBe(8);
  });
});
