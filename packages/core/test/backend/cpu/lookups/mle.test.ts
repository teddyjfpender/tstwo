import { describe, it, expect } from 'vitest';
import { M31 as BaseField } from '../../../../src/fields/m31';
import { QM31 as SecureField } from '../../../../src/fields/qm31';
import { Mle } from '../../../../src/lookups/mle';
import { UnivariatePoly, foldMleEvals } from '../../../../src/lookups/utils';
import {
  CpuMleOpsBaseField,
  CpuMleOpsSecureField,
  CpuMleMultivariatePolyOracle,
  CpuMleOps
} from '../../../../src/backend/cpu/lookups/mle';

describe('CPU Backend MLE Operations', () => {
  describe('CpuMleOpsBaseField', () => {
    it('should fix first variable for BaseField MLE', () => {
      // Create a 2-variable MLE with BaseField evaluations
      const baseEvals = [
        BaseField.from(1), // f(0,0)
        BaseField.from(2), // f(0,1)
        BaseField.from(3), // f(1,0)
        BaseField.from(4)  // f(1,1)
      ];
      const mle = new Mle(baseEvals);
      const assignment = SecureField.from(BaseField.from(2));

      const result = CpuMleOpsBaseField.fixFirstVariable(mle, assignment);

      expect(result).toBeInstanceOf(Mle);
      expect(result.len()).toBe(2);
      expect(result.nVariables()).toBe(1);

      // Verify the folding is correct using foldMleEvals
      const expected0 = foldMleEvals(assignment, baseEvals[0]!, baseEvals[2]!);
      const expected1 = foldMleEvals(assignment, baseEvals[1]!, baseEvals[3]!);

      expect(result.at(0).equals(expected0)).toBe(true);
      expect(result.at(1).equals(expected1)).toBe(true);
    });

    it('should handle single variable MLE', () => {
      const baseEvals = [BaseField.from(5), BaseField.from(7)];
      const mle = new Mle(baseEvals);
      const assignment = SecureField.from(BaseField.from(3));

      const result = CpuMleOpsBaseField.fixFirstVariable(mle, assignment);

      expect(result.len()).toBe(1);
      expect(result.nVariables()).toBe(0);

      const expected = foldMleEvals(assignment, baseEvals[0]!, baseEvals[1]!);
      expect(result.at(0).equals(expected)).toBe(true);
    });
  });

  describe('CpuMleOpsSecureField', () => {
    it('should fix first variable for SecureField MLE', () => {
      const secureEvals = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];
      const mle = new Mle(secureEvals);
      const assignment = SecureField.from(BaseField.from(2));

      const result = CpuMleOpsSecureField.fixFirstVariable(mle, assignment);

      expect(result).toBeInstanceOf(Mle);
      expect(result.len()).toBe(2);
      expect(result.nVariables()).toBe(1);

      // Verify the folding is correct
      const expected0 = foldMleEvals(assignment, secureEvals[0]!, secureEvals[2]!);
      const expected1 = foldMleEvals(assignment, secureEvals[1]!, secureEvals[3]!);

      expect(result.at(0).equals(expected0)).toBe(true);
      expect(result.at(1).equals(expected1)).toBe(true);
    });

    it('should handle zero assignment', () => {
      const secureEvals = [
        SecureField.from(BaseField.from(10)),
        SecureField.from(BaseField.from(20)),
        SecureField.from(BaseField.from(30)),
        SecureField.from(BaseField.from(40))
      ];
      const mle = new Mle(secureEvals);
      const assignment = SecureField.zero();

      const result = CpuMleOpsSecureField.fixFirstVariable(mle, assignment);

      // With zero assignment, should get the first half unchanged
      expect(result.at(0).equals(secureEvals[0]!)).toBe(true);
      expect(result.at(1).equals(secureEvals[1]!)).toBe(true);
    });

    it('should handle one assignment', () => {
      const secureEvals = [
        SecureField.from(BaseField.from(10)),
        SecureField.from(BaseField.from(20)),
        SecureField.from(BaseField.from(30)),
        SecureField.from(BaseField.from(40))
      ];
      const mle = new Mle(secureEvals);
      const assignment = SecureField.one();

      const result = CpuMleOpsSecureField.fixFirstVariable(mle, assignment);

      // With one assignment, should get the second half unchanged
      expect(result.at(0).equals(secureEvals[2]!)).toBe(true);
      expect(result.at(1).equals(secureEvals[3]!)).toBe(true);
    });
  });

  describe('CpuMleMultivariatePolyOracle', () => {
    it('should implement MultivariatePolyOracle interface', () => {
      const evals = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];
      const oracle = new CpuMleMultivariatePolyOracle(evals);

      expect(oracle.nVariables()).toBe(2);
    });

    it('should compute sum as polynomial in first variable', () => {
      const evals = [
        SecureField.from(BaseField.from(1)), // f(0,0)
        SecureField.from(BaseField.from(3)), // f(0,1)
        SecureField.from(BaseField.from(4)), // f(1,0)
        SecureField.from(BaseField.from(8))  // f(1,1)
      ];
      const oracle = new CpuMleMultivariatePolyOracle(evals);

      // Total sum should be 1 + 3 + 4 + 8 = 16
      const totalSum = SecureField.from(BaseField.from(16));
      const poly = oracle.sumAsPolyInFirstVariable(totalSum);

      // Verify the polynomial constraint
      const at0 = poly.evalAtPoint(SecureField.zero());
      const at1 = poly.evalAtPoint(SecureField.one());
      expect(at0.add(at1).equals(totalSum)).toBe(true);

      // poly(0) should equal sum of first half: 1 + 3 = 4
      const expectedAt0 = SecureField.from(BaseField.from(4));
      expect(at0.equals(expectedAt0)).toBe(true);

      // poly(1) should equal totalSum - poly(0) = 16 - 4 = 12
      const expectedAt1 = SecureField.from(BaseField.from(12));
      expect(at1.equals(expectedAt1)).toBe(true);
    });

    it('should fix first variable correctly', () => {
      const evals = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];
      const oracle = new CpuMleMultivariatePolyOracle(evals);
      const challenge = SecureField.from(BaseField.from(2));

      const fixed = oracle.fixFirstVariable(challenge);

      expect(fixed).toBeInstanceOf(CpuMleMultivariatePolyOracle);
      expect(fixed.len()).toBe(2);
      expect(fixed.nVariables()).toBe(1);

      // Verify the values are correctly folded
      const expected0 = foldMleEvals(challenge, evals[0]!, evals[2]!);
      const expected1 = foldMleEvals(challenge, evals[1]!, evals[3]!);

      expect(fixed.at(0).equals(expected0)).toBe(true);
      expect(fixed.at(1).equals(expected1)).toBe(true);
    });

    it('should handle single variable oracle', () => {
      const evals = [
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(7))
      ];
      const oracle = new CpuMleMultivariatePolyOracle(evals);

      expect(oracle.nVariables()).toBe(1);

      const totalSum = SecureField.from(BaseField.from(12));
      const poly = oracle.sumAsPolyInFirstVariable(totalSum);

      const at0 = poly.evalAtPoint(SecureField.zero());
      const at1 = poly.evalAtPoint(SecureField.one());

      expect(at0.equals(evals[0]!)).toBe(true);
      expect(at1.equals(evals[1]!)).toBe(true);
      expect(at0.add(at1).equals(totalSum)).toBe(true);
    });
  });

  describe('CpuMleOps unified interface', () => {
    it('should provide static methods for BaseField operations', () => {
      const baseEvals = [BaseField.from(1), BaseField.from(2), BaseField.from(3), BaseField.from(4)];
      const mle = new Mle(baseEvals);
      const assignment = SecureField.from(BaseField.from(2));

      const result = CpuMleOps.fixFirstVariableBaseField(mle, assignment);

      expect(result).toBeInstanceOf(Mle);
      expect(result.len()).toBe(2);
    });

    it('should provide static methods for SecureField operations', () => {
      const secureEvals = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];
      const mle = new Mle(secureEvals);
      const assignment = SecureField.from(BaseField.from(2));

      const result = CpuMleOps.fixFirstVariableSecureField(mle, assignment);

      expect(result).toBeInstanceOf(Mle);
      expect(result.len()).toBe(2);
    });

    it('should create MultivariatePolyOracle', () => {
      const evals = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];

      const oracle = CpuMleOps.createMultivariatePolyOracle(evals);

      expect(oracle).toBeInstanceOf(CpuMleMultivariatePolyOracle);
      expect(oracle.nVariables()).toBe(2);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty MLE correctly', () => {
      const evals = [SecureField.from(BaseField.from(42))];
      const mle = new Mle(evals);
      const assignment = SecureField.from(BaseField.from(5));

      // This should create a 0-variable MLE (constant)
      const result = CpuMleOpsSecureField.fixFirstVariable(mle, assignment);

      expect(result.len()).toBe(0);
      expect(result.nVariables()).toBe(0);
    });

    it('should handle power-of-two validation', () => {
      // The Mle constructor should validate power-of-two length
      expect(() => new Mle([SecureField.one(), SecureField.zero(), SecureField.one()])).toThrow();
    });
  });
}); 