import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { M31 } from "../../src/fields/m31";
import { MerkleVerifier, MerkleDecommitment, MerkleVerificationError } from "../../src/vcs/verifier";
import type { MerkleHasher } from "../../src/vcs/ops";

class SimpleHasher implements MerkleHasher<Uint8Array> {
  hashNode(children: [Uint8Array, Uint8Array] | undefined, values: readonly M31[]): Uint8Array {
    const h = createHash("sha256");
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

function buildSimple() {
  const hasher = new SimpleHasher();
  const column = [M31.from(3), M31.from(5)];
  // layers[0] - root, layers[1] - leaves
  const leaf0 = hasher.hashNode(undefined, [column[0]]);
  const leaf1 = hasher.hashNode(undefined, [column[1]]);
  const root = hasher.hashNode([leaf0, leaf1], []);
  const layers = [[root], [leaf0, leaf1]];
  const queries = new Map<number, number[]>();
  queries.set(1, [0]);
  const values = [column[0]];
  const decommitment: MerkleDecommitment<Uint8Array> = { hashWitness: [leaf1], columnWitness: [] };
  const verifier = new MerkleVerifier(hasher, root, [1]);
  return { queries, decommitment, values, verifier, leaf1 };
}

describe("MerkleVerifier", () => {
  it("verifies valid decommitment", () => {
    const { queries, decommitment, values, verifier } = buildSimple();
    expect(() => verifier.verify(queries, values, decommitment)).not.toThrow();
  });

  it("detects invalid witness", () => {
    const { queries, decommitment, values, verifier } = buildSimple();
    decommitment.hashWitness[0] = new Uint8Array(32);
    expect(() => verifier.verify(queries, values, decommitment)).toThrow(MerkleVerificationError.RootMismatch);
  });

  it("detects invalid queried value", () => {
    const { queries, decommitment, values, verifier } = buildSimple();
    values[0] = M31.zero();
    expect(() => verifier.verify(queries, values, decommitment)).toThrow(MerkleVerificationError.RootMismatch);
  });

  it("fails when witness too short", () => {
    const { queries, decommitment, values, verifier } = buildSimple();
    decommitment.hashWitness.pop();
    expect(() => verifier.verify(queries, values, decommitment)).toThrow(MerkleVerificationError.WitnessTooShort);
  });

  it("fails when witness too long", () => {
    const { queries, decommitment, values, verifier, leaf1 } = buildSimple();
    decommitment.hashWitness.push(leaf1);
    expect(() => verifier.verify(queries, values, decommitment)).toThrow(MerkleVerificationError.WitnessTooLong);
  });

  it("fails when column values length mismatch", () => {
    const { queries, decommitment, values, verifier } = buildSimple();
    values.push(M31.zero());
    expect(() => verifier.verify(queries, values, decommitment)).toThrow(MerkleVerificationError.TooManyQueriedValues);
  });

  it("fails when column values too short", () => {
    const { queries, decommitment, values, verifier } = buildSimple();
    values.pop();
    expect(() => verifier.verify(queries, values, decommitment)).toThrow(MerkleVerificationError.TooFewQueriedValues);
  });
});
