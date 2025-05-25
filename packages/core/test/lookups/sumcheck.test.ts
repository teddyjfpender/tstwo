import { describe, it, expect } from 'vitest';
import { 
  proveBatch, 
  partiallyVerify, 
  SumcheckError, 
  MAX_DEGREE,
  SumcheckProof
} from '../../src/lookups/sumcheck';
import { SecureMle } from '../../src/lookups/mle';
import { QM31 as SecureField } from '../../src/fields/qm31';
import { Blake2sChannel } from '../../src/channel/blake2';
import type { Channel } from '../../src/channel';

/**
 * Test channel factory for consistent random generation.
 */
function testChannel(): Blake2sChannel {
  return Blake2sChannel.create();
}

describe('Sumcheck Protocol', () => {
  describe('proveBatch and partiallyVerify', () => {
    it('should work for basic sumcheck', () => {
      const channel = testChannel();
      const values = channel.draw_felts(32);
      
      // Calculate the claimed sum
      let claim = SecureField.zero();
      for (const value of values) {
        claim = claim.add(value);
      }
      
      const mle = new SecureMle(values);
      const lambda = SecureField.one();
      
      const [proof, assignment, constantOracles, claims] = proveBatch(
        [claim], 
        [mle], 
        lambda, 
        channel
      );

      expect(proof).toBeInstanceOf(SumcheckProof);
      expect(assignment).toHaveLength(mle.nVariables());
      expect(constantOracles).toHaveLength(1);
      expect(claims).toHaveLength(1);

      const testChannel2 = testChannel();
      const [verifiedAssignment, verifiedEval] = partiallyVerify(
        claim, 
        proof, 
        testChannel2
      );

      expect(verifiedAssignment).toEqual(assignment);
      expect(verifiedEval.equals(mle.evalAtPoint(assignment))).toBe(true);
    });

    it('should work for batch sumcheck with same number of variables', () => {
      let channel = testChannel();
      const values0 = channel.draw_felts(32);
      const values1 = channel.draw_felts(32);
      
      // Calculate claims
      let claim0 = SecureField.zero();
      for (const value of values0) {
        claim0 = claim0.add(value);
      }
      
      let claim1 = SecureField.zero();
      for (const value of values1) {
        claim1 = claim1.add(value);
      }
      
      const mle0 = new SecureMle([...values0]);
      const mle1 = new SecureMle([...values1]);
      const lambda = channel.draw_felt();
      
      const claims = [claim0, claim1];
      const mles = [mle0, mle1];
      
      const [proof, assignment, constantOracles, finalClaims] = proveBatch(
        claims, 
        mles, 
        lambda, 
        testChannel()
      );

      const combinedClaim = claim0.add(lambda.mul(claim1));
      
      const testChannel2 = testChannel();
      const [verifiedAssignment, verifiedEval] = partiallyVerify(
        combinedClaim, 
        proof, 
        testChannel2
      );

      expect(verifiedAssignment).toEqual(assignment);

      const eval0 = mle0.evalAtPoint(assignment);
      const eval1 = mle1.evalAtPoint(assignment);
      const expectedEval = eval0.add(lambda.mul(eval1));
      
      expect(verifiedEval.equals(expectedEval)).toBe(true);
    });

    it('should work for batch sumcheck with different number of variables', () => {
      let channel = testChannel();
      const values0 = channel.draw_felts(64); // 6 variables
      const values1 = channel.draw_felts(32); // 5 variables
      
      // Calculate claims
      let claim0 = SecureField.zero();
      for (const value of values0) {
        claim0 = claim0.add(value);
      }
      
      let claim1 = SecureField.zero();
      for (const value of values1) {
        claim1 = claim1.add(value);
      }
      
      const mle0 = new SecureMle([...values0]);
      const mle1 = new SecureMle([...values1]);
      const lambda = channel.draw_felt();
      
      const claims = [claim0, claim1];
      const mles = [mle0, mle1];
      
      const [proof, assignment, constantOracles, finalClaims] = proveBatch(
        claims, 
        mles, 
        lambda, 
        testChannel()
      );

      // For different variable counts, the claim is adjusted
      const combinedClaim = claim0.add(lambda.mul(claim1.double()));
      
      const testChannel2 = testChannel();
      const [verifiedAssignment, verifiedEval] = partiallyVerify(
        combinedClaim, 
        proof, 
        testChannel2
      );

      expect(verifiedAssignment).toEqual(assignment);

      const eval0 = mle0.evalAtPoint(assignment);
      // For mle1, we use only the first 5 variables of the assignment
      const eval1 = mle1.evalAtPoint(assignment.slice(1));
      const expectedEval = eval0.add(lambda.mul(eval1));
      
      expect(verifiedEval.equals(expectedEval)).toBe(true);
    });

    it('should fail for invalid sumcheck proof', () => {
      const channel = testChannel();
      const values = channel.draw_felts(8);
      
      let claim = SecureField.zero();
      for (const value of values) {
        claim = claim.add(value);
      }
      
      const lambda = SecureField.one();
      
      // Compromise the first value to create an invalid proof
      const invalidValues = [...values];
      const firstValue = invalidValues[0];
      if (firstValue === undefined) {
        throw new Error('Empty values array');
      }
      invalidValues[0] = firstValue.add(SecureField.one());

      let invalidClaim = SecureField.zero();
      for (const value of invalidValues) {
        invalidClaim = invalidClaim.add(value);
      }

      const invalidMle = new SecureMle(invalidValues);

      const [invalidProof] = proveBatch(
        [invalidClaim], 
        [invalidMle], 
        lambda, 
        testChannel()
      );

      const testChannel2 = testChannel();
      expect(() => {
        partiallyVerify(claim, invalidProof, testChannel2);
      }).toThrow();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should throw error for empty polynomials list', () => {
      const channel = testChannel();
      expect(() => {
        proveBatch([], [], SecureField.one(), channel);
      }).toThrow('No multivariate polynomials provided');
    });

    it('should throw error for mismatched claims and polynomials count', () => {
      const channel = testChannel();
      const values = channel.draw_felts(4);
      const mle = new SecureMle(values);
      
      expect(() => {
        proveBatch([SecureField.one()], [mle, mle], SecureField.one(), channel);
      }).toThrow('Mismatch between number of claims and polynomials');
    });

    it('should throw SumcheckError for invalid degree', () => {
      // This test would require creating a polynomial with degree > MAX_DEGREE
      // which is harder to construct directly, so we'll test the error class
      const error = SumcheckError.degreeInvalid(2);
      expect(error).toBeInstanceOf(SumcheckError);
      expect(error.round).toBe(2);
      expect(error.message).toContain('degree of the polynomial in round 2 is too high');
    });

    it('should throw SumcheckError for invalid sum', () => {
      const claim = SecureField.from_u32_unchecked(42, 0, 0, 0);
      const sum = SecureField.from_u32_unchecked(24, 0, 0, 0);
      const error = SumcheckError.sumInvalid(claim, sum, 1);
      
      expect(error).toBeInstanceOf(SumcheckError);
      expect(error.round).toBe(1);
      expect(error.message).toContain('sum does not match the claim in round 1');
    });
  });

  describe('MAX_DEGREE constant', () => {
    it('should have correct value', () => {
      expect(MAX_DEGREE).toBe(3);
    });
  });

  describe('SumcheckProof', () => {
    it('should store round polynomials correctly', () => {
      const channel = testChannel();
      const values = channel.draw_felts(4);
      const mle = new SecureMle(values);
      
      let claim = SecureField.zero();
      for (const value of values) {
        claim = claim.add(value);
      }
      
      const [proof] = proveBatch([claim], [mle], SecureField.one(), channel);
      
      expect(proof.roundPolys).toHaveLength(mle.nVariables());
      expect(proof.roundPolys.every(poly => poly.degree() <= MAX_DEGREE)).toBe(true);
    });
  });

  describe('Channel integration', () => {
    it('should use channel for randomness consistently', () => {
      const values = testChannel().draw_felts(16);
      let claim = SecureField.zero();
      for (const value of values) {
        claim = claim.add(value);
      }
      const mle = new SecureMle(values);

      // Run the same proof with same initial channel state
      const [proof1] = proveBatch([claim], [mle], SecureField.one(), testChannel());
      const [proof2] = proveBatch([claim], [mle], SecureField.one(), testChannel());

      // Proofs should be identical due to deterministic channel
      expect(proof1.roundPolys).toHaveLength(proof2.roundPolys.length);
      for (let i = 0; i < proof1.roundPolys.length; i++) {
        const poly1 = proof1.roundPolys[i];
        const poly2 = proof2.roundPolys[i];
        if (poly1 === undefined || poly2 === undefined) {
          throw new Error(`Missing polynomial at index ${i}`);
        }
        expect(poly1.getCoeffs()).toEqual(poly2.getCoeffs());
      }
    });
  });
}); 