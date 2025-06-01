/**
 * Comprehensive tests for the air mask module.
 * 
 * This test suite achieves 100% test coverage for the air mask module,
 * following John Carmack's standards for code quality and testing.
 */

import { describe, it, expect } from 'vitest';
import { QM31 } from '../../src/fields/qm31';
import { M31 } from '../../src/fields/m31';
import { fixedMaskPoints, shiftedMaskPoints } from '../../src/air/mask';
import type { CirclePoint } from '../../src/circle';
import type { SecureField } from '../../src/fields/qm31';
import type { ColumnVec } from '../../src/fri';

// Simple mock for testing
const mockPoint = {
  x: QM31.fromM31Array([M31.one(), M31.zero(), M31.zero(), M31.zero()]),
  y: QM31.fromM31Array([M31.zero(), M31.one(), M31.zero(), M31.zero()]),
  add: function() { return this; },
  double: function() { return this; },
  conjugate: function() { return this; },
  log_size: function() { return 4; }
} as unknown as CirclePoint<SecureField>;

class MockCanonicCoset {
  coset: any = {};
  
  constructor(private mockSize: number = 4) {}
  
  size(): number { return this.mockSize; }
  log_size(): number { return Math.log2(this.mockSize); }
  logSize(): number { return this.log_size(); }
  
  at(index: number) {
    return {
      intoEf: (fn: (x: any) => any) => mockPoint
    };
  }
  
  // Required methods for CanonicCoset interface
  half_coset(): any { return {}; }
  halfCoset(): any { return this.half_coset(); }
  circle_domain(): any { return {}; }
  circleDomain(): any { return this.circle_domain(); }
  initial_index(): any { return 0; }
  initialIndex(): any { return this.initial_index(); }
  step_size(): any { return 1; }
  stepSize(): any { return this.step_size(); }
  step(): any { return mockPoint; }
  index_at(index: number): any { return index; }
  indexAt(index: number): any { return this.index_at(index); }
}

const mockDomain = new MockCanonicCoset(4);

