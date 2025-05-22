/*
This is the Rust code from channel/blake2.rs that needs to be ported to Typescript in this channel/blake2.ts file:
```rs
use std::iter;

use super::{Channel, ChannelTime};
use crate::core::fields::m31::{BaseField, N_BYTES_FELT, P};
use crate::core::fields::qm31::SecureField;
use crate::core::fields::secure_column::SECURE_EXTENSION_DEGREE;
use crate::core::fields::IntoSlice;
use crate::core::vcs::blake2_hash::{Blake2sHash, Blake2sHasher};

pub const BLAKE_BYTES_PER_HASH: usize = 32;
pub const FELTS_PER_HASH: usize = 8;

/// A channel that can be used to draw random elements from a [Blake2sHash] digest.
#[derive(Default, Clone, Debug)]
pub struct Blake2sChannel {
    digest: Blake2sHash,
    pub channel_time: ChannelTime,
}

impl Blake2sChannel {
    pub const fn digest(&self) -> Blake2sHash {
        self.digest
    }
    pub const fn update_digest(&mut self, new_digest: Blake2sHash) {
        self.digest = new_digest;
        self.channel_time.inc_challenges();
    }
    /// Generates a uniform random vector of BaseField elements.
    fn draw_base_felts(&mut self) -> [BaseField; FELTS_PER_HASH] {
        // Repeats hashing with an increasing counter until getting a good result.
        // Retry probability for each round is ~ 2^(-28).
        loop {
            let u32s: [u32; FELTS_PER_HASH] = self
                .draw_random_bytes()
                .chunks_exact(N_BYTES_FELT) // 4 bytes per u32.
                .map(|chunk| u32::from_le_bytes(chunk.try_into().unwrap()))
                .collect::<Vec<_>>()
                .try_into()
                .unwrap();

            // Retry if not all the u32 are in the range [0, 2P).
            if u32s.iter().all(|x| *x < 2 * P) {
                return u32s
                    .into_iter()
                    .map(|x| BaseField::reduce(x as u64))
                    .collect::<Vec<_>>()
                    .try_into()
                    .unwrap();
            }
        }
    }
}

impl Channel for Blake2sChannel {
    const BYTES_PER_HASH: usize = BLAKE_BYTES_PER_HASH;

    fn trailing_zeros(&self) -> u32 {
        u128::from_le_bytes(std::array::from_fn(|i| self.digest.0[i])).trailing_zeros()
    }

    fn mix_felts(&mut self, felts: &[SecureField]) {
        let mut hasher = Blake2sHasher::new();
        hasher.update(self.digest.as_ref());
        hasher.update(IntoSlice::<u8>::into_slice(felts));

        self.update_digest(hasher.finalize());
    }

    fn mix_u32s(&mut self, data: &[u32]) {
        let mut hasher = Blake2sHasher::new();
        hasher.update(self.digest.as_ref());
        for word in data {
            hasher.update(&word.to_le_bytes());
        }

        self.update_digest(hasher.finalize());
    }

    fn mix_u64(&mut self, value: u64) {
        self.mix_u32s(&[value as u32, (value >> 32) as u32])
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
        let mut hash_input = self.digest.as_ref().to_vec();

        // Pad the counter to 32 bytes.
        let mut padded_counter = [0; BLAKE_BYTES_PER_HASH];
        let counter_bytes = self.channel_time.n_sent.to_le_bytes();
        padded_counter[0..counter_bytes.len()].copy_from_slice(&counter_bytes);

        hash_input.extend_from_slice(&padded_counter);

        self.channel_time.inc_sent();
        Blake2sHasher::hash(&hash_input).into()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use crate::core::channel::blake2s::Blake2sChannel;
    use crate::core::channel::Channel;
    use crate::core::fields::qm31::SecureField;
    use crate::m31;

    #[test]
    fn test_channel_time() {
        let mut channel = Blake2sChannel::default();

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
        let mut channel = Blake2sChannel::default();

        let first_random_bytes = channel.draw_random_bytes();

        // Assert that next random bytes are different.
        assert_ne!(first_random_bytes, channel.draw_random_bytes());
    }

    #[test]
    pub fn test_draw_felt() {
        let mut channel = Blake2sChannel::default();

        let first_random_felt = channel.draw_felt();

        // Assert that next random felt is different.
        assert_ne!(first_random_felt, channel.draw_felt());
    }

    #[test]
    pub fn test_draw_felts() {
        let mut channel = Blake2sChannel::default();

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
        let mut channel = Blake2sChannel::default();
        let initial_digest = channel.digest;
        let felts: Vec<SecureField> = (0..2)
            .map(|i| SecureField::from(m31!(i + 1923782)))
            .collect();

        channel.mix_felts(felts.as_slice());

        assert_ne!(initial_digest, channel.digest);
    }

    #[test]
    pub fn test_mix_u64() {
        let mut channel = Blake2sChannel::default();
        channel.mix_u64(0x1111222233334444);
        let digest_64 = channel.digest;

        let mut channel = Blake2sChannel::default();
        channel.mix_u32s(&[0x33334444, 0x11112222]);

        assert_eq!(digest_64, channel.digest);
        let digest_bytes: [u8; 32] = digest_64.into();
        assert_eq!(
            digest_bytes,
            [
                0xbc, 0x9e, 0x3f, 0xc1, 0xd2, 0x4e, 0x88, 0x97, 0x95, 0x6d, 0x33, 0x59, 0x32, 0x73,
                0x97, 0x24, 0x9d, 0x6b, 0xca, 0xcd, 0x22, 0x4d, 0x92, 0x74, 0x4, 0xe7, 0xba, 0x4a,
                0x77, 0xdc, 0x6e, 0xce
            ]
        )
    }

    #[test]
    pub fn test_mix_u32s() {
        let mut channel = Blake2sChannel::default();
        channel.mix_u32s(&[1, 2, 3, 4, 5, 6, 7, 8, 9]);
        let digest: [u8; 32] = channel.digest.into();
        assert_eq!(
            digest,
            [
                0x70, 0x91, 0x76, 0x83, 0x57, 0xbb, 0x1b, 0xb3, 0x34, 0x6f, 0xda, 0xb6, 0xb3, 0x57,
                0xd7, 0xfa, 0x46, 0xb8, 0xfb, 0xe3, 0x2c, 0x2e, 0x43, 0x24, 0xa0, 0xff, 0xc2, 0x94,
                0xcb, 0xf9, 0xa1, 0xc7
            ]
        );
    }
}
```
*/
import { M31, P, N_BYTES_FELT } from '../fields/m31';
import { QM31 as SecureField, SECURE_EXTENSION_DEGREE } from '../fields/qm31';
import { Blake2sHash, Blake2sHasher } from '../vcs/blake2_hash';
import type { Channel } from './index';
import { ChannelTime } from './index';

