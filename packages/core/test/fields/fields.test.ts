import { describe, it, expect } from "vitest";
import { M31 } from "../../src/fields/m31";
import { batchInverse, batchInverseChunked, TestUtils, batchInverseClassic, batchInverseInPlace, FieldUtils, type FieldExpOps } from "../../src/fields/fields";

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
      expect(actual[i]?.equals(expected[i])).toBe(true);
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
      expect(result[i]?.equals(expected[i])).toBe(true);
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
    expect(dst.every((d, i) => Math.abs(d.v * column[i].v - 1) < 1e-9)).toBe(true);
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
