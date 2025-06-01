import { describe, it, expect } from "vitest";
import { writeSpreadsheet } from "../typescript-examples/01_writing_a_spreadsheet";
import { BaseColumn } from "@tstwo/core/src/backend/simd/column";
import { N_LANES } from "@tstwo/core/src/backend/simd/m31";
import { M31 } from "@tstwo/core/src/fields/m31";

describe("Spreadsheet Rust-TypeScript Equivalence", () => {
  describe("Basic Column Operations", () => {
    it("should create columns with same dimensions as Rust", () => {
      const { col1, col2, numRows } = writeSpreadsheet();
      
      // Verify dimensions match Rust N_LANES
      expect(numRows).toBe(N_LANES);
      expect(col1.len()).toBe(N_LANES);
      expect(col2.len()).toBe(N_LANES);
    });

    it("should set values at correct indices like Rust", () => {
      const { col1, col2 } = writeSpreadsheet();
      
      // Verify col1 values match Rust: col_1.set(0, M31::from(1)); col_1.set(1, M31::from(7));
      expect(col1.at(0).equals(M31.from(1))).toBe(true);
      expect(col1.at(1).equals(M31.from(7))).toBe(true);
      
      // Verify col2 values match Rust: col_2.set(0, M31::from(5)); col_2.set(1, M31::from(11));
      expect(col2.at(0).equals(M31.from(5))).toBe(true);
      expect(col2.at(1).equals(M31.from(11))).toBe(true);
    });

    it("should have remaining positions filled with zeros", () => {
      const { col1, col2 } = writeSpreadsheet();
      
      // Verify remaining positions are zero (matching Rust BaseColumn::zeros behavior)
      for (let i = 2; i < N_LANES; i++) {
        expect(col1.at(i).equals(M31.zero())).toBe(true);
        expect(col2.at(i).equals(M31.zero())).toBe(true);
      }
    });
  });

  describe("API Equivalence Tests", () => {
    it("should match Rust BaseColumn::zeros() static method behavior", () => {
      // Create equivalent of Rust: BaseColumn::zeros(N_LANES)
      const zerosArray = Array.from({ length: N_LANES }, () => M31.zero());
      const zerosColumn = BaseColumn.fromCpu(zerosArray);
      
      expect(zerosColumn.len()).toBe(N_LANES);
      for (let i = 0; i < N_LANES; i++) {
        expect(zerosColumn.at(i).equals(M31.zero())).toBe(true);
      }
    });

    it("should match Rust M31::from() constructor behavior", () => {
      const values = [1, 7, 5, 11];
      
      for (const val of values) {
        const m31Value = M31.from(val);
        // Verify basic properties
        expect(m31Value.value).toBe(val);
        expect(m31Value.equals(M31.from(val))).toBe(true);
      }
    });

    it("should match Rust column.set() behavior", () => {
      const zerosArray = Array.from({ length: N_LANES }, () => M31.zero());
      const column = BaseColumn.fromCpu(zerosArray);
      
      // Test setting values at different indices
      const testValues = [
        { index: 0, value: 42 },
        { index: 1, value: 123 },
        { index: N_LANES - 1, value: 999 }
      ];
      
      for (const { index, value } of testValues) {
        column.set(index, M31.from(value));
        expect(column.at(index).equals(M31.from(value))).toBe(true);
      }
    });
  });

  describe("Data Structure Integrity", () => {
    it("should maintain column independence", () => {
      const { col1, col2 } = writeSpreadsheet();
      
      // Modify col1 and verify col2 is unaffected
      col1.set(0, M31.from(999));
      expect(col1.at(0).equals(M31.from(999))).toBe(true);
      expect(col2.at(0).equals(M31.from(5))).toBe(true); // Should remain unchanged
    });

    it("should handle column conversion to CPU array", () => {
      const { col1, col2 } = writeSpreadsheet();
      
      const cpu1 = col1.toCpu();
      const cpu2 = col2.toCpu();
      
      expect(cpu1.length).toBe(N_LANES);
      expect(cpu2.length).toBe(N_LANES);
      
      // Verify values are preserved during conversion
      expect(cpu1[0]!.equals(M31.from(1))).toBe(true);
      expect(cpu1[1]!.equals(M31.from(7))).toBe(true);
      expect(cpu2[0]!.equals(M31.from(5))).toBe(true);
      expect(cpu2[1]!.equals(M31.from(11))).toBe(true);
    });
  });

  describe("Performance and Memory Layout", () => {
    it("should use SIMD-optimized storage", () => {
      const { col1 } = writeSpreadsheet();
      
      // Verify internal SIMD structure exists
      expect(col1.data).toBeDefined();
      expect(Array.isArray(col1.data)).toBe(true);
      
      // Verify packed structure efficiency (chunks of N_LANES elements)
      const expectedChunks = Math.ceil(N_LANES / N_LANES); // Should be 1 for N_LANES elements
      expect(col1.data.length).toBe(expectedChunks);
    });

    it("should match Rust memory layout for N_LANES", () => {
      // Verify N_LANES constant matches expected SIMD width
      expect(N_LANES).toBe(16); // Should match Rust const N_LANES: usize = 16
      expect(typeof N_LANES).toBe("number");
    });
  });

  describe("Error Handling", () => {
    it("should handle out-of-bounds access like Rust", () => {
      const { col1 } = writeSpreadsheet();
      
      // Test accessing beyond column bounds
      expect(() => col1.at(-1)).toThrow();
      expect(() => col1.at(N_LANES)).toThrow();
      expect(() => col1.set(-1, M31.zero())).toThrow();
      expect(() => col1.set(N_LANES, M31.zero())).toThrow();
    });
  });

  describe("Field Element Properties", () => {
    it("should maintain M31 field properties", () => {
      const { col1 } = writeSpreadsheet();
      
      // Test field operations on stored values
      const val1 = col1.at(0); // M31::from(1)
      const val7 = col1.at(1); // M31::from(7)
      
      // Basic field properties
      expect(val1.add(val7).equals(M31.from(8))).toBe(true);
      expect(val7.sub(val1).equals(M31.from(6))).toBe(true);
      expect(val1.mul(val7).equals(M31.from(7))).toBe(true);
    });
  });
}); 