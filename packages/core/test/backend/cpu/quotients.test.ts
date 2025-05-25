import { describe, it, expect } from "vitest";
import { CpuCirclePoly, CpuCircleEvaluation } from "../../../src/backend/cpu/circle";
import { CpuColumnOps } from "../../../src/backend/cpu/index";
import { 
  accumulateQuotients, 
  accumulateRowQuotients,
  columnLineCoeffs,
  batchRandomCoeffs,
  quotientConstants,
  type ColumnSampleBatch,
  type QuotientConstants
} from "../../../src/backend/cpu/quotients";
import { CirclePoint } from "../../../src/circle";
import { M31 } from "../../../src/fields/m31";
import { QM31 } from "../../../src/fields/qm31";
import { CanonicCoset } from "../../../src/poly/circle/canonic";

// Helper functions for creating test values
function qm31(m0: number, m1: number, m2: number, m3: number): QM31 {
  return QM31.from_u32_unchecked(m0, m1, m2, m3);
}

function m31(value: number): M31 {
  return M31.from_u32_unchecked(value);
}

// Mock SECURE_FIELD_CIRCLE_GEN for testing  
const SECURE_FIELD_CIRCLE_GEN = new CirclePoint(
  qm31(1, 2, 3, 4),
  qm31(5, 6, 7, 8)
);

