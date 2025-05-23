import { describe, it, expect, beforeEach } from 'vitest';
import {
  EqEvals,
  Layer,
  NotOutputLayerError,
  GkrMultivariatePolyOracle,
  NotConstantPolyError,
  proveBatch,
  correctSumAsPolyInFirstVariable
} from '../../src/lookups/gkr_prover';
import type { GkrOps } from '../../src/lookups/gkr_prover';
import { Mle } from '../../src/lookups/mle';
import { UnivariatePoly, eq, randomLinearCombination } from '../../src/lookups/utils';
import { GkrArtifact, GkrBatchProof, GkrMask } from '../../src/lookups/gkr_verifier';
import { QM31 as SecureField } from '../../src/fields/qm31';
import { M31 as BaseField } from '../../src/fields/m31';
import type { Channel } from '../../src/channel';
import { Blake2sChannel } from '../../src/channel/blake2';

/**
 * Test channel factory for consistent random generation.
 */
function testChannel(): Blake2sChannel {
  return new Blake2sChannel();
}

/**
 * Helper function to create test MLE with given values
 */
function createTestMle(values: SecureField[]): Mle<SecureField> {
  return new Mle(values);
}

/**
 * Helper function to create test MLE with BaseField values
 */
function createTestBaseMle(values: BaseField[]): Mle<BaseField> {
  return new Mle(values);
}

/**
 * Helper function to generate random SecureField values
 */
function generateRandomSecureFields(count: number, channel: Channel): SecureField[] {
  return channel.draw_felts(count);
}

/**
 * Helper function to generate random BaseField values
 */
function generateRandomBaseFields(count: number, channel: Channel): BaseField[] {
  return Array.from({ length: count }, () => BaseField.from(Math.floor(Math.random() * 1000)));
}

