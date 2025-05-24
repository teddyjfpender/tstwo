import { describe, it, expect } from "vitest";
import { M31, P } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";

// Helper functions for creating CM31 values directly - matches Rust macro
function cm31(m0: number, m1: number): CM31 {
  return CM31.from_u32_unchecked(m0, m1);
}

// Helper function for creating M31 values - matches Rust macro
function m31(value: number): M31 {
  return M31.from_u32_unchecked(value);
}

// Create a simple random number generator for testing (matches Rust SmallRng behavior)
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

  // Generate a random CM31 element
  nextCM31(): CM31 {
    const real = this.next() % P;
    const imag = this.next() % P;
    return CM31.from_u32_unchecked(real, imag);
  }
}

describe("CM31", () => {
  // Test constants and static methods
  it("should have correct static constants", () => {
    expect(CM31.ZERO.equals(cm31(0, 0))).toBe(true);
    expect(CM31.ONE.equals(cm31(1, 0))).toBe(true);
    expect(CM31.zero().equals(CM31.ZERO)).toBe(true);
    expect(CM31.one().equals(CM31.ONE)).toBe(true);
  });

  it("should support factory methods", () => {
    // Test from_u32_unchecked
    const cm1 = CM31.from_u32_unchecked(123, 456);
    expect(cm1.real.value).toBe(123);
    expect(cm1.imag.value).toBe(456);

    // Test fromUnchecked (deprecated alias)
    const cm2 = CM31.fromUnchecked(123, 456);
    expect(cm2.equals(cm1)).toBe(true);

    // Test from_m31
    const m1 = m31(789);
    const m2 = m31(321);
    const cm3 = CM31.from_m31(m1, m2);
    expect(cm3.real.equals(m1)).toBe(true);
    expect(cm3.imag.equals(m2)).toBe(true);

    // Test fromM31 (deprecated alias)
    const cm5 = CM31.fromM31(m1, m2);
    expect(cm5.equals(cm3)).toBe(true);

    // Test from
    const cm4 = CM31.from(m1);
    expect(cm4.real.equals(m1)).toBe(true);
    expect(cm4.imag.isZero()).toBe(true);
  });

  it("should validate inputs in factory methods", () => {
    // Test from_u32_unchecked with invalid inputs
    expect(() => CM31.from_u32_unchecked(-1, 0)).toThrow("CM31.from_u32_unchecked: real part must be an integer in [0, P)");
    expect(() => CM31.from_u32_unchecked(0, P)).toThrow("CM31.from_u32_unchecked: imaginary part must be an integer in [0, P)");
    expect(() => CM31.from_u32_unchecked(P, 0)).toThrow("CM31.from_u32_unchecked: real part must be an integer in [0, P)");
    expect(() => CM31.from_u32_unchecked(1.5, 0)).toThrow("CM31.from_u32_unchecked: real part must be an integer in [0, P)");
    expect(() => CM31.from_u32_unchecked(0, 1.5)).toThrow("CM31.from_u32_unchecked: imaginary part must be an integer in [0, P)");
  });

  // Exact port of Rust test_inverse
  it("should compute the inverse correctly", () => {
    const cm = cm31(1, 2);
    const cmInv = cm.inverse();
    const product = cm.mul(cmInv);
    expect(product.equals(cm31(1, 0))).toBe(true);
  });

  it("should throw error when inverting zero", () => {
    expect(() => CM31.ZERO.inverse()).toThrow("0 has no inverse");
    expect(() => cm31(0, 0).inverse()).toThrow("0 has no inverse");
  });

  // Exact port of Rust test_ops
  it("should perform basic operations correctly", () => {
    const cm0 = cm31(1, 2);
    const cm1 = cm31(4, 5);
    const m = m31(8);
    const cm = CM31.from(m);
    const cm0_x_cm1 = cm31(P - 6, 13);

    // Addition
    expect(cm0.add(cm1).equals(cm31(5, 7))).toBe(true);
    expect(cm1.addM31(m).equals(cm1.add(cm))).toBe(true);

    // Multiplication  
    expect(cm0.mul(cm1).equals(cm0_x_cm1)).toBe(true);
    expect(cm1.mulM31(m).equals(cm1.mul(cm))).toBe(true);

    // Negation
    expect(cm0.neg().equals(cm31(P - 1, P - 2))).toBe(true);

    // Subtraction
    expect(cm0.sub(cm1).equals(cm31(P - 3, P - 3))).toBe(true);
    expect(cm1.subM31(m).equals(cm1.sub(cm))).toBe(true);

    // Division
    expect(cm0_x_cm1.div(cm1).equals(cm31(1, 2))).toBe(true);
    expect(cm1.divM31(m).equals(cm1.div(cm))).toBe(true);
  });

  it("should support M31-specific operations", () => {
    const cm = cm31(10, 20);
    const m = m31(5);

    // Addition with M31
    const addResult = cm.addM31(m);
    expect(addResult.real.value).toBe(15);
    expect(addResult.imag.value).toBe(20);

    // Subtraction with M31
    const subResult = cm.subM31(m);
    expect(subResult.real.value).toBe(5);
    expect(subResult.imag.value).toBe(20);

    // Multiplication with M31
    const mulResult = cm.mulM31(m);
    expect(mulResult.real.value).toBe(50);
    expect(mulResult.imag.value).toBe(100);

    // Division with M31
    const divResult = mulResult.divM31(m);
    expect(divResult.equals(cm)).toBe(true);
  });

  it("should handle double operation", () => {
    const cm = cm31(100, 200);
    const doubled = cm.double();
    expect(doubled.equals(cm.add(cm))).toBe(true);
    expect(doubled.real.value).toBe(200);
    expect(doubled.imag.value).toBe(400);
  });

  it("should handle squaring", () => {
    const cm = cm31(2, 3);
    
    // Squaring via square() method
    const squared = cm.square();
    
    // Squaring via multiplication
    const multiplied = cm.mul(cm);
    
    expect(squared.equals(multiplied)).toBe(true);
    
    // Manual calculation: (2+3i)^2 = 4 + 12i - 9 = -5 + 12i = (P-5) + 12i
    expect(squared.real.value).toBe(P - 5);
    expect(squared.imag.value).toBe(12);
  });

  it("should handle exponentiation correctly", () => {
    const cm = cm31(2, 3);
    
    // Zero power gives one
    expect(cm.pow(0).equals(CM31.ONE)).toBe(true);
    
    // First power gives self
    expect(cm.pow(1).equals(cm)).toBe(true);
    
    // Second power equals square
    expect(cm.pow(2).equals(cm.square())).toBe(true);
    
    // Third power
    const cubed = cm.pow(3);
    const multipliedTwice = cm.mul(cm).mul(cm);
    expect(cubed.equals(multipliedTwice)).toBe(true);
    
    // Larger power
    const pow5 = cm.pow(5);
    const manual = cm.mul(cm).mul(cm).mul(cm).mul(cm);
    expect(pow5.equals(manual)).toBe(true);
  });

  it("should validate exponentiation inputs", () => {
    const cm = cm31(2, 3);
    
    expect(() => cm.pow(-1)).toThrow("Exponent must be a non-negative integer");
    expect(() => cm.pow(1.5)).toThrow("Exponent must be a non-negative integer");
    expect(() => cm.pow(NaN)).toThrow("Exponent must be a non-negative integer");
  });

  it("should handle complex conjugate correctly", () => {
    const cm = cm31(123, 456);
    const conj = cm.complexConjugate();
    
    expect(conj.real.equals(cm.real)).toBe(true);
    expect(conj.imag.equals(cm.imag.neg())).toBe(true);
    
    // Check that (a+bi)(a-bi) = a^2 + b^2 (real number)
    const product = cm.mul(conj);
    const expected = cm.real.square().add(cm.imag.square());
    
    expect(product.real.equals(expected)).toBe(true);
    expect(product.imag.isZero()).toBe(true);
  });

  it("should handle conversion between M31 and CM31", () => {
    // M31 to CM31
    const m = m31(123);
    const cm = CM31.from(m);
    
    expect(cm.real.equals(m)).toBe(true);
    expect(cm.imag.isZero()).toBe(true);
    
    // CM31 with zero imaginary part to M31
    const cmReal = cm31(456, 0);
    const mFromCm = cmReal.tryIntoM31();
    
    expect(mFromCm).not.toBeNull();
    expect(mFromCm!.equals(m31(456))).toBe(true);
    
    // CM31 with non-zero imaginary part cannot be converted to M31
    const cmComplex = cm31(789, 42);
    const failedConversion = cmComplex.tryIntoM31();
    
    expect(failedConversion).toBeNull();
  });

  it("should handle zero detection", () => {
    expect(CM31.ZERO.isZero()).toBe(true);
    expect(cm31(0, 0).isZero()).toBe(true);
    expect(cm31(1, 0).isZero()).toBe(false);
    expect(cm31(0, 1).isZero()).toBe(false);
    expect(cm31(1, 1).isZero()).toBe(false);
  });

  it("should handle equality correctly", () => {
    const cm1 = cm31(123, 456);
    const cm2 = cm31(123, 456);
    const cm3 = cm31(123, 457);
    const cm4 = cm31(124, 456);
    
    expect(cm1.equals(cm2)).toBe(true);
    expect(cm1.equals(cm3)).toBe(false);
    expect(cm1.equals(cm4)).toBe(false);
    expect(cm1.equals(cm1)).toBe(true);
  });

  it("should clone correctly", () => {
    const cm = cm31(123, 456);
    const cloned = cm.clone();
    
    expect(cloned.equals(cm)).toBe(true);
    expect(cloned !== cm).toBe(true); // Different object references
  });

  // Exact port of Rust test_into_slice
  it("should serialize to bytes correctly", () => {
    const rng = new SimpleRng(0);
    const elements: CM31[] = [];
    
    // Generate 100 random CM31 elements
    for (let i = 0; i < 100; i++) {
      elements.push(rng.nextCM31());
    }
    
    const slice = CM31.intoSlice(elements);
    
    // Verify each element can be reconstructed from the bytes
    for (let i = 0; i < 100; i++) {
      const correspondingSubSlice = slice.slice(i * 8, (i + 1) * 8);
      
      // Extract real and imaginary parts (little-endian format)
      const realBytes = correspondingSubSlice.slice(0, 4);
      const imagBytes = correspondingSubSlice.slice(4, 8);
      
      const realValue = new DataView(realBytes.buffer).getUint32(0, true);
      const imagValue = new DataView(imagBytes.buffer).getUint32(0, true);
      
      // TypeScript doesn't understand array access in loops
      const element = elements[i]!; // non-null assertion
      expect(element.equals(cm31(realValue, imagValue))).toBe(true);
    }
  });

  it("should handle empty array serialization", () => {
    const slice = CM31.intoSlice([]);
    expect(slice.length).toBe(0);
  });

  it("should have correct extension degree", () => {
    const cm = cm31(1, 2);
    expect(cm.EXTENSION_DEGREE).toBe(2);
  });

  it("should format toString correctly", () => {
    const cm1 = cm31(123, 456);
    expect(cm1.toString()).toBe("123 + 456i");
    
    const cm2 = CM31.ZERO;
    expect(cm2.toString()).toBe("0 + 0i");
    
    const cm3 = CM31.ONE;
    expect(cm3.toString()).toBe("1 + 0i");
  });

  // Test mathematical properties
  it("should satisfy field axioms", () => {
    const a = cm31(123, 456);
    const b = cm31(789, 321);
    const c = cm31(555, 777);
    
    // Associativity of addition: (a + b) + c = a + (b + c)
    const addAssoc1 = a.add(b).add(c);
    const addAssoc2 = a.add(b.add(c));
    expect(addAssoc1.equals(addAssoc2)).toBe(true);
    
    // Commutativity of addition: a + b = b + a
    expect(a.add(b).equals(b.add(a))).toBe(true);
    
    // Additive identity: a + 0 = a
    expect(a.add(CM31.ZERO).equals(a)).toBe(true);
    
    // Additive inverse: a + (-a) = 0
    expect(a.add(a.neg()).equals(CM31.ZERO)).toBe(true);
    
    // Associativity of multiplication: (a * b) * c = a * (b * c)
    const mulAssoc1 = a.mul(b).mul(c);
    const mulAssoc2 = a.mul(b.mul(c));
    expect(mulAssoc1.equals(mulAssoc2)).toBe(true);
    
    // Commutativity of multiplication: a * b = b * a
    expect(a.mul(b).equals(b.mul(a))).toBe(true);
    
    // Multiplicative identity: a * 1 = a
    expect(a.mul(CM31.ONE).equals(a)).toBe(true);
    
    // Distributivity: a * (b + c) = a * b + a * c
    const dist1 = a.mul(b.add(c));
    const dist2 = a.mul(b).add(a.mul(c));
    expect(dist1.equals(dist2)).toBe(true);
  });

  it("should handle edge cases in arithmetic", () => {
    const max = cm31(P - 1, P - 1);
    const one = CM31.ONE;
    
    // Adding 1 to maximum value
    const overflow = max.add(one);
    expect(overflow.real.value).toBe(0); // Should wrap around
    expect(overflow.imag.value).toBe(P - 1);
    
    // Multiplying large values
    const large1 = cm31(P - 1, 0);
    const large2 = cm31(P - 1, 0);
    const product = large1.mul(large2);
    
    // (P-1)^2 = P^2 - 2P + 1, which should reduce properly
    expect(product.imag.isZero()).toBe(true);
  });
}); 