import { describe, it, expect } from "vitest";
import { bitReverse, CpuBackend, CpuColumn } from "../../../src/backend/cpu/index";
import { M31 } from "../../../src/fields/m31";
import { QM31 } from "../../../src/fields/qm31";
import { batchInverseInPlace } from "../../../src/fields/fields";

describe("CpuBackend", () => {
  it("should create a CPU backend instance", () => {
    const backend = new CpuBackend();
    expect(backend.name).toBe("CpuBackend");
  });
});

describe("bitReverse", () => {
  it("should correctly bit reverse an array", () => {
    const data = [0, 1, 2, 3, 4, 5, 6, 7];
    bitReverse(data);
    expect(data).toEqual([0, 4, 2, 6, 1, 5, 3, 7]);
  });

  it("should throw error for non-power-of-two size", () => {
    const data = [0, 1, 2, 3, 4, 5];
    expect(() => bitReverse(data)).toThrow("length is not power of two");
  });

  it("should handle empty array", () => {
    const data: number[] = [];
    expect(() => bitReverse(data)).toThrow("length is not power of two");
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
});

describe("CpuColumn", () => {
  it("should create column with zeros", () => {
    const column = CpuColumn.zeros(4, () => M31.zero());
    expect(column.len()).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(column.at(i).equals(M31.zero())).toBe(true);
    }
  });

  it("should create uninitialized column", () => {
    const column = CpuColumn.uninitialized(3, () => M31.zero());
    expect(column.len()).toBe(3);
  });

  it("should create column from array", () => {
    const data = [M31.from(1), M31.from(2), M31.from(3)];
    const column = CpuColumn.fromArray(data);
    expect(column.len()).toBe(3);
    expect(column.at(0).equals(M31.from(1))).toBe(true);
    expect(column.at(1).equals(M31.from(2))).toBe(true);
    expect(column.at(2).equals(M31.from(3))).toBe(true);
  });

  it("should get and set values correctly", () => {
    const column = CpuColumn.zeros(2, () => M31.zero());
    column.set(0, M31.from(42));
    column.set(1, M31.from(84));
    
    expect(column.at(0).equals(M31.from(42))).toBe(true);
    expect(column.at(1).equals(M31.from(84))).toBe(true);
  });

  it("should throw error for out of bounds access", () => {
    const column = CpuColumn.zeros(2, () => M31.zero());
    expect(() => column.at(-1)).toThrow("Index -1 out of bounds");
    expect(() => column.at(2)).toThrow("Index 2 out of bounds");
    expect(() => column.set(-1, M31.zero())).toThrow("Index -1 out of bounds");
    expect(() => column.set(2, M31.zero())).toThrow("Index 2 out of bounds");
  });

  it("should convert to CPU array", () => {
    const data = [M31.from(1), M31.from(2), M31.from(3)];
    const column = CpuColumn.fromArray(data);
    const cpuArray = column.toCpu();
    
    expect(cpuArray.length).toBe(3);
    expect(cpuArray[0]!.equals(M31.from(1))).toBe(true);
    expect(cpuArray[1]!.equals(M31.from(2))).toBe(true);
    expect(cpuArray[2]!.equals(M31.from(3))).toBe(true);
  });

  it("should be iterable", () => {
    const data = [M31.from(1), M31.from(2), M31.from(3)];
    const column = CpuColumn.fromArray(data);
    
    const values = Array.from(column);
    expect(values.length).toBe(3);
    expect(values[0]!.equals(M31.from(1))).toBe(true);
    expect(values[1]!.equals(M31.from(2))).toBe(true);
    expect(values[2]!.equals(M31.from(3))).toBe(true);
  });
});

describe("batchInverseInPlace", () => {
  it("should compute batch inverse correctly", () => {
    // Generate test data similar to Rust test
    const src = [
      QM31.from(M31.from(1)),
      QM31.from(M31.from(2)),
      QM31.from(M31.from(3)),
      QM31.from(M31.from(4)),
      QM31.from(M31.from(5)),
      QM31.from(M31.from(6)),
      QM31.from(M31.from(7)),
      QM31.from(M31.from(8)),
    ];
    
    const expected = src.map(e => e.inverse());
    const dst = new Array(src.length).fill(QM31.zero());
    
    batchInverseInPlace(src, dst);
    
    for (let i = 0; i < expected.length; i++) {
      expect(dst[i]!.equals(expected[i]!)).toBe(true);
    }
  });

  it("should handle empty arrays", () => {
    const src: QM31[] = [];
    const dst: QM31[] = [];
    
    expect(() => batchInverseInPlace(src, dst)).not.toThrow();
  });

  it("should handle single element", () => {
    const src = [QM31.from(M31.from(5))];
    const dst = [QM31.zero()];
    
    batchInverseInPlace(src, dst);
    
    expect(dst[0]!.equals(QM31.from(M31.from(5)).inverse())).toBe(true);
  });
}); 