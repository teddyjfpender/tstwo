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

import { compress, IV } from '../../vcs/blake2s_refs';

export type Blake2sHash = Uint8Array; // Represents a 32-byte hash

// Helper function to convert Uint8Array (32 bytes) to number[] (8 u32s) in little-endian.
function bytesToU32ArrayLittleEndian(bytes: Uint8Array): number[] {
    if (bytes.length !== 32) {
        throw new Error("Input Uint8Array must be 32 bytes long.");
    }
    const u32s = new Array(8);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < 8; i++) {
        u32s[i] = view.getUint32(i * 4, true); // true for little-endian
    }
    return u32s;
}

// Helper function to convert number[] (8 u32s) to Uint8Array (32 bytes) in little-endian.
function u32ArrayToBytesLittleEndian(u32s: number[]): Uint8Array {
    if (u32s.length !== 8) {
        throw new Error("Input number array must contain 8 u32 values.");
    }
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < 8; i++) {
        view.setUint32(i * 4, u32s[i], true); // true for little-endian
    }
    return bytes;
}

/**
 * Ported `commit_on_layer` to use Blake2s `compress` function.
 * This implementation assumes that the data for a single node hash
 * (either two children hashes or column data for a leaf) fits within
 * a single 64-byte Blake2s compression block.
 */
export function commitOnLayer(
  logSize: number,
  prevLayer: Blake2sHash[] | undefined, // Each Blake2sHash is Uint8Array(32)
  columns: readonly (readonly number[])[], // Each inner array is a column, numbers are BaseField like.
): Blake2sHash[] {
  const size = 1 << logSize;
  const result: Blake2sHash[] = new Array(size);

  for (let i = 0; i < size; i++) {
    const h_vecs: Readonly<number[]> = IV; // Initial hash vector for Blake2s
    const msg_vecs: number[] = new Array(16).fill(0); // 16 u32 words = 64 bytes
    let count_low = 0;

    if (prevLayer) {
      // Internal node: hash of two children (each 32 bytes / 8 u32s)
      if (prevLayer[2 * i].length !== 32 || prevLayer[2 * i + 1].length !== 32) {
        throw new Error("Child hashes must be 32 bytes long.");
      }
      const child1_u32s = bytesToU32ArrayLittleEndian(prevLayer[2 * i]);
      const child2_u32s = bytesToU32ArrayLittleEndian(prevLayer[2 * i + 1]);

      msg_vecs.set(child1_u32s, 0); // First child in the first 8 words
      msg_vecs.set(child2_u32s, 8); // Second child in the next 8 words
      count_low = 64; // 32 bytes + 32 bytes = 64 bytes
    } else {
      // Leaf node: hash of column data
      const columnDataU32s: number[] = [];
      for (const column of columns) {
        columnDataU32s.push(column[i] >>> 0); // Ensure it's a u32
      }

      if (columnDataU32s.length > 16) {
        // This simplified version assumes column data fits in one compression block (64 bytes / 16 u32s)
        throw new Error(
          `Too much column data for a single Blake2s compress call: ${columnDataU32s.length} u32s. Max is 16.`,
        );
      }
      msg_vecs.set(columnDataU32s, 0);
      count_low = columnDataU32s.length * 4; // Each u32 is 4 bytes
    }

    // Call Blake2s compression function
    // h_vecs: initial vector (IV)
    // msg_vecs: message block (children or column data)
    // count_low: length of message in bytes
    // count_high: 0 (message length < 2^32 bytes)
    // lastblock: 0xFFFFFFFF (true, as this is the only block processed for this node's hash)
    // lastnode: 0 (false, assuming this is not the root of a larger tree structure in tree hashing mode)
    const compressed_u32s = compress(h_vecs, msg_vecs, count_low, 0, 0xFFFFFFFF, 0);

    result[i] = u32ArrayToBytesLittleEndian(compressed_u32s);
  }
  return result;
}
