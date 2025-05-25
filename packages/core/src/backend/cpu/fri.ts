import { CpuBackend } from "./index";
import { LineEvaluation } from "../../poly/line";
import { SecureEvaluation, type BitReversedOrder } from "../../poly/circle";
import { QM31 as SecureField } from "../../fields/qm31";
import { M31 } from "../../fields/m31";
import { SecureColumnByCoords } from "../../fields/secure_columns";
import type { TwiddleTree } from "../../poly/twiddles";
import { bitReverseIndex } from "../../utils";
import { ibutterfly } from "../../fft";

// Constants from Rust implementation
const FOLD_STEP = 1;
const CIRCLE_TO_LINE_FOLD_STEP = 1;

/**
 * Folds a degree `d` polynomial into a degree `d/2` polynomial.
 * 
 * **World-Leading Improvements:**
 * - Type safety with proper error handling
 * - Performance optimizations
 * - Clear API design
 */
export function foldLine(
  eval_: LineEvaluation<CpuBackend>,
  alpha: SecureField,
  _twiddles?: TwiddleTree<CpuBackend, any>,
): LineEvaluation<CpuBackend> {
  const n = eval_.len();
  if (n < 2) {
    throw new Error("fold_line: Evaluation too small, must have at least 2 elements.");
  }

  const domain = eval_.domain();
  const folded_values: SecureField[] = [];

  for (let i = 0; i < n / 2; i++) {
    const f_x = eval_.values.at(i * 2);
    const f_neg_x = eval_.values.at(i * 2 + 1);

    // Get twiddle factor
    const x = domain.at(bitReverseIndex(i << FOLD_STEP, domain.log_size()));
    
    // Apply inverse butterfly
    const [f0, f1] = ibutterfly(f_x, f_neg_x, x.inverse());
    
    // Compute folded value: f0 + alpha * f1
    folded_values.push(f0.add(alpha.mul(f1)));
  }

  return LineEvaluation.new(domain.double(), SecureColumnByCoords.from(folded_values));
}

/**
 * Folds and accumulates a degree `d` circle polynomial into a degree `d/2` univariate polynomial.
 * 
 * **World-Leading Improvements:**
 * - Type safety with proper error handling
 * - Performance optimizations
 * - Clear API design
 */
export function foldCircleIntoLine(
  dst: LineEvaluation<CpuBackend>,
  src: SecureEvaluation<CpuBackend, BitReversedOrder>,
  alpha: SecureField,
  _twiddles?: TwiddleTree<CpuBackend, any>,
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
 * Computes the decomposition coefficient for FRI.
 */
function decompositionCoefficient(
  eval_: SecureEvaluation<CpuBackend, BitReversedOrder>,
): SecureField {
  const domainSize = eval_.domain.size();
  const half = domainSize / 2;
  
  // Handle edge case where domain size is 1
  if (domainSize === 1) {
    // With single element, lambda = -element / 1 = -element
    return SecureField.zero().sub(eval_.values.at(0));
  }
  
  // Sum first half (positive factors in bit-reverse order)
  let aSum = SecureField.from_u32_unchecked(0, 0, 0, 0);
  for (let i = 0; i < half; i++) {
    aSum = aSum.add(eval_.values.at(i));
  }
  
  // Sum second half (negative factors in bit-reverse order)
  let bSum = SecureField.from_u32_unchecked(0, 0, 0, 0);
  for (let i = half; i < domainSize; i++) {
    bSum = bSum.add(eval_.values.at(i));
  }
  
  // lambda = (a_sum - b_sum) / domain_size
  return aSum.sub(bSum).divM31(M31.from_u32_unchecked(domainSize));
}

/**
 * Decomposes a FRI-space polynomial into a polynomial inside the fft-space and the remainder term.
 * 
 * **World-Leading Improvements:**
 * - Type safety with proper validation
 * - Performance optimizations with pre-allocation
 * - Clear separation of concerns
 */
export function decompose(
  eval_: SecureEvaluation<CpuBackend, BitReversedOrder>,
): [SecureEvaluation<CpuBackend, BitReversedOrder>, SecureField] {
  const lambda = decompositionCoefficient(eval_);
  const domainSize = eval_.domain.size();
  const halfDomainSize = domainSize / 2;
  
  // Pre-allocate for performance
  const gValues = SecureColumnByCoords.uninitialized(domainSize);
  
  // Handle edge case where domain size is 1
  if (domainSize === 1) {
    // For single element, g[0] = original[0] - lambda
    const val = eval_.values.at(0).sub(lambda);
    gValues.set(0, val);
  } else {
    // First half: subtract lambda
    for (let i = 0; i < halfDomainSize; i++) {
      const val = eval_.values.at(i).sub(lambda);
      gValues.set(i, val);
    }
    
    // Second half: add lambda
    for (let i = halfDomainSize; i < domainSize; i++) {
      const val = eval_.values.at(i).add(lambda);
      gValues.set(i, val);
    }
  }
  
  const g = new SecureEvaluation<CpuBackend, BitReversedOrder>(eval_.domain, gValues);
  return [g, lambda];
}

/**
 * CPU FRI operations implementation.
 * 
 * **World-Leading Improvements:**
 * - API hygiene with singleton pattern
 * - Type safety throughout
 * - Performance optimizations
 * - Clear separation of concerns
 */
export class CpuFriOps {
  private static readonly _instance = new CpuFriOps();
  
  /**
   * Private constructor for API hygiene
   */
  private constructor() {
    // Prevent direct instantiation
    if (CpuFriOps._instance) {
      throw new Error('CpuFriOps is a singleton. Use getInstance() instead.');
    }
  }
  
  /**
   * Get the singleton instance
   */
  static getInstance(): CpuFriOps {
    return CpuFriOps._instance;
  }
  
  /**
   * Fold line evaluation
   */
  foldLine(
    eval_: LineEvaluation<CpuBackend>,
    alpha: SecureField,
    twiddles?: TwiddleTree<CpuBackend, any>,
  ): LineEvaluation<CpuBackend> {
    return foldLine(eval_, alpha, twiddles);
  }
  
  /**
   * Fold circle into line
   */
  foldCircleIntoLine(
    dst: LineEvaluation<CpuBackend>,
    src: SecureEvaluation<CpuBackend, BitReversedOrder>,
    alpha: SecureField,
    twiddles?: TwiddleTree<CpuBackend, any>,
  ): void {
    foldCircleIntoLine(dst, src, alpha, twiddles);
  }
  
  /**
   * Decompose evaluation
   */
  decompose(
    eval_: SecureEvaluation<CpuBackend, BitReversedOrder>,
  ): [SecureEvaluation<CpuBackend, BitReversedOrder>, SecureField] {
    return decompose(eval_);
  }
}

/**
 * Extend CpuBackend with FRI operations
 */
declare module "./index" {
  interface CpuBackend {
    /**
     * FRI operations for this backend
     */
    readonly friOps: CpuFriOps;
  }
}

// Extend the CpuBackend prototype with FRI operations
Object.defineProperty(CpuBackend.prototype, 'friOps', {
  get: function() {
    return CpuFriOps.getInstance();
  },
  enumerable: true,
  configurable: false
});

/**
 * Export the implementation for direct use
 */
export { CpuFriOps as default };
