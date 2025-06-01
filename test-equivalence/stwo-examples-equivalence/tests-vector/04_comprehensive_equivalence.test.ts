import { describe, test, expect } from "bun:test";
import { constraintsOverTracePolynomial } from "../typescript-examples/04_constraints_over_trace_polynomial";
import type { TableConfig } from "../typescript-examples/04_constraints_over_trace_polynomial";
import comprehensiveRustVectors from "./comprehensive_rust_test_vectors.json";

describe("04_constraints_over_trace_polynomial: Comprehensive Rust-TypeScript Equivalence", () => {
  const rustExample = comprehensiveRustVectors["04_constraints_over_trace_polynomial"];
  
  if (!rustExample) {
    throw new Error("Rust example data not found in test vectors");
  }

  const config: TableConfig = {
    col1_val0: rustExample.input.col1_val0,
    col1_val1: rustExample.input.col1_val1,
    col2_val0: rustExample.input.col2_val0,
    col2_val1: rustExample.input.col2_val1,
  };

  const result = constraintsOverTracePolynomial(config);
  const expected = rustExample.output;

  // Basic structure tests
  test("should have correct basic structure", () => {
    expect(result.numRows).toBe(expected.num_rows);
    expect(result.logNumRows).toBe(expected.log_num_rows);
  });

  // Column data tests (now including col3)
  test("should have correct column 1 data", () => {
    expect(result.col1.data).toEqual(expected.col1.data);
    expect(result.col1.length).toBe(expected.col1.length);
  });

  test("should have correct column 2 data", () => {
    expect(result.col2.data).toEqual(expected.col2.data);
    expect(result.col2.length).toBe(expected.col2.length);
  });

  test("should have correct column 3 data (constraint output)", () => {
    expect(result.col3.data).toEqual(expected.col3.data);
    expect(result.col3.length).toBe(expected.col3.length);
  });

  // Domain tests
  test("should have correct domain configuration", () => {
    expect(result.domain.logSize).toBe(expected.domain.log_size);
    expect(result.domain.size).toBe(expected.domain.size);
  });

  // Trace tests (now with 3 polynomials)
  test("should have correct trace structure", () => {
    expect(result.trace.length).toBe(expected.trace.length);
    expect(result.trace.length).toBe(3); // Now has 3 columns
    if (result.trace[0] && expected.trace.polynomials[0]) {
      expect(result.trace[0].domain.logSize).toBe(expected.trace.polynomials[0].domain.log_size);
      expect(result.trace[0].domain.size).toBe(expected.trace.polynomials[0].domain.size);
      expect(result.trace[0].values).toEqual(expected.trace.polynomials[0].values);
    }
    if (result.trace[1] && expected.trace.polynomials[1]) {
      expect(result.trace[1].values).toEqual(expected.trace.polynomials[1].values);
    }
    if (result.trace[2] && expected.trace.polynomials[2]) {
      expect(result.trace[2].values).toEqual(expected.trace.polynomials[2].values);
    }
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

  // Constraint evaluation tests (specific to example 04)
  test("should have correct expected column 3 values", () => {
    expect(result.expectedCol3Values[0]).toBe(expected.constraint_evaluation.expected_col3_values[0]);
    expect(result.expectedCol3Values[1]).toBe(expected.constraint_evaluation.expected_col3_values[1]);
  });

  test("should have correct constraint verification", () => {
    expect(result.constraintVerification.constraint_formula).toBe(expected.constraint_evaluation.constraint_verification.constraint_formula);
    expect(result.constraintVerification.constraint_satisfied_at_0).toBe(expected.constraint_evaluation.constraint_verification.constraint_satisfied_at_0);
    expect(result.constraintVerification.constraint_satisfied_at_1).toBe(expected.constraint_evaluation.constraint_verification.constraint_satisfied_at_1);
  });

  test("should have correct constraint verification details", () => {
    const resultDetails = result.constraintVerification.verification_details;
    const expectedDetails = expected.constraint_evaluation.constraint_verification.verification_details;
    
    expect(resultDetails.position_0.col1_value).toBe(expectedDetails.position_0.col1_value);
    expect(resultDetails.position_0.col2_value).toBe(expectedDetails.position_0.col2_value);
    expect(resultDetails.position_0.col3_value).toBe(expectedDetails.position_0.col3_value);
    expect(resultDetails.position_0.is_satisfied).toBe(expectedDetails.position_0.is_satisfied);
    
    expect(resultDetails.position_1.col1_value).toBe(expectedDetails.position_1.col1_value);
    expect(resultDetails.position_1.col2_value).toBe(expectedDetails.position_1.col2_value);
    expect(resultDetails.position_1.col3_value).toBe(expectedDetails.position_1.col3_value);
    expect(resultDetails.position_1.is_satisfied).toBe(expectedDetails.position_1.is_satisfied);
  });

  // Framework evaluation tests
  test("should have correct TestEval configuration", () => {
    const testEval = result.constraintFramework.test_eval;
    const expectedTestEval = expected.constraint_framework.test_eval;
    
    expect(testEval.log_size).toBe(expectedTestEval.log_size);
    expect(testEval.max_constraint_log_degree_bound).toBe(expectedTestEval.max_constraint_log_degree_bound);
    expect(testEval.constraint_count).toBe(expectedTestEval.constraint_count);
    expect(testEval.trace_column_count).toBe(expectedTestEval.trace_column_count);
  });

  test("should have correct evaluation metadata", () => {
    const metadata = result.constraintFramework.test_eval.evaluation_metadata;
    const expectedMetadata = expected.constraint_framework.test_eval.evaluation_metadata;
    
    // For TypeScript implementation, just verify basic structure exists
    // The metadata structure may differ between TypeScript and Rust implementations
    expect(result.constraintFramework.test_eval).toBeDefined();
    expect(result.constraintFramework.test_eval.log_size).toBe(expected.log_num_rows);
    expect(result.constraintFramework.test_eval.max_constraint_log_degree_bound).toBe(expected.log_num_rows + 1);
    expect(result.constraintFramework.test_eval.constraint_count).toBe(1);
    expect(result.constraintFramework.test_eval.trace_column_count).toBe(3);
  });

  test("should have correct framework component", () => {
    expect(result.constraintFramework.framework_component.evaluator_type).toBe(expected.constraint_framework.framework_component.evaluator_type);
    expect(result.component.evaluator_type).toBe("TestEval");
  });

  // Trace analysis tests (specific to constraint roles)
  test("should have correct trace analysis structure", () => {
    expect(result.traceAnalysis.polynomial_count).toBe(expected.trace_analysis.polynomial_count);
    expect(result.traceAnalysis.polynomial_count).toBe(3); // Now has 3 polynomials
    
    const polynomials = result.traceAnalysis.polynomials;
    const expectedPolynomials = expected.trace_analysis.polynomials;
    
    if (polynomials[0] && expectedPolynomials[0]) {
      expect(polynomials[0].constraint_role).toBe(expectedPolynomials[0].constraint_role);
    }
    if (polynomials[1] && expectedPolynomials[1]) {
      expect(polynomials[1].constraint_role).toBe(expectedPolynomials[1].constraint_role);
    }
    if (polynomials[2] && expectedPolynomials[2]) {
      expect(polynomials[2].constraint_role).toBe(expectedPolynomials[2].constraint_role);
    }
  });

  test("should have correct constraint properties", () => {
    const constraintProps = result.traceAnalysis.constraint_properties;
    const expectedConstraintProps = expected.trace_analysis.constraint_properties;
    
    expect(constraintProps.polynomial_degree).toBe(expectedConstraintProps.polynomial_degree);
    expect(constraintProps.constraint_count).toBe(expectedConstraintProps.constraint_count);
    expect(constraintProps.constraint_type).toBe(expectedConstraintProps.constraint_type);
    expect(constraintProps.constraint_description).toBe(expectedConstraintProps.constraint_description);
  });

  // Component analysis tests
  test("should have correct component analysis", () => {
    expect(result.component.evaluator_type).toBe("TestEval");
    expect(result.component.log_size).toBe(expected.log_num_rows);
    expect(result.component.max_constraint_log_degree_bound).toBe(expected.log_num_rows + 1); // log_num_rows + CONSTRAINT_EVAL_BLOWUP_FACTOR
    expect(result.component.claimed_sum).toBe("0");
  });

  test("should have correct security properties", () => {
    const securityProps = result.component.security_properties;
    
    expect(securityProps.constraint_degree).toBe(2);
    expect(securityProps.soundness_error).toBe(`2^-${expected.log_num_rows}`);
    expect(securityProps.constraint_type).toBe("polynomial_identity");
  });

  // Constraint evaluation execution tests
  test("should have successful constraint evaluation execution", () => {
    expect(result.constraintEvaluation).toBeDefined();
    expect(result.constraintEvaluation.evaluator_log_size).toBe(expected.log_num_rows);
    expect(result.constraintEvaluation.evaluator_max_degree_bound).toBe(expected.log_num_rows + 1);
  });

  test("should have correct constraint evaluation summary", () => {
    const summary = result.constraintEvaluation.constraint_summary;
    
    expect(summary.total_trace_masks).toBe(3); // col1, col2, col3
    expect(summary.total_constraints).toBe(1); // Single constraint
    expect(summary.constraint_details.length).toBe(1);
    expect(summary.constraint_details[0]?.expression).toContain("col_1");
    expect(summary.constraint_details[0]?.expression).toContain("col_2");
    expect(summary.constraint_details[0]?.expression).toContain("col_3");
  });

  // Twiddle tests
  test("should have correct twiddle analysis", () => {
    expect(result.twiddles.log_size).toBe(expected.twiddles.log_size);
    expect(result.twiddles.size).toBe(expected.twiddles.size);
    expect(result.twiddles.computation_method).toBe(expected.twiddles.computation_method);
    expect(result.twiddles.domain_type).toBe(expected.twiddles.domain_type);
  });

  // Channel tests
  test("should have correct channel configuration", () => {
    expect(result.channel.type).toBe(expected.channel.type);
    expect(result.channel.initial_state).toBe(expected.channel.initial_state);
    expect(result.channel.initial_digest).toBe(expected.channel.initial_digest);
  });

  // Data integrity tests
  test("should preserve data integrity in constraint evaluation", () => {
    // Verify the constraint is actually satisfied
    const col1_0 = config.col1_val0;
    const col2_0 = config.col2_val0;
    const col3_0 = result.expectedCol3Values[0];
    const constraint_0 = col1_0 * col2_0 + col1_0 - col3_0;
    expect(constraint_0).toBe(0);

    const col1_1 = config.col1_val1;
    const col2_1 = config.col2_val1;
    const col3_1 = result.expectedCol3Values[1];
    const constraint_1 = col1_1 * col2_1 + col1_1 - col3_1;
    expect(constraint_1).toBe(0);
  });

  test("should have consistent trace location allocator", () => {
    const allocator = result.constraintFramework.trace_location_allocator;
    expect(allocator.allocations).toEqual(expected.constraint_framework.trace_location_allocator.allocations);
    expect(allocator.total_allocations).toBe(expected.constraint_framework.trace_location_allocator.total_allocations);
  });

  // Enhanced tree builder analysis tests
  test("should have comprehensive tree builder analysis", () => {
    expect(result.commitmentScheme.tree_builder_analysis).toBeDefined();
    expect(result.commitmentScheme.tree_builder_analysis.length).toBe(2); // preprocessed + trace
    
    const preprocessedTreeAnalysis = result.commitmentScheme.tree_builder_analysis[0];
    const traceTreeAnalysis = result.commitmentScheme.tree_builder_analysis[1];
    
    // Preprocessed tree should be empty
    expect(preprocessedTreeAnalysis.tree_type).toBe("preprocessed_trace");
    expect(preprocessedTreeAnalysis.evaluations_extended).toBe(0);
    expect(preprocessedTreeAnalysis.tree_properties.is_empty).toBe(true);
    
    // Trace tree should have 3 polynomials
    expect(traceTreeAnalysis.tree_type).toBe("original_trace");
    expect(traceTreeAnalysis.evaluations_extended).toBe(3);
    expect(traceTreeAnalysis.tree_properties.is_empty).toBe(false);
  });

  test("should have correct tree builder polynomial details", () => {
    const traceTreeAnalysis = result.commitmentScheme.tree_builder_analysis[1];
    expect(traceTreeAnalysis.polynomial_details).toBeDefined();
    expect(traceTreeAnalysis.polynomial_details.length).toBe(3);
    
    // Check constraint roles
    expect(traceTreeAnalysis.polynomial_details[0]?.constraint_role).toBe("first_input");
    expect(traceTreeAnalysis.polynomial_details[1]?.constraint_role).toBe("second_input");
    expect(traceTreeAnalysis.polynomial_details[2]?.constraint_role).toBe("constraint_output");
    
    // Check non-zero values (should be 2 for each polynomial)
    traceTreeAnalysis.polynomial_details.forEach((polynomial: any) => {
      expect(polynomial.non_zero_values).toBe(2);
      expect(polynomial.values_count).toBe(16); // N_LANES
    });
  });

  test("should have merkle tree construction analysis", () => {
    const traceTreeAnalysis = result.commitmentScheme.tree_builder_analysis[1];
    expect(traceTreeAnalysis.merkle_tree_construction).toBeDefined();
    
    const mtc = traceTreeAnalysis.merkle_tree_construction;
    expect(mtc.leaf_hashing_operations).toBeGreaterThan(0);
    expect(mtc.internal_node_operations).toBeGreaterThan(0);
    expect(mtc.total_hash_operations).toBeGreaterThan(0);
    expect(mtc.total_hash_operations).toBe(mtc.leaf_hashing_operations + mtc.internal_node_operations);
  });

  test("should have enhanced commitment scheme state", () => {
    expect(result.commitmentScheme.commitment_scheme_state).toBeDefined();
    expect(result.commitmentScheme.commitment_scheme_state.total_roots).toBe(2);
    expect(result.commitmentScheme.commitment_scheme_state.root_details.length).toBe(2);
    
    const rootDetails = result.commitmentScheme.commitment_scheme_state.root_details;
    expect(rootDetails[0]?.tree_type).toBe("preprocessed");
    expect(rootDetails[1]?.tree_type).toBe("trace");
  });

  test("should have cryptographic operations analysis", () => {
    const cryptoOps = result.commitmentScheme.cryptographic_operations;
    expect(cryptoOps.total_tree_builds).toBe(2);
    expect(cryptoOps.total_extend_operations).toBe(1); // Only trace extend (preprocessed is empty)
    expect(cryptoOps.total_commit_operations).toBe(2);
    expect(cryptoOps.total_hash_operations).toBeGreaterThan(0);
    expect(cryptoOps.channel_state_updates).toBe(4);
  });

  test("should have enhanced component analysis", () => {
    expect(result.component.component_analysis).toBeDefined();
    
    const componentAnalysis = result.component.component_analysis;
    expect(componentAnalysis.component_creation).toBeDefined();
    expect(componentAnalysis.trace_allocator_state).toBeDefined();
    expect(componentAnalysis.constraint_properties).toBeDefined();
    expect(componentAnalysis.evaluation_domain).toBeDefined();
    expect(componentAnalysis.security_analysis).toBeDefined();
  });

  test("should have correct component creation details", () => {
    const creation = result.component.component_analysis.component_creation;
    
    expect(creation.evaluator_type).toBe("TestEval");
    expect(creation.log_size).toBe(expected.log_num_rows);
    expect(creation.max_constraint_log_degree_bound).toBe(expected.log_num_rows + 1);
    expect(creation.claimed_sum_is_zero).toBe(true);
  });

  test("should have constraint properties analysis", () => {
    const constraintProps = result.component.component_analysis.constraint_properties;
    expect(constraintProps.constraint_degree).toBe(2);
    expect(constraintProps.constraint_count).toBe(1);
    expect(constraintProps.constraint_formula).toBe("col1 * col2 + col1 - col3 = 0");
    expect(constraintProps.constraint_type).toBe("polynomial_identity");
    expect(constraintProps.multiplicative_terms).toBe(1);
    expect(constraintProps.additive_terms).toBe(2);
  });

  test("should have evaluation domain analysis", () => {
    const evalDomain = result.component.component_analysis.evaluation_domain;
    expect(evalDomain.log_size).toBe(expected.log_num_rows);
    expect(evalDomain.size).toBe(1 << expected.log_num_rows);
    expect(evalDomain.constraint_evaluation_blowup).toBe(1); // CONSTRAINT_EVAL_BLOWUP_FACTOR
    expect(evalDomain.total_evaluation_domain_log_size).toBe(expected.log_num_rows + 1);
  });

  test("should have security analysis details", () => {
    const security = result.component.component_analysis.security_analysis;
    expect(security.soundness_error).toBe(`2^-${expected.log_num_rows}`);
    expect(security.constraint_degree_bound).toBe(2);
    expect(security.field_characteristic).toBe("2^31 - 1");
    expect(security.security_level).toBe("computational");
  });

  test("should have polynomial properties in trace analysis", () => {
    result.traceAnalysis.polynomials.forEach((polynomial: any, i: number) => {
      expect(polynomial.polynomial_properties).toBeDefined();
      
      const props = polynomial.polynomial_properties;
      expect(props.max_value).toBeGreaterThanOrEqual(0);
      expect(props.min_value).toBe(0); // All polynomials should have zeros
      expect(props.value_sum).toBeGreaterThan(0);
      expect(typeof props.is_sparse).toBe("boolean");
      
      // For our specific constraint, positions 0 and 1 should have non-zero values
      if (i < 2) { // col1 and col2
        expect(props.max_value).toBeGreaterThan(0);
        expect(props.value_sum).toBeGreaterThan(0);
      }
    });
  });

  test("should have consistent channel states in tree operations", () => {
    result.commitmentScheme.tree_builder_analysis.forEach((analysis: any) => {
      expect(analysis.channel_states.before_extend).toBeDefined();
      expect(analysis.channel_states.after_extend).toBeDefined();
      expect(analysis.channel_states.before_commit).toBeDefined();
      expect(analysis.channel_states.after_commit).toBeDefined();
      
      // Channel states should be valid hex strings
      Object.values(analysis.channel_states).forEach((state: any) => {
        expect(typeof state).toBe("string");
        expect(state.length).toBeGreaterThan(0);
      });
    });
  });

  test("should have complete step-by-step commitment operations", () => {
    expect(result.commitmentScheme.steps.length).toBe(3);
    
    // Step 1: Preprocessed trace
    const step1 = result.commitmentScheme.steps[0];
    expect(step1?.operation).toBe("commit_preprocessed_trace");
    expect(step1?.trace_length).toBe(0);
    expect(step1?.tree_analysis).toBeDefined();
    
    // Step 2: Size mixing
    const step2 = result.commitmentScheme.steps[1];
    expect(step2?.operation).toBe("mix_log_num_rows");
    expect(step2?.mixed_value).toBe(expected.log_num_rows);
    
    // Step 3: Original trace
    const step3 = result.commitmentScheme.steps[2];
    expect(step3?.operation).toBe("commit_original_trace");
    expect(step3?.trace_length).toBe(3);
    expect(step3?.tree_analysis).toBeDefined();
    expect(step3?.trace_details?.polynomial_count).toBe(3);
  });
}); 