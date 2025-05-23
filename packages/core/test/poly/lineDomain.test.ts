import { describe, it, expect } from "vitest";
import { LineDomain } from "../../src/poly/line";
import { Coset, CirclePointIndex } from "../../src/circle";

describe("LineDomain", () => {
  it("size and logSize reflect coset", () => {
    const coset = Coset.subgroup(3);
    const domain = LineDomain.new(coset);
    expect(domain.size()).toBe(8);
    expect(domain.logSize()).toBe(3);
  });

  it("iter yields x coordinates", () => {
    const coset = Coset.subgroup(2);
    const domain = LineDomain.new(coset);
    const expected = Array.from(coset.iter()).map(p => p.x.value);
    expect(Array.from(domain.iter()).map(v => v.value)).toEqual(expected);
  });

  it("at returns x and coset exposes coset", () => {
    const coset = Coset.subgroup(2);
    const domain = LineDomain.new(coset);
    expect(domain.at(1).value).toBe(coset.at(1).x.value);
    expect(domain.coset()).toBe(coset);
  });
  it("double halves the domain size", () => {
    const coset = Coset.subgroup(4);
    const domain = LineDomain.new(coset);
    const doubled = domain.double();
    expect(doubled.size()).toBe(8);
  });
});
