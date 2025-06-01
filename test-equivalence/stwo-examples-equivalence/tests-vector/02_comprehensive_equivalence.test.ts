import { describe, test, expect } from "bun:test";
import { fromSpreadsheetToTracePolynomials } from "../typescript-examples/02_from_spreadsheet_to_trace_polynomials";
import type { TableConfig } from "../typescript-examples/02_from_spreadsheet_to_trace_polynomials";
import comprehensiveRustVectors from "./comprehensive_rust_test_vectors.json";

describe("02_from_spreadsheet_to_trace_polynomials: Comprehensive Rust-TypeScript Equivalence", () => {
  const rustExample = comprehensiveRustVectors["02_from_spreadsheet_to_trace_polynomials"];
  
  if (!rustExample) {
    throw new Error("Rust example data not found in test vectors");
  }

  const config: TableConfig = {
    col1_val0: rustExample.input.col1_val0,
    col1_val1: rustExample.input.col1_val1,
    col2_val0: rustExample.input.col2_val0,
    col2_val1: rustExample.input.col2_val1,
  };

  const result = fromSpreadsheetToTracePolynomials(config);
  const expected = rustExample.output;

  // Basic structure tests
  test("should have correct basic structure", () => {
    expect(result.numRows).toBe(expected.num_rows);
    expect(result.logNumRows).toBe(expected.log_num_rows);
  });

  // Domain tests
  test("should have correct domain configuration", () => {
    expect(result.domain.logSize()).toBe(expected.domain.log_size);
    expect(result.domain.size()).toBe(expected.domain.size);
  });

  // Column data tests - test the actual values at key positions
  test("should have correct column values", () => {
    expect(result.col1.at(0).value).toBe(config.col1_val0);
    expect(result.col1.at(1).value).toBe(config.col1_val1);
    expect(result.col2.at(0).value).toBe(config.col2_val0);
    expect(result.col2.at(1).value).toBe(config.col2_val1);
    
    // Test remaining values are zero
    for (let i = 2; i < result.col1.len(); i++) {
      expect(result.col1.at(i).value).toBe(0);
      expect(result.col2.at(i).value).toBe(0);
    }
  });

  // Trace tests
  test("should have correct trace structure", () => {
    expect(result.trace.length).toBe(2);
    expect(result.trace[0]?.domain.logSize()).toBe(expected.domain.log_size);
    expect(result.trace[0]?.domain.size()).toBe(expected.domain.size);
  });

  // Trace values test
  test("should preserve column data in trace", () => {
    // Test that trace preserves the column data
    expect(result.trace[0]?.values[0]?.value).toBe(config.col1_val0);
    expect(result.trace[0]?.values[1]?.value).toBe(config.col1_val1);
    expect(result.trace[1]?.values[0]?.value).toBe(config.col2_val0);
    expect(result.trace[1]?.values[1]?.value).toBe(config.col2_val1);
    
    // Test remaining values are zero
    if (result.trace[0] && result.trace[1]) {
      for (let i = 2; i < result.trace[0].values.length; i++) {
        expect(result.trace[0].values[i]?.value).toBe(0);
        expect(result.trace[1].values[i]?.value).toBe(0);
      }
    }
  });

  // Data integrity tests
  test("should preserve data integrity from columns to trace", () => {
    if (result.trace[0] && result.trace[1]) {
      // Verify column data is correctly preserved in trace
      for (let i = 0; i < result.col1.len(); i++) {
        expect(result.trace[0].values[i]?.value).toBe(result.col1.at(i).value);
        expect(result.trace[1].values[i]?.value).toBe(result.col2.at(i).value);
      }
      
      // Verify trace domains match the main domain
      expect(result.trace[0].domain.logSize()).toBe(result.domain.logSize());
      expect(result.trace[0].domain.size()).toBe(result.domain.size());
      expect(result.trace[1].domain.logSize()).toBe(result.domain.logSize());
      expect(result.trace[1].domain.size()).toBe(result.domain.size());
    }
  });

  // Configuration test
  test("should use the provided configuration", () => {
    expect(result.config).toEqual(config);
  });
}); 