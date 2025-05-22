/*
This is the Rust code from backend/cpu/fri.rs that needs to be ported to Typescript in this backend/cpu/fri.ts file:
```rs
use super::CpuBackend;
use crate::core::fields::m31::BaseField;
use crate::core::fields::qm31::SecureField;
use crate::core::fields::secure_column::SecureColumnByCoords;
use crate::core::fri::{fold_circle_into_line, fold_line, FriOps};
use crate::core::poly::circle::SecureEvaluation;
use crate::core::poly::line::LineEvaluation;
use crate::core::poly::twiddles::TwiddleTree;
use crate::core::poly::BitReversedOrder;

impl FriOps for CpuBackend {
    fn fold_line(
        eval: &LineEvaluation<Self>,
        alpha: SecureField,
        _twiddles: &TwiddleTree<Self>,
    ) -> LineEvaluation<Self> {
        fold_line(eval, alpha)
    }

    fn fold_circle_into_line(
        dst: &mut LineEvaluation<Self>,
        src: &SecureEvaluation<Self, BitReversedOrder>,
        alpha: SecureField,
        _twiddles: &TwiddleTree<Self>,
    ) {
        fold_circle_into_line(dst, src, alpha)
    }

    fn decompose(
        eval: &SecureEvaluation<Self, BitReversedOrder>,
    ) -> (SecureEvaluation<Self, BitReversedOrder>, SecureField) {
        let lambda = Self::decomposition_coefficient(eval);
        let mut g_values = unsafe { SecureColumnByCoords::<Self>::uninitialized(eval.len()) };

        let domain_size = eval.len();
        let half_domain_size = domain_size / 2;

        for i in 0..half_domain_size {
            let x = eval.values.at(i);
            let val = x - lambda;
            g_values.set(i, val);
        }
        for i in half_domain_size..domain_size {
            let x = eval.values.at(i);
            let val = x + lambda;
            g_values.set(i, val);
        }

        let g = SecureEvaluation::new(eval.domain, g_values);
        (g, lambda)
    }
}

impl CpuBackend {
    /// Used to decompose a general polynomial to a polynomial inside the fft-space, and
    /// the remainder terms.
    /// A coset-diff on a [`CirclePoly`] that is in the FFT space will return zero.
    ///
    /// Let N be the domain size, Let h be a coset size N/2. Using lemma #7 from the CircleStark
    /// paper, <f,V_h> = lambda<V_h,V_h> = lambda\*N => lambda = f(0)\*V_h(0) + f(1)*V_h(1) + .. +
    /// f(N-1)\*V_h(N-1). The Vanishing polynomial of a cannonic coset sized half the circle
    /// domain,evaluated on the circle domain, is [(1, -1, -1, 1)] repeating. This becomes
    /// alternating [+-1] in our NaturalOrder, and [(+, +, +, ... , -, -)] in bit reverse.
    /// Explicitly, lambda\*N = sum(+f(0..N/2)) + sum(-f(N/2..)).
    ///
    /// # Warning
    /// This function assumes the blowupfactor is 2
    ///
    /// [`CirclePoly`]: crate::core::poly::circle::CirclePoly
    fn decomposition_coefficient(eval: &SecureEvaluation<Self, BitReversedOrder>) -> SecureField {
        let domain_size = 1 << eval.domain.log_size();
        let half_domain_size = domain_size / 2;

        // eval is in bit-reverse, hence all the positive factors are in the first half, opposite to
        // the latter.
        let a_sum = (0..half_domain_size)
            .map(|i| eval.values.at(i))
            .sum::<SecureField>();
        let b_sum = (half_domain_size..domain_size)
            .map(|i| eval.values.at(i))
            .sum::<SecureField>();

        // lambda = sum(+-f(p)) / 2N.
        (a_sum - b_sum) / BaseField::from_u32_unchecked(domain_size as u32)
    }
}

#[cfg(test)]
mod tests {
    use num_traits::Zero;

    use crate::core::backend::cpu::{CpuCircleEvaluation, CpuCirclePoly};
    use crate::core::backend::CpuBackend;
    use crate::core::fields::m31::BaseField;
    use crate::core::fields::qm31::SecureField;
    use crate::core::fields::secure_column::SecureColumnByCoords;
    use crate::core::fri::FriOps;
    use crate::core::poly::circle::{CanonicCoset, SecureEvaluation};
    use crate::core::poly::BitReversedOrder;
    use crate::m31;

    #[test]
    fn decompose_coeff_out_fft_space_test() {
        for domain_log_size in 5..12 {
            let domain_log_half_size = domain_log_size - 1;
            let s = CanonicCoset::new(domain_log_size);
            let domain = s.circle_domain();

            let mut coeffs = vec![BaseField::zero(); 1 << domain_log_size];

            // Polynomial is out of FFT space.
            coeffs[1 << domain_log_half_size] = m31!(1);
            assert!(!CpuCirclePoly::new(coeffs.clone()).is_in_fft_space(domain_log_half_size));

            let poly = CpuCirclePoly::new(coeffs);
            let values = poly.evaluate(domain);
            let secure_column = SecureColumnByCoords {
                columns: [
                    values.values.clone(),
                    values.values.clone(),
                    values.values.clone(),
                    values.values.clone(),
                ],
            };
            let secure_eval = SecureEvaluation::<CpuBackend, BitReversedOrder>::new(
                domain,
                secure_column.clone(),
            );

            let (g, lambda) = CpuBackend::decompose(&secure_eval);

            // Sanity check.
            assert_ne!(lambda, SecureField::zero());

            // Assert the new polynomial is in the FFT space.
            for i in 0..4 {
                let basefield_column = g.columns[i].clone();
                let eval = CpuCircleEvaluation::new(domain, basefield_column);
                let coeffs = eval.interpolate().coeffs;
                assert!(CpuCirclePoly::new(coeffs).is_in_fft_space(domain_log_half_size));
            }
        }
    }
}
```
*/

