
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
