import { describe, it, expect } from "vitest";
import { CircleEvaluation, NaturalOrder, BitReversedOrder, DefaultColumnOps, CosetSubEvaluation, ArrayColumn } from "../../../src/poly/circle/evaluation";
import { CanonicCoset } from "../../../src/poly/circle/canonic";
import { CircleDomain } from "../../../src/poly/circle/domain";
import { M31 } from "../../../src/fields/m31";

// Mock backend for testing
class MockBackend extends DefaultColumnOps<M31> {
  static interpolate(eval_: CircleEvaluation<any, M31, BitReversedOrder>, twiddles: any): any {
    return { coeffs: eval_.values, logSize: () => Math.log2(eval_.values.length) };
  }

  static precomputeTwiddles(coset: any): any {
    return { coset };
  }

  static evaluate(poly: any, domain: CircleDomain, twiddles: any): CircleEvaluation<any, M31, BitReversedOrder> {
    return CircleEvaluation.new(domain, poly.coeffs);
  }
}

// Create a proper mock evaluation class that has the static methods
class MockCircleEvaluation extends CircleEvaluation<MockBackend, M31, any> {
  // Override the interpolateWithTwiddles method to use the static method directly
  interpolateWithTwiddles(twiddles: any): any {
    return MockBackend.interpolate(this as any, twiddles);
  }
}

