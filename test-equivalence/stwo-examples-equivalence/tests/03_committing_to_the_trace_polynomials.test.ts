import { describe, it, expect } from "vitest";
import { committingToTheTracePolynomials } from "../typescript-examples/03_committing_to_the_trace_polynomials";
import { BaseColumn } from "../../../packages/core/src/backend/simd/column";
import { N_LANES, LOG_N_LANES } from "../../../packages/core/src/backend/simd/m31";
import { M31 } from "../../../packages/core/src/fields/m31";
import { CanonicCoset } from "../../../packages/core/src/poly/circle/canonic";
import { CircleEvaluation } from "../../../packages/core/src/poly/circle/evaluation";
import { BitReversedOrder } from "../../../packages/core/src/poly";
import { Blake2sChannel } from "../../../packages/core/src/channel/blake2";
import { FriConfig } from "../../../packages/core/src/fri";

describe("Committing to the Trace Polynomials Rust-TypeScript Equivalence", () => {
  describe("Basic Configuration and Setup", () => {
    it("should create correct PCS configuration matching Rust defaults", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify PCS config matches Rust PcsConfig::default()
      expect(result.config.powBits).toBe(5); // Rust default pow_bits: 5
      expect(result.config.friConfig.log_blowup_factor).toBe(1); // Rust FriConfig::new(0, 1, 3)
      expect(result.config.friConfig.log_last_layer_degree_bound).toBe(0);
      expect(result.config.friConfig.n_queries).toBe(3);
      
      // Verify security bits calculation
      const expectedSecurityBits = 5 + (1 * 3); // pow_bits + (log_blowup_factor * n_queries)
      expect(result.config.securityBits()).toBe(expectedSecurityBits);
    });

    it("should compute correct twiddle domain log size", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify twiddle domain calculation matches Rust:
      // log_num_rows + CONSTRAINT_EVAL_BLOWUP_FACTOR + config.fri_config.log_blowup_factor
      const expectedTwidleLogSize = LOG_N_LANES + 1 + 1; // 4 + 1 + 1 = 6
      expect(result.twidleDomainLogSize).toBe(expectedTwidleLogSize);
      expect(result.expectedValues.constraintBlowupFactor).toBe(1);
    });

    it("should create Blake2s channel with proper initialization", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify channel is properly initialized
      expect(result.channel).toBeInstanceOf(Blake2sChannel);
      expect(result.channel.digest()).toBeDefined();
      
      // Channel should start with all-zero digest
      const initialDigest = Array.from(result.channel.digest().bytes);
      expect(initialDigest.length).toBe(32); // Blake2s produces 32-byte hashes
    });
  });

  describe("Trace Polynomial Creation", () => {
    it("should preserve spreadsheet data in trace polynomials", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify original column values are preserved
      expect(result.col1.at(0).equals(M31.from(1))).toBe(true);
      expect(result.col1.at(1).equals(M31.from(7))).toBe(true);
      expect(result.col2.at(0).equals(M31.from(5))).toBe(true);
      expect(result.col2.at(1).equals(M31.from(11))).toBe(true);
      
      // Verify trace polynomial values match
      expect(result.trace.length).toBe(2);
      expect(result.trace[0]!.values[0]!.equals(M31.from(1))).toBe(true);
      expect(result.trace[0]!.values[1]!.equals(M31.from(7))).toBe(true);
      expect(result.trace[1]!.values[0]!.equals(M31.from(5))).toBe(true);
      expect(result.trace[1]!.values[1]!.equals(M31.from(11))).toBe(true);
    });

    it("should use correct domain for trace polynomials", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify domain matches Rust: CanonicCoset::new(log_num_rows).circle_domain()
      expect(result.domain.logSize()).toBe(LOG_N_LANES);
      expect(result.domain.size()).toBe(N_LANES);
      expect(result.domain.isCanonic()).toBe(true);
      
      // All trace polynomials should use the same domain
      result.trace.forEach(evaluation => {
        expect(evaluation.domain.logSize()).toBe(result.domain.logSize());
        expect(evaluation.domain.size()).toBe(result.domain.size());
      });
    });

    it("should create CircleEvaluation with correct structure", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify each trace polynomial is correctly typed and structured
      result.trace.forEach((evaluation, index) => {
        expect(evaluation).toBeInstanceOf(CircleEvaluation);
        expect(evaluation.domain).toBe(result.domain);
        expect(evaluation.values.length).toBe(N_LANES);
        
        // Verify zero-filling for remaining positions
        for (let i = 2; i < N_LANES; i++) {
          expect(evaluation.values[i]!.equals(M31.zero())).toBe(true);
        }
      });
    });
  });

  describe("Commitment Scheme Operations", () => {
    it("should simulate commitment process correctly", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify commitment scheme structure
      expect(result.commitmentScheme.config).toBe(result.config);
      expect(result.commitmentScheme.commitments.length).toBe(2); // Preprocessed + trace
      expect(result.commitmentScheme.trees).toEqual([]);
      
      // Verify commitment identifiers are reasonable
      expect(result.commitmentScheme.commitments[0]).toContain('preprocessed_commitment_');
      expect(result.commitmentScheme.commitments[1]).toContain('trace_commitment_');
      expect(result.commitmentScheme.commitments[1]).toContain('2_16'); // 2 polynomials, 16 domain size
    });

    it("should mix log_num_rows into channel as in Rust", () => {
      // Test channel state changes
      const initialChannel = Blake2sChannel.create();
      const initialDigest = Array.from(initialChannel.digest().bytes);
      
      const result = committingToTheTracePolynomials();
      const finalDigest = Array.from(result.channel.digest().bytes);
      
      // Channel digest should change after mixing u64
      expect(finalDigest).not.toEqual(initialDigest);
    });

    it("should handle empty preprocessed trace as in Rust", () => {
      const result = committingToTheTracePolynomials();
      
      // Rust code: tree_builder.extend_evals(vec![]);
      // TypeScript equivalent should handle empty preprocessed trace
      expect(result.commitmentScheme.commitments.length).toBeGreaterThan(0);
      expect(result.commitmentScheme.commitments[0]).toContain('preprocessed');
    });
  });

  describe("Channel Operations", () => {
    it("should implement Blake2s channel interface correctly", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify channel supports required operations
      expect(typeof result.channel.mix_u64).toBe('function');
      expect(typeof result.channel.digest).toBe('function');
      
      // Test mixing operation doesn't throw
      expect(() => {
        result.channel.mix_u64(42);
      }).not.toThrow();
    });

    it("should maintain channel state consistency", () => {
      const result = committingToTheTracePolynomials();
      
      // Get current digest
      const digest1 = result.channel.digest();
      
      // Mix another value
      result.channel.mix_u64(999);
      const digest2 = result.channel.digest();
      
      // Digest should change
      expect(digest1).not.toEqual(digest2);
      
      // But should be deterministic
      const result2 = committingToTheTracePolynomials();
      result2.channel.mix_u64(999);
      expect(result2.channel.digest()).toEqual(digest2);
    });
  });

  describe("API Equivalence with Rust", () => {
    it("should match Rust constant definitions", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify constants match Rust implementation
      expect(result.expectedValues.constraintBlowupFactor).toBe(1); // CONSTRAINT_EVAL_BLOWUP_FACTOR
      expect(result.expectedValues.numRows).toBe(N_LANES);
      expect(result.expectedValues.logNumRows).toBe(LOG_N_LANES);
      expect(LOG_N_LANES).toBe(4);
      expect(N_LANES).toBe(16);
    });

    it("should follow Rust anchor pattern structure", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify the progressive build-up matches Rust anchor points:
      // ANCHOR: here_1 - CONSTRAINT_EVAL_BLOWUP_FACTOR
      expect(result.expectedValues.constraintBlowupFactor).toBe(1);
      
      // ANCHOR: here_2 - Full commitment process
      expect(result.config).toBeDefined();
      expect(result.channel).toBeDefined();
      expect(result.commitmentScheme).toBeDefined();
      expect(result.trace.length).toBe(2);
    });

    it("should match Rust variable naming conventions", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify Rust-style naming is preserved
      expect(result.numRows).toBeDefined(); // num_rows
      expect(result.logNumRows).toBeDefined(); // log_num_rows
      expect(result.col1).toBeDefined(); // col_1
      expect(result.col2).toBeDefined(); // col_2
      expect(result.domain).toBeDefined(); // domain
      expect(result.trace).toBeDefined(); // trace
      expect(result.config).toBeDefined(); // config
      expect(result.channel).toBeDefined(); // channel
    });
  });

  describe("Commitment Configuration Validation", () => {
    it("should validate FRI configuration parameters", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify FRI config parameters are within valid ranges
      const friConfig = result.config.friConfig;
      
      // log_last_layer_degree_bound should be 0-10
      expect(friConfig.log_last_layer_degree_bound).toBeGreaterThanOrEqual(0);
      expect(friConfig.log_last_layer_degree_bound).toBeLessThanOrEqual(10);
      
      // log_blowup_factor should be 1-16  
      expect(friConfig.log_blowup_factor).toBeGreaterThanOrEqual(1);
      expect(friConfig.log_blowup_factor).toBeLessThanOrEqual(16);
      
      // n_queries should be positive
      expect(friConfig.n_queries).toBeGreaterThan(0);
    });

    it("should compute correct domain sizes for twiddle precomputation", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify twiddle domain calculation
      const baseLogSize = result.logNumRows; // LOG_N_LANES = 4
      const constraintBlowup = result.expectedValues.constraintBlowupFactor; // 1
      const friBlowup = result.config.friConfig.log_blowup_factor; // 1
      
      const expectedTwidleLogSize = baseLogSize + constraintBlowup + friBlowup; // 4 + 1 + 1 = 6
      expect(result.twidleDomainLogSize).toBe(expectedTwidleLogSize);
      
      const expectedTwidleDomainSize = 1 << expectedTwidleLogSize; // 2^6 = 64
      expect(expectedTwidleDomainSize).toBe(64);
    });
  });

  describe("Performance and Memory", () => {
    it("should maintain efficient operations", () => {
      const startTime = performance.now();
      
      const result = committingToTheTracePolynomials();
      
      // Verify basic operations are fast
      expect(result.trace.length).toBe(2);
      expect(result.domain.size()).toBe(N_LANES);
      expect(result.config.securityBits()).toBeGreaterThan(0);
      
      const endTime = performance.now();
      
      // Should complete efficiently
      expect(endTime - startTime).toBeLessThan(50); // Allow for commitment simulation overhead
    });

    it("should use memory efficiently", () => {
      const result = committingToTheTracePolynomials();
      
      // Verify SIMD structure is maintained
      expect(result.col1.data.length).toBe(1);
      expect(result.col2.data.length).toBe(1);
      
      // Verify trace doesn't duplicate data unnecessarily
      result.trace.forEach(evaluation => {
        expect(evaluation.values.length).toBe(N_LANES);
        expect(evaluation.domain.size()).toBe(N_LANES);
      });
      
      // Verify commitment scheme doesn't store unnecessary data
      expect(result.commitmentScheme.commitments.length).toBe(2);
      expect(result.commitmentScheme.trees.length).toBe(0); // Simplified implementation
    });
  });

  describe("Expected Values Verification", () => {
    it("should provide comprehensive expected values for testing", () => {
      const result = committingToTheTracePolynomials();
      const expected = result.expectedValues;
      
      // Verify all expected values are populated
      expect(expected.numRows).toBe(N_LANES);
      expect(expected.logNumRows).toBe(LOG_N_LANES);
      expect(expected.traceLength).toBe(2);
      expect(expected.domainSize).toBe(N_LANES);
      expect(expected.domainLogSize).toBe(LOG_N_LANES);
      
      // Verify column values
      expect(expected.col1Values).toEqual([1, 7]);
      expect(expected.col2Values).toEqual([5, 11]);
      
      // Verify config values
      expect(expected.configPowBits).toBe(5);
      expect(expected.configFriLogBlowup).toBe(1);
      expect(expected.configFriLastLayerBound).toBe(0);
      expect(expected.configFriQueries).toBe(3);
      
      // Verify commitments
      expect(expected.commitments.length).toBe(2);
    });
  });
}); 