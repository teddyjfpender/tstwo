import type { M31 as BaseField } from '../fields/m31';
import type { MerkleOps } from './ops';
import { nextDecommitmentNode, optionFlattenPeekable, makePeekable } from '../vcs/utils';
import type { MerkleDecommitment } from '../vcs/verifier';

export class MerkleProver<Hash> {
  constructor(public layers: Hash[][]) {}

  static commit<Hash>(
    ops: MerkleOps<Hash>,
    columns: readonly (readonly BaseField[])[],
  ): MerkleProver<Hash> {
    if (columns.length === 0) {
      return new MerkleProver([ops.commitOnLayer(0, undefined, [])]);
    }
    const cols = [...columns].sort((a, b) => b.length - a.length);
    const maxLog = Math.log2(cols[0].length);
    const layers: Hash[][] = [];
    let prev: Hash[] | undefined = undefined;
    for (let log = maxLog; log >= 0; log--) {
      const layerCols = cols.filter(c => Math.log2(c.length) === log);
      const layer = ops.commitOnLayer(log, prev, layerCols);
      layers.push(layer);
      prev = layer;
    }
    layers.reverse();
    return new MerkleProver(layers);
  }

  decommit(
    ops: MerkleOps<Hash>,
    queries: ReadonlyMap<number, number[]>,
    columns: readonly (readonly BaseField[])[],
  ): { values: BaseField[]; decommitment: MerkleDecommitment<Hash> } {
    const cols = [...columns].sort((a,b)=>b.length-a.length);
    const values: BaseField[] = [];
    const decommitment: MerkleDecommitment<Hash> = { hashWitness: [], columnWitness: [] };
    let lastLayerQueries: number[] = [];
    for (let layerLog = this.layers.length -1; layerLog >=0; layerLog--) {
      const layerCols = cols.filter(c => Math.log2(c.length) === layerLog);
      const prevLayer = this.layers[layerLog+1];
      const prevQueries = makePeekable(lastLayerQueries);
      const layerQueries = optionFlattenPeekable(queries.get(layerLog));
      const layerTotal: number[] = [];
      let node: number | undefined;
      while ((node = nextDecommitmentNode(prevQueries, layerQueries)) !== undefined) {
        while (prevQueries.peek() !== undefined && Math.floor(prevQueries.peek()!/2) === node) {
          prevQueries.next();
        }
        if (prevLayer) {
          const leftProvided = prevQueries.peek() === 2*node;
          if (leftProvided) prevQueries.next();
          else decommitment.hashWitness.push(prevLayer[2*node]);
          const rightProvided = prevQueries.peek() === 2*node+1;
          if (rightProvided) prevQueries.next();
          else decommitment.hashWitness.push(prevLayer[2*node+1]);
        }
        const nodeValues = layerCols.map(c=>c[node!]);
        if (layerQueries.peek() === node) {
          layerQueries.next();
          values.push(...nodeValues);
        } else {
          decommitment.columnWitness.push(...nodeValues);
        }
        layerTotal.push(node);
      }
      lastLayerQueries = layerTotal;
    }
    return { values, decommitment };
  }

  root(): Hash {
    return this.layers[0][0];
  }
}
