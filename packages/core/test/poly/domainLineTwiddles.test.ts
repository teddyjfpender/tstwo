import { describe, it, expect } from "vitest";
import { domainLineTwiddlesFromTree } from "../../src/poly/utils";

class FakeCoset {
  constructor(public logSizeVal: number) {}
  size(): number { return 1 << this.logSizeVal; }
  logSize(): number { return this.logSizeVal; }
}

class FakeDomain {
  constructor(private logSizeVal: number) {}
  coset() { return new FakeCoset(this.logSizeVal); }
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
