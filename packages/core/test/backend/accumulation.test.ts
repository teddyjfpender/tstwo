import { describe, it, expect } from "vitest";
import { generate_secure_powers, accumulate } from "../../src/backend/cpu/accumulation";
import { QM31 } from "../../src/fields/qm31";
import { SecureColumnByCoords } from "../../src/fields/secure_columns";

function qm31(a:number,b:number,c:number,d:number): QM31 {
  return QM31.fromUnchecked(a,b,c,d);
}

describe("CpuBackend accumulation", () => {
  it("generate_secure_powers works", () => {
    const felt = qm31(1,2,3,4);
    const powers = generate_secure_powers(felt, 10);
    expect(powers.length).toBe(10);
    expect(powers[0].equals(QM31.one())).toBe(true);
    expect(powers[1].equals(felt)).toBe(true);
    expect(powers[7].equals(felt.pow(7))).toBe(true);
  });

  it("generate_secure_powers empty", () => {
    const felt = qm31(1,2,3,4);
    expect(generate_secure_powers(felt, 0)).toEqual([]);
  });

  it("accumulate adds columns elementwise", () => {
    const a = SecureColumnByCoords.from([qm31(1,1,1,1), qm31(2,2,2,2)]);
    const b = SecureColumnByCoords.from([qm31(3,3,3,3), qm31(4,4,4,4)]);
    const expected0 = a.at(0).add(b.at(0));
    const expected1 = a.at(1).add(b.at(1));
    accumulate(a, b);
    expect(a.at(0).equals(expected0)).toBe(true);
    expect(a.at(1).equals(expected1)).toBe(true);
  });
});
