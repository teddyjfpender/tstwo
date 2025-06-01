use std::fs;
use serde_json::{json, Value};
use clap::{Arg, Command};
use stwo_prover::core::{
    backend::{
        simd::{
            column::BaseColumn,
            m31::{LOG_N_LANES, N_LANES},
            SimdBackend,
        },
        Column,
    },
    channel::{Blake2sChannel, Channel},
    fields::m31::M31,
    pcs::{PcsConfig, prover::CommitmentSchemeProver},
    poly::{
        circle::{CanonicCoset, CircleEvaluation},
        BitReversedOrder,
    },
    vcs::blake2_merkle::Blake2sMerkleChannel,
    ColumnVec,
};

// Configuration for table values
#[derive(Debug, Clone)]
struct TableConfig {
    col1_val0: u32,
    col1_val1: u32,
    col2_val0: u32,
    col2_val1: u32,
}

impl Default for TableConfig {
    fn default() -> Self {
        Self {
            col1_val0: 1,
            col1_val1: 7,
            col2_val0: 5,
            col2_val1: 11,
        }
    }
}

// Helper function to create the standard table with configurable values
fn create_standard_table(config: &TableConfig) -> (BaseColumn, BaseColumn) {
    let num_rows = N_LANES;
    
    let mut col_1 = BaseColumn::zeros(num_rows);
    col_1.set(0, M31::from(config.col1_val0));
    col_1.set(1, M31::from(config.col1_val1));

    let mut col_2 = BaseColumn::zeros(num_rows);
    col_2.set(0, M31::from(config.col2_val0));
    col_2.set(1, M31::from(config.col2_val1));
    
    (col_1, col_2)
}

// Helper function to convert M31 to JSON
fn m31_to_json(value: M31) -> Value {
    json!({
        "value": value.0,
        "type": "M31"
    })
}

// Helper function to extract ALL column data comprehensively
fn extract_complete_column_data(col: &BaseColumn) -> Value {
    let all_values: Vec<u32> = (0..col.len())
        .map(|i| col.at(i).0)
        .collect();
    
    // Find non-zero positions for easier testing
    let non_zero_positions: Vec<Value> = (0..col.len())
        .filter_map(|i| {
            let val = col.at(i).0;
            if val != 0 {
                Some(json!({
                    "index": i,
                    "value": val
                }))
            } else {
                None
            }
        })
        .collect();
    
    json!({
        "length": col.len(),
        "data_chunks": col.data.len(),
        "all_values": all_values,
        "non_zero_positions": non_zero_positions,
        "zero_count": all_values.iter().filter(|&&x| x == 0).count(),
        "non_zero_count": all_values.iter().filter(|&&x| x != 0).count()
    })
}

// Helper function to extract ALL trace polynomial data comprehensively
fn extract_complete_trace_data(trace: &ColumnVec<CircleEvaluation<SimdBackend, M31, BitReversedOrder>>) -> Value {
    let polynomials: Vec<Value> = trace.iter().enumerate().map(|(i, evaluation)| {
        let all_values: Vec<u32> = (0..evaluation.values.len()).map(|j| evaluation.values.at(j).0).collect();
        
        // Find non-zero positions
        let non_zero_positions: Vec<Value> = (0..evaluation.values.len())
            .filter_map(|j| {
                let val = evaluation.values.at(j).0;
                if val != 0 {
                    Some(json!({
                        "index": j,
                        "value": val
                    }))
                } else {
                    None
                }
            })
            .collect();
        
        json!({
            "polynomial_index": i,
            "domain": {
                "log_size": evaluation.domain.log_size(),
                "size": evaluation.domain.size()
            },
            "values": {
                "length": all_values.len(),
                "all_values": all_values,
                "non_zero_positions": non_zero_positions,
                "zero_count": all_values.iter().filter(|&&x| x == 0).count(),
                "non_zero_count": all_values.iter().filter(|&&x| x != 0).count(),
                "first_value": all_values.first().copied().unwrap_or(0),
                "second_value": all_values.get(1).copied().unwrap_or(0)
            }
        })
    }).collect();
    
    json!({
        "polynomial_count": trace.len(),
        "polynomials": polynomials,
        "data_integrity": {
            "consistent_domain": trace.iter().all(|t| t.domain.log_size() == trace[0].domain.log_size()),
            "consistent_length": trace.iter().all(|t| t.values.len() == trace[0].values.len())
        }
    })
}

