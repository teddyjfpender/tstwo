/*
This is the Rust code from backend/cpu/blake2.rs that needs to be ported to Typescript in this backend/cpu/blake2.ts file:
```rs
use itertools::Itertools;

use crate::core::backend::CpuBackend;
use crate::core::fields::m31::BaseField;
use crate::core::vcs::blake2_hash::Blake2sHash;
use crate::core::vcs::blake2_merkle::Blake2sMerkleHasher;
use crate::core::vcs::ops::{MerkleHasher, MerkleOps};

impl MerkleOps<Blake2sMerkleHasher> for CpuBackend {
    fn commit_on_layer(
        log_size: u32,
        prev_layer: Option<&Vec<Blake2sHash>>,
        columns: &[&Vec<BaseField>],
    ) -> Vec<Blake2sHash> {
        (0..(1 << log_size))
            .map(|i| {
                Blake2sMerkleHasher::hash_node(
                    prev_layer.map(|prev_layer| (prev_layer[2 * i], prev_layer[2 * i + 1])),
                    &columns.iter().map(|column| column[i]).collect_vec(),
                )
            })
            .collect()
    }
}
```
*/

import { blake2s } from '@noble/hashes/blake2';

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
    
    result[i] = blake2s(message, { dkLen: 32 });
  }
  return result;
}
