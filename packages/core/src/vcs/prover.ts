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
