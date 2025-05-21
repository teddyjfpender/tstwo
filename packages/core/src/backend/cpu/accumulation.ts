/*
This is the Rust code from backend/cpu/accumulation.rs that needs to be ported to Typescript in this backend/cpu/accumulation.ts file:
```rs
use num_traits::One;

use crate::core::air::accumulation::AccumulationOps;
use crate::core::backend::cpu::CpuBackend;
use crate::core::fields::qm31::SecureField;
use crate::core::fields::secure_column::SecureColumnByCoords;

impl AccumulationOps for CpuBackend {
    fn accumulate(column: &mut SecureColumnByCoords<Self>, other: &SecureColumnByCoords<Self>) {
        for i in 0..column.len() {
            let res_coeff = column.at(i) + other.at(i);
            column.set(i, res_coeff);
        }
    }

    fn generate_secure_powers(felt: SecureField, n_powers: usize) -> Vec<SecureField> {
        (0..n_powers)
            .scan(SecureField::one(), |acc, _| {
                let res = *acc;
                *acc *= felt;
                Some(res)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use num_traits::One;

    use crate::core::air::accumulation::AccumulationOps;
    use crate::core::backend::CpuBackend;
    use crate::core::fields::qm31::SecureField;
    use crate::core::fields::FieldExpOps;
    use crate::qm31;
    #[test]
    fn generate_secure_powers_works() {
        let felt = qm31!(1, 2, 3, 4);
        let n_powers = 10;

        let powers = <CpuBackend as AccumulationOps>::generate_secure_powers(felt, n_powers);

        assert_eq!(powers.len(), n_powers);
        assert_eq!(powers[0], SecureField::one());
        assert_eq!(powers[1], felt);
        assert_eq!(powers[7], felt.pow(7));
    }

    #[test]
    fn generate_empty_secure_powers_works() {
        let felt = qm31!(1, 2, 3, 4);
        let max_log_size = 0;

        let powers = <CpuBackend as AccumulationOps>::generate_secure_powers(felt, max_log_size);

        assert_eq!(powers, vec![]);
    }
}
```
*/
import { QM31 as SecureField } from "../../fields/qm31";
import { SecureColumnByCoords } from "../../fields/secure_columns";

// TODO(Jules): Verify and finalize the TypeScript implementations of `accumulate` and
// `generate_secure_powers` against the Rust `impl AccumulationOps for CpuBackend`.
//
// Task: Verify and finalize the TypeScript implementations of `accumulate` and
// `generate_secure_powers` against the Rust `impl AccumulationOps for CpuBackend`.
//
// Details:
// - The existing TypeScript functions `accumulate` and `generate_secure_powers` appear
//   to implement the core logic.
// - Ensure these functions precisely match the behavior of the Rust implementations,
//   including edge cases (e.g., `n_powers = 0` for `generate_secure_powers`,
//   empty columns for `accumulate`).
// - These functions should eventually be methods of a `CpuBackend` class that
//   implements an `AccumulationOps` interface (which will be defined based on
//   `core/src/air/accumulator.ts`).
//
// Dependencies:
// - `SecureField` from `core/src/fields/qm31.ts`.
// - `SecureColumnByCoords` from `core/src/fields/secure_columns.ts`.
// - The future `AccumulationOps` interface (from `core/src/air/accumulator.ts`).
//
// Goal: Provide a correct and verified CPU backend implementation for accumulation
// operations, to be used by `DomainEvaluationAccumulator` and other AIR components.
//
// Tests: Port the existing Rust tests for `generate_secure_powers` (including
// `generate_empty_secure_powers_works`) and add tests for `accumulate` if not
// already covered by tests for `DomainEvaluationAccumulator`. Ensure all relevant
// behaviors from the Rust tests are covered in TypeScript.

/**
 * Port of `backend/cpu/accumulation.rs` AccumulationOps for CpuBackend.
 * See original Rust reference above for edge-case behavior.
 */
export function accumulate(
  column: SecureColumnByCoords,
  other: SecureColumnByCoords,
): void {
  if (column.len() !== other.len()) {
    throw new Error("column length mismatch");
  }
  for (let i = 0; i < column.len(); i++) {
    const res = column.at(i).add(other.at(i));
    column.set(i, res);
  }
}

/** Generate the first `nPowers` powers of `felt`. */
export function generate_secure_powers(
  felt: SecureField,
  nPowers: number,
): SecureField[] {
  const res: SecureField[] = [];
  let acc = SecureField.one();
  for (let i = 0; i < nPowers; i++) {
    res.push(acc);
    acc = acc.mul(felt);
  }
  return res;
}
