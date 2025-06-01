use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use stwo_prover::core::fields::m31::{M31, P, pow2147483645};
use stwo_prover::core::fields::cm31::{CM31, P2};
use stwo_prover::core::fields::qm31::{QM31, P4, R, SecureField};
use stwo_prover::core::fields::secure_column::{SecureColumnByCoords, SECURE_EXTENSION_DEGREE};
use stwo_prover::core::fields::{IntoSlice, FieldExpOps, ComplexConjugate};
use stwo_prover::core::backend::{CpuBackend, Col, Column};
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use num_traits::{Zero, One};

#[derive(Serialize, Deserialize, Debug)]
struct TestVector {
    operation: String,
    inputs: HashMap<String, serde_json::Value>,
    intermediates: HashMap<String, serde_json::Value>,
    output: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
struct FieldTestVectors {
    description: String,
    field_type: String,
    field_modulus: serde_json::Value,
    test_vectors: Vec<TestVector>,
}

fn main() {
    // Generate test vectors for all field types
    let mut all_test_vectors = Vec::new();
    
    // M31 field test vectors
    let mut m31_vectors = Vec::new();
    generate_m31_vectors(&mut m31_vectors);
    all_test_vectors.push(FieldTestVectors {
        description: "Test vectors for M31 field operations".to_string(),
        field_type: "M31".to_string(),
        field_modulus: serde_json::Value::Number(P.into()),
        test_vectors: m31_vectors,
    });
    
    // CM31 field test vectors
    let mut cm31_vectors = Vec::new();
    generate_cm31_vectors(&mut cm31_vectors);
    all_test_vectors.push(FieldTestVectors {
        description: "Test vectors for CM31 field operations".to_string(),
        field_type: "CM31".to_string(),
        field_modulus: serde_json::Value::String(P2.to_string()),
        test_vectors: cm31_vectors,
    });
    
    // QM31 field test vectors
    let mut qm31_vectors = Vec::new();
    generate_qm31_vectors(&mut qm31_vectors);
    all_test_vectors.push(FieldTestVectors {
        description: "Test vectors for QM31 field operations".to_string(),
        field_type: "QM31".to_string(),
        field_modulus: serde_json::Value::String(P4.to_string()),
        test_vectors: qm31_vectors,
    });
    
    // Secure column test vectors
    let mut secure_column_vectors = Vec::new();
    generate_secure_column_vectors(&mut secure_column_vectors);
    all_test_vectors.push(FieldTestVectors {
        description: "Test vectors for SecureColumn operations".to_string(),
        field_type: "SecureColumn".to_string(),
        field_modulus: serde_json::Value::String(P4.to_string()),
        test_vectors: secure_column_vectors,
    });

    // Write individual field test vector files
    for field_vectors in &all_test_vectors {
        let filename = format!("../../test-vectors/{}-test-vectors.json", field_vectors.field_type.to_lowercase());
        let json = serde_json::to_string_pretty(field_vectors).unwrap();
        std::fs::write(&filename, json).unwrap();
        println!("Generated {} test vectors for {} field operations", 
                field_vectors.test_vectors.len(), field_vectors.field_type);
    }
    
    // Write combined test vectors file
    let combined_json = serde_json::to_string_pretty(&all_test_vectors).unwrap();
    std::fs::write("../../test-vectors/all-field-test-vectors.json", combined_json).unwrap();
    
    let total_vectors: usize = all_test_vectors.iter().map(|f| f.test_vectors.len()).sum();
    println!("Generated {} total test vectors across all field types", total_vectors);
}

fn generate_m31_vectors(test_vectors: &mut Vec<TestVector>) {
    // Generate test vectors for basic operations
    generate_basic_ops_vectors(test_vectors);
    
    // Generate test vectors for construction methods
    generate_construction_vectors(test_vectors);
    
    // Generate test vectors for reduction operations
    generate_reduction_vectors(test_vectors);
    
    // Generate test vectors for inverse operations
    generate_inverse_vectors(test_vectors);
    
    // Generate test vectors for pow2147483645 function
    generate_pow2147483645_vectors(test_vectors);
    
    // Generate test vectors for into_slice operation
    generate_into_slice_vectors(test_vectors);
    
    // Generate test vectors for edge cases
    generate_edge_case_vectors(test_vectors);
}

fn generate_basic_ops_vectors(test_vectors: &mut Vec<TestVector>) {
    let mut rng = SmallRng::seed_from_u64(0);
    
    // Generate 100 random test cases for basic operations
    for i in 0..100 {
        let x: u32 = rng.gen::<u32>() % P;
        let y: u32 = rng.gen::<u32>() % P;
        
        let m31_x = M31::from_u32_unchecked(x);
        let m31_y = M31::from_u32_unchecked(y);
        
        // Addition test vector
        let sum = m31_x + m31_y;
        test_vectors.push(TestVector {
            operation: "add".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a".to_string(), serde_json::Value::Number(x.into()));
                map.insert("b".to_string(), serde_json::Value::Number(y.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Number(sum.0.into()),
        });
        
        // Multiplication test vector
        let product = m31_x * m31_y;
        test_vectors.push(TestVector {
            operation: "mul".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a".to_string(), serde_json::Value::Number(x.into()));
                map.insert("b".to_string(), serde_json::Value::Number(y.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                map.insert("product_u64".to_string(), serde_json::Value::Number(((x as u64) * (y as u64)).into()));
                map
            },
            output: serde_json::Value::Number(product.0.into()),
        });
        
        // Subtraction test vector
        let difference = m31_x - m31_y;
        test_vectors.push(TestVector {
            operation: "sub".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a".to_string(), serde_json::Value::Number(x.into()));
                map.insert("b".to_string(), serde_json::Value::Number(y.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                map.insert("intermediate_sum".to_string(), serde_json::Value::Number((x + P - y).into()));
                map
            },
            output: serde_json::Value::Number(difference.0.into()),
        });
        
        // Negation test vector
        let negated = -m31_x;
        test_vectors.push(TestVector {
            operation: "neg".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a".to_string(), serde_json::Value::Number(x.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Number(negated.0.into()),
        });
    }
}

fn generate_construction_vectors(test_vectors: &mut Vec<TestVector>) {
    // Test from_u32_unchecked
    let test_values = vec![0, 1, 42, 1000, P-1, P/2];
    for (i, &val) in test_values.iter().enumerate() {
        let m31_val = M31::from_u32_unchecked(val);
        test_vectors.push(TestVector {
            operation: "from_u32_unchecked".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("value".to_string(), serde_json::Value::Number(val.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Number(m31_val.0.into()),
        });
    }
    
    // Test from i32 (including negative values)
    let i32_test_values = vec![-1, -10, -100, 0, 1, 10, 100];
    for (i, &val) in i32_test_values.iter().enumerate() {
        let m31_val = M31::from(val);
        test_vectors.push(TestVector {
            operation: "from_i32".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("value".to_string(), serde_json::Value::Number(val.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Number(m31_val.0.into()),
        });
    }
    
    // Test from u32
    let u32_test_values = vec![0, 1, P-1, P, P+1, 2*P-1, (P as u64).pow(2) as u32];
    for (i, &val) in u32_test_values.iter().enumerate() {
        let m31_val = M31::from(val);
        test_vectors.push(TestVector {
            operation: "from_u32".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("value".to_string(), serde_json::Value::Number(val.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Number(m31_val.0.into()),
        });
    }
}

fn generate_reduction_vectors(test_vectors: &mut Vec<TestVector>) {
    // Test partial_reduce
    let partial_reduce_values = vec![0, 1, P-1, P, P+1, 2*P-1];
    for (i, &val) in partial_reduce_values.iter().enumerate() {
        let result = M31::partial_reduce(val);
        test_vectors.push(TestVector {
            operation: "partial_reduce".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("value".to_string(), serde_json::Value::Number(val.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Number(result.0.into()),
        });
    }
    
    // Test reduce with u64 values
    let reduce_values = vec![
        0u64,
        1u64,
        (P-1) as u64,
        P as u64,
        (P+1) as u64,
        (2*P-1) as u64,
        (P as u64).pow(2) - 19,
        (P as u64).pow(2) - 1,
    ];
    for (i, &val) in reduce_values.iter().enumerate() {
        let result = M31::reduce(val);
        test_vectors.push(TestVector {
            operation: "reduce".to_string(),
            inputs: {
                let mut map = HashMap::new();
                // Use string for large numbers to avoid JSON precision issues
                if val > (1u64 << 53) {
                    map.insert("value".to_string(), serde_json::Value::String(val.to_string()));
                } else {
                    map.insert("value".to_string(), serde_json::Value::Number(val.into()));
                }
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                // Show the intermediate steps of the reduction algorithm
                let shifted1 = val >> 31;
                let step1 = shifted1 + val + 1;
                let shifted2 = step1 >> 31;
                let step2 = shifted2 + val;
                map.insert("shifted1".to_string(), serde_json::Value::Number(shifted1.into()));
                map.insert("step1".to_string(), serde_json::Value::String(step1.to_string()));
                map.insert("shifted2".to_string(), serde_json::Value::Number(shifted2.into()));
                map.insert("step2".to_string(), serde_json::Value::String(step2.to_string()));
                map
            },
            output: serde_json::Value::Number(result.0.into()),
        });
    }
}

fn generate_inverse_vectors(test_vectors: &mut Vec<TestVector>) {
    let test_values = vec![1, 2, 19, 42, 1000, P-1, P/2];
    for (i, &val) in test_values.iter().enumerate() {
        let m31_val = M31::from_u32_unchecked(val);
        let inverse = m31_val.inverse();
        let verification = inverse * m31_val;
        
        test_vectors.push(TestVector {
            operation: "inverse".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("value".to_string(), serde_json::Value::Number(val.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                map.insert("verification_product".to_string(), serde_json::Value::Number(verification.0.into()));
                map
            },
            output: serde_json::Value::Number(inverse.0.into()),
        });
    }
}

fn generate_pow2147483645_vectors(test_vectors: &mut Vec<TestVector>) {
    let test_values = vec![1, 2, 19, 42, 1000];
    for (i, &val) in test_values.iter().enumerate() {
        let m31_val = M31::from_u32_unchecked(val);
        let pow_result = pow2147483645(m31_val);
        let expected_inverse = m31_val.inverse();
        
        test_vectors.push(TestVector {
            operation: "pow2147483645".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("value".to_string(), serde_json::Value::Number(val.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                map.insert("expected_inverse".to_string(), serde_json::Value::Number(expected_inverse.0.into()));
                map
            },
            output: serde_json::Value::Number(pow_result.0.into()),
        });
    }
}

fn generate_into_slice_vectors(test_vectors: &mut Vec<TestVector>) {
    let mut rng = SmallRng::seed_from_u64(0);
    
    // Generate a small test case with known values
    let test_elements: Vec<M31> = (0..10).map(|_| rng.gen()).collect();
    let slice = M31::into_slice(&test_elements);
    
    let element_values: Vec<u32> = test_elements.iter().map(|e| e.0).collect();
    let slice_bytes: Vec<u8> = slice.to_vec();
    
    test_vectors.push(TestVector {
        operation: "into_slice".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("elements".to_string(), serde_json::Value::Array(
                element_values.iter().map(|&v| serde_json::Value::Number(v.into())).collect()
            ));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Array(
            slice_bytes.iter().map(|&b| serde_json::Value::Number(b.into())).collect()
        ),
    });
}

fn generate_edge_case_vectors(test_vectors: &mut Vec<TestVector>) {
    // Test zero and one
    test_vectors.push(TestVector {
        operation: "zero".to_string(),
        inputs: HashMap::new(),
        intermediates: HashMap::new(),
        output: serde_json::Value::Number(M31::zero().0.into()),
    });
    
    test_vectors.push(TestVector {
        operation: "one".to_string(),
        inputs: HashMap::new(),
        intermediates: HashMap::new(),
        output: serde_json::Value::Number(M31::one().0.into()),
    });
    
    // Test is_zero
    let zero_test = M31::zero();
    let non_zero_test = M31::one();
    
    test_vectors.push(TestVector {
        operation: "is_zero".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("value".to_string(), serde_json::Value::Number(zero_test.0.into()));
            map.insert("case".to_string(), serde_json::Value::String("zero".to_string()));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Bool(zero_test.is_zero()),
    });
    
    test_vectors.push(TestVector {
        operation: "is_zero".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("value".to_string(), serde_json::Value::Number(non_zero_test.0.into()));
            map.insert("case".to_string(), serde_json::Value::String("non_zero".to_string()));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Bool(non_zero_test.is_zero()),
    });
    
    // Test complex_conjugate (should be identity for M31)
    let test_val = M31::from_u32_unchecked(42);
    test_vectors.push(TestVector {
        operation: "complex_conjugate".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("value".to_string(), serde_json::Value::Number(test_val.0.into()));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Number(test_val.0.into()),
    });
}

fn generate_cm31_vectors(test_vectors: &mut Vec<TestVector>) {
    let mut rng = SmallRng::seed_from_u64(1);
    
    // Generate 50 random test cases for basic operations
    for i in 0..50 {
        let a: u32 = rng.gen::<u32>() % P;
        let b: u32 = rng.gen::<u32>() % P;
        let c: u32 = rng.gen::<u32>() % P;
        let d: u32 = rng.gen::<u32>() % P;
        
        let cm31_x = CM31::from_u32_unchecked(a, b);
        let cm31_y = CM31::from_u32_unchecked(c, d);
        
        // Addition test vector
        let sum = cm31_x + cm31_y;
        test_vectors.push(TestVector {
            operation: "add".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a_real".to_string(), serde_json::Value::Number(a.into()));
                map.insert("a_imag".to_string(), serde_json::Value::Number(b.into()));
                map.insert("b_real".to_string(), serde_json::Value::Number(c.into()));
                map.insert("b_imag".to_string(), serde_json::Value::Number(d.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: {
                let mut map = HashMap::new();
                map.insert("real", serde_json::Value::Number(sum.0.0.into()));
                map.insert("imag", serde_json::Value::Number(sum.1.0.into()));
                serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            },
        });
        
        // Multiplication test vector
        let product = cm31_x * cm31_y;
        test_vectors.push(TestVector {
            operation: "mul".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a_real".to_string(), serde_json::Value::Number(a.into()));
                map.insert("a_imag".to_string(), serde_json::Value::Number(b.into()));
                map.insert("b_real".to_string(), serde_json::Value::Number(c.into()));
                map.insert("b_imag".to_string(), serde_json::Value::Number(d.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                // Show intermediate calculations: (ac - bd) + (ad + bc)i
                let ac = (a as u64) * (c as u64);
                let bd = (b as u64) * (d as u64);
                let ad = (a as u64) * (d as u64);
                let bc = (b as u64) * (c as u64);
                map.insert("ac".to_string(), serde_json::Value::Number(ac.into()));
                map.insert("bd".to_string(), serde_json::Value::Number(bd.into()));
                map.insert("ad".to_string(), serde_json::Value::Number(ad.into()));
                map.insert("bc".to_string(), serde_json::Value::Number(bc.into()));
                map
            },
            output: {
                let mut map = HashMap::new();
                map.insert("real", serde_json::Value::Number(product.0.0.into()));
                map.insert("imag", serde_json::Value::Number(product.1.0.into()));
                serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            },
        });
        
        // Subtraction test vector
        let difference = cm31_x - cm31_y;
        test_vectors.push(TestVector {
            operation: "sub".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a_real".to_string(), serde_json::Value::Number(a.into()));
                map.insert("a_imag".to_string(), serde_json::Value::Number(b.into()));
                map.insert("b_real".to_string(), serde_json::Value::Number(c.into()));
                map.insert("b_imag".to_string(), serde_json::Value::Number(d.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: {
                let mut map = HashMap::new();
                map.insert("real", serde_json::Value::Number(difference.0.0.into()));
                map.insert("imag", serde_json::Value::Number(difference.1.0.into()));
                serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            },
        });
        
        // Negation test vector
        let negated = -cm31_x;
        test_vectors.push(TestVector {
            operation: "neg".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("real".to_string(), serde_json::Value::Number(a.into()));
                map.insert("imag".to_string(), serde_json::Value::Number(b.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: {
                let mut map = HashMap::new();
                map.insert("real", serde_json::Value::Number(negated.0.0.into()));
                map.insert("imag", serde_json::Value::Number(negated.1.0.into()));
                serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            },
        });
    }
    
    // Test construction methods
    let construction_values = vec![(0, 0), (1, 0), (0, 1), (1, 1), (42, 19), (P-1, P-1)];
    for (i, &(a, b)) in construction_values.iter().enumerate() {
        let cm31_val = CM31::from_u32_unchecked(a, b);
        test_vectors.push(TestVector {
            operation: "from_u32_unchecked".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("real".to_string(), serde_json::Value::Number(a.into()));
                map.insert("imag".to_string(), serde_json::Value::Number(b.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: {
                let mut map = HashMap::new();
                map.insert("real", serde_json::Value::Number(cm31_val.0.0.into()));
                map.insert("imag", serde_json::Value::Number(cm31_val.1.0.into()));
                serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            },
        });
    }
    
    // Test inverse operations
    let inverse_values = vec![(1, 0), (1, 1), (2, 3), (42, 19), (P-1, 1)];
    for (i, &(a, b)) in inverse_values.iter().enumerate() {
        let cm31_val = CM31::from_u32_unchecked(a, b);
        let inverse = cm31_val.inverse();
        let verification = inverse * cm31_val;
        
        test_vectors.push(TestVector {
            operation: "inverse".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("real".to_string(), serde_json::Value::Number(a.into()));
                map.insert("imag".to_string(), serde_json::Value::Number(b.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                map.insert("verification_real".to_string(), serde_json::Value::Number(verification.0.0.into()));
                map.insert("verification_imag".to_string(), serde_json::Value::Number(verification.1.0.into()));
                map
            },
            output: {
                let mut map = HashMap::new();
                map.insert("real", serde_json::Value::Number(inverse.0.0.into()));
                map.insert("imag", serde_json::Value::Number(inverse.1.0.into()));
                serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            },
        });
    }
    
    // Test complex conjugate
    for (i, &(a, b)) in construction_values.iter().enumerate() {
        let cm31_val = CM31::from_u32_unchecked(a, b);
        let conjugate = cm31_val.complex_conjugate();
        
        test_vectors.push(TestVector {
            operation: "complex_conjugate".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("real".to_string(), serde_json::Value::Number(a.into()));
                map.insert("imag".to_string(), serde_json::Value::Number(b.into()));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: {
                let mut map = HashMap::new();
                map.insert("real", serde_json::Value::Number(conjugate.0.0.into()));
                map.insert("imag", serde_json::Value::Number(conjugate.1.0.into()));
                serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
            },
        });
    }
    
    // Test into_slice
    let mut rng = SmallRng::seed_from_u64(2);
    let test_elements: Vec<CM31> = (0..10).map(|_| rng.gen()).collect();
    let slice = CM31::into_slice(&test_elements);
    
    let element_values: Vec<(u32, u32)> = test_elements.iter().map(|e| (e.0.0, e.1.0)).collect();
    let slice_bytes: Vec<u8> = slice.to_vec();
    
    test_vectors.push(TestVector {
        operation: "into_slice".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("elements".to_string(), serde_json::Value::Array(
                element_values.iter().map(|&(real, imag)| {
                    let mut elem_map = HashMap::new();
                    elem_map.insert("real".to_string(), serde_json::Value::Number(real.into()));
                    elem_map.insert("imag".to_string(), serde_json::Value::Number(imag.into()));
                    serde_json::Value::Object(elem_map.into_iter().collect())
                }).collect()
            ));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Array(
            slice_bytes.iter().map(|&b| serde_json::Value::Number(b.into())).collect()
        ),
    });
    
    // Test edge cases
    test_vectors.push(TestVector {
        operation: "zero".to_string(),
        inputs: HashMap::new(),
        intermediates: HashMap::new(),
        output: {
            let mut map = HashMap::new();
            let zero = CM31::zero();
            map.insert("real", serde_json::Value::Number(zero.0.0.into()));
            map.insert("imag", serde_json::Value::Number(zero.1.0.into()));
            serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
        },
    });
    
    test_vectors.push(TestVector {
        operation: "one".to_string(),
        inputs: HashMap::new(),
        intermediates: HashMap::new(),
        output: {
            let mut map = HashMap::new();
            let one = CM31::one();
            map.insert("real", serde_json::Value::Number(one.0.0.into()));
            map.insert("imag", serde_json::Value::Number(one.1.0.into()));
            serde_json::Value::Object(map.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
        },
    });
}

fn generate_qm31_vectors(test_vectors: &mut Vec<TestVector>) {
    let mut rng = SmallRng::seed_from_u64(2);
    
    // Generate 30 random test cases for basic operations
    for i in 0..30 {
        let a: u32 = rng.gen::<u32>() % P;
        let b: u32 = rng.gen::<u32>() % P;
        let c: u32 = rng.gen::<u32>() % P;
        let d: u32 = rng.gen::<u32>() % P;
        let e: u32 = rng.gen::<u32>() % P;
        let f: u32 = rng.gen::<u32>() % P;
        let g: u32 = rng.gen::<u32>() % P;
        let h: u32 = rng.gen::<u32>() % P;
        
        let qm31_x = QM31::from_u32_unchecked(a, b, c, d);
        let qm31_y = QM31::from_u32_unchecked(e, f, g, h);
        
        // Addition test vector
        let sum = qm31_x + qm31_y;
        test_vectors.push(TestVector {
            operation: "add".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(a.into()),
                    serde_json::Value::Number(b.into()),
                    serde_json::Value::Number(c.into()),
                    serde_json::Value::Number(d.into()),
                ]));
                map.insert("b".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(e.into()),
                    serde_json::Value::Number(f.into()),
                    serde_json::Value::Number(g.into()),
                    serde_json::Value::Number(h.into()),
                ]));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Array(vec![
                serde_json::Value::Number(sum.0.0.0.into()),
                serde_json::Value::Number(sum.0.1.0.into()),
                serde_json::Value::Number(sum.1.0.0.into()),
                serde_json::Value::Number(sum.1.1.0.into()),
            ]),
        });
        
        // Multiplication test vector
        let product = qm31_x * qm31_y;
        test_vectors.push(TestVector {
            operation: "mul".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(a.into()),
                    serde_json::Value::Number(b.into()),
                    serde_json::Value::Number(c.into()),
                    serde_json::Value::Number(d.into()),
                ]));
                map.insert("b".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(e.into()),
                    serde_json::Value::Number(f.into()),
                    serde_json::Value::Number(g.into()),
                    serde_json::Value::Number(h.into()),
                ]));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                // Show R constant used in multiplication
                map.insert("R_real".to_string(), serde_json::Value::Number(R.0.0.into()));
                map.insert("R_imag".to_string(), serde_json::Value::Number(R.1.0.into()));
                map
            },
            output: serde_json::Value::Array(vec![
                serde_json::Value::Number(product.0.0.0.into()),
                serde_json::Value::Number(product.0.1.0.into()),
                serde_json::Value::Number(product.1.0.0.into()),
                serde_json::Value::Number(product.1.1.0.into()),
            ]),
        });
        
        // Subtraction test vector
        let difference = qm31_x - qm31_y;
        test_vectors.push(TestVector {
            operation: "sub".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("a".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(a.into()),
                    serde_json::Value::Number(b.into()),
                    serde_json::Value::Number(c.into()),
                    serde_json::Value::Number(d.into()),
                ]));
                map.insert("b".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(e.into()),
                    serde_json::Value::Number(f.into()),
                    serde_json::Value::Number(g.into()),
                    serde_json::Value::Number(h.into()),
                ]));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Array(vec![
                serde_json::Value::Number(difference.0.0.0.into()),
                serde_json::Value::Number(difference.0.1.0.into()),
                serde_json::Value::Number(difference.1.0.0.into()),
                serde_json::Value::Number(difference.1.1.0.into()),
            ]),
        });
        
        // Negation test vector
        let negated = -qm31_x;
        test_vectors.push(TestVector {
            operation: "neg".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("value".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(a.into()),
                    serde_json::Value::Number(b.into()),
                    serde_json::Value::Number(c.into()),
                    serde_json::Value::Number(d.into()),
                ]));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Array(vec![
                serde_json::Value::Number(negated.0.0.0.into()),
                serde_json::Value::Number(negated.0.1.0.into()),
                serde_json::Value::Number(negated.1.0.0.into()),
                serde_json::Value::Number(negated.1.1.0.into()),
            ]),
        });
    }
    
    // Test construction methods
    let construction_values = vec![
        (0, 0, 0, 0),
        (1, 0, 0, 0),
        (0, 1, 0, 0),
        (0, 0, 1, 0),
        (0, 0, 0, 1),
        (1, 2, 3, 4),
        (P-1, P-1, P-1, P-1),
    ];
    
    for (i, &(a, b, c, d)) in construction_values.iter().enumerate() {
        let qm31_val = QM31::from_u32_unchecked(a, b, c, d);
        test_vectors.push(TestVector {
            operation: "from_u32_unchecked".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("values".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(a.into()),
                    serde_json::Value::Number(b.into()),
                    serde_json::Value::Number(c.into()),
                    serde_json::Value::Number(d.into()),
                ]));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Array(vec![
                serde_json::Value::Number(qm31_val.0.0.0.into()),
                serde_json::Value::Number(qm31_val.0.1.0.into()),
                serde_json::Value::Number(qm31_val.1.0.0.into()),
                serde_json::Value::Number(qm31_val.1.1.0.into()),
            ]),
        });
    }
    
    // Test from_partial_evals
    let eval_values = vec![
        QM31::from_u32_unchecked(1, 0, 0, 0),
        QM31::from_u32_unchecked(0, 1, 0, 0),
        QM31::from_u32_unchecked(0, 0, 1, 0),
        QM31::from_u32_unchecked(0, 0, 0, 1),
    ];
    let combined = QM31::from_partial_evals([eval_values[0], eval_values[1], eval_values[2], eval_values[3]]);
    
    test_vectors.push(TestVector {
        operation: "from_partial_evals".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("evals".to_string(), serde_json::Value::Array(
                eval_values.iter().map(|qm| serde_json::Value::Array(vec![
                    serde_json::Value::Number(qm.0.0.0.into()),
                    serde_json::Value::Number(qm.0.1.0.into()),
                    serde_json::Value::Number(qm.1.0.0.into()),
                    serde_json::Value::Number(qm.1.1.0.into()),
                ])).collect()
            ));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Array(vec![
            serde_json::Value::Number(combined.0.0.0.into()),
            serde_json::Value::Number(combined.0.1.0.into()),
            serde_json::Value::Number(combined.1.0.0.into()),
            serde_json::Value::Number(combined.1.1.0.into()),
        ]),
    });
    
    // Test inverse operations
    let inverse_values = vec![(1, 0, 0, 0), (1, 2, 3, 4), (5, 6, 7, 8)];
    for (i, &(a, b, c, d)) in inverse_values.iter().enumerate() {
        let qm31_val = QM31::from_u32_unchecked(a, b, c, d);
        let inverse = qm31_val.inverse();
        let verification = inverse * qm31_val;
        
        test_vectors.push(TestVector {
            operation: "inverse".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("value".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(a.into()),
                    serde_json::Value::Number(b.into()),
                    serde_json::Value::Number(c.into()),
                    serde_json::Value::Number(d.into()),
                ]));
                map.insert("test_case".to_string(), serde_json::Value::Number(i.into()));
                map
            },
            intermediates: {
                let mut map = HashMap::new();
                map.insert("verification".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(verification.0.0.0.into()),
                    serde_json::Value::Number(verification.0.1.0.into()),
                    serde_json::Value::Number(verification.1.0.0.into()),
                    serde_json::Value::Number(verification.1.1.0.into()),
                ]));
                map
            },
            output: serde_json::Value::Array(vec![
                serde_json::Value::Number(inverse.0.0.0.into()),
                serde_json::Value::Number(inverse.0.1.0.into()),
                serde_json::Value::Number(inverse.1.0.0.into()),
                serde_json::Value::Number(inverse.1.1.0.into()),
            ]),
        });
    }
    
    // Test mul_cm31
    let qm31_val = QM31::from_u32_unchecked(1, 2, 3, 4);
    let cm31_val = CM31::from_u32_unchecked(5, 6);
    let mul_cm31_result = qm31_val.mul_cm31(cm31_val);
    
    test_vectors.push(TestVector {
        operation: "mul_cm31".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("qm31".to_string(), serde_json::Value::Array(vec![
                serde_json::Value::Number(1.into()),
                serde_json::Value::Number(2.into()),
                serde_json::Value::Number(3.into()),
                serde_json::Value::Number(4.into()),
            ]));
            map.insert("cm31".to_string(), serde_json::Value::Array(vec![
                serde_json::Value::Number(5.into()),
                serde_json::Value::Number(6.into()),
            ]));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Array(vec![
            serde_json::Value::Number(mul_cm31_result.0.0.0.into()),
            serde_json::Value::Number(mul_cm31_result.0.1.0.into()),
            serde_json::Value::Number(mul_cm31_result.1.0.0.into()),
            serde_json::Value::Number(mul_cm31_result.1.1.0.into()),
        ]),
    });
    
    // Test into_slice
    let mut rng = SmallRng::seed_from_u64(3);
    let test_elements: Vec<QM31> = (0..5).map(|_| rng.gen()).collect();
    let slice = QM31::into_slice(&test_elements);
    
    let element_values: Vec<(u32, u32, u32, u32)> = test_elements.iter()
        .map(|e| (e.0.0.0, e.0.1.0, e.1.0.0, e.1.1.0)).collect();
    let slice_bytes: Vec<u8> = slice.to_vec();
    
    test_vectors.push(TestVector {
        operation: "into_slice".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("elements".to_string(), serde_json::Value::Array(
                element_values.iter().map(|&(a, b, c, d)| serde_json::Value::Array(vec![
                    serde_json::Value::Number(a.into()),
                    serde_json::Value::Number(b.into()),
                    serde_json::Value::Number(c.into()),
                    serde_json::Value::Number(d.into()),
                ])).collect()
            ));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Array(
            slice_bytes.iter().map(|&b| serde_json::Value::Number(b.into())).collect()
        ),
    });
    
    // Test edge cases
    test_vectors.push(TestVector {
        operation: "zero".to_string(),
        inputs: HashMap::new(),
        intermediates: HashMap::new(),
        output: {
            let zero = QM31::zero();
            serde_json::Value::Array(vec![
                serde_json::Value::Number(zero.0.0.0.into()),
                serde_json::Value::Number(zero.0.1.0.into()),
                serde_json::Value::Number(zero.1.0.0.into()),
                serde_json::Value::Number(zero.1.1.0.into()),
            ])
        },
    });
    
    test_vectors.push(TestVector {
        operation: "one".to_string(),
        inputs: HashMap::new(),
        intermediates: HashMap::new(),
        output: {
            let one = QM31::one();
            serde_json::Value::Array(vec![
                serde_json::Value::Number(one.0.0.0.into()),
                serde_json::Value::Number(one.0.1.0.into()),
                serde_json::Value::Number(one.1.0.0.into()),
                serde_json::Value::Number(one.1.1.0.into()),
            ])
        },
    });
}

fn generate_secure_column_vectors(test_vectors: &mut Vec<TestVector>) {
    // Test SecureColumnByCoords operations
    let mut rng = SmallRng::seed_from_u64(4);
    
    // Create test data
    let test_values: Vec<SecureField> = (0..5).map(|_| rng.gen()).collect();
    let mut column = SecureColumnByCoords::<CpuBackend>::zeros(5);
    
    // Set values and test at() method
    for (i, &value) in test_values.iter().enumerate() {
        column.set(i, value);
        let retrieved = column.at(i);
        
        test_vectors.push(TestVector {
            operation: "set_and_at".to_string(),
            inputs: {
                let mut map = HashMap::new();
                map.insert("index".to_string(), serde_json::Value::Number(i.into()));
                map.insert("value".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::Number(value.0.0.0.into()),
                    serde_json::Value::Number(value.0.1.0.into()),
                    serde_json::Value::Number(value.1.0.0.into()),
                    serde_json::Value::Number(value.1.1.0.into()),
                ]));
                map
            },
            intermediates: HashMap::new(),
            output: serde_json::Value::Array(vec![
                serde_json::Value::Number(retrieved.0.0.0.into()),
                serde_json::Value::Number(retrieved.0.1.0.into()),
                serde_json::Value::Number(retrieved.1.0.0.into()),
                serde_json::Value::Number(retrieved.1.1.0.into()),
            ]),
        });
    }
    
