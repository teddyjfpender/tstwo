import { describe, it, expect } from "bun:test";
import { bitReverseIndex } from "../src/utils";

describe("bitReverseIndex", () => {
  it("reverses bits correctly", () => {
    expect(bitReverseIndex(0b0011, 4)).toBe(0b1100);
    expect(bitReverseIndex(0b1010, 4)).toBe(0b0101);
    expect(bitReverseIndex(0b0110, 3)).toBe(0b011);
  });
});