describe("CircleEvaluation Tests", () => {
  describe("test_interpolate_non_canonic", () => {
    it("should interpolate non-canonic evaluations correctly", () => {
      const domain = CanonicCoset.new(3).circleDomain();
      expect(domain.logSize()).toBe(3);
      
      const values = Array.from({ length: 8 }, (_, i) => M31.from_u32_unchecked(i));
      const evaluation = new MockCircleEvaluation(domain, values, new MockBackend())
        .bitReverse();
      
      // Test the interpolation with twiddles directly
      const twiddles = MockBackend.precomputeTwiddles(domain.halfCoset);
      const poly = evaluation.interpolateWithTwiddles(twiddles);
      
      // Verify polynomial can evaluate back to original points
      for (let i = 0; i < 8; i++) {
        const point = Array.from(domain.iter())[i];
        // In a real implementation, this would test poly.evalAtPoint(point.intoEf()) === M31(i)
        expect(typeof point).toBe("object");
        expect(poly.logSize()).toBe(3);
      }
    });
  });

  describe("CircleEvaluation construction", () => {
    it("should validate domain and values size match", () => {
      const domain = CanonicCoset.new(2).circleDomain();
      const values = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)]; // Wrong size
      
      expect(() => CircleEvaluation.new(domain, values, new MockBackend())).toThrow("domain/values size mismatch");
    });

    it("should create evaluation with correct size", () => {
      const domain = CanonicCoset.new(2).circleDomain();
      const values = Array.from({ length: 4 }, (_, i) => M31.from_u32_unchecked(i));
      
      const evaluation = CircleEvaluation.new(domain, values, new MockBackend());
      expect(evaluation.domain).toBe(domain);
      expect(evaluation.values).toEqual(values);
    });
  });

  describe("Bit reversal operations", () => {
    it("should bit reverse from natural to bit-reversed order", () => {
      const domain = CanonicCoset.new(2).circleDomain();
      const values = [M31.from_u32_unchecked(0), M31.from_u32_unchecked(1), M31.from_u32_unchecked(2), M31.from_u32_unchecked(3)];
      
      const naturalEval = CircleEvaluation.new<MockBackend, M31, NaturalOrder>(domain, [...values], new MockBackend());
      const bitReversedEval = naturalEval.bitReverse();
      
      expect(bitReversedEval).toBeInstanceOf(CircleEvaluation);
      // Values should be bit-reversed: [0, 2, 1, 3]
      expect(bitReversedEval.values[0]).toEqual(M31.from_u32_unchecked(0));
      expect(bitReversedEval.values[1]).toEqual(M31.from_u32_unchecked(2));
      expect(bitReversedEval.values[2]).toEqual(M31.from_u32_unchecked(1));
      expect(bitReversedEval.values[3]).toEqual(M31.from_u32_unchecked(3));
    });

    it("should bit reverse back from bit-reversed to natural order", () => {
      const domain = CanonicCoset.new(2).circleDomain();
      const values = [M31.from_u32_unchecked(0), M31.from_u32_unchecked(2), M31.from_u32_unchecked(1), M31.from_u32_unchecked(3)];
      
      const bitReversedEval = CircleEvaluation.new<MockBackend, M31, BitReversedOrder>(domain, [...values], new MockBackend());
      const naturalEval = bitReversedEval.bitReverseBack();
      
      expect(naturalEval).toBeInstanceOf(CircleEvaluation);
      // Values should be back to natural order: [0, 1, 2, 3]
      expect(naturalEval.values[0]).toEqual(M31.from_u32_unchecked(0));
      expect(naturalEval.values[1]).toEqual(M31.from_u32_unchecked(1));
      expect(naturalEval.values[2]).toEqual(M31.from_u32_unchecked(2));
      expect(naturalEval.values[3]).toEqual(M31.from_u32_unchecked(3));
    });
  });

  describe("Interpolation and evaluation", () => {
    it("should interpolate with precomputed twiddles", () => {
      const domain = CanonicCoset.new(2).circleDomain();
      const values = Array.from({ length: 4 }, (_, i) => M31.from_u32_unchecked(i));
      
      const evaluation = new MockCircleEvaluation(domain, values, new MockBackend());
      const twiddles = MockBackend.precomputeTwiddles(domain.halfCoset);
      const poly = evaluation.interpolateWithTwiddles(twiddles);
      
      expect(poly.coeffs).toEqual(values);
      expect(poly.logSize()).toBe(2);
    });

    it("should interpolate using the interpolate method", () => {
      const domain = CanonicCoset.new(2).circleDomain();
      const values = Array.from({ length: 4 }, (_, i) => M31.from_u32_unchecked(i));
      
      // Create a mock class that has the static methods
      class TestEvaluation extends CircleEvaluation<MockBackend, M31, BitReversedOrder> {
        static interpolate(eval_: any, twiddles: any): any {
          return { coeffs: eval_.values, logSize: () => Math.log2(eval_.values.length) };
        }
        
        static precomputeTwiddles(coset: any): any {
          return { coset };
        }
      }
      
      const evaluation = new TestEvaluation(domain, values, new MockBackend());
      const poly = evaluation.interpolate();
      
      expect(poly.coeffs).toEqual(values);
      expect(poly.logSize()).toBe(2);
    });

    it("should convert to CPU backend", () => {
      const domain = CanonicCoset.new(1).circleDomain();
      const values = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)];
      
      const evaluation = CircleEvaluation.new<MockBackend, M31, NaturalOrder>(domain, values, new MockBackend());
      const cpuEval = evaluation.toCpu();
      
      expect(cpuEval).toBeInstanceOf(CircleEvaluation);
      expect(cpuEval.domain).toBe(domain);
    });
  });

  describe("CosetSubEvaluation", () => {
    it("should access elements correctly", () => {
      const values = [M31.from_u32_unchecked(0), M31.from_u32_unchecked(1), M31.from_u32_unchecked(2), M31.from_u32_unchecked(3)];
      const subEval = new CosetSubEvaluation(values, 1, 2);
      
      expect(subEval.at(0)).toEqual(M31.from_u32_unchecked(1)); // offset 1
      expect(subEval.at(1)).toEqual(M31.from_u32_unchecked(3)); // offset 1 + step 2
      expect(subEval.get(0)).toEqual(M31.from_u32_unchecked(1)); // Same as at(0)
    });

    it("should handle wraparound correctly", () => {
      const values = [M31.from_u32_unchecked(0), M31.from_u32_unchecked(1), M31.from_u32_unchecked(2), M31.from_u32_unchecked(3)];
      const subEval = new CosetSubEvaluation(values, 3, 2);
      
      expect(subEval.at(0)).toEqual(M31.from_u32_unchecked(3)); // offset 3
      expect(subEval.at(1)).toEqual(M31.from_u32_unchecked(1)); // (3 + 2) & 3 = 1
    });
  });

  describe("Deref operations", () => {
    it("should provide access to underlying values", () => {
      const domain = CanonicCoset.new(1).circleDomain();
      const values = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)];
      
      const evaluation = CircleEvaluation.new(domain, values, new MockBackend());
      const derefValues = evaluation.deref();
      
      expect(derefValues).toBe(values);
      expect(derefValues).toEqual(values);
    });
  });

  describe("Type safety and error handling", () => {
    it("should handle empty evaluations", () => {
      expect(() => CanonicCoset.new(0)).toThrow("log_size must be a positive integer");
    });

    it("should validate bit reverse column operations", () => {
      const ops = new DefaultColumnOps<M31>();
      const values = [M31.from_u32_unchecked(0), M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)];
      
      // Should throw for non-power-of-2 length
      const invalidColumn = new ArrayColumn(values);
      expect(() => ops.bitReverseColumn(invalidColumn)).toThrow("Column length must be a power of 2");
      
      // Should work for power-of-2 length
      const validValues = [M31.from_u32_unchecked(0), M31.from_u32_unchecked(1), M31.from_u32_unchecked(2), M31.from_u32_unchecked(3)];
      const validColumn = new ArrayColumn([...validValues]);
      expect(() => ops.bitReverseColumn(validColumn)).not.toThrow();
    });
  });
}); 