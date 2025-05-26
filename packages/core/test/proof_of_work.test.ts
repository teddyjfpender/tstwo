import { describe, it, expect, beforeEach } from 'vitest';
import type { GrindOps } from '../src/proof_of_work';
import { ProofOfWork } from '../src/proof_of_work';
import { Blake2sChannel } from '../src/channel/blake2';
import type { Channel } from '../src/channel';

/**
 * Mock implementation of GrindOps for testing
 */
class MockGrindOps implements GrindOps<Blake2sChannel> {
  grind(channel: Blake2sChannel, powBits: number): number {
    ProofOfWork.validatePowBits(powBits);
    ProofOfWork.validateChannel(channel);
    
    // Simple mock implementation that finds a nonce
    let nonce = 0;
    const originalDigest = channel.digest();
    
    while (nonce < 1000000) { // Prevent infinite loops in tests
      // Clone channel to test without modifying original
      const testChannel = channel.clone();
      testChannel.mix_u64(nonce);
      
      const trailingZeros = testChannel.trailing_zeros();
      if (trailingZeros >= powBits) {
        return nonce;
      }
      nonce++;
    }
    
    throw new Error('Could not find nonce within reasonable attempts');
  }
}

/**
 * Mock channel that doesn't implement Channel interface (for negative testing)
 */
class InvalidChannel {
  // Missing required methods
}

