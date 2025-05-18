import { describe, it, expect } from "vitest";
import { domainLineTwiddlesFromTree } from "../../src/poly/utils";
import { Coset } from "../../src/circle";

class FakeDomain {
  constructor(private logSizeVal: number) {}
  coset() {
    const c = Coset.subgroup(this.logSizeVal);
    return { size: () => c.size(), logSize: () => c.log_size };
  }
}

describe("domainLineTwiddlesFromTree", () => {
  it("computes slices for each level", () => {
    const domain = new FakeDomain(3);
    const buffer = [0,1,2,3,4,5,6,7];
    const res = domainLineTwiddlesFromTree(domain as any, buffer);
    expect(res).toEqual([[0,1,2,3],[4,5],[6]]);
  });

  it("throws when buffer too small", () => {
    const domain = new FakeDomain(3);
    const buffer = [1,2];
    expect(() => domainLineTwiddlesFromTree(domain as any, buffer)).toThrow();
  });
});
