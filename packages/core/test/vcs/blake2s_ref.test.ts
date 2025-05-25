import { describe, it, expect } from 'vitest';
import { IV, SIGMA, compress } from '../../src/vcs/blake2s_ref';

describe('Blake2s Reference Implementation', () => {
  describe('Constants', () => {
    it('should have correct IV values', () => {
      expect(IV).toEqual([
        0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
        0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
      ]);
    });

    it('should have correct SIGMA permutation table', () => {
      expect(SIGMA.length).toBe(10);
      expect(SIGMA[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
      expect(SIGMA[1]).toEqual([14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3]);
    });
  });

  describe('compress function', () => {
    it('should handle basic compression', () => {
      const hVecs = [0, 0, 0, 0, 0, 0, 0, 0];
      const msgVecs = Array(16).fill(0);
      const result = compress(hVecs, msgVecs, 0, 0, 0, 0);
      
      expect(result).toHaveLength(8);
      expect(result.every(x => typeof x === 'number')).toBe(true);
    });

    it('should produce different results for different inputs', () => {
      const hVecs1 = [0, 0, 0, 0, 0, 0, 0, 0];
      const hVecs2 = [1, 0, 0, 0, 0, 0, 0, 0];
      const msgVecs = Array(16).fill(0);
      
      const result1 = compress(hVecs1, msgVecs, 0, 0, 0, 0);
      const result2 = compress(hVecs2, msgVecs, 0, 0, 0, 0);
      
      expect(result1).not.toEqual(result2);
    });

    it('should handle non-zero message vectors', () => {
      const hVecs = Array(8).fill(0);
      const msgVecs = Array.from({ length: 16 }, (_, i) => i);
      
      const result = compress(hVecs, msgVecs, 64, 0, 0xFFFFFFFF, 0);
      
      expect(result).toHaveLength(8);
      expect(result.every(x => typeof x === 'number')).toBe(true);
    });

    it('should handle maximum u32 values', () => {
      const hVecs = Array(8).fill(0xFFFFFFFF);
      const msgVecs = Array(16).fill(0xFFFFFFFF);
      
      const result = compress(hVecs, msgVecs, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF);
      
      expect(result).toHaveLength(8);
      expect(result.every(x => typeof x === 'number')).toBe(true);
    });

    it('should validate input lengths', () => {
      expect(() => {
        compress([1, 2, 3], Array(16).fill(0), 0, 0, 0, 0);
      }).toThrow('hVecs must have exactly 8 elements');

      expect(() => {
        compress(Array(8).fill(0), [1, 2, 3], 0, 0, 0, 0);
      }).toThrow('msgVecs must have exactly 16 elements');
    });

    it('should be deterministic', () => {
      const hVecs = [1, 2, 3, 4, 5, 6, 7, 8];
      const msgVecs = Array.from({ length: 16 }, (_, i) => i * 2);
      
      const result1 = compress(hVecs, msgVecs, 100, 0, 1, 0);
      const result2 = compress(hVecs, msgVecs, 100, 0, 1, 0);
      
      expect(result1).toEqual(result2);
    });

    it('should handle edge case with all zeros', () => {
      const hVecs = Array(8).fill(0);
      const msgVecs = Array(16).fill(0);
      
      const result = compress(hVecs, msgVecs, 0, 0, 0, 0);
      
      // This should match the expected output for all-zero input
      expect(result).toEqual([
        1848029226, 2795995149, 1371241353, 520215377,
        125539373, 602280490, 2742896865, 1845544798
      ]);
    });

    it('should handle different count values', () => {
      const hVecs = Array(8).fill(0);
      const msgVecs = Array(16).fill(0);
      
      const result1 = compress(hVecs, msgVecs, 0, 0, 0, 0);
      const result2 = compress(hVecs, msgVecs, 1, 0, 0, 0);
      const result3 = compress(hVecs, msgVecs, 0, 1, 0, 0);
      
      expect(result1).not.toEqual(result2);
      expect(result1).not.toEqual(result3);
      expect(result2).not.toEqual(result3);
    });

    it('should handle lastblock and lastnode flags', () => {
      const hVecs = Array(8).fill(0);
      const msgVecs = Array(16).fill(0);
      
      const result1 = compress(hVecs, msgVecs, 0, 0, 0, 0);
      const result2 = compress(hVecs, msgVecs, 0, 0, 0xFFFFFFFF, 0);
      const result3 = compress(hVecs, msgVecs, 0, 0, 0, 0xFFFFFFFF);
      
      expect(result1).not.toEqual(result2);
      expect(result1).not.toEqual(result3);
      expect(result2).not.toEqual(result3);
    });
  });

  describe('Performance and correctness', () => {
    it('should handle multiple compressions efficiently', () => {
      const hVecs = Array(8).fill(0);
      const msgVecs = Array(16).fill(0);
      
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        compress(hVecs, msgVecs, i, 0, 0, 0);
      }
      const end = performance.now();
      
      // Should complete 1000 compressions in reasonable time (less than 1 second)
      expect(end - start).toBeLessThan(1000);
    });

    it('should maintain 32-bit arithmetic properties', () => {
      const hVecs = Array(8).fill(0x80000000); // Large values
      const msgVecs = Array(16).fill(0x80000000);
      
      const result = compress(hVecs, msgVecs, 0x80000000, 0x80000000, 0, 0);
      
      // All results should be valid 32-bit unsigned integers
      result.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xFFFFFFFF);
        expect(Number.isInteger(value)).toBe(true);
      });
    });
  });
}); 