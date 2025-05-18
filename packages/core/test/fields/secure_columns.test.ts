import { describe, it, expect } from "vitest";
import { SecureColumnByCoords } from "../../src/fields/secure_columns";
import { QM31 } from "../../src/fields/qm31";
import { M31 } from "../../src/fields/m31";

describe("SecureColumnByCoords", () => {
  it("basic operations", () => {
    const col = SecureColumnByCoords.zeros(2);
    const val = QM31.fromM31Array([
      M31.from(1),
      M31.from(2),
      M31.from(3),
      M31.from(4),
    ]);
    col.set(0, val);
    expect(col.len()).toBe(2);
    expect(col.at(0).equals(val)).toBe(true);
    expect([...col.to_vec()].length).toBe(2);
    const cpu = col.to_cpu();
    expect(cpu.at(0).equals(val)).toBe(true);
  });

  it("iteration yields values", () => {
    const vals = [
      QM31.fromM31Array([M31.from(1),M31.from(1),M31.from(1),M31.from(1)]),
      QM31.fromM31Array([M31.from(2),M31.from(2),M31.from(2),M31.from(2)])
    ];
    const col = SecureColumnByCoords.from(vals);
    const out = Array.from(col);
    expect(out.length).toBe(2);
    expect(out[0].equals(vals[0])).toBe(true);
    expect(out[1].equals(vals[1])).toBe(true);
  });
});
