import { describe, it, expect } from 'vitest';
import { secureEvalToBaseEval, test_channel } from '../src/test_utils';
import { Blake2sChannel } from '../src/channel/blake2';
import { M31 } from '../src/fields/m31';
import { QM31 } from '../src/fields/qm31';

// Create a simple mock evaluation for testing
class MockEvaluation {
  public domain: any;
  public values: QM31[];

  constructor(domain: any, values: QM31[]) {
    this.domain = domain;
    this.values = values;
  }
}

describe('test_utils', () => {
  describe('secureEvalToBaseEval', () => {
    it('should convert SecureField evaluation to BaseField evaluation', () => {
      // Create test data: QM31 values that convert to M31 values
      const secureValues = [
        QM31.fromM31Array([M31.from(1), M31.from(0), M31.from(0), M31.from(0)]),
        QM31.fromM31Array([M31.from(2), M31.from(0), M31.from(0), M31.from(0)]),
        QM31.fromM31Array([M31.from(3), M31.from(0), M31.from(0), M31.from(0)]),
        QM31.fromM31Array([M31.from(4), M31.from(0), M31.from(0), M31.from(0)]),
      ];

      // Create a mock domain and evaluation
      const mockDomain = { size: () => 4 };
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);

      // Verify the result is a MockEvaluation (same constructor)
      expect(baseEval).toBeInstanceOf(MockEvaluation);
      expect(baseEval.domain).toBe(mockDomain);
      
      // Verify the values are correctly converted
      expect(baseEval.values).toHaveLength(4);
      expect(baseEval.values[0]?.equals(M31.from(1))).toBe(true);
      expect(baseEval.values[1]?.equals(M31.from(2))).toBe(true);
      expect(baseEval.values[2]?.equals(M31.from(3))).toBe(true);
      expect(baseEval.values[3]?.equals(M31.from(4))).toBe(true);
    });

    it('should handle complex SecureField values correctly', () => {
      // Create more complex QM31 values (with non-zero imaginary components)
      const secureValues = [
        QM31.fromM31Array([M31.from(10), M31.from(20), M31.from(30), M31.from(40)]),
        QM31.fromM31Array([M31.from(50), M31.from(60), M31.from(70), M31.from(80)]),
      ];

      const mockDomain = { size: () => 2 };
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);

      // Only the first component (real part of first complex number) should be extracted
      expect(baseEval.values).toHaveLength(2);
      expect(baseEval.values[0]?.equals(M31.from(10))).toBe(true);
      expect(baseEval.values[1]?.equals(M31.from(50))).toBe(true);
    });

    it('should preserve domain information', () => {
      const secureValues = [QM31.zero()];
      const mockDomain = { size: () => 1 };
      
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);

      expect(baseEval.domain).toBe(mockDomain);
    });

    it('should handle zero values', () => {
      const secureValues = [
        QM31.zero(),
        QM31.zero(),
        QM31.zero(),
        QM31.zero(),
      ];

      const mockDomain = { size: () => 4 };
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);

      expect(baseEval.values).toHaveLength(4);
      baseEval.values.forEach(value => {
        expect(value?.equals(M31.zero())).toBe(true);
      });
    });

    it('should handle maximum M31 values', () => {
      const maxM31 = M31.from(2147483646); // P - 1
      const secureValues = [
        QM31.fromM31Array([maxM31, M31.from(0), M31.from(0), M31.from(0)]),
      ];

      const mockDomain = { size: () => 1 };
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);

      expect(baseEval.values[0]?.equals(maxM31)).toBe(true);
    });

    it('should maintain constructor type consistency', () => {
      const secureValues = [QM31.fromM31Array([M31.from(42), M31.from(0), M31.from(0), M31.from(0)])];
      const mockDomain = { size: () => 1 };
      
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);

      // The result should be constructed using the same constructor type
      expect(baseEval.constructor).toBe(secureEval.constructor);
    });
  });

  describe('test_channel', () => {
    it('should create a new Blake2sChannel instance', () => {
      const channel = test_channel();
      
      expect(channel).toBeInstanceOf(Blake2sChannel);
    });

    it('should create fresh channels each time', () => {
      const channel1 = test_channel();
      const channel2 = test_channel();
      
      // Should be different instances
      expect(channel1).not.toBe(channel2);
      
      // Both should be Blake2sChannel instances
      expect(channel1).toBeInstanceOf(Blake2sChannel);
      expect(channel2).toBeInstanceOf(Blake2sChannel);
    });

    it('should create channels with default state', () => {
      const channel = test_channel();
      
      // Channel should start with default digest and channel time
      expect(channel.channel_time.n_challenges).toBe(0);
      expect(channel.channel_time.n_sent).toBe(0);
    });

    it('should create independent channels', () => {
      const channel1 = test_channel();
      const channel2 = test_channel();
      
      // Modify one channel
      channel1.draw_felt();
      
      // The other should remain unaffected
      expect(channel1.channel_time.n_sent).toBeGreaterThan(0);
      expect(channel2.channel_time.n_sent).toBe(0);
    });

    it('should create channels that can be used for cryptographic operations', () => {
      const channel = test_channel();
      
      // Should be able to draw random elements
      const felt1 = channel.draw_felt();
      const felt2 = channel.draw_felt();
      
      // Should produce different values
      expect(felt1.equals(felt2)).toBe(false);
      
      // Should be QM31 instances
      expect(felt1).toBeInstanceOf(QM31);
      expect(felt2).toBeInstanceOf(QM31);
    });

    it('should create channels that support mixing operations', () => {
      const channel = test_channel();
      const initialDigest = channel.digestBytes();
      
      // Mix some data
      channel.mix_u64(12345n);
      
      // Digest should change
      expect(channel.digestBytes()).not.toEqual(initialDigest);
    });

    it('should match Rust default behavior', () => {
      // In Rust, Blake2sChannel::default() creates a channel with zero digest
      const channel = test_channel();
      
      // The channel should start in a deterministic state
      // (Blake2sChannel constructor should initialize to consistent state)
      expect(channel).toBeInstanceOf(Blake2sChannel);
      expect(channel.channel_time.n_challenges).toBe(0);
      expect(channel.channel_time.n_sent).toBe(0);
    });
  });

  describe('API compatibility with Rust', () => {
    it('secureEvalToBaseEval should mirror Rust secure_eval_to_base_eval exactly', () => {
      // Test that our TypeScript implementation mirrors the Rust function exactly:
      // - Takes a CpuCircleEvaluation<SecureField, EvalOrder>
      // - Returns a CpuCircleEvaluation<BaseField, EvalOrder>
      // - Extracts first component of toM31Array() for each value
      
      const mockDomain = { size: () => 2 };
      const secureValues = [
        QM31.fromM31Array([M31.from(1), M31.from(2), M31.from(3), M31.from(4)]),
        QM31.fromM31Array([M31.from(5), M31.from(6), M31.from(7), M31.from(8)]),
      ];
      
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);
      
      // Should extract first component [0] from toM31Array()
      expect(baseEval.values[0]?.equals(M31.from(1))).toBe(true);
      expect(baseEval.values[1]?.equals(M31.from(5))).toBe(true);
      
      // Domain should be preserved
      expect(baseEval.domain).toBe(mockDomain);
    });

    it('test_channel should mirror Rust test_channel exactly', () => {
      // Test that our TypeScript implementation mirrors the Rust function exactly:
      // - Returns Blake2sChannel::default()
      
      const channel = test_channel();
      
      // Should be equivalent to Blake2sChannel::default()
      expect(channel).toBeInstanceOf(Blake2sChannel);
      
      // Should have initial state like default constructor
      expect(channel.channel_time.n_challenges).toBe(0);
      expect(channel.channel_time.n_sent).toBe(0);
    });
  });

  describe('performance characteristics', () => {
    it('secureEvalToBaseEval should be efficient for large evaluations', () => {
      // Create a larger evaluation to test performance characteristics
      const secureValues = Array.from({ length: 1024 }, (_, i) => 
        QM31.fromM31Array([M31.from(i), M31.from(0), M31.from(0), M31.from(0)])
      );
      
      const mockDomain = { size: () => 1024 };
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      
      const start = performance.now();
      const baseEval = secureEvalToBaseEval(secureEval as any);
      const end = performance.now();
      
      // Should complete in reasonable time
      expect(end - start).toBeLessThan(100); // 100ms threshold
      
      // Verify correctness on sample elements
      expect(baseEval.values[0]?.equals(M31.from(0))).toBe(true);
      expect(baseEval.values[100]?.equals(M31.from(100))).toBe(true);
      expect(baseEval.values[1023]?.equals(M31.from(1023))).toBe(true);
    });

    it('test_channel should have minimal overhead', () => {
      // Creating channels should be fast
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        test_channel();
      }
      
      const end = performance.now();
      
      // Should be very fast
      expect(end - start).toBeLessThan(100); // 100ms for 1000 channels
    });
  });

  describe('type safety', () => {
    it('should maintain proper TypeScript types throughout conversion', () => {
      const mockDomain = { size: () => 1 };
      const secureValues = [QM31.fromM31Array([M31.from(42), M31.from(0), M31.from(0), M31.from(0)])];
      
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);
      
      // TypeScript should properly infer the return type
      expect(baseEval.values[0]).toBeInstanceOf(M31);
      
      // The domain should be preserved with correct type
      expect(baseEval.domain).toBe(mockDomain);
    });

    it('should work with generic EvalOrder types', () => {
      // The function should work with any EvalOrder type parameter
      const mockDomain = { size: () => 1 };
      const secureValues = [QM31.zero()];
      
      const secureEval = new MockEvaluation(mockDomain, secureValues);
      const baseEval = secureEvalToBaseEval(secureEval as any);
      
      // Should compile and work regardless of EvalOrder
      expect(baseEval).toBeInstanceOf(MockEvaluation);
    });
  });
}); 