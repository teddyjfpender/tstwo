/*
This is the Rust code from vcs/ops.rs that needs to be ported to Typescript in this vcs/ops.ts file:
```rs
use std::fmt::Debug;

use serde::{Deserialize, Serialize};

use crate::core::backend::{Col, ColumnOps};
use crate::core::fields::m31::BaseField;
use crate::core::vcs::hash::Hash;

/// A Merkle node hash is a hash of: `[left_child_hash, right_child_hash], column0_value,
/// column1_value, ...` where `[]` denotes optional values.
///
/// The largest Merkle layer has no left and right child hashes. The rest of the layers have
/// children hashes. At each layer, the tree may have multiple columns of the same length as the
/// layer. Each node in that layer contains one value from each column.
pub trait MerkleHasher: Debug + Default + Clone {
    type Hash: Hash;
    /// Hashes a single Merkle node. See [MerkleHasher] for more details.
    fn hash_node(
        children_hashes: Option<(Self::Hash, Self::Hash)>,
        column_values: &[BaseField],
    ) -> Self::Hash;
}

/// Trait for performing Merkle operations on a commitment scheme.
pub trait MerkleOps<H: MerkleHasher>:
    ColumnOps<BaseField> + ColumnOps<H::Hash> + for<'de> Deserialize<'de> + Serialize
{
    /// Commits on an entire layer of the Merkle tree.
    /// See [MerkleHasher] for more details.
    ///
    /// The layer has 2^`log_size` nodes that need to be hashed. The topmost layer has 1 node,
    /// which is a hash of 2 children and some columns.
    ///
    /// `prev_layer` is the previous layer of the Merkle tree, if this is not the leaf layer.
    /// That layer is assumed to have 2^(`log_size`+1) nodes.
    ///
    /// `columns` are the extra columns that need to be hashed in each node.
    /// They are assumed to be of size 2^`log_size`.
    ///
    /// Returns the next Merkle layer hashes.
    fn commit_on_layer(
        log_size: u32,
        prev_layer: Option<&Col<Self, H::Hash>>,
        columns: &[&Col<Self, BaseField>],
    ) -> Col<Self, H::Hash>;
}
```
*/
// TypeScript adaptation of the Merkle traits.

import type { M31 as BaseField } from "../fields/m31";

/** Interface for hashing Merkle tree nodes. */
export interface MerkleHasher<Hash> {
  /**
   * Hashes a single Merkle node. `childrenHashes` contains the left and right
   * child hashes when available (for non-leaf layers).
   */
  hashNode(
    childrenHashes: [Hash, Hash] | undefined,
    columnValues: readonly BaseField[],
  ): Hash;
}

/** Interface describing operations needed to commit a Merkle tree on a backend. */
export interface MerkleOps<Hash> {
  /**
   * Commits on an entire layer of the Merkle tree. Returns the next layer's
   * hashes.
   */
  commitOnLayer(
    logSize: number,
    prevLayer: readonly Hash[] | undefined,
    columns: readonly (readonly BaseField[])[],
  ): Hash[];
}
