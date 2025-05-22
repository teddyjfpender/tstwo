import { Blake2sHash, Blake2sHasher } from '../vcs/blake2_hash';
import { Blake2sChannel } from '../channel/blake2';
import type { M31 } from '../fields/m31';
import type { MerkleHasher } from './ops';

export class Blake2sMerkleHasher implements MerkleHasher<Blake2sHash> {
  hashNode(children: [Blake2sHash, Blake2sHash] | undefined, columnValues: readonly M31[]): Blake2sHash {
    const h = new Blake2sHasher();
    if (children) {
      h.update(children[0].asBytes());
      h.update(children[1].asBytes());
    }
    const buf = new Uint8Array(4);
    const view = new DataView(buf.buffer);
    for (const v of columnValues) {
      view.setUint32(0, v.value >>> 0, true);
      h.update(buf);
    }
    return h.finalize();
  }
}

export class Blake2sMerkleChannel {
  mix_root(channel: Blake2sChannel, root: Blake2sHash): void {
    const newDigest = Blake2sHasher.concatAndHash(new Blake2sHash(channel.digestBytes()), root);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (channel as any).updateDigest(newDigest);
  }
}
