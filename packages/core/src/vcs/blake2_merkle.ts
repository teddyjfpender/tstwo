/*
This is the Rust code from vcs/blake2_merkle.rs that needs to be ported to Typescript in this vcs/blake2_merkle.ts file:
```rs
use blake2::{Blake2s256, Digest};
use serde::{Deserialize, Serialize};

use super::blake2_hash::Blake2sHash;
use super::ops::MerkleHasher;
use crate::core::channel::{Blake2sChannel, MerkleChannel};
use crate::core::fields::m31::BaseField;

#[derive(Copy, Clone, Debug, PartialEq, Eq, Default, Deserialize, Serialize)]
pub struct Blake2sMerkleHasher;
impl MerkleHasher for Blake2sMerkleHasher {
    type Hash = Blake2sHash;

    fn hash_node(
        children_hashes: Option<(Self::Hash, Self::Hash)>,
        column_values: &[BaseField],
    ) -> Self::Hash {
        let mut hasher = Blake2s256::new();

        if let Some((left_child, right_child)) = children_hashes {
            hasher.update(left_child);
            hasher.update(right_child);
        }

        for value in column_values {
            hasher.update(value.0.to_le_bytes());
        }

        Blake2sHash(hasher.finalize().into())
    }
}

#[derive(Default)]
pub struct Blake2sMerkleChannel;

impl MerkleChannel for Blake2sMerkleChannel {
    type C = Blake2sChannel;
    type H = Blake2sMerkleHasher;

    fn mix_root(channel: &mut Self::C, root: <Self::H as MerkleHasher>::Hash) {
        channel.update_digest(super::blake2_hash::Blake2sHasher::concat_and_hash(
            &channel.digest(),
            &root,
        ));
    }
}

#[cfg(test)]
mod tests {
    use num_traits::Zero;

    use super::Blake2sMerkleChannel;
    use crate::core::channel::{Blake2sChannel, MerkleChannel};
    use crate::core::fields::m31::BaseField;
    use crate::core::vcs::blake2_merkle::{Blake2sHash, Blake2sMerkleHasher};
    use crate::core::vcs::test_utils::prepare_merkle;
    use crate::core::vcs::verifier::MerkleVerificationError;

    #[test]
    fn test_merkle_success() {
        let (queries, decommitment, values, verifier) = prepare_merkle::<Blake2sMerkleHasher>();

        verifier.verify(&queries, values, decommitment).unwrap();
    }

    #[test]
    fn test_merkle_invalid_witness() {
        let (queries, mut decommitment, values, verifier) = prepare_merkle::<Blake2sMerkleHasher>();
        decommitment.hash_witness[4] = Blake2sHash::default();

        assert_eq!(
            verifier.verify(&queries, values, decommitment).unwrap_err(),
            MerkleVerificationError::RootMismatch
        );
    }

    #[test]
    fn test_merkle_invalid_value() {
        let (queries, decommitment, mut values, verifier) = prepare_merkle::<Blake2sMerkleHasher>();
        values[6] = BaseField::zero();

        assert_eq!(
            verifier.verify(&queries, values, decommitment).unwrap_err(),
            MerkleVerificationError::RootMismatch
        );
    }

    #[test]
    fn test_merkle_witness_too_short() {
        let (queries, mut decommitment, values, verifier) = prepare_merkle::<Blake2sMerkleHasher>();
        decommitment.hash_witness.pop();

        assert_eq!(
            verifier.verify(&queries, values, decommitment).unwrap_err(),
            MerkleVerificationError::WitnessTooShort
        );
    }

    #[test]
    fn test_merkle_witness_too_long() {
        let (queries, mut decommitment, values, verifier) = prepare_merkle::<Blake2sMerkleHasher>();
        decommitment.hash_witness.push(Blake2sHash::default());

        assert_eq!(
            verifier.verify(&queries, values, decommitment).unwrap_err(),
            MerkleVerificationError::WitnessTooLong
        );
    }

    #[test]
    fn test_merkle_column_values_too_long() {
        let (queries, decommitment, mut values, verifier) = prepare_merkle::<Blake2sMerkleHasher>();
        values.insert(3, BaseField::zero());

        assert_eq!(
            verifier.verify(&queries, values, decommitment).unwrap_err(),
            MerkleVerificationError::TooManyQueriedValues
        );
    }

    #[test]
    fn test_merkle_column_values_too_short() {
        let (queries, decommitment, mut values, verifier) = prepare_merkle::<Blake2sMerkleHasher>();
        values.remove(3);

        assert_eq!(
            verifier.verify(&queries, values, decommitment).unwrap_err(),
            MerkleVerificationError::TooFewQueriedValues
        );
    }

    #[test]
    fn test_merkle_channel() {
        let mut channel = Blake2sChannel::default();
        let (_queries, _decommitment, _values, verifier) = prepare_merkle::<Blake2sMerkleHasher>();
        Blake2sMerkleChannel::mix_root(&mut channel, verifier.root);
        assert_eq!(channel.channel_time.n_challenges, 1);
    }
}
```
*/
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
