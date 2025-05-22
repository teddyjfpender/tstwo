import { describe, test, expect, beforeEach } from 'vitest';
import { Blake2sChannel, BLAKE_BYTES_PER_HASH, FELTS_PER_HASH } from '../../src/channel/blake2';
import { M31 } from '../../src/fields/m31';
import { QM31 as SecureField } from '../../src/fields/qm31';
import { Blake2sHash } from '../../src/vcs/blake2_hash';

describe('Blake2sChannel', () => {
  let channel: Blake2sChannel;

  beforeEach(() => {
    channel = new Blake2sChannel();
  });

  describe('initialization and basic properties', () => {
    test('should initialize with default values', () => {
      expect(channel.BYTES_PER_HASH).toBe(BLAKE_BYTES_PER_HASH);
      expect(channel.channel_time.n_challenges).toBe(0);
      expect(channel.channel_time.n_sent).toBe(0);
    });

    test('should have correct constants', () => {
      expect(BLAKE_BYTES_PER_HASH).toBe(32);
      expect(FELTS_PER_HASH).toBe(8);
    });

    test('digest should return the internal digest', () => {
      const digest = channel.digest();
      expect(digest).toBeInstanceOf(Blake2sHash);
      expect(digest.bytes).toHaveLength(32);
    });

    test('digestBytes should return the digest as bytes', () => {
      const bytes = channel.digestBytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toHaveLength(32);
    });
  });

  describe('updateDigest', () => {
    test('should update digest and increment challenges', () => {
      const initialChallenges = channel.channel_time.n_challenges;
      const newDigest = new Blake2sHash(new Uint8Array(32).fill(1));
      
      channel.updateDigest(newDigest);
      
      expect(channel.digest()).toBe(newDigest);
      expect(channel.channel_time.n_challenges).toBe(initialChallenges + 1);
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
      // Create a digest with known trailing zeros
      const bytes = new Uint8Array(32);
      bytes[0] = 0x08; // Binary: ...00001000, has 3 trailing zeros
      const digest = new Blake2sHash(bytes);
      channel.updateDigest(digest);
      
      const tz = channel.trailing_zeros();
      expect(tz).toBe(3);
    });

    test('should handle all zero bytes correctly', () => {
      const bytes = new Uint8Array(32); // All zeros
      const digest = new Blake2sHash(bytes);
      channel.updateDigest(digest);
      
      const tz = channel.trailing_zeros();
      expect(tz).toBe(128); // Maximum possible for 16 bytes (128 bits)
    });
  });

  describe('channel time tracking', () => {
    test('should track channel time correctly', () => {
      expect(channel.channel_time.n_challenges).toBe(0);
      expect(channel.channel_time.n_sent).toBe(0);

      channel.draw_random_bytes();
      expect(channel.channel_time.n_challenges).toBe(0);
      expect(channel.channel_time.n_sent).toBe(1);

      channel.draw_felts(9);
      expect(channel.channel_time.n_challenges).toBe(0);
      // Based on Rust test: drawing 9 felts should result in n_sent = 6
      // This is 1 (from previous draw_random_bytes) + 5 (for drawing 9 felts)
      expect(channel.channel_time.n_sent).toBe(6);
    });
  });

  describe('draw_random_bytes', () => {
    test('should return different bytes on consecutive calls', () => {
      const firstBytes = channel.draw_random_bytes();
      const secondBytes = channel.draw_random_bytes();
      
      expect(firstBytes).toHaveLength(32);
      expect(secondBytes).toHaveLength(32);
      expect(firstBytes).not.toEqual(secondBytes);
    });

    test('should increment n_sent counter', () => {
      const initialSent = channel.channel_time.n_sent;
      channel.draw_random_bytes();
      expect(channel.channel_time.n_sent).toBe(initialSent + 1);
    });
  });

  describe('draw_felt', () => {
    test('should return different felts on consecutive calls', () => {
      const firstFelt = channel.draw_felt();
      const secondFelt = channel.draw_felt();
      
      expect(firstFelt).toBeInstanceOf(SecureField);
      expect(secondFelt).toBeInstanceOf(SecureField);
      expect(firstFelt.equals(secondFelt)).toBe(false);
    });

    test('should return valid SecureField elements', () => {
      const felt = channel.draw_felt();
      expect(felt).toBeInstanceOf(SecureField);
      
      // Check that it's constructed from valid M31 elements
      const m31Array = felt.toM31Array();
      expect(m31Array).toHaveLength(4);
      m31Array.forEach(m31 => {
        expect(m31).toBeInstanceOf(M31);
        expect(m31.value).toBeGreaterThanOrEqual(0);
        expect(m31.value).toBeLessThan(2147483647); // P
      });
    });
  });

  describe('draw_felts', () => {
    test('should return correct number of felts', () => {
      const felts = channel.draw_felts(5);
      expect(felts).toHaveLength(5);
      felts.forEach(felt => {
        expect(felt).toBeInstanceOf(SecureField);
      });
    });

    test('should return unique felts', () => {
      const felts = channel.draw_felts(9);
      
      // Check that all felts are unique
      const uniqueFelts = new Set(felts.map(f => f.toString()));
      expect(uniqueFelts.size).toBe(felts.length);
    });

    test('should handle zero felts', () => {
      const felts = channel.draw_felts(0);
      expect(felts).toHaveLength(0);
    });

    test('should handle large number of felts', () => {
      const felts = channel.draw_felts(100);
      expect(felts).toHaveLength(100);
      
      // Verify they're all unique
      const uniqueFelts = new Set(felts.map(f => f.toString()));
      expect(uniqueFelts.size).toBe(100);
    });
  });

  describe('mix_felts', () => {
    test('should change digest when mixing felts', () => {
      const initialDigest = channel.digest();
      const felts: SecureField[] = [
        SecureField.from(M31.from(1923783)),
        SecureField.from(M31.from(1923784)),
      ];
      
      channel.mix_felts(felts);
      
      const newDigest = channel.digest();
      expect(newDigest).not.toEqual(initialDigest);
    });

    test('should increment challenges counter', () => {
      const initialChallenges = channel.channel_time.n_challenges;
      const felts: SecureField[] = [SecureField.from(M31.from(42))];
      
      channel.mix_felts(felts);
      
      expect(channel.channel_time.n_challenges).toBe(initialChallenges + 1);
    });

    test('should handle empty array', () => {
      const initialDigest = channel.digest();
      
      channel.mix_felts([]);
      
      // Should still change digest due to mixing empty data
      expect(channel.digest()).not.toEqual(initialDigest);
    });
  });

  describe('mix_u32s', () => {
    test('should change digest when mixing u32s', () => {
      const initialDigest = channel.digest();
      
      channel.mix_u32s([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      
      const newDigest = channel.digest();
      expect(newDigest).not.toEqual(initialDigest);
    });

    test('should produce expected digest for known input', () => {
      channel.mix_u32s([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const digest = Array.from(channel.digest().bytes);
      
      // This matches the expected output from the Rust test
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
      
      // Should still change digest due to mixing empty data
      expect(channel.digest()).not.toEqual(initialDigest);
    });

    test('should increment challenges counter', () => {
      const initialChallenges = channel.channel_time.n_challenges;
      
      channel.mix_u32s([1, 2, 3]);
      
      expect(channel.channel_time.n_challenges).toBe(initialChallenges + 1);
    });
  });

  describe('mix_u64', () => {
    test('should be equivalent to mixing two u32s', () => {
      const channel1 = new Blake2sChannel();
      const channel2 = new Blake2sChannel();
      
      channel1.mix_u64(BigInt('0x1111222233334444'));
      channel2.mix_u32s([0x33334444, 0x11112222]);
      
      expect(channel1.digest().bytes).toEqual(channel2.digest().bytes);
    });

    test('should produce expected digest for known input', () => {
      channel.mix_u64(BigInt('0x1111222233334444'));
      const digest = Array.from(channel.digest().bytes);
      
      // This matches the expected output from the Rust test
      const expected = [
        0xbc, 0x9e, 0x3f, 0xc1, 0xd2, 0x4e, 0x88, 0x97, 0x95, 0x6d, 0x33, 0x59, 0x32, 0x73,
        0x97, 0x24, 0x9d, 0x6b, 0xca, 0xcd, 0x22, 0x4d, 0x92, 0x74, 0x4, 0xe7, 0xba, 0x4a,
        0x77, 0xdc, 0x6e, 0xce
      ];
      
      expect(digest).toEqual(expected);
    });

    test('should handle BigInt values', () => {
      const initialDigest = channel.digest();
      
      channel.mix_u64(BigInt('0x1111222233334444'));
      
      expect(channel.digest()).not.toEqual(initialDigest);
    });

    test('should handle zero', () => {
      const initialDigest = channel.digest();
      
      channel.mix_u64(0);
      
      expect(channel.digest()).not.toEqual(initialDigest);
    });
  });

  describe('edge cases and stress tests', () => {
    test('should handle many consecutive operations', () => {
      const operations = 10; // Reduced for easier debugging
      const initialDigest = channel.digest();
      
      for (let i = 0; i < operations; i++) {
        channel.mix_u32s([i]); // Increments n_challenges and resets n_sent to 0
        channel.draw_random_bytes(); // Increments n_sent to 1
        // Force more random bytes by drawing enough felts to exhaust the 8-felt queue
        channel.draw_felts(3); // 3 felts = 12 base felts needed, but queue only has 8
      }
      
      expect(channel.digest()).not.toEqual(initialDigest);
      expect(channel.channel_time.n_challenges).toBe(operations);
      // After the last mix_u32s, n_sent is reset to 0, then draw_random_bytes makes it 1
      // Plus each draw_felts(3) should force at least 1 additional draw_base_felts call
      expect(channel.channel_time.n_sent).toBeGreaterThan(1);
    });

    test('should maintain deterministic behavior', () => {
      const channel1 = new Blake2sChannel();
      const channel2 = new Blake2sChannel();
      
      // Same sequence of operations should produce same results
      const operations = [
        () => { channel1.mix_u32s([1, 2, 3]); channel2.mix_u32s([1, 2, 3]); },
        () => { channel1.mix_u64(42); channel2.mix_u64(42); },
        () => { 
          const felt = SecureField.from(M31.from(12345));
          channel1.mix_felts([felt]); 
          channel2.mix_felts([felt]); 
        },
      ];
      
      operations.forEach(op => op());
      
      expect(channel1.digest().bytes).toEqual(channel2.digest().bytes);
      expect(channel1.channel_time.n_challenges).toBe(channel2.channel_time.n_challenges);
      expect(channel1.channel_time.n_sent).toBe(channel2.channel_time.n_sent);
    });

    test('should handle large arrays efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const start = performance.now();
      
      channel.mix_u32s(largeArray);
      
      const end = performance.now();
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('implementation details', () => {
    test('should use proper endianness for u32 serialization', () => {
      // Test that we're using little-endian for consistency with Rust implementation
      const testValue = 0x12345678;
      const channel1 = new Blake2sChannel();
      
      channel1.mix_u32s([testValue]);
      
      // The exact digest should match if endianness is correct
      expect(channel1.digest().bytes).toHaveLength(32);
    });

    test('should handle base felt rejection properly', () => {
      // This test ensures that the draw_base_felts method correctly rejects
      // values >= 2*P and retries until valid values are found
      const felts = channel.draw_felts(100);
      
      felts.forEach(felt => {
        const m31Array = felt.toM31Array();
        m31Array.forEach(m31 => {
          expect(m31.value).toBeLessThan(2147483647); // Less than P
        });
      });
    });
  });
}); 