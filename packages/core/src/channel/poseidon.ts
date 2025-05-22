import { poseidonHashMany, poseidonHash } from '@scure/starknet';
import type { Channel } from './index';
import { ChannelTime } from './index';
import { M31 as BaseField } from '../fields/m31';
import { QM31 as SecureField, SECURE_EXTENSION_DEGREE } from '../fields/qm31';

// Number of bytes that fit into a felt252.
export const BYTES_PER_FELT252 = Math.floor(252 / 8); // 31 bytes
export const FELTS_PER_HASH = 8;

/**
 * Represents a 252-bit field element compatible with Starknet's field.
 * This is a simplified implementation for the purposes of the Poseidon channel.
 * 
 * TODO(Sonnet4): when the dependency on a full FieldElement252 implementation
 * compatible with starknet_ff::FieldElement is available, replace this with
 * that implementation.
 */
export class FieldElement252 {
  private readonly value: bigint;

  constructor(value: bigint | number | string) {
    if (typeof value === 'string') {
      // Handle hex strings
      this.value = BigInt(value.startsWith('0x') ? value : `0x${value}`);
    } else {
      this.value = BigInt(value);
    }
    
    // Ensure value is within the field (simplified modulo operation)
    // In a full implementation, this would use the actual Starknet field modulus
    const STARKNET_PRIME = 0x800000000000011000000000000000000000000000000000000000000000001n;
    this.value = this.value % STARKNET_PRIME;
  }

  static zero(): FieldElement252 {
    return new FieldElement252(0n);
  }

  static from(value: bigint | number): FieldElement252 {
    return new FieldElement252(value);
  }

  static fromHexBe(hex: string): FieldElement252 | null {
    try {
      return new FieldElement252(hex);
    } catch {
      return null;
    }
  }

  add(other: FieldElement252): FieldElement252 {
    return new FieldElement252(this.value + other.value);
  }

  sub(other: FieldElement252): FieldElement252 {
    return new FieldElement252(this.value - other.value);
  }

  mul(other: FieldElement252): FieldElement252 {
    return new FieldElement252(this.value * other.value);
  }

  floorDiv(other: FieldElement252): FieldElement252 {
    return new FieldElement252(this.value / other.value);
  }

  toBigInt(): bigint {
    return this.value;
  }

  toBytesBe(): Uint8Array {
    const bytes = new Uint8Array(32);
    let val = this.value;
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(val & 0xffn);
      val = val >> 8n;
    }
    return bytes;
  }

  equals(other: FieldElement252): boolean {
    return this.value === other.value;
  }

  tryIntoU32(): number | null {
    if (this.value <= 0xffffffffn) {
      return Number(this.value);
    }
    return null;
  }

  tryIntoU8(): number | null {
    if (this.value <= 0xffn) {
      return Number(this.value);
    }
    return null;
  }
}

/**
 * A channel that can be used to draw random elements from a Poseidon252 hash.
 */
export class Poseidon252Channel implements Channel {
  readonly BYTES_PER_HASH = BYTES_PER_FELT252;
  
  private digest_value: FieldElement252;
  public channel_time: ChannelTime;

  constructor() {
    this.digest_value = FieldElement252.zero();
    this.channel_time = new ChannelTime();
  }

  clone(): Poseidon252Channel {
    const cloned = new Poseidon252Channel();
    cloned.digest_value = this.digest_value;
    cloned.channel_time = new ChannelTime();
    cloned.channel_time.n_challenges = this.channel_time.n_challenges;
    cloned.channel_time.n_sent = this.channel_time.n_sent;
    return cloned;
  }

  digest(): FieldElement252 {
    return this.digest_value;
  }

  updateDigest(newDigest: FieldElement252): void {
    this.digest_value = newDigest;
    this.channel_time.n_challenges += 1;
    this.channel_time.n_sent = 0;
  }

  private drawFelt252(): FieldElement252 {
    const res = new FieldElement252(poseidonHash(
      this.digest_value.toBigInt(),
      BigInt(this.channel_time.n_sent)
    ));
    this.channel_time.n_sent += 1;
    return res;
  }

  // TODO(shahars): Understand if we really need uniformity here.
  /// Generates a close-to uniform random vector of BaseField elements.
  private drawBaseFelts(): [BaseField, BaseField, BaseField, BaseField, BaseField, BaseField, BaseField, BaseField] {
    const shift = new FieldElement252(1n << 31n);

    let cur = this.drawFelt252();
    const u32s: number[] = [];
    
    for (let i = 0; i < 8; i++) {
      const next = cur.floorDiv(shift);
      const res = cur.sub(next.mul(shift));
      cur = next;
      const u32Val = res.tryIntoU32();
      if (u32Val === null) {
        throw new Error('Failed to convert to u32');
      }
      u32s.push(u32Val);
    }

    const baseFields = u32s.map(x => BaseField.reduce(x));
    if (baseFields.length !== 8) {
      throw new Error('Expected exactly 8 base fields');
    }
    return baseFields as [BaseField, BaseField, BaseField, BaseField, BaseField, BaseField, BaseField, BaseField];
  }

