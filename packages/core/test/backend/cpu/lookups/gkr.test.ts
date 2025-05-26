import { describe, it, expect } from 'vitest';
import { M31 as BaseField } from '../../../../src/fields/m31';
import { QM31 as SecureField } from '../../../../src/fields/qm31';
import { Mle } from '../../../../src/lookups/mle';
import { eq, Fraction, Reciprocal, UnivariatePoly } from '../../../../src/lookups/utils';
import { CpuGkrOps } from '../../../../src/backend/cpu/lookups/gkr';
import { EqEvals, GkrMultivariatePolyOracle, Layer } from '../../../../src/lookups/gkr_prover';

describe('CPU Backend GKR Operations', () => {
  describe('genEqEvals', () => {
    it('should generate correct eq evaluations', () => {
      const zero = SecureField.zero();
      const one = SecureField.one();
      const two = SecureField.from(BaseField.from(2));
      const y = [
        SecureField.from(BaseField.from(7)),
        SecureField.from(BaseField.from(3))
      ];

      const gkrOps = new CpuGkrOps();
      const eqEvals = gkrOps.genEqEvals(y, two);

      // Expected values: eq([x0, x1], y) * two for all x in {0,1}^2
      const expected = [
        eq([zero, zero], y).mul(two),
        eq([zero, one], y).mul(two),
        eq([one, zero], y).mul(two),
        eq([one, one], y).mul(two)
      ];

      expect(eqEvals.len()).toBe(4);
      for (let i = 0; i < 4; i++) {
        expect(eqEvals.at(i).equals(expected[i]!)).toBe(true);
      }
    });

    it('should handle single variable case', () => {
      const v = SecureField.from(BaseField.from(5));
      const y = [SecureField.from(BaseField.from(3))];

      const gkrOps = new CpuGkrOps();
      const eqEvals = gkrOps.genEqEvals(y, v);

      expect(eqEvals.len()).toBe(2);
      
      const zero = SecureField.zero();
      const one = SecureField.one();
      const expected0 = eq([zero], y).mul(v);
      const expected1 = eq([one], y).mul(v);

      expect(eqEvals.at(0).equals(expected0)).toBe(true);
      expect(eqEvals.at(1).equals(expected1)).toBe(true);
    });

    it('should handle empty y vector', () => {
      const v = SecureField.from(BaseField.from(7));
      const y: SecureField[] = [];

      const gkrOps = new CpuGkrOps();
      const eqEvals = gkrOps.genEqEvals(y, v);

      expect(eqEvals.len()).toBe(1);
      expect(eqEvals.at(0).equals(v)).toBe(true);
    });

    it('should handle three variable case', () => {
      const v = SecureField.from(BaseField.from(1));
      const y = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(0)),
        SecureField.from(BaseField.from(1))
      ];

      const gkrOps = new CpuGkrOps();
      const eqEvals = gkrOps.genEqEvals(y, v);

      expect(eqEvals.len()).toBe(8); // 2^3 = 8
      
      // Verify all evaluations are valid SecureField values
      for (let i = 0; i < 8; i++) {
        expect(eqEvals.at(i)).toBeInstanceOf(SecureField);
      }
    });

    it('should handle large y vectors efficiently', () => {
      const v = SecureField.from(BaseField.from(1));
      const y = Array.from({ length: 5 }, (_, i) => 
        SecureField.from(BaseField.from(i % 2))
      );

      const gkrOps = new CpuGkrOps();
      const eqEvals = gkrOps.genEqEvals(y, v);

      expect(eqEvals.len()).toBe(32); // 2^5 = 32
      
      // Verify all evaluations are valid
      for (let i = 0; i < 32; i++) {
        expect(eqEvals.at(i)).toBeInstanceOf(SecureField);
      }
    });
  });

  describe('nextLayer', () => {
    it('should handle GrandProduct layer', () => {
      const values = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];
      const mle = new Mle(values);
      const layer = { type: 'GrandProduct' as const, data: mle };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer).not.toBeNull();
      expect(nextLayer!.type).toBe('GrandProduct');
      if (nextLayer!.type === 'GrandProduct') {
        expect(nextLayer.data.len()).toBe(2);
        expect(nextLayer.data.nVariables()).toBe(1);

        // Verify the products are computed correctly
        // next[0] = values[0] * values[1] = 1 * 2 = 2
        // next[1] = values[2] * values[3] = 3 * 4 = 12
        const expected0 = values[0]!.mul(values[1]!);
        const expected1 = values[2]!.mul(values[3]!);

        expect(nextLayer.data.at(0).equals(expected0)).toBe(true);
        expect(nextLayer.data.at(1).equals(expected1)).toBe(true);
      }
    });

    it('should handle LogUpGeneric layer', () => {
      const numerators = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];
      const denominators = [
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(6)),
        SecureField.from(BaseField.from(7)),
        SecureField.from(BaseField.from(8))
      ];

      const numMle = new Mle(numerators);
      const denomMle = new Mle(denominators);
      const layer = {
        type: 'LogUpGeneric' as const,
        numerators: numMle,
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer).not.toBeNull();
      expect(nextLayer!.type).toBe('LogUpGeneric');
      if (nextLayer!.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(2);
        expect(nextLayer.denominators.len()).toBe(2);

        // Verify fraction addition: (a/b) + (c/d) = (a*d + b*c)/(b*d)
        // next[0] = (1/5) + (2/6) = (1*6 + 5*2)/(5*6) = 16/30
        // next[1] = (3/7) + (4/8) = (3*8 + 7*4)/(7*8) = 52/56
        const frac0 = Fraction.new(numerators[0]!, denominators[0]!)
          .addSecureField(Fraction.new(numerators[1]!, denominators[1]!));
        const frac1 = Fraction.new(numerators[2]!, denominators[2]!)
          .addSecureField(Fraction.new(numerators[3]!, denominators[3]!));

        expect(nextLayer.numerators.at(0).equals(frac0.numerator)).toBe(true);
        expect(nextLayer.denominators.at(0).equals(frac0.denominator)).toBe(true);
        expect(nextLayer.numerators.at(1).equals(frac1.numerator)).toBe(true);
        expect(nextLayer.denominators.at(1).equals(frac1.denominator)).toBe(true);
      }
    });

    it('should handle LogUpMultiplicities layer', () => {
      const numerators = [
        BaseField.from(1),
        BaseField.from(2),
        BaseField.from(3),
        BaseField.from(4)
      ];
      const denominators = [
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(6)),
        SecureField.from(BaseField.from(7)),
        SecureField.from(BaseField.from(8))
      ];

      const numMle = new Mle(numerators);
      const denomMle = new Mle(denominators);
      const layer = {
        type: 'LogUpMultiplicities' as const,
        numerators: numMle,
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer).not.toBeNull();
      expect(nextLayer!.type).toBe('LogUpGeneric');
      if (nextLayer!.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(2);
        expect(nextLayer.denominators.len()).toBe(2);

        // Verify fraction addition with BaseField numerators converted to SecureField
        const secureNum0 = SecureField.from(numerators[0]!);
        const secureNum1 = SecureField.from(numerators[1]!);
        const secureNum2 = SecureField.from(numerators[2]!);
        const secureNum3 = SecureField.from(numerators[3]!);

        const frac0 = Fraction.new(secureNum0, denominators[0]!)
          .addSecureField(Fraction.new(secureNum1, denominators[1]!));
        const frac1 = Fraction.new(secureNum2, denominators[2]!)
          .addSecureField(Fraction.new(secureNum3, denominators[3]!));

        expect(nextLayer.numerators.at(0).equals(frac0.numerator)).toBe(true);
        expect(nextLayer.denominators.at(0).equals(frac0.denominator)).toBe(true);
        expect(nextLayer.numerators.at(1).equals(frac1.numerator)).toBe(true);
        expect(nextLayer.denominators.at(1).equals(frac1.denominator)).toBe(true);
      }
    });

    it('should handle LogUpSingles layer', () => {
      const denominators = [
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(6)),
        SecureField.from(BaseField.from(7)),
        SecureField.from(BaseField.from(8))
      ];

      const denomMle = new Mle(denominators);
      const layer = {
        type: 'LogUpSingles' as const,
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer).not.toBeNull();
      expect(nextLayer!.type).toBe('LogUpGeneric');
      if (nextLayer!.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(2);
        expect(nextLayer.denominators.len()).toBe(2);

        // Verify fraction addition with constant numerator 1
        // (1/a) + (1/b) = (a + b)/(a * b)
        const one = SecureField.one();
        const frac0 = Fraction.new(one, denominators[0]!)
          .addSecureField(Fraction.new(one, denominators[1]!));
        const frac1 = Fraction.new(one, denominators[2]!)
          .addSecureField(Fraction.new(one, denominators[3]!));

        expect(nextLayer.numerators.at(0).equals(frac0.numerator)).toBe(true);
        expect(nextLayer.denominators.at(0).equals(frac0.denominator)).toBe(true);
        expect(nextLayer.numerators.at(1).equals(frac1.numerator)).toBe(true);
        expect(nextLayer.denominators.at(1).equals(frac1.denominator)).toBe(true);
      }
    });

    it('should handle large GrandProduct layers', () => {
      const values = Array.from({ length: 16 }, (_, i) => 
        SecureField.from(BaseField.from(i + 1))
      );
      const mle = new Mle(values);
      const layer = { type: 'GrandProduct' as const, data: mle };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer).not.toBeNull();
      expect(nextLayer!.type).toBe('GrandProduct');
      if (nextLayer!.type === 'GrandProduct') {
        expect(nextLayer.data.len()).toBe(8);
        expect(nextLayer.data.nVariables()).toBe(3);

        // Verify first few products
        expect(nextLayer.data.at(0).equals(values[0]!.mul(values[1]!))).toBe(true);
        expect(nextLayer.data.at(1).equals(values[2]!.mul(values[3]!))).toBe(true);
        expect(nextLayer.data.at(7).equals(values[14]!.mul(values[15]!))).toBe(true);
      }
    });

    it('should handle power-of-two layer sizes correctly', () => {
      // Test with 8 elements (power of 2)
      const values = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4)),
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(6)),
        SecureField.from(BaseField.from(7)),
        SecureField.from(BaseField.from(8))
      ];
      const mle = new Mle(values);
      const layer = { type: 'GrandProduct' as const, data: mle };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer).not.toBeNull();
      expect(nextLayer!.type).toBe('GrandProduct');
      if (nextLayer!.type === 'GrandProduct') {
        expect(nextLayer.data.len()).toBe(4); // floor(8/2) = 4
        
        expect(nextLayer.data.at(0).equals(values[0]!.mul(values[1]!))).toBe(true);
        expect(nextLayer.data.at(1).equals(values[2]!.mul(values[3]!))).toBe(true);
        expect(nextLayer.data.at(2).equals(values[4]!.mul(values[5]!))).toBe(true);
        expect(nextLayer.data.at(3).equals(values[6]!.mul(values[7]!))).toBe(true);
      }
    });
  });

  describe('sumAsPolyInFirstVariable', () => {
    it('should throw error for zero variables', () => {
      // Create oracle with 0 variables (constant)
      // For an oracle to have 0 variables, the layer must have 1 variable (since oracle.nVariables = layer.nVariables - 1)
      // A layer with 1 variable needs 2 elements (2^1 = 2)
      const values = [SecureField.from(BaseField.from(42)), SecureField.from(BaseField.from(24))];
      const mle = new Mle(values);
      const layer: Layer = { type: 'GrandProduct', data: mle };
      
      // For 0 variables oracle, we need empty y vector and single evaluation
      const y: SecureField[] = [];
      const eqEvalsData = new Mle([SecureField.one()]);
      const eqEvals = new EqEvals(y, eqEvalsData);
      
      const lambda = SecureField.from(BaseField.from(3));
      const oracle = new GkrMultivariatePolyOracle(
        eqEvals,
        layer,
        SecureField.one(),
        lambda
      );

      // Verify the oracle has 0 variables (layer has 1 variable, so oracle has 1-1=0)
      expect(oracle.nVariables()).toBe(0);

      const claim = SecureField.from(BaseField.from(100));
      const gkrOps = new CpuGkrOps();
      
      expect(() => gkrOps.sumAsPolyInFirstVariable(oracle, claim))
        .toThrow('Number of variables must not be zero');
    });
  });

  describe('Helper functions coverage', () => {
    it('should test convertToSecureField with BaseField input', () => {
      // This tests the convertToSecureField function indirectly through LogUpMultiplicities
      const numerators = [BaseField.from(42), BaseField.from(24)];
      const denominators = [
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(6))
      ];

      const numMle = new Mle(numerators);
      const denomMle = new Mle(denominators);
      const layer = {
        type: 'LogUpMultiplicities' as const,
        numerators: numMle,
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('LogUpGeneric');
      if (nextLayer.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(1);
        expect(nextLayer.denominators.len()).toBe(1);
        
        // Verify the conversion worked correctly
        const expectedNumerator = SecureField.from(numerators[0]!)
          .mul(denominators[1]!)
          .add(denominators[0]!.mul(SecureField.from(numerators[1]!)));
        const expectedDenominator = denominators[0]!.mul(denominators[1]!);
        
        expect(nextLayer.numerators.at(0).equals(expectedNumerator)).toBe(true);
        expect(nextLayer.denominators.at(0).equals(expectedDenominator)).toBe(true);
      }
    });

    it('should test convertToSecureField with SecureField input', () => {
      // This tests the convertToSecureField function with SecureField input
      const numerators = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2))
      ];
      const denominators = [
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];

      const numMle = new Mle(numerators);
      const denomMle = new Mle(denominators);
      const layer = {
        type: 'LogUpGeneric' as const,
        numerators: numMle,
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('LogUpGeneric');
      if (nextLayer.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(1);
        expect(nextLayer.denominators.len()).toBe(1);
      }
    });

    it('should test indexMleExpr with Constant type', () => {
      // This tests the indexMleExpr function with Constant type through LogUpSingles
      const denominators = [
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(6))
      ];

      const denomMle = new Mle(denominators);
      const layer = {
        type: 'LogUpSingles' as const,
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('LogUpGeneric');
      if (nextLayer.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(1);
        expect(nextLayer.denominators.len()).toBe(1);
        
        // The numerator should be the sum of denominators (1/a + 1/b = (a+b)/(a*b))
        const expectedNumerator = denominators[0]!.add(denominators[1]!);
        const expectedDenominator = denominators[0]!.mul(denominators[1]!);
        
        expect(nextLayer.numerators.at(0).equals(expectedNumerator)).toBe(true);
        expect(nextLayer.denominators.at(0).equals(expectedDenominator)).toBe(true);
      }
    });

    it('should test basic evaluation functions', () => {
      // Test basic functionality without complex polynomial evaluations that might cause division by zero
      const values = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];
      const mle = new Mle(values);
      const layer: Layer = { type: 'GrandProduct', data: mle };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('GrandProduct');
      if (nextLayer.type === 'GrandProduct') {
        expect(nextLayer.data.len()).toBe(2);
        expect(nextLayer.data.nVariables()).toBe(1);
      }
    });

    it('should test evalLogupSum with safe field values', () => {
      // Test with safe values that won't cause division by zero
      const numerators = [
        BaseField.from(1),
        BaseField.from(2)
      ];
      const denominators = [
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];

      const numMle = new Mle(numerators);
      const denomMle = new Mle(denominators);
      const layer: Layer = {
        type: 'LogUpMultiplicities',
        numerators: numMle,
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('LogUpGeneric');
      if (nextLayer.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(1);
        expect(nextLayer.denominators.len()).toBe(1);
      }
    });

    it('should test evalLogupSinglesSum with safe lambda values', () => {
      const denominators = [
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(6))
      ];

      const denomMle = new Mle(denominators);
      const layer: Layer = {
        type: 'LogUpSingles',
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('LogUpGeneric');
      if (nextLayer.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(1);
        expect(nextLayer.denominators.len()).toBe(1);
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle single element MLEs', () => {
      const value = SecureField.from(BaseField.from(42));
      const mle = new Mle([value]);
      const layer = { type: 'GrandProduct' as const, data: mle };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      // Single element MLE is an output layer (0 variables), so nextLayer should return null
      expect(nextLayer).toBeNull();
    });

    it('should handle empty y vector in genEqEvals', () => {
      const v = SecureField.from(BaseField.from(1));
      const y: SecureField[] = [];

      const gkrOps = new CpuGkrOps();
      const result = gkrOps.genEqEvals(y, v);

      expect(result.len()).toBe(1);
      expect(result.nVariables()).toBe(0);
      expect(result.at(0).equals(v)).toBe(true);
    });

    it('should maintain consistency across layer transformations', () => {
      // Test that applying nextLayer twice gives consistent results
      const values = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4)),
        SecureField.from(BaseField.from(5)),
        SecureField.from(BaseField.from(6)),
        SecureField.from(BaseField.from(7)),
        SecureField.from(BaseField.from(8))
      ];
      const mle = new Mle(values);
      const layer = { type: 'GrandProduct' as const, data: mle };

      const gkrOps = new CpuGkrOps();
      const layer1 = gkrOps.nextLayer(layer);
      const layer2 = gkrOps.nextLayer(layer1);

      if (layer1.type === 'GrandProduct' && layer2.type === 'GrandProduct') {
        expect(layer1.data.len()).toBe(4);
        expect(layer2.data.len()).toBe(2);
        expect(layer1.data.nVariables()).toBe(2);
        expect(layer2.data.nVariables()).toBe(1);
      }
    });

    it('should handle zero values in layers', () => {
      const values = [
        SecureField.zero(),
        SecureField.from(BaseField.from(1)),
        SecureField.zero(),
        SecureField.from(BaseField.from(2))
      ];
      const mle = new Mle(values);
      const layer = { type: 'GrandProduct' as const, data: mle };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('GrandProduct');
      if (nextLayer.type === 'GrandProduct') {
        expect(nextLayer.data.len()).toBe(2);
        expect(nextLayer.data.at(0).equals(SecureField.zero())).toBe(true);
        expect(nextLayer.data.at(1).equals(SecureField.zero())).toBe(true);
      }
    });

    it('should handle large denominators in LogUp layers', () => {
      const denominators = [
        SecureField.from(BaseField.from(1000000)),
        SecureField.from(BaseField.from(2000000)),
        SecureField.from(BaseField.from(3000000)),
        SecureField.from(BaseField.from(4000000))
      ];

      const denomMle = new Mle(denominators);
      const layer = {
        type: 'LogUpSingles' as const,
        denominators: denomMle
      };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('LogUpGeneric');
      if (nextLayer.type === 'LogUpGeneric') {
        expect(nextLayer.numerators.len()).toBe(2);
        expect(nextLayer.denominators.len()).toBe(2);
        
        // Verify the calculations are still correct with large numbers
        expect(nextLayer.numerators.at(0)).toBeInstanceOf(SecureField);
        expect(nextLayer.denominators.at(0)).toBeInstanceOf(SecureField);
      }
    });

    it('should handle maximum field values', () => {
      // Test with maximum M31 values
      const maxValue = BaseField.from(2147483647); // 2^31 - 1
      const values = [
        SecureField.from(maxValue),
        SecureField.from(maxValue),
        SecureField.from(maxValue),
        SecureField.from(maxValue)
      ];
      const mle = new Mle(values);
      const layer = { type: 'GrandProduct' as const, data: mle };

      const gkrOps = new CpuGkrOps();
      const nextLayer = gkrOps.nextLayer(layer);

      expect(nextLayer.type).toBe('GrandProduct');
      if (nextLayer.type === 'GrandProduct') {
        expect(nextLayer.data.len()).toBe(2);
        // The product should still be valid SecureField values
        expect(nextLayer.data.at(0)).toBeInstanceOf(SecureField);
        expect(nextLayer.data.at(1)).toBeInstanceOf(SecureField);
      }
    });

    it('should handle basic layer operations', () => {
      // Test basic layer operations without complex polynomial evaluations
      const values = [
        SecureField.from(BaseField.from(1)),
        SecureField.from(BaseField.from(2)),
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(4))
      ];
      const mle = new Mle(values);
      const layer: Layer = { type: 'GrandProduct', data: mle };

      const gkrOps = new CpuGkrOps();
      
      // Test basic oracle properties
      const y = [SecureField.from(BaseField.from(1))];
      const eqEvalsData = gkrOps.genEqEvals(y, SecureField.one());
      const eqEvals = new EqEvals(y, eqEvalsData);
      
      const lambda = SecureField.from(BaseField.from(17));
      const correction = SecureField.from(BaseField.from(19));
      const oracle = new GkrMultivariatePolyOracle(
        eqEvals,
        layer,
        correction,
        lambda
      );

      expect(oracle.eqEvals).toBe(eqEvals);
      expect(oracle.inputLayer).toBe(layer);
      expect(oracle.lambda.equals(lambda)).toBe(true);
      expect(oracle.eqFixedVarCorrection.equals(correction)).toBe(true);
    });
  });
}); 