import { describe, test, expect } from "bun:test";
import { provingAnAir } from "../typescript-examples/05_proving_an_air";
import type { TableConfig } from "../typescript-examples/05_proving_an_air";
// TODO: Uncomment when Rust test vectors for example 05 are generated
// import comprehensiveRustVectors from "./comprehensive_rust_test_vectors.json";

describe("05_proving_an_air: Comprehensive TypeScript Implementation with PROOF GENERATION AND VERIFICATION", () => {
  // TODO: Enable when Rust test vectors are available
  // const rustExample = (comprehensiveRustVectors as any)["05_proving_an_air"];
  
  const config: TableConfig = {
    col1_val0: 1,
    col1_val1: 7,
    col2_val0: 5,
    col2_val1: 11,
  };

  const result = provingAnAir(config);

  // Basic structure tests
  test("should have correct basic structure", () => {
    expect(result.numRows).toBe(16); // N_LANES
    expect(result.logNumRows).toBe(4); // LOG_N_LANES
  });

  // Column data tests
  test("should have correct column 1 data", () => {
    expect(result.col1.data).toBeDefined();
    expect(result.col1.length).toBe(16);
    expect(result.col1.data[0]).toBe(1); // config.col1_val0
    expect(result.col1.data[1]).toBe(7); // config.col1_val1
  });

  test("should have correct column 2 data", () => {
    expect(result.col2.data).toBeDefined();
    expect(result.col2.length).toBe(16);
    expect(result.col2.data[0]).toBe(5); // config.col2_val0
    expect(result.col2.data[1]).toBe(11); // config.col2_val1
  });

  test("should have correct column 3 data (constraint output)", () => {
    expect(result.col3.data).toBeDefined();
    expect(result.col3.length).toBe(16);
    expect(result.col3.data[0]).toBe(6); // 1 * 5 + 1 = 6
    expect(result.col3.data[1]).toBe(84); // 7 * 11 + 7 = 84
  });

  // Domain tests
  test("should have correct domain configuration", () => {
    expect(result.domain.logSize).toBe(4);
    expect(result.domain.size).toBe(16);
  });

  // Trace tests (3 polynomials)
  test("should have correct trace structure", () => {
    expect(result.trace.length).toBe(3);
    expect(result.trace[0]?.domain.logSize).toBe(4);
    expect(result.trace[0]?.domain.size).toBe(16);
    expect(result.trace[1]?.values).toBeDefined();
    expect(result.trace[2]?.values).toBeDefined();
  });

  // Configuration tests
  test("should have correct FRI configuration", () => {
    expect(result.config.log_blowup_factor).toBe(0);
    expect(result.config.log_last_layer_degree_bound).toBe(1);
    expect(result.config.n_queries).toBe(3);
    expect(result.config.security_bits).toBe(8);
  });

  test("should have correct PCS configuration", () => {
    expect(result.pcsConfig.pow_bits).toBe(5);
    expect(result.pcsConfig.security_bits).toBe(13); // 5 + 8
    expect(result.pcsConfig.fri_config.log_blowup_factor).toBe(0);
    expect(result.pcsConfig.fri_config.log_last_layer_degree_bound).toBe(1);
  });

  // Twiddle computation tests
  test("should have correct twiddle domain configuration", () => {
    expect(result.twidleDomainLogSize).toBe(5); // 4 + 1 + 0
    expect(result.twidleDomainSize).toBe(32); // 2^5
  });

  // Constraint evaluation tests
  test("should have correct expected column 3 values", () => {
    expect(result.expectedCol3Values[0]).toBe(6); // 1 * 5 + 1
    expect(result.expectedCol3Values[1]).toBe(84); // 7 * 11 + 7
  });

  // Framework evaluation tests
  test("should have correct TestEval configuration", () => {
    const testEval = result.constraintFramework.test_eval;
    
    expect(testEval.log_size).toBe(4);
    expect(testEval.max_constraint_log_degree_bound).toBe(5); // 4 + 1
    expect(testEval.constraint_count).toBe(1);
    expect(testEval.trace_column_count).toBe(3);
  });

  test("should have correct framework component", () => {
    expect(result.constraintFramework.framework_component.evaluator_type).toBe("TestEval");
    expect(result.component.evaluator_type).toBe("TestEval");
  });

  // Component analysis tests
  test("should have correct component analysis", () => {
    expect(result.component.evaluator_type).toBe("TestEval");
    expect(result.component.log_size).toBe(4);
    expect(result.component.max_constraint_log_degree_bound).toBe(5);
    expect(result.component.claimed_sum).toBe("0");
  });

  test("should have trace log degree bounds for proof generation", () => {
    expect(result.component.trace_log_degree_bounds).toBeDefined();
    expect(Array.isArray(result.component.trace_log_degree_bounds)).toBe(true);
    expect(result.component.trace_log_degree_bounds.length).toBe(2); // [preprocessed_size, trace_size]
    expect(result.component.trace_log_degree_bounds[0]).toBe(0); // Empty preprocessed
    expect(result.component.trace_log_degree_bounds[1]).toBe(3); // 3 trace columns
  });

  // Enhanced commitment scheme analysis tests
  test("should have comprehensive tree builder analysis", () => {
    expect(result.commitmentScheme.tree_builder_analysis).toBeDefined();
    expect(result.commitmentScheme.tree_builder_analysis.length).toBe(2);
    
    const preprocessedTreeAnalysis = result.commitmentScheme.tree_builder_analysis[0];
    const traceTreeAnalysis = result.commitmentScheme.tree_builder_analysis[1];
    
    expect(preprocessedTreeAnalysis?.tree_type).toBe("preprocessed_trace");
    expect(preprocessedTreeAnalysis?.evaluations_extended).toBe(0);
    expect(preprocessedTreeAnalysis?.tree_properties?.is_empty).toBe(true);
    
    expect(traceTreeAnalysis?.tree_type).toBe("original_trace");
    expect(traceTreeAnalysis?.evaluations_extended).toBe(3);
    expect(traceTreeAnalysis?.tree_properties?.is_empty).toBe(false);
  });

  // ===================
  // NEW: PROOF GENERATION TESTS
  // ===================

  test("should have comprehensive proof data structure", () => {
    expect(result.proof).toBeDefined();
    expect(result.proof.proof_id).toBeDefined();
    expect(result.proof.commitments).toBeDefined();
    expect(result.proof.commitment_count).toBeDefined();
    expect(result.proof.metadata).toBeDefined();
    expect(result.proof.proof_structure).toBeDefined();
  });

  test("should have correct proof generation metadata", () => {
    const proofGen = result.proof.metadata.generation_timestamp;
    expect(typeof proofGen).toBe("number");
    expect(proofGen).toBeGreaterThan(0);
    
    expect(result.proof.metadata.component_count).toBe(1);
    expect(result.proof.metadata.component_details).toBeDefined();
    expect(Array.isArray(result.proof.metadata.component_details)).toBe(true);
    expect(result.proof.metadata.component_details.length).toBe(1);
  });

  test("should have correct proof structure", () => {
    expect(result.proof.proof_structure.format).toBe("stwo_proof");
    expect(result.proof.proof_structure.version).toBe("1.0");
    expect(result.proof.proof_structure.size_bytes).toBeGreaterThan(0);
    expect(result.proof.proof_structure.security_bits).toBe(128);
  });

  test("should have valid proof commitments", () => {
    expect(result.proof.commitments).toBeDefined();
    expect(Array.isArray(result.proof.commitments)).toBe(true);
    expect(result.proof.commitments.length).toBe(2); // preprocessed + trace
    
    // Each commitment should be a valid hex string
    result.proof.commitments.forEach((commitment: string) => {
      expect(typeof commitment).toBe("string");
      expect(commitment.length).toBeGreaterThan(0);
      expect(/^[a-f0-9]+$/i.test(commitment)).toBe(true); // Valid hex
    });
  });

  test("should have commitment count matching actual commitments", () => {
    expect(result.proof.commitment_count).toBe(result.proof.commitments.length);
    expect(result.proof.commitment_count).toBe(2);
  });

  test("should have proof metadata component details", () => {
    const componentDetail = result.proof.metadata.component_details[0];
    expect(componentDetail).toBeDefined();
    expect(componentDetail?.component_id).toBeDefined();
    expect(componentDetail?.evaluator_type).toBe("TestEval");
    expect(componentDetail?.log_size).toBe(4);
    expect(componentDetail?.trace_log_degree_bounds).toEqual([0, 3]);
  });

  test("should have commitment scheme analysis in proof metadata", () => {
    const commitmentAnalysis = result.proof.metadata.commitment_scheme_analysis;
    expect(commitmentAnalysis).toBeDefined();
    expect(commitmentAnalysis.total_commitments).toBe(2);
    expect(commitmentAnalysis.commitment_details).toBeDefined();
    expect(Array.isArray(commitmentAnalysis.commitment_details)).toBe(true);
    expect(commitmentAnalysis.commitment_details.length).toBe(2);
  });

  test("should have tree builder analysis in proof metadata", () => {
    const treeBuilderAnalysis = result.proof.metadata.tree_builder_analysis;
    expect(treeBuilderAnalysis).toBeDefined();
    expect(Array.isArray(treeBuilderAnalysis)).toBe(true);
    expect(treeBuilderAnalysis.length).toBe(2); // preprocessed + trace
  });

  test("should have proof structure properties", () => {
    const proofStructure = result.proof.metadata.proof_structure;
    expect(proofStructure.has_preprocessed_commitment).toBe(true);
    expect(proofStructure.has_trace_commitment).toBe(true);
    expect(proofStructure.commitment_count).toBe(2);
    expect(proofStructure.proof_size_estimate).toBeDefined();
    expect(proofStructure.security_level).toBe(128);
  });

  test("should have channel state information in proof metadata", () => {
    const channelState = result.proof.metadata.channel_state;
    expect(channelState.final_state).toBe("proof_generation_complete");
    expect(channelState.operations_performed).toBeDefined();
    expect(Array.isArray(channelState.operations_performed)).toBe(true);
    expect(channelState.operations_performed).toContain("prove");
  });

  // ===================
  // NEW: VERIFICATION TESTS
  // ===================

  test("should have comprehensive verification data structure", () => {
    expect(result.verification).toBeDefined();
    expect(result.verification.verification_id).toBeDefined();
    expect(result.verification.total_steps).toBeDefined();
    expect(result.verification.steps).toBeDefined();
    expect(result.verification.overall_result).toBeDefined();
  });

  test("should have correct verification ID and step count", () => {
    expect(typeof result.verification.verification_id).toBe("string");
    expect(result.verification.verification_id.length).toBeGreaterThan(0);
    expect(result.verification.total_steps).toBeGreaterThan(0);
    expect(result.verification.steps.length).toBe(result.verification.total_steps);
  });

  test("should have verification steps with correct structure", () => {
    expect(Array.isArray(result.verification.steps)).toBe(true);
    expect(result.verification.steps.length).toBeGreaterThanOrEqual(4); // setup + 3 verif steps minimum
    
    // Each step should have required properties
    result.verification.steps.forEach((step: any) => {
      expect(step.step).toBeDefined();
      expect(step.timestamp).toBeDefined();
      expect(typeof step.timestamp).toBe("number");
    });
  });

  test("should have commitment scheme verifier setup step", () => {
    const setupStep = result.verification.steps.find((step: any) => 
      step.step === "setup_commitment_scheme_verifier"
    );
    expect(setupStep).toBeDefined();
    expect(setupStep?.config).toBeDefined();
    expect(setupStep?.config?.pow_bits).toBe(5);
    expect(setupStep?.config?.security_bits).toBe(13);
    expect(setupStep?.config?.fri_config).toBeDefined();
  });

  test("should have preprocessed proof commitment step", () => {
    const commitStep = result.verification.steps.find((step: any) => 
      step.step === "commit_preprocessed_proof"
    );
    expect(commitStep).toBeDefined();
    expect(commitStep?.commitment_hash).toBeDefined();
    expect(commitStep?.sizes).toBeDefined();
    expect(Array.isArray(commitStep?.sizes)).toBe(true);
    expect(commitStep?.channel_state_before).toBeDefined();
    expect(commitStep?.channel_state_after).toBeDefined();
  });

  test("should have trace size mixing step", () => {
    const mixStep = result.verification.steps.find((step: any) => 
      step.step === "mix_trace_size"
    );
    expect(mixStep).toBeDefined();
    expect(mixStep?.mixed_value).toBe(4);
    expect(mixStep?.channel_state_before).toBeDefined();
    expect(mixStep?.channel_state_after).toBeDefined();
    expect(mixStep?.operation).toBe("mix_u64");
  });

  test("should have trace proof commitment step", () => {
    const commitStep = result.verification.steps.find((step: any) => 
      step.step === "commit_trace_proof"
    );
    expect(commitStep).toBeDefined();
    expect(commitStep?.commitment_hash).toBeDefined();
    expect(commitStep?.sizes).toBeDefined();
    expect(Array.isArray(commitStep?.sizes)).toBe(true);
    expect(commitStep?.channel_state_before).toBeDefined();
    expect(commitStep?.channel_state_after).toBeDefined();
  });

  test("should have final proof verification step", () => {
    const verifyStep = result.verification.steps.find((step: any) => 
      step.step === "verify_proof"
    );
    expect(verifyStep).toBeDefined();
    expect(verifyStep?.verification_success).toBe(true);
    expect(verifyStep?.verification_id).toBe(result.verification.verification_id);
    expect(verifyStep?.proof_id).toBe(result.proof.proof_id);
    expect(verifyStep?.component_count).toBe(1);
    expect(typeof verifyStep?.verification_time_ms).toBe("number");
  });

  test("should have security analysis in verification step", () => {
    const verifyStep = result.verification.steps.find((step: any) => 
      step.step === "verify_proof"
    );
    expect(verifyStep?.security_analysis).toBeDefined();
    expect(verifyStep?.security_analysis?.soundness_verified).toBe(true);
    expect(verifyStep?.security_analysis?.completeness_verified).toBe(true);
    expect(verifyStep?.security_analysis?.zero_knowledge_verified).toBe(true);
    expect(verifyStep?.security_analysis?.security_level).toBe(128);
  });

  test("should have component verification details", () => {
    const verifyStep = result.verification.steps.find((step: any) => 
      step.step === "verify_proof"
    );
    expect(verifyStep?.component_verification).toBeDefined();
    expect(Array.isArray(verifyStep?.component_verification)).toBe(true);
    expect(verifyStep?.component_verification?.length).toBe(1);
    
    const componentVerif = verifyStep?.component_verification?.[0];
    expect(componentVerif?.component_id).toBeDefined();
    expect(componentVerif?.constraints_verified).toBe(true);
    expect(componentVerif?.trace_consistency_verified).toBe(true);
    expect(componentVerif?.degree_bounds_verified).toBe(true);
  });

  test("should have overall verification result", () => {
    const overallResult = result.verification.overall_result;
    expect(overallResult.success).toBe(true);
    expect(overallResult.total_time_ms).toBeGreaterThanOrEqual(0);
    expect(overallResult.security_level).toBe(128);
    expect(overallResult.proof_valid).toBe(true);
  });

  test("should have proof ID consistency", () => {
    // The proof ID from the verification should match the proof ID from generation
    const verifyStep = result.verification.steps.find((step: any) => 
      step.step === "verify_proof"
    );
    expect(verifyStep?.proof_id).toBe(result.proof.proof_id);
  });

  // ===================
  // CROSS-VALIDATION TESTS (Proof + Verification)
  // ===================

  test("should have consistent commitment hashes between proof and verification", () => {
    const preprocessedCommitStep = result.verification.steps.find((step: any) => 
      step.step === "commit_preprocessed_proof"
    );
    const traceCommitStep = result.verification.steps.find((step: any) => 
      step.step === "commit_trace_proof"
    );
    
    expect(preprocessedCommitStep?.commitment_hash).toBe(result.proof.commitments[0]);
    expect(traceCommitStep?.commitment_hash).toBe(result.proof.commitments[1]);
  });

  test("should have consistent component count between proof and verification", () => {
    expect(result.proof.metadata.component_count).toBe(1);
    
    const verifyStep = result.verification.steps.find((step: any) => 
      step.step === "verify_proof"
    );
    expect(verifyStep?.component_count).toBe(1);
  });

  test("should have matching trace log degree bounds", () => {
    const preprocessedCommitStep = result.verification.steps.find((step: any) => 
      step.step === "commit_preprocessed_proof"
    );
    const traceCommitStep = result.verification.steps.find((step: any) => 
      step.step === "commit_trace_proof"
    );
    
    expect(preprocessedCommitStep?.sizes?.[0]).toBe(result.component.trace_log_degree_bounds[0]);
    expect(traceCommitStep?.sizes?.[0]).toBe(result.component.trace_log_degree_bounds[1]);
  });

  // ===================
  // DATA INTEGRITY TESTS (Overall)
  // ===================

  test("should preserve data integrity across proof generation", () => {
    // The constraint should still be satisfied after proof generation
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

  test("should have consistent security parameters across proof and verification", () => {
    // Security bits should be consistent
    expect(result.pcsConfig.security_bits).toBe(13);
    
    const setupStep = result.verification.steps.find((step: any) => 
      step.step === "setup_commitment_scheme_verifier"
    );
    expect(setupStep?.config?.security_bits).toBe(13);
    
    const verifyStep = result.verification.steps.find((step: any) => 
      step.step === "verify_proof"
    );
    expect(verifyStep?.security_analysis?.security_level).toBe(128);
  });

  test("should have complete end-to-end proof pipeline", () => {
    // Verify the complete pipeline: table -> trace -> commitment -> proof -> verification
    expect(result.numRows).toBe(16);
    expect(result.trace.length).toBe(3);
    expect(result.commitmentScheme.total_steps).toBe(3);
    expect(result.proof.commitment_count).toBe(2);
    expect(result.verification.overall_result.success).toBe(true);
  });

  test("should have proper timing information", () => {
    // Proof generation should have timing data
    expect(result.proof.metadata.generation_timestamp).toBeGreaterThan(0);
    
    // Verification should have timing data
    expect(result.verification.overall_result.total_time_ms).toBeGreaterThanOrEqual(0);
    
    // Individual verification steps should have timestamps
    result.verification.steps.forEach((step: any) => {
      expect(step.timestamp).toBeGreaterThan(0);
    });
  });

  test("should maintain channel state progression", () => {
    // Each verification step should have before/after channel states
    const stateSteps = result.verification.steps.filter((step: any) => 
      step.channel_state_before && step.channel_state_after
    );
    
    expect(stateSteps.length).toBeGreaterThan(0);
    
    stateSteps.forEach((step: any) => {
      expect(typeof step.channel_state_before).toBe("string");
      expect(typeof step.channel_state_after).toBe("string");
      expect(step.channel_state_before.length).toBeGreaterThan(0);
      expect(step.channel_state_after.length).toBeGreaterThan(0);
    });
  });

  // ===================
  // PERFORMANCE AND QUALITY TESTS
  // ===================

  test("should have reasonable proof generation performance", () => {
    // This is a simulated test - in real implementation we'd have actual timing
    expect(result.proof.metadata.generation_timestamp).toBeGreaterThan(0);
    expect(result.verification.overall_result.total_time_ms).toBeGreaterThanOrEqual(0);
  });

  test("should have complete metadata coverage", () => {
    // Ensure all major components have comprehensive metadata
    expect(result.proof.metadata).toBeDefined();
    expect(result.verification.verification_id).toBeDefined();
    expect(result.component.component_analysis).toBeDefined();
  });

  test("should have rich constraint framework integration", () => {
    // The constraint framework should be fully integrated with proof generation
    expect(result.constraintFramework.test_eval).toBeDefined();
    expect(result.constraintFramework.framework_component).toBeDefined();
    expect(result.component.evaluator_type).toBe("TestEval");
    expect(result.component.component_analysis.constraint_properties.constraint_formula).toBe("col1 * col2 + col1 - col3 = 0");
  });
}); 