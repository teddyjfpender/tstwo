import { describe, test, expect } from "bun:test";
import { committingToTheTracePolynomials } from "../typescript-examples/03_committing_to_the_trace_polynomials";
import type { TableConfig } from "../typescript-examples/03_committing_to_the_trace_polynomials";
import comprehensiveRustVectors from "./comprehensive_rust_test_vectors.json";

describe("03_committing_to_the_trace_polynomials: Comprehensive Rust-TypeScript Equivalence", () => {
  const rustExample = comprehensiveRustVectors["03_committing_to_the_trace_polynomials"];
  
  if (!rustExample) {
    throw new Error("Rust example data not found in test vectors");
  }

  const config: TableConfig = {
    col1_val0: rustExample.input.col1_val0,
    col1_val1: rustExample.input.col1_val1,
    col2_val0: rustExample.input.col2_val0,
    col2_val1: rustExample.input.col2_val1,
  };

  const result = committingToTheTracePolynomials(config);
  const expected = rustExample.output;

  // Basic structure tests
  test("should have correct basic structure", () => {
    expect(result.numRows).toBe(expected.num_rows);
    expect(result.logNumRows).toBe(expected.log_num_rows);
  });

  // Column data tests
  test("should have correct column 1 data", () => {
    expect(result.col1.data).toEqual(expected.col1.data);
    expect(result.col1.length).toBe(expected.col1.length);
  });

  test("should have correct column 2 data", () => {
    expect(result.col2.data).toEqual(expected.col2.data);
    expect(result.col2.length).toBe(expected.col2.length);
  });

  // Domain tests
  test("should have correct domain configuration", () => {
    expect(result.domain.logSize).toBe(expected.domain.log_size);
    expect(result.domain.size).toBe(expected.domain.size);
  });

  // Trace tests
  test("should have correct trace structure", () => {
    expect(result.trace.length).toBe(expected.trace.length);
    expect(result.trace[0]?.domain.logSize).toBe(expected.trace.polynomials[0]?.domain.log_size as number);
    expect(result.trace[0]?.domain.size).toBe(expected.trace.polynomials[0]?.domain.size as number);
    expect(result.trace[0]?.values).toEqual(expected.trace.polynomials[0]?.values as number[]);
    expect(result.trace[1]?.values).toEqual(expected.trace.polynomials[1]?.values as number[]);
  });

  // Configuration tests
  test("should have correct FRI configuration", () => {
    expect(result.config.log_blowup_factor).toBe(expected.config.log_blowup_factor);
    expect(result.config.log_last_layer_degree_bound).toBe(expected.config.log_last_layer_degree_bound);
    expect(result.config.n_queries).toBe(expected.config.n_queries);
    expect(result.config.security_bits).toBe(expected.config.security_bits);
  });

  test("should have correct PCS configuration", () => {
    expect(result.pcsConfig.pow_bits).toBe(expected.pcs_config.pow_bits);
    expect(result.pcsConfig.security_bits).toBe(expected.pcs_config.security_bits);
    expect(result.pcsConfig.fri_config.log_blowup_factor).toBe(expected.pcs_config.fri_config.log_blowup_factor);
    expect(result.pcsConfig.fri_config.log_last_layer_degree_bound).toBe(expected.pcs_config.fri_config.log_last_layer_degree_bound);
  });

  // Twiddle computation tests
  test("should have correct twiddle domain configuration", () => {
    expect(result.twidleDomainLogSize).toBe(expected.twiddle_domain_log_size);
    expect(result.twidleDomainSize).toBe(expected.twiddle_domain_size);
  });

  // Enhanced cryptographic tests
  test("should have correct twiddle analysis", () => {
    expect(result.twiddles.log_size).toBe(expected.twiddles.log_size);
    expect(result.twiddles.size).toBe(expected.twiddles.size);
    expect(result.twidleAnalysis.computation_complexity).toBe(expected.twiddle_analysis.computation_complexity);
    expect(result.twidleAnalysis.memory_usage).toBe(expected.twiddle_analysis.memory_usage);
  });

  test("should have correct channel analysis", () => {
    expect(result.channel.type).toBe(expected.channel.type);
    expect(result.channelAnalysis.entropy_sources).toEqual(expected.channel_analysis.entropy_sources);
    expect(result.channelAnalysis.randomness_quality).toBe(expected.channel_analysis.randomness_quality);
    expect(result.channelAnalysis.state_transitions).toBe(expected.channel_analysis.state_transitions);
  });

  test("should have correct commitment scheme steps", () => {
    expect(result.commitmentScheme.steps.length).toBe(expected.commitment_scheme.steps.length);
    expect(result.commitmentScheme.steps[0]?.step_name).toBe(expected.commitment_scheme.steps[0]?.step_name as string);
    expect(result.commitmentScheme.steps[1]?.step_name).toBe(expected.commitment_scheme.steps[1]?.step_name as string);
    expect(result.commitmentScheme.steps[2]?.step_name).toBe(expected.commitment_scheme.steps[2]?.step_name as string);
  });

  test("should have correct merkle tree data", () => {
    expect(result.commitmentScheme.trees.length).toBe(expected.commitment_scheme.trees.length);
    expect(result.commitmentScheme.trees[0]?.tree_id).toBe(expected.commitment_scheme.trees[0]?.tree_id as string);
    expect(result.commitmentScheme.trees[1]?.tree_id).toBe(expected.commitment_scheme.trees[1]?.tree_id as string);
  });

  test("should have correct cryptographic operations count", () => {
    expect(result.commitmentScheme.cryptographic_operations.hash_operations).toBe(expected.commitment_scheme.cryptographic_operations.hash_operations);
    expect(result.commitmentScheme.cryptographic_operations.merkle_tree_constructions).toBe(expected.commitment_scheme.cryptographic_operations.merkle_tree_constructions);
    expect(result.commitmentScheme.cryptographic_operations.commitment_operations).toBe(expected.commitment_scheme.cryptographic_operations.commitment_operations);
  });

  test("should have correct trace analysis", () => {
    expect(result.traceAnalysis.polynomial_count).toBe(expected.trace_analysis.polynomial_count);
    expect(result.traceAnalysis.total_coefficients).toBe(expected.trace_analysis.total_coefficients);
    expect(result.traceAnalysis.non_zero_coefficients).toBe(expected.trace_analysis.non_zero_coefficients);
    expect(result.traceAnalysis.sparsity_ratio).toBe(expected.trace_analysis.sparsity_ratio);
  });

  test("should have correct commitment scheme analysis", () => {
    expect(result.commitmentSchemeAnalysis.total_operations).toBe(expected.commitment_scheme_analysis.total_operations);
    expect(result.commitmentSchemeAnalysis.merkle_trees_created).toBe(expected.commitment_scheme_analysis.merkle_trees_created);
    expect(result.commitmentSchemeAnalysis.security_level).toBe(expected.commitment_scheme_analysis.security_level);
  });

  // Security analysis tests
  test("should have correct security analysis", () => {
    expect(result.commitmentScheme.security_analysis.commitment_binding).toBe(expected.commitment_scheme.security_analysis.commitment_binding);
    expect(result.commitmentScheme.security_analysis.commitment_hiding).toBe(expected.commitment_scheme.security_analysis.commitment_hiding);
    expect(result.commitmentScheme.security_analysis.merkle_tree_security).toBe(expected.commitment_scheme.security_analysis.merkle_tree_security);
  });

  // Channel digest progression tests
  test("should have correct channel digest progression", () => {
    expect(result.channel.digest_progression.length).toBe(expected.channel.digest_progression.length);
    expect(result.channel.digest_progression[0]?.step).toBe(expected.channel.digest_progression[0]?.step as string);
    expect(result.channel.digest_progression[0]?.digest).toBe(expected.channel.digest_progression[0]?.digest as string);
  });

  // Twiddle properties tests
  test("should have correct twiddle properties", () => {
    expect(result.twiddles.properties.is_primitive).toBe(expected.twiddles.properties.is_primitive);
    expect(result.twiddles.properties.order).toBe(expected.twiddles.properties.order);
    expect(result.twiddles.sample_values.length).toBe(expected.twiddles.sample_values.length);
  });
}); 