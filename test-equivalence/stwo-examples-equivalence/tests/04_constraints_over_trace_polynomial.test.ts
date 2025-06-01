import { describe, it, expect } from "vitest";
import { constraintsOverTracePolynomial } from "../typescript-examples/04_constraints_over_trace_polynomial";
import { BaseColumn } from "../../../packages/core/src/backend/simd/column";
import { N_LANES, LOG_N_LANES } from "../../../packages/core/src/backend/simd/m31";
import { M31 } from "../../../packages/core/src/fields/m31";
import { QM31 } from "../../../packages/core/src/fields/qm31";
import { CanonicCoset } from "../../../packages/core/src/poly/circle/canonic";
import { CircleEvaluation } from "../../../packages/core/src/poly/circle/evaluation";
import { BitReversedOrder } from "../../../packages/core/src/poly";

describe("Constraints Over Trace Polynomial Rust-TypeScript Equivalence", () => {
  describe("Basic Three-Column Structure", () => {
    it("should create three columns as in Rust", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify three columns are created (col1, col2, col3)
      expect(result.col1).toBeInstanceOf(BaseColumn);
      expect(result.col2).toBeInstanceOf(BaseColumn);
      expect(result.col3).toBeInstanceOf(BaseColumn);
      expect(result.trace.length).toBe(3); // Three columns in trace
    });

    it("should enforce constraint col3 = col1 * col2 + col1", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify constraint is satisfied at position 0: col3[0] = col1[0] * col2[0] + col1[0]
      const col1Val0 = result.col1.at(0); // 1
      const col2Val0 = result.col2.at(0); // 5  
      const col3Val0 = result.col3.at(0); // Should be 1 * 5 + 1 = 6
      const expected0 = col1Val0.mul(col2Val0).add(col1Val0);
      expect(col3Val0.equals(expected0)).toBe(true);
      expect(result.expectedCol3Values[0]).toBe(6);
      
      // Verify constraint is satisfied at position 1: col3[1] = col1[1] * col2[1] + col1[1]  
      const col1Val1 = result.col1.at(1); // 7
      const col2Val1 = result.col2.at(1); // 11
      const col3Val1 = result.col3.at(1); // Should be 7 * 11 + 7 = 84
      const expected1 = col1Val1.mul(col2Val1).add(col1Val1);
      expect(col3Val1.equals(expected1)).toBe(true);
      expect(result.expectedCol3Values[1]).toBe(84);
    });

    it("should maintain same dimensions across all columns", () => {
      const result = constraintsOverTracePolynomial();
      
      // All columns should have same dimensions
      expect(result.col1.len()).toBe(N_LANES);
      expect(result.col2.len()).toBe(N_LANES);
      expect(result.col3.len()).toBe(N_LANES);
      
      // All trace evaluations should have same domain (compare by log size and size)
      expect(result.trace[0]?.domain.logSize()).toBe(result.domain.logSize());
      expect(result.trace[1]?.domain.logSize()).toBe(result.domain.logSize());
      expect(result.trace[2]?.domain.logSize()).toBe(result.domain.logSize());
    });
  });

  describe("Framework Component Structure", () => {
    it("should create FrameworkComponent with TestEval", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify component is created
      expect(result.component).toBeDefined();
      expect(typeof result.component).toBe('object');
    });

    it("should use correct log_size and blowup factor", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify dimensions match Rust constants
      expect(result.logNumRows).toBe(LOG_N_LANES);
      expect(result.numRows).toBe(N_LANES);
      
      // Verify LOG_N_LANES matches expected value
      expect(LOG_N_LANES).toBe(4);
      expect(N_LANES).toBe(16);
    });

    it("should implement constraint evaluation pattern", () => {
      // Test that constraint evaluation produces expected output
      const logOutput: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logOutput.push(args.join(' '));
      
      try {
        constraintsOverTracePolynomial();
        
        // Should have logged the constraint
        const constraintLog = logOutput.find(line => line.includes('Constraint added:'));
        expect(constraintLog).toBeDefined();
        expect(constraintLog).toContain('col_1 * col_2 + col_1 - col_3');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe("Trace Polynomial Conversion", () => {
    it("should convert all three columns to trace polynomials", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify trace structure
      expect(result.trace.length).toBe(3);
      result.trace.forEach((evaluation, index) => {
        expect(evaluation).toBeInstanceOf(CircleEvaluation);
        expect(evaluation.domain).toBe(result.domain);
        expect(evaluation.values.length).toBe(N_LANES);
      });
    });

    it("should preserve constraint relationship in trace", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify constraint holds in trace evaluations
      const trace0Val0 = result.trace[0]?.values[0]; // col1[0] = 1
      const trace0Val1 = result.trace[0]?.values[1]; // col1[1] = 7
      const trace1Val0 = result.trace[1]?.values[0]; // col2[0] = 5
      const trace1Val1 = result.trace[1]?.values[1]; // col2[1] = 11
      const trace2Val0 = result.trace[2]?.values[0]; // col3[0] = should be 6
      const trace2Val1 = result.trace[2]?.values[1]; // col3[1] = should be 84
      
      expect(trace0Val0).toBeDefined();
      expect(trace0Val1).toBeDefined();
      expect(trace1Val0).toBeDefined();
      expect(trace1Val1).toBeDefined();
      expect(trace2Val0).toBeDefined();
      expect(trace2Val1).toBeDefined();
      
      // Check constraint: col3 = col1 * col2 + col1
      const expected0 = trace0Val0!.mul(trace1Val0!).add(trace0Val0!);
      const expected1 = trace0Val1!.mul(trace1Val1!).add(trace0Val1!);
      
      expect(trace2Val0!.equals(expected0)).toBe(true);
      expect(trace2Val1!.equals(expected1)).toBe(true);
    });

    it("should use canonical domain for all traces", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify all traces use the same canonical domain
      const expectedDomain = CanonicCoset.new(LOG_N_LANES).circleDomain();
      expect(result.domain.logSize()).toBe(expectedDomain.logSize());
      expect(result.domain.isCanonic()).toBe(true);
      
      result.trace.forEach(evaluation => {
        expect(evaluation.domain.logSize()).toBe(result.domain.logSize());
        expect(evaluation.domain.size()).toBe(result.domain.size());
      });
    });
  });

  describe("Field Arithmetic Correctness", () => {
    it("should perform M31 field operations correctly", () => {
      const result = constraintsOverTracePolynomial();
      
      // Test constraint arithmetic matches expected results
      const val1 = M31.from(1);
      const val7 = M31.from(7);
      const val5 = M31.from(5);
      const val11 = M31.from(11);
      
      // Manual computation: 1 * 5 + 1 = 6
      const manual0 = val1.mul(val5).add(val1);
      expect(manual0.value).toBe(6);
      expect(result.col3.at(0).equals(manual0)).toBe(true);
      
      // Manual computation: 7 * 11 + 7 = 84
      const manual1 = val7.mul(val11).add(val7);
      expect(manual1.value).toBe(84);
      expect(result.col3.at(1).equals(manual1)).toBe(true);
    });

    it("should handle zero values in remaining positions", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify remaining positions follow constraint with zeros
      for (let i = 2; i < N_LANES; i++) {
        const col1Val = result.col1.at(i); // 0
        const col2Val = result.col2.at(i); // 0
        const col3Val = result.col3.at(i); // Should be 0 * 0 + 0 = 0
        const expected = col1Val.mul(col2Val).add(col1Val);
        
        expect(col1Val.equals(M31.zero())).toBe(true);
        expect(col2Val.equals(M31.zero())).toBe(true);
        expect(col3Val.equals(expected)).toBe(true);
        expect(col3Val.equals(M31.zero())).toBe(true);
      }
    });
  });

  describe("Framework Trait Implementation", () => {
    it("should implement FrameworkEval interface correctly", () => {
      // Test that the interface methods exist and work
      const result = constraintsOverTracePolynomial();
      
      // The component should have been created successfully
      expect(result.component).toBeDefined();
      
      // Verify that the constraint evaluation was called (via console output)
      const logOutput: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logOutput.push(args.join(' '));
      
      try {
        constraintsOverTracePolynomial();
        
        // Should have setup and constraint messages
        const setupLog = logOutput.find(line => line.includes('Setting up commitment scheme'));
        const constraintLog = logOutput.find(line => line.includes('Constraint added:'));
        
        expect(setupLog).toBeDefined();
        expect(constraintLog).toBeDefined();
      } finally {
        console.log = originalLog;
      }
    });

    it("should use QM31::zero() for claimed_sum as in Rust", () => {
      // This tests the component creation with zero claimed sum
      const result = constraintsOverTracePolynomial();
      
      // Component should be created successfully with QM31::zero()
      expect(result.component).toBeDefined();
      
      // Verify QM31.zero() creates proper zero value
      const zero = QM31.zero();
      expect(zero.c0.real.equals(M31.zero())).toBe(true);
      expect(zero.c0.imag.equals(M31.zero())).toBe(true);
      expect(zero.c1.real.equals(M31.zero())).toBe(true);
      expect(zero.c1.imag.equals(M31.zero())).toBe(true);
    });
  });

  describe("Commitment Scheme Integration", () => {
    it("should simulate commitment scheme setup", () => {
      const logOutput: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logOutput.push(args.join(' '));
      
      try {
        const result = constraintsOverTracePolynomial();
        
        // Verify commitment scheme logging
        const setupLog = logOutput.find(line => line.includes('Setting up commitment scheme'));
        const domainLog = logOutput.find(line => line.includes(`Domain log size: ${LOG_N_LANES}`));
        const columnsLog = logOutput.find(line => line.includes('Trace columns: 3'));
        
        expect(setupLog).toBeDefined();
        expect(domainLog).toBeDefined();
        expect(columnsLog).toBeDefined();
        expect(result.trace.length).toBe(3);
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe("API Compatibility with Rust", () => {
    it("should match Rust naming conventions", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify Rust-style variable names are preserved
      expect(result.numRows).toBeDefined();
      expect(result.logNumRows).toBeDefined();
      expect(result.col1).toBeDefined();
      expect(result.col2).toBeDefined();
      expect(result.col3).toBeDefined();
      expect(result.domain).toBeDefined();
      expect(result.trace).toBeDefined();
      expect(result.component).toBeDefined();
    });

    it("should follow Rust anchor pattern structure", () => {
      // Test that the anchor points (here_1, here_2, here_3, here_4) structure is preserved
      const result = constraintsOverTracePolynomial();
      
      // Verify the progressive build-up matches Rust example:
      // 1. Basic spreadsheet (same as before)
      expect(result.col1.at(0).equals(M31.from(1))).toBe(true);
      expect(result.col1.at(1).equals(M31.from(7))).toBe(true);
      expect(result.col2.at(0).equals(M31.from(5))).toBe(true);
      expect(result.col2.at(1).equals(M31.from(11))).toBe(true);
      
      // 2. Third column with constraint
      expect(result.col3.at(0).value).toBe(6);  // 1 * 5 + 1
      expect(result.col3.at(1).value).toBe(84); // 7 * 11 + 7
      
      // 3. Trace polynomial conversion
      expect(result.trace.length).toBe(3);
      
      // 4. Component creation
      expect(result.component).toBeDefined();
    });
  });

  describe("Performance and Memory", () => {
    it("should maintain efficient operations", () => {
      const startTime = performance.now();
      
      const result = constraintsOverTracePolynomial();
      
      // Verify constraint computations
      for (let i = 0; i < N_LANES; i++) {
        const col1Val = result.col1.at(i);
        const col2Val = result.col2.at(i);
        const col3Val = result.col3.at(i);
        const expected = col1Val.mul(col2Val).add(col1Val);
        expect(col3Val.equals(expected)).toBe(true);
      }
      
      const endTime = performance.now();
      
      // Should complete efficiently
      expect(endTime - startTime).toBeLessThan(10); // Allow more time for complex operations
    });

    it("should use memory efficiently", () => {
      const result = constraintsOverTracePolynomial();
      
      // Verify SIMD structure is maintained across all columns
      expect(result.col1.data.length).toBe(1);
      expect(result.col2.data.length).toBe(1);
      expect(result.col3.data.length).toBe(1);
      
      // Verify trace doesn't duplicate data unnecessarily
      result.trace.forEach(evaluation => {
        expect(evaluation.values.length).toBe(N_LANES);
        expect(evaluation.domain.size()).toBe(N_LANES);
      });
    });
  });
}); 