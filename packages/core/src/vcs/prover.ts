/*
This is the Rust code from vcs/prover.rs that needs to be ported to Typescript in this vcs/prover.ts file:
```rs
use std::cmp::Reverse;
use std::collections::BTreeMap;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use tracing::{span, Level};

use super::ops::{MerkleHasher, MerkleOps};
use super::utils::{next_decommitment_node, option_flatten_peekable};
use crate::core::backend::{Col, Column};
use crate::core::fields::m31::BaseField;
use crate::core::utils::PeekableExt;

pub struct MerkleProver<B: MerkleOps<H>, H: MerkleHasher> {
    /// Layers of the Merkle tree.
    /// The first layer is the root layer.
    /// The last layer is the largest layer.
    /// See [MerkleOps::commit_on_layer] for more details.
    pub layers: Vec<Col<B, H::Hash>>,
}
/// The MerkleProver struct represents a prover for a Merkle commitment scheme.
/// It is generic over the types `B` and `H`, which represent the Merkle operations and Merkle
/// hasher respectively.
impl<B: MerkleOps<H>, H: MerkleHasher> MerkleProver<B, H> {
    /// Commits to columns.
    /// Columns must be of power of 2 sizes.
    ///
    /// # Arguments
    ///
    /// * `columns` - A vector of references to columns.
    ///
    /// # Panics
    ///
    /// This function will panic if the columns are not sorted in descending order or if the columns
    /// vector is empty.
    ///
    /// # Returns
    ///
    /// A new instance of `MerkleProver` with the committed layers.
    pub fn commit(columns: Vec<&Col<B, BaseField>>) -> Self {
        let _span = span!(Level::TRACE, "Merkle", class = "MerkleCommitment").entered();
        if columns.is_empty() {
            return Self {
                layers: vec![B::commit_on_layer(0, None, &[])],
            };
        }

        let columns = &mut columns
            .into_iter()
            .sorted_by_key(|c| Reverse(c.len()))
            .peekable();

        let mut layers: Vec<Col<B, H::Hash>> = Vec::new();

        let max_log_size = columns.peek().unwrap().len().ilog2();
        for log_size in (0..=max_log_size).rev() {
            // Take columns of the current log_size.
            let layer_columns = columns
                .peek_take_while(|column| column.len().ilog2() == log_size)
                .collect_vec();

            layers.push(B::commit_on_layer(log_size, layers.last(), &layer_columns));
        }
        layers.reverse();
        Self { layers }
    }

    /// Decommits to columns on the given queries.
    /// Queries are given as indices to the largest column.
    ///
    /// # Arguments
    ///
    /// * `queries_per_log_size` - Maps a log_size to a vector of queries for columns of that size.
    /// * `columns` - A vector of references to columns.
    ///
    /// # Returns
    ///
    /// A tuple containing:
    /// * A vector queried values sorted by the order they were queried from the largest layer to
    ///   the smallest.
    /// * A `MerkleDecommitment` containing the hash and column witnesses.
    pub fn decommit(
        &self,
        queries_per_log_size: &BTreeMap<u32, Vec<usize>>,
        columns: Vec<&Col<B, BaseField>>,
    ) -> (Vec<BaseField>, MerkleDecommitment<H>) {
        // Prepare output buffers.
        let mut queried_values = vec![];
        let mut decommitment = MerkleDecommitment::empty();

        // Sort columns by layer.
        let mut columns_by_layer = columns
            .iter()
            .sorted_by_key(|c| Reverse(c.len()))
            .peekable();

        let mut last_layer_queries = vec![];
        for layer_log_size in (0..self.layers.len() as u32).rev() {
            // Prepare write buffer for queries to the current layer. This will propagate to the
            // next layer.
            let mut layer_total_queries = vec![];

            // Each layer node is a hash of column values as previous layer hashes.
            // Prepare the relevant columns and previous layer hashes to read from.
            let layer_columns = columns_by_layer
                .peek_take_while(|column| column.len().ilog2() == layer_log_size)
                .collect_vec();
            let previous_layer_hashes = self.layers.get(layer_log_size as usize + 1);

            // Queries to this layer come from queried node in the previous layer and queried
            // columns in this one.
            let mut prev_layer_queries = last_layer_queries.into_iter().peekable();
            let mut layer_column_queries =
                option_flatten_peekable(queries_per_log_size.get(&layer_log_size));

            // Merge previous layer queries and column queries.
            while let Some(node_index) =
                next_decommitment_node(&mut prev_layer_queries, &mut layer_column_queries)
            {
                if let Some(previous_layer_hashes) = previous_layer_hashes {
                    // If the left child was not computed, add it to the witness.
                    if prev_layer_queries.next_if_eq(&(2 * node_index)).is_none() {
                        decommitment
                            .hash_witness
                            .push(previous_layer_hashes.at(2 * node_index));
                    }

                    // If the right child was not computed, add it to the witness.
                    if prev_layer_queries
                        .next_if_eq(&(2 * node_index + 1))
                        .is_none()
                    {
                        decommitment
                            .hash_witness
                            .push(previous_layer_hashes.at(2 * node_index + 1));
                    }
                }

                // If the column values were queried, return them.
                let node_values = layer_columns.iter().map(|c| c.at(node_index));
                if layer_column_queries.next_if_eq(&node_index).is_some() {
                    queried_values.extend(node_values);
                } else {
                    // Otherwise, add them to the witness.
                    decommitment.column_witness.extend(node_values);
                }

                layer_total_queries.push(node_index);
            }

            // Propagate queries to the next layer.
            last_layer_queries = layer_total_queries;
        }

        (queried_values, decommitment)
    }

    pub fn root(&self) -> H::Hash {
        self.layers.first().unwrap().at(0)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd)]
pub struct MerkleDecommitment<H: MerkleHasher> {
    /// Hash values that the verifier needs but cannot deduce from previous computations, in the
    /// order they are needed.
    pub hash_witness: Vec<H::Hash>,
    /// Column values that the verifier needs but cannot deduce from previous computations, in the
    /// order they are needed.
    /// This complements the column values that were queried. These must be supplied directly to
    /// the verifier.
    pub column_witness: Vec<BaseField>,
}
impl<H: MerkleHasher> MerkleDecommitment<H> {
    const fn empty() -> Self {
        Self {
            hash_witness: Vec::new(),
            column_witness: Vec::new(),
        }
    }
}
```
*/
import type { MerkleHasher, MerkleOps } from './ops';
import type { M31 as BaseField } from '../fields/m31';
import type { MerkleDecommitment } from './verifier';
import { nextDecommitmentNode, makePeekable, optionFlattenPeekable } from './utils';

