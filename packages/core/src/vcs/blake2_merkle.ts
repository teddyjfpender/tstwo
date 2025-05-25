import { Blake2sHash, Blake2sHasher } from './blake2_hash';
import type { MerkleHasher } from './ops';
import type { MerkleChannel } from '../channel';
import { Blake2sChannel } from '../channel/blake2';
import type { M31 as BaseField } from '../fields/m31';

/** Merkle hasher using Blake2s. */
export class Blake2sMerkleHasher implements MerkleHasher<Blake2sHash> {
  hashNode(
    childrenHashes: [Blake2sHash, Blake2sHash] | undefined,
    columnValues: readonly BaseField[],
  ): Blake2sHash {
    const h = new Blake2sHasher();
    if (childrenHashes) {
      h.update(childrenHashes[0].bytes);
      h.update(childrenHashes[1].bytes);
    }
    for (const v of columnValues) {
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setUint32(0, (v as any).value >>> 0, true);
      h.update(buf);
    }
    return h.finalize();
  }
}

/** Merkle channel operations for Blake2s based channel. */
export class Blake2sMerkleChannel implements MerkleChannel<Blake2sHash> {
  mix_root(channel: Blake2sChannel, root: Blake2sHash): void {
    channel.updateDigest(Blake2sHasher.concatAndHash(channel.digest(), root));
  }
}
