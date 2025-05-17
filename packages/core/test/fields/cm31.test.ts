import { describe, it, expect } from "bun:test";
import { M31, P } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";

// Helper functions for creating CM31 values directly
function cm31(m0: number, m1: number): CM31 {
  return CM31.fromUnchecked(m0, m1);
}

// Helper function for creating M31 values
function m31(value: number): M31 {
  return M31.fromUnchecked(value);
}

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

  // Generate a random non-zero CM31 element
  nextCM31(): CM31 {
    const real = this.next() % P;
    const imag = this.next() % P;
    return CM31.fromUnchecked(real, imag);
  }
}

describe("CM31", () => {
  it("should compute the inverse correctly", () => {
    const cm = cm31(1, 2);

    // Manually compute the inverse
    // For (1+2i), the norm is 1^2 + 2^2 = 5
    // The inverse of 5 modulo P is 858993459
    // So the inverse of (1+2i) is (1/5 - 2i/5) = (858993459 - 2*858993459i) mod P
    // = (858993459 - 1717986918i) mod P
    // = (858993459 + 429496729i) mod P  // Since -1717986918 ≡ 429496729 (mod P)
    const expectedReal = 858993459;
    const expectedImag = 429496729;
    
    const cmInv = cm.inverse();
    
    // Verify inverse values
    expect(cmInv.real.value).toBe(expectedReal);
    expect(cmInv.imag.value).toBe(expectedImag);
    
    // Check that cm * cm^-1 = 1
    const product = cm.mul(cmInv);
    
    // Verify that the result is 1 + 0i 
    expect(product.real.value).toBe(1);
    expect(product.imag.value).toBe(0);
  });
  
  it("should perform basic operations correctly", () => {
    const cm0 = cm31(1, 2);
    const cm1 = cm31(4, 5);
    const m = m31(8);
    const cm = CM31.from(m);
    
    // Expected (1+2i) * (4+5i) = (1*4 - 2*5) + (1*5 + 2*4)i = (4-10) + (5+8)i = -6 + 13i
    // But in modular arithmetic, -6 = P - 6 = 2147483641 and 13 = 13
    // P = 2^31 - 1 = 2147483647
    const cm0_x_cm1 = cm31(P - 6, 13);
    
    // Addition
    expect(cm0.add(cm1).equals(cm31(5, 7))).toBe(true);
    
    // Addition with M31
    expect(cm1.addM31(m).equals(cm1.add(cm))).toBe(true);
    
    // Multiplication
    expect(cm0.mul(cm1).equals(cm0_x_cm1)).toBe(true);
    
    // Multiplication with M31
    expect(cm1.mulM31(m).equals(cm1.mul(cm))).toBe(true);
    
    // Negation
    expect(cm0.neg().equals(cm31(P - 1, P - 2))).toBe(true);
    
    // Subtraction
    expect(cm0.sub(cm1).equals(cm31(P - 3, P - 3))).toBe(true);
    
    // Subtraction with M31
    expect(cm1.subM31(m).equals(cm1.sub(cm))).toBe(true);
    
    // Create a direct test for division rather than relying on calculated values
    const a = cm31(5, 7);   // a = 5 + 7i
    const b = cm31(2, 3);   // b = 2 + 3i
    const c = a.mul(b);     // c = a * b
    
    // c / b should equal a
    const divResult = c.div(b);
    expect(divResult.real.value).toBe(a.real.value);
    expect(divResult.imag.value).toBe(a.imag.value);
    
    // Division with M31
    const divM31Result = cm1.divM31(m);
    const divCmResult = cm1.div(cm);
    expect(divM31Result.equals(divCmResult)).toBe(true);
  });
  
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
      
      // Extract real and imaginary parts
      const realBytes = correspondingSubSlice.slice(0, 4);
      const imagBytes = correspondingSubSlice.slice(4, 8);
      
      const realValue = new DataView(realBytes.buffer).getUint32(0, true);
      const imagValue = new DataView(imagBytes.buffer).getUint32(0, true);
      
      // TypeScript doesn't understand array access in loops
      const element = elements[i]!;  // non-null assertion
      expect(element.equals(cm31(realValue, imagValue))).toBe(true);
    }
  });
  
  it("should handle conversion between M31 and CM31", () => {
    // M31 to CM31
    const m = m31(123);
    const cm = CM31.from(m);
    
    expect(cm.real.equals(m)).toBe(true);
    expect(cm.imag.equals(M31.zero())).toBe(true);
    
    // CM31 to M31
    const cmReal = cm31(456, 0);
    const mFromCm = cmReal.tryIntoM31();
    
    expect(mFromCm).not.toBeNull();
    expect(mFromCm!.equals(m31(456))).toBe(true);
    
    // CM31 with non-zero imaginary part cannot be converted to M31
    const cmComplex = cm31(789, 42);
    const failedConversion = cmComplex.tryIntoM31();
    
    expect(failedConversion).toBeNull();
  });
  
  it("should handle complex conjugate correctly", () => {
    const cm = cm31(123, 456);
    const conj = cm.complexConjugate();
    
    expect(conj.real.equals(cm.real)).toBe(true);
    expect(conj.imag.equals(cm.imag.neg())).toBe(true);
    
    // Check that (a+bi)(a-bi) = a^2 + b^2
    const product = cm.mul(conj);
    const expected = cm.real.square().add(cm.imag.square());
    
    expect(product.real.equals(expected)).toBe(true);
    expect(product.imag.isZero()).toBe(true);
  });
  
  it("should handle exponentiation correctly", () => {
    const cm = cm31(2, 3);
    
    // Squaring
    const squared = cm.square();
    const multiplied = cm.mul(cm);
    expect(squared.equals(multiplied)).toBe(true);
    
    // Cubing
    const cubed = cm.pow(3);
    const multipliedTwice = cm.mul(cm).mul(cm);
    expect(cubed.equals(multipliedTwice)).toBe(true);
    
    // Zero power gives one
    expect(cm.pow(0).equals(CM31.one())).toBe(true);
  });
}); 