import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { M31 } from '../../src/fields/m31';
import { MerkleVerifier } from '../../src/merkle/verifier';
import { MerkleProver } from '../../src/merkle/prover';
import { SimpleMerkleOps, MerkleHasher } from '../../src/merkle/ops';

class SimpleHasher implements MerkleHasher<Uint8Array> {
  hashNode(children: [Uint8Array, Uint8Array] | undefined, values: readonly M31[]): Uint8Array {
    const h = createHash('sha256');
    if (children) {
      h.update(children[0]);
      h.update(children[1]);
    }
    for (const v of values) {
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(v.value >>> 0, 0);
      h.update(buf);
    }
    return new Uint8Array(h.digest());
  }
}

describe('MerkleProver and MerkleVerifier', () => {
  it.skip('commit and verify simple column', () => {
    const hasher = new SimpleHasher();
    const ops = new SimpleMerkleOps(hasher);
    const column = [M31.from(3), M31.from(5)];
    const prover = MerkleProver.commit(ops, [column]);
    const queries = new Map<number, number[]>();
    queries.set(1, [0]);
    const { values, decommitment } = prover.decommit(ops, queries, [column]);
    const verifier = new MerkleVerifier(hasher, prover.root(), [1]);
    expect(() => verifier.verify(queries, values, decommitment)).not.toThrow();
  });
});
