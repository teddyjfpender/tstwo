use stwo_prover::core::{
    backend::{
        simd::{
            column::BaseColumn,
            m31::{LOG_N_LANES, N_LANES},
            SimdBackend,
        },
        Column,
    },
    fields::m31::M31,
    poly::{
        circle::{CanonicCoset, CircleEvaluation},
        BitReversedOrder,
    },
    ColumnVec,
};

// ANCHOR: main_start
fn main() {
    // ANCHOR_END: main_start
    let num_rows = N_LANES;
    let log_num_rows = LOG_N_LANES;

    // Create the table
    let mut col_1 = BaseColumn::zeros(num_rows);
    col_1.set(0, M31::from(1));
    col_1.set(1, M31::from(7));

    let mut col_2 = BaseColumn::zeros(num_rows);
    col_2.set(0, M31::from(5));
    col_2.set(1, M31::from(11));

    // ANCHOR: main_end
    // --snip--

    // Convert table to trace polynomials
    let domain = CanonicCoset::new(log_num_rows).circle_domain();
    let trace: ColumnVec<CircleEvaluation<SimdBackend, M31, BitReversedOrder>> =
        vec![col_1.clone(), col_2.clone()]
            .into_iter()
            .map(|col| CircleEvaluation::new(domain, col))
            .collect();

    // Print structured test vector data for capture
    println!("=== RUST TEST VECTOR START ===");
    println!("{{");
    println!("  \"example\": \"02_from_spreadsheet_to_trace_polynomials\",");
    println!("  \"constants\": {{");
    println!("    \"N_LANES\": {},", N_LANES);
    println!("    \"LOG_N_LANES\": {},", LOG_N_LANES);
    println!("    \"num_rows\": {},", num_rows);
    println!("    \"log_num_rows\": {}", log_num_rows);
    println!("  }},");
    
    println!("  \"input_columns\": {{");
    println!("    \"col_1\": {{");
    println!("      \"length\": {},", col_1.len());
    println!("      \"data_chunks\": {},", col_1.data.len());
    print!("      \"values\": [");
    for i in 0..col_1.len() {
        if i > 0 { print!(", "); }
        print!("{}", col_1.at(i).0);
    }
    println!("]");
    println!("    }},");
    println!("    \"col_2\": {{");
    println!("      \"length\": {},", col_2.len());
    println!("      \"data_chunks\": {},", col_2.data.len());
    print!("      \"values\": [");
    for i in 0..col_2.len() {
        if i > 0 { print!(", "); }
        print!("{}", col_2.at(i).0);
    }
    println!("]");
    println!("    }}");
    println!("  }},");
    
    println!("  \"domain\": {{");
    println!("    \"log_size\": {},", domain.log_size());
    println!("    \"size\": {},", domain.size());
    println!("    \"is_canonic\": true");
    println!("  }},");
    
    println!("  \"trace\": {{");
    println!("    \"length\": {},", trace.len());
    println!("    \"polynomials\": [");
    for (i, evaluation) in trace.iter().enumerate() {
        if i > 0 { println!(","); }
        println!("      {{");
        println!("        \"index\": {},", i);
        println!("        \"domain_log_size\": {},", evaluation.domain.log_size());
        println!("        \"domain_size\": {},", evaluation.domain.size());
        print!("        \"values\": [");
        for (j, v) in evaluation.values.iter().enumerate() {
            if j > 0 { print!(", "); }
            print!("{}", v.0);
        }
        println!("],");
        println!("        \"values_length\": {}", evaluation.values.len());
        print!("      }}");
    }
    println!();
    println!("    ]");
    println!("  }},");
    
    println!("  \"expected_values\": {{");
    println!("    \"trace_length\": {},", trace.len());
    println!("    \"domain_log_size\": {},", domain.log_size());
    println!("    \"domain_size\": {},", domain.size());
    println!("    \"trace_0_value_0\": {},", trace[0].values[0].0);
    println!("    \"trace_0_value_1\": {},", trace[0].values[1].0);
    println!("    \"trace_1_value_0\": {},", trace[1].values[0].0);
    println!("    \"trace_1_value_1\": {},", trace[1].values[1].0);
    println!("    \"col_1_at_0\": {},", col_1.at(0).0);
    println!("    \"col_1_at_1\": {},", col_1.at(1).0);
    println!("    \"col_2_at_0\": {},", col_2.at(0).0);
    println!("    \"col_2_at_1\": {}", col_2.at(1).0);
    println!("  }}");
    println!("}}");
    println!("=== RUST TEST VECTOR END ===");

    // Also print summary for verification
    println!("\nRust Reference Implementation Results:");
    println!("Trace contains {} polynomials", trace.len());
    println!("Domain: log_size={}, size={}", domain.log_size(), domain.size());
    println!("First trace values: [{}, {}, ...]", trace[0].values[0].0, trace[0].values[1].0);
    println!("Second trace values: [{}, {}, ...]", trace[1].values[0].0, trace[1].values[1].0);
}
// ANCHOR_END: main_end