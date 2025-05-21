/*
This is the Rust code from backend/cpu/lookups/mle.rs that needs to be ported to Typescript in this backend/cpu/lookups/mle.ts file:
```rs
use std::iter::zip;

use num_traits::{One, Zero};

use crate::core::backend::CpuBackend;
use crate::core::fields::m31::BaseField;
use crate::core::fields::qm31::SecureField;
use crate::core::lookups::mle::{Mle, MleOps};
use crate::core::lookups::sumcheck::MultivariatePolyOracle;
use crate::core::lookups::utils::{fold_mle_evals, UnivariatePoly};

impl MleOps<BaseField> for CpuBackend {
    fn fix_first_variable(
        mle: Mle<Self, BaseField>,
        assignment: SecureField,
    ) -> Mle<Self, SecureField> {
        let midpoint = mle.len() / 2;
        let (lhs_evals, rhs_evals) = mle.split_at(midpoint);

        let res = zip(lhs_evals, rhs_evals)
            .map(|(&lhs_eval, &rhs_eval)| fold_mle_evals(assignment, lhs_eval, rhs_eval))
            .collect();

        Mle::new(res)
    }
}

impl MleOps<SecureField> for CpuBackend {
    fn fix_first_variable(
        mle: Mle<Self, SecureField>,
        assignment: SecureField,
    ) -> Mle<Self, SecureField> {
        let midpoint = mle.len() / 2;
        let mut evals = mle.into_evals();

        for i in 0..midpoint {
            let lhs_eval = evals[i];
            let rhs_eval = evals[i + midpoint];
            evals[i] = fold_mle_evals(assignment, lhs_eval, rhs_eval);
        }

        evals.truncate(midpoint);

        Mle::new(evals)
    }
}

impl MultivariatePolyOracle for Mle<CpuBackend, SecureField> {
    fn n_variables(&self) -> usize {
        self.n_variables()
    }

    fn sum_as_poly_in_first_variable(&self, claim: SecureField) -> UnivariatePoly<SecureField> {
        let x0 = SecureField::zero();
        let x1 = SecureField::one();

        let y0 = self[0..self.len() / 2].iter().sum();
        let y1 = claim - y0;

        UnivariatePoly::interpolate_lagrange(&[x0, x1], &[y0, y1])
    }

    fn fix_first_variable(self, challenge: SecureField) -> Self {
        self.fix_first_variable(challenge)
    }
}
```
*/

// TODO(Jules): Port the Rust `impl MleOps<BaseField> for CpuBackend`,
// `impl MleOps<SecureField> for CpuBackend`, and
// `impl MultivariatePolyOracle for Mle<CpuBackend, SecureField>` to TypeScript.
//
// Task: Port the Rust implementations for `MleOps<BaseField>`, `MleOps<SecureField>`,
// and `MultivariatePolyOracle` for `Mle<CpuBackend, SecureField>` to TypeScript.
//
// Details:
// - `MleOps<BaseField>` for `CpuBackend`:
//   - `fix_first_variable(mle: Mle<CpuBackend, BaseField>, assignment: SecureField)`: Mle<CpuBackend, SecureField>
//     - Fixes the first variable of an MLE with `BaseField` evaluations.
//     - Returns a new MLE with `SecureField` evaluations.
//
// - `MleOps<SecureField>` for `CpuBackend`:
//   - `fix_first_variable(mle: Mle<CpuBackend, SecureField>, assignment: SecureField)`: Mle<CpuBackend, SecureField>
//     - Fixes the first variable of an MLE with `SecureField` evaluations.
//     - Returns a new MLE with `SecureField` evaluations.
//
// - `MultivariatePolyOracle` for `Mle<CpuBackend, SecureField>`:
//   - `n_variables()`: number
//     - Returns the number of variables in the MLE.
//   - `sum_as_poly_in_first_variable(claim: SecureField)`: UnivariatePoly<SecureField>
//     - Computes the sum over the MLE as a univariate polynomial.
//   - `fix_first_variable(challenge: SecureField)`: Mle<CpuBackend, SecureField>
//     - Fixes the first variable of the MLE oracle (likely calls the `MleOps` version).
//
// - These implementations would ideally become methods of a `CpuBackend` class
//   (for `MleOps`) or methods of the `Mle` class itself when specialized for `CpuBackend`
//   (for `MultivariatePolyOracle`).
//
// Dependencies:
// - `BaseField`, `SecureField` from `core/src/fields/`.
// - `Mle` class and `MleOps` interface (from `core/src/lookups/mle.ts`).
// - `MultivariatePolyOracle` interface (from `core/src/lookups/sumcheck.ts`).
// - `UnivariatePoly` (from `core/src/lookups/utils.ts`).
// - `fold_mle_evals` utility (from `core/src/lookups/utils.ts`).
//
// Goal: Provide CPU-specific implementations for operations on Multivariate Linear
// Extensions (MLEs). These are fundamental for sumcheck protocols and other components
// like GKR.
//
// Tests: Although no tests are directly in this Rust snippet, unit tests for these
// MLE operations should be created. These tests might reference existing tests for
// `Mle` or `sumcheck` if they exist elsewhere in the Rust codebase to ensure
// behavioral parity.
