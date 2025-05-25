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
