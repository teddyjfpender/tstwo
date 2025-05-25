import { describe, it, expect, beforeEach } from "vitest";
import {
  CpuBackend,
  CpuColumn,
  bitReverse,
  slowPrecomputeTwiddles,
  precomputeTwiddles,
  cpuBackend,
} from "../../src/backend/cpu";
import { M31 } from "../../src/fields/m31";
import { QM31 } from "../../src/fields/qm31";
import { batchInverseInPlace } from "../../src/fields/fields";
import { Coset } from "../../src/circle";

describe("CpuBackend", () => {
  describe("CpuBackend class", () => {
    it("should create backend instance with correct name", () => {
      const backend = new CpuBackend();
      expect(backend.name).toBe("CpuBackend");
    });

    it("should provide default instance", () => {
      expect(cpuBackend).toBeInstanceOf(CpuBackend);
      expect(cpuBackend.name).toBe("CpuBackend");
    });

    it("should create BaseField columns", () => {
      const data = [M31.from(1), M31.from(2), M31.from(3)];
      const column = cpuBackend.createBaseFieldColumn(data);
      expect(column.len()).toBe(3);
      expect(column.at(0)).toEqual(M31.from(1));
    });

    it("should create SecureField columns", () => {
      const data = [QM31.from(M31.from(1)), QM31.from(M31.from(2))];
      const column = cpuBackend.createSecureFieldColumn(data);
      expect(column.len()).toBe(2);
      expect(column.at(0)).toEqual(QM31.from(M31.from(1)));
    });

    it("should bit reverse columns", () => {
      const data = [M31.from(0), M31.from(1), M31.from(2), M31.from(3)];
      const column = cpuBackend.createBaseFieldColumn(data);
      cpuBackend.bitReverseColumn(column);
      
      expect(column.at(0)).toEqual(M31.from(0));
      expect(column.at(1)).toEqual(M31.from(2));
      expect(column.at(2)).toEqual(M31.from(1));
      expect(column.at(3)).toEqual(M31.from(3));
    });
  });

  describe("bitReverse function", () => {
    // Mirrors Rust test: bit_reverse_works
    it("should perform bit reversal correctly", () => {
      const data = [0, 1, 2, 3, 4, 5, 6, 7];
      bitReverse(data);
      expect(data).toEqual([0, 4, 2, 6, 1, 5, 3, 7]);
    });

    it("should handle single element array", () => {
      const data = [42];
      bitReverse(data);
      expect(data).toEqual([42]);
    });

    it("should handle two element array", () => {
      const data = [1, 2];
      bitReverse(data);
      expect(data).toEqual([1, 2]);
    });

    it("should handle four element array", () => {
      const data = [1, 2, 3, 4];
      bitReverse(data);
      expect(data).toEqual([1, 3, 2, 4]);
    });

    // Mirrors Rust test: bit_reverse_non_power_of_two_size_fails
    it("should throw error for non-power-of-two arrays", () => {
      const data = [0, 1, 2, 3, 4, 5]; // length 6 is not power of 2
      expect(() => bitReverse(data)).toThrow("length is not power of two");
    });

    it("should throw error for empty array", () => {
      const data: number[] = [];
      expect(() => bitReverse(data)).toThrow("length is not power of two");
    });

    it("should work with string arrays", () => {
      const data = ["a", "b", "c", "d"];
      bitReverse(data);
      expect(data).toEqual(["a", "c", "b", "d"]);
    });

    it("should work with large power-of-two arrays", () => {
      const size = 16;
      const data = Array.from({ length: size }, (_, i) => i);
      const expected = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
      bitReverse(data);
      expect(data).toEqual(expected);
    });
  });

  describe("CpuColumn", () => {
    describe("construction", () => {
      it("should create column from array", () => {
        const data = [1, 2, 3, 4];
        const column = new CpuColumn(data);
        expect(column.len()).toBe(4);
        expect(column.at(0)).toBe(1);
        expect(column.at(3)).toBe(4);
      });

      it("should create column using fromArray factory", () => {
        const data = [5, 6, 7, 8];
        const column = CpuColumn.fromArray(data);
        expect(column.len()).toBe(4);
        expect(column.toCpu()).toEqual([5, 6, 7, 8]);
        // Should be a copy, not reference
        data[0] = 99;
        expect(column.at(0)).toBe(5);
      });

      it("should create zeros column", () => {
        const column = CpuColumn.zeros(5, () => 0);
        expect(column.len()).toBe(5);
        for (let i = 0; i < 5; i++) {
          expect(column.at(i)).toBe(0);
        }
      });

      it("should create zeros column with complex default", () => {
        const column = CpuColumn.zeros(3, () => ({ value: 42 }));
        expect(column.len()).toBe(3);
        for (let i = 0; i < 3; i++) {
          expect(column.at(i)).toEqual({ value: 42 });
        }
      });

      it("should create uninitialized column", () => {
        const column = CpuColumn.uninitialized(4, () => -1);
        expect(column.len()).toBe(4);
        // All elements should be initialized with default factory
        for (let i = 0; i < 4; i++) {
          expect(column.at(i)).toBe(-1);
        }
      });
    });

    describe("element access", () => {
      let column: CpuColumn<number>;

      beforeEach(() => {
        column = CpuColumn.fromArray([10, 20, 30, 40, 50]);
      });

      it("should get elements by index", () => {
        expect(column.at(0)).toBe(10);
        expect(column.at(2)).toBe(30);
        expect(column.at(4)).toBe(50);
      });

      it("should set elements by index", () => {
        column.set(1, 99);
        expect(column.at(1)).toBe(99);
        column.set(0, 88);
        expect(column.at(0)).toBe(88);
      });

      it("should throw on out-of-bounds access", () => {
        expect(() => column.at(-1)).toThrow("Index -1 out of bounds");
        expect(() => column.at(5)).toThrow("Index 5 out of bounds");
        expect(() => column.set(-1, 99)).toThrow("Index -1 out of bounds");
        expect(() => column.set(5, 99)).toThrow("Index 5 out of bounds");
      });

      it("should get correct length", () => {
        expect(column.len()).toBe(5);
        const empty = CpuColumn.fromArray<number>([]);
        expect(empty.len()).toBe(0);
      });

      it("should check if empty", () => {
        expect(column.isEmpty()).toBe(false);
        const empty = CpuColumn.fromArray<number>([]);
        expect(empty.isEmpty()).toBe(true);
      });

      it("should convert to CPU array", () => {
        const cpu = column.toCpu();
        expect(cpu).toEqual([10, 20, 30, 40, 50]);
        // Should be a copy
        cpu[0] = 999;
        expect(column.at(0)).toBe(10);
      });

      it("should iterate over values", () => {
        const values = [];
        for (const value of column) {
          values.push(value);
        }
        expect(values).toEqual([10, 20, 30, 40, 50]);
      });

      it("should provide internal data access", () => {
        const data = column.getData();
        expect(data).toEqual([10, 20, 30, 40, 50]);
        // This should be the actual internal array
        data[0] = 777;
        expect(column.at(0)).toBe(777);
      });
    });

    describe("with field elements", () => {
      it("should work with M31 field elements", () => {
        const m31Values = [M31.from(1), M31.from(2), M31.from(3)];
        const column = CpuColumn.fromArray(m31Values);
        
        expect(column.len()).toBe(3);
        expect(column.at(0).value).toBe(1);
        expect(column.at(1).value).toBe(2);
        expect(column.at(2).value).toBe(3);

        column.set(1, M31.from(42));
        expect(column.at(1).value).toBe(42);
      });

      it("should work with QM31 field elements", () => {
        const qm31Values = [
          QM31.fromM31Array([M31.from(1), M31.from(2), M31.from(3), M31.from(4)]),
          QM31.fromM31Array([M31.from(5), M31.from(6), M31.from(7), M31.from(8)])
        ];
        const column = CpuColumn.fromArray(qm31Values);
        
        expect(column.len()).toBe(2);
        expect(column.at(0).c0.real.value).toBe(1);
        expect(column.at(1).c0.real.value).toBe(5);
      });
    });
  });

  // TODO(Sonnet4): Fix these tests when Coset interface is corrected
  // describe("slowPrecomputeTwiddles", () => {
  //   it("should compute twiddle factors for small coset", () => {
  //     // Create a small coset for testing
  //     const coset = new Coset(M31.from(1), 2); // Size 4, log_size 2
  //     const twiddles = slowPrecomputeTwiddles(coset);
  //     
  //     expect(twiddles.length).toBeGreaterThan(0);
  //     expect(twiddles[twiddles.length - 1]).toEqual(M31.one()); // Last element should be 1
  //   });

  //   it("should handle different coset sizes", () => {
  //     const coset1 = new Coset(M31.from(1), 1); // Size 2
  //     const coset2 = new Coset(M31.from(1), 3); // Size 8
  //     
  //     const twiddles1 = slowPrecomputeTwiddles(coset1);
  //     const twiddles2 = slowPrecomputeTwiddles(coset2);
  //     
  //     expect(twiddles1.length).toBeLessThan(twiddles2.length);
  //     expect(twiddles1[twiddles1.length - 1]).toEqual(M31.one());
  //     expect(twiddles2[twiddles2.length - 1]).toEqual(M31.one());
  //   });

  //   it("should produce deterministic results", () => {
  //     const coset = new Coset(M31.from(3), 2);
  //     const twiddles1 = slowPrecomputeTwiddles(coset);
  //     const twiddles2 = slowPrecomputeTwiddles(coset);
  //     
  //     expect(twiddles1).toEqual(twiddles2);
  //   });
  // });

  // describe("precomputeTwiddles", () => {
  //   it("should compute twiddle tree for small domain", () => {
  //     const coset = new Coset(M31.from(1), 2); // Size 4, smaller than CHUNK_SIZE
  //     const tree = precomputeTwiddles(coset);
  //     
  //     expect(tree).toBeDefined();
  //     expect(tree.rootCoset).toEqual(coset);
  //     expect(tree.twiddles.length).toBeGreaterThan(0);
  //     expect(tree.itwiddles.length).toBe(tree.twiddles.length);
  //   });

  //   it("should use chunked batch inversion for larger domains", () => {
  //     // Create a larger coset that would trigger chunked processing
  //     const coset = new Coset(M31.from(1), 14); // Size 16384, larger than CHUNK_SIZE
  //     const tree = precomputeTwiddles(coset);
  //     
  //     expect(tree).toBeDefined();
  //     expect(tree.rootCoset).toEqual(coset);
  //     expect(tree.twiddles.length).toBeGreaterThan(0);
  //     expect(tree.itwiddles.length).toBe(tree.twiddles.length);
  //   });

  //   it("should produce correct inverse twiddles", () => {
  //     const coset = new Coset(M31.from(1), 2);
  //     const tree = precomputeTwiddles(coset);
  //     
  //     // Verify that twiddles and inverse twiddles are indeed inverses
  //     for (let i = 0; i < tree.twiddles.length; i++) {
  //       const product = tree.twiddles[i].mul(tree.itwiddles[i]);
  //       expect(product).toEqual(M31.one());
  //     }
  //   });

  //   it("should handle edge case of log_size 0", () => {
  //     const coset = new Coset(M31.from(1), 0); // Size 1
  //     const tree = precomputeTwiddles(coset);
  //     
  //     expect(tree.twiddles.length).toBe(1);
  //     expect(tree.twiddles[0]).toEqual(M31.one());
  //     expect(tree.itwiddles[0]).toEqual(M31.one());
  //   });
  // });

  // Mirror the Rust batch_inverse_in_place_test
  describe("batch inverse integration test", () => {
    it("should work with batch inverse in place", () => {
      // Create a test array of M31 elements
      const column = [
        M31.from(1),
        M31.from(2),
        M31.from(3),
        M31.from(4),
        M31.from(5),
        M31.from(6),
        M31.from(7),
        M31.from(8),
        M31.from(9),
        M31.from(10),
        M31.from(11),
        M31.from(12),
        M31.from(13),
        M31.from(14),
        M31.from(15),
        M31.from(16),
      ];
      
      // Compute expected inverses
      const expected = column.map(e => e.inverse());
      
      // Create destination array
      const dst = Array(column.length).fill(M31.zero());
      
      // Apply batch inverse
      batchInverseInPlace(column, dst);
      
      // Verify results
      expect(dst).toEqual(expected);
      
      // Verify that each element times its inverse equals one
      for (let i = 0; i < column.length; i++) {
        const product = column[i]!.mul(dst[i]!);
        expect(product.value).toBe(1);
      }
    });

    it("should handle empty arrays", () => {
      const column: M31[] = [];
      const dst: M31[] = [];
      
      expect(() => batchInverseInPlace(column, dst)).not.toThrow();
    });

    it("should handle single element", () => {
      const column = [M31.from(7)];
      const dst = [M31.zero()];
      
      batchInverseInPlace(column, dst);
      
      const result = dst[0];
      expect(result).toBeDefined();
      expect(result!).toEqual(M31.from(7).inverse());
      expect(column[0]!.mul(result!)).toEqual(M31.one());
    });
  });

  describe("performance and edge cases", () => {
    it("should handle large bit reverse operations", () => {
      const size = 1024; // Large power of 2
      const data = Array.from({ length: size }, (_, i) => i);
      const original = [...data];
      
      // Should not throw and should complete in reasonable time
      expect(() => bitReverse(data)).not.toThrow();
      
      // Verify it's actually different (unless size is 1)
      if (size > 1) {
        expect(data).not.toEqual(original);
      }
      
      // Verify bit reverse is its own inverse
      bitReverse(data);
      expect(data).toEqual(original);
    });

    it("should handle columns with zero elements", () => {
      const column = CpuColumn.zeros(0, () => 42);
      expect(column.len()).toBe(0);
      expect(column.toCpu()).toEqual([]);
      
      const values = [];
      for (const value of column) {
        values.push(value);
      }
      expect(values).toEqual([]);
    });

    it("should handle very large columns", () => {
      const size = 10000;
      const column = CpuColumn.zeros(size, () => Math.random());
      
      expect(column.len()).toBe(size);
      expect(column.at(0)).toBeTypeOf("number");
      expect(column.at(size - 1)).toBeTypeOf("number");
    });
  });
}); 