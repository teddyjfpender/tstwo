import { describe, it, expect } from "vitest";
import { makePeekable, nextDecommitmentNode, optionFlattenPeekable } from "../../src/vcs/utils";

describe("optionFlattenPeekable", () => {
  it("creates empty iterator when option is undefined", () => {
    const it = optionFlattenPeekable();
    expect(it.peek()).toBeUndefined();
    expect(it.next().done).toBe(true);
  });

  it("iterates through provided values", () => {
    const it = optionFlattenPeekable([1, 2]);
    expect(it.peek()).toBe(1);
    expect(it.next().value).toBe(1);
    expect(it.peek()).toBe(2);
    expect(it.next().value).toBe(2);
    expect(it.peek()).toBeUndefined();
  });
});

describe("nextDecommitmentNode", () => {
  const make = (a: number[], b: number[]) => [makePeekable(a), makePeekable(b)] as const;

  it("returns smallest candidate", () => {
    const [prev, layer] = make([4, 6], [5, 8]);
    expect(nextDecommitmentNode(prev, layer)).toBe(2); // from prev 4 -> 2
  });

  it("handles empty prev queries", () => {
    const [prev, layer] = make([], [3, 4]);
    expect(nextDecommitmentNode(prev, layer)).toBe(3);
  });

  it("returns undefined when both empty", () => {
    const [prev, layer] = make([], []);
    expect(nextDecommitmentNode(prev, layer)).toBeUndefined();
  });
});
