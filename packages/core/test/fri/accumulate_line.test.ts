import { describe, it, expect } from "vitest";
import { QM31 as SecureField } from "../../src/fields/qm31";
import { M31 } from "../../src/fields/m31";
import { accumulate_line } from "../../src/fri";

function sf(n: number): SecureField {
  return SecureField.from(M31.from(n));
}

describe("accumulate_line", () => {
  it("accumulates in place like Rust implementation", () => {
    const layer = [sf(1), sf(2), sf(3)];
    const column = [sf(4), sf(5), sf(6)];
    const alpha = sf(2); // alpha^2 = 4

    accumulate_line(layer, column, alpha);

    const alphaSquared = alpha.square();
    const expected = [sf(1).mul(alphaSquared).add(sf(4)), sf(2).mul(alphaSquared).add(sf(5)), sf(3).mul(alphaSquared).add(sf(6))];
    for (let i = 0; i < layer.length; i++) {
      expect(layer[i].equals(expected[i])).toBe(true);
    }
  });
});
