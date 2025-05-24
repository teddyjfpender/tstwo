import { describe, test, expect, beforeEach } from 'vitest';
import { Blake2sChannel, BLAKE_BYTES_PER_HASH, FELTS_PER_HASH } from '../../src/channel/blake2';
import { Blake2sHash } from '../../src/vcs/blake2_hash';
import { QM31 as SecureField } from '../../src/fields/qm31';
import { M31 } from '../../src/fields/m31';

describe('Blake2sChannel', () => {
  let channel: Blake2sChannel;

  beforeEach(() => {
    channel = Blake2sChannel.create();
  });

  describe('initialization and basic properties', () => {
    test('should initialize with default values', () => {
      expect(channel.getChannelTime().n_challenges).toBe(0);
      expect(channel.getChannelTime().n_sent).toBe(0);
    });

    test('should have correct constants', () => {
      expect(channel.BYTES_PER_HASH).toBe(BLAKE_BYTES_PER_HASH);
      expect(BLAKE_BYTES_PER_HASH).toBe(32);
      expect(FELTS_PER_HASH).toBe(8);
    });

    test('digest should return the internal digest', () => {
      const digest = channel.digest();
      expect(digest).toBeInstanceOf(Blake2sHash);
    });

    test('digestBytes should return the digest as bytes', () => {
      const bytes = channel.digestBytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
    });
  });

  describe('trailing_zeros', () => {
    test('should return correct trailing zeros for default digest', () => {
      const tz = channel.trailing_zeros();
      expect(typeof tz).toBe('number');
      expect(tz).toBeGreaterThanOrEqual(0);
      expect(tz).toBeLessThanOrEqual(128);
    });

    test('should return correct trailing zeros for specific digest', () => {
      // Mix something to change the digest from all zeros
      channel.mix_u64(0x0001000000000000n); // Has some trailing zeros
      const tz = channel.trailing_zeros();
      expect(typeof tz).toBe('number');
      expect(tz).toBeGreaterThanOrEqual(0);
    });

    test('should handle all zero bytes correctly', () => {
      // Default digest should be all zeros
      const tz = channel.trailing_zeros();
      expect(tz).toBe(128); // All bits are zero
    });
  });

  describe('channel time tracking', () => {
    test('should track channel time correctly', () => {
      expect(channel.getChannelTime().n_challenges).toBe(0);
      expect(channel.getChannelTime().n_sent).toBe(0);

      channel.draw_random_bytes();
      expect(channel.getChannelTime().n_challenges).toBe(0);
      expect(channel.getChannelTime().n_sent).toBe(1);

      channel.mix_u64(123n);
      expect(channel.getChannelTime().n_challenges).toBe(1);
      expect(channel.getChannelTime().n_sent).toBe(0);
    });
  });

  describe('draw_random_bytes', () => {
    test('should return different bytes on consecutive calls', () => {
      const first = channel.draw_random_bytes();
      const second = channel.draw_random_bytes();

      expect(first).not.toEqual(second);
      expect(first.length).toBe(32);
      expect(second.length).toBe(32);
    });

    test('should increment n_sent counter', () => {
      expect(channel.getChannelTime().n_sent).toBe(0);
      channel.draw_random_bytes();
      expect(channel.getChannelTime().n_sent).toBe(1);
      channel.draw_random_bytes();
      expect(channel.getChannelTime().n_sent).toBe(2);
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
      // Empty array should still change digest
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
      const digest = Array.from(channel.digest().asBytes());
      const expected = [
        0x70, 0x91, 0x76, 0x83, 0x57, 0xbb, 0x1b, 0xb3, 0x34, 0x6f, 0xda, 0xb6, 0xb3, 0x57,
        0xd7, 0xfa, 0x46, 0xb8, 0xfb, 0xe3, 0x2c, 0x2e, 0x43, 0x24, 0xa0, 0xff, 0xc2, 0x94,
        0xcb, 0xf9, 0xa1, 0xc7
      ];
      expect(digest).toEqual(expected);
    });

    test('should handle empty array', () => {
      const initialDigest = channel.digest();
      channel.mix_u32s([]);
      expect(channel.digest().equals(initialDigest)).toBe(false);
    });

    test('should increment challenges counter', () => {
      expect(channel.getChannelTime().n_challenges).toBe(0);
      channel.mix_u32s([1, 2, 3]);
      expect(channel.getChannelTime().n_challenges).toBe(1);
    });
  });

  describe('mix_u64', () => {
    test('should be equivalent to mixing two u32s', () => {
      const channel1 = Blake2sChannel.create();
      const channel2 = Blake2sChannel.create();

      channel1.mix_u64(0x1111222233334444n);
      channel2.mix_u32s([0x33334444, 0x11112222]); // Little-endian order

      expect(channel1.digest().equals(channel2.digest())).toBe(true);
    });

    test('should produce expected digest for known input', () => {
      channel.mix_u64(0x1111222233334444n);
      const digest = Array.from(channel.digest().asBytes());
      const expected = [
        0xbc, 0x9e, 0x3f, 0xc1, 0xd2, 0x4e, 0x88, 0x97, 0x95, 0x6d, 0x33, 0x59, 0x32, 0x73,
        0x97, 0x24, 0x9d, 0x6b, 0xca, 0xcd, 0x22, 0x4d, 0x92, 0x74, 0x4, 0xe7, 0xba, 0x4a,
        0x77, 0xdc, 0x6e, 0xce
      ];
      expect(digest).toEqual(expected);
    });

    test('should handle BigInt values', () => {
      const initialDigest = channel.digest();
      channel.mix_u64(0xFFFFFFFFFFFFFFFFn);
      expect(channel.digest().equals(initialDigest)).toBe(false);
    });

    test('should handle zero', () => {
      const initialDigest = channel.digest();
      channel.mix_u64(0n);
      expect(channel.digest().equals(initialDigest)).toBe(false);
    });
  });

  describe('edge cases and stress tests', () => {
    test('should handle many consecutive operations', () => {
      for (let i = 0; i < 100; i++) {
        channel.mix_u32s([i]);
        channel.draw_felt();
      }
      expect(channel.getChannelTime().n_challenges).toBe(100);
    });

    test('should maintain deterministic behavior', () => {
      const channel1 = Blake2sChannel.create();
      const channel2 = Blake2sChannel.create();

      // Perform same operations on both channels
      channel1.mix_u64(12345n);
      channel2.mix_u64(12345n);

      const felt1 = channel1.draw_felt();
      const felt2 = channel2.draw_felt();

      expect(felt1.equals(felt2)).toBe(true);
    });

    test('should handle large arrays efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => i % 0xFFFFFFFF);
      const start = performance.now();
      channel.mix_u32s(largeArray);
      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should be fast
    });
  });

  describe('implementation details', () => {
    test('should use proper endianness for u32 serialization', () => {
      const channel1 = Blake2sChannel.create();
      const channel2 = Blake2sChannel.create();

      // Test that our u64 -> u32 conversion matches expected endianness
      // mix_u64 splits as [low, high] where low = value & 0xffffffff, high = (value >> 32) & 0xffffffff
      const testValue = 0x1111222233334444n;
      channel1.mix_u64(testValue);
      channel2.mix_u32s([0x33334444, 0x11112222]); // This should match the Rust test exactly

      expect(channel1.digest().equals(channel2.digest())).toBe(true);
    });

    test('should handle base felt rejection properly', () => {
      // This test verifies that the retry mechanism for base felts works
      // Though we can't force a retry easily, we can at least verify that
      // draw_felt() consistently returns valid results
      for (let i = 0; i < 10; i++) {
        const felt = channel.draw_felt();
        expect(felt).toBeInstanceOf(SecureField);
      }
    });
  });
}); 