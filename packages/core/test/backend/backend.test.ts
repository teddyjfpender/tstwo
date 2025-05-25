import { describe, it, expect } from "vitest";
import type { Backend } from "../../src/backend";
import { CpuBackend, SimdBackend } from "../../src/backend";
import { M31 } from "../../src/fields/m31";
import { QM31 } from "../../src/fields/qm31";

describe("Backend Interface", () => {
  const backends: { name: string; backend: Backend }[] = [
    { name: "CpuBackend", backend: new CpuBackend() },
    { name: "SimdBackend", backend: new SimdBackend() },
  ];

  backends.forEach(({ name, backend }) => {
    describe(`${name}`, () => {
      it("should implement Backend interface", () => {
        expect(backend).toBeDefined();
        expect(typeof backend.bitReverseColumn).toBe("function");
        expect(typeof backend.createBaseFieldColumn).toBe("function");
        expect(typeof backend.createSecureFieldColumn).toBe("function");
      });

      it("should create BaseField columns", () => {
        const data = [M31.from(1), M31.from(2), M31.from(3)];
        const column = backend.createBaseFieldColumn(data);
        
        expect(column.len()).toBe(3);
        expect(column.at(0)).toEqual(M31.from(1));
        expect(column.at(1)).toEqual(M31.from(2));
        expect(column.at(2)).toEqual(M31.from(3));
      });

      it("should create SecureField columns", () => {
        const data = [
          QM31.from(M31.from(1)),
          QM31.from(M31.from(2)),
          QM31.from(M31.from(3))
        ];
        const column = backend.createSecureFieldColumn(data);
        
        expect(column.len()).toBe(3);
        expect(column.at(0)).toEqual(QM31.from(M31.from(1)));
        expect(column.at(1)).toEqual(QM31.from(M31.from(2)));
        expect(column.at(2)).toEqual(QM31.from(M31.from(3)));
      });

      it("should bit reverse columns correctly", () => {
        const data = [M31.from(0), M31.from(1), M31.from(2), M31.from(3)];
        const column = backend.createBaseFieldColumn(data);
        
        backend.bitReverseColumn(column);
        
        expect(column.at(0)).toEqual(M31.from(0));
        expect(column.at(1)).toEqual(M31.from(2));
        expect(column.at(2)).toEqual(M31.from(1));
        expect(column.at(3)).toEqual(M31.from(3));
      });

      it("should handle bit reverse with 8-element arrays", () => {
        const data = [
          M31.from(0), M31.from(1), M31.from(2), M31.from(3),
          M31.from(4), M31.from(5), M31.from(6), M31.from(7)
        ];
        const column = backend.createBaseFieldColumn(data);
        
        backend.bitReverseColumn(column);
        
        const expected = [
          M31.from(0), M31.from(4), M31.from(2), M31.from(6),
          M31.from(1), M31.from(5), M31.from(3), M31.from(7)
        ];
        
        for (let i = 0; i < expected.length; i++) {
          expect(column.at(i)).toEqual(expected[i]);
        }
      });

      it("should throw error for non-power-of-two arrays", () => {
        const data = [M31.from(0), M31.from(1), M31.from(2)]; // length 3
        const column = backend.createBaseFieldColumn(data);
        
        expect(() => backend.bitReverseColumn(column)).toThrow("length is not power of two");
      });

      it("should handle empty columns", () => {
        const data: M31[] = [];
        const column = backend.createBaseFieldColumn(data);
        
        expect(() => backend.bitReverseColumn(column)).toThrow("length is not power of two");
      });

      it("should handle single element columns", () => {
        const data = [M31.from(42)];
        const column = backend.createBaseFieldColumn(data);
        
        backend.bitReverseColumn(column);
        
        expect(column.at(0)).toEqual(M31.from(42));
      });

      it("should handle two element columns", () => {
        const data = [M31.from(1), M31.from(2)];
        const column = backend.createBaseFieldColumn(data);
        
        backend.bitReverseColumn(column);
        
        expect(column.at(0)).toEqual(M31.from(1));
        expect(column.at(1)).toEqual(M31.from(2));
      });

      it("should maintain column data integrity", () => {
        const data = [M31.from(10), M31.from(20), M31.from(30), M31.from(40)];
        const column = backend.createBaseFieldColumn(data);
        
        // Store original
        const original = column.toCpu();
        
        // Bit reverse twice should return to original
        backend.bitReverseColumn(column);
        backend.bitReverseColumn(column);
        
        for (let i = 0; i < original.length; i++) {
          expect(column.at(i)).toEqual(original[i]);
        }
      });

      it("should work with SecureField bit reverse", () => {
        const data = [
          QM31.from(M31.from(0)),
          QM31.from(M31.from(1)),
          QM31.from(M31.from(2)),
          QM31.from(M31.from(3))
        ];
        const column = backend.createSecureFieldColumn(data);
        
        backend.bitReverseColumn(column);
        
        expect(column.at(0)).toEqual(QM31.from(M31.from(0)));
        expect(column.at(1)).toEqual(QM31.from(M31.from(2)));
        expect(column.at(2)).toEqual(QM31.from(M31.from(1)));
        expect(column.at(3)).toEqual(QM31.from(M31.from(3)));
      });
    });
  });

  describe("Backend compatibility", () => {
    it("should produce identical results across backends", () => {
      const data = [M31.from(0), M31.from(1), M31.from(2), M31.from(3)];
      
      const cpuColumn = new CpuBackend().createBaseFieldColumn([...data]);
      const simdColumn = new SimdBackend().createBaseFieldColumn([...data]);
      
      new CpuBackend().bitReverseColumn(cpuColumn);
      new SimdBackend().bitReverseColumn(simdColumn);
      
      for (let i = 0; i < data.length; i++) {
        expect(cpuColumn.at(i)).toEqual(simdColumn.at(i));
      }
    });

    it("should handle large arrays consistently", () => {
      const size = 256;
      const data = Array.from({ length: size }, (_, i) => M31.from(i));
      
      const cpuColumn = new CpuBackend().createBaseFieldColumn([...data]);
      const simdColumn = new SimdBackend().createBaseFieldColumn([...data]);
      
      new CpuBackend().bitReverseColumn(cpuColumn);
      new SimdBackend().bitReverseColumn(simdColumn);
      
      // Check first few and last few elements
      for (let i = 0; i < 10; i++) {
        expect(cpuColumn.at(i)).toEqual(simdColumn.at(i));
      }
      for (let i = size - 10; i < size; i++) {
        expect(cpuColumn.at(i)).toEqual(simdColumn.at(i));
      }
    });
  });
}); 