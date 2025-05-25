import { describe, it, expect } from "vitest";
import {
  SimdBackend,
  simdBackend,
  PACKED_M31_BATCH_INVERSE_CHUNK_SIZE,
  PACKED_CM31_BATCH_INVERSE_CHUNK_SIZE,
  PACKED_QM31_BATCH_INVERSE_CHUNK_SIZE,
} from "../../src/backend/simd";
import { PackedM31, N_LANES, LOG_N_LANES } from "../../src/backend/simd/m31";
import { PackedCM31 } from "../../src/backend/simd/cm31";
import { PackedQM31 } from "../../src/backend/simd/qm31";
import { M31 } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";
import { QM31 } from "../../src/fields/qm31";
import { bitReverseIndex } from "../../src/utils";

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

    it("should have correct N_LANES and LOG_N_LANES", () => {
      expect(N_LANES).toBe(16);
      expect(LOG_N_LANES).toBe(4);
      expect(1 << LOG_N_LANES).toBe(N_LANES);
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

  describe("PackedM31 operations", () => {
    it("should perform addition correctly", () => {
      const values1 = Array.from({ length: N_LANES }, (_, i) => M31.from(i));
      const values2 = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 10));
      const packed1 = PackedM31.fromArray(values1);
      const packed2 = PackedM31.fromArray(values2);

      const result = packed1.add(packed2);
      const expected = values1.map((v, i) => v.add(values2[i]!));

      expect(result.toArray()).toEqual(expected);
    });

    it("should perform subtraction correctly", () => {
      const values1 = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 20));
      const values2 = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 5));
      const packed1 = PackedM31.fromArray(values1);
      const packed2 = PackedM31.fromArray(values2);

      const result = packed1.sub(packed2);
      const expected = values1.map((v, i) => v.sub(values2[i]!));

      expect(result.toArray()).toEqual(expected);
    });

    it("should perform multiplication correctly", () => {
      const values1 = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 1));
      const values2 = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 2));
      const packed1 = PackedM31.fromArray(values1);
      const packed2 = PackedM31.fromArray(values2);

      const result = packed1.mul(packed2);
      const expected = values1.map((v, i) => v.mul(values2[i]!));

      expect(result.toArray()).toEqual(expected);
    });

    it("should perform negation correctly", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 1));
      const packed = PackedM31.fromArray(values);

      const result = packed.neg();
      const expected = values.map(v => v.neg());

      expect(result.toArray()).toEqual(expected);
    });

    it("should perform scalar operations correctly", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 1));
      const packed = PackedM31.fromArray(values);
      const scalar = M31.from(5);

      const addResult = packed.addScalar(scalar);
      const mulResult = packed.mulScalar(scalar);

      expect(addResult.toArray()).toEqual(values.map(v => v.add(scalar)));
      expect(mulResult.toArray()).toEqual(values.map(v => v.mul(scalar)));
    });

    it("should perform inverse correctly", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 1));
      const packed = PackedM31.fromArray(values);

      const result = packed.inverse();
      const expected = values.map(v => v.inverse());

      expect(result.toArray()).toEqual(expected);
    });

    it("should handle interleave and deinterleave operations", () => {
      const values1 = Array.from({ length: N_LANES }, (_, i) => M31.from(i));
      const values2 = Array.from({ length: N_LANES }, (_, i) => M31.from(i + N_LANES));
      const packed1 = PackedM31.fromArray(values1);
      const packed2 = PackedM31.fromArray(values2);

      const [interleaved1, interleaved2] = packed1.interleave(packed2);
      const [deinterleaved1, deinterleaved2] = interleaved1.deinterleave(interleaved2);

      // Deinterleaving should restore original values
      expect(deinterleaved1.toArray()).toEqual(values1);
      expect(deinterleaved2.toArray()).toEqual(values2);
    });

    it("should handle broadcast operation", () => {
      const value = M31.from(42);
      const packed = PackedM31.broadcast(value);

      expect(packed.toArray()).toEqual(Array(N_LANES).fill(value));
    });

    it("should handle pointwise sum", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 1));
      const packed = PackedM31.fromArray(values);

      const sum = packed.pointwiseSum();
      const expected = values.reduce((acc, v) => acc.add(v), M31.zero());

      expect(sum).toEqual(expected);
    });

    it("should handle reverse operation", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i));
      const packed = PackedM31.fromArray(values);

      const reversed = packed.reverse();
      const expected = [...values].reverse();

      expect(reversed.toArray()).toEqual(expected);
    });

    it("should handle zero and one constants", () => {
      const zero = PackedM31.zero();
      const one = PackedM31.one();

      expect(zero.toArray()).toEqual(Array(N_LANES).fill(M31.zero()));
      expect(one.toArray()).toEqual(Array(N_LANES).fill(M31.one()));
    });

    it("should handle equality checks", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i));
      const packed1 = PackedM31.fromArray(values);
      const packed2 = PackedM31.fromArray([...values]);
      const packed3 = PackedM31.fromArray(values.map(v => v.add(M31.one())));

      expect(packed1.equals(packed2)).toBe(true);
      expect(packed1.equals(packed3)).toBe(false);
    });

    it("should handle zero checks", () => {
      const zero = PackedM31.zero();
      const nonZero = PackedM31.fromArray(Array.from({ length: N_LANES }, (_, i) => M31.from(i + 1)));

      expect(zero.isZero()).toBe(true);
      expect(nonZero.isZero()).toBe(false);
    });

    it("should handle element access and modification", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i));
      const packed = PackedM31.fromArray(values);

      // Test element access
      for (let i = 0; i < N_LANES; i++) {
        expect(packed.at(i)).toEqual(values[i]);
      }

      // Test element modification
      const newValue = M31.from(999);
      packed.set(5, newValue);
      expect(packed.at(5)).toEqual(newValue);
    });

    it("should throw on invalid array sizes", () => {
      expect(() => PackedM31.fromArray([M31.from(1)])).toThrow();
      expect(() => PackedM31.fromArray(Array(N_LANES + 1).fill(M31.from(1)))).toThrow();
    });

    it("should throw on invalid element access", () => {
      const packed = PackedM31.zero();
      expect(() => packed.at(-1)).toThrow();
      expect(() => packed.at(N_LANES)).toThrow();
      expect(() => packed.set(-1, M31.zero())).toThrow();
      expect(() => packed.set(N_LANES, M31.zero())).toThrow();
    });
  });

  describe("PackedCM31 operations", () => {
    it("should perform basic arithmetic operations", () => {
      const values1 = Array.from({ length: N_LANES }, (_, i) => CM31.from_m31(M31.from(i + 1), M31.from(i + 2)));
      const values2 = Array.from({ length: N_LANES }, (_, i) => CM31.from_m31(M31.from(i + 2), M31.from(i + 3)));
      const packed1 = PackedCM31.fromArray(values1);
      const packed2 = PackedCM31.fromArray(values2);

      const addResult = packed1.add(packed2);
      const subResult = packed1.sub(packed2);
      const mulResult = packed1.mul(packed2);
      const negResult = packed1.neg();

      expect(addResult.toArray()).toEqual(values1.map((v, i) => v.add(values2[i]!)));
      expect(subResult.toArray()).toEqual(values1.map((v, i) => v.sub(values2[i]!)));
      expect(mulResult.toArray()).toEqual(values1.map((v, i) => v.mul(values2[i]!)));
      expect(negResult.toArray()).toEqual(values1.map(v => v.neg()));
    });

    it("should handle interleave and deinterleave operations", () => {
      const values1 = Array.from({ length: N_LANES }, (_, i) => CM31.from_m31(M31.from(i), M31.from(i + 1)));
      const values2 = Array.from({ length: N_LANES }, (_, i) => CM31.from_m31(M31.from(i + N_LANES), M31.from(i + N_LANES + 1)));
      const packed1 = PackedCM31.fromArray(values1);
      const packed2 = PackedCM31.fromArray(values2);

      const [interleaved1, interleaved2] = packed1.interleave(packed2);
      const [deinterleaved1, deinterleaved2] = interleaved1.deinterleave(interleaved2);

      expect(deinterleaved1.toArray()).toEqual(values1);
      expect(deinterleaved2.toArray()).toEqual(values2);
    });

    it("should handle batch inverse operations", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => CM31.from_m31(M31.from(i + 1), M31.from(i + 2)));
      const packed = PackedCM31.fromArray(values);

      const inverses = PackedCM31.batchInverse([packed]);
      const expected = values.map(v => v.inverse());

      expect(inverses[0]!.toArray()).toEqual(expected);
    });
  });

  describe("PackedQM31 operations", () => {
    it("should perform basic arithmetic operations", () => {
      const values1 = Array.from({ length: N_LANES }, (_, i) => QM31.from(M31.from(i + 1)));
      const values2 = Array.from({ length: N_LANES }, (_, i) => QM31.from(M31.from(i + 2)));
      const packed1 = PackedQM31.fromArray(values1);
      const packed2 = PackedQM31.fromArray(values2);

      const addResult = packed1.add(packed2);
      const subResult = packed1.sub(packed2);
      const mulResult = packed1.mul(packed2);
      const negResult = packed1.neg();

      expect(addResult.toArray()).toEqual(values1.map((v, i) => v.add(values2[i]!)));
      expect(subResult.toArray()).toEqual(values1.map((v, i) => v.sub(values2[i]!)));
      expect(mulResult.toArray()).toEqual(values1.map((v, i) => v.mul(values2[i]!)));
      expect(negResult.toArray()).toEqual(values1.map(v => v.neg()));
    });

    it("should handle interleave and deinterleave operations", () => {
      const values1 = Array.from({ length: N_LANES }, (_, i) => QM31.from(M31.from(i)));
      const values2 = Array.from({ length: N_LANES }, (_, i) => QM31.from(M31.from(i + N_LANES)));
      const packed1 = PackedQM31.fromArray(values1);
      const packed2 = PackedQM31.fromArray(values2);

      const [interleaved1, interleaved2] = packed1.interleave(packed2);
      const [deinterleaved1, deinterleaved2] = interleaved1.deinterleave(interleaved2);

      expect(deinterleaved1.toArray()).toEqual(values1);
      expect(deinterleaved2.toArray()).toEqual(values2);
    });

    it("should handle batch inverse operations", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => QM31.from(M31.from(i + 1)));
      const packed = PackedQM31.fromArray(values);

      const inverses = PackedQM31.batchInverse([packed]);
      const expected = values.map(v => v.inverse());

      expect(inverses[0]!.toArray()).toEqual(expected);
    });
  });

  describe("Bit reverse operations", () => {
    it("should compute bit reverse index correctly", () => {
      expect(bitReverseIndex(0, 2)).toBe(0);
      expect(bitReverseIndex(1, 2)).toBe(2);
      expect(bitReverseIndex(2, 2)).toBe(1);
      expect(bitReverseIndex(3, 2)).toBe(3);
    });

    it("should handle larger bit reverse indices", () => {
      expect(bitReverseIndex(0, 3)).toBe(0);
      expect(bitReverseIndex(1, 3)).toBe(4);
      expect(bitReverseIndex(2, 3)).toBe(2);
      expect(bitReverseIndex(3, 3)).toBe(6);
      expect(bitReverseIndex(4, 3)).toBe(1);
      expect(bitReverseIndex(5, 3)).toBe(5);
      expect(bitReverseIndex(6, 3)).toBe(3);
      expect(bitReverseIndex(7, 3)).toBe(7);
    });

    it("should be its own inverse", () => {
      const logSize = 4;
      const size = 1 << logSize;
      
      for (let i = 0; i < size; i++) {
        const reversed = bitReverseIndex(i, logSize);
        const doubleReversed = bitReverseIndex(reversed, logSize);
        expect(doubleReversed).toBe(i);
      }
    });
  });

  describe("SIMD FFT operations", () => {
    it("should handle FFT butterfly operations", () => {
      // Test basic butterfly operation
      const a = PackedM31.fromArray(Array.from({ length: N_LANES }, (_, i) => M31.from(i)));
      const b = PackedM31.fromArray(Array.from({ length: N_LANES }, (_, i) => M31.from(i + N_LANES)));
      const twiddle = M31.from(2);

      // Basic butterfly: (a, b) -> (a + b*twiddle, a - b*twiddle)
      const bTwiddle = b.mulScalar(twiddle);
      const result1 = a.add(bTwiddle);
      const result2 = a.sub(bTwiddle);

      expect(result1.toArray()).toEqual(a.toArray().map((v, i) => v.add(b.at(i).mul(twiddle))));
      expect(result2.toArray()).toEqual(a.toArray().map((v, i) => v.sub(b.at(i).mul(twiddle))));
    });
  });

  describe("SIMD performance characteristics", () => {
    it("should handle large data sets efficiently", () => {
      const size = 4096;
      const data = Array.from({ length: size }, (_, i) => M31.from(i % 1000));
      
      const startTime = performance.now();
      const column = simdBackend.createBaseFieldColumn(data);
      simdBackend.bitReverseColumn(column);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete in reasonable time
      expect(column.len()).toBe(size);
    });

    it("should maintain precision across operations", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i + 1));
      const packed = PackedM31.fromArray(values);
      
      // Perform multiple operations
      let result = packed;
      for (let i = 0; i < 10; i++) {
        result = result.add(packed).sub(packed);
      }
      
      // Should still equal original
      expect(result.toArray()).toEqual(values);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle zero division gracefully", () => {
      const zero = PackedM31.zero();
      expect(() => zero.inverse()).toThrow();
    });

    it("should handle boundary values", () => {
      const maxValue = M31.from(2147483646); // P - 1
      const packed = PackedM31.broadcast(maxValue);
      
      const doubled = packed.double();
      expect(doubled.toArray()).toEqual(Array(N_LANES).fill(M31.from(2147483645))); // 2*(P-1) mod P = P-2
    });

    it("should validate input sizes consistently", () => {
      expect(() => new PackedM31([])).toThrow();
      expect(() => new PackedM31([M31.zero()])).toThrow();
      expect(() => new PackedM31(Array(N_LANES + 1).fill(M31.zero()))).toThrow();
    });
  });

  describe("Memory and data integrity", () => {
    it("should maintain data immutability where expected", () => {
      const originalValues = Array.from({ length: N_LANES }, (_, i) => M31.from(i));
      const packed = PackedM31.fromArray(originalValues);
      
      // Modify original array
      originalValues[0] = M31.from(999);
      
      // Packed should be unaffected
      expect(packed.at(0)).toEqual(M31.from(0));
    });

    it("should handle deep copying correctly", () => {
      const values = Array.from({ length: N_LANES }, (_, i) => M31.from(i));
      const packed1 = PackedM31.fromArray(values);
      const packed2 = PackedM31.fromArray(packed1.toArray());
      
      packed1.set(0, M31.from(999));
      expect(packed2.at(0)).toEqual(M31.from(0)); // Should be unaffected
    });
  });
}); 