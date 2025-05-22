import type { M31 as BaseField } from '../fields/m31';

export interface MerkleHasher<Hash> {
  hashNode(children: [Hash, Hash] | undefined, columnValues: readonly BaseField[]): Hash;
}

export interface MerkleOps<Hash> {
  commitOnLayer(
    logSize: number,
    prevLayer: readonly Hash[] | undefined,
    columns: readonly (readonly BaseField[])[],
  ): Hash[];
}

export class SimpleMerkleOps<Hash> implements MerkleOps<Hash> {
  constructor(private hasher: MerkleHasher<Hash>) {}

  commitOnLayer(
    logSize: number,
    prevLayer: readonly Hash[] | undefined,
    columns: readonly (readonly BaseField[])[],
  ): Hash[] {
    const size = 1 << logSize;
    const result: Hash[] = new Array(size);
    for (let i = 0; i < size; i++) {
      const children = prevLayer ? [prevLayer[2 * i], prevLayer[2 * i + 1]] as [Hash, Hash] : undefined;
      const values = columns.map(c => c[i]);
      result[i] = this.hasher.hashNode(children, values);
    }
    return result;
  }
}
