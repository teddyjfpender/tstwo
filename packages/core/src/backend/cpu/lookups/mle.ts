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

import { M31 as BaseField } from '../../../fields/m31';
import { QM31 as SecureField } from '../../../fields/qm31';
import { Mle } from '../../../lookups/mle';
import type { MultivariatePolyOracle } from '../../../lookups/sumcheck';
import { UnivariatePoly, foldMleEvals } from '../../../lookups/utils';
import type { CpuBackend } from '../index';

/**
 * CPU backend implementation of MLE operations for BaseField.
 * 
 * This class provides CPU-specific implementations for operations on Multivariate Linear
 * Extensions (MLEs) with BaseField evaluations.
 */
export class CpuMleOpsBaseField {
  /**
   * Returns a transformed MLE where the first variable is fixed to `assignment`.
   * 
   * @param mle - MLE with BaseField evaluations
   * @param assignment - SecureField value to fix the first variable to
   * @returns New MLE with SecureField evaluations
   */
  static fixFirstVariable(
    mle: Mle<BaseField>,
    assignment: SecureField
  ): Mle<SecureField> {
    const midpoint = Math.floor(mle.len() / 2);
    const lhsEvals = mle.slice(0, midpoint);
    const rhsEvals = mle.slice(midpoint);

    const result = lhsEvals.map((lhsEval, i) => {
      const rhsEval = rhsEvals[i];
      if (rhsEval === undefined) {
        throw new Error(`Missing evaluation at index ${i}`);
      }
      return foldMleEvals(assignment, lhsEval, rhsEval);
    });

    return new Mle(result);
  }
}

/**
 * CPU backend implementation of MLE operations for SecureField.
 * 
 * This class provides CPU-specific implementations for operations on Multivariate Linear
 * Extensions (MLEs) with SecureField evaluations.
 */
export class CpuMleOpsSecureField {
  /**
   * Returns a transformed MLE where the first variable is fixed to `assignment`.
   * 
   * @param mle - MLE with SecureField evaluations
   * @param assignment - SecureField value to fix the first variable to
   * @returns New MLE with SecureField evaluations
   */
  static fixFirstVariable(
    mle: Mle<SecureField>,
    assignment: SecureField
  ): Mle<SecureField> {
    const midpoint = Math.floor(mle.len() / 2);
    const evals = mle.intoEvals();

    for (let i = 0; i < midpoint; i++) {
      const lhsEval = evals[i];
      const rhsEval = evals[i + midpoint];
      if (lhsEval === undefined || rhsEval === undefined) {
        throw new Error(`Missing evaluation at index ${i}`);
      }
      evals[i] = foldMleEvals(assignment, lhsEval, rhsEval);
    }

    // Truncate to midpoint
    evals.length = midpoint;

    return new Mle(evals);
  }
}

/**
 * CPU backend implementation of MultivariatePolyOracle for MLE with SecureField.
 * 
 * This class extends the base MLE class to implement the MultivariatePolyOracle interface
 * for CPU backend operations.
 */
export class CpuMleMultivariatePolyOracle extends Mle<SecureField> implements MultivariatePolyOracle {
  constructor(evals: SecureField[]) {
    super(evals);
  }

  /**
   * Returns the number of variables in the MLE.
   */
  nVariables(): number {
    return super.nVariables();
  }

  /**
   * Computes the sum of the MLE over the first variable as a univariate polynomial.
   * 
   * @param claim - The claimed sum over all variables
   * @returns Univariate polynomial in the first variable
   */
  sumAsPolyInFirstVariable(claim: SecureField): UnivariatePoly<SecureField> {
    const x0 = SecureField.zero();
    const x1 = SecureField.one();

    // Sum the first half (when x_0 = 0)
    const halfLen = Math.floor(this.len() / 2);
    let y0 = SecureField.zero();
    for (let i = 0; i < halfLen; i++) {
      y0 = y0.add(this.at(i));
    }

    // The second half sum (when x_0 = 1) can be computed from claim
    const y1 = claim.sub(y0);

    return UnivariatePoly.interpolateLagrange([x0, x1], [y0, y1]);
  }

  /**
   * Returns a transformed oracle where the first variable is fixed to `challenge`.
   * 
   * @param challenge - SecureField value to fix the first variable to
   * @returns New MLE oracle with the first variable fixed
   */
  fixFirstVariable(challenge: SecureField): CpuMleMultivariatePolyOracle {
    const fixedMle = CpuMleOpsSecureField.fixFirstVariable(this, challenge);
    return new CpuMleMultivariatePolyOracle(fixedMle.intoEvals());
  }
}

/**
 * CPU backend MLE operations interface.
 * 
 * This provides a unified interface for MLE operations on the CPU backend,
 * supporting both BaseField and SecureField operations.
 */
export class CpuMleOps {
  /**
   * Fix first variable for BaseField MLE.
   */
  static fixFirstVariableBaseField = CpuMleOpsBaseField.fixFirstVariable;

  /**
   * Fix first variable for SecureField MLE.
   */
  static fixFirstVariableSecureField = CpuMleOpsSecureField.fixFirstVariable;

  /**
   * Create a MultivariatePolyOracle from a SecureField MLE.
   */
  static createMultivariatePolyOracle(evals: SecureField[]): CpuMleMultivariatePolyOracle {
    return new CpuMleMultivariatePolyOracle(evals);
  }
}