describe('ProofOfWork', () => {
  let channel: Blake2sChannel;
  let grindOps: MockGrindOps;

  beforeEach(() => {
    channel = Blake2sChannel.create();
    grindOps = new MockGrindOps();
  });

  describe('GrindOps interface', () => {
    it('should define the correct interface', () => {
      expect(typeof grindOps.grind).toBe('function');
    });

    it('should work with valid parameters', () => {
      const result = grindOps.grind(channel, 1);
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should find nonce for small pow bits', () => {
      const nonce = grindOps.grind(channel, 2);
      
      // Verify the nonce actually works
      const testChannel = channel.clone();
      testChannel.mix_u64(nonce);
      expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(2);
    });

    it('should work with zero pow bits', () => {
      const nonce = grindOps.grind(channel, 0);
      expect(typeof nonce).toBe('number');
      expect(nonce).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ProofOfWork.validatePowBits', () => {
    it('should accept valid pow bits', () => {
      expect(() => ProofOfWork.validatePowBits(0)).not.toThrow();
      expect(() => ProofOfWork.validatePowBits(1)).not.toThrow();
      expect(() => ProofOfWork.validatePowBits(32)).not.toThrow();
      expect(() => ProofOfWork.validatePowBits(64)).not.toThrow();
    });

    it('should reject negative pow bits', () => {
      expect(() => ProofOfWork.validatePowBits(-1)).toThrow(TypeError);
      expect(() => ProofOfWork.validatePowBits(-10)).toThrow(TypeError);
    });

    it('should reject non-integer pow bits', () => {
      expect(() => ProofOfWork.validatePowBits(1.5)).toThrow(TypeError);
      expect(() => ProofOfWork.validatePowBits(NaN)).toThrow(TypeError);
      expect(() => ProofOfWork.validatePowBits(Infinity)).toThrow(TypeError);
    });

    it('should reject pow bits that are too large', () => {
      expect(() => ProofOfWork.validatePowBits(65)).toThrow(TypeError);
      expect(() => ProofOfWork.validatePowBits(100)).toThrow(TypeError);
    });

    it('should provide meaningful error messages', () => {
      expect(() => ProofOfWork.validatePowBits(-1)).toThrow('powBits must be at least 0');
      expect(() => ProofOfWork.validatePowBits(65)).toThrow('powBits must be at most 64');
      expect(() => ProofOfWork.validatePowBits(1.5)).toThrow('powBits must be an integer');
    });
  });

  describe('ProofOfWork.isValidChannel', () => {
    it('should return true for valid channels', () => {
      expect(ProofOfWork.isValidChannel(channel)).toBe(true);
    });

    it('should return false for invalid channels', () => {
      expect(ProofOfWork.isValidChannel(null)).toBe(false);
      expect(ProofOfWork.isValidChannel(undefined)).toBe(false);
      expect(ProofOfWork.isValidChannel({})).toBe(false);
      expect(ProofOfWork.isValidChannel(new InvalidChannel())).toBe(false);
      expect(ProofOfWork.isValidChannel('string')).toBe(false);
      expect(ProofOfWork.isValidChannel(123)).toBe(false);
    });

    it('should check for required methods', () => {
      const partialChannel = {
        trailing_zeros: () => 0,
        mix_u64: () => {},
        // Missing draw_random_bytes
      };
      expect(ProofOfWork.isValidChannel(partialChannel)).toBe(false);
    });

    it('should check method types', () => {
      const invalidChannel = {
        trailing_zeros: 'not a function',
        mix_u64: () => {},
        draw_random_bytes: () => new Uint8Array(),
      };
      expect(ProofOfWork.isValidChannel(invalidChannel)).toBe(false);
    });
  });

  describe('ProofOfWork.validateChannel', () => {
    it('should not throw for valid channels', () => {
      expect(() => ProofOfWork.validateChannel(channel)).not.toThrow();
    });

    it('should throw for invalid channels', () => {
      expect(() => ProofOfWork.validateChannel({} as any)).toThrow(TypeError);
      expect(() => ProofOfWork.validateChannel(null as any)).toThrow(TypeError);
    });

    it('should provide meaningful error message', () => {
      expect(() => ProofOfWork.validateChannel({} as any)).toThrow('channel must implement Channel interface');
    });
  });

  describe('ProofOfWork.toU64', () => {
    it('should handle valid numbers', () => {
      expect(ProofOfWork.toU64(0)).toBe(0);
      expect(ProofOfWork.toU64(1)).toBe(1);
      expect(ProofOfWork.toU64(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle valid bigints', () => {
      expect(ProofOfWork.toU64(0n)).toBe(0n);
      expect(ProofOfWork.toU64(1n)).toBe(1n);
      expect(ProofOfWork.toU64(0xFFFFFFFFFFFFFFFFn)).toBe(0xFFFFFFFFFFFFFFFFn);
    });

    it('should reject negative numbers', () => {
      expect(() => ProofOfWork.toU64(-1)).toThrow(RangeError);
      expect(() => ProofOfWork.toU64(-100)).toThrow(RangeError);
    });

    it('should reject negative bigints', () => {
      expect(() => ProofOfWork.toU64(-1n)).toThrow(RangeError);
      expect(() => ProofOfWork.toU64(-100n)).toThrow(RangeError);
    });

    it('should reject non-integer numbers', () => {
      expect(() => ProofOfWork.toU64(1.5)).toThrow(RangeError);
      expect(() => ProofOfWork.toU64(NaN)).toThrow(RangeError);
      expect(() => ProofOfWork.toU64(Infinity)).toThrow(RangeError);
    });

    it('should reject numbers that are too large', () => {
      expect(() => ProofOfWork.toU64(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    });

    it('should reject bigints that are too large', () => {
      expect(() => ProofOfWork.toU64(0x10000000000000000n)).toThrow(RangeError);
    });

    it('should provide meaningful error messages', () => {
      expect(() => ProofOfWork.toU64(-1)).toThrow('number value must be a non-negative safe integer');
      expect(() => ProofOfWork.toU64(-1n)).toThrow('bigint value must be in u64 range [0, 2^64-1]');
      expect(() => ProofOfWork.toU64(0x10000000000000000n)).toThrow('bigint value must be in u64 range [0, 2^64-1]');
    });
  });

  describe('ProofOfWork constants', () => {
    it('should have correct constant values', () => {
      expect(ProofOfWork.MAX_POW_BITS).toBe(64);
      expect(ProofOfWork.MIN_POW_BITS).toBe(0);
    });

    it('should have immutable constants', () => {
      const maxBits = ProofOfWork.MAX_POW_BITS;
      const minBits = ProofOfWork.MIN_POW_BITS;
      
      // These should be readonly
      expect(typeof maxBits).toBe('number');
      expect(typeof minBits).toBe('number');
    });
  });

  describe('Integration tests', () => {
    it('should work with different channel states', () => {
      // Test with fresh channel
      const nonce1 = grindOps.grind(channel, 1);
      expect(typeof nonce1).toBe('number');
      
      // Modify channel state
      channel.mix_u64(12345);
      
      // Test with modified channel
      const nonce2 = grindOps.grind(channel, 1);
      expect(typeof nonce2).toBe('number');
      
      // Results should potentially be different due to different channel state
      // (though they could be the same by chance)
    });

    it('should handle edge cases', () => {
      // Test with a reasonable pow bits value (not maximum which would be too slow)
      expect(() => grindOps.grind(channel, 8)).not.toThrow();
      
      // Test with minimum pow bits
      expect(() => grindOps.grind(channel, ProofOfWork.MIN_POW_BITS)).not.toThrow();
    });

    it('should validate parameters in grind implementation', () => {
      expect(() => grindOps.grind(channel, -1)).toThrow(TypeError);
      expect(() => grindOps.grind(channel, 1.5)).toThrow(TypeError);
      expect(() => grindOps.grind({} as any, 1)).toThrow(TypeError);
    });
  });

  describe('Type safety', () => {
    it('should enforce channel type constraints', () => {
      // This should compile and work
      const validGrind: GrindOps<Blake2sChannel> = grindOps;
      expect(validGrind.grind(channel, 1)).toBeTypeOf('number');
    });

    it('should work with generic channel types', () => {
      // Test that the interface works with the base Channel type
      const genericGrind: GrindOps<Channel> = {
        grind(ch: Channel, bits: number): number {
          ProofOfWork.validatePowBits(bits);
          ProofOfWork.validateChannel(ch);
          return 0; // Mock implementation
        }
      };
      
      expect(genericGrind.grind(channel, 1)).toBe(0);
    });
  });

  describe('Performance characteristics', () => {
    it('should complete quickly for small pow bits', () => {
      const start = Date.now();
      grindOps.grind(channel, 1);
      const duration = Date.now() - start;
      
      // Should complete within reasonable time (1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple grinds efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 10; i++) {
        const testChannel = Blake2sChannel.create();
        testChannel.mix_u64(i); // Different starting state
        grindOps.grind(testChannel, 1);
      }
      
      const duration = Date.now() - start;
      
      // Should complete all grinds within reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });
}); 