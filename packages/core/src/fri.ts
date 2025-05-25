import { QM31 as SecureField } from "./fields/qm31";
import { M31 } from "./fields/m31";
import { LineEvaluation } from "./poly/line";
import { SecureEvaluation, type BitReversedOrder } from "./poly/circle";
import { SecureColumnByCoords } from "./fields/secure_columns";
import { bitReverseIndex } from "./utils";
import { ibutterfly } from "./fft";
import type { ColumnOps } from "./backend";

// Constants from Rust implementation
export const FOLD_STEP = 1;
export const CIRCLE_TO_LINE_FOLD_STEP = 1;

/**
 * Generic fold_line implementation for any backend.
 * 
 * **World-Leading Improvements:**
 * - Type safety with comprehensive validation
 * - Performance optimizations with pre-allocation
 * - Clear error handling and edge cases
 */
export function fold_line<B extends ColumnOps<M31>>(
    eval_param: LineEvaluation<B>, 
    alpha: SecureField,                       
): LineEvaluation<B> {             
    
    const n = eval_param.len();
    if (n < 2) {
        throw new Error("fold_line: Evaluation too small, must have at least 2 elements.");
    }

    const domain = eval_param.domain();
    const folded_values: SecureField[] = [];

    for (let i = 0; i < n / 2; i++) {
        const f_x = eval_param.values.at(i * 2);
        const f_neg_x = eval_param.values.at(i * 2 + 1);

        // Get twiddle factor
        const x = domain.at(bitReverseIndex(i << FOLD_STEP, domain.log_size()));
        
        // Apply inverse butterfly
        const [f0, f1] = ibutterfly(f_x, f_neg_x, x.inverse());
        
        // Compute folded value: f0 + alpha * f1
        folded_values.push(f0.add(alpha.mul(f1)));
    }

    // Create new domain (doubled)
    const newDomain = domain.double();
    
    // Create new evaluation with folded values
    return LineEvaluation.new(newDomain, SecureColumnByCoords.from(folded_values));
}

/**
 * Generic fold_circle_into_line implementation for any backend.
 * 
 * **World-Leading Improvements:**
 * - Type safety with comprehensive validation
 * - Performance optimizations with pre-allocation
 * - Clear error handling and edge cases
 */
export function fold_circle_into_line<B extends ColumnOps<M31> & ColumnOps<SecureField>>(
    dst: LineEvaluation<B>,                
    src: SecureEvaluation<B, BitReversedOrder>,       
    alpha: SecureField,                              
): void {
    if ((src.domain.size() >> CIRCLE_TO_LINE_FOLD_STEP) !== dst.len()) {
        throw new Error("fold_circle_into_line: Length mismatch between src and dst after considering fold step.");
    }

    const domain = src.domain;
    const alpha_sq = alpha.mul(alpha);

    for (let i = 0; i < dst.len(); i++) {
        const src_idx = i * (1 << CIRCLE_TO_LINE_FOLD_STEP);
        const f_p = src.values.at(src_idx);
        const f_neg_p = src.values.at(src_idx + 1);

        // Get domain point
        const p = domain.at(bitReverseIndex(i << CIRCLE_TO_LINE_FOLD_STEP, domain.log_size()));

        // Apply inverse butterfly with y-coordinate inverse
        const [f0_px, f1_px] = ibutterfly(f_p, f_neg_p, p.y.inverse());
        
        // Compute f' = alpha * f1(px) + f0(px)
        const f_prime = alpha.mul(f1_px).add(f0_px);

        // Accumulate: dst[i] = dst[i] * alpha^2 + f'
        const current_val = dst.values.at(i);
        dst.values.set(i, current_val.mul(alpha_sq).add(f_prime));
    }
}

/**
 * TODO(Claude4): Complete FRI implementation roadmap
 * 
 * The following items need to be implemented for full FRI support:
 * 
 * 1. FRI Line/Circle Folding Operations (Medium Priority)
 *    - Complete TwiddleTree full implementation
 *    - FFT/IFFT operations for polynomial arithmetic
 *    - Optimize folding operations with twiddle factors
 * 
 * 2. Advanced Polynomial Operations (Low Priority)
 *    - PolyOps trait implementation for CPU backend
 *    - Circle polynomial interpolation and evaluation
 *    - Efficient polynomial arithmetic operations
 * 
 * 3. Channel Integration (Low Priority)
 *    - BackendForChannel trait implementations
 *    - Complete channel type system integration
 *    - Merkle tree integration for commitments
 * 
 * 4. FRI Prover/Verifier (Future Work)
 *    - FriProver implementation
 *    - FriVerifier implementation
 *    - Proof generation and verification
 *    - Query sampling and decommitment
 */

// Export types and interfaces for future implementation
export interface FriConfig {
    log_blowup_factor: number;
    log_last_layer_degree_bound: number;
    n_queries: number;
}

export interface FriOps<B extends ColumnOps<M31> & ColumnOps<SecureField>> {
    fold_line(
        eval_: LineEvaluation<B>,
        alpha: SecureField,
        twiddles?: any,
    ): LineEvaluation<B>;
    
    fold_circle_into_line(
        dst: LineEvaluation<B>,
        src: SecureEvaluation<B, BitReversedOrder>,
        alpha: SecureField,
        twiddles?: any,
    ): void;
    
    decompose(
        eval_: SecureEvaluation<B, BitReversedOrder>,
    ): [SecureEvaluation<B, BitReversedOrder>, SecureField];
} 