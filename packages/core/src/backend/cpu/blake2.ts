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

import { createHash } from "crypto";

export type Blake2sHash = Uint8Array;

/** Ported commit_on_layer using Node's blake2s256. */
export function commitOnLayer(
  logSize: number,
  prevLayer: Blake2sHash[] | undefined,
  columns: readonly (readonly number[])[],
): Blake2sHash[] {
  const size = 1 << logSize;
  const result: Blake2sHash[] = new Array(size);
  for (let i = 0; i < size; i++) {
    const h = createHash("blake2s256");
    if (prevLayer) {
      h.update(prevLayer[2 * i]);
      h.update(prevLayer[2 * i + 1]);
    }
    for (const column of columns) {
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(column[i] >>> 0, 0);
      h.update(buf);
    }
    result[i] = new Uint8Array(h.digest());
  }
  return result;
}
