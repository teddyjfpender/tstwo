import { describe, test, expect, beforeEach } from 'vitest';
import { Poseidon252Channel, FieldElement252, BYTES_PER_FELT252, FELTS_PER_HASH } from '../../src/channel/poseidon';
import { M31 } from '../../src/fields/m31';
import { QM31 as SecureField } from '../../src/fields/qm31';

describe('FieldElement252', () => {
  describe('construction and basic operations', () => {
    test('should construct from different value types', () => {
      const fe1 = FieldElement252.from(123n);
      const fe2 = FieldElement252.from(123);
      const fe3 = FieldElement252.fromHexBe('0x7b');
      const fe4 = FieldElement252.fromHexBe('7b');

      expect(fe1.equals(fe2)).toBe(true);
      expect(fe2.equals(fe3!)).toBe(true);
      expect(fe3!.equals(fe4!)).toBe(true);
    });

    test('should create zero element', () => {
      const zero = FieldElement252.zero();
      expect(zero.toBigInt()).toBe(0n);
    });

    test('should create from bigint/number', () => {
      const fe1 = FieldElement252.from(42n);
      const fe2 = FieldElement252.from(42);
      expect(fe1.equals(fe2)).toBe(true);
    });

    test('should handle hex conversion', () => {
      const fe = FieldElement252.fromHexBe('0x123456789abcdef');
      expect(fe).not.toBe(null);
      expect(fe!.toBigInt()).toBe(0x123456789abcdefn);

      const invalid = FieldElement252.fromHexBe('invalid');
      expect(invalid).toBe(null);
    });
  });

  describe('arithmetic operations', () => {
    test('should perform addition', () => {
      const a = FieldElement252.from(10n);
      const b = FieldElement252.from(20n);
      const sum = a.add(b);
      expect(sum.toBigInt()).toBe(30n);
    });

    test('should perform subtraction', () => {
      const a = FieldElement252.from(50n);
      const b = FieldElement252.from(20n);
      const diff = a.sub(b);
      expect(diff.toBigInt()).toBe(30n);
    });

    test('should perform multiplication', () => {
      const a = FieldElement252.from(6n);
      const b = FieldElement252.from(7n);
      const prod = a.mul(b);
      expect(prod.toBigInt()).toBe(42n);
    });

    test('should perform floor division', () => {
      const a = FieldElement252.from(42n);
      const b = FieldElement252.from(6n);
      const quotient = a.floorDiv(b);
      expect(quotient.toBigInt()).toBe(7n);
    });
  });

  describe('type conversions', () => {
    test('should convert to bytes big endian', () => {
      const fe = FieldElement252.from(0x123456789abcdefn);
      const bytes = fe.toBytesBe();
      expect(bytes).toHaveLength(32);
      
      // Check the last 8 bytes contain our value in big endian
      const view = new DataView(bytes.buffer, 24, 8);
      expect(view.getBigUint64(0, false)).toBe(0x123456789abcdefn);
    });

    test('should try convert to u32', () => {
      const small = FieldElement252.from(0xffffffffn);
      const large = FieldElement252.from(0x100000000n);
      
      expect(small.tryIntoU32()).toBe(0xffffffff);
      expect(large.tryIntoU32()).toBe(null);
    });

    test('should try convert to u8', () => {
      const small = FieldElement252.from(255n);
      const large = FieldElement252.from(256n);
      
      expect(small.tryIntoU8()).toBe(255);
      expect(large.tryIntoU8()).toBe(null);
    });
  });

  describe('equality', () => {
    test('should check equality correctly', () => {
      const a = FieldElement252.from(42n);
      const b = FieldElement252.from(42n);
      const c = FieldElement252.from(43n);
      
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });
});

describe('Poseidon252Channel', () => {
  let channel: Poseidon252Channel;

  beforeEach(() => {
    channel = Poseidon252Channel.create();
  });

  describe('initialization and basic properties', () => {
    test('should initialize with default values', () => {
      expect(channel.BYTES_PER_HASH).toBe(BYTES_PER_FELT252);
      expect(channel.getChannelTime().n_challenges).toBe(0);
      expect(channel.getChannelTime().n_sent).toBe(0);
    });

    test('should have correct constants', () => {
      expect(BYTES_PER_FELT252).toBe(31);
      expect(FELTS_PER_HASH).toBe(8);
    });

    test('digest should return the internal digest', () => {
      const digest = channel.digest();
      expect(digest).toBeInstanceOf(FieldElement252);
      expect(digest.equals(FieldElement252.zero())).toBe(true);
    });
  });

  describe('cloning', () => {
    test('should clone channel correctly', () => {
      // Simulate some operations to change state
      channel.mix_u32s([1, 2, 3]);
      channel.draw_random_bytes();
      
      const cloned = channel.clone();
      
      expect(cloned.getChannelTime().n_challenges).toBe(channel.getChannelTime().n_challenges);
      expect(cloned.getChannelTime().n_sent).toBe(channel.getChannelTime().n_sent);
      expect(cloned.digest().equals(channel.digest())).toBe(true);
      
      // Ensure it's a deep copy - operations on clone don't affect original
      cloned.mix_u32s([4, 5, 6]);
      expect(cloned.getChannelTime().n_challenges).not.toBe(channel.getChannelTime().n_challenges);
    });
  });

  describe('digest management', () => {
    test('should update digest and increment challenges', () => {
      const initialChallenges = channel.getChannelTime().n_challenges;
      
      channel.mix_u32s([1, 2, 3]);
      
      expect(channel.getChannelTime().n_challenges).toBe(initialChallenges + 1);
      expect(channel.getChannelTime().n_sent).toBe(0);
    });
  });

  describe('trailing_zeros', () => {
    test('should return correct trailing zeros for default digest', () => {
      const tz = channel.trailing_zeros();
      expect(typeof tz).toBe('number');
      expect(tz).toBeGreaterThanOrEqual(0);
      expect(tz).toBeLessThanOrEqual(128);
    });

    test('should return 128 for all zero digest', () => {
      const tz = channel.trailing_zeros(); // Default is zero
      expect(tz).toBe(128);
    });

    test('should return correct trailing zeros for specific digest', () => {
      // Mix something to change the digest from all zeros
      channel.mix_u64(0x0001000000000000n); // Has some trailing zeros
      
      const tz = channel.trailing_zeros();
      expect(tz).toBeGreaterThanOrEqual(0);
      expect(tz).toBeLessThanOrEqual(128);
    });
  });

  describe('channel time tracking', () => {
    test('should track channel time correctly during operations', () => {
      expect(channel.getChannelTime().n_challenges).toBe(0);
      expect(channel.getChannelTime().n_sent).toBe(0);

      channel.draw_random_bytes();
      expect(channel.getChannelTime().n_challenges).toBe(0);
      expect(channel.getChannelTime().n_sent).toBe(1);

      channel.draw_felts(9);
      expect(channel.getChannelTime().n_challenges).toBe(0);
      expect(channel.getChannelTime().n_sent).toBe(6);
    });
  });

  describe('draw_random_bytes', () => {
    test('should return different bytes on consecutive calls', () => {
      const first = channel.draw_random_bytes();
      const second = channel.draw_random_bytes();

      expect(first).not.toEqual(second);
      expect(first.length).toBe(31);
      expect(second.length).toBe(31);
    });

    test('should increment n_sent counter', () => {
      expect(channel.getChannelTime().n_sent).toBe(0);
      channel.draw_random_bytes();
      expect(channel.getChannelTime().n_sent).toBe(1);
      channel.draw_random_bytes();
      expect(channel.getChannelTime().n_sent).toBe(2);
    });

    test('should return valid bytes', () => {
      const bytes = channel.draw_random_bytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(31);
    });
  });

  describe('draw_felt', () => {
    test('should return different felts on consecutive calls', () => {
      const first = channel.draw_felt();
      const second = channel.draw_felt();

      expect(first.equals(second)).toBe(false);
    });

    test('should return valid SecureField elements', () => {
      const felt = channel.draw_felt();
      expect(felt).toBeInstanceOf(SecureField);
    });
  });

  describe('draw_felts', () => {
    test('should return correct number of felts', () => {
      const felts = channel.draw_felts(5);
      expect(felts.length).toBe(5);
      felts.forEach(felt => expect(felt).toBeInstanceOf(SecureField));
    });

    test('should return unique felts', () => {
      const felts = channel.draw_felts(10);
      const uniqueFelts = new Set(felts.map(f => f.toString()));
      expect(uniqueFelts.size).toBe(felts.length);
    });

    test('should handle zero felts', () => {
      const felts = channel.draw_felts(0);
      expect(felts).toEqual([]);
    });

    test('should handle large number of felts', () => {
      const felts = channel.draw_felts(100);
      expect(felts.length).toBe(100);
    });
  });

  describe('mix_felts', () => {
    test('should change digest when mixing felts', () => {
      const initialDigest = channel.digest();
      const felts = [
        SecureField.from(M31.from(123)),
        SecureField.from(M31.from(456))
      ];

      channel.mix_felts(felts);

      expect(channel.digest().equals(initialDigest)).toBe(false);
    });

    test('should increment challenges counter', () => {
      expect(channel.getChannelTime().n_challenges).toBe(0);
      channel.mix_felts([SecureField.from(M31.from(123))]);
      expect(channel.getChannelTime().n_challenges).toBe(1);
    });

    test('should handle empty array', () => {
      const initialDigest = channel.digest();
      channel.mix_felts([]);
      expect(channel.digest().equals(initialDigest)).toBe(false);
    });

    test('should handle odd number of felts', () => {
      const initialDigest = channel.digest();
      const felts = [
        SecureField.from(M31.from(1)),
        SecureField.from(M31.from(2)),
        SecureField.from(M31.from(3)) // Odd number
      ];
      
      channel.mix_felts(felts);
      expect(channel.digest().equals(initialDigest)).toBe(false);
    });
  });

  describe('mix_u32s', () => {
    test('should change digest when mixing u32s', () => {
      const initialDigest = channel.digest();
      channel.mix_u32s([1, 2, 3, 4]);
      expect(channel.digest().equals(initialDigest)).toBe(false);
    });

    test('should produce expected digest for known input', () => {
      channel.mix_u32s([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      
      const expectedHex = '0x078f5cf6a2e7362b75fc1f94daeae7ebddd64e6b2db771717519af7193dfa80b';
      const expected = FieldElement252.fromHexBe(expectedHex);
      
      expect(channel.digest().equals(expected!)).toBe(true);
    });

    test('should handle padding correctly', () => {
      // Test with different array lengths to verify padding works without causing errors
      const channel1 = Poseidon252Channel.create();
      const channel2 = Poseidon252Channel.create();
      
      // Mix arrays of different lengths - should work without errors
      channel1.mix_u32s([1, 2, 3]);
      channel2.mix_u32s([1, 2, 3, 4, 5, 6, 7]);
      
      // Both should produce valid digests (different from initial)
      expect(channel1.digest().equals(FieldElement252.zero())).toBe(false);
      expect(channel2.digest().equals(FieldElement252.zero())).toBe(false);
      
      // And they should be different from each other due to different inputs
      expect(channel1.digest().equals(channel2.digest())).toBe(false);
    });

    test('should increment challenges counter', () => {
      expect(channel.getChannelTime().n_challenges).toBe(0);
      channel.mix_u32s([1, 2, 3]);
      expect(channel.getChannelTime().n_challenges).toBe(1);
    });
  });

  describe('mix_u64', () => {
    test('should be equivalent to mixing split u32s', () => {
      const channel1 = Poseidon252Channel.create();
      const channel2 = Poseidon252Channel.create();

      channel1.mix_u64(0x1111222233334444n);
      channel2.mix_u32s([0, 0, 0, 0, 0, 0x11112222, 0x33334444]);

      expect(channel1.digest().equals(channel2.digest())).toBe(true);
    });

    test('should handle both number and bigint inputs', () => {
      const channel1 = Poseidon252Channel.create();
      const channel2 = Poseidon252Channel.create();

      // Use a smaller value that fits safely in both number and bigint
      const safeValue = 0x12345678;
      
      channel1.mix_u64(BigInt(safeValue));
      channel2.mix_u64(safeValue);
      
      expect(channel1.digest().equals(channel2.digest())).toBe(true);
    });

    test('should increment challenges counter', () => {
      expect(channel.getChannelTime().n_challenges).toBe(0);
      channel.mix_u64(12345n);
      expect(channel.getChannelTime().n_challenges).toBe(1);
    });
  });

  describe('consistency and determinism', () => {
    test('should produce consistent results across instances', () => {
      const channel1 = Poseidon252Channel.create();
      const channel2 = Poseidon252Channel.create();

      // Same operations should produce same results
      channel1.mix_u32s([1, 2, 3]);
      channel2.mix_u32s([1, 2, 3]);

      const felt1 = channel1.draw_felt();
      const felt2 = channel2.draw_felt();

      expect(felt1.equals(felt2)).toBe(true);
      expect(channel1.digest().equals(channel2.digest())).toBe(true);
    });

    test('should be deterministic', () => {
      const sequence = () => {
        const ch = Poseidon252Channel.create();
        ch.mix_u64(42n);
        ch.mix_felts([SecureField.from(M31.from(123))]);
        return ch.draw_felt();
      };

      const result1 = sequence();
      const result2 = sequence();

      expect(result1.equals(result2)).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should handle max u32 values', () => {
      const maxU32 = 0xFFFFFFFF;
      const initialDigest = channel.digest();
      
      channel.mix_u32s([maxU32, maxU32, maxU32]);
      
      expect(channel.digest().equals(initialDigest)).toBe(false);
    });

    test('should handle max u64 values', () => {
      const maxU64 = 0xFFFFFFFFFFFFFFFFn;
      const initialDigest = channel.digest();
      
      channel.mix_u64(maxU64);
      
      expect(channel.digest().equals(initialDigest)).toBe(false);
    });

    test('should handle large arrays', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => i % 0xFFFFFFFF);
      const start = performance.now();
      
      channel.mix_u32s(largeArray);
      
      const end = performance.now();
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle many felts generation', () => {
      const start = performance.now();
      
      const felts = channel.draw_felts(1000);
      
      const end = performance.now();
      expect(felts.length).toBe(1000);
      expect(end - start).toBeLessThan(1000); // Should be reasonably fast
    });
  });
}); 