import { describe, it, expect } from "vitest";
import { SecureCirclePoly, SecureEvaluation } from "../../../src/poly/circle/secure_poly";
import { CirclePoly } from "../../../src/poly/circle/poly";
import { CanonicCoset } from "../../../src/poly/circle/canonic";
import { CircleDomain } from "../../../src/poly/circle/domain";
import { DefaultColumnOps } from "../../../src/poly/circle/evaluation";
import { M31 } from "../../../src/fields/m31";
import { QM31 } from "../../../src/fields/qm31";

// Mock backend for testing
class MockBackend extends DefaultColumnOps<M31> {
  static precomputeTwiddles(coset: any): any {
    return { coset };
  }
}

describe("SecureCirclePoly Tests", () => {
  describe("SecureCirclePoly construction and basic operations", () => {
    it("should create SecureCirclePoly from coordinate polynomials", () => {
      const coeffs1 = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)];
      const coeffs2 = [M31.from_u32_unchecked(3), M31.from_u32_unchecked(4)];
      const coeffs3 = [M31.from_u32_unchecked(5), M31.from_u32_unchecked(6)];
      const coeffs4 = [M31.from_u32_unchecked(7), M31.from_u32_unchecked(8)];
      
      const poly1 = CirclePoly.new(coeffs1);
      const poly2 = CirclePoly.new(coeffs2);
      const poly3 = CirclePoly.new(coeffs3);
      const poly4 = CirclePoly.new(coeffs4);
      
      const securePoly = new SecureCirclePoly([poly1, poly2, poly3, poly4]);
      
      expect(securePoly.polys).toHaveLength(4);
      expect(securePoly.polys[0]).toBe(poly1);
      expect(securePoly.polys[1]).toBe(poly2);
      expect(securePoly.polys[2]).toBe(poly3);
      expect(securePoly.polys[3]).toBe(poly4);
    });

    it("should calculate log size correctly", () => {
      const coeffs = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2), M31.from_u32_unchecked(3), M31.from_u32_unchecked(4)];
      const polys = Array.from({ length: 4 }, () => CirclePoly.new(coeffs));
      const securePoly = new SecureCirclePoly(polys as [CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>]);
      
      expect(securePoly.logSize()).toBe(2); // log2(4) = 2
    });

    it("should provide access to coordinate polynomials", () => {
      const coeffs = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)];
      const polys = Array.from({ length: 4 }, () => CirclePoly.new(coeffs));
      const securePoly = new SecureCirclePoly(polys as [CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>]);
      
      const coordPolys = securePoly.intoCoordinatePolys();
      expect(coordPolys).toHaveLength(4);
      coordPolys.forEach((poly, i) => {
        expect(poly).toBe(polys[i]);
      });
    });
  });

  describe("SecureCirclePoly evaluation", () => {
    it("should have evaluation methods defined", () => {
      const coeffs = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)];
      const polys = Array.from({ length: 4 }, () => CirclePoly.new(coeffs));
      const securePoly = new SecureCirclePoly(polys as [CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>]);
      
      // Test that the methods exist
      expect(typeof securePoly.evalAtPoint).toBe('function');
      expect(typeof securePoly.evalColumnsAtPoint).toBe('function');
      expect(typeof securePoly.evaluateWithTwiddles).toBe('function');
    });

    it("should access coordinate polynomials", () => {
      const coeffs = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)];
      const polys = Array.from({ length: 4 }, (_, i) => CirclePoly.new([M31.from_u32_unchecked(i + 1), M31.from_u32_unchecked(i + 2)]));
      const securePoly = new SecureCirclePoly(polys as [CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>]);
      
      // Test that we can access the coordinate polynomials
      expect(securePoly.polys).toHaveLength(4);
      securePoly.polys.forEach((poly, i) => {
        expect(poly).toBe(polys[i]);
      });
    });

    it("should have consistent log size across polynomials", () => {
      const domain = CanonicCoset.new(1).circleDomain();
      const coeffs = [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)];
      const polys = Array.from({ length: 4 }, () => CirclePoly.new(coeffs));
      const securePoly = new SecureCirclePoly(polys as [CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>, CirclePoly<MockBackend>]);
      
      // Test that all polynomials have the same log size
      const logSize = securePoly.logSize();
      securePoly.polys.forEach(poly => {
        expect(poly.logSize()).toBe(logSize);
      });
    });
  });

  describe("SecureEvaluation", () => {
    it("should create SecureEvaluation with domain and values", () => {
      const domain = CanonicCoset.new(1).circleDomain();
      const values = {
        columns: [
          [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)],
          [M31.from_u32_unchecked(3), M31.from_u32_unchecked(4)],
          [M31.from_u32_unchecked(5), M31.from_u32_unchecked(6)],
          [M31.from_u32_unchecked(7), M31.from_u32_unchecked(8)]
        ],
        len: () => 2
      };
      
      const evaluation = new SecureEvaluation(domain, values);
      
      expect(evaluation.domain).toBe(domain);
      expect(evaluation.values).toBe(values);
    });

    it("should validate domain and values size match", () => {
      const domain = CanonicCoset.new(2).circleDomain(); // Size 4
      const values = {
        columns: [
          [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)], // Size 2 - mismatch
          [M31.from_u32_unchecked(3), M31.from_u32_unchecked(4)],
          [M31.from_u32_unchecked(5), M31.from_u32_unchecked(6)],
          [M31.from_u32_unchecked(7), M31.from_u32_unchecked(8)]
        ],
        len: () => 2
      };
      
      expect(() => new SecureEvaluation(domain, values)).toThrow("size mismatch");
    });

    it("should convert to coordinate evaluations", () => {
      const domain = CanonicCoset.new(1).circleDomain();
      const values = {
        columns: [
          [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)],
          [M31.from_u32_unchecked(3), M31.from_u32_unchecked(4)],
          [M31.from_u32_unchecked(5), M31.from_u32_unchecked(6)],
          [M31.from_u32_unchecked(7), M31.from_u32_unchecked(8)]
        ],
        len: () => 2
      };
      
      const evaluation = new SecureEvaluation(domain, values);
      const coordEvals = evaluation.intoCoordinateEvals();
      
      expect(coordEvals).toHaveLength(4);
      coordEvals.forEach((evaluation, i) => {
        expect(evaluation.domain).toBe(domain);
        expect(evaluation.values).toBe(values.columns[i]);
      });
    });

    it("should convert to CPU backend", () => {
      const domain = CanonicCoset.new(1).circleDomain();
      const values = {
        columns: [
          [M31.from_u32_unchecked(1), M31.from_u32_unchecked(2)],
          [M31.from_u32_unchecked(3), M31.from_u32_unchecked(4)],
          [M31.from_u32_unchecked(5), M31.from_u32_unchecked(6)],
          [M31.from_u32_unchecked(7), M31.from_u32_unchecked(8)]
        ],
        len: () => 2,
        to_cpu: function() { return this; }
      };
      
      const evaluation = new SecureEvaluation(domain, values);
      const cpuEval = evaluation.toCpu();
      
      expect(cpuEval).toBeInstanceOf(SecureEvaluation);
      expect(cpuEval.domain).toBe(domain);
    });
  });

  describe("Type safety and error handling", () => {
    it("should handle empty coefficient arrays", () => {
      expect(() => CirclePoly.new([])).toThrow("coeffs length must be a power of two");
    });
  });
}); 