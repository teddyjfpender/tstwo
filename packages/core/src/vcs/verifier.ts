/*
This is the Rust code from vcs/verifier.rs that needs to be ported to Typescript in this vcs/verifier.ts file:
```rs
use std::collections::BTreeMap;

use itertools::Itertools;
use thiserror::Error;

use super::ops::MerkleHasher;
use super::prover::MerkleDecommitment;
use super::utils::{next_decommitment_node, option_flatten_peekable};
use crate::core::fields::m31::BaseField;
use crate::core::utils::PeekableExt;

pub struct MerkleVerifier<H: MerkleHasher> {
    pub root: H::Hash,
    pub column_log_sizes: Vec<u32>,
    pub n_columns_per_log_size: BTreeMap<u32, usize>,
}
impl<H: MerkleHasher> MerkleVerifier<H> {
    pub fn new(root: H::Hash, column_log_sizes: Vec<u32>) -> Self {
        let mut n_columns_per_log_size = BTreeMap::new();
        for log_size in &column_log_sizes {
            *n_columns_per_log_size.entry(*log_size).or_insert(0) += 1;
        }

        Self {
            root,
            column_log_sizes,
            n_columns_per_log_size,
        }
    }
    /// Verifies the decommitment of the columns.
    ///
    /// Returns `Ok(())` if the decommitment is successfully verified.
    ///
    /// # Arguments
    ///
    /// * `queries_per_log_size` - A map from log_size to a vector of queries for columns of that
    ///   log_size.
    /// * `queried_values` - A vector of queried values according to the order in
    ///   [`MerkleProver::decommit()`].
    /// * `decommitment` - The decommitment object containing the witness and column values.
    ///
    /// # Errors
    ///
    /// Returns an error if any of the following conditions are met:
    ///
    /// * The witness is too long (not fully consumed).
    /// * The witness is too short (missing values).
    /// * Too many queried values (not fully consumed).
    /// * Too few queried values (missing values).
    /// * The computed root does not match the expected root.
    ///
    /// [`MerkleProver::decommit()`]: crate::core::...::MerkleProver::decommit
    pub fn verify(
        &self,
        queries_per_log_size: &BTreeMap<u32, Vec<usize>>,
        queried_values: Vec<BaseField>,
        decommitment: MerkleDecommitment<H>,
    ) -> Result<(), MerkleVerificationError> {
        let Some(max_log_size) = self.column_log_sizes.iter().max() else {
            return Ok(());
        };

        let mut queried_values = queried_values.into_iter();

        // Prepare read buffers.

        let mut hash_witness = decommitment.hash_witness.into_iter();
        let mut column_witness = decommitment.column_witness.into_iter();

        let mut last_layer_hashes: Option<Vec<(usize, H::Hash)>> = None;
        for layer_log_size in (0..=*max_log_size).rev() {
            let n_columns_in_layer = *self
                .n_columns_per_log_size
                .get(&layer_log_size)
                .unwrap_or(&0);

            // Prepare write buffer for queries to the current layer. This will propagate to the
            // next layer.
            let mut layer_total_queries = vec![];

            // Queries to this layer come from queried node in the previous layer and queried
            // columns in this one.
            let mut prev_layer_queries = last_layer_hashes
                .iter()
                .flatten()
                .map(|(q, _)| *q)
                .collect_vec()
                .into_iter()
                .peekable();
            let mut prev_layer_hashes = last_layer_hashes.as_ref().map(|x| x.iter().peekable());
            let mut layer_column_queries =
                option_flatten_peekable(queries_per_log_size.get(&layer_log_size));

            // Merge previous layer queries and column queries.
            while let Some(node_index) =
                next_decommitment_node(&mut prev_layer_queries, &mut layer_column_queries)
            {
                prev_layer_queries
                    .peek_take_while(|q| q / 2 == node_index)
                    .for_each(drop);

                let node_hashes = prev_layer_hashes
                    .as_mut()
                    .map(|prev_layer_hashes| {
                        {
                            // If the left child was not computed, read it from the witness.
                            let left_hash = prev_layer_hashes
                                .next_if(|(index, _)| *index == 2 * node_index)
                                .map(|(_, hash)| Ok(*hash))
                                .unwrap_or_else(|| {
                                    hash_witness
                                        .next()
                                        .ok_or(MerkleVerificationError::WitnessTooShort)
                                })?;

                            // If the right child was not computed, read it to from the witness.
                            let right_hash = prev_layer_hashes
                                .next_if(|(index, _)| *index == 2 * node_index + 1)
                                .map(|(_, hash)| Ok(*hash))
                                .unwrap_or_else(|| {
                                    hash_witness
                                        .next()
                                        .ok_or(MerkleVerificationError::WitnessTooShort)
                                })?;
                            Ok((left_hash, right_hash))
                        }
                    })
                    .transpose()?;

                // If the column values were queried, read them from `queried_value`.
                let (err, node_values_iter) = match layer_column_queries.next_if_eq(&node_index) {
                    Some(_) => (
                        MerkleVerificationError::TooFewQueriedValues,
                        &mut queried_values,
                    ),
                    // Otherwise, read them from the witness.
                    None => (
                        MerkleVerificationError::WitnessTooShort,
                        &mut column_witness,
                    ),
                };

                let node_values = node_values_iter.take(n_columns_in_layer).collect_vec();
                if node_values.len() != n_columns_in_layer {
                    return Err(err);
                }

                layer_total_queries.push((node_index, H::hash_node(node_hashes, &node_values)));
            }

            last_layer_hashes = Some(layer_total_queries);
        }

        // Check that all witnesses and values have been consumed.
        if !hash_witness.is_empty() {
            return Err(MerkleVerificationError::WitnessTooLong);
        }
        if !queried_values.is_empty() {
            return Err(MerkleVerificationError::TooManyQueriedValues);
        }
        if !column_witness.is_empty() {
            return Err(MerkleVerificationError::WitnessTooLong);
        }

        let [(_, computed_root)] = last_layer_hashes.unwrap().try_into().unwrap();
        // Check if the root matches, handling both HashLike objects and Uint8Array
        let rootsMatch = false;
        if (typeof (computed_root as any).equals === 'function') {
            // Hash object with equals method (HashLike interface)
            rootsMatch = (computed_root as any).equals(self.root);
        } else if (computed_root instanceof Uint8Array && self.root instanceof Uint8Array) {
            // Raw Uint8Array comparison
            rootsMatch = computed_root.length === this.root.length && 
                computed_root.every((val, idx) => val === (this.root as Uint8Array)[idx]);
        } else {
            // Default equality check
            rootsMatch = computed_root === this.root;
        }
        
        if (!rootsMatch) {
            return Err(MerkleVerificationError::RootMismatch);
        }

        Ok(())
    }
}

// TODO(ilya): Make error messages consistent.
#[derive(Clone, Copy, Debug, Error, PartialEq, Eq)]
pub enum MerkleVerificationError {
    #[error("Witness is too short")]
    WitnessTooShort,
    #[error("Witness is too long.")]
    WitnessTooLong,
    #[error("too many Queried values")]
    TooManyQueriedValues,
    #[error("too few queried values")]
    TooFewQueriedValues,
    #[error("Root mismatch.")]
    RootMismatch,
}
```
*/
import type { M31 as BaseField } from "../fields/m31";
import { nextDecommitmentNode, optionFlattenPeekable, makePeekable } from "./utils";
import type { MerkleHasher } from "./ops";

