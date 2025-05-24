import { describe, test, expect, beforeEach } from 'vitest';
import { Blake2sChannel } from '../../src/channel/blake2';
import { Poseidon252Channel, FieldElement252 } from '../../src/channel/poseidon';
import { LoggingChannel } from '../../src/channel/logging_channel';
import { ChannelTime } from '../../src/channel/index';
import { M31 } from '../../src/fields/m31';
import { QM31 as SecureField } from '../../src/fields/qm31';

/**
 * These tests exactly match the Rust test scenarios to ensure 1:1 port coverage.
 * Each test corresponds to a specific #[test] function in the Rust implementation.
 */

describe('Blake2sChannel - Exact Rust Test Port', () => {
  describe('test_channel_time', () => {
    test('should match Rust channel time behavior exactly', () => {
      const channel = Blake2sChannel.create();

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

  describe('test_draw_random_bytes', () => {
    test('should return different bytes on consecutive calls', () => {
      const channel = Blake2sChannel.create();

      const firstRandomBytes = channel.draw_random_bytes();
      const secondRandomBytes = channel.draw_random_bytes();

      // Assert that next random bytes are different
      expect(firstRandomBytes).not.toEqual(secondRandomBytes);
    });
  });

  describe('test_draw_felt', () => {
    test('should return different felts on consecutive calls', () => {
      const channel = Blake2sChannel.create();

      const firstRandomFelt = channel.draw_felt();
      const secondRandomFelt = channel.draw_felt();

      // Assert that next random felt is different
      expect(firstRandomFelt.equals(secondRandomFelt)).toBe(false);
    });
  });

  describe('test_draw_felts', () => {
    test('should return unique felts', () => {
      const channel = Blake2sChannel.create();

      const randomFelts = channel.draw_felts(5);
      randomFelts.push(...channel.draw_felts(4));

      // Assert that all the random felts are unique
      const uniqueFelts = new Set(randomFelts.map(f => f.toString()));
      expect(uniqueFelts.size).toBe(randomFelts.length);
    });
  });

  describe('test_mix_felts', () => {
    test('should change digest when mixing felts', () => {
      const channel = Blake2sChannel.create();
      const initialDigest = channel.digest();
      
      const felts: SecureField[] = [0, 1].map(i => 
        SecureField.from(M31.from(i + 1923782))
      );

      channel.mix_felts(felts);

      expect(channel.digest().equals(initialDigest)).toBe(false);
    });
  });

  describe('test_mix_u64', () => {
    test('should be equivalent to mixing two u32s in little-endian order', () => {
      const channel1 = Blake2sChannel.create();
      channel1.mix_u64(0x1111222233334444n);
      const digest64 = channel1.digest();

      const channel2 = Blake2sChannel.create();
      channel2.mix_u32s([0x33334444, 0x11112222]);

      expect(digest64.equals(channel2.digest())).toBe(true);
      
      // Also verify the exact digest bytes match the Rust test
      const digestBytes = Array.from(digest64.asBytes());
      const expected = [
        0xbc, 0x9e, 0x3f, 0xc1, 0xd2, 0x4e, 0x88, 0x97, 0x95, 0x6d, 0x33, 0x59, 0x32, 0x73,
        0x97, 0x24, 0x9d, 0x6b, 0xca, 0xcd, 0x22, 0x4d, 0x92, 0x74, 0x4, 0xe7, 0xba, 0x4a,
        0x77, 0xdc, 0x6e, 0xce
      ];
      expect(digestBytes).toEqual(expected);
    });
  });

  describe('test_mix_u32s', () => {
    test('should produce exact digest matching Rust implementation', () => {
      const channel = Blake2sChannel.create();
      channel.mix_u32s([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      
      const digest = Array.from(channel.digest().asBytes());
      const expected = [
        0x70, 0x91, 0x76, 0x83, 0x57, 0xbb, 0x1b, 0xb3, 0x34, 0x6f, 0xda, 0xb6, 0xb3, 0x57,
        0xd7, 0xfa, 0x46, 0xb8, 0xfb, 0xe3, 0x2c, 0x2e, 0x43, 0x24, 0xa0, 0xff, 0xc2, 0x94,
        0xcb, 0xf9, 0xa1, 0xc7
      ];
      
      expect(digest).toEqual(expected);
    });
  });
});

describe('Poseidon252Channel - Exact Rust Test Port', () => {
  describe('test_channel_time', () => {
    test('should match Rust channel time behavior exactly', () => {
      const channel = Poseidon252Channel.create();

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

  describe('test_draw_random_bytes', () => {
    test('should return different bytes on consecutive calls', () => {
      const channel = Poseidon252Channel.create();

      const firstRandomBytes = channel.draw_random_bytes();
      const secondRandomBytes = channel.draw_random_bytes();

      // Assert that next random bytes are different
      expect(firstRandomBytes).not.toEqual(secondRandomBytes);
    });
  });

  describe('test_draw_felt', () => {
    test('should return different felts on consecutive calls', () => {
      const channel = Poseidon252Channel.create();

      const firstRandomFelt = channel.draw_felt();
      const secondRandomFelt = channel.draw_felt();

      // Assert that next random felt is different
      expect(firstRandomFelt.equals(secondRandomFelt)).toBe(false);
    });
  });

  describe('test_draw_felts', () => {
    test('should return unique felts', () => {
      const channel = Poseidon252Channel.create();

      const randomFelts = channel.draw_felts(5);
      randomFelts.push(...channel.draw_felts(4));

      // Assert that all the random felts are unique
      const uniqueFelts = new Set(randomFelts.map(f => f.toString()));
      expect(uniqueFelts.size).toBe(randomFelts.length);
    });
  });

  describe('test_mix_felts', () => {
    test('should change digest when mixing felts', () => {
      const channel = Poseidon252Channel.create();
      const initialDigest = channel.digest();
      
      const felts: SecureField[] = [0, 1].map(i => 
        SecureField.from(M31.from(i + 1923782))
      );

      channel.mix_felts(felts);

      expect(channel.digest().equals(initialDigest)).toBe(false);
    });
  });

  describe('test_mix_u64', () => {
    test('should be equivalent to mixing split u32s in big-endian felt252 format', () => {
      const channel1 = Poseidon252Channel.create();
      channel1.mix_u64(0x1111222233334444n);
      const digest64 = channel1.digest();

      const channel2 = Poseidon252Channel.create();
      channel2.mix_u32s([0, 0, 0, 0, 0, 0x11112222, 0x33334444]);

      expect(digest64.equals(channel2.digest())).toBe(true);
    });
  });

  describe('test_mix_u32s', () => {
    test('should produce exact digest matching Rust implementation', () => {
      const channel = Poseidon252Channel.create();
      channel.mix_u32s([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      
      const expectedHex = '0x078f5cf6a2e7362b75fc1f94daeae7ebddd64e6b2db771717519af7193dfa80b';
      const expected = FieldElement252.fromHexBe(expectedHex);
      
      expect(channel.digest().equals(expected!)).toBe(true);
    });
  });
});

describe('LoggingChannel - Exact Rust Test Port', () => {
  describe('test_logging_channel', () => {
    test('should produce identical results to wrapped channel', () => {
      // Create both channels
      const loggingChannel = LoggingChannel.create(Blake2sChannel.create());
      const regularChannel = Blake2sChannel.create();

      // Generate test data (simulating Rust's SmallRng::seed_from_u64(0))
      const felts = [
        SecureField.from(M31.from(12345)),
        SecureField.from(M31.from(67890)),
        SecureField.from(M31.from(11111)),
      ];
      
      loggingChannel.mix_felts(felts);
      regularChannel.mix_felts(felts);

      const value = 0x1234567890abcdefn;
      loggingChannel.mix_u64(value);
      regularChannel.mix_u64(value);

      const felt1 = loggingChannel.draw_felt();
      const felt2 = regularChannel.draw_felt();
      expect(felt1.equals(felt2)).toBe(true);

      const nFelts = 5; // Fixed value instead of random for deterministic test
      const felts1 = loggingChannel.draw_felts(nFelts);
      const felts2 = regularChannel.draw_felts(nFelts);
      expect(felts1.length).toBe(felts2.length);
      for (let i = 0; i < felts1.length; i++) {
        expect(felts1[i]!.equals(felts2[i]!)).toBe(true);
      }

      const bytes1 = loggingChannel.draw_random_bytes();
      const bytes2 = regularChannel.draw_random_bytes();
      expect(bytes1).toEqual(bytes2);

      expect(loggingChannel.channel.digest().equals(regularChannel.digest())).toBe(true);
    });
  });
});

describe('World-Leading Improvements Validation', () => {
  describe('API Hygiene', () => {
    test('should prevent direct construction of ChannelTime', () => {
      // ChannelTime constructor is private, must use factory methods
      expect(() => new (ChannelTime as any)()).toThrow();
    });

    test('should prevent direct construction of channels', () => {
      // Channel constructors are private, must use factory methods
      expect(() => new (Blake2sChannel as any)()).toThrow();
      expect(() => new (Poseidon252Channel as any)()).toThrow();
    });

    test('should provide immutable channel time access', () => {
      const channel = Blake2sChannel.create();
      const channelTime = channel.getChannelTime();
      
      // Should be read-only
      expect(() => {
        (channelTime as any).n_challenges = 999;
      }).toThrow();
    });
  });

  describe('Type Safety', () => {
    test('should validate u32 array inputs', () => {
      const channel = Blake2sChannel.create();
      
      // Should reject invalid u32 values
      expect(() => channel.mix_u32s([-1])).toThrow(TypeError);
      expect(() => channel.mix_u32s([0x100000000])).toThrow(TypeError);
      expect(() => channel.mix_u32s([1.5])).toThrow(TypeError);
    });

    test('should validate u64 inputs', () => {
      const channel = Blake2sChannel.create();
      
      // Should reject invalid u64 values
      expect(() => channel.mix_u64(-1)).toThrow(TypeError);
      expect(() => channel.mix_u64(1.5)).toThrow(TypeError);
    });

    test('should validate felt count inputs', () => {
      const channel = Blake2sChannel.create();
      
      // Should reject invalid felt counts
      expect(() => channel.draw_felts(-1)).toThrow(TypeError);
      expect(() => channel.draw_felts(1.5)).toThrow(TypeError);
    });
  });

  describe('Performance/Purity', () => {
    test('should use static constants', () => {
      // Verify constants are properly typed as const
      const blake2Const: 32 = Blake2sChannel.create().BYTES_PER_HASH;
      const poseidonConst: 31 = Poseidon252Channel.create().BYTES_PER_HASH;
      
      expect(blake2Const).toBe(32);
      expect(poseidonConst).toBe(31);
    });

    test('should handle large operations efficiently', () => {
      const channel = Blake2sChannel.create();
      const start = performance.now();
      
      // Large array operation should complete quickly
      const largeArray = Array.from({ length: 10000 }, (_, i) => i % 0xFFFFFFFF);
      channel.mix_u32s(largeArray);
      
      const end = performance.now();
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });
  });
}); 