export const BLAKE_BYTES_PER_HASH = 32;
export const FELTS_PER_HASH = 8;

export class Blake2sChannel implements Channel {
  readonly BYTES_PER_HASH = BLAKE_BYTES_PER_HASH;
  private _digest: Blake2sHash = new Blake2sHash();
  public channel_time: ChannelTime = new ChannelTime();
  private baseQueue: M31[] = [];

  /** Current digest of the channel. Mirrors Rust's `digest()` accessor. */
  digest(): Blake2sHash { return this._digest; }

  /** Updates the digest and increments the challenge counter. */
  updateDigest(newDigest: Blake2sHash): void {
    this._digest = newDigest;
    this.channel_time.inc_challenges();
  }

  digestBytes(): Uint8Array { return this._digest.asBytes(); }

  trailing_zeros(): number {
    let val = 0n;
    const bytes = this._digest.bytes;
    for (let i = 15; i >= 0; i--) {
      val = (val << 8n) | BigInt(bytes[i] ?? 0);
    }
    let tz = 0;
    while (((val >> BigInt(tz)) & 1n) === 0n && tz < 128) tz++;
    return tz;
  }

  mix_felts(felts: readonly SecureField[]): void {
    const hasher = new Blake2sHasher();
    hasher.update(this._digest.bytes);
    hasher.update(SecureField.intoSlice(felts as SecureField[]));
    this.updateDigest(hasher.finalize());
  }

  mix_u32s(data: readonly number[]): void {
    const hasher = new Blake2sHasher();
    hasher.update(this._digest.bytes);
    const buf = new Uint8Array(4);
    const view = new DataView(buf.buffer);
    for (const word of data) {
      view.setUint32(0, word >>> 0, true);
      hasher.update(buf);
    }
    this.updateDigest(hasher.finalize());
  }

  mix_u64(value: number | bigint): void {
    const v = BigInt(value);
    const low = Number(v & 0xffffffffn);
    const high = Number((v >> 32n) & 0xffffffffn);
    this.mix_u32s([low, high]);
  }

  private draw_base_felts(): M31[] {
    while (true) {
      const bytes = this.draw_random_bytes();
      const u32s: number[] = [];
      for (let i = 0; i < FELTS_PER_HASH; i++) {
        const view = new DataView(bytes.buffer, i * N_BYTES_FELT, N_BYTES_FELT);
        u32s.push(view.getUint32(0, true));
      }
      if (u32s.every((x) => x < 2 * P)) {
        return u32s.map((x) => M31.reduce(x));
      }
    }
  }

  draw_felt(): SecureField {
    if (this.baseQueue.length < SECURE_EXTENSION_DEGREE) {
      this.baseQueue.push(...this.draw_base_felts());
    }
    const arr = this.baseQueue.splice(0, SECURE_EXTENSION_DEGREE) as [M31, M31, M31, M31];
    return SecureField.fromM31Array(arr);
  }

  draw_felts(n_felts: number): SecureField[] {
    const res: SecureField[] = [];
    let baseQueue: M31[] = [];
    
    for (let i = 0; i < n_felts; i++) {
      // Ensure we have at least 4 base felts available
      while (baseQueue.length < SECURE_EXTENSION_DEGREE) {
        baseQueue.push(...this.draw_base_felts());
      }
      
      // Take 4 base felts to create a SecureField
      const arr = baseQueue.splice(0, SECURE_EXTENSION_DEGREE) as [M31, M31, M31, M31];
      res.push(SecureField.fromM31Array(arr));
    }
    
    return res;
  }

  draw_random_bytes(): Uint8Array {
    const counter = new Uint8Array(BLAKE_BYTES_PER_HASH);
    const view = new DataView(counter.buffer);
    view.setUint32(0, this.channel_time.n_sent, true);
    const input = new Uint8Array(this._digest.bytes.length + counter.length);
    input.set(this._digest.bytes, 0);
    input.set(counter, this._digest.bytes.length);
    this.channel_time.inc_sent();
    return Blake2sHasher.hash(input).asBytes();
  }
}
