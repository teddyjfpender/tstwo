import { describe, it, expect } from "vitest";
import * as circle from "../../src/poly/circle";

describe("circle index exports", () => {
  it("re-exports circle modules", () => {
    expect(circle).toHaveProperty("CanonicCoset");
    expect(circle).toHaveProperty("CircleDomain");
    expect(circle).toHaveProperty("CircleEvaluation");
    expect(circle).toHaveProperty("CirclePoly");
    expect(circle).toHaveProperty("SecureCirclePoly");
  });
});