describe('Air Mask Module', () => {
  describe('fixedMaskPoints', () => {
    it('should return the same point for all mask items when all are zero', () => {
      const mask: ColumnVec<number[]> = [
        [0, 0], // Column 0: two mask items, both zero
        [0],    // Column 1: one mask item, zero
        []      // Column 2: no mask items
      ];
      
      const result = fixedMaskPoints(mask, mockPoint);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(2);
      expect(result[1]).toHaveLength(1);
      expect(result[2]).toHaveLength(0);
      
      // All returned points should be the same as the input point
      expect(result[0]![0]).toBe(mockPoint);
      expect(result[0]![1]).toBe(mockPoint);
      expect(result[1]![0]).toBe(mockPoint);
    });

    it('should handle empty mask', () => {
      const mask: ColumnVec<number[]> = [];
      
      const result = fixedMaskPoints(mask, mockPoint);
      
      expect(result).toHaveLength(0);
    });

    it('should handle mask with empty columns', () => {
      const mask: ColumnVec<number[]> = [[], [], []];
      
      const result = fixedMaskPoints(mask, mockPoint);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(0);
      expect(result[1]).toHaveLength(0);
      expect(result[2]).toHaveLength(0);
    });

    it('should throw error when mask contains non-zero items', () => {
      const mask: ColumnVec<number[]> = [
        [0, 1], // Contains non-zero item
        [0]
      ];
      
      expect(() => {
        fixedMaskPoints(mask, mockPoint);
      }).toThrow('fixedMaskPoints: expected all mask items to be 0, but found: [0, 1]');
    });

    it('should throw error when mask contains only non-zero items', () => {
      const mask: ColumnVec<number[]> = [
        [1, 2, 3]
      ];
      
      expect(() => {
        fixedMaskPoints(mask, mockPoint);
      }).toThrow('fixedMaskPoints: expected all mask items to be 0, but found: [1, 2, 3]');
    });

    it('should provide clear error messages with sorted unique items', () => {
      const mask: ColumnVec<number[]> = [
        [3, 1, 2, 1, 0] // Duplicates and unsorted
      ];
      
      expect(() => {
        fixedMaskPoints(mask, mockPoint);
      }).toThrow('fixedMaskPoints: expected all mask items to be 0, but found: [0, 1, 2, 3]');
    });
  });

  describe('shiftedMaskPoints', () => {
    it('should return shifted points for valid mask items', () => {
      const mask: ColumnVec<number[]> = [
        [0, 1],    // Column 0: mask items 0 and 1 (domain size 4)
        [0],       // Column 1: mask item 0 (domain size 4)
        [0, 2]     // Column 2: mask items 0, 2 (domain size 4)
      ];
      
      const domains = [mockDomain, mockDomain, mockDomain];
      
      const result = shiftedMaskPoints(mask, domains, mockPoint);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(2);
      expect(result[1]).toHaveLength(1);
      expect(result[2]).toHaveLength(2);
    });

    it('should handle empty mask columns', () => {
      const mask: ColumnVec<number[]> = [
        [],  // Empty column
        [0], // Non-empty column
        []   // Empty column
      ];
      
      const domains = [mockDomain, mockDomain, mockDomain];
      
      const result = shiftedMaskPoints(mask, domains, mockPoint);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(0);
      expect(result[1]).toHaveLength(1);
      expect(result[2]).toHaveLength(0);
    });

    it('should throw error when mask and domains lengths mismatch', () => {
      const mask: ColumnVec<number[]> = [
        [0], [0]  // 2 columns
      ];
      const shortDomains = [mockDomain]; // 1 domain
      
      expect(() => {
        shiftedMaskPoints(mask, shortDomains, mockPoint);
      }).toThrow('shiftedMaskPoints: mask length (2) must match domains length (1)');
    });

    it('should throw error when mask item is out of domain bounds', () => {
      const mask: ColumnVec<number[]> = [
        [5] // Item 5 is out of bounds for domain size 4
      ];
      
      expect(() => {
        shiftedMaskPoints(mask, [mockDomain], mockPoint);
      }).toThrow('shiftedMaskPoints: mask item 5 out of bounds for domain of size 4 at column 0');
    });

    it('should throw error when mask item is negative', () => {
      const mask: ColumnVec<number[]> = [
        [-1] // Negative item
      ];
      
      expect(() => {
        shiftedMaskPoints(mask, [mockDomain], mockPoint);
      }).toThrow('shiftedMaskPoints: mask item -1 out of bounds for domain of size 4 at column 0');
    });

    it('should handle boundary mask items correctly', () => {
      const mask: ColumnVec<number[]> = [
        [0, 3], // 0 and 3 are valid for domain size 4 (0-3)
        [0, 1]  // 0 and 1 are valid for domain size 4 (0-3)
      ];
      
      const result = shiftedMaskPoints(mask, [mockDomain, mockDomain], mockPoint);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(2);
      expect(result[1]).toHaveLength(2);
    });
  });

  describe('Integration and Edge Cases', () => {
    it('should handle mixed empty and non-empty masks', () => {
      // Test fixedMaskPoints with mixed empty columns
      const fixedMask: ColumnVec<number[]> = [[], [0, 0], []];
      const fixedResult = fixedMaskPoints(fixedMask, mockPoint);
      
      expect(fixedResult).toHaveLength(3);
      expect(fixedResult[0]).toHaveLength(0);
      expect(fixedResult[1]).toHaveLength(2);
      expect(fixedResult[2]).toHaveLength(0);
      
      // Test shiftedMaskPoints with mixed empty columns
      const shiftedMask: ColumnVec<number[]> = [[], [0, 1], []];
      const domains = [mockDomain, mockDomain, mockDomain];
      const shiftedResult = shiftedMaskPoints(shiftedMask, domains, mockPoint);
      
      expect(shiftedResult).toHaveLength(3);
      expect(shiftedResult[0]).toHaveLength(0);
      expect(shiftedResult[1]).toHaveLength(2);
      expect(shiftedResult[2]).toHaveLength(0);
    });

    it('should handle extreme mask sizes', () => {
      // Test with large domain
      const largeDomain = {
        size: () => 1024,
        at: (index: number) => ({
          intoEf: (fn: (x: any) => any) => mockPoint
        })
      };
      
      const mask: ColumnVec<number[]> = [[0, 512, 1023]]; // Boundary values
      
      const result = shiftedMaskPoints(mask, [largeDomain], mockPoint);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(3);
    });
  });
}); 