export class MerkleProver<Hash> {
  layers: Hash[][];

  private constructor(layers: Hash[][]) {
    this.layers = layers;
  }

  static commit<Hash>(
    ops: MerkleOps<Hash>,
    columns: Array<readonly BaseField[]>,
  ): MerkleProver<Hash> {
    if (columns.length === 0) {
      return new MerkleProver([ops.commitOnLayer(0, undefined, [])]);
    }

    const cols = [...columns].sort((a, b) => b.length - a.length);
    const layers: Hash[][] = [];
    const maxLog = Math.log2(cols[0].length);
    for (let log = maxLog; log >= 0; log--) {
      const layerCols = cols.filter(c => Math.log2(c.length) === log);
      layers.push(ops.commitOnLayer(log, layers[layers.length - 1], layerCols));
    }
    layers.reverse();
    return new MerkleProver(layers);
  }

  decommit(
    queriesPerLogSize: ReadonlyMap<number, number[]>,
    columns: Array<readonly BaseField[]>,
  ): [BaseField[], MerkleDecommitment<Hash>] {
    const queried: BaseField[] = [];
    const decommitment: MerkleDecommitment<Hash> = { hashWitness: [], columnWitness: [] };

    const sortedColumns = [...columns].sort((a, b) => b.length - a.length);
    let colProcessingIndex = 0; // To keep track of processed columns from sortedColumns
    
    let lastLayerNodeIndices: number[] = []; // Stores node indices from current layer to be used as parent queries for next layer

    // Iterate from the largest layer (leaves or near-leaves) down to the root layer.
    // `this.layers` is ordered from root (index 0) to largest layer (index this.layers.length - 1).
    // So, `layer` index corresponds to `logSize`.
    for (let currentLayerLogSize = this.layers.length - 1; currentLayerLogSize >= 0; currentLayerLogSize--) {
      const currentLayerActualCols: Array<readonly BaseField[]> = [];
      while (colProcessingIndex < sortedColumns.length && Math.log2(sortedColumns[colProcessingIndex].length) === currentLayerLogSize) {
        currentLayerActualCols.push(sortedColumns[colProcessingIndex++]);
      }

      // Hashes of the child layer (layer with logSize = currentLayerLogSize + 1)
      // These are used if a node's children were not part of lastLayerNodeIndices
      const childLayerHashes = this.layers[currentLayerLogSize + 1]; // This will be undefined for the largest layer, handled by `if (childLayerHashes)`

      const currentNodeIndicesForNextLayer: number[] = [];

      const parentQueriesIter = makePeekable(lastLayerNodeIndices); // Queries propagated from the previous (smaller logSize) layer processing
      const directLayerQueriesIter = optionFlattenPeekable(queriesPerLogSize.get(currentLayerLogSize));

      let nodeIndex: number | undefined;
      while ((nodeIndex = nextDecommitmentNode(parentQueriesIter, directLayerQueriesIter)) !== undefined) {
        // Process Child Hashes (if not leaf layer, i.e., if childLayerHashes exist)
        if (childLayerHashes) {
            // Determine if left child (2 * nodeIndex) was a result of a query from the parent perspective
            if (parentQueriesIter.peek() === 2 * nodeIndex) {
                parentQueriesIter.next(); // Consumed from parent layer calculations, hash already known by verifier implicitly
            } else {
                // Left child's hash needs to be added to witness
                if (childLayerHashes[2 * nodeIndex] === undefined) {
                    throw new Error(`MerkleProver.decommit: childLayerHashes[${2 * nodeIndex}] is undefined. Layer logSize: ${currentLayerLogSize}, nodeIndex: ${nodeIndex}`);
                }
                decommitment.hashWitness.push(childLayerHashes[2 * nodeIndex]);
            }

            // Determine if right child (2 * nodeIndex + 1) was a result of a query from the parent perspective
            if (parentQueriesIter.peek() === 2 * nodeIndex + 1) {
                parentQueriesIter.next(); // Consumed from parent layer calculations
            } else {
                // Right child's hash needs to be added to witness
                if (childLayerHashes[2 * nodeIndex + 1] === undefined) {
                    throw new Error(`MerkleProver.decommit: childLayerHashes[${2 * nodeIndex + 1}] is undefined. Layer logSize: ${currentLayerLogSize}, nodeIndex: ${nodeIndex}`);
                }
                decommitment.hashWitness.push(childLayerHashes[2 * nodeIndex + 1]);
            }
        }

        // Process Column Values for the current nodeIndex
        // currentLayerActualCols are the columns relevant to the current layer (currentLayerLogSize)
        const nodeValues = currentLayerActualCols.map(c => c[nodeIndex]);
        if (nodeValues.some(val => val === undefined)) {
             throw new Error(`MerkleProver.decommit: Column value at nodeIndex ${nodeIndex} is undefined for one of the currentLayerActualCols. Layer logSize: ${currentLayerLogSize}`);
        }

        // Check if this node was directly queried at this layer
        if (directLayerQueriesIter.peek() === nodeIndex) {
            directLayerQueriesIter.next(); // Consumed from direct layer queries
            queried.push(...nodeValues);
        } else {
            // If not directly queried, its column values go into the witness
            decommitment.columnWitness.push(...nodeValues);
        }
        currentNodeIndicesForNextLayer.push(nodeIndex);
      }
      lastLayerNodeIndices = currentNodeIndicesForNextLayer;
    }
    return [queried, decommitment];
  }

  root(): Hash {
    return this.layers[0][0];
  }
}
