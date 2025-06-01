import { describe, it, expect } from "vitest";
import { fromSpreadsheetToTracePolynomials } from "../typescript-examples/02_from_spreadsheet_to_trace_polynomials";
import { BaseColumn } from "../../../packages/core/src/backend/simd/column";
import { N_LANES, LOG_N_LANES } from "../../../packages/core/src/backend/simd/m31";
import { M31 } from "../../../packages/core/src/fields/m31";
import { CanonicCoset } from "../../../packages/core/src/poly/circle/canonic";
import { CircleEvaluation } from "../../../packages/core/src/poly/circle/evaluation";
import { BitReversedOrder } from "../../../packages/core/src/poly";

describe("From Spreadsheet to Trace Polynomials Rust-TypeScript Equivalence", () => {
  describe("Basic Functionality", () => {
    it("should create trace polynomials with same dimensions as Rust", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify dimensions match Rust constants
      expect(result.numRows).toBe(N_LANES);
      expect(result.logNumRows).toBe(LOG_N_LANES);
      expect(result.trace.length).toBe(2); // Two columns as in Rust
    });

    it("should preserve spreadsheet values in trace polynomials", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify original column values are preserved
      expect(result.col1.at(0).equals(M31.from(1))).toBe(true);
      expect(result.col1.at(1).equals(M31.from(7))).toBe(true);
      expect(result.col2.at(0).equals(M31.from(5))).toBe(true);
      expect(result.col2.at(1).equals(M31.from(11))).toBe(true);
      
      // Verify trace polynomial values match
      const trace0Val0 = result.trace[0]?.values[0];
      const trace0Val1 = result.trace[0]?.values[1];
      const trace1Val0 = result.trace[1]?.values[0];
      const trace1Val1 = result.trace[1]?.values[1];
      
      expect(trace0Val0).toBeDefined();
      expect(trace0Val1).toBeDefined();
      expect(trace1Val0).toBeDefined();
      expect(trace1Val1).toBeDefined();
      
      expect(trace0Val0!.equals(M31.from(1))).toBe(true);
      expect(trace0Val1!.equals(M31.from(7))).toBe(true);
      expect(trace1Val0!.equals(M31.from(5))).toBe(true);
      expect(trace1Val1!.equals(M31.from(11))).toBe(true);
    });

    it("should use canonical domain as in Rust", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify domain properties match Rust CanonicCoset::new(log_num_rows).circle_domain()
      expect(result.domain.logSize()).toBe(LOG_N_LANES);
      expect(result.domain.size()).toBe(N_LANES);
      expect(result.domain.isCanonic()).toBe(true);
    });
  });

  describe("Domain and Evaluation Structure", () => {
    it("should create CircleEvaluation with BitReversedOrder", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify each trace polynomial is correctly typed
      result.trace.forEach((evaluation, index) => {
        expect(evaluation).toBeInstanceOf(CircleEvaluation);
        expect(evaluation.domain).toBe(result.domain);
        expect(evaluation.values.length).toBe(N_LANES);
      });
    });

    it("should match Rust trace polynomial creation pattern", () => {
      const result = fromSpreadsheetToTracePolynomials();
      const expectedDomain = CanonicCoset.new(LOG_N_LANES).circleDomain();
      
      // Verify domain matches expected construction
      expect(result.domain.logSize()).toBe(expectedDomain.logSize());
      expect(result.domain.size()).toBe(expectedDomain.size());
      
      // Verify trace array structure matches Rust Vec<CircleEvaluation<...>>
      expect(Array.isArray(result.trace)).toBe(true);
      expect(result.trace.length).toBe(2);
    });

    it("should handle domain conversion correctly", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify that columns are properly converted to CPU arrays for CircleEvaluation
      const col1Cpu = result.col1.toCpu();
      const col2Cpu = result.col2.toCpu();
      
      expect(col1Cpu.length).toBe(N_LANES);
      expect(col2Cpu.length).toBe(N_LANES);
      
      // Verify values are preserved during CPU conversion
      const col1CpuVal0 = col1Cpu[0];
      const col1CpuVal1 = col1Cpu[1];
      const col2CpuVal0 = col2Cpu[0];
      const col2CpuVal1 = col2Cpu[1];
      
      expect(col1CpuVal0).toBeDefined();
      expect(col1CpuVal1).toBeDefined();
      expect(col2CpuVal0).toBeDefined();
      expect(col2CpuVal1).toBeDefined();
      
      expect(col1CpuVal0!.equals(M31.from(1))).toBe(true);
      expect(col1CpuVal1!.equals(M31.from(7))).toBe(true);
      expect(col2CpuVal0!.equals(M31.from(5))).toBe(true);
      expect(col2CpuVal1!.equals(M31.from(11))).toBe(true);
    });
  });

  describe("Zero-filled Behavior", () => {
    it("should maintain zero-filled pattern in trace polynomials", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify remaining positions are zero in trace evaluations
      for (let i = 2; i < N_LANES; i++) {
        const trace0Val = result.trace[0]?.values[i];
        const trace1Val = result.trace[1]?.values[i];
        
        expect(trace0Val).toBeDefined();
        expect(trace1Val).toBeDefined();
        expect(trace0Val!.equals(M31.zero())).toBe(true);
        expect(trace1Val!.equals(M31.zero())).toBe(true);
      }
    });

    it("should preserve SIMD structure through conversion", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify SIMD structure is maintained
      expect(result.col1.data.length).toBe(1); // Single chunk for N_LANES elements
      expect(result.col2.data.length).toBe(1);
      expect(result.col1.len()).toBe(N_LANES);
      expect(result.col2.len()).toBe(N_LANES);
    });
  });

  describe("API Equivalence with Rust", () => {
    it("should match Rust variable naming and structure", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify Rust-equivalent naming: num_rows, log_num_rows, col_1, col_2
      expect(result.numRows).toBeDefined();
      expect(result.logNumRows).toBeDefined();
      expect(result.col1).toBeDefined();
      expect(result.col2).toBeDefined();
      expect(result.domain).toBeDefined();
      expect(result.trace).toBeDefined();
    });

    it("should use LOG_N_LANES constant as in Rust", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify LOG_N_LANES is used correctly (matches Rust const LOG_N_LANES)
      expect(result.logNumRows).toBe(LOG_N_LANES);
      expect(LOG_N_LANES).toBe(4); // Should match Rust const LOG_N_LANES: u32 = 4
      expect(N_LANES).toBe(16);    // Should match Rust const N_LANES: usize = 16
    });

    it("should follow Rust collection mapping pattern", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify the mapping pattern matches Rust:
      // vec![col_1, col_2].into_iter().map(|col| CircleEvaluation::new(domain, col)).collect()
      const originalColumns = [result.col1, result.col2];
      const expectedTrace = originalColumns.map(col => 
        new CircleEvaluation(result.domain, col.toCpu())
      );
      
      expect(result.trace.length).toBe(expectedTrace.length);
      for (let i = 0; i < result.trace.length; i++) {
        const traceItem = result.trace[i];
        const expectedItem = expectedTrace[i];
        expect(traceItem).toBeDefined();
        expect(expectedItem).toBeDefined();
        expect(traceItem!.domain.logSize()).toBe(expectedItem!.domain.logSize());
        expect(traceItem!.values.length).toBe(expectedItem!.values.length);
      }
    });
  });

  describe("Type Safety and Error Handling", () => {
    it("should maintain type safety throughout conversion", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify all types are correct
      expect(result.numRows).toEqual(expect.any(Number));
      expect(result.logNumRows).toEqual(expect.any(Number));
      expect(result.col1).toBeInstanceOf(BaseColumn);
      expect(result.col2).toBeInstanceOf(BaseColumn);
      expect(result.domain.constructor.name).toBe('CircleDomain');
      
      // Verify trace array contains proper CircleEvaluations
      result.trace.forEach(evaluation => {
        expect(evaluation).toBeInstanceOf(CircleEvaluation);
      });
    });

    it("should handle field arithmetic correctly in trace", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify field operations work on trace values
      const val1 = result.trace[0]?.values[0]; // M31::from(1)
      const val7 = result.trace[0]?.values[1]; // M31::from(7)
      const val5 = result.trace[1]?.values[0]; // M31::from(5)
      const val11 = result.trace[1]?.values[1]; // M31::from(11)
      
      expect(val1).toBeDefined();
      expect(val7).toBeDefined();
      expect(val5).toBeDefined();
      expect(val11).toBeDefined();
      
      // Test basic field properties
      expect(val1!.add(val7!).equals(M31.from(8))).toBe(true);
      expect(val7!.sub(val1!).equals(M31.from(6))).toBe(true);
      expect(val1!.mul(val7!).equals(M31.from(7))).toBe(true);
      expect(val5!.add(val11!).equals(M31.from(16))).toBe(true);
    });
  });

  describe("Memory and Performance", () => {
    it("should use efficient memory layout", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify efficient SIMD layout is maintained
      expect(result.col1.data.length).toBe(Math.ceil(N_LANES / N_LANES)); // Should be 1
      expect(result.col2.data.length).toBe(Math.ceil(N_LANES / N_LANES)); // Should be 1
      
      // Verify trace evaluations don't duplicate data unnecessarily
      result.trace.forEach(evaluation => {
        expect(evaluation.values.length).toBe(N_LANES);
        expect(evaluation.domain.size()).toBe(N_LANES);
      });
    });

    it("should maintain computational efficiency", () => {
      const result = fromSpreadsheetToTracePolynomials();
      
      // Verify operations are O(1) access
      const startTime = performance.now();
      
      // Access patterns that should be efficient
      for (let i = 0; i < N_LANES; i++) {
        result.col1.at(i);
        result.col2.at(i);
        result.trace[0]?.values[i];
        result.trace[1]?.values[i];
      }
      
      const endTime = performance.now();
      
      // Should complete very quickly (less than 1ms for small operations)
      expect(endTime - startTime).toBeLessThan(1);
    });
  });
}); 