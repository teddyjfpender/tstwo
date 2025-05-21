/*
This is the Rust code from backend/cpu/poseidon252.rs that needs to be ported to Typescript in this backend/cpu/poseidon252.ts file:
```rs
use itertools::Itertools;
use starknet_ff::FieldElement as FieldElement252;

use super::CpuBackend;
use crate::core::fields::m31::BaseField;
use crate::core::vcs::ops::{MerkleHasher, MerkleOps};
use crate::core::vcs::poseidon252_merkle::Poseidon252MerkleHasher;

impl MerkleOps<Poseidon252MerkleHasher> for CpuBackend {
    fn commit_on_layer(
        log_size: u32,
        prev_layer: Option<&Vec<FieldElement252>>,
        columns: &[&Vec<BaseField>],
    ) -> Vec<FieldElement252> {
        (0..(1 << log_size))
            .map(|i| {
                Poseidon252MerkleHasher::hash_node(
                    prev_layer.map(|prev_layer| (prev_layer[2 * i], prev_layer[2 * i + 1])),
                    &columns.iter().map(|column| column[i]).collect_vec(),
                )
            })
            .collect()
    }
}
```
*/

// TODO(Jules): Port the Rust `impl MerkleOps<Poseidon252MerkleHasher> for CpuBackend` to TypeScript.
//
// Task: Port the Rust `impl MerkleOps<Poseidon252MerkleHasher> for CpuBackend` to TypeScript.
//
// Details: This involves implementing the `commit_on_layer` method for the CPU backend
// using the Poseidon252 hash.
//   - `commit_on_layer()`: Computes a layer of a Merkle tree. For each node in the
//     layer, it calls `Poseidon252MerkleHasher::hash_node` with optional children
//     hashes and the current column values.
//   - This function should eventually become a method of a `CpuBackend` class that
//     implements a `MerkleOps<Poseidon252MerkleHasher>` interface (where
//     `Poseidon252MerkleHasher` itself will be a port from
//     `vcs/poseidon252_merkle.ts`).
//
// Dependencies:
//   - `BaseField` from `core/src/fields/m31.ts`.
//   - `FieldElement252` (or its TypeScript equivalent) as the hash type, likely from
//     a StarkNet library or to be defined.
//   - The future port of `Poseidon252MerkleHasher` from
//     `core/src/vcs/poseidon252_merkle.ts` (which includes `hash_node`).
//   - The future `MerkleOps` interface (from `core/src/vcs/ops.ts`).
//
// Goal: Provide a CPU backend implementation for committing to Merkle tree layers
// using Poseidon252 hash, to be used by the `MerkleProver` in `vcs/prover.ts`.
//
// Tests: Add unit tests to verify the layer commitment logic, ideally by comparing
// outputs with the Rust version or testing against known Merkle tree structures
// with Poseidon252.