import { describe, it, expect } from "vitest";
import { bitReverse } from "../../src/backend/cpu";

describe("bitReverse", () => {
  it("reorders array in bit reversed order", () => {
    const data = [0,1,2,3,4,5,6,7];
    bitReverse(data);
    expect(data).toEqual([0,4,2,6,1,5,3,7]);
  });

  it("throws on non power of two", () => {
    expect(() => bitReverse([0,1,2])).toThrow();
  });
});
