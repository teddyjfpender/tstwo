import { describe, it, expect, beforeEach } from "vitest";
import { Queries, QueryUtils, UPPER_BOUND_QUERY_BYTES } from "../../src/queries";
import type { QueryChannel } from "../../src/queries";
import { Blake2sChannel } from "../../src/channel/blake2";
import { CanonicCoset } from "../../src/poly/circle/canonic";
import { CirclePoint } from "../../src/circle";
import { bitReverseIndex } from "../../src/utils";
import { bitReverse } from "../../src/backend/cpu";

/**
 * Simple test channel implementation that provides small, predictable random bytes
 */
class TestQueryChannel implements QueryChannel {
  private counter = 0;
  
  draw_random_bytes(): Uint8Array {
    const arr = new Uint8Array(8); // Smaller array
    for (let i = 0; i < arr.length; i++) {
      arr[i] = (this.counter++ % 256);
    }
    return arr;
  }
}

/**
 * Mock channel that doesn't implement QueryChannel interface (for negative testing)
 */
class InvalidQueryChannel {
  // Missing required methods
}

/**
 * Bit reverse function for testing (mirrors Rust implementation)
 */
function bitReverseArray<T>(vals: T[]): T[] {
  const n = vals.length;
  const logN = Math.log2(n);
  const res = Array(n) as T[];
  for (let i = 0; i < n; i++) {
    const j = bitReverseIndex(i, logN);
    res[j] = vals[i]!;
  }
  return res;
}

