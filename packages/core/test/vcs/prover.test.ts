import { describe, it, expect } from 'vitest';
// Use the extensionless path so Bun resolves the module.
import { blake2s } from '@noble/hashes/blake2s';
import { M31 } from '../../src/fields/m31';
import type { MerkleHasher, MerkleOps } from '../../src/vcs/ops';
import { MerkleProver } from '../../src/vcs/prover';
import { MerkleVerifier } from '../../src/vcs/verifier';

class SimpleHasher implements MerkleHasher<Uint8Array> {
  hashNode(children: [Uint8Array, Uint8Array] | undefined, values: readonly M31[]): Uint8Array {
    const h = blake2s.create();
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

const simpleOps: MerkleOps<Uint8Array> = {
  commitOnLayer(logSize, prev, columns) {
    const hasher = new SimpleHasher();
    const out: Uint8Array[] = [];
    const size = 1 << logSize;
    for (let i = 0; i < size; i++) {
      const children = prev ? [prev[2 * i], prev[2 * i + 1]] as [Uint8Array, Uint8Array] : undefined;
      const vals = columns.map(c => c[i]);
      out[i] = hasher.hashNode(children, vals);
    }
    return out;
  }
};

describe('MerkleProver', () => {
  it('commit and verify roundtrip', () => {
    const column = [M31.from(3), M31.from(5)];
    const prover = MerkleProver.commit(simpleOps, [column]);
    const queries = new Map<number, number[]>();
    queries.set(1, [0]);
    const [values, decommitment] = prover.decommit(queries, [column]);
    const verifier = new MerkleVerifier(new SimpleHasher(), prover.root(), [1]);
    expect(() => verifier.verify(queries, values, decommitment)).not.toThrow();
  });
});