    // Test column length
    test_vectors.push(TestVector {
        operation: "len".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("column_size".to_string(), serde_json::Value::Number(5.into()));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Number(column.len().into()),
    });
    
    // Test is_empty
    test_vectors.push(TestVector {
        operation: "is_empty".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("column_size".to_string(), serde_json::Value::Number(5.into()));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Bool(column.is_empty()),
    });
    
    // Test empty column
    let empty_column = SecureColumnByCoords::<CpuBackend>::zeros(0);
    test_vectors.push(TestVector {
        operation: "is_empty".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("column_size".to_string(), serde_json::Value::Number(0.into()));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Bool(empty_column.is_empty()),
    });
    
    // Test to_vec conversion
    let vec_result = column.to_vec();
    test_vectors.push(TestVector {
        operation: "to_vec".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("column_values".to_string(), serde_json::Value::Array(
                test_values.iter().map(|value| serde_json::Value::Array(vec![
                    serde_json::Value::Number(value.0.0.0.into()),
                    serde_json::Value::Number(value.0.1.0.into()),
                    serde_json::Value::Number(value.1.0.0.into()),
                    serde_json::Value::Number(value.1.1.0.into()),
                ])).collect()
            ));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Array(
            vec_result.iter().map(|value| serde_json::Value::Array(vec![
                serde_json::Value::Number(value.0.0.0.into()),
                serde_json::Value::Number(value.0.1.0.into()),
                serde_json::Value::Number(value.1.0.0.into()),
                serde_json::Value::Number(value.1.1.0.into()),
            ])).collect()
        ),
    });
    
    // Test FromIterator
    let from_iter_column: SecureColumnByCoords<CpuBackend> = test_values.iter().cloned().collect();
    let from_iter_vec = from_iter_column.to_vec();
    
    test_vectors.push(TestVector {
        operation: "from_iter".to_string(),
        inputs: {
            let mut map = HashMap::new();
            map.insert("input_values".to_string(), serde_json::Value::Array(
                test_values.iter().map(|value| serde_json::Value::Array(vec![
                    serde_json::Value::Number(value.0.0.0.into()),
                    serde_json::Value::Number(value.0.1.0.into()),
                    serde_json::Value::Number(value.1.0.0.into()),
                    serde_json::Value::Number(value.1.1.0.into()),
                ])).collect()
            ));
            map
        },
        intermediates: HashMap::new(),
        output: serde_json::Value::Array(
            from_iter_vec.iter().map(|value| serde_json::Value::Array(vec![
                serde_json::Value::Number(value.0.0.0.into()),
                serde_json::Value::Number(value.0.1.0.into()),
                serde_json::Value::Number(value.1.0.0.into()),
                serde_json::Value::Number(value.1.1.0.into()),
            ])).collect()
        ),
    });
} 