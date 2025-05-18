import { describe, it, expect } from "bun:test";
import { repeatValue } from "../../src/poly/utils";

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
