import { describe, it, expect } from 'vitest';
import { M31 as BaseField } from '../../src/fields/m31';
import { QM31 as SecureField } from '../../src/fields/qm31';
import {
  UnivariatePoly,
  hornerEval,
  randomLinearCombination,
  eq,
  foldMleEvals,
  Fraction,
  Reciprocal,
  sumBaseFractions,
  sumSecureFractions
} from '../../src/lookups/utils';

describe('lookups/utils', () => {
  describe('UnivariatePoly', () => {
    describe('lagrange interpolation', () => {
      it('should work correctly', () => {
        const xs = [5, 1, 3, 9].map(BaseField.from);
        const ys = [1, 2, 3, 4].map(BaseField.from);

        const poly = UnivariatePoly.interpolateLagrange(xs, ys);

        for (let i = 0; i < xs.length; i++) {
          const x = xs[i]!;
          const y = ys[i]!;
          expect(poly.evalAtPoint(x).equals(y)).toBe(true);
        }
      });

      it('should handle single point', () => {
        const xs = [BaseField.from(5)];
        const ys = [BaseField.from(10)];

        const poly = UnivariatePoly.interpolateLagrange(xs, ys);

        expect(poly.evalAtPoint(BaseField.from(5)).equals(BaseField.from(10))).toBe(true);
        expect(poly.evalAtPoint(BaseField.from(3)).equals(BaseField.from(10))).toBe(true);
      });

      it('should throw for mismatched array lengths', () => {
        const xs = [BaseField.from(1), BaseField.from(2)];
        const ys = [BaseField.from(3)];

        expect(() => UnivariatePoly.interpolateLagrange(xs, ys)).toThrow('xs and ys must have the same length');
      });

      it('should throw for empty arrays', () => {
        expect(() => UnivariatePoly.interpolateLagrange([], [])).toThrow('Cannot interpolate with empty arrays');
      });
    });

    describe('polynomial operations', () => {
      it('should create polynomial from coefficients', () => {
        const coeffs = [BaseField.from(1), BaseField.from(2), BaseField.from(3)];
        const poly = UnivariatePoly.new(coeffs);

        expect(poly.length()).toBe(3);
        expect(poly.at(0)?.equals(BaseField.from(1))).toBe(true);
        expect(poly.at(1)?.equals(BaseField.from(2))).toBe(true);
        expect(poly.at(2)?.equals(BaseField.from(3))).toBe(true);
      });

      it('should compute degree correctly', () => {
        const poly1 = UnivariatePoly.new([BaseField.from(1), BaseField.from(2), BaseField.from(3)]);
        expect(poly1.degree()).toBe(2);

        const poly2 = UnivariatePoly.new([BaseField.from(5)]);
        expect(poly2.degree()).toBe(0);

        const zero = UnivariatePoly.zero(BaseField.from(1));
        expect(zero.degree()).toBe(0);
      });

      it('should handle zero polynomial', () => {
        const zero = UnivariatePoly.zero(BaseField.from(1));
        expect(zero.isZero()).toBe(true);
        expect(zero.length()).toBe(0);
        expect(zero.degree()).toBe(0);
      });

      it('should add polynomials correctly', () => {
        const poly1 = UnivariatePoly.new([BaseField.from(1), BaseField.from(2)]);
        const poly2 = UnivariatePoly.new([BaseField.from(3), BaseField.from(4)]);

        const sum = poly1.add(poly2);

        expect(sum.at(0)?.equals(BaseField.from(4))).toBe(true);
        expect(sum.at(1)?.equals(BaseField.from(6))).toBe(true);
      });

      it('should subtract polynomials correctly', () => {
        const poly1 = UnivariatePoly.new([BaseField.from(5), BaseField.from(7)]);
        const poly2 = UnivariatePoly.new([BaseField.from(2), BaseField.from(3)]);

        const diff = poly1.sub(poly2);

        expect(diff.at(0)?.equals(BaseField.from(3))).toBe(true);
        expect(diff.at(1)?.equals(BaseField.from(4))).toBe(true);
      });

      it('should negate polynomials correctly', () => {
        const poly = UnivariatePoly.new([BaseField.from(1), BaseField.from(2)]);
        const negated = poly.neg();

        expect(negated.at(0)?.equals(BaseField.from(-1))).toBe(true);
        expect(negated.at(1)?.equals(BaseField.from(-2))).toBe(true);
      });

      it('should multiply by scalar correctly', () => {
        const poly = UnivariatePoly.new([BaseField.from(1), BaseField.from(2)]);
        const scaled = poly.mulScalar(BaseField.from(3));

        expect(scaled.at(0)?.equals(BaseField.from(3))).toBe(true);
        expect(scaled.at(1)?.equals(BaseField.from(6))).toBe(true);
      });
    });

    describe('polynomial evaluation', () => {
      it('should evaluate at specific points', () => {
        // Polynomial: 2x^2 + 3x + 1
        const poly = UnivariatePoly.new([
          BaseField.from(1), 
          BaseField.from(3), 
          BaseField.from(2)
        ]);

        // At x = 0: 1
        expect(poly.evalAtPoint(BaseField.from(0)).equals(BaseField.from(1))).toBe(true);

        // At x = 1: 2 + 3 + 1 = 6
        expect(poly.evalAtPoint(BaseField.from(1)).equals(BaseField.from(6))).toBe(true);

        // At x = 2: 2*4 + 3*2 + 1 = 8 + 6 + 1 = 15
        expect(poly.evalAtPoint(BaseField.from(2)).equals(BaseField.from(15))).toBe(true);
      });

      it('should handle zero polynomial evaluation', () => {
        const zero = UnivariatePoly.zero(BaseField.from(1));
        expect(zero.evalAtPoint(BaseField.from(5)).equals(BaseField.from(0))).toBe(true);
      });
    });
  });

  describe('hornerEval', () => {
    it('should work correctly', () => {
      const coeffs = [BaseField.from(9), BaseField.from(2), BaseField.from(3)];
      const x = BaseField.from(7);

      const result = hornerEval(coeffs, x);

      // Expected: 9 + 2*7 + 3*7^2 = 9 + 14 + 147 = 170
      const expected = coeffs[0]!.add(coeffs[1]!.mul(x)).add(coeffs[2]!.mul(x.square()));
      expect(result.equals(expected)).toBe(true);
    });

    it('should handle empty coefficients', () => {
      const result = hornerEval([], BaseField.from(5));
      expect(result.equals(BaseField.from(0))).toBe(true);
    });

    it('should handle single coefficient', () => {
      const coeffs = [BaseField.from(42)];
      const result = hornerEval(coeffs, BaseField.from(7));
      expect(result.equals(BaseField.from(42))).toBe(true);
    });
  });

  describe('randomLinearCombination', () => {
    it('should compute linear combination correctly', () => {
      const v = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3))
      ];
      const alpha = SecureField.from(BaseField.from(5));

      const result = randomLinearCombination(v, alpha);

      // Expected: 1 + 2*5 + 3*25 = 1 + 10 + 75 = 86
      const expected = hornerEval(v, alpha);
      expect(result.equals(expected)).toBe(true);
    });

    it('should handle empty vector', () => {
      const result = randomLinearCombination([], SecureField.from(BaseField.from(7)));
      expect(result.equals(SecureField.zero())).toBe(true);
    });
  });

  describe('eq (Lagrange kernel)', () => {
    it('should return one for identical hypercube points', () => {
      const zero = SecureField.zero();
      const one = SecureField.one();
      const a = [one, zero, one];

      const eqEval = eq(a, a);

      expect(eqEval.equals(one)).toBe(true);
    });

    it('should return zero for different hypercube points', () => {
      const zero = SecureField.zero();
      const one = SecureField.one();
      const a = [one, zero, one];
      const b = [one, zero, zero];

      const eqEval = eq(a, b);

      expect(eqEval.equals(zero)).toBe(true);
    });

    it('should work for different boolean combinations', () => {
      const zero = SecureField.zero();
      const one = SecureField.one();

      // Test [0,0] vs [0,0] = 1
      expect(eq([zero, zero], [zero, zero]).equals(one)).toBe(true);
      
      // Test [0,1] vs [0,1] = 1
      expect(eq([zero, one], [zero, one]).equals(one)).toBe(true);
      
      // Test [1,1] vs [1,1] = 1
      expect(eq([one, one], [one, one]).equals(one)).toBe(true);
      
      // Test [0,0] vs [0,1] = 0
      expect(eq([zero, zero], [zero, one]).equals(zero)).toBe(true);
      
      // Test [1,0] vs [0,1] = 0
      expect(eq([one, zero], [zero, one]).equals(zero)).toBe(true);
    });

    it('should throw for different size points', () => {
      const zero = SecureField.zero();
      const one = SecureField.one();

      expect(() => eq([zero, one], [zero])).toThrow('x and y must have the same length');
    });

    it('should throw for empty arrays', () => {
      expect(() => eq([], [])).toThrow('Empty arrays not supported');
    });
  });

  describe('foldMleEvals', () => {
    it('should compute fold correctly for BaseField inputs', () => {
      const assignment = SecureField.from(BaseField.from(2));
      const eval0 = BaseField.from(5);
      const eval1 = BaseField.from(10);

      const result = foldMleEvals(assignment, eval0, eval1);

      // Expected: assignment * (eval1 - eval0) + eval0
      // = 2 * (10 - 5) + 5 = 2 * 5 + 5 = 15
      const expected = assignment.mul(SecureField.from(eval1).sub(SecureField.from(eval0))).add(SecureField.from(eval0));
      expect(result.equals(expected)).toBe(true);
    });

    it('should compute fold correctly for SecureField inputs', () => {
      const assignment = SecureField.from(BaseField.from(3));
      const eval0 = SecureField.from(BaseField.from(7));
      const eval1 = SecureField.from(BaseField.from(12));

      const result = foldMleEvals(assignment, eval0, eval1);

      // Expected: assignment * (eval1 - eval0) + eval0
      // = 3 * (12 - 7) + 7 = 3 * 5 + 7 = 22
      const expected = assignment.mul(eval1.sub(eval0)).add(eval0);
      expect(result.equals(expected)).toBe(true);
    });

    it('should handle zero assignment', () => {
      const assignment = SecureField.zero();
      const eval0 = BaseField.from(100);
      const eval1 = BaseField.from(200);

      const result = foldMleEvals(assignment, eval0, eval1);

      // Expected: 0 * (eval1 - eval0) + eval0 = eval0
      expect(result.equals(SecureField.from(eval0))).toBe(true);
    });

    it('should handle equal evaluations', () => {
      const assignment = SecureField.from(BaseField.from(42));
      const eval0 = BaseField.from(17);
      const eval1 = BaseField.from(17);

      const result = foldMleEvals(assignment, eval0, eval1);

      // Expected: assignment * (17 - 17) + 17 = assignment * 0 + 17 = 17
      expect(result.equals(SecureField.from(eval0))).toBe(true);
    });
  });

  describe('Fraction', () => {
    it('should create fractions correctly', () => {
      const frac = Fraction.new(BaseField.from(1), BaseField.from(3));
      expect(frac.numerator.equals(BaseField.from(1))).toBe(true);
      expect(frac.denominator.equals(BaseField.from(3))).toBe(true);
    });

    it('should create zero fractions correctly', () => {
      const zeroBase = Fraction.zeroBaseField();
      expect(zeroBase.numerator.equals(BaseField.zero())).toBe(true);
      expect(zeroBase.denominator.equals(BaseField.one())).toBe(true);
      expect(zeroBase.isZero()).toBe(true);

      const zeroSecure = Fraction.zeroSecureField();
      expect(zeroSecure.numerator.equals(SecureField.zero())).toBe(true);
      expect(zeroSecure.denominator.equals(SecureField.one())).toBe(true);
      expect(zeroSecure.isZero()).toBe(true);
    });

    it('should correctly identify zero fractions', () => {
      const zero = Fraction.new(BaseField.zero(), BaseField.from(5));
      expect(zero.isZero()).toBe(true);

      const nonZero = Fraction.new(BaseField.from(3), BaseField.from(5));
      expect(nonZero.isZero()).toBe(false);

      const invalidZero = Fraction.new(BaseField.from(0), BaseField.from(0));
      expect(invalidZero.isZero()).toBe(false); // denominator is zero, so not a valid zero
    });

    it('should add BaseField fractions correctly', () => {
      const frac1 = Fraction.new(BaseField.from(1), BaseField.from(3));
      const frac2 = Fraction.new(BaseField.from(2), BaseField.from(6));

      const result = frac1.addBaseField(frac2);

      // 1/3 + 2/6 = 1/3 + 1/3 = 2/3 = (1*6 + 3*2)/(3*6) = (6+6)/18 = 12/18 = 2/3
      // In actual calculation: (6*1 + 3*2)/(3*6) = (6+6)/18 = 12/18
      const expectedNumerator = BaseField.from(6).mul(BaseField.from(1)).add(BaseField.from(3).mul(BaseField.from(2))); // 6 + 6 = 12
      const expectedDenominator = BaseField.from(3).mul(BaseField.from(6)); // 18

      expect(result.numerator.equals(expectedNumerator)).toBe(true);
      expect(result.denominator.equals(expectedDenominator)).toBe(true);

      // Verify the fraction equals 2/3 by cross multiplication: 12/18 = 2/3 -> 12*3 = 18*2 -> 36 = 36
      expect(result.numerator.mul(BaseField.from(3)).equals(result.denominator.mul(BaseField.from(2)))).toBe(true);
    });

    it('should add SecureField fractions correctly', () => {
      const frac1 = Fraction.new(SecureField.from(BaseField.from(1)), SecureField.from(BaseField.from(4)));
      const frac2 = Fraction.new(SecureField.from(BaseField.from(1)), SecureField.from(BaseField.from(4)));

      const result = frac1.addSecureField(frac2);

      // 1/4 + 1/4 = 2/4 = 1/2
      // (4*1 + 4*1)/(4*4) = 8/16 = 1/2
      const expectedNumerator = SecureField.from(BaseField.from(8));
      const expectedDenominator = SecureField.from(BaseField.from(16));

      expect(result.numerator.equals(expectedNumerator)).toBe(true);
      expect(result.denominator.equals(expectedDenominator)).toBe(true);
    });

    it('should handle fraction addition edge cases', () => {
      const zero = Fraction.zeroBaseField();
      const frac = Fraction.new(BaseField.from(3), BaseField.from(7));

      const result = zero.addBaseField(frac);

      // 0/1 + 3/7 = (7*0 + 1*3)/(1*7) = 3/7
      expect(result.numerator.equals(BaseField.from(3))).toBe(true);
      expect(result.denominator.equals(BaseField.from(7))).toBe(true);
    });

    it('should throw errors for incompatible fraction addition', () => {
      const mixedFrac1 = Fraction.new(BaseField.from(1), SecureField.from(BaseField.from(2)));
      const baseFrac = Fraction.new(BaseField.from(1), BaseField.from(2));

      expect(() => mixedFrac1.addBaseField(baseFrac)).toThrow('addBaseField requires BaseField numerator and denominator');
    });

    // This mirrors the original Rust test: fraction_addition_works
    it('should match original Rust fraction addition test', () => {
      const a = Fraction.new(BaseField.from(1), BaseField.from(3));
      const b = Fraction.new(BaseField.from(2), BaseField.from(6));

      const result = a.addBaseField(b);

      // Expected result should equal 2/3
      // We verify this by checking that result equals BaseField.from(2) / BaseField.from(3)
      // Cross multiply: result.numerator * 3 should equal result.denominator * 2
      const two = BaseField.from(2);
      const three = BaseField.from(3);
      
      expect(result.numerator.mul(three).equals(result.denominator.mul(two))).toBe(true);
    });
  });

  describe('sumBaseFractions', () => {
    it('should sum empty array to zero', () => {
      const result = sumBaseFractions([]);
      expect(result.isZero()).toBe(true);
    });

    it('should sum single fraction to itself', () => {
      const frac = Fraction.new(BaseField.from(3), BaseField.from(7));
      const result = sumBaseFractions([frac]);
      expect(result.numerator.equals(frac.numerator)).toBe(true);
      expect(result.denominator.equals(frac.denominator)).toBe(true);
    });

    it('should sum multiple fractions correctly', () => {
      const fractions = [
        Fraction.new(BaseField.from(1), BaseField.from(2)), // 1/2
        Fraction.new(BaseField.from(1), BaseField.from(3)), // 1/3
        Fraction.new(BaseField.from(1), BaseField.from(6))  // 1/6
      ];

      const result = sumBaseFractions(fractions);

      // 1/2 + 1/3 + 1/6 = 3/6 + 2/6 + 1/6 = 6/6 = 1
      // Let's verify by checking if result equals 1/1
      // We'll check this by cross multiplication with 1/1
      const one = BaseField.one();
      expect(result.numerator.equals(result.denominator)).toBe(true); // Should be n/n = 1
    });

    it('should handle fraction array with zeros', () => {
      const fractions = [
        Fraction.zeroBaseField(),
        Fraction.new(BaseField.from(5), BaseField.from(8)),
        Fraction.zeroBaseField()
      ];

      const result = sumBaseFractions(fractions);

      // 0 + 5/8 + 0 = 5/8
      expect(result.numerator.equals(BaseField.from(5))).toBe(true);
      expect(result.denominator.equals(BaseField.from(8))).toBe(true);
    });
  });

  describe('sumSecureFractions', () => {
    it('should sum empty array to zero', () => {
      const result = sumSecureFractions([]);
      expect(result.isZero()).toBe(true);
    });

    it('should sum multiple SecureField fractions correctly', () => {
      const fractions = [
        Fraction.new(SecureField.from(BaseField.from(1)), SecureField.from(BaseField.from(4))), // 1/4
        Fraction.new(SecureField.from(BaseField.from(1)), SecureField.from(BaseField.from(4)))  // 1/4
      ];

      const result = sumSecureFractions(fractions);

      // 1/4 + 1/4 = 2/4 = 1/2
      // Result should be 8/16 which simplifies to 1/2
      expect(result.numerator.equals(SecureField.from(BaseField.from(8)))).toBe(true);
      expect(result.denominator.equals(SecureField.from(BaseField.from(16)))).toBe(true);
    });
  });

  describe('Reciprocal', () => {
    it('should create reciprocals correctly', () => {
      const recip = Reciprocal.new(BaseField.from(5));
      expect(recip.x.equals(BaseField.from(5))).toBe(true);
    });

    it('should add reciprocals correctly', () => {
      const recip1 = Reciprocal.new(BaseField.from(2));
      const recip2 = Reciprocal.new(BaseField.from(3));

      const result = recip1.add<BaseField>(recip2);

      // 1/2 + 1/3 = (2 + 3)/(2 * 3) = 5/6
      expect(result.numerator.equals(BaseField.from(5))).toBe(true);
      expect(result.denominator.equals(BaseField.from(6))).toBe(true);
    });

    it('should subtract reciprocals correctly', () => {
      const recip1 = Reciprocal.new(BaseField.from(2));
      const recip2 = Reciprocal.new(BaseField.from(4));

      const result = recip1.sub<BaseField>(recip2);

      // 1/2 - 1/4 = (4 - 2)/(2 * 4) = 2/8 = 1/4
      expect(result.numerator.equals(BaseField.from(2))).toBe(true);
      expect(result.denominator.equals(BaseField.from(8))).toBe(true);
    });

    it('should handle reciprocal addition with SecureField', () => {
      const recip1 = Reciprocal.new(SecureField.from(BaseField.from(3)));
      const recip2 = Reciprocal.new(SecureField.from(BaseField.from(6)));

      const result = recip1.add<SecureField>(recip2);

      // 1/3 + 1/6 = (3 + 6)/(3 * 6) = 9/18 = 1/2
      const expectedNumerator = SecureField.from(BaseField.from(9));
      const expectedDenominator = SecureField.from(BaseField.from(18));
      expect(result.numerator.equals(expectedNumerator)).toBe(true);
      expect(result.denominator.equals(expectedDenominator)).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very small polynomials', () => {
      const empty = UnivariatePoly.new([]);
      expect(empty.isZero()).toBe(true);

      const single = UnivariatePoly.new([BaseField.from(42)]);
      expect(single.degree()).toBe(0);
      expect(single.evalAtPoint(BaseField.from(100)).equals(BaseField.from(42))).toBe(true);
    });

    it('should truncate leading zeros', () => {
      const poly = UnivariatePoly.new([
        BaseField.from(1), 
        BaseField.from(2), 
        BaseField.from(0), 
        BaseField.from(0)
      ]);
      
      expect(poly.length()).toBe(2); // Leading zeros should be truncated
      expect(poly.degree()).toBe(1);
    });

    it('should handle all-zero coefficients', () => {
      const poly = UnivariatePoly.new([
        BaseField.from(0), 
        BaseField.from(0), 
        BaseField.from(0)
      ]);
      
      expect(poly.isZero()).toBe(true);
      expect(poly.length()).toBe(0);
    });
  });
}); 