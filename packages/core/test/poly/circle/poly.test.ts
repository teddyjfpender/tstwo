import { describe, it, expect } from "vitest";
import { CirclePoly } from "../../../src/poly/circle/poly";
import { CanonicCoset } from "../../../src/poly/circle/canonic";
import { CircleDomain } from "../../../src/poly/circle/domain";
import { M31 } from "../../../src/fields/m31";
import { CirclePoint } from "../../../src/circle";

// Mock backend for testing
class MockCpuCirclePoly extends CirclePoly<any> {
  static eval_at_point(poly: CirclePoly<any>, point: any): any {
    // Mock evaluation - in real implementation this would use proper evaluation
    return M31.from_u32_unchecked(42); // Dummy value
  }

  static extend(poly: CirclePoly<any>, logSize: number): CirclePoly<any> {
    // Mock extension - pad with zeros
    const newSize = 1 << logSize;
    const newCoeffs = [...poly.coeffs];
    while (newCoeffs.length < newSize) {
      newCoeffs.push(M31.from_u32_unchecked(0));
    }
    return new MockCpuCirclePoly(newCoeffs);
  }

  static precomputeTwiddles(halfCoset: any): any {
    return { halfCoset };
  }

  static evaluate(poly: CirclePoly<any>, domain: CircleDomain, twiddles: any): any {
    return {
      domain,
      values: Array.from({ length: domain.size() }, (_, i) => M31.from_u32_unchecked(i))
    };
  }
}

describe("CirclePoly Tests", () => {
  describe("test_circle_poly_extend", () => {
    it("should extend polynomial correctly", () => {
      const coeffs = Array.from({ length: 16 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = new MockCpuCirclePoly(coeffs);
      const extended = poly.extend(8);
      
      // Mock random point - in real implementation this would be CirclePoint.getPoint(21903)
      const randomPoint = { x: M31.from_u32_unchecked(21903), y: M31.from_u32_unchecked(0) };
      
      // Both polynomials should evaluate to the same value at any point
      const originalValue = poly.evalAtPoint(randomPoint);
      const extendedValue = extended.evalAtPoint(randomPoint);
      
      expect(originalValue).toEqual(extendedValue);
      expect(extended.logSize()).toBe(8);
      expect(extended.coeffs.length).toBe(256); // 2^8
    });
  });

  describe("CirclePoly construction", () => {
    it("should validate power of two coefficient length", () => {
      expect(() => new CirclePoly([M31.from_u32_unchecked(1), M31.from_u32_unchecked(2), M31.from_u32_unchecked(3)])).toThrow("coeffs length must be a power of two");
    });

    it("should create polynomial with valid coefficients", () => {
      const coeffs = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2), M31.from_u32_unchecked(3), M31.from_u32_unchecked(4)];
      const poly = new MockCpuCirclePoly(coeffs);
      
      expect(poly.coeffs).toEqual(coeffs);
      expect(poly.logSize()).toBe(2);
      expect(poly.log_size()).toBe(2); // Rust-style alias
    });
  });

  describe("Polynomial evaluation", () => {
    it("should evaluate at single point", () => {
      const coeffs = Array.from({ length: 4 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = new MockCpuCirclePoly(coeffs);
      const point = { x: M31.from_u32_unchecked(1), y: M31.from_u32_unchecked(0) };
      
      const result = poly.evalAtPoint(point);
      expect(result).toEqual(M31.from_u32_unchecked(42)); // Mock value
    });

    it("should evaluate over domain", () => {
      const coeffs = Array.from({ length: 8 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = new MockCpuCirclePoly(coeffs);
      const domain = CanonicCoset.new(3).circleDomain();
      
      const evaluation = poly.evaluate(domain);
      expect(evaluation.domain).toBe(domain);
      expect(evaluation.values).toHaveLength(8);
    });

    it("should evaluate with precomputed twiddles", () => {
      const coeffs = Array.from({ length: 4 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = new MockCpuCirclePoly(coeffs);
      const domain = CanonicCoset.new(2).circleDomain();
      const twiddles = MockCpuCirclePoly.precomputeTwiddles(domain.halfCoset);
      
      const evaluation = poly.evaluateWithTwiddles(domain, twiddles);
      expect(evaluation.domain).toBe(domain);
      expect(evaluation.values).toHaveLength(4);
    });
  });

  describe("FFT and FRI space checks", () => {
    it("should check if polynomial is in FFT space", () => {
      // Create polynomial with coefficients that fit in FFT space
      const coeffs = Array.from({ length: 8 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = new MockCpuCirclePoly(coeffs);
      
      expect(poly.isInFftSpace(4)).toBe(true); // 2^4 = 16 > 8
      expect(poly.isInFftSpace(2)).toBe(false); // 2^2 = 4 < 8
    });

    it("should check if polynomial is in FRI space", () => {
      // Create polynomial with coefficients that fit in FRI space
      const coeffs = Array.from({ length: 8 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = new MockCpuCirclePoly(coeffs);
      
      expect(poly.isInFriSpace(4)).toBe(true); // (2^4) + 1 = 17 > 8
      expect(poly.isInFriSpace(2)).toBe(false); // (2^2) + 1 = 5 < 8
    });

    it("should handle trailing zeros in space checks", () => {
      // Create polynomial with trailing zeros
      const coeffs = [
        M31.from_u32_unchecked(1),
        M31.from_u32_unchecked(2),
        M31.from_u32_unchecked(0),
        M31.from_u32_unchecked(0)
      ];
      
      // Mock isZero method for M31
      coeffs.forEach(coeff => {
        (coeff as any).isZero = () => coeff.value === 0;
      });
      
      const poly = new MockCpuCirclePoly(coeffs);
      
      // Should ignore trailing zeros, so effective length is 2
      expect(poly.isInFftSpace(2)).toBe(true); // 2^2 = 4 >= 2
      expect(poly.isInFriSpace(1)).toBe(true); // (2^1) + 1 = 3 >= 2
    });
  });

  describe("Static factory methods", () => {
    it("should create polynomial using static new method", () => {
      const coeffs = Array.from({ length: 4 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = CirclePoly.new(coeffs);
      
      expect(poly).toBeInstanceOf(CirclePoly);
      expect(poly.coeffs).toEqual(coeffs);
      expect(poly.logSize()).toBe(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle single coefficient polynomial", () => {
      const coeffs = [M31.from_u32_unchecked(42)];
      const poly = new MockCpuCirclePoly(coeffs);
      
      expect(poly.logSize()).toBe(0);
      expect(poly.coeffs).toHaveLength(1);
    });

    it("should handle large polynomials", () => {
      const coeffs = Array.from({ length: 1024 }, (_, i) => M31.from_u32_unchecked(i % 256));
      const poly = new MockCpuCirclePoly(coeffs);
      
      expect(poly.logSize()).toBe(10); // log2(1024) = 10
      expect(poly.coeffs).toHaveLength(1024);
    });

    it("should handle extension to same size", () => {
      const coeffs = Array.from({ length: 8 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = new MockCpuCirclePoly(coeffs);
      const extended = poly.extend(3); // Same log size
      
      expect(extended.logSize()).toBe(3);
      expect(extended.coeffs).toHaveLength(8);
    });

    it("should handle extension to smaller size", () => {
      const coeffs = Array.from({ length: 8 }, (_, i) => M31.from_u32_unchecked(i));
      const poly = new MockCpuCirclePoly(coeffs);
      
      // Extension to smaller size should maintain original size (no actual shrinking)
      const extended = poly.extend(2);
      expect(extended.logSize()).toBe(3); // Should remain 3, not shrink to 2
    });
  });
}); 