  trailing_zeros(): number {
    const bytes = this.digest_value.toBytesBe();
    // Take first 16 bytes
    const data = bytes.slice(0, 16);
    
    // Convert bytes to little-endian u128 for trailing zeros calculation
    let val = 0n;
    for (let i = 0; i < 16; i++) {
      val = val | (BigInt(data[i] ?? 0) << BigInt(i * 8));
    }
    
    // Count trailing zeros
    let count = 0;
    if (val === 0n) return 128; // All zeros
    
    while ((val & 1n) === 0n) {
      count++;
      val = val >> 1n;
    }
    
    return count;
  }

  mix_felts(felts: readonly SecureField[]): void {
    const shift = new FieldElement252(1n << 31n);
    const res: bigint[] = [];
    res.push(this.digest_value.toBigInt());
    
    for (let i = 0; i < felts.length; i += 2) {
      const chunk = felts.slice(i, i + 2);
      let accumulator = FieldElement252.zero();
      
      for (const felt of chunk) {
        const m31Array = felt.toM31Array();
        for (const m31 of m31Array) {
          accumulator = accumulator.mul(shift).add(FieldElement252.from(m31.value));
        }
      }
      res.push(accumulator.toBigInt());
    }

    // TODO(shahars): do we need length padding?
    this.updateDigest(new FieldElement252(poseidonHashMany(res)));
  }

  /// Mix a slice of u32s in chunks of 7 representing big endian felt252s.
  mix_u32s(data: readonly number[]): void {
    const shift = new FieldElement252(1n << 32n);
    const paddingLen = 6 - ((data.length + 6) % 7);
    
    // Pad data to multiple of 7
    const paddedData: number[] = [...data];
    for (let i = 0; i < paddingLen; i++) {
      paddedData.push(0);
    }
    
    const felts: bigint[] = [];
    
    for (let i = 0; i < paddedData.length; i += 7) {
      const chunk = paddedData.slice(i, i + 7);
      let accumulator = FieldElement252.zero();
      
      for (const val of chunk) {
        accumulator = accumulator.mul(shift).add(FieldElement252.from(val));
      }
      felts.push(accumulator.toBigInt());
    }

    // TODO(shahars): do we need length padding?
    const allFelts = [this.digest_value.toBigInt(), ...felts];
    this.updateDigest(new FieldElement252(poseidonHashMany(allFelts)));
  }

  mix_u64(value: number | bigint): void {
    const val = typeof value === 'bigint' ? value : BigInt(value);
    // Split value to 32-bit limbs representing a big endian felt252.
    const high = Number((val >> 32n) & 0xffffffffn);
    const low = Number(val & 0xffffffffn);
    this.mix_u32s([0, 0, 0, 0, 0, high, low]);
  }

  draw_felt(): SecureField {
    const felts = this.drawBaseFelts();
    return SecureField.fromM31Array([felts[0], felts[1], felts[2], felts[3]]);
  }

  draw_felts(nFelts: number): SecureField[] {
    const result: SecureField[] = [];
    let feltBuffer: BaseField[] = [];
    
    while (result.length < nFelts) {
      if (feltBuffer.length < SECURE_EXTENSION_DEGREE) {
        const newFelts = this.drawBaseFelts();
        feltBuffer.push(...newFelts);
      }
      
      const secureFelt = SecureField.fromM31Array([
        feltBuffer.shift()!,
        feltBuffer.shift()!,
        feltBuffer.shift()!,
        feltBuffer.shift()!,
      ]);
      result.push(secureFelt);
    }
    
    return result;
  }

  draw_random_bytes(): Uint8Array {
    const shift = new FieldElement252(1n << 8n);
    let cur = this.drawFelt252();
    const bytes = new Uint8Array(31);
    
    for (let i = 0; i < 31; i++) {
      const next = cur.floorDiv(shift);
      const res = cur.sub(next.mul(shift));
      cur = next;
      const byteVal = res.tryIntoU8();
      if (byteVal === null) {
        throw new Error('Failed to convert to u8');
      }
      bytes[i] = byteVal;
    }
    
    return bytes;
  }
}

/*
````rs
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
```
*/