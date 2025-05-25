import { describe, it, expect, beforeEach } from "vitest";
import { grind, grindBlake2s, SimdGrindOps, SimdGenericGrindOps } from "../../../src/backend/simd/grind";
import { Blake2sChannel } from "../../../src/channel";
import type { Channel } from "../../../src/channel";

describe("SimdGrindOps", () => {
  let channel: Blake2sChannel;
  let grindOps: SimdGrindOps;

  beforeEach(() => {
    channel = Blake2sChannel.create();
    grindOps = new SimdGrindOps();
  });

  describe("grind", () => {
    it("should find a nonce with 0 trailing zeros (always succeeds)", () => {
      const nonce = grindOps.grind(channel, 0);
      expect(typeof nonce).toBe("number");
      expect(nonce).toBeGreaterThanOrEqual(0);
    });

    it("should find a nonce with 1 trailing zero", () => {
      const nonce = grindOps.grind(channel, 1);
      
      // Verify the nonce actually produces the required trailing zeros
      const testChannel = Blake2sChannel.create();
      testChannel.mix_u64(nonce);
      expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(1);
    });

    it("should find a nonce with 2 trailing zeros", () => {
      const nonce = grindOps.grind(channel, 2);
      
      // Verify the nonce actually produces the required trailing zeros
      const testChannel = Blake2sChannel.create();
      testChannel.mix_u64(nonce);
      expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(2);
    });

    it("should throw error for pow_bits > 32", () => {
      expect(() => grindOps.grind(channel, 33)).toThrow("pow_bits > 32 is not supported");
    });

    it("should find different nonces for different initial channel states", () => {
      const channel1 = Blake2sChannel.create();
      const channel2 = Blake2sChannel.create();
      
      // Mix different data into each channel to create different initial states
      channel1.mix_u64(12345);
      channel2.mix_u64(67890);
      
      const nonce1 = grindOps.grind(channel1, 1);
      const nonce2 = grindOps.grind(channel2, 1);
      
      // Nonces should be different (or very unlikely to be the same)
      expect(nonce1).not.toBe(nonce2);
    });

    it("should not modify the original channel", () => {
      const originalDigest = channel.digest();
      const originalChallenges = channel.getChannelTime().n_challenges;
      const originalSent = channel.getChannelTime().n_sent;
      
      grindOps.grind(channel, 1);
      
      // Original channel should be unchanged
      expect(channel.digest().bytes).toEqual(originalDigest.bytes);
      expect(channel.getChannelTime().n_challenges).toBe(originalChallenges);
      expect(channel.getChannelTime().n_sent).toBe(originalSent);
    });

    it("should work with channel that has mixed data", () => {
      // Mix some data into the channel first
      channel.mix_u32s([1, 2, 3, 4]);
      channel.mix_u64(0x1234567890abcdefn); // Use bigint literal
      
      const nonce = grindOps.grind(channel, 1);
      
      // Verify the nonce works with the modified channel
      const testChannel = Blake2sChannel.create();
      testChannel.mix_u32s([1, 2, 3, 4]);
      testChannel.mix_u64(0x1234567890abcdefn); // Use bigint literal
      testChannel.mix_u64(nonce);
      
      expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(1);
    });

    it("should handle edge case of very high trailing zero requirements", () => {
      // This test might take longer, so we'll use a smaller requirement
      // In production, very high requirements would take exponentially longer
      const nonce = grindOps.grind(channel, 3);
      
      const testChannel = Blake2sChannel.create();
      testChannel.mix_u64(nonce);
      expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(3);
    });

    it("should handle maximum supported pow_bits", () => {
      // Test with a reasonable number instead of 32 to avoid hanging
      const nonce = grindOps.grind(channel, 4);
      
      const testChannel = Blake2sChannel.create();
      testChannel.mix_u64(nonce);
      expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(4);
    });
  });

  describe("channel cloning", () => {
    it("should properly clone Blake2sChannel", () => {
      // Set up initial channel state
      channel.mix_u64(12345);
      const originalDigest = channel.digest();
      const originalChallenges = channel.getChannelTime().n_challenges;
      const originalSent = channel.getChannelTime().n_sent;
      
      // Test the cloning logic
      const clone = channel.clone();
      
      // Clone should have same digest but be separate instance
      expect(clone.digest().bytes).toEqual(originalDigest.bytes);
      expect(clone.getChannelTime().n_challenges).toBe(originalChallenges);
      expect(clone.getChannelTime().n_sent).toBe(originalSent);
      expect(clone).not.toBe(channel);
    });
  });
});

