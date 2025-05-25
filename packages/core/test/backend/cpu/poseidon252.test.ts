import { describe, it, expect } from "vitest";
import { CpuPoseidon252MerkleOps } from "../../../src/backend/cpu/poseidon252";
import { Poseidon252MerkleHasher } from "../../../src/vcs/poseidon252_merkle";
import { FieldElement252 } from "../../../src/channel/poseidon";
import { M31 } from "../../../src/fields/m31";
import { CpuBackend } from "../../../src/backend/cpu/index";

describe("CpuPoseidon252MerkleOps", () => {
  describe("singleton pattern", () => {
    it("should return the same instance", () => {
      const instance1 = CpuPoseidon252MerkleOps.getInstance();
      const instance2 = CpuPoseidon252MerkleOps.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should not allow direct construction", () => {
      expect(() => new (CpuPoseidon252MerkleOps as any)()).toThrow();
    });
  });

  describe("commitOnLayer", () => {
    it("should commit leaf layer with single column", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const logSize = 0; // Single node
      const columns = [[M31.from(42)]];
      
      const result = ops.commitOnLayer(logSize, undefined, columns);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(FieldElement252);
      
      // Verify it matches direct hasher call
      const hasher = new Poseidon252MerkleHasher();
      const expected = hasher.hashNode(undefined, [M31.from(42)]);
      expect(result[0]!.equals(expected)).toBe(true);
    });

    it("should commit leaf layer with multiple columns", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const logSize = 1; // Two nodes
      const columns = [
        [M31.from(1), M31.from(2)], // Column 0
        [M31.from(3), M31.from(4)], // Column 1
        [M31.from(5), M31.from(6)]  // Column 2
      ];
      
      const result = ops.commitOnLayer(logSize, undefined, columns);
      
      expect(result).toHaveLength(2);
      
      // Verify first node
      const hasher = new Poseidon252MerkleHasher();
      const expected0 = hasher.hashNode(undefined, [M31.from(1), M31.from(3), M31.from(5)]);
      expect(result[0]!.equals(expected0)).toBe(true);
      
      // Verify second node
      const expected1 = hasher.hashNode(undefined, [M31.from(2), M31.from(4), M31.from(6)]);
      expect(result[1]!.equals(expected1)).toBe(true);
    });

    it("should commit internal layer with previous hashes", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      
      // First create a leaf layer
      const leafColumns = [[M31.from(1), M31.from(2), M31.from(3), M31.from(4)]];
      const leafLayer = ops.commitOnLayer(2, undefined, leafColumns);
      expect(leafLayer).toHaveLength(4);
      
      // Now create internal layer
      const logSize = 1; // Two nodes in internal layer
      const columns: (readonly M31[])[] = []; // No additional columns for internal nodes
      
      const result = ops.commitOnLayer(logSize, leafLayer, columns);
      
      expect(result).toHaveLength(2);
      
      // Verify first internal node (combines leafLayer[0] and leafLayer[1])
      const hasher = new Poseidon252MerkleHasher();
      const expected0 = hasher.hashNode([leafLayer[0]!, leafLayer[1]!], []);
      expect(result[0]!.equals(expected0)).toBe(true);
      
      // Verify second internal node (combines leafLayer[2] and leafLayer[3])
      const expected1 = hasher.hashNode([leafLayer[2]!, leafLayer[3]!], []);
      expect(result[1]!.equals(expected1)).toBe(true);
    });

    it("should commit internal layer with both hashes and columns", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      
      // Create previous layer hashes
      const prevLayer = [
        FieldElement252.from(0x123n),
        FieldElement252.from(0x456n),
        FieldElement252.from(0x789n),
        FieldElement252.from(0xabcn)
      ];
      
      // Additional column data for internal nodes
      const columns = [[M31.from(10), M31.from(20)]];
      
      const result = ops.commitOnLayer(1, prevLayer, columns);
      
      expect(result).toHaveLength(2);
      
      // Verify first node combines prevLayer[0], prevLayer[1] and column value 10
      const hasher = new Poseidon252MerkleHasher();
      const expected0 = hasher.hashNode([prevLayer[0]!, prevLayer[1]!], [M31.from(10)]);
      expect(result[0]!.equals(expected0)).toBe(true);
      
      // Verify second node combines prevLayer[2], prevLayer[3] and column value 20
      const expected1 = hasher.hashNode([prevLayer[2]!, prevLayer[3]!], [M31.from(20)]);
      expect(result[1]!.equals(expected1)).toBe(true);
    });

    it("should handle empty columns", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const logSize = 0;
      const columns: (readonly M31[])[] = [];
      
      const result = ops.commitOnLayer(logSize, undefined, columns);
      
      expect(result).toHaveLength(1);
      
      // Should match hasher with empty column values
      const hasher = new Poseidon252MerkleHasher();
      const expected = hasher.hashNode(undefined, []);
      expect(result[0]!.equals(expected)).toBe(true);
    });

    it("should handle large number of columns", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const logSize = 0;
      
      // Create 20 columns (more than the 8-element block size)
      const columns = Array.from({ length: 20 }, (_, i) => [M31.from(i + 1)]);
      
      const result = ops.commitOnLayer(logSize, undefined, columns);
      
      expect(result).toHaveLength(1);
      
      // Verify it matches direct hasher call
      const hasher = new Poseidon252MerkleHasher();
      const columnValues = columns.map(col => col[0]!);
      const expected = hasher.hashNode(undefined, columnValues);
      expect(result[0]!.equals(expected)).toBe(true);
    });
  });

  describe("input validation", () => {
    it("should validate logSize bounds", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      
      expect(() => ops.commitOnLayer(-1, undefined, [])).toThrow("Invalid logSize: -1");
      expect(() => ops.commitOnLayer(33, undefined, [])).toThrow("Invalid logSize: 33");
    });

    it("should validate column lengths", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const logSize = 1; // Expects 2 nodes
      const shortColumn = [M31.from(1)]; // Only 1 element, needs 2
      
      expect(() => ops.commitOnLayer(logSize, undefined, [shortColumn]))
        .toThrow("Column too short: index 1 >= length 1");
    });

    it("should validate prevLayer length for internal nodes", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const logSize = 1; // Expects 2 nodes, needs 4 previous hashes
      const shortPrevLayer = [FieldElement252.from(1n)]; // Only 1 hash, needs 4
      
      expect(() => ops.commitOnLayer(logSize, shortPrevLayer, []))
        .toThrow(); // Should throw when accessing prevLayer[2] or prevLayer[3]
    });
  });

  describe("static methods", () => {
    it("should provide static commitOnLayer method", () => {
      const logSize = 0;
      const columns = [[M31.from(123)]];
      
      const result = CpuPoseidon252MerkleOps.commitOnLayer(logSize, undefined, columns);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(FieldElement252);
    });
  });

  describe("CpuBackend integration", () => {
    it("should extend CpuBackend with poseidon252MerkleOps", () => {
      const backend = new CpuBackend();
      
      expect(backend.poseidon252MerkleOps).toBeDefined();
      expect(backend.poseidon252MerkleOps).toBeInstanceOf(CpuPoseidon252MerkleOps);
      expect(backend.poseidon252MerkleOps).toBe(CpuPoseidon252MerkleOps.getInstance());
    });
  });

  describe("performance characteristics", () => {
    it("should handle large layers efficiently", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const logSize = 10; // 1024 nodes
      const columns = [Array.from({ length: 1024 }, (_, i) => M31.from(i))];
      
      const start = performance.now();
      const result = ops.commitOnLayer(logSize, undefined, columns);
      const end = performance.now();
      
      expect(result).toHaveLength(1024);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should reuse hasher instance for performance", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      
      // Multiple calls should reuse the same ops instance
      const result1 = ops.commitOnLayer(0, undefined, [[M31.from(1)]]);
      const result2 = ops.commitOnLayer(0, undefined, [[M31.from(2)]]);
      
      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result1[0]!.equals(result2[0]!)).toBe(false); // Different inputs, different outputs
    });
  });

  describe("edge cases", () => {
    it("should handle zero field elements", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const columns = [[M31.zero(), M31.zero()], [M31.zero(), M31.zero()]];
      
      const result = ops.commitOnLayer(1, undefined, columns);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(FieldElement252);
      expect(result[1]).toBeInstanceOf(FieldElement252);
    });

    it("should handle maximum field elements", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const maxM31 = M31.from(0x7fffffff); // Maximum 31-bit value
      const columns = [[maxM31]];
      
      const result = ops.commitOnLayer(0, undefined, columns);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(FieldElement252);
    });

    it("should produce deterministic results", () => {
      const ops = CpuPoseidon252MerkleOps.getInstance();
      const columns = [[M31.from(42), M31.from(84)]];
      
      const result1 = ops.commitOnLayer(1, undefined, columns);
      const result2 = ops.commitOnLayer(1, undefined, columns);
      
      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(2);
      expect(result1[0]!.equals(result2[0]!)).toBe(true);
      expect(result1[1]!.equals(result2[1]!)).toBe(true);
    });
  });
}); 