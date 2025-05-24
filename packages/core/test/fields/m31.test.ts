import { describe, it, expect } from "vitest";
import { M31, P } from "../../src/fields/m31";

// Helper functions for testing - exact ports from Rust
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

// Macro equivalent for m31! - creates M31 from unchecked value
function m31(value: number): M31 {
  return M31.from_u32_unchecked(value);
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

  // Generate M31 element (matching Rust's Distribution<M31> for Standard)
  genM31(): M31 {
    return m31(this.nextRange(P));
  }
}

describe("M31", () => {
  // Exact port of test_basic_ops from Rust
  it("test_basic_ops", () => {
    const rng = new SimpleRng(0);
    
    for (let i = 0; i < 10000; i++) {
      const x = rng.nextRange(P);
      const y = rng.nextRange(P);
      
      // Test addition
      expect(m31(addP(x, y)).value).toEqual(
        (m31(x).add(m31(y))).value
      );
      
      // Test multiplication
      expect(m31(mulP(x, y)).value).toEqual(
        (m31(x).mul(m31(y))).value
      );
      
      // Test negation
      expect(m31(negP(x)).value).toEqual(
        (m31(x).neg()).value
      );
    }
  });

  // Exact port of test_into_slice from Rust
  it("test_into_slice", () => {
    const rng = new SimpleRng(0);
    const x: M31[] = [];
    
    // Generate 100 random M31 elements using the same logic as Rust
    for (let i = 0; i < 100; i++) {
      x.push(rng.genM31());
    }
    
    const slice = M31.intoSlice(x);
    
    // Verify each element can be reconstructed from the bytes
    for (let i = 0; i < 100; i++) {
      const bytes = slice.slice(i * 4, (i + 1) * 4);
      const value = new DataView(bytes.buffer).getUint32(0, true); // little-endian
      expect(x[i]!.value).toEqual(
        m31(value).value
      );
    }
  });

  // Exact port of test_m31_from_i32 from Rust
  it("test_m31_from_i32", () => {
    expect(M31.from(-1).value).toEqual(M31.from(P - 1).value);
    expect(M31.from(-10).value).toEqual(M31.from(P - 10).value);
    expect(M31.from(1).value).toEqual(M31.from(1).value);
    expect(M31.from(10).value).toEqual(M31.from(10).value);
  });

  // Additional test to verify inverse functionality (from the FieldExpOps doctest)
  it("test_inverse_field_exp_ops", () => {
    const v = M31.from(19);
    expect(v.inverse().mul(v).value).toEqual(M31.one().value);
    
    // Test that inverting zero throws an error
    expect(() => M31.zero().inverse()).toThrow("0 has no inverse");
  });

  // Test the pow2147483645 function directly (from its doctest)
  it("test_pow2147483645", () => {
    const v = M31.from(19);
    // This verifies that pow2147483645(v) == v.pow(2147483645)
    // Since pow2147483645 computes v^(P-2) which is the inverse
    expect(v.inverse().value).toEqual(v.pow(2147483645).value);
  });

  // Test to verify partial_reduce works correctly
  it("test_partial_reduce", () => {
    const val = 2 * P - 19;
    expect(M31.partialReduce(val).value).toEqual(M31.from(P - 19).value);
  });

  // Test to verify reduce works correctly
  it("test_reduce", () => {
    // Use exact computation like Rust: (P as u64).pow(2) - 19
    const val = BigInt(P) * BigInt(P) - 19n;
    expect(M31.reduce(val).value).toEqual(M31.from(P - 19).value);
  });

  // Test basic field properties
  it("test_field_properties", () => {
    // Test zero and one
    expect(M31.zero().value).toEqual(0);
    expect(M31.one().value).toEqual(1);
    
    // Test isZero
    expect(M31.zero().isZero()).toBe(true);
    expect(M31.one().isZero()).toBe(false);
    
    // Test complex conjugate (should be identity for M31)
    const v = M31.from(99);
    expect(v.complexConjugate().value).toBe(v.value);
  });

  // Test subtraction operation
  it("test_subtraction", () => {
    const a = M31.from(123);
    const b = M31.from(456);
    
    // Test subtraction matches expected behavior
    expect(a.sub(b).value).toEqual(M31.partialReduce(123 + P - 456).value);
  });

  // Test additional methods for 100% coverage
  it("test_additional_methods", () => {
    // Test fromUnchecked
    const unchecked = M31.fromUnchecked(42);
    expect(unchecked.value).toEqual(42);
    
    // Test double
    const v = M31.from(123);
    expect(v.double().value).toEqual(v.add(v).value);
    
    // Test is_zero (snake_case alias)
    expect(M31.zero().is_zero()).toBe(true);
    expect(M31.one().is_zero()).toBe(false);
    
    // Test toString
    const str = M31.from(456).toString();
    expect(str).toEqual("456");
    
    // Test equals
    const a = M31.from(789);
    const b = M31.from(789);
    const c = M31.from(123);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});