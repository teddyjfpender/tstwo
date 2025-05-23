import { describe, it, expect, beforeEach } from "vitest";
import { M31 } from "../../src/fields/m31";
import { batchInverse, batchInverseChunked, TestUtils, batchInverseClassic, batchInverseInPlace, FieldUtils, type FieldExpOps } from "../../src/fields/fields";
import { CM31 } from "../../src/fields/cm31";
import { QM31 } from "../../src/fields/qm31";

// Create a simple random number generator for testing
class SimpleRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  // Basic xorshift algorithm for random numbers
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x;
    return Math.abs(x);
  }

  // Generate a random non-zero M31 element
  nextM31(): M31 {
    const P = 2147483647; // 2^31-1, same as in M31
    // Make sure we don't generate zero
    const val = (this.next() % (P - 1)) + 1;
    return M31.fromUnchecked(val);
  }
}

describe("Fields", () => {
  it("should correctly batch invert elements", () => {
    const rng = new SimpleRng(0);
    const elements: M31[] = [];
    
    // Generate 16 random M31 elements
    for (let i = 0; i < 16; i++) {
      elements.push(rng.nextM31());
    }
    
    const expected = elements.map(e => e.inverse());
    const actual = batchInverse(elements);
    
    // Compare results
    for (let i = 0; i < expected.length; i++) {
      const actualElement = actual[i];
      const expectedElement = expected[i];
      if (actualElement && expectedElement) {
        expect(actualElement.equals(expectedElement)).toBe(true);
      }
    }
  });

  it("should correctly batch invert elements in chunks", () => {
    const rng = new SimpleRng(0);
    const elements: M31[] = [];
    
    // Generate 16 random M31 elements
    for (let i = 0; i < 16; i++) {
      elements.push(rng.nextM31());
    }
    
    const chunkSize = 4;
    const expected = batchInverse(elements);
    const result: M31[] = Array(elements.length);
    
    // Initialize result array
    for (let i = 0; i < result.length; i++) {
      result[i] = M31.zero();
    }
    
    batchInverseChunked(elements, result, chunkSize);
    
    // Compare results
    for (let i = 0; i < expected.length; i++) {
      const resultElement = result[i];
      const expectedElement = expected[i];
      if (resultElement && expectedElement) {
        expect(resultElement.equals(expectedElement)).toBe(true);
      }
    }
  });

  it("should correctly use test utilities", () => {
    const rng = new SimpleRng(0);
    const elements: M31[] = [];
    
    // Generate 16 random M31 elements
    for (let i = 0; i < 16; i++) {
      elements.push(rng.nextM31());
    }
    
    expect(TestUtils.testBatchInverse(elements)).toBe(true);
    expect(TestUtils.testBatchInverseChunked(elements, 4)).toBe(true);
  });
}); 
describe("Fields extra", () => {
  it("batchInverseClassic throws when dst too small", () => {
    const el = M31.one();
    const dst: M31[] = [];
    expect(() => batchInverseClassic([el], dst)).toThrow('Destination array is too small');
  });

  it("batchInverseClassic returns on empty column", () => {
    const dst: M31[] = [];
    expect(() => batchInverseClassic([], dst)).not.toThrow();
    expect(dst.length).toBe(0);
  });

  it("batchInverseInPlace throws when dst too small", () => {
    const el = M31.one();
    const dst: M31[] = [];
    expect(() => batchInverseInPlace([el], dst)).toThrow('Destination array is too small');
  });

  it("batchInverseInPlace works without one() helper", () => {
    class Dummy implements FieldExpOps<Dummy> {
      constructor(public v: number) {}
      square() { return new Dummy(this.v * this.v); }
      pow(e: number) { let r = 1; for(let i=0;i<e;i++) r *= this.v; return new Dummy(r); }
      inverse() { return new Dummy(1 / this.v); }
      mul(o: Dummy) { return new Dummy(this.v * o.v); }
      clone() { return new Dummy(this.v); }
    }
    const column = [new Dummy(2), new Dummy(4), new Dummy(8), new Dummy(16), new Dummy(32), new Dummy(64), new Dummy(128), new Dummy(256)];
    const dst = column.map(c => new Dummy(c.v));
    batchInverseInPlace(column, dst);
    expect(dst.every((d, i) => {
      const columnElement = column[i];
      return columnElement ? Math.abs(d.v * columnElement.v - 1) < 1e-9 : false;
    })).toBe(true);
  });
  it("batchInverseChunked throws when dst too small", () => {
    const el = M31.one();
    const dst: M31[] = [];
    expect(() => batchInverseChunked([el], dst, 1)).toThrow('Destination array is too small');
  });

  it("FieldUtils helpers work", () => {
    const arr = FieldUtils.uninitVec<number>(3);
    expect(arr.length).toBe(3);
    const typed = new Uint32Array([1,2,3]);
    const conv = FieldUtils.typedArrayToArray(typed, n => n * 2);
    expect(conv).toEqual([2,4,6]);
  });
});