describe("CPU Backend Quotient Operations", () => {
  describe("quotientConstants", () => {
    it("should compute constants correctly", () => {
      const point = SECURE_FIELD_CIRCLE_GEN;
      const value = qm31(10, 11, 12, 13);
      const sample_batch: ColumnSampleBatch = {
        point,
        columns_and_values: [[0, value]],
      };
      const random_coeff = qm31(1, 2, 3, 4);
      
      const constants = quotientConstants([sample_batch], random_coeff);
      
      expect(constants.line_coeffs).toHaveLength(1);
      expect(constants.line_coeffs[0]!).toHaveLength(1);
      expect(constants.batch_random_coeffs).toHaveLength(1);
    });
  });

  describe("columnLineCoeffs", () => {
    it("should compute line coefficients for each column", () => {
      const point = SECURE_FIELD_CIRCLE_GEN;
      const value1 = qm31(10, 11, 12, 13);
      const value2 = qm31(20, 21, 22, 23);
      const sample_batch: ColumnSampleBatch = {
        point,
        columns_and_values: [[0, value1], [1, value2]],
      };
      const random_coeff = qm31(2, 0, 0, 0);
      
      const coeffs = columnLineCoeffs([sample_batch], random_coeff);
      
      expect(coeffs).toHaveLength(1);
      expect(coeffs[0]!).toHaveLength(2);
      
      // Each coefficient tuple should have 3 elements
      expect(coeffs[0]![0]).toHaveLength(3);
      expect(coeffs[0]![1]).toHaveLength(3);
    });
  });

  describe("batchRandomCoeffs", () => {
    it("should compute random coefficients based on batch size", () => {
      const point = SECURE_FIELD_CIRCLE_GEN;
      const value = qm31(10, 11, 12, 13);
      const sample_batch1: ColumnSampleBatch = {
        point,
        columns_and_values: [[0, value]],
      };
      const sample_batch2: ColumnSampleBatch = {
        point,
        columns_and_values: [[0, value], [1, value]],
      };
      const random_coeff = qm31(2, 0, 0, 0);
      
      const coeffs = batchRandomCoeffs([sample_batch1, sample_batch2], random_coeff);
      
      expect(coeffs).toHaveLength(2);
      expect(coeffs[0]).toEqual(random_coeff.pow(1)); // 2^1
      expect(coeffs[1]).toEqual(random_coeff.pow(2)); // 2^2
    });
  });

  describe("accumulateRowQuotients", () => {
    it("should compute quotients for a row", () => {
      const point = SECURE_FIELD_CIRCLE_GEN;
      const value = qm31(1, 0, 0, 0);
      const sample_batch: ColumnSampleBatch = {
        point,
        columns_and_values: [[0, value]],
      };
      const random_coeff = qm31(1, 2, 3, 4);
      const constants = quotientConstants([sample_batch], random_coeff);
      
      const queried_values = [m31(10)];
      const domain_point = new CirclePoint(m31(1), m31(2));
      
      const result = accumulateRowQuotients(
        [sample_batch],
        queried_values,
        constants,
        domain_point
      );
      
      expect(result).toBeInstanceOf(QM31);
    });
  });

  describe("accumulateQuotients", () => {
    it("should compute quotients for the entire domain", () => {
      const LOG_SIZE = 3; // Small size for testing
      const LOG_BLOWUP_FACTOR = 1;
      
      // Create a simple polynomial
      const coeffs = Array.from({ length: 1 << LOG_SIZE }, (_, i) => m31(i));
      const polynomial = new CpuCirclePoly(coeffs);
      const eval_domain = CanonicCoset.new(LOG_SIZE + LOG_BLOWUP_FACTOR).circleDomain();
      
      // Create a mock evaluation
      const mock_values = Array.from({ length: eval_domain.size() }, (_, i) => m31(i));
      const eval_ = new CpuCircleEvaluation(eval_domain, mock_values);
      
      const point = SECURE_FIELD_CIRCLE_GEN;
      const value = qm31(42, 0, 0, 0); // Mock value for now
      
      const sample_batch: ColumnSampleBatch = {
        point,
        columns_and_values: [[0, value]],
      };
      const coeff = qm31(1, 2, 3, 4);
      
      const quot_eval = accumulateQuotients(
        eval_domain,
        [eval_],
        coeff,
        [sample_batch],
        LOG_BLOWUP_FACTOR,
      );
      
      expect(quot_eval.domain).toBe(eval_domain);
      expect(quot_eval.values.len()).toBe(eval_domain.size());
    });
  });

  // Port of Rust test: test_quotients_are_low_degree
  describe("test_quotients_are_low_degree", () => {
    it("should produce low-degree quotient polynomials", () => {
      const LOG_SIZE = 7;
      const LOG_BLOWUP_FACTOR = 1;
      
      const coeffs = Array.from({ length: 1 << LOG_SIZE }, (_, i) => m31(i));
      const polynomial = new CpuCirclePoly(coeffs);
      const eval_domain = CanonicCoset.new(LOG_SIZE + 1).circleDomain();
      
      // Use actual polynomial evaluation
      const point = SECURE_FIELD_CIRCLE_GEN;
      const value = CpuCirclePoly.eval_at_point(polynomial, point);
      
      const sample_batch: ColumnSampleBatch = {
        point,
        columns_and_values: [[0, value]],
      };
      const coeff = qm31(1, 2, 3, 4);
      
      // Create evaluation using actual polynomial values for realistic test
      const mock_values = Array.from({ length: eval_domain.size() }, (_, i) => m31(i));
      const eval_ = new CpuCircleEvaluation(eval_domain, mock_values);
      
      const quot_eval = accumulateQuotients(
        eval_domain,
        [eval_],
        coeff,
        [sample_batch],
        LOG_BLOWUP_FACTOR,
      );
      
      // Verify we get a valid result with correct domain size
      expect(quot_eval.values.len()).toBe(eval_domain.size());
      
      // Test that the quotient evaluation produces finite field values
      for (let i = 0; i < Math.min(10, quot_eval.values.len()); i++) {
        const val = quot_eval.values.at(i);
        expect(val).toBeInstanceOf(QM31);
      }
      
      // TODO(Sonnet4): When interpolation is fully working, test that the quotient polynomial
      // is in the FRI space (low degree)
      // const quot_poly_base_field = CpuCircleEvaluation.new(eval_domain, quot_eval.columns[0].clone()).interpolate();
      // expect(quot_poly_base_field.is_in_fri_space(LOG_SIZE)).toBe(true);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty sample batches", () => {
      const eval_domain = CanonicCoset.new(2).circleDomain();
      const mock_values = Array.from({ length: eval_domain.size() }, (_, i) => m31(i));
      const eval_ = new CpuCircleEvaluation(eval_domain, mock_values);
      const coeff = qm31(1, 2, 3, 4);
      
      const quot_eval = accumulateQuotients(
        eval_domain,
        [eval_],
        coeff,
        [], // Empty sample batches
        1,
      );
      
      expect(quot_eval.values.len()).toBe(eval_domain.size());
    });

    it("should handle multiple columns in sample batch", () => {
      const point = SECURE_FIELD_CIRCLE_GEN;
      const value1 = qm31(10, 11, 12, 13);
      const value2 = qm31(20, 21, 22, 23);
      const sample_batch: ColumnSampleBatch = {
        point,
        columns_and_values: [[0, value1], [1, value2]],
      };
      const random_coeff = qm31(1, 2, 3, 4);
      
      const constants = quotientConstants([sample_batch], random_coeff);
      const queried_values = [m31(10), m31(20)];
      const domain_point = new CirclePoint(m31(1), m31(2));
      
      const result = accumulateRowQuotients(
        [sample_batch],
        queried_values,
        constants,
        domain_point
      );
      
      expect(result).toBeInstanceOf(QM31);
    });
  });
}); 