// TODO(Jules): Port the Rust `impl FriOps for CpuBackend` and the associated private method
// `decomposition_coefficient` to TypeScript.
//
// Task: Port the Rust `impl FriOps for CpuBackend` and the associated private method
// `decomposition_coefficient` to TypeScript.
//
// Details:
// - `FriOps` methods to implement for `CpuBackend`:
//   - `fold_line()`: Folds a line evaluation. The Rust implementation calls a
//     generic `fold_line` function (likely from `core/src/fri/`).
//   - `fold_circle_into_line()`: Folds a circle evaluation into a line evaluation.
//     The Rust implementation calls a generic `fold_circle_into_line` function
//     (likely from `core/src/fri/`).
//   - `decompose()`: Decomposes a `SecureEvaluation` into another `SecureEvaluation`
//     and a `SecureField` coefficient (`lambda`). This uses the
//     `decomposition_coefficient` method and `SecureColumnByCoords::uninitialized`.
// - `decomposition_coefficient()`: A private helper method on `CpuBackend` (or a
//   static/standalone function if `CpuBackend` is not yet a class) to calculate a
//   coefficient used in the FRI decomposition. It assumes a blowup factor of 2.
// - These methods would ideally belong to a `CpuBackend` class that implements a
//   `FriOps` interface (which would be defined based on `core/src/fri/mod.rs` or a
//   similar top-level FRI definitions file if `core/src/fri/` is empty).
//
// Dependencies:
// - `SecureField`, `BaseField` from `core/src/fields/`.
// - `SecureColumnByCoords` from `core/src/fields/secure_columns.ts`.
// - `SecureEvaluation`, `BitReversedOrder` from `core/src/poly/circle/`.
// - `LineEvaluation` from `core/src/poly/line.ts`.
// - `TwiddleTree` from `core/src/poly/twiddles.ts`.
// - Generic `fold_line` and `fold_circle_into_line` functions (these will need to
//   be ported first, likely in a general `core/src/fri/` module).
// - The future `FriOps` interface (from `core/src/fri/mod.rs` or similar).
//
// Goal: Provide CPU-specific implementations for FRI folding and decomposition
// operations, crucial for the FRI protocol.
//
// Tests: Port the Rust test `decompose_coeff_out_fft_space_test` to TypeScript.
//
// Note: The `_twiddles` argument in `fold_line` and `fold_circle_into_line` is
// unused in the Rust `CpuBackend` impl, but the generic functions they call might use
// them. This detail should be preserved or clarified during porting.

import { fold_line as genericFoldLine, fold_circle_into_line as genericFoldCircleIntoLine } from "../../fri";
import { LineEvaluation } from "../../poly/line";
import { SecureEvaluation, BitReversedOrder } from "../../poly/circle";
import { QM31 as SecureField } from "../../fields/qm31";
import { M31 } from "../../fields/m31";
import { SecureColumnByCoords } from "../../fields/secure_columns";

export function foldLine(
  eval_: LineEvaluation,
  alpha: SecureField,
): LineEvaluation {
  return genericFoldLine(eval_, alpha);
}

export function foldCircleIntoLine(
  dst: LineEvaluation,
  src: SecureEvaluation<unknown, BitReversedOrder>,
  alpha: SecureField,
): void {
  genericFoldCircleIntoLine(dst, src, alpha);
}

function decompositionCoefficient(eval_: SecureEvaluation<unknown, BitReversedOrder>): SecureField {
  const domainSize = 1 << eval_.domain.log_size();
  const half = domainSize / 2;
  let aSum = SecureField.from_u32_unchecked(0,0,0,0);
  for (let i = 0; i < half; i++) aSum = aSum.add(eval_.values.at(i));
  let bSum = SecureField.from_u32_unchecked(0,0,0,0);
  for (let i = half; i < domainSize; i++) bSum = bSum.add(eval_.values.at(i));
  return aSum.sub(bSum).div(M31.from_u32_unchecked(domainSize));
}

export function decompose(
  eval_: SecureEvaluation<unknown, BitReversedOrder>,
): [SecureEvaluation<unknown, BitReversedOrder>, SecureField] {
  const lambda = decompositionCoefficient(eval_);
  const gValues = SecureColumnByCoords.uninitialized(eval_.len());
  const half = eval_.len() / 2;
  for (let i = 0; i < half; i++) {
    const val = eval_.values.at(i).sub(lambda);
    gValues.set(i, val);
  }
  for (let i = half; i < eval_.len(); i++) {
    const val = eval_.values.at(i).add(lambda);
    gValues.set(i, val);
  }
  const g = new SecureEvaluation(eval_.domain, gValues) as SecureEvaluation<unknown, BitReversedOrder>;
  return [g, lambda];
}