export interface MerkleDecommitment<Hash> {
  hashWitness: Hash[];
  columnWitness: BaseField[];
}

/**
 * Verifies Merkle decommitments.
 *
 * Port of `vcs/verifier.rs` struct `MerkleVerifier`.
 */
export class MerkleVerifier<Hash> {
  readonly nColumnsPerLogSize: Map<number, number> = new Map();

  constructor(
    private readonly hasher: MerkleHasher<Hash>,
    public readonly root: Hash,
    public readonly columnLogSizes: number[],
  ) {
    for (const log of columnLogSizes) {
      this.nColumnsPerLogSize.set(log, (this.nColumnsPerLogSize.get(log) ?? 0) + 1);
    }
  }

  verify(
    queriesPerLogSize: ReadonlyMap<number, number[]>,
    queriedValues: BaseField[],
    decommitment: MerkleDecommitment<Hash>,
  ): void {
    const maxLogSize = Math.max(...this.columnLogSizes, 0);
    if (this.columnLogSizes.length === 0) {
      return;
    }

    let queriedIdx = 0;
    let hashWitnessIdx = 0;
    let columnWitnessIdx = 0;
    let lastLayerHashes: Array<[number, Hash]> | null = null;

    for (let layerLogSize = maxLogSize; layerLogSize >= 0; layerLogSize--) {
      const nColumnsInLayer = this.nColumnsPerLogSize.get(layerLogSize) ?? 0;
      const layerTotalQueries: Array<[number, Hash]> = [];

      const prevLayerQueries = makePeekable(
        (lastLayerHashes ?? []).map(([q]) => q),
      );
      const prevLayerHashes = lastLayerHashes ? makePeekable(lastLayerHashes) : undefined;
      const layerColumnQueries = optionFlattenPeekable(
        queriesPerLogSize.get(layerLogSize),
      );

      let nodeIndex: number | undefined;
      while ((nodeIndex = nextDecommitmentNode(prevLayerQueries, layerColumnQueries)) !== undefined) {
        while (prevLayerQueries.peek() !== undefined && Math.floor(prevLayerQueries.peek()! / 2) === nodeIndex) {
          prevLayerQueries.next();
        }

        let nodeHashes: [Hash, Hash] | undefined;
        if (prevLayerHashes) {
          const takePrev = (idx: number): Hash | undefined => {
            const peeked = prevLayerHashes.peek();
            if (peeked && peeked[0] === idx) {
              return prevLayerHashes.next().value[1];
            }
            return undefined;
          };
          const left = takePrev(2 * nodeIndex);
          const leftHash = left !== undefined ? left : (() => {
            if (hashWitnessIdx >= decommitment.hashWitness.length) {
              throw new Error(MerkleVerificationError.WitnessTooShort);
            }
            return decommitment.hashWitness[hashWitnessIdx++];
          })();
          const right = takePrev(2 * nodeIndex + 1);
          const rightHash = right !== undefined ? right : (() => {
            if (hashWitnessIdx >= decommitment.hashWitness.length) {
              throw new Error(MerkleVerificationError.WitnessTooShort);
            }
            return decommitment.hashWitness[hashWitnessIdx++];
          })();
          nodeHashes = [leftHash, rightHash];
        }

        const readFromQueried = layerColumnQueries.peek() === nodeIndex;
        if (readFromQueried) {
          layerColumnQueries.next();
        }
        const err = readFromQueried
          ? MerkleVerificationError.TooFewQueriedValues
          : MerkleVerificationError.WitnessTooShort;
        const nodeValues: BaseField[] = [];
        for (let i = 0; i < nColumnsInLayer; i++) {
          if (readFromQueried) {
            if (queriedIdx >= queriedValues.length) {
              throw new Error(err);
            }
            nodeValues.push(queriedValues[queriedIdx++]);
          } else {
            if (columnWitnessIdx >= decommitment.columnWitness.length) {
              throw new Error(err);
            }
            nodeValues.push(decommitment.columnWitness[columnWitnessIdx++]);
          }
        }

        layerTotalQueries.push([
          nodeIndex,
          this.hasher.hashNode(nodeHashes, nodeValues),
        ]);
      }

      lastLayerHashes = layerTotalQueries;
    }

    if (hashWitnessIdx !== decommitment.hashWitness.length) {
      throw new Error(MerkleVerificationError.WitnessTooLong);
    }
    if (queriedIdx !== queriedValues.length) {
      throw new Error(MerkleVerificationError.TooManyQueriedValues);
    }
    if (columnWitnessIdx !== decommitment.columnWitness.length) {
      throw new Error(MerkleVerificationError.WitnessTooLong);
    }

    const computedRoot = lastLayerHashes![0][1];
    // Check if the root matches, handling both HashLike objects and Uint8Array
    let rootsMatch = false;
    if (typeof (computedRoot as any).equals === 'function') {
      // Hash object with equals method (HashLike interface)
      rootsMatch = (computedRoot as any).equals(this.root);
    } else if (computedRoot instanceof Uint8Array && this.root instanceof Uint8Array) {
      // Raw Uint8Array comparison
      rootsMatch = computedRoot.length === this.root.length && 
        computedRoot.every((val, idx) => val === (this.root as Uint8Array)[idx]);
    } else {
      // Default equality check
      rootsMatch = computedRoot === this.root;
    }
    
    if (!rootsMatch) {
      throw new Error(MerkleVerificationError.RootMismatch);
    }
  }
}

export enum MerkleVerificationError {
  WitnessTooShort = "Witness is too short",
  WitnessTooLong = "Witness is too long.",
  TooManyQueriedValues = "too many Queried values",
  TooFewQueriedValues = "too few queried values",
  RootMismatch = "Root mismatch.",
}
