use std::iter;

use itertools::Itertools;
use starknet_crypto::{poseidon_hash, poseidon_hash_many};
use starknet_ff::FieldElement as FieldElement252;

use super::{Channel, ChannelTime};
use crate::core::fields::m31::BaseField;
use crate::core::fields::qm31::SecureField;
use crate::core::fields::secure_column::SECURE_EXTENSION_DEGREE;

// Number of bytes that fit into a felt252.
pub const BYTES_PER_FELT252: usize = 252 / 8;
pub const FELTS_PER_HASH: usize = 8;

/// A channel that can be used to draw random elements from a Poseidon252 hash.
#[derive(Clone, Default, Debug)]
pub struct Poseidon252Channel {
    digest: FieldElement252,
    pub channel_time: ChannelTime,
}

impl Poseidon252Channel {
    pub const fn digest(&self) -> FieldElement252 {
        self.digest
    }
    pub const fn update_digest(&mut self, new_digest: FieldElement252) {
        self.digest = new_digest;
        self.channel_time.inc_challenges();
    }
    fn draw_felt252(&mut self) -> FieldElement252 {
        let res = poseidon_hash(self.digest, self.channel_time.n_sent.into());
        self.channel_time.inc_sent();
        res
    }

    // TODO(shahars): Understand if we really need uniformity here.
    /// Generates a close-to uniform random vector of BaseField elements.
    fn draw_base_felts(&mut self) -> [BaseField; 8] {
        let shift = (1u64 << 31).into();

        let mut cur = self.draw_felt252();
        let u32s: [u32; 8] = std::array::from_fn(|_| {
            let next = cur.floor_div(shift);
            let res = cur - next * shift;
            cur = next;
            res.try_into().unwrap()
        });

        u32s.into_iter()
            .map(|x| BaseField::reduce(x as u64))
            .collect::<Vec<_>>()
            .try_into()
            .unwrap()
    }
}

impl Channel for Poseidon252Channel {
    const BYTES_PER_HASH: usize = BYTES_PER_FELT252;

    fn trailing_zeros(&self) -> u32 {
        let bytes = self.digest.to_bytes_be();
        u128::from_le_bytes(std::array::from_fn(|i| bytes[i])).trailing_zeros()
    }

    fn mix_felts(&mut self, felts: &[SecureField]) {
        let shift = (1u64 << 31).into();
        let mut res = Vec::with_capacity(felts.len() / 2 + 2);
        res.push(self.digest);
        for chunk in felts.chunks(2) {
            res.push(
                chunk
                    .iter()
                    .flat_map(|x| x.to_m31_array())
                    .fold(FieldElement252::default(), |cur, y| {
                        cur * shift + y.0.into()
                    }),
            );
        }

        // TODO(shahars): do we need length padding?
        self.update_digest(poseidon_hash_many(&res));
    }

    /// Mix a slice of u32s in chunks of 7 representing big endian felt252s.
    fn mix_u32s(&mut self, data: &[u32]) {
        let shift = (1u64 << 32).into();
        let padding_len = 6 - ((data.len() + 6) % 7);
        let felts = data
            .iter()
            .chain(iter::repeat_n(&0, padding_len))
            .chunks(7)
            .into_iter()
            .map(|chunk| {
                chunk.fold(FieldElement252::default(), |cur, y| {
                    cur * shift + (*y).into()
                })
            })
            .collect_vec();

        // TODO(shahars): do we need length padding?
        self.update_digest(poseidon_hash_many(&[vec![self.digest], felts].concat()));
    }

    fn mix_u64(&mut self, value: u64) {
        // Split value to 32-bit limbs representing a big endian felt252.
        self.mix_u32s(&[0, 0, 0, 0, 0, ((value >> 32) as u32), (value as u32)])
    }

    fn draw_felt(&mut self) -> SecureField {
        let felts: [BaseField; FELTS_PER_HASH] = self.draw_base_felts();
        SecureField::from_m31_array(felts[..SECURE_EXTENSION_DEGREE].try_into().unwrap())
    }