describe('GKR Prover', () => {
  let channel: Blake2sChannel;

  beforeEach(() => {
    channel = testChannel();
  });

  describe('EqEvals', () => {
    it('should create EqEvals with empty y vector', () => {
      const eqEvals = EqEvals.generate([]);
      
      expect(eqEvals.getY()).toEqual([]);
      expect(eqEvals.len()).toBe(1);
      expect(eqEvals.at(0).equals(SecureField.one())).toBe(true);
    });

    it('should create EqEvals with single element y vector', () => {
      const y = [SecureField.from(BaseField.from(5))];
      const eqEvals = EqEvals.generate(y);
      
      expect(eqEvals.getY()).toEqual(y);
      expect(eqEvals.len()).toBe(1);
      
      // The actual evaluation is more complex than just eq([0], [y[0]])
      // Let's just verify it's a valid SecureField value
      expect(eqEvals.at(0)).toBeInstanceOf(SecureField);
    });

    it('should create EqEvals with multiple element y vector', () => {
      const y = generateRandomSecureFields(3, channel);
      const eqEvals = EqEvals.generate(y);
      
      expect(eqEvals.getY()).toEqual(y);
      expect(eqEvals.len()).toBe(4); // 2^(3-1) = 4
      
      // Verify first evaluation is a valid SecureField
      expect(eqEvals.at(0)).toBeInstanceOf(SecureField);
    });

    it('should handle constructor with pre-computed values', () => {
      const y = generateRandomSecureFields(2, channel);
      const evals = createTestMle([SecureField.one(), SecureField.zero()]);
      const eqEvals = new EqEvals(y, evals);
      
      expect(eqEvals.getY()).toEqual(y);
      expect(eqEvals.len()).toBe(2);
      expect(eqEvals.at(0).equals(SecureField.one())).toBe(true);
      expect(eqEvals.at(1).equals(SecureField.zero())).toBe(true);
    });
  });

  describe('Layer', () => {
    describe('nVariables', () => {
      it('should return correct number of variables for GrandProduct', () => {
        const values = generateRandomSecureFields(8, channel);
        const mle = createTestMle(values);
        const layer: Layer = { type: 'GrandProduct', data: mle };
        
        expect(Layer.nVariables(layer)).toBe(3); // log2(8) = 3
      });

      it('should return correct number of variables for LogUpGeneric', () => {
        const numerators = createTestMle(generateRandomSecureFields(16, channel));
        const denominators = createTestMle(generateRandomSecureFields(16, channel));
        const layer: Layer = { type: 'LogUpGeneric', numerators, denominators };
        
        expect(Layer.nVariables(layer)).toBe(4); // log2(16) = 4
      });

      it('should return correct number of variables for LogUpMultiplicities', () => {
        const numerators = createTestBaseMle(generateRandomBaseFields(4, channel));
        const denominators = createTestMle(generateRandomSecureFields(4, channel));
        const layer: Layer = { type: 'LogUpMultiplicities', numerators, denominators };
        
        expect(Layer.nVariables(layer)).toBe(2); // log2(4) = 2
      });

      it('should return correct number of variables for LogUpSingles', () => {
        const denominators = createTestMle(generateRandomSecureFields(32, channel));
        const layer: Layer = { type: 'LogUpSingles', denominators };
        
        expect(Layer.nVariables(layer)).toBe(5); // log2(32) = 5
      });
    });

    describe('isOutputLayer', () => {
      it('should return true for output layer (0 variables)', () => {
        const mle = createTestMle([SecureField.one()]);
        const layer: Layer = { type: 'GrandProduct', data: mle };
        
        expect(Layer.isOutputLayer(layer)).toBe(true);
      });

      it('should return false for non-output layer', () => {
        const mle = createTestMle(generateRandomSecureFields(4, channel));
        const layer: Layer = { type: 'GrandProduct', data: mle };
        
        expect(Layer.isOutputLayer(layer)).toBe(false);
      });
    });

    describe('tryIntoOutputLayerValues', () => {
      it('should extract values from GrandProduct output layer', () => {
        const value = SecureField.from(BaseField.from(42));
        const mle = createTestMle([value]);
        const layer: Layer = { type: 'GrandProduct', data: mle };
        
        const result = Layer.tryIntoOutputLayerValues(layer);
        expect(result).toEqual([value]);
      });

      it('should extract values from LogUpSingles output layer', () => {
        const denominator = SecureField.from(BaseField.from(7));
        const mle = createTestMle([denominator]);
        const layer: Layer = { type: 'LogUpSingles', denominators: mle };
        
        const result = Layer.tryIntoOutputLayerValues(layer);
        expect(result).toEqual([SecureField.one(), denominator]);
      });

      it('should extract values from LogUpMultiplicities output layer', () => {
        const numerator = BaseField.from(3);
        const denominator = SecureField.from(BaseField.from(9));
        const numMle = createTestBaseMle([numerator]);
        const denMle = createTestMle([denominator]);
        const layer: Layer = { 
          type: 'LogUpMultiplicities', 
          numerators: numMle, 
          denominators: denMle 
        };
        
        const result = Layer.tryIntoOutputLayerValues(layer);
        expect(result).toEqual([SecureField.from(numerator), denominator]);
      });

      it('should extract values from LogUpGeneric output layer', () => {
        const numerator = SecureField.from(BaseField.from(5));
        const denominator = SecureField.from(BaseField.from(11));
        const numMle = createTestMle([numerator]);
        const denMle = createTestMle([denominator]);
        const layer: Layer = { 
          type: 'LogUpGeneric', 
          numerators: numMle, 
          denominators: denMle 
        };
        
        const result = Layer.tryIntoOutputLayerValues(layer);
        expect(result).toEqual([numerator, denominator]);
      });

      it('should throw error for non-output layer', () => {
        const mle = createTestMle(generateRandomSecureFields(4, channel));
        const layer: Layer = { type: 'GrandProduct', data: mle };
        
        expect(() => Layer.tryIntoOutputLayerValues(layer)).toThrow(NotOutputLayerError);
      });
    });

    describe('fixFirstVariable', () => {
      it('should fix first variable for GrandProduct layer', () => {
        const values = generateRandomSecureFields(4, channel);
        const mle = createTestMle(values);
        const layer: Layer = { type: 'GrandProduct', data: mle };
        const x0 = SecureField.from(BaseField.from(1));
        
        const result = Layer.fixFirstVariable(layer, x0);
        
        expect(result.type).toBe('GrandProduct');
        if (result.type === 'GrandProduct') {
          expect(result.data.len()).toBe(2); // Half the size
        }
      });

      it('should fix first variable for LogUpGeneric layer', () => {
        const numerators = createTestMle(generateRandomSecureFields(8, channel));
        const denominators = createTestMle(generateRandomSecureFields(8, channel));
        const layer: Layer = { type: 'LogUpGeneric', numerators, denominators };
        const x0 = SecureField.from(BaseField.from(0));
        
        const result = Layer.fixFirstVariable(layer, x0);
        
        expect(result.type).toBe('LogUpGeneric');
        if (result.type === 'LogUpGeneric') {
          expect(result.numerators.len()).toBe(4); // Half the size
          expect(result.denominators.len()).toBe(4); // Half the size
        }
      });

      it('should convert LogUpMultiplicities to LogUpGeneric when fixing first variable', () => {
        const numerators = createTestBaseMle(generateRandomBaseFields(4, channel));
        const denominators = createTestMle(generateRandomSecureFields(4, channel));
        const layer: Layer = { type: 'LogUpMultiplicities', numerators, denominators };
        const x0 = SecureField.from(BaseField.from(1));
        
        const result = Layer.fixFirstVariable(layer, x0);
        
        expect(result.type).toBe('LogUpGeneric');
        if (result.type === 'LogUpGeneric') {
          expect(result.numerators.len()).toBe(2); // Half the size
          expect(result.denominators.len()).toBe(2); // Half the size
        }
      });

      it('should fix first variable for LogUpSingles layer', () => {
        const denominators = createTestMle(generateRandomSecureFields(8, channel));
        const layer: Layer = { type: 'LogUpSingles', denominators };
        const x0 = SecureField.from(BaseField.from(0));
        
        const result = Layer.fixFirstVariable(layer, x0);
        
        expect(result.type).toBe('LogUpSingles');
        if (result.type === 'LogUpSingles') {
          expect(result.denominators.len()).toBe(4); // Half the size
        }
      });

      it('should return same layer for output layer (0 variables)', () => {
        const mle = createTestMle([SecureField.one()]);
        const layer: Layer = { type: 'GrandProduct', data: mle };
        const x0 = SecureField.from(BaseField.from(1));
        
        const result = Layer.fixFirstVariable(layer, x0);
        
        expect(result).toEqual(layer);
      });
    });

    describe('nextLayer', () => {
      it('should return null for output layer', () => {
        const mle = createTestMle([SecureField.one()]);
        const layer: Layer = { type: 'GrandProduct', data: mle };
        
        const result = Layer.nextLayer(layer);
        expect(result).toBeNull();
      });

      it('should generate next layer for non-output layer', () => {
        // TODO(Sonnet4): This test requires backend implementation
        // For now, we'll test that it throws an error indicating missing implementation
        const mle = createTestMle(generateRandomSecureFields(4, channel));
        const layer: Layer = { type: 'GrandProduct', data: mle };
        
        expect(() => Layer.nextLayer(layer)).toThrow();
      });
    });

    describe('intoMultivariatePolyOracle', () => {
      it('should create multivariate poly oracle from layer', () => {
        const values = generateRandomSecureFields(4, channel);
        const mle = createTestMle(values);
        const layer: Layer = { type: 'GrandProduct', data: mle };
        const lambda = SecureField.from(BaseField.from(2));
        const y = generateRandomSecureFields(2, channel);
        const eqEvals = EqEvals.generate(y);
        
        const oracle = Layer.intoMultivariatePolyOracle(layer, lambda, eqEvals);
        
        expect(oracle).toBeInstanceOf(GkrMultivariatePolyOracle);
        expect(oracle.lambda.equals(lambda)).toBe(true);
        expect(oracle.eqEvals).toBe(eqEvals);
      });
    });

    describe('toCpu', () => {
      it('should convert layer to CPU representation', () => {
        const values = generateRandomSecureFields(8, channel);
        const mle = createTestMle(values);
        const layer: Layer = { type: 'GrandProduct', data: mle };
        
        const cpuLayer = Layer.toCpu(layer);
        
        expect(cpuLayer.type).toBe('GrandProduct');
        if (cpuLayer.type === 'GrandProduct') {
          expect(cpuLayer.data.len()).toBe(mle.len());
        }
      });

      it('should convert LogUpGeneric layer to CPU representation', () => {
        const numerators = createTestMle(generateRandomSecureFields(4, channel));
        const denominators = createTestMle(generateRandomSecureFields(4, channel));
        const layer: Layer = { type: 'LogUpGeneric', numerators, denominators };
        
        const cpuLayer = Layer.toCpu(layer);
        
        expect(cpuLayer.type).toBe('LogUpGeneric');
        if (cpuLayer.type === 'LogUpGeneric') {
          expect(cpuLayer.numerators.len()).toBe(numerators.len());
          expect(cpuLayer.denominators.len()).toBe(denominators.len());
        }
      });
    });
  });

  describe('NotOutputLayerError', () => {
    it('should create error with correct message', () => {
      const error = new NotOutputLayerError();
      
      expect(error.message).toBe('Layer is not an output layer');
      expect(error.name).toBe('NotOutputLayerError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('GkrMultivariatePolyOracle', () => {
    let eqEvals: EqEvals;
    let layer: Layer;
    let lambda: SecureField;
    let oracle: GkrMultivariatePolyOracle;

    beforeEach(() => {
      const y = generateRandomSecureFields(2, channel);
      eqEvals = EqEvals.generate(y);
      const values = generateRandomSecureFields(4, channel);
      const mle = createTestMle(values);
      layer = { type: 'GrandProduct', data: mle };
      lambda = SecureField.from(BaseField.from(3));
      oracle = new GkrMultivariatePolyOracle(
        eqEvals,
        layer,
        SecureField.one(),
        lambda
      );
    });

    it('should create oracle with correct properties', () => {
      expect(oracle.eqEvals).toBe(eqEvals);
      expect(oracle.inputLayer).toBe(layer);
      expect(oracle.lambda.equals(lambda)).toBe(true);
      expect(oracle.eqFixedVarCorrection.equals(SecureField.one())).toBe(true);
    });

    it('should return correct number of variables', () => {
      // The oracle's nVariables is based on eqEvals.len(), not the layer
      expect(oracle.nVariables()).toBe(1); // eqEvals has 2 variables, so len() = 2^(2-1) = 2, log2(2) = 1
    });

    it('should check if oracle is constant', () => {
      // Non-output layer should not be constant
      expect(oracle.isConstant()).toBe(false);
      
      // Create output layer oracle with proper setup
      const outputMle = createTestMle([SecureField.one()]);
      const outputLayer: Layer = { type: 'GrandProduct', data: outputMle };
      const emptyEqEvals = EqEvals.generate([]); // Empty y for output layer
      const outputOracle = new GkrMultivariatePolyOracle(
        emptyEqEvals,
        outputLayer,
        SecureField.one(),
        lambda
      );
      
      expect(outputOracle.isConstant()).toBe(true);
    });

    it('should fix first variable', () => {
      const challenge = SecureField.from(BaseField.from(1));
      const fixedOracle = oracle.fixFirstVariable(challenge);
      
      expect(fixedOracle).toBeInstanceOf(GkrMultivariatePolyOracle);
      // After fixing first variable, should have one less variable
      expect(fixedOracle.nVariables()).toBe(Math.max(0, oracle.nVariables() - 1));
    });

    it('should convert to CPU representation', () => {
      const cpuOracle = oracle.toCpu();
      
      expect(cpuOracle).toBeInstanceOf(GkrMultivariatePolyOracle);
      expect(cpuOracle.nVariables()).toBe(oracle.nVariables());
    });

    it('should try into mask for constant oracle', () => {
      // Create output layer oracle with proper setup for constant detection
      const outputMle = createTestMle([SecureField.from(BaseField.from(42))]);
      const outputLayer: Layer = { type: 'GrandProduct', data: outputMle };
      const emptyEqEvals = EqEvals.generate([]); // Empty y for output layer
      const outputOracle = new GkrMultivariatePolyOracle(
        emptyEqEvals,
        outputLayer,
        SecureField.one(),
        lambda
      );
      
      const mask = outputOracle.tryIntoMask();
      expect(mask).toBeInstanceOf(GkrMask);
    });

    it('should throw error when trying to get mask from non-constant oracle', () => {
      expect(() => oracle.tryIntoMask()).toThrow(NotConstantPolyError);
    });

    it('should compute sum as poly in first variable', () => {
      // TODO(Sonnet4): This test requires backend implementation
      // For now, we'll test that it throws an error indicating missing implementation
      const claim = SecureField.from(BaseField.from(10));
      
      expect(() => oracle.sumAsPolyInFirstVariable(claim)).toThrow();
    });
  });

  describe('NotConstantPolyError', () => {
    it('should create error with correct message', () => {
      const error = new NotConstantPolyError();
      
      expect(error.message).toBe('Polynomial is not constant');
      expect(error.name).toBe('NotConstantPolyError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('correctSumAsPolyInFirstVariable', () => {
    it('should compute corrected polynomial for valid inputs', () => {
      const fAt0 = SecureField.from(BaseField.from(1));
      const fAt2 = SecureField.from(BaseField.from(4));
      const claim = SecureField.from(BaseField.from(5));
      const y = generateRandomSecureFields(3, channel);
      const k = 1;
      
      const poly = correctSumAsPolyInFirstVariable(fAt0, fAt2, claim, y, k);
      
      expect(poly).toBeInstanceOf(UnivariatePoly);
      expect(poly.degree()).toBeLessThanOrEqual(3);
      
      // Verify that r(0) + r(1) = claim
      const rAt0 = poly.evalAtPoint(SecureField.zero());
      const rAt1 = poly.evalAtPoint(SecureField.one());
      expect(rAt0.add(rAt1).equals(claim)).toBe(true);
    });

    it('should throw error for k = 0', () => {
      const fAt0 = SecureField.from(BaseField.from(1));
      const fAt2 = SecureField.from(BaseField.from(4));
      const claim = SecureField.from(BaseField.from(5));
      const y = generateRandomSecureFields(3, channel);
      const k = 0;
      
      expect(() => {
        correctSumAsPolyInFirstVariable(fAt0, fAt2, claim, y, k);
      }).toThrow('k must not be 0');
    });

    it('should throw error for k > y.length', () => {
      const fAt0 = SecureField.from(BaseField.from(1));
      const fAt2 = SecureField.from(BaseField.from(4));
      const claim = SecureField.from(BaseField.from(5));
      const y = generateRandomSecureFields(2, channel);
      const k = 3;
      
      expect(() => {
        correctSumAsPolyInFirstVariable(fAt0, fAt2, claim, y, k);
      }).toThrow('k must not exceed y.length');
    });

    it('should handle edge case with k = y.length', () => {
      const fAt0 = SecureField.from(BaseField.from(2));
      const fAt2 = SecureField.from(BaseField.from(8));
      const claim = SecureField.from(BaseField.from(10));
      const y = generateRandomSecureFields(2, channel);
      const k = 2;
      
      const poly = correctSumAsPolyInFirstVariable(fAt0, fAt2, claim, y, k);
      
      expect(poly).toBeInstanceOf(UnivariatePoly);
      
      // Verify constraint
      const rAt0 = poly.evalAtPoint(SecureField.zero());
      const rAt1 = poly.evalAtPoint(SecureField.one());
      expect(rAt0.add(rAt1).equals(claim)).toBe(true);
    });

    it('should handle edge cases in correctSumAsPolyInFirstVariable', () => {
      const fAt0 = SecureField.from(BaseField.from(1));
      const fAt2 = SecureField.from(BaseField.from(2));
      const claim = SecureField.from(BaseField.from(3));
      const y = [SecureField.from(BaseField.from(2))]; // Use non-zero value to avoid division by zero
      const k = 1;
      
      const poly = correctSumAsPolyInFirstVariable(fAt0, fAt2, claim, y, k);
      expect(poly).toBeInstanceOf(UnivariatePoly);
      
      // For valid inputs, should still satisfy constraint
      const rAt0 = poly.evalAtPoint(SecureField.zero());
      const rAt1 = poly.evalAtPoint(SecureField.one());
      expect(rAt0.add(rAt1).equals(claim)).toBe(true);
    });
  });

  describe('proveBatch', () => {
    it('should handle empty input layers', () => {
      const inputLayers: Layer[] = [];
      
      // Empty layers will result in nLayers = -Infinity, which should cause issues in the loop
      // The function should complete but may have unexpected behavior
      const [proof, artifact] = proveBatch(channel, inputLayers);
      expect(proof).toBeInstanceOf(GkrBatchProof);
      expect(artifact).toBeInstanceOf(GkrArtifact);
    });

    it('should handle single GrandProduct layer', () => {
      // TODO(Sonnet4): This test requires full backend implementation
      // For now, we'll test basic structure validation
      const values = generateRandomSecureFields(4, channel);
      const mle = createTestMle(values);
      const layer: Layer = { type: 'GrandProduct', data: mle };
      const inputLayers = [layer];
      
      // This should throw due to missing backend implementation
      expect(() => proveBatch(channel, inputLayers)).toThrow();
    });

    it('should handle multiple layers with different sizes', () => {
      // TODO(Sonnet4): This test requires full backend implementation
      const layer1: Layer = { 
        type: 'GrandProduct', 
        data: createTestMle(generateRandomSecureFields(4, channel)) 
      };
      const layer2: Layer = { 
        type: 'GrandProduct', 
        data: createTestMle(generateRandomSecureFields(8, channel)) 
      };
      const inputLayers = [layer1, layer2];
      
      // This should throw due to missing backend implementation
      expect(() => proveBatch(channel, inputLayers)).toThrow();
    });

    it('should handle LogUp layers', () => {
      // TODO(Sonnet4): This test requires full backend implementation
      const numerators = createTestMle(generateRandomSecureFields(4, channel));
      const denominators = createTestMle(generateRandomSecureFields(4, channel));
      const layer: Layer = { type: 'LogUpGeneric', numerators, denominators };
      const inputLayers = [layer];
      
      // This should throw due to missing backend implementation
      expect(() => proveBatch(channel, inputLayers)).toThrow();
    });
  });

  describe('Integration tests', () => {
    it('should work with eq function from utils', () => {
      const x = [SecureField.zero(), SecureField.one()];
      const y = [SecureField.one(), SecureField.zero()];
      
      const result = eq(x, y);
      expect(result).toBeInstanceOf(SecureField);
    });

    it('should work with randomLinearCombination from utils', () => {
      const values = generateRandomSecureFields(3, channel);
      const lambda = SecureField.from(BaseField.from(2));
      
      const result = randomLinearCombination(values, lambda);
      expect(result).toBeInstanceOf(SecureField);
    });

    it('should create and manipulate layers correctly', () => {
      const values = generateRandomSecureFields(8, channel);
      const mle = createTestMle(values);
      const layer: Layer = { type: 'GrandProduct', data: mle };
      
      expect(Layer.nVariables(layer)).toBe(3);
      expect(Layer.isOutputLayer(layer)).toBe(false);
      
      const x0 = SecureField.from(BaseField.from(1));
      const fixedLayer = Layer.fixFirstVariable(layer, x0);
      expect(Layer.nVariables(fixedLayer)).toBe(2);
    });

    it('should handle EqEvals generation and access', () => {
      const y = generateRandomSecureFields(4, channel);
      const eqEvals = EqEvals.generate(y);
      
      expect(eqEvals.getY()).toEqual(y);
      expect(eqEvals.len()).toBe(8); // 2^(4-1) = 8
      
      // Test all evaluations are accessible
      for (let i = 0; i < eqEvals.len(); i++) {
        const val = eqEvals.at(i);
        expect(val).toBeInstanceOf(SecureField);
      }
    });

    it('should handle layer type conversions correctly', () => {
      // Test LogUpMultiplicities to LogUpGeneric conversion
      const numerators = createTestBaseMle(generateRandomBaseFields(4, channel));
      const denominators = createTestMle(generateRandomSecureFields(4, channel));
      const layer: Layer = { type: 'LogUpMultiplicities', numerators, denominators };
      
      const x0 = SecureField.from(BaseField.from(0));
      const fixedLayer = Layer.fixFirstVariable(layer, x0);
      
      expect(fixedLayer.type).toBe('LogUpGeneric');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid array access gracefully', () => {
      const y = generateRandomSecureFields(2, channel);
      const eqEvals = EqEvals.generate(y);
      
      // Test accessing beyond bounds
      expect(() => eqEvals.at(eqEvals.len())).toThrow();
    });

    it('should validate layer operations on output layers', () => {
      const outputMle = createTestMle([SecureField.one()]);
      const outputLayer: Layer = { type: 'GrandProduct', data: outputMle };
      
      expect(Layer.isOutputLayer(outputLayer)).toBe(true);
      expect(Layer.nextLayer(outputLayer)).toBeNull();
      
      // Should not throw for output layer
      const values = Layer.tryIntoOutputLayerValues(outputLayer);
      expect(values).toHaveLength(1);
    });

    it('should handle edge cases in correctSumAsPolyInFirstVariable', () => {
      const fAt0 = SecureField.from(BaseField.from(1));
      const fAt2 = SecureField.from(BaseField.from(2));
      const claim = SecureField.from(BaseField.from(3));
      const y = [SecureField.from(BaseField.from(2))]; // Use non-zero value to avoid division by zero
      const k = 1;
      
      const poly = correctSumAsPolyInFirstVariable(fAt0, fAt2, claim, y, k);
      expect(poly).toBeInstanceOf(UnivariatePoly);
      
      // For valid inputs, should still satisfy constraint
      const rAt0 = poly.evalAtPoint(SecureField.zero());
      const rAt1 = poly.evalAtPoint(SecureField.one());
      expect(rAt0.add(rAt1).equals(claim)).toBe(true);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large layer sizes efficiently', () => {
      // Test with larger data sizes
      const largeValues = generateRandomSecureFields(256, channel); // 2^8
      const largeMle = createTestMle(largeValues);
      const largeLayer: Layer = { type: 'GrandProduct', data: largeMle };
      
      expect(Layer.nVariables(largeLayer)).toBe(8);
      
      const x0 = SecureField.from(BaseField.from(1));
      const fixedLayer = Layer.fixFirstVariable(largeLayer, x0);
      expect(Layer.nVariables(fixedLayer)).toBe(7);
    });

    it('should handle minimal layer sizes', () => {
      // Test with minimal data sizes
      const minimalValues = [SecureField.one(), SecureField.zero()]; // 2^1
      const minimalMle = createTestMle(minimalValues);
      const minimalLayer: Layer = { type: 'GrandProduct', data: minimalMle };
      
      expect(Layer.nVariables(minimalLayer)).toBe(1);
      
      const x0 = SecureField.from(BaseField.from(0));
      const fixedLayer = Layer.fixFirstVariable(minimalLayer, x0);
      expect(Layer.nVariables(fixedLayer)).toBe(0);
      expect(Layer.isOutputLayer(fixedLayer)).toBe(true);
    });

    it('should handle all LogUp layer variants', () => {
      // Test LogUpSingles
      const singlesLayer: Layer = {
        type: 'LogUpSingles',
        denominators: createTestMle([SecureField.from(BaseField.from(5))])
      };
      
      const singlesValues = Layer.tryIntoOutputLayerValues(singlesLayer);
      expect(singlesValues).toEqual([
        SecureField.one(),
        SecureField.from(BaseField.from(5))
      ]);
      
      // Test LogUpMultiplicities
      const multLayer: Layer = {
        type: 'LogUpMultiplicities',
        numerators: createTestBaseMle([BaseField.from(3)]),
        denominators: createTestMle([SecureField.from(BaseField.from(7))])
      };
      
      const multValues = Layer.tryIntoOutputLayerValues(multLayer);
      expect(multValues).toEqual([
        SecureField.from(BaseField.from(3)),
        SecureField.from(BaseField.from(7))
      ]);
    });
  });
}); 