// Helper function to extract domain data comprehensively
fn extract_complete_domain_data(domain: &stwo_prover::core::poly::circle::CircleDomain) -> Value {
    json!({
        "log_size": domain.log_size(),
        "size": domain.size(),
        "is_canonic": true, // CanonicCoset always creates canonic domains
        "size_verification": {
            "expected_size_from_log": 1_usize << domain.log_size(),
            "actual_size": domain.size(),
            "sizes_match": domain.size() == (1_usize << domain.log_size())
        }
    })
}

// Example 1: Writing a Spreadsheet - Comprehensive Data Extraction
fn generate_example_01_vectors(config: &TableConfig) -> Value {
    let num_rows = N_LANES;
    let (col_1, col_2) = create_standard_table(config);

    json!({
        "example": "01_writing_a_spreadsheet",
        "source": "rust_reference_implementation",
        "constants": {
            "N_LANES": N_LANES,
            "num_rows": num_rows
        },
        "input_values": {
            "col1_val0": config.col1_val0,
            "col1_val1": config.col1_val1,
            "col2_val0": config.col2_val0,
            "col2_val1": config.col2_val1
        },
        "columns": {
            "col_1": extract_complete_column_data(&col_1),
            "col_2": extract_complete_column_data(&col_2)
        },
        "comprehensive_verification_data": {
            "all_column_1_values": (0..col_1.len()).map(|i| col_1.at(i).0).collect::<Vec<u32>>(),
            "all_column_2_values": (0..col_2.len()).map(|i| col_2.at(i).0).collect::<Vec<u32>>()
        },
        "metadata": {
            "description": "Comprehensive test vector for basic spreadsheet creation",
            "verification_scope": [
                "Complete column data with all values",
                "SIMD memory layout verification",
                "Zero-padding behavior verification"
            ]
        }
    })
}

// Example 2: From Spreadsheet to Trace Polynomials - Comprehensive Data Extraction
fn generate_example_02_vectors(config: &TableConfig) -> Value {
    let num_rows = N_LANES;
    let log_num_rows = LOG_N_LANES;
    let (col_1, col_2) = create_standard_table(config);

    // Convert table to trace polynomials
    let domain = CanonicCoset::new(log_num_rows).circle_domain();
    let trace: ColumnVec<CircleEvaluation<SimdBackend, M31, BitReversedOrder>> = vec![col_1.clone(), col_2.clone()]
        .into_iter()
        .map(|col| CircleEvaluation::new(domain, col))
        .collect();

    json!({
        "example": "02_from_spreadsheet_to_trace_polynomials",
        "source": "rust_reference_implementation",
        "constants": {
            "N_LANES": N_LANES,
            "LOG_N_LANES": LOG_N_LANES,
            "num_rows": num_rows,
            "log_num_rows": log_num_rows
        },
        "input_values": {
            "col1_val0": config.col1_val0,
            "col1_val1": config.col1_val1,
            "col2_val0": config.col2_val0,
            "col2_val1": config.col2_val1
        },
        "input_columns": {
            "col_1": extract_complete_column_data(&col_1),
            "col_2": extract_complete_column_data(&col_2)
        },
        "domain": extract_complete_domain_data(&domain),
        "trace": extract_complete_trace_data(&trace),
        "data_integrity_checks": {
            "columns_to_trace_preservation": {
                "col_1_to_trace_0": (0..col_1.len()).all(|i| col_1.at(i).0 == trace[0].values.at(i).0),
                "col_2_to_trace_1": (0..col_2.len()).all(|i| col_2.at(i).0 == trace[1].values.at(i).0),
                "trace_length_matches_column_count": trace.len() == 2,
                "trace_value_lengths_match_domain": trace.iter().all(|t| t.values.len() == domain.size())
            },
            "memory_layout_verification": {
                "col_1_chunks": col_1.data.len(),
                "col_2_chunks": col_2.data.len(),
                "expected_chunks_for_n_lanes": if N_LANES <= 16 { 1 } else { (N_LANES + 15) / 16 },
                "chunks_correct": col_1.data.len() == if N_LANES <= 16 { 1 } else { (N_LANES + 15) / 16 }
            }
        },
        "comprehensive_verification_data": {
            "all_column_1_values": (0..col_1.len()).map(|i| col_1.at(i).0).collect::<Vec<u32>>(),
            "all_column_2_values": (0..col_2.len()).map(|i| col_2.at(i).0).collect::<Vec<u32>>(),
            "all_trace_0_values": (0..trace[0].values.len()).map(|i| trace[0].values.at(i).0).collect::<Vec<u32>>(),
            "all_trace_1_values": (0..trace[1].values.len()).map(|i| trace[1].values.at(i).0).collect::<Vec<u32>>()
        },
        "metadata": {
            "description": "Comprehensive test vector from Rust implementation capturing ALL data",
            "verification_scope": [
                "Complete column data with all values",
                "Complete trace polynomial data with all values", 
                "Domain verification with size checks",
                "Data integrity across transformations",
                "Memory layout verification",
                "Comprehensive value preservation checks"
            ],
            "flexibility_features": [
                "Supports any N_LANES size",
                "Captures all values regardless of trace length",
                "Provides non-zero position mapping for sparse verification",
                "Includes data integrity checks for validation"
            ]
        }
    })
}