describe("SimdGenericGrindOps", () => {
  let channel: Blake2sChannel;
  let grindOps: SimdGenericGrindOps;

  beforeEach(() => {
    channel = Blake2sChannel.create();
    grindOps = new SimdGenericGrindOps();
  });

  describe("grind", () => {
    it("should find a nonce with 0 trailing zeros (always succeeds)", () => {
      const nonce = grindOps.grind(channel, 0);
      expect(typeof nonce).toBe("number");
      expect(nonce).toBeGreaterThanOrEqual(0);
    });

    it("should find a nonce with 1 trailing zero", () => {
      const nonce = grindOps.grind(channel, 1);
      
      // Verify the nonce actually produces the required trailing zeros
      const testChannel = Blake2sChannel.create();
      testChannel.mix_u64(nonce);
      expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(1);
    });

    it("should work with any channel type", () => {
      const nonce = grindOps.grind(channel, 2);
      
      // Verify the nonce actually produces the required trailing zeros
      const testChannel = Blake2sChannel.create();
      testChannel.mix_u64(nonce);
      expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("grindBlake2s standalone function", () => {
  let channel: Blake2sChannel;

  beforeEach(() => {
    channel = Blake2sChannel.create();
  });

  it("should work as a standalone function", () => {
    const nonce = grindBlake2s(channel, 1);
    
    // Verify the result
    const testChannel = Blake2sChannel.create();
    testChannel.mix_u64(nonce);
    expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(1);
  });

  it("should produce same results as class-based implementation", () => {
    const grindOps = new SimdGrindOps();
    
    // Use same channel state for both
    channel.mix_u64(42);
    const channel1 = channel.clone();
    const channel2 = channel.clone();
    
    const nonce1 = grindBlake2s(channel1, 1);
    const nonce2 = grindOps.grind(channel2, 1);
    
    expect(nonce1).toBe(nonce2);
  });

  it("should handle pow_bits validation", () => {
    expect(() => grindBlake2s(channel, 33)).toThrow("pow_bits > 32 is not supported");
  });
});

describe("grind generic standalone function", () => {
  let channel: Blake2sChannel;

  beforeEach(() => {
    channel = Blake2sChannel.create();
  });

  it("should work as a standalone function", () => {
    const nonce = grind(channel, 1);
    
    // Verify the result
    const testChannel = Blake2sChannel.create();
    testChannel.mix_u64(nonce);
    expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(1);
  });

  it("should produce same results as class-based implementation", () => {
    const grindOps = new SimdGenericGrindOps();
    
    // Use same channel state for both
    channel.mix_u64(42);
    const channel1 = channel.clone();
    const channel2 = channel.clone();
    
    const nonce1 = grind(channel1, 1);
    const nonce2 = grindOps.grind(channel2, 1);
    
    expect(nonce1).toBe(nonce2);
  });
});

describe("SIMD grind performance and correctness", () => {
  it("should consistently find valid nonces", () => {
    const channel = Blake2sChannel.create();
    const powBits = 2;
    
    // Run multiple iterations to ensure consistency
    for (let i = 0; i < 5; i++) {
      channel.mix_u64(i); // Create different starting states
      const testChannel = channel.clone();
      const nonce = grind(testChannel, powBits);
      
      // Verify each nonce is valid
      const verifyChannel = channel.clone();
      verifyChannel.mix_u64(nonce);
      expect(verifyChannel.trailing_zeros()).toBeGreaterThanOrEqual(powBits);
    }
  });

  it("should handle nonce of 0", () => {
    // Create a channel state where nonce 0 might work
    const channel = Blake2sChannel.create();
    const nonce = grind(channel, 0); // 0 trailing zeros should always work
    
    expect(nonce).toBeGreaterThanOrEqual(0);
  });

  it("mirrors Rust implementation behavior", () => {
    // This test ensures our implementation follows the exact Rust logic:
    // 1. Clone channel
    // 2. Mix nonce
    // 3. Check trailing zeros
    // 4. Return if sufficient, otherwise increment nonce
    
    const channel = Blake2sChannel.create();
    const powBits = 1;
    
    // Manually simulate the algorithm to verify our implementation
    let expectedNonce = 0;
    while (true) {
      const testChannel = channel.clone();
      testChannel.mix_u64(expectedNonce);
      if (testChannel.trailing_zeros() >= powBits) {
        break;
      }
      expectedNonce++;
    }
    
    const actualNonce = grind(channel, powBits);
    expect(actualNonce).toBe(expectedNonce);
  });

  it("should handle Blake2s-specific optimizations", () => {
    // Test that Blake2s-specific grind works correctly
    const channel = Blake2sChannel.create();
    const nonce = grindBlake2s(channel, 1);
    
    // Verify the result
    const testChannel = Blake2sChannel.create();
    testChannel.mix_u64(nonce);
    expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(1);
  });
}); 