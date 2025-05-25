import { describe, it, expect } from "vitest";
import {
  SimdBackend,
  simdBackend,
  PACKED_M31_BATCH_INVERSE_CHUNK_SIZE,
  PACKED_CM31_BATCH_INVERSE_CHUNK_SIZE,
  PACKED_QM31_BATCH_INVERSE_CHUNK_SIZE,
} from "../../src/backend/simd";
import { M31 } from "../../src/fields/m31";
import { QM31 } from "../../src/fields/qm31";

describe("SimdBackend", () => {
  describe("SimdBackend class", () => {
    it("should create backend instance with correct name", () => {
      const backend = new SimdBackend();
      expect(backend.name).toBe("SimdBackend");
    });

    it("should provide default instance", () => {
      expect(simdBackend).toBeInstanceOf(SimdBackend);
      expect(simdBackend.name).toBe("SimdBackend");
    });

    it("should create BaseField columns", () => {
      const data = [M31.from(1), M31.from(2), M31.from(3)];
      const column = simdBackend.createBaseFieldColumn(data);
      expect(column.len()).toBe(3);
      expect(column.at(0)).toEqual(M31.from(1));
    });

    it("should create SecureField columns", () => {
      const data = [QM31.from(M31.from(1)), QM31.from(M31.from(2))];
      const column = simdBackend.createSecureFieldColumn(data);
      expect(column.len()).toBe(2);
      expect(column.at(0)).toEqual(QM31.from(M31.from(1)));
    });

    it("should bit reverse columns", () => {
      const data = [M31.from(0), M31.from(1), M31.from(2), M31.from(3)];
      const column = simdBackend.createBaseFieldColumn(data);
      simdBackend.bitReverseColumn(column);
      
      expect(column.at(0)).toEqual(M31.from(0));
      expect(column.at(1)).toEqual(M31.from(2));
      expect(column.at(2)).toEqual(M31.from(1));
      expect(column.at(3)).toEqual(M31.from(3));
    });

    it("should handle bit reverse with power-of-two arrays", () => {
      const data = [M31.from(0), M31.from(1), M31.from(2), M31.from(3), 
                    M31.from(4), M31.from(5), M31.from(6), M31.from(7)];
      const column = simdBackend.createBaseFieldColumn(data);
      simdBackend.bitReverseColumn(column);
      
      const expected = [M31.from(0), M31.from(4), M31.from(2), M31.from(6),
                        M31.from(1), M31.from(5), M31.from(3), M31.from(7)];
      
      for (let i = 0; i < expected.length; i++) {
        expect(column.at(i)).toEqual(expected[i]);
      }
    });

    it("should throw error for non-power-of-two columns in bit reverse", () => {
      const data = [M31.from(0), M31.from(1), M31.from(2)]; // length 3 is not power of 2
      const column = simdBackend.createBaseFieldColumn(data);
      expect(() => simdBackend.bitReverseColumn(column)).toThrow("length is not power of two");
    });

    it("should handle empty columns in bit reverse", () => {
      const data: M31[] = [];
      const column = simdBackend.createBaseFieldColumn(data);
      expect(() => simdBackend.bitReverseColumn(column)).toThrow("length is not power of two");
    });
  });

  describe("SIMD constants", () => {
    it("should export correct chunk sizes", () => {
      expect(PACKED_M31_BATCH_INVERSE_CHUNK_SIZE).toBe(1 << 9);
      expect(PACKED_CM31_BATCH_INVERSE_CHUNK_SIZE).toBe(1 << 10);
      expect(PACKED_QM31_BATCH_INVERSE_CHUNK_SIZE).toBe(1 << 11);
    });

    it("should have chunk sizes as powers of 2", () => {
      expect(PACKED_M31_BATCH_INVERSE_CHUNK_SIZE & (PACKED_M31_BATCH_INVERSE_CHUNK_SIZE - 1)).toBe(0);
      expect(PACKED_CM31_BATCH_INVERSE_CHUNK_SIZE & (PACKED_CM31_BATCH_INVERSE_CHUNK_SIZE - 1)).toBe(0);
      expect(PACKED_QM31_BATCH_INVERSE_CHUNK_SIZE & (PACKED_QM31_BATCH_INVERSE_CHUNK_SIZE - 1)).toBe(0);
    });
  });

  describe("SIMD backend compatibility", () => {
    it("should produce same results as CPU backend for bit reverse", () => {
      const data = [M31.from(0), M31.from(1), M31.from(2), M31.from(3)];
      const simdColumn = simdBackend.createBaseFieldColumn([...data]);
      
      simdBackend.bitReverseColumn(simdColumn);
      
      // Expected result from CPU backend
      const expected = [M31.from(0), M31.from(2), M31.from(1), M31.from(3)];
      
      for (let i = 0; i < expected.length; i++) {
        expect(simdColumn.at(i)).toEqual(expected[i]);
      }
    });

    it("should handle large arrays efficiently", () => {
      const size = 1024; // Large power of 2
      const data = Array.from({ length: size }, (_, i) => M31.from(i));
      const column = simdBackend.createBaseFieldColumn(data);
      
      // Should not throw and should complete in reasonable time
      expect(() => simdBackend.bitReverseColumn(column)).not.toThrow();
      
      // Verify it's actually different (unless size is 1)
      const firstElement = column.at(0);
      const secondElement = column.at(1);
      expect(firstElement).toEqual(M31.from(0)); // First element should remain 0
      expect(secondElement).toEqual(M31.from(512)); // Second element should be bit-reversed
    });
  });

  describe("column operations", () => {
    it("should work with different field types", () => {
      // Test with M31
      const m31Data = [M31.from(10), M31.from(20)];
      const m31Column = simdBackend.createBaseFieldColumn(m31Data);
      expect(m31Column.len()).toBe(2);
      expect(m31Column.at(0)).toEqual(M31.from(10));
      
      // Test with QM31
      const qm31Data = [QM31.from(M31.from(30)), QM31.from(M31.from(40))];
      const qm31Column = simdBackend.createSecureFieldColumn(qm31Data);
      expect(qm31Column.len()).toBe(2);
      expect(qm31Column.at(0)).toEqual(QM31.from(M31.from(30)));
    });

    it("should maintain column integrity after operations", () => {
      const data = [M31.from(1), M31.from(2), M31.from(3), M31.from(4)];
      const column = simdBackend.createBaseFieldColumn(data);
      
      // Store original values
      const original = column.toCpu();
      
      // Perform bit reverse twice (should return to original)
      simdBackend.bitReverseColumn(column);
      simdBackend.bitReverseColumn(column);
      
      // Should be back to original
      for (let i = 0; i < original.length; i++) {
        expect(column.at(i)).toEqual(original[i]);
      }
    });
  });
}); 