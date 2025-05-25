import { describe, it, expect } from "vitest";
import { accumulate, generate_secure_powers } from "../../../src/backend/cpu/accumulation";
import { QM31 as SecureField } from "../../../src/fields/qm31";
import { M31 } from "../../../src/fields/m31";
import { SecureColumnByCoords } from "../../../src/fields/secure_columns";

describe("accumulate", () => {
  it("should accumulate two columns correctly", () => {
    // Create test columns
    const column1 = SecureColumnByCoords.zeros(3);
    const column2 = SecureColumnByCoords.zeros(3);
    
    // Set some values
    column1.set(0, SecureField.from(M31.from(1)));
    column1.set(1, SecureField.from(M31.from(2)));
    column1.set(2, SecureField.from(M31.from(3)));
    
    column2.set(0, SecureField.from(M31.from(4)));
    column2.set(1, SecureField.from(M31.from(5)));
    column2.set(2, SecureField.from(M31.from(6)));
    
    // Accumulate
    accumulate(column1, column2);
    
    // Check results
    expect(column1.at(0).equals(SecureField.from(M31.from(5)))).toBe(true);
    expect(column1.at(1).equals(SecureField.from(M31.from(7)))).toBe(true);
    expect(column1.at(2).equals(SecureField.from(M31.from(9)))).toBe(true);
  });

  it("should handle zero columns", () => {
    const column1 = SecureColumnByCoords.zeros(2);
    const column2 = SecureColumnByCoords.zeros(2);
    
    accumulate(column1, column2);
    
    expect(column1.at(0).equals(SecureField.zero())).toBe(true);
    expect(column1.at(1).equals(SecureField.zero())).toBe(true);
  });

  it("should handle single element columns", () => {
    const column1 = SecureColumnByCoords.zeros(1);
    const column2 = SecureColumnByCoords.zeros(1);
    
    column1.set(0, SecureField.from(M31.from(42)));
    column2.set(0, SecureField.from(M31.from(58)));
    
    accumulate(column1, column2);
    
    expect(column1.at(0).equals(SecureField.from(M31.from(100)))).toBe(true);
  });

  it("should throw error for mismatched column lengths", () => {
    const column1 = SecureColumnByCoords.zeros(2);
    const column2 = SecureColumnByCoords.zeros(3);
    
    expect(() => accumulate(column1, column2)).toThrow("column length mismatch");
  });

  it("should handle empty columns", () => {
    const column1 = SecureColumnByCoords.zeros(0);
    const column2 = SecureColumnByCoords.zeros(0);
    
    expect(() => accumulate(column1, column2)).not.toThrow();
  });
});

describe("generate_secure_powers", () => {
  it("should generate powers correctly", () => {
    // Create a test field element: qm31!(1, 2, 3, 4)
    const felt = SecureField.from_m31(M31.from(1), M31.from(2), M31.from(3), M31.from(4));
    const n_powers = 10;

    const powers = generate_secure_powers(felt, n_powers);

    expect(powers.length).toBe(n_powers);
    expect(powers[0]!.equals(SecureField.one())).toBe(true);
    expect(powers[1]!.equals(felt)).toBe(true);
    
    // Check that powers[7] equals felt^7
    let expected = SecureField.one();
    for (let i = 0; i < 7; i++) {
      expected = expected.mul(felt);
    }
    expect(powers[7]!.equals(expected)).toBe(true);
  });

  it("should generate empty powers for n_powers = 0", () => {
    const felt = SecureField.from_m31(M31.from(1), M31.from(2), M31.from(3), M31.from(4));
    const n_powers = 0;

    const powers = generate_secure_powers(felt, n_powers);

    expect(powers).toEqual([]);
  });

  it("should generate single power for n_powers = 1", () => {
    const felt = SecureField.from_m31(M31.from(5), M31.from(6), M31.from(7), M31.from(8));
    const n_powers = 1;

    const powers = generate_secure_powers(felt, n_powers);

    expect(powers.length).toBe(1);
    expect(powers[0]!.equals(SecureField.one())).toBe(true);
  });

  it("should generate two powers for n_powers = 2", () => {
    const felt = SecureField.from_m31(M31.from(2), M31.from(3), M31.from(4), M31.from(5));
    const n_powers = 2;

    const powers = generate_secure_powers(felt, n_powers);

    expect(powers.length).toBe(2);
    expect(powers[0]!.equals(SecureField.one())).toBe(true);
    expect(powers[1]!.equals(felt)).toBe(true);
  });

  it("should handle zero felt", () => {
    const felt = SecureField.zero();
    const n_powers = 5;

    const powers = generate_secure_powers(felt, n_powers);

    expect(powers.length).toBe(5);
    expect(powers[0]!.equals(SecureField.one())).toBe(true);
    for (let i = 1; i < 5; i++) {
      expect(powers[i]!.equals(SecureField.zero())).toBe(true);
    }
  });

  it("should handle one felt", () => {
    const felt = SecureField.one();
    const n_powers = 5;

    const powers = generate_secure_powers(felt, n_powers);

    expect(powers.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(powers[i]!.equals(SecureField.one())).toBe(true);
    }
  });

  it("should generate correct sequence for small powers", () => {
    const felt = SecureField.from(M31.from(2));
    const n_powers = 4;

    const powers = generate_secure_powers(felt, n_powers);

    expect(powers.length).toBe(4);
    expect(powers[0]!.equals(SecureField.one())).toBe(true);
    expect(powers[1]!.equals(SecureField.from(M31.from(2)))).toBe(true);
    expect(powers[2]!.equals(SecureField.from(M31.from(4)))).toBe(true);
    expect(powers[3]!.equals(SecureField.from(M31.from(8)))).toBe(true);
  });
}); 