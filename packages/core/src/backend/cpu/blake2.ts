// TODO(Jules): Verify and finalize the TypeScript implementation of `commitOnLayer`
// against the Rust `impl MerkleOps<Blake2sMerkleHasher> for CpuBackend`.
//
// Task: Verify and finalize the TypeScript implementation of `commitOnLayer` against
// the Rust `impl MerkleOps<Blake2sMerkleHasher> for CpuBackend`.
//
// Details:
// - The existing TypeScript `commitOnLayer` function attempts to replicate the Merkle
//   tree layer commitment using `@noble/hashes/blake2s`.
// - The crucial part is ensuring it correctly replicates the behavior of
//   `Blake2sMerkleHasher::hash_node` from `core/src/vcs/blake2_merkle.ts` (which
//   also needs porting). The current TS `commitOnLayer` makes assumptions about
//   `hash_node` as noted in its comments.
// - This function should eventually become a method of a `CpuBackend` class that
//   implements a `MerkleOps<Blake2sMerkleHasher>` interface (where
//   `Blake2sMerkleHasher` itself will be a port from `vcs/blake2_merkle.ts`).
//
// Dependencies:
// - `BaseField` from `core/src/fields/m31.ts`.
// - `Blake2sHash` type (currently defined locally, but should align with
//   `core/src/vcs/blake2_hash.ts`).
// - The future port of `Blake2sMerkleHasher` from `core/src/vcs/blake2_merkle.ts`.
// - The future `MerkleOps` interface (from `core/src/vcs/ops.ts`).
//
// Goal: Provide a correct and verified CPU backend implementation for committing to
// Merkle tree layers using Blake2s, to be used by the `MerkleProver` in `vcs/prover.ts`.
//
// Verification: Pay close attention to the existing detailed comments in the
// `commitOnLayer` function regarding potential discrepancies with the Rust
// implementation if `hash_node` has specific pre-processing. This will require
// careful cross-referencing once `Blake2sMerkleHasher` is ported.
//
// Tests: Add unit tests to verify the layer commitment logic, ideally by comparing
// outputs with the Rust version if possible, or by testing against known Merkle
// tree structures.

import { blake2s } from '@noble/hashes/blake2.js';

export type Blake2sHash = Uint8Array; // Represents a 32-byte hash

// Helper function to concatenate Uint8Arrays
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const arr of arrays) {
        totalLength += arr.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// Helper function to convert an array of numbers to a little-endian Uint8Array
function numbersToLEUint8Array(nums: number[]): Uint8Array {
    const bytes = new Uint8Array(nums.length * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < nums.length; i++) {
        view.setUint32(i * 4, nums[i], true); // true for little-endian
    }
    return bytes;
}

/**
 * Computes the hashes for a layer in a Merkle tree using Blake2s.
 *
 * This TypeScript implementation uses the `blake2s` function directly from the
 * `@noble/hashes` library.
 *
 * The original Rust code for `commit_on_layer` (in `backend/cpu/blake2.rs`)
 * invokes an intermediate function `Blake2sMerkleHasher::hash_node(...)`. The
 * exact source code for `hash_node` is not available in this context.
 * It is presumed that `hash_node` would prepare the input data (either
 * child hashes for an internal node or column data for a leaf node) and then
 * call a core Blake2s compression routine or a full Blake2s hash function.
 *
 * Assumption:
 * The current approach in this TypeScript version is a standard method for
 * constructing Merkle tree hashes:
 *  - For internal nodes: The two 32-byte child hashes are concatenated to form
 *    a 64-byte message, which is then hashed with Blake2s.
 *  - For leaf nodes: The column data (series of u32 numbers) is serialized
 *    into a single Uint8Array (numbers in little-endian byte order). This
 *    byte array is then hashed with Blake2s.
 * The output hash length is 32 bytes.
 *
 * Suggestion:
 * If `Blake2sMerkleHasher::hash_node` in the original Rust implementation had
 * very specific pre-processing steps, padding rules, or used particular Blake2s
 * parameters (like personalization, salt, tree hashing mode parameters) that
 * are not applied in this direct `@noble/hashes/blake2s` usage, the resulting
 * hashes could differ from those produced by the original Rust system.
 * However, without the source of `hash_node`, this implementation uses a
 * standard Blake2s application for Merkle tree construction.
 */
export function commitOnLayer(
  logSize: number,
  prevLayer: Blake2sHash[] | undefined, // Each Blake2sHash is Uint8Array(32)
  columns: readonly (readonly number[])[], // Each inner array is a column, numbers are BaseField like.
): Blake2sHash[] {
  const size = 1 << logSize;
  const result: Blake2sHash[] = new Array(size);

  for (let i = 0; i < size; i++) {
    let message: Uint8Array;

    if (prevLayer) {
      // Internal node: hash of two children
      if (prevLayer[2 * i].length !== 32 || prevLayer[2 * i + 1].length !== 32) {
        throw new Error("Child hashes must be 32 bytes long.");
      }
      message = concatUint8Arrays([prevLayer[2 * i], prevLayer[2 * i + 1]]);
    } else {
      // Leaf node: hash of column data
      const leafNumbers: number[] = [];
      for (const column of columns) {
        leafNumbers.push(column[i] >>> 0); // Ensure it's a u32
      }
      message = numbersToLEUint8Array(leafNumbers);
    }
    
    result[i] = blake2s(message);
  }
  return result;
}
