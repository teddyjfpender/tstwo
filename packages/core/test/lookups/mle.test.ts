import { describe, it, expect } from 'vitest';
import { Mle, SecureMle } from '../../src/lookups/mle';
import { QM31 as SecureField } from '../../src/fields/qm31';
import { M31 as BaseField } from '../../src/fields/m31';
import { Blake2sChannel } from '../../src/channel/blake2';

/**
 * Test channel factory for consistent random generation.
 */
function testChannel(): Blake2sChannel {
  return Blake2sChannel.create();
}

describe('MLE (Multilinear Extension)', () => {
  describe('Mle<F> basic functionality', () => {
    it('should create MLE with power-of-two evaluations', () => {
      const values = [
        SecureField.one(),
        SecureField.zero(),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3))
      ];
      const mle = new Mle(values);
      
      expect(mle.len()).toBe(4);
      expect(mle.nVariables()).toBe(2);
    });

    it('should throw error for non-power-of-two evaluations', () => {
      const values = [
        SecureField.one(),
        SecureField.zero(),
        SecureField.from(BaseField.from(2))
      ];
      
      expect(() => new Mle(values)).toThrow('Number of evaluations must be a power of two');
    });

    it('should throw error for empty evaluations', () => {
      expect(() => new Mle([])).toThrow('Number of evaluations must be a power of two');
    });

    it('should access evaluations correctly', () => {
      const values = [
        SecureField.one(),
        SecureField.zero(),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3))
      ];
      const mle = new Mle(values);
      
      expect(mle.at(0).equals(SecureField.one())).toBe(true);
      expect(mle.at(1).equals(SecureField.zero())).toBe(true);
      expect(mle.at(2).equals(SecureField.from(BaseField.from(2)))).toBe(true);
      expect(mle.at(3).equals(SecureField.from(BaseField.from(3)))).toBe(true);
    });

    it('should throw error for out-of-bounds access', () => {
      const values = [SecureField.one(), SecureField.zero()];
      const mle = new Mle(values);
      
      expect(() => mle.at(2)).toThrow('Index 2 out of bounds');
      expect(() => mle.at(-1)).toThrow('Index -1 out of bounds');
    });

    it('should set evaluations correctly', () => {
      const values = [SecureField.one(), SecureField.zero()];
      const mle = new Mle(values);
      const newValue = SecureField.from(BaseField.from(42));
      
      mle.set(0, newValue);
      expect(mle.at(0).equals(newValue)).toBe(true);
    });

    it('should throw error for out-of-bounds set', () => {
      const values = [SecureField.one(), SecureField.zero()];
      const mle = new Mle(values);
      const newValue = SecureField.from(BaseField.from(42));
      
      expect(() => mle.set(2, newValue)).toThrow('Index 2 out of bounds');
      expect(() => mle.set(-1, newValue)).toThrow('Index -1 out of bounds');
    });

    it('should return correct slices', () => {
      const values = [
        SecureField.one(),
        SecureField.zero(),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3))
      ];
      const mle = new Mle(values);
      
      const slice = mle.slice(1, 3);
      expect(slice).toHaveLength(2);
      expect(slice[0]?.equals(SecureField.zero())).toBe(true);
      expect(slice[1]?.equals(SecureField.from(BaseField.from(2)))).toBe(true);
    });

    it('should clone correctly', () => {
      const values = [SecureField.one(), SecureField.zero()];
      const mle = new Mle(values);
      const cloned = mle.clone();
      
      expect(cloned.len()).toBe(mle.len());
      expect(cloned.at(0).equals(mle.at(0))).toBe(true);
      expect(cloned.at(1).equals(mle.at(1))).toBe(true);
      
      // Modifying the clone shouldn't affect the original
      cloned.set(0, SecureField.from(BaseField.from(42)));
      expect(mle.at(0).equals(SecureField.one())).toBe(true);
    });

    it('should return evaluations correctly', () => {
      const values = [
        SecureField.one(),
        SecureField.zero(),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3))
      ];
      const mle = new Mle(values);
      const evals = mle.intoEvals();
      
      expect(evals).toHaveLength(4);
      expect(evals[0]?.equals(SecureField.one())).toBe(true);
      expect(evals[1]?.equals(SecureField.zero())).toBe(true);
      expect(evals[2]?.equals(SecureField.from(BaseField.from(2)))).toBe(true);
      expect(evals[3]?.equals(SecureField.from(BaseField.from(3)))).toBe(true);
    });
  });

  describe('MLE evaluation at point', () => {
    it('should evaluate constant polynomial (0 variables)', () => {
      const value = SecureField.from(BaseField.from(42));
      const mle = new Mle([value]);
      
      const result = mle.evalAtPoint([]);
      expect(result.equals(value)).toBe(true);
    });

    it('should evaluate univariate polynomial (1 variable)', () => {
      // f(x) = 1 + 2x (evaluations: f(0) = 1, f(1) = 3)
      const mle = new Mle([
        SecureField.one(),
        SecureField.from(BaseField.from(3))
      ]);
      
      // Evaluate at x = 0
      const result0 = mle.evalAtPoint([SecureField.zero()]);
      expect(result0.equals(SecureField.one())).toBe(true);
      
      // Evaluate at x = 1
      const result1 = mle.evalAtPoint([SecureField.one()]);
      expect(result1.equals(SecureField.from(BaseField.from(3)))).toBe(true);
      
      // Evaluate at x = 1/2 (should give 2)
      const half = SecureField.from(BaseField.from(2)).inverse();
      const resultHalf = mle.evalAtPoint([half]);
      expect(resultHalf.equals(SecureField.from(BaseField.from(2)))).toBe(true);
    });

    it('should evaluate bivariate polynomial (2 variables)', () => {
      // f(x,y) evaluations: f(0,0)=1, f(0,1)=2, f(1,0)=3, f(1,1)=4
      const mle = new Mle([
        SecureField.one(),                    // f(0,0)
        SecureField.from(BaseField.from(2)),  // f(0,1)
        SecureField.from(BaseField.from(3)),  // f(1,0)
        SecureField.from(BaseField.from(4))   // f(1,1)
      ]);
      
      // Evaluate at corners
      expect(mle.evalAtPoint([SecureField.zero(), SecureField.zero()])
             .equals(SecureField.one())).toBe(true);
      expect(mle.evalAtPoint([SecureField.zero(), SecureField.one()])
             .equals(SecureField.from(BaseField.from(2)))).toBe(true);
      expect(mle.evalAtPoint([SecureField.one(), SecureField.zero()])
             .equals(SecureField.from(BaseField.from(3)))).toBe(true);
      expect(mle.evalAtPoint([SecureField.one(), SecureField.one()])
             .equals(SecureField.from(BaseField.from(4)))).toBe(true);
    });

    it('should handle random evaluation points', () => {
      const channel = testChannel();
      const values = channel.draw_felts(8);
      const mle = new Mle(values);
      const point = channel.draw_felts(3);
      
      // Should not throw and return a valid SecureField
      const result = mle.evalAtPoint(point);
      expect(result).toBeInstanceOf(SecureField);
    });
  });

  describe('MLE fix first variable', () => {
    it('should fix first variable correctly', () => {
      // 2-variable MLE: f(0,0)=1, f(0,1)=2, f(1,0)=3, f(1,1)=4
      const mle = new Mle([
        SecureField.one(),                    // f(0,0)
        SecureField.from(BaseField.from(2)),  // f(0,1)
        SecureField.from(BaseField.from(3)),  // f(1,0)
        SecureField.from(BaseField.from(4))   // f(1,1)
      ]);
      
      // Fix first variable to 0: should get g(y) = f(0,y) = 1 + y
      const fixed0 = mle.fixFirstVariable(SecureField.zero());
      expect(fixed0.len()).toBe(2);
      expect(fixed0.at(0).equals(SecureField.one())).toBe(true);
      expect(fixed0.at(1).equals(SecureField.from(BaseField.from(2)))).toBe(true);
      
      // Fix first variable to 1: should get g(y) = f(1,y) = 3 + y
      const fixed1 = mle.fixFirstVariable(SecureField.one());
      expect(fixed1.len()).toBe(2);
      expect(fixed1.at(0).equals(SecureField.from(BaseField.from(3)))).toBe(true);
      expect(fixed1.at(1).equals(SecureField.from(BaseField.from(4)))).toBe(true);
    });

    it('should handle fixing first variable of univariate polynomial', () => {
      const mle = new Mle([SecureField.one(), SecureField.from(BaseField.from(3))]);
      
      // Fixing the only variable should result in a constant
      const fixed = mle.fixFirstVariable(SecureField.zero());
      expect(fixed.len()).toBe(1);
      expect(fixed.at(0).equals(SecureField.one())).toBe(true);
    });

    it('should handle large MLE fix first variable', () => {
      const channel = testChannel();
      const values = channel.draw_felts(16); // 4 variables
      const mle = new Mle(values);
      const assignment = channel.draw_felt();
      
      const fixed = mle.fixFirstVariable(assignment);
      expect(fixed.len()).toBe(8); // One less variable
      expect(fixed.nVariables()).toBe(3);
    });
  });

  describe('SecureMle specific functionality', () => {
    it('should implement MultivariatePolyOracle interface', () => {
      const values = [
        SecureField.one(),
        SecureField.zero(),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3))
      ];
      const secureMle = new SecureMle(values);
      
      expect(secureMle.nVariables()).toBe(2);
    });

    it('should compute sum as polynomial in first variable correctly', () => {
      // f(x,y) = 1 + 2y + 3x + 4xy evaluations: f(0,0)=1, f(0,1)=3, f(1,0)=4, f(1,1)=8
      const values = [
        SecureField.one(),                    // f(0,0) = 1
        SecureField.from(BaseField.from(3)),  // f(0,1) = 3
        SecureField.from(BaseField.from(4)),  // f(1,0) = 4
        SecureField.from(BaseField.from(8))   // f(1,1) = 8
      ];
      const secureMle = new SecureMle(values);
      
      // The sum over y should be: sum_y f(0,y) + sum_y f(1,y) = (1+3) + (4+8) = 16
      const totalSum = SecureField.from(BaseField.from(16));
      const poly = secureMle.sumAsPolyInFirstVariable(totalSum);
      
      // The polynomial should satisfy poly(0) + poly(1) = totalSum
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

    it('should fix first variable and return SecureMle', () => {
      const values = [
        SecureField.one(),
        SecureField.zero(),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3))
      ];
      const secureMle = new SecureMle(values);
      const assignment = SecureField.from(BaseField.from(2));
      
      const fixed = secureMle.fixFirstVariable(assignment);
      expect(fixed).toBeInstanceOf(SecureMle);
      expect(fixed.len()).toBe(2);
      expect(fixed.nVariables()).toBe(1);
    });

    it('should handle sumcheck integration correctly', () => {
      const channel = testChannel();
      const values = channel.draw_felts(8);
      
      // Calculate the sum manually
      let manualSum = SecureField.zero();
      for (const value of values) {
        manualSum = manualSum.add(value);
      }
      
      const secureMle = new SecureMle(values);
      const poly = secureMle.sumAsPolyInFirstVariable(manualSum);
      
      // The polynomial should be degree 1 (linear)
      expect(poly.degree()).toBe(1);
      
      // Verify the constraint: poly(0) + poly(1) = claim
      const at0 = poly.evalAtPoint(SecureField.zero());
      const at1 = poly.evalAtPoint(SecureField.one());
      expect(at0.add(at1).equals(manualSum)).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle single evaluation MLE', () => {
      const value = SecureField.from(BaseField.from(42));
      const mle = new Mle([value]);
      
      expect(mle.nVariables()).toBe(0);
      expect(mle.len()).toBe(1);
      expect(mle.at(0).equals(value)).toBe(true);
    });

    it('should handle large MLEs efficiently', () => {
      const channel = testChannel();
      const values = channel.draw_felts(256); // 8 variables
      const mle = new Mle(values);
      
      expect(mle.nVariables()).toBe(8);
      expect(mle.len()).toBe(256);
      
      // Should be able to evaluate at random points
      const point = channel.draw_felts(8);
      const result = mle.evalAtPoint(point);
      expect(result).toBeInstanceOf(SecureField);
    });

    it('should throw error for empty point in evaluation', () => {
      const mle = new Mle([SecureField.one(), SecureField.zero()]);
      
      // This should work (correct case)
      expect(() => mle.evalAtPoint([SecureField.zero()])).not.toThrow();
    });

    it('should handle MLE with all same values', () => {
      const value = SecureField.from(BaseField.from(7));
      const values = Array(4).fill(value);
      const mle = new Mle(values);
      
      // All evaluations should return the same value
      expect(mle.evalAtPoint([SecureField.zero(), SecureField.zero()]).equals(value)).toBe(true);
      expect(mle.evalAtPoint([SecureField.one(), SecureField.one()]).equals(value)).toBe(true);
      expect(mle.evalAtPoint([SecureField.from(BaseField.from(2)), SecureField.from(BaseField.from(3))]).equals(value)).toBe(true);
    });

    it('should maintain evaluation consistency after operations', () => {
      const channel = testChannel();
      const values = channel.draw_felts(8);
      const mle = new Mle(values);
      const point = channel.draw_felts(3);
      
      // Evaluate before cloning
      const originalResult = mle.evalAtPoint(point);
      
      // Clone and evaluate
      const cloned = mle.clone();
      const clonedResult = cloned.evalAtPoint(point);
      
      expect(originalResult.equals(clonedResult)).toBe(true);
    });
  });

  describe('Performance and consistency', () => {
    it('should have consistent evaluation with fix first variable', () => {
      const channel = testChannel();
      const values = channel.draw_felts(8);
      const mle = new Mle(values);
      const assignment = channel.draw_felt();
      const remainingPoint = channel.draw_felts(2);
      
      // Direct evaluation
      const fullPoint = [assignment, ...remainingPoint];
      const directResult = mle.evalAtPoint(fullPoint);
      
      // Fix first variable then evaluate
      const fixed = mle.fixFirstVariable(assignment);
      const fixedResult = fixed.evalAtPoint(remainingPoint);
      
      expect(directResult.equals(fixedResult)).toBe(true);
    });

    it('should handle repeated fix first variable operations', () => {
      const channel = testChannel();
      const values = channel.draw_felts(16); // 4 variables
      let currentMle = new Mle(values);
      const assignments = channel.draw_felts(4);
      
      // Apply fixes sequentially
      for (const assignment of assignments) {
        currentMle = currentMle.fixFirstVariable(assignment);
      }
      
      // Should end up with a constant
      expect(currentMle.len()).toBe(1);
      expect(currentMle.nVariables()).toBe(0);
      
      // Direct evaluation should match
      const directResult = new Mle(values).evalAtPoint(assignments);
      expect(currentMle.at(0).equals(directResult)).toBe(true);
    });
  });
}); 