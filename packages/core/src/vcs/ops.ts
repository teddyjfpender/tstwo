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