    fn draw_felts(&mut self, n_felts: usize) -> Vec<SecureField> {
        let mut felts = iter::from_fn(|| Some(self.draw_base_felts())).flatten();
        let secure_felts = iter::from_fn(|| {
            Some(SecureField::from_m31_array([
                felts.next()?,
                felts.next()?,
                felts.next()?,
                felts.next()?,
            ]))
        });
        secure_felts.take(n_felts).collect()
    }

    fn draw_random_bytes(&mut self) -> Vec<u8> {
        let shift = (1u64 << 8).into();
        let mut cur = self.draw_felt252();
        let bytes: [u8; 31] = std::array::from_fn(|_| {
            let next = cur.floor_div(shift);
            let res = cur - next * shift;
            cur = next;
            res.try_into().unwrap()
        });
        bytes.to_vec()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use starknet_ff::FieldElement as FieldElement252;

    use crate::core::channel::poseidon252::Poseidon252Channel;
    use crate::core::channel::Channel;
    use crate::core::fields::qm31::SecureField;
    use crate::m31;

    #[test]
    fn test_channel_time() {
        let mut channel = Poseidon252Channel::default();

        assert_eq!(channel.channel_time.n_challenges, 0);
        assert_eq!(channel.channel_time.n_sent, 0);

        channel.draw_random_bytes();
        assert_eq!(channel.channel_time.n_challenges, 0);
        assert_eq!(channel.channel_time.n_sent, 1);

        channel.draw_felts(9);
        assert_eq!(channel.channel_time.n_challenges, 0);
        assert_eq!(channel.channel_time.n_sent, 6);
    }

    #[test]
    fn test_draw_random_bytes() {
        let mut channel = Poseidon252Channel::default();

        let first_random_bytes = channel.draw_random_bytes();

        // Assert that next random bytes are different.
        assert_ne!(first_random_bytes, channel.draw_random_bytes());
    }

    #[test]
    pub fn test_draw_felt() {
        let mut channel = Poseidon252Channel::default();

        let first_random_felt = channel.draw_felt();

        // Assert that next random felt is different.
        assert_ne!(first_random_felt, channel.draw_felt());
    }

    #[test]
    pub fn test_draw_felts() {
        let mut channel = Poseidon252Channel::default();

        let mut random_felts = channel.draw_felts(5);
        random_felts.extend(channel.draw_felts(4));

        // Assert that all the random felts are unique.
        assert_eq!(
            random_felts.len(),
            random_felts.iter().collect::<BTreeSet<_>>().len()
        );
    }

    #[test]
    pub fn test_mix_felts() {
        let mut channel = Poseidon252Channel::default();
        let initial_digest = channel.digest;
        let felts: Vec<SecureField> = (0..2)
            .map(|i| SecureField::from(m31!(i + 1923782)))
            .collect();

        channel.mix_felts(felts.as_slice());

        assert_ne!(initial_digest, channel.digest);
    }

    #[test]
    pub fn test_mix_u64() {
        let mut channel = Poseidon252Channel::default();
        channel.mix_u64(0x1111222233334444);
        let digest_64 = channel.digest;

        let mut channel = Poseidon252Channel::default();
        channel.mix_u32s(&[0, 0, 0, 0, 0, 0x11112222, 0x33334444]);

        assert_eq!(digest_64, channel.digest);
    }

    #[test]
    pub fn test_mix_u32s() {
        let mut channel = Poseidon252Channel::default();
        channel.mix_u32s(&[1, 2, 3, 4, 5, 6, 7, 8, 9]);
        assert_eq!(
            channel.digest,
            FieldElement252::from_hex_be(
                "0x078f5cf6a2e7362b75fc1f94daeae7ebddd64e6b2db771717519af7193dfa80b"
            )
            .unwrap()
        );
    }
}