describe("Field Operations", () => {
  describe("batchInverseClassic", () => {
    it("should compute batch inverse correctly for M31", () => {
      const elements = [M31.from(1), M31.from(2), M31.from(3), M31.from(4)];
      const dst = Array(elements.length).fill(M31.zero());
      
      batchInverseClassic(elements, dst);
      
      // Verify each element * its inverse = 1
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should handle single element", () => {
      const elements = [M31.from(5)];
      const dst = [M31.zero()];
      
      batchInverseClassic(elements, dst);
      
      const element = elements[0];
      const inverse = dst[0];
      if (element && inverse) {
        expect(element.mul(inverse)).toEqual(M31.one());
        expect(inverse).toEqual(M31.from(5).inverse());
      }
    });

    it("should handle empty array", () => {
      const elements: M31[] = [];
      const dst: M31[] = [];
      
      expect(() => batchInverseClassic(elements, dst)).not.toThrow();
    });

    it("should throw on mismatched destination size", () => {
      const elements = [M31.from(1), M31.from(2)];
      const dst = [M31.zero()]; // Too small
      
      expect(() => batchInverseClassic(elements, dst)).toThrow("Destination array is too small");
    });

    it("should work with CM31 elements", () => {
      const elements = [
        CM31.fromM31(M31.from(1), M31.from(2)),
        CM31.fromM31(M31.from(3), M31.from(4)),
        CM31.fromM31(M31.from(5), M31.from(0))
      ];
      const dst = Array(elements.length).fill(CM31.zero());
      
      batchInverseClassic(elements, dst);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product.real.value).toBeCloseTo(1, 5);
          expect(product.imag.value).toBeCloseTo(0, 5);
        }
      }
    });

    it("should work with QM31 elements", () => {
      const elements = [
        QM31.fromM31Array([M31.from(1), M31.from(0), M31.from(0), M31.from(0)]),
        QM31.fromM31Array([M31.from(2), M31.from(1), M31.from(0), M31.from(0)]),
        QM31.fromM31Array([M31.from(1), M31.from(1), M31.from(1), M31.from(1)])
      ];
      const dst = Array(elements.length).fill(QM31.zero());
      
      batchInverseClassic(elements, dst);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product.c0.real.value).toBeCloseTo(1, 5);
          expect(product.c0.imag.value).toBeCloseTo(0, 5);
          expect(product.c1.real.value).toBeCloseTo(0, 5);
          expect(product.c1.imag.value).toBeCloseTo(0, 5);
        }
      }
    });
  });

  describe("batchInverseInPlace", () => {
    it("should use classic implementation for small arrays", () => {
      const elements = [M31.from(1), M31.from(2), M31.from(3)]; // < WIDTH=4
      const dst = Array(elements.length).fill(M31.zero());
      
      batchInverseInPlace(elements, dst);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should use optimized implementation for larger arrays", () => {
      const elements = Array.from({ length: 16 }, (_, i) => M31.from(i + 1));
      const dst = Array(elements.length).fill(M31.zero());
      
      batchInverseInPlace(elements, dst);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should handle arrays not divisible by WIDTH", () => {
      const elements = Array.from({ length: 10 }, (_, i) => M31.from(i + 1)); // 10 % 4 != 0
      const dst = Array(elements.length).fill(M31.zero());
      
      batchInverseInPlace(elements, dst);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should produce same results as classic implementation", () => {
      const elements = Array.from({ length: 8 }, (_, i) => M31.from(i + 1));
      
      const dst1 = Array(elements.length).fill(M31.zero());
      const dst2 = Array(elements.length).fill(M31.zero());
      
      batchInverseClassic(elements, dst1);
      batchInverseInPlace(elements, dst2);
      
      expect(dst1).toEqual(dst2);
    });

    it("should handle large arrays efficiently", () => {
      const size = 100;
      const elements = Array.from({ length: size }, (_, i) => M31.from(i + 1));
      const dst = Array(elements.length).fill(M31.zero());
      
      const start = performance.now();
      batchInverseInPlace(elements, dst);
      const duration = performance.now() - start;
      
      // Verify correctness
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
      
      // Should complete reasonably quickly
      expect(duration).toBeLessThan(100); // 100ms threshold
    });
  });

  describe("batchInverse", () => {
    it("should return new array with inverses", () => {
      const elements = [M31.from(1), M31.from(2), M31.from(3), M31.from(4)];
      
      const inverses = batchInverse(elements);
      
      expect(inverses.length).toBe(elements.length);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = inverses[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should handle empty array", () => {
      const elements: M31[] = [];
      const inverses = batchInverse(elements);
      expect(inverses).toEqual([]);
    });

    it("should not modify original array", () => {
      const elements = [M31.from(1), M31.from(2), M31.from(3)];
      const originalValues = elements.map(e => e.value);
      
      batchInverse(elements);
      
      const newValues = elements.map(e => e.value);
      expect(newValues).toEqual(originalValues);
    });
  });

  describe("batchInverseChunked", () => {
    it("should process elements in chunks", () => {
      const elements = Array.from({ length: 12 }, (_, i) => M31.from(i + 1));
      const dst = Array(elements.length).fill(M31.zero());
      const chunkSize = 4;
      
      batchInverseChunked(elements, dst, chunkSize);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should handle non-aligned chunk sizes", () => {
      const elements = Array.from({ length: 10 }, (_, i) => M31.from(i + 1));
      const dst = Array(elements.length).fill(M31.zero());
      const chunkSize = 3; // 10 % 3 != 0
      
      batchInverseChunked(elements, dst, chunkSize);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should handle chunk size larger than array", () => {
      const elements = [M31.from(1), M31.from(2)];
      const dst = Array(elements.length).fill(M31.zero());
      const chunkSize = 5;
      
      batchInverseChunked(elements, dst, chunkSize);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = dst[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should throw on mismatched destination size", () => {
      const elements = [M31.from(1), M31.from(2), M31.from(3)];
      const dst = [M31.zero()]; // Too small
      
      expect(() => batchInverseChunked(elements, dst, 2)).toThrow("Destination array is too small");
    });
  });

  describe("FieldUtils", () => {
    it("should create uninitialized vector", () => {
      const vec = FieldUtils.uninitVec<number>(5);
      expect(vec.length).toBe(5);
      expect(Array.isArray(vec)).toBe(true);
    });

    it("should convert typed array to array", () => {
      const uint8Array = new Uint8Array([1, 2, 3, 4]);
      const converter = (val: number) => M31.from(val);
      
      const result = FieldUtils.typedArrayToArray(uint8Array, converter);
      
      expect(result.length).toBe(4);
      expect(result[0]).toEqual(M31.from(1));
      expect(result[3]).toEqual(M31.from(4));
    });

    it("should convert Uint32Array to array", () => {
      const uint32Array = new Uint32Array([100, 200, 300]);
      const converter = (val: number) => M31.from(val);
      
      const result = FieldUtils.typedArrayToArray(uint32Array, converter);
      
      expect(result.length).toBe(3);
      expect(result[0]).toEqual(M31.from(100));
      expect(result[2]).toEqual(M31.from(300));
    });

    it("should test batch inverse functionality", () => {
      const elements = [M31.from(1), M31.from(2), M31.from(3), M31.from(4)];
      
      const result = TestUtils.testBatchInverse(elements);
      
      expect(result).toBe(true);
    });

    it("should test batch inverse with invalid elements", () => {
      const elements = [M31.from(1), M31.zero(), M31.from(3)]; // Zero has no inverse
      
      expect(() => TestUtils.testBatchInverse(elements)).toThrow();
    });

    it("should test chunked batch inverse", () => {
      const elements = Array.from({ length: 8 }, (_, i) => M31.from(i + 1));
      const chunkSize = 3;
      
      const result = TestUtils.testBatchInverseChunked(elements, chunkSize);
      
      expect(result).toBe(true);
    });

    it("should handle empty arrays in batch inverse test", () => {
      const result = TestUtils.testBatchInverse([]);
      expect(result).toBe(true);
    });

    it("should handle single element in batch inverse test", () => {
      const result = TestUtils.testBatchInverse([M31.from(7)]);
      expect(result).toBe(true);
    });
  });

  describe("Performance comparisons", () => {
    it("should compare classic vs optimized batch inverse performance", () => {
      const size = 64;
      const elements = Array.from({ length: size }, (_, i) => M31.from(i + 1));
      
      // Classic implementation
      const dst1 = Array(elements.length).fill(M31.zero());
      const start1 = performance.now();
      batchInverseClassic(elements, dst1);
      const time1 = performance.now() - start1;
      
      // Optimized implementation
      const dst2 = Array(elements.length).fill(M31.zero());
      const start2 = performance.now();
      batchInverseInPlace(elements, dst2);
      const time2 = performance.now() - start2;
      
      // Both should produce same results
      expect(dst1).toEqual(dst2);
      
      // Log performance for analysis (but don't fail test based on performance)
      console.log(`Classic: ${time1.toFixed(2)}ms, Optimized: ${time2.toFixed(2)}ms`);
    });

    it("should handle very large batch operations", () => {
      const size = 1000;
      const elements = Array.from({ length: size }, (_, i) => M31.from((i % 1000) + 1));
      
      const start = performance.now();
      const inverses = batchInverse(elements);
      const duration = performance.now() - start;
      
      // Verify a subset of results
      for (let i = 0; i < Math.min(10, size); i++) {
        const element = elements[i];
        const inverse = inverses[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle mixed field types", () => {
      // Test that batch inverse works with different field implementations
      const m31Elements = [M31.from(1), M31.from(2)];
      const cm31Elements = [CM31.fromM31(M31.from(1), M31.from(0)), CM31.fromM31(M31.from(2), M31.from(0))];
      
      const m31Inverses = batchInverse(m31Elements);
      const cm31Inverses = batchInverse(cm31Elements);
      
      expect(m31Inverses.length).toBe(2);
      expect(cm31Inverses.length).toBe(2);
      
      // Verify results
      const m31Element = m31Elements[0];
      const m31Inverse = m31Inverses[0];
      if (m31Element && m31Inverse) {
        expect(m31Element.mul(m31Inverse)).toEqual(M31.one());
      }
      
      const cm31Element = cm31Elements[0];
      const cm31Inverse = cm31Inverses[0];
      if (cm31Element && cm31Inverse) {
        const cm31Product = cm31Element.mul(cm31Inverse);
        expect(cm31Product.real.value).toBeCloseTo(1);
        expect(cm31Product.imag.value).toBeCloseTo(0);
      }
    });

    it("should handle boundary values", () => {
      const elements = [
        M31.from(1),           // Smallest positive
        M31.from(2147483646),  // P - 1 (largest value)
        M31.from(2147483647 - 1000), // Near maximum
      ];
      
      const inverses = batchInverse(elements);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const inverse = inverses[i];
        if (element && inverse) {
          const product = element.mul(inverse);
          expect(product).toEqual(M31.one());
        }
      }
    });

    it("should maintain precision across operations", () => {
      // Test that repeated operations don't accumulate errors
      const original = M31.from(123456);
      const elements = Array(10).fill(original);
      
      const inverses = batchInverse(elements);
      
      for (const inverse of inverses) {
        if (inverse) {
          const product = original.mul(inverse);
          expect(product.value).toBe(1); // Exact equality for field operations
        }
      }
    });
  });
});