describe("Queries", () => {
  let channel: TestQueryChannel;
  let blake2sChannel: Blake2sChannel;

  beforeEach(() => {
    channel = new TestQueryChannel();
    blake2sChannel = Blake2sChannel.create();
  });

  describe("Constants", () => {
    it("should have correct UPPER_BOUND_QUERY_BYTES value", () => {
      expect(UPPER_BOUND_QUERY_BYTES).toBe(4);
    });
  });

  describe("Factory methods and API hygiene", () => {
    it("should prevent direct construction", () => {
      expect(() => new (Queries as any)()).toThrow('Queries constructor is private');
    });

    it("should create queries via generate factory method", () => {
      const queries = Queries.generate(channel, 4, 3); // Much smaller
      expect(queries).toBeInstanceOf(Queries);
      expect(queries.length).toBe(3);
    });

    it("should create queries via fromPositions factory method", () => {
      const positions = [0, 1, 2];
      const queries = Queries.fromPositions(positions, 4);
      expect(queries).toBeInstanceOf(Queries);
      expect(queries.length).toBe(3);
      expect([...queries.positions]).toEqual(positions);
    });
  });

  describe("generate method (simplified)", () => {
    it("should generate correct number of unique sorted queries", () => {
      const logQuerySize = 8; // Much smaller
      const nQueries = 10; // Much smaller
      
      const queries = Queries.generate(blake2sChannel, logQuerySize, nQueries);
      
      expect(queries.length).toBe(nQueries);
      
      // Should be sorted
      const positions = [...queries.positions];
      const sorted = [...positions].sort((a, b) => a - b);
      expect(positions).toEqual(sorted);
      
      // Should be unique
      expect(new Set(positions).size).toBe(nQueries);
      
      // All positions should be within domain
      expect(Math.max(...positions)).toBeLessThan(1 << logQuerySize);
      expect(Math.min(...positions)).toBeGreaterThanOrEqual(0);
    });

    it("should work with small test cases", () => {
      const queries = Queries.generate(channel, 3, 2); // Very small
      expect(queries.length).toBe(2);
      
      const sorted = [...queries.positions].sort((a, b) => a - b);
      expect(queries.positions).toEqual(sorted);
      expect(new Set(queries.positions).size).toBe(2);
      expect(Math.max(...queries.positions)).toBeLessThan(8);
    });

    it("should handle edge cases", () => {
      // Single query
      const single = Queries.generate(channel, 2, 1);
      expect(single.length).toBe(1);
      
      // Zero queries
      const zero = Queries.generate(channel, 2, 0);
      expect(zero.length).toBe(0);
    });

    it("should validate parameters", () => {
      expect(() => Queries.generate(channel, -1, 1)).toThrow(TypeError);
      expect(() => Queries.generate(channel, 1.5, 1)).toThrow(TypeError);
      expect(() => Queries.generate(channel, 32, 1)).toThrow(TypeError);
      expect(() => Queries.generate(channel, 2, -1)).toThrow(TypeError);
      expect(() => Queries.generate(channel, 2, 1.5)).toThrow(TypeError);
    });
  });

  describe("fold method (simplified)", () => {
    it("should fold queries correctly", () => {
      // Very simple test case
      const queries = Queries.fromPositions([0, 1, 2, 3], 2);
      const folded = queries.fold(1);
      
      expect(folded.log_domain_size).toBe(1);
      expect(folded.length).toBeLessThanOrEqual(queries.length);
      
      // Verify that folded queries are sorted and unique
      const foldedPositions = [...folded.positions];
      const sortedFolded = [...foldedPositions].sort((a, b) => a - b);
      expect(foldedPositions).toEqual(sortedFolded);
      expect(new Set(foldedPositions).size).toBe(foldedPositions.length);
    });

    it("should validate fold parameters", () => {
      const queries = Queries.fromPositions([0, 1, 2, 3], 4);
      
      expect(() => queries.fold(-1)).toThrow(TypeError);
      expect(() => queries.fold(1.5)).toThrow(TypeError);
      expect(() => queries.fold(5)).toThrow('nFolds too large');
    });

    it("should handle edge fold cases", () => {
      const queries = Queries.fromPositions([0, 1, 2, 3], 4);
      
      // No folding
      const noFold = queries.fold(0);
      expect(noFold.positions).toEqual(queries.positions);
      expect(noFold.log_domain_size).toBe(queries.log_domain_size);
      
      // Maximum folding
      const maxFold = queries.fold(4);
      expect(maxFold.log_domain_size).toBe(0);
      expect(maxFold.positions).toEqual([0]);
    });
  });

  describe("fromPositions method", () => {
    it("should create queries from valid positions", () => {
      const positions = [0, 2, 4, 6];
      const queries = Queries.fromPositions(positions, 4);
      
      expect(queries.length).toBe(4);
      expect([...queries.positions]).toEqual(positions);
      expect(queries.log_domain_size).toBe(4);
    });

    it("should validate positions are sorted", () => {
      expect(() => Queries.fromPositions([2, 1, 3], 4)).toThrow('sorted in ascending order');
    });

    it("should validate positions are within domain", () => {
      expect(() => Queries.fromPositions([0, 1, 16], 4)).toThrow('Invalid position');
      expect(() => Queries.fromPositions([-1, 0, 1], 4)).toThrow('Invalid position');
    });

    it("should validate parameters", () => {
      expect(() => Queries.fromPositions([0, 1], -1)).toThrow(TypeError);
      expect(() => Queries.fromPositions([0, 1], 1.5)).toThrow(TypeError);
      expect(() => Queries.fromPositions([0, 1], 32)).toThrow(TypeError);
    });
  });

  describe("Properties and accessors", () => {
    it("should provide read-only access to positions", () => {
      const queries = Queries.fromPositions([0, 1, 2], 4);
      const positions = queries.positions;
      
      expect(positions).toEqual([0, 1, 2]);
      expect(positions).toBe(queries.positions);
      expect(Array.isArray(positions)).toBe(true);
      expect(positions.length).toBe(3);
    });

    it("should provide read-only access to log_domain_size", () => {
      const queries = Queries.fromPositions([0, 1, 2], 4);
      expect(queries.log_domain_size).toBe(4);
    });

    it("should provide correct length", () => {
      const queries = Queries.fromPositions([0, 1, 2], 4);
      expect(queries.length).toBe(3);
    });
  });

  describe("Iterator support", () => {
    it("should be iterable", () => {
      const queries = Queries.fromPositions([0, 1, 2], 4);
      const positions = [...queries];
      expect(positions).toEqual([0, 1, 2]);
    });
  });

  describe("Utility methods", () => {
    it("should clone correctly", () => {
      const original = Queries.fromPositions([0, 1, 2], 4);
      const cloned = original.clone();
      
      expect(cloned).not.toBe(original);
      expect(cloned.equals(original)).toBe(true);
    });

    it("should check equality correctly", () => {
      const queries1 = Queries.fromPositions([0, 1, 2], 4);
      const queries2 = Queries.fromPositions([0, 1, 2], 4);
      const queries3 = Queries.fromPositions([0, 1, 3], 4);
      
      expect(queries1.equals(queries2)).toBe(true);
      expect(queries1.equals(queries3)).toBe(false);
    });

    it("should serialize and deserialize correctly", () => {
      const original = Queries.fromPositions([0, 1, 2], 4);
      const json = original.toJSON();
      const restored = Queries.fromJSON(json);
      
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe("QueryUtils namespace", () => {
    describe("validateLogDomainSize", () => {
      it("should accept valid log domain sizes", () => {
        expect(() => QueryUtils.validateLogDomainSize(0)).not.toThrow();
        expect(() => QueryUtils.validateLogDomainSize(1)).not.toThrow();
        expect(() => QueryUtils.validateLogDomainSize(31)).not.toThrow();
      });

      it("should reject invalid log domain sizes", () => {
        expect(() => QueryUtils.validateLogDomainSize(-1)).toThrow(TypeError);
        expect(() => QueryUtils.validateLogDomainSize(1.5)).toThrow(TypeError);
        expect(() => QueryUtils.validateLogDomainSize(32)).toThrow(TypeError);
      });
    });

    describe("validateNQueries", () => {
      it("should accept valid n_queries", () => {
        expect(() => QueryUtils.validateNQueries(0)).not.toThrow();
        expect(() => QueryUtils.validateNQueries(1)).not.toThrow();
        expect(() => QueryUtils.validateNQueries(100)).not.toThrow();
      });

      it("should reject invalid n_queries", () => {
        expect(() => QueryUtils.validateNQueries(-1)).toThrow(TypeError);
        expect(() => QueryUtils.validateNQueries(1.5)).toThrow(TypeError);
      });
    });

    describe("isValidQueryChannel", () => {
      it("should return true for valid channels", () => {
        expect(QueryUtils.isValidQueryChannel(channel)).toBe(true);
        expect(QueryUtils.isValidQueryChannel(blake2sChannel)).toBe(true);
      });

      it("should return false for invalid channels", () => {
        expect(QueryUtils.isValidQueryChannel(null)).toBe(false);
        expect(QueryUtils.isValidQueryChannel({})).toBe(false);
        expect(QueryUtils.isValidQueryChannel(new InvalidQueryChannel())).toBe(false);
      });
    });

    describe("validateQueryChannel", () => {
      it("should not throw for valid channels", () => {
        expect(() => QueryUtils.validateQueryChannel(channel)).not.toThrow();
        expect(() => QueryUtils.validateQueryChannel(blake2sChannel)).not.toThrow();
      });

      it("should throw for invalid channels", () => {
        expect(() => QueryUtils.validateQueryChannel({} as any)).toThrow(TypeError);
      });
    });

    describe("constants", () => {
      it("should have correct constant values", () => {
        expect(QueryUtils.MAX_LOG_DOMAIN_SIZE).toBe(31);
        expect(QueryUtils.MIN_LOG_DOMAIN_SIZE).toBe(0);
      });
    });
  });

  describe("Type safety and error handling", () => {
    it("should handle type safety in constructor", () => {
      expect(() => Queries.fromPositions([0, 1, 2], NaN)).toThrow(TypeError);
      expect(() => Queries.fromPositions([0, 1, 2], Infinity)).toThrow(TypeError);
    });

    it("should validate all positions in constructor", () => {
      expect(() => Queries.fromPositions([0, NaN, 2], 4)).toThrow(TypeError);
      expect(() => Queries.fromPositions([0, Infinity, 2], 4)).toThrow(TypeError);
    });
  });

  describe("Integration with Blake2sChannel", () => {
    it("should work with real Blake2sChannel", () => {
      const queries = Queries.generate(blake2sChannel, 6, 5); // Small test
      
      expect(queries.length).toBe(5);
      expect(new Set(queries.positions).size).toBe(5);
      expect(Math.max(...queries.positions)).toBeLessThan(1 << 6);
    });
  });
});
