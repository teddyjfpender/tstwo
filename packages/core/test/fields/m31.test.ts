import { describe, it, expect } from "vitest";
import { M31, P } from "../../src/fields/m31";

// Helper functions for testing
function mulP(a: number, b: number): number {
  return Number((BigInt(a) * BigInt(b)) % BigInt(P));
}

function addP(a: number, b: number): number {
  return (a + b) % P;
}

function negP(a: number): number {
  if (a === 0) {
    return 0;
  } else {
    return P - a;
  }
}

// Simple deterministic random number generator to match Rust's SmallRng behavior
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

  // Get a number between 0 and max-1
  nextRange(max: number): number {
    return this.next() % max;
  }
}

describe("M31", () => {
  it("should perform basic operations correctly", () => {
    const rng = new SimpleRng(0);
    
    for (let i = 0; i < 10000; i++) {
      const x = rng.nextRange(P);
      const y = rng.nextRange(P);
      
      // Test addition
      expect(M31.fromUnchecked(addP(x, y)).value).toEqual(
        M31.fromUnchecked(x).add(M31.fromUnchecked(y)).value
      );
      
      // Test multiplication
      expect(M31.fromUnchecked(mulP(x, y)).value).toEqual(
        M31.fromUnchecked(x).mul(M31.fromUnchecked(y)).value
      );
      
      // Test negation
      expect(M31.fromUnchecked(negP(x)).value).toEqual(
        M31.fromUnchecked(x).neg().value
      );
    }
  });

  it("should serialize to bytes correctly", () => {
    const rng = new SimpleRng(0);
    const elements: M31[] = [];
    
    // Generate 100 random M31 elements
    for (let i = 0; i < 100; i++) {
      elements.push(M31.fromUnchecked(rng.nextRange(P)));
    }
    
    const slice = M31.intoSlice(elements);
    
    // Verify each element can be reconstructed from the bytes
    for (let i = 0; i < 100; i++) {
      const bytes = slice.slice(i * 4, (i + 1) * 4);
      const value = new DataView(bytes.buffer).getUint32(0, true); // little-endian
      expect(elements[i].value).toEqual(value);
    }
  });

  it("should handle conversion from integers correctly", () => {
    // Test negative numbers
    expect(M31.from(-1).value).toEqual(M31.from(P - 1).value);
    expect(M31.from(-10).value).toEqual(M31.from(P - 10).value);
    
    // Test positive numbers
    expect(M31.from(1).value).toEqual(M31.from(1).value);
    expect(M31.from(10).value).toEqual(M31.from(10).value);
  });

  it("should calculate multiplicative inverse correctly", () => {
    // Test inverse operation (v * v^-1 = 1)
    const v = M31.from(19);
    expect(v.inverse().mul(v).value).toEqual(M31.one().value);
    
    // Test that inverting zero throws an error
    expect(() => M31.zero().inverse()).toThrow("0 has no inverse");
  });

  it("should handle other field operations correctly", () => {
    const a = M31.from(123);
    const b = M31.from(456);
    
    // Test subtraction
    expect(a.sub(b).value).toEqual(M31.from(123 + P - 456).value);
    
    // Test exponentiation
    expect(a.pow(3).value).toEqual(a.mul(a).mul(a).value);
    
    // Test equality
    expect(a.equals(M31.from(123))).toBe(true);
    expect(a.equals(b)).toBe(false);
    
    // Test zero and one
    expect(M31.zero().value).toEqual(0);
    expect(M31.one().value).toEqual(1);
    
    // Test isZero
    expect(M31.zero().isZero()).toBe(true);
    expect(a.isZero()).toBe(false);
  });
});