// Example 3: Committing to the Trace Polynomials - Comprehensive Commitment Scheme Data Extraction
fn generate_example_03_vectors(config: &TableConfig) -> Value {
    const CONSTRAINT_EVAL_BLOWUP_FACTOR: u32 = 1;
    
    let num_rows = N_LANES;
    let log_num_rows = LOG_N_LANES;
    let (col_1, col_2) = create_standard_table(config);

    // Convert table to trace polynomials
    let domain = CanonicCoset::new(log_num_rows).circle_domain();
    let trace: ColumnVec<CircleEvaluation<SimdBackend, M31, BitReversedOrder>> = vec![col_1.clone(), col_2.clone()]
        .into_iter()
        .map(|col| CircleEvaluation::new(domain, col))
        .collect();

    // Config for FRI and PoW
    let config_pcs = PcsConfig::default();

    // Twiddle domain calculation (comprehensive breakdown)
    let twiddle_domain_log_size = log_num_rows + CONSTRAINT_EVAL_BLOWUP_FACTOR + config_pcs.fri_config.log_blowup_factor;
    let twiddle_domain_size = 1u32 << twiddle_domain_log_size;

    // ENHANCED: Actual twiddle computation
    let twiddle_coset = CanonicCoset::new(twiddle_domain_log_size).circle_domain().half_coset;
    let twiddles = SimdBackend::precompute_twiddles(twiddle_coset);
    
    // Extract actual twiddle data
    let twiddle_data = json!({
        "forward_twiddles_count": twiddles.twiddles.len(),
        "inverse_twiddles_count": twiddles.itwiddles.len(),
        "root_coset_log_size": twiddles.root_coset.log_size(),
        "root_coset_size": twiddles.root_coset.size(),
        "first_few_twiddles": twiddles.twiddles.iter().take(8).collect::<Vec<_>>(),
        "first_few_itwiddles": twiddles.itwiddles.iter().take(8).collect::<Vec<_>>()
    });

    // Extract detailed twiddle information
    let twiddle_info = json!({
        "log_size": twiddle_domain_log_size,
        "size": twiddle_domain_size,
        "computation_breakdown": {
            "log_num_rows": log_num_rows,
            "constraint_eval_blowup_factor": CONSTRAINT_EVAL_BLOWUP_FACTOR,
            "fri_log_blowup_factor": config_pcs.fri_config.log_blowup_factor,
            "formula": format!("{} + {} + {} = {}", log_num_rows, CONSTRAINT_EVAL_BLOWUP_FACTOR, config_pcs.fri_config.log_blowup_factor, twiddle_domain_log_size)
        },
        "domain_properties": {
            "log_size": twiddle_domain_log_size,
            "size": twiddle_domain_size,
            "is_canonic": true
        },
        "twiddle_data": twiddle_data
    });

    // ENHANCED: Real commitment scheme operations
    use stwo_prover::core::pcs::prover::CommitmentSchemeProver;
    use stwo_prover::core::vcs::blake2_merkle::Blake2sMerkleChannel;
    
    let channel = &mut Blake2sChannel::default();
    let initial_digest = format!("{:x}", channel.digest());
    let mut commitment_scheme = CommitmentSchemeProver::<SimdBackend, Blake2sMerkleChannel>::new(config_pcs, &twiddles);
    
    // Commitment scheme operations with real cryptographic data
    let mut commitment_scheme_steps = Vec::new();
    let mut merkle_roots = Vec::new();
    let mut channel_states = Vec::new();

    // Step 1: Commit to preprocessed trace (empty)
    channel_states.push(format!("{:x}", channel.digest()));
    let mut tree_builder = commitment_scheme.tree_builder();
    tree_builder.extend_evals(vec![]);
    tree_builder.commit(channel);
    
    let preprocessed_root = format!("{:x}", commitment_scheme.roots()[0]);
    merkle_roots.push(preprocessed_root.clone());
    channel_states.push(format!("{:x}", channel.digest()));
    
    commitment_scheme_steps.push(json!({
        "step": 1,
        "operation": "commit_preprocessed_trace",
        "trace_length": 0,
        "description": "Commit to empty preprocessed trace",
        "merkle_root": preprocessed_root,
        "channel_state_before": channel_states[0],
        "channel_state_after": channel_states[1]
    }));

    // Step 2: Mix size information
    let before_size_mix = format!("{:x}", channel.digest());
    channel.mix_u64(log_num_rows as u64);
    let after_size_mix_digest = format!("{:x}", channel.digest());
    channel_states.push(after_size_mix_digest.clone());
    
    commitment_scheme_steps.push(json!({
        "step": 2,
        "operation": "mix_log_num_rows",
        "mixed_value": log_num_rows,
        "mixed_value_u64": log_num_rows as u64,
        "description": format!("Mix log_num_rows ({}) into channel", log_num_rows),
        "channel_state_before": before_size_mix,
        "channel_state_after": after_size_mix_digest.clone(),
        "channel_operation": "mix_u64",
        "data_mixed": log_num_rows
    }));

    // Step 3: Commit to original trace
    let before_trace_commit = format!("{:x}", channel.digest());
    let mut tree_builder = commitment_scheme.tree_builder();
    tree_builder.extend_evals(trace.clone());
    tree_builder.commit(channel);
    
    let trace_root = format!("{:x}", commitment_scheme.roots()[1]);
    merkle_roots.push(trace_root.clone());
    let after_trace_commit = format!("{:x}", channel.digest());
    channel_states.push(after_trace_commit.clone());
    
    commitment_scheme_steps.push(json!({
        "step": 3,
        "operation": "commit_original_trace",
        "trace_length": trace.len(),
        "trace_polynomials": trace.len(),
        "description": "Commit to the original trace polynomials",
        "merkle_root": trace_root,
        "channel_state_before": before_trace_commit,
        "channel_state_after": after_trace_commit.clone(),
        "trace_details": {
            "polynomial_count": trace.len(),
            "domain_size": domain.size(),
            "domain_log_size": domain.log_size(),
            "values_per_polynomial": trace.first().map(|t| t.values.len()).unwrap_or(0)
        }
    }));

    // Extract comprehensive channel state information with actual digests
    let channel_analysis = json!({
        "initial_state": {
            "digest_string": initial_digest,
            "digest_hex": initial_digest
        },
        "state_progression": channel_states.iter().enumerate().map(|(i, state)| {
            json!({
                "step": i,
                "digest_hex": state,
                "operation": match i {
                    0 => "initial",
                    1 => "after_preprocessed_commit",
                    2 => "after_size_mix",
                    3 => "after_trace_commit",
                    _ => "unknown"
                }
            })
        }).collect::<Vec<_>>(),
        "after_size_mix": {
            "digest_string": after_size_mix_digest.clone(),
            "digest_hex": after_size_mix_digest,
            "mixed_value": log_num_rows,
            "channel_operation": "mix_u64"
        },
        "final_state": {
            "digest_hex": after_trace_commit.clone(),
            "total_operations": commitment_scheme_steps.len(),
            "total_commitments": merkle_roots.len()
        }
    });

    // Extract complete PCS configuration details
    let pcs_config_details = json!({
        "pow_bits": config_pcs.pow_bits,
        "security_bits": config_pcs.security_bits(),
        "fri_config": {
            "log_blowup_factor": config_pcs.fri_config.log_blowup_factor,
            "log_last_layer_degree_bound": config_pcs.fri_config.log_last_layer_degree_bound,
            "n_queries": config_pcs.fri_config.n_queries,
            "security_bits": config_pcs.fri_config.security_bits()
        },
        "derived_values": {
            "total_security_bits": config_pcs.security_bits(),
            "fri_security_contribution": config_pcs.fri_config.security_bits(),
            "pow_security_contribution": config_pcs.pow_bits
        }
    });

    json!({
        "example": "03_committing_to_the_trace_polynomials",
        "source": "rust_reference_implementation",
        "constants": {
            "N_LANES": N_LANES,
            "LOG_N_LANES": LOG_N_LANES,
            "CONSTRAINT_EVAL_BLOWUP_FACTOR": CONSTRAINT_EVAL_BLOWUP_FACTOR,
            "num_rows": num_rows,
            "log_num_rows": log_num_rows
        },
        "input_values": {
            "col1_val0": config.col1_val0,
            "col1_val1": config.col1_val1,
            "col2_val0": config.col2_val0,
            "col2_val1": config.col2_val1
        },
        "input_columns": {
            "col_1": extract_complete_column_data(&col_1),
            "col_2": extract_complete_column_data(&col_2)
        },
        "domain": extract_complete_domain_data(&domain),
        "trace": extract_complete_trace_data(&trace),
        "pcs_config": pcs_config_details,
        "twiddle_computation": twiddle_info,
        "commitment_scheme": {
            "steps": commitment_scheme_steps,
            "total_steps": 3,
            "preprocessed_trace_length": 0,
            "original_trace_length": trace.len(),
            "channel_operations": ["commit_preprocessed", "mix_size", "commit_trace"],
            "merkle_roots": merkle_roots,
            "cryptographic_operations": {
                "hash_operations": merkle_roots.len(),
                "channel_mixes": 1, // Only the size mix
                "merkle_commits": merkle_roots.len(),
                "total_operations": commitment_scheme_steps.len()
            }
        },
        "channel_analysis": channel_analysis,
        "comprehensive_verification_data": {
            "all_column_1_values": (0..col_1.len()).map(|i| col_1.at(i).0).collect::<Vec<u32>>(),
            "all_column_2_values": (0..col_2.len()).map(|i| col_2.at(i).0).collect::<Vec<u32>>(),
            "all_trace_0_values": (0..trace[0].values.len()).map(|i| trace[0].values.at(i).0).collect::<Vec<u32>>(),
            "all_trace_1_values": (0..trace[1].values.len()).map(|i| trace[1].values.at(i).0).collect::<Vec<u32>>(),
            "twiddle_domain_log_size": twiddle_domain_log_size,
            "twiddle_domain_size": twiddle_domain_size,
            "config_pow_bits": config_pcs.pow_bits,
            "config_fri_log_blowup": config_pcs.fri_config.log_blowup_factor,
            "config_fri_last_layer_bound": config_pcs.fri_config.log_last_layer_degree_bound,
            "config_fri_queries": config_pcs.fri_config.n_queries,
            "config_security_bits": config_pcs.security_bits(),
            "initial_channel_digest": initial_digest,
            "after_mix_channel_digest": after_size_mix_digest,
            "final_channel_digest": after_trace_commit,
            // ENHANCED: Real cryptographic data
            "merkle_roots": merkle_roots,
            "preprocessed_root": merkle_roots.get(0).cloned().unwrap_or_default(),
            "trace_root": merkle_roots.get(1).cloned().unwrap_or_default(),
            "channel_states": channel_states,
            "twiddle_forward_count": twiddles.twiddles.len(),
            "twiddle_inverse_count": twiddles.itwiddles.len(),
            "total_cryptographic_operations": commitment_scheme_steps.len() + merkle_roots.len()
        },
        "metadata": {
            "description": "Comprehensive test vector for commitment scheme operations with REAL cryptographic data",
            "verification_scope": [
                "Complete column data with all values",
                "Complete trace polynomial data with all values",
                "Domain verification with size checks",
                "PCS configuration validation",
                "Twiddle domain computation verification",
                "Channel state progression tracking",
                "Commitment scheme step-by-step operations",
                "Data integrity across all transformations",
                "Real cryptographic state verification",
                "Actual twiddle computation data",
                "Real merkle root generation",
                "Authentic channel digest progression"
            ],
            "commitment_features": [
                "Blake2s channel state tracking",
                "FRI configuration validation",
                "Real twiddle precomputation",
                "Actual merkle tree construction",
                "Step-by-step commitment operations",
                "Authentic channel digest progression",
                "Security parameter verification",
                "Real cryptographic commitment scheme"
            ]
        }
    })
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse CLI arguments
    let matches = Command::new("generate_test_vectors")
        .about("Generate comprehensive Rust test vectors for stwo examples equivalence testing")
        .arg(Arg::new("col1-val0")
            .long("col1-val0")
            .value_name("VAL")
            .help("Value for column 1, position 0 (default: 1)")
            .default_value("1"))
        .arg(Arg::new("col1-val1")
            .long("col1-val1")
            .value_name("VAL")
            .help("Value for column 1, position 1 (default: 7)")
            .default_value("7"))
        .arg(Arg::new("col2-val0")
            .long("col2-val0")
            .value_name("VAL")
            .help("Value for column 2, position 0 (default: 5)")
            .default_value("5"))
        .arg(Arg::new("col2-val1")
            .long("col2-val1")
            .value_name("VAL")
            .help("Value for column 2, position 1 (default: 11)")
            .default_value("11"))
        .arg(Arg::new("quick")
            .long("quick")
            .short('q')
            .help("Use shorthand syntax: --quick 1,7,5,11")
            .value_name("VALUES"))
        .get_matches();

    // Parse configuration from CLI arguments
    let config = if let Some(quick_values) = matches.get_one::<String>("quick") {
        let values: Vec<u32> = quick_values
            .split(',')
            .map(|s| s.trim().parse())
            .collect::<Result<Vec<_>, _>>()?;
        
        if values.len() != 4 {
            return Err("Quick format requires exactly 4 values: col1_val0,col1_val1,col2_val0,col2_val1".into());
        }
        
        TableConfig {
            col1_val0: values[0],
            col1_val1: values[1],
            col2_val0: values[2],
            col2_val1: values[3],
        }
    } else {
        TableConfig {
            col1_val0: matches.get_one::<String>("col1-val0").unwrap().parse()?,
            col1_val1: matches.get_one::<String>("col1-val1").unwrap().parse()?,
            col2_val0: matches.get_one::<String>("col2-val0").unwrap().parse()?,
            col2_val1: matches.get_one::<String>("col2-val1").unwrap().parse()?,
        }
    };

    println!("🔧 Generating comprehensive Rust test vectors...");
    println!("📊 Table Configuration:");
    println!("   Column 1: [{}, {}]", config.col1_val0, config.col1_val1);
    println!("   Column 2: [{}, {}]", config.col2_val0, config.col2_val1);
    println!("   Expected constraint values:");
    println!("     col3[0] = {} * {} + {} = {}", config.col1_val0, config.col2_val0, config.col1_val0, config.col1_val0 * config.col2_val0 + config.col1_val0);
    println!("     col3[1] = {} * {} + {} = {}", config.col1_val1, config.col2_val1, config.col1_val1, config.col1_val1 * config.col2_val1 + config.col1_val1);
    
    let test_vectors = json!({
        "generator": "rust_reference_implementation",
        "timestamp": "2024-01-01T00:00:00Z", // Simplified for now
        "table_config": {
            "col1_val0": config.col1_val0,
            "col1_val1": config.col1_val1,
            "col2_val0": config.col2_val0,
            "col2_val1": config.col2_val1
        },
        "examples": {
            "01_writing_a_spreadsheet": generate_example_01_vectors(&config),
            "02_from_spreadsheet_to_trace_polynomials": generate_example_02_vectors(&config),
            "03_committing_to_the_trace_polynomials": generate_example_03_vectors(&config)
        },
        "global_constants": {
            "N_LANES": N_LANES,
            "LOG_N_LANES": LOG_N_LANES
        },
        "metadata": {
            "description": "Comprehensive test vectors from Rust implementation for deep equivalence verification",
            "features": [
                "Complete data capture (all values, not just samples)",
                "Flexible for any configuration changes",
                "Data integrity verification built-in",
                "Memory layout verification included",
                "Comprehensive verification data for thorough testing",
                "CLI configurable table values for testing hardcoded assumptions"
            ]
        }
    });

    // Write comprehensive test vectors to JSON file
    let json_output = serde_json::to_string_pretty(&test_vectors)?;
    fs::write("comprehensive_rust_test_vectors.json", json_output)?;

    println!("✅ Generated comprehensive test vectors");
    println!("📊 Features:");
    println!("  - Complete data capture (all values)");
    println!("  - Flexible for any N_LANES size");
    println!("  - Built-in data integrity checks");
    println!("  - Memory layout verification");
    println!("  - CLI configurable table values");
    println!("📁 Saved to: comprehensive_rust_test_vectors.json");
    println!("📄 Generated examples: 01_writing_a_spreadsheet, 02_from_spreadsheet_to_trace_polynomials, 03_committing_to_the_trace_polynomials");

    Ok(())
} 