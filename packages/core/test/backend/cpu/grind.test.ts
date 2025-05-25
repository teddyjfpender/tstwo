import { describe, it, expect } from "vitest";
import { CpuGrindOps, grind } from "../../../src/backend/cpu/grind";
import type { Channel } from "../../../src/channel";
import { ChannelTime } from "../../../src/channel";
import { QM31 } from "../../../src/fields/qm31";

// Mock channel implementation for testing
class MockChannel implements Channel {
  readonly BYTES_PER_HASH = 32;
  private nonce: number = 0;
  private trailingZeros: number = 0;
  private channelTime = ChannelTime.create();
  private initialTrailingZeros: number;

  constructor(trailingZeros: number = 0) {
    this.trailingZeros = trailingZeros;
    this.initialTrailingZeros = trailingZeros;
  }

  mix_u64(value: number | bigint): void {
    const numValue = typeof value === 'bigint' ? Number(value) : value;
    this.nonce = numValue;
    // Simulate different trailing zeros based on nonce
    // For testing, we'll make nonce 42 have 4 trailing zeros
    if (numValue === 0 && this.initialTrailingZeros > 0) {
      this.trailingZeros = this.initialTrailingZeros;
    } else if (numValue === 42) {
      this.trailingZeros = 4;
    } else if (numValue === 100) {
      this.trailingZeros = 8;
    } else {
      this.trailingZeros = 0;
    }
  }

  mix_u32s(data: readonly number[]): void {
    // Mock implementation
  }

  mix_felts(felts: readonly QM31[]): void {
    // Mock implementation
  }

  draw_felt(): QM31 {
    return QM31.zero();
  }

  draw_felts(n_felts: number): QM31[] {
    return new Array(n_felts).fill(QM31.zero());
  }

  draw_random_bytes(): Uint8Array {
    return new Uint8Array(this.BYTES_PER_HASH);
  }

  trailing_zeros(): number {
    return this.trailingZeros;
  }

  clone(): Channel {
    const cloned = new MockChannel(this.initialTrailingZeros);
    cloned.nonce = this.nonce;
    cloned.channelTime = this.channelTime;
    cloned.trailingZeros = this.trailingZeros;
    return cloned;
  }

  getChannelTime(): ChannelTime {
    return this.channelTime;
  }
}

describe("CpuGrindOps", () => {
  it("should find nonce with required trailing zeros", () => {
    const grindOps = new CpuGrindOps();
    const channel = new MockChannel();
    
    // Should find nonce 42 which has 4 trailing zeros
    const nonce = grindOps.grind(channel, 4);
    expect(nonce).toBe(42);
  });

  it("should find nonce with higher trailing zeros requirement", () => {
    const grindOps = new CpuGrindOps();
    const channel = new MockChannel();
    
    // Should find nonce 100 which has 8 trailing zeros
    const nonce = grindOps.grind(channel, 8);
    expect(nonce).toBe(100);
  });

  it("should return 0 when first nonce satisfies requirement", () => {
    const grindOps = new CpuGrindOps();
    const channel = new MockChannel(5); // Already has 5 trailing zeros
    
    const nonce = grindOps.grind(channel, 3);
    expect(nonce).toBe(0);
  });

  it("should not modify original channel", () => {
    const grindOps = new CpuGrindOps();
    const channel = new MockChannel();
    const originalTrailingZeros = channel.trailing_zeros();
    
    grindOps.grind(channel, 4);
    
    // Original channel should be unchanged
    expect(channel.trailing_zeros()).toBe(originalTrailingZeros);
  });
});

describe("grind function", () => {
  it("should work as standalone function", () => {
    const channel = new MockChannel();
    
    const nonce = grind(channel, 4);
    expect(nonce).toBe(42);
  });

  it("should handle zero trailing zeros requirement", () => {
    const channel = new MockChannel();
    
    const nonce = grind(channel, 0);
    expect(nonce).toBe(0);
  });
});

// Test with a more realistic channel implementation
class RealisticMockChannel implements Channel {
  readonly BYTES_PER_HASH = 32;
  private state: number = 0;
  private channelTime = ChannelTime.create();
  private seed: number;

  constructor(seed: number = 0) {
    this.seed = seed;
    this.state = seed;
  }

  mix_u64(value: number | bigint): void {
    const numValue = typeof value === 'bigint' ? Number(value) : value;
    // More realistic hash-like function for testing
    this.state = ((this.seed * 1103515245 + numValue * 12345) >>> 0) ^ (numValue << 16);
  }

  mix_u32s(data: readonly number[]): void {
    // Mock implementation
  }

  mix_felts(felts: readonly QM31[]): void {
    // Mock implementation
  }

  draw_felt(): QM31 {
    return QM31.zero();
  }

  draw_felts(n_felts: number): QM31[] {
    return new Array(n_felts).fill(QM31.zero());
  }

  draw_random_bytes(): Uint8Array {
    return new Uint8Array(this.BYTES_PER_HASH);
  }

  trailing_zeros(): number {
    if (this.state === 0) return 32;
    
    let zeros = 0;
    let temp = this.state;
    while ((temp & 1) === 0) {
      zeros++;
      temp >>>= 1;
    }
    return zeros;
  }

  clone(): Channel {
    const cloned = new RealisticMockChannel(this.seed);
    cloned.state = this.state;
    cloned.channelTime = this.channelTime;
    return cloned;
  }

  getChannelTime(): ChannelTime {
    return this.channelTime;
  }
}

describe("grind with realistic channel", () => {
  it("should eventually find a nonce with required trailing zeros", () => {
    const channel = new RealisticMockChannel(12345);
    
    // This should find some nonce that gives at least 2 trailing zeros
    const nonce = grind(channel, 2);
    
    // Verify the result
    const testChannel = new RealisticMockChannel(12345);
    testChannel.mix_u64(nonce);
    expect(testChannel.trailing_zeros()).toBeGreaterThanOrEqual(2);
  });

  it("should work with different trailing zero requirements", () => {
    const channel1 = new RealisticMockChannel(12345);
    const channel2 = new RealisticMockChannel(12345);
    
    const nonce1 = grind(channel1, 1);
    const nonce2 = grind(channel2, 3);
    
    // Verify both nonces work for their respective requirements
    const testChannel1 = new RealisticMockChannel(12345);
    testChannel1.mix_u64(nonce1);
    expect(testChannel1.trailing_zeros()).toBeGreaterThanOrEqual(1);
    
    const testChannel2 = new RealisticMockChannel(12345);
    testChannel2.mix_u64(nonce2);
    expect(testChannel2.trailing_zeros()).toBeGreaterThanOrEqual(3);
    
    // Higher requirement should generally need higher or equal nonce
    expect(nonce2).toBeGreaterThanOrEqual(nonce1);
  });
}); 