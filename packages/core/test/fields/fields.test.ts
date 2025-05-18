import { describe, it, expect } from "vitest";
import { M31 } from "../../src/fields/m31";
import { batchInverse, batchInverseChunked, TestUtils } from "../../src/fields/fields";

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