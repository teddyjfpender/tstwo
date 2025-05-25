import { describe, it, expect } from "vitest";
import { domainLineTwiddlesFromTree } from "../../src/poly/utils";
import { Coset } from "../../src/circle";
import { LineDomain } from "../../src/poly/line";

describe("domainLineTwiddlesFromTree", () => {
  it("computes slices for each level", () => {
    const coset = Coset.subgroup(3);
    const domain = LineDomain.new(coset);
    const buffer = [0,1,2,3,4,5,6,7];
    const res = domainLineTwiddlesFromTree(domain, buffer);
    expect(res).toEqual([[0,1,2,3],[4,5],[6]]);
  });

  it("throws when buffer too small", () => {
    const coset = Coset.subgroup(3);
    const domain = LineDomain.new(coset);
    const buffer = [1,2];
    expect(() => domainLineTwiddlesFromTree(domain, buffer)).toThrow();
  });
});
