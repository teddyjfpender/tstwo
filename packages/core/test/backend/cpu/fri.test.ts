import { describe, it, expect } from 'vitest';
import { 
  foldLine, 
  foldCircleIntoLine, 
  decompose,
  CpuFriOps 
} from '../../../src/backend/cpu/fri';
import { LineDomain, LineEvaluation } from '../../../src/poly/line';
import { CanonicCoset } from '../../../src/poly/circle/canonic';
import { SecureEvaluation, type BitReversedOrder } from '../../../src/poly/circle';
import { SecureColumnByCoords } from '../../../src/fields/secure_columns';
import { QM31 as SecureField } from '../../../src/fields/qm31';
import { M31 } from '../../../src/fields/m31';
import { Coset } from '../../../src/circle';
import { CpuBackend } from '../../../src/backend/cpu/index';

// Helper function to create SecureField from number
function sf(n: number): SecureField {
  return SecureField.from(M31.from(n));
}

// Mock implementations for testing
class MockCircleDomain {
  constructor(private _logSize: number) {}
  
  log_size(): number {
    return this._logSize;
  }
  
  size(): number {
    return 1 << this._logSize;
  }
}

class MockSecureEvaluation {
  constructor(
    public domain: MockCircleDomain,
    public values: SecureColumnByCoords
  ) {}
}

describe('CPU FRI Operations', () => {
  describe('decompose function', () => {
    it('should decompose evaluation correctly', () => {
      const domain = new MockCircleDomain(2); // 4 elements
      const values = SecureColumnByCoords.from([
        sf(5), sf(7), sf(11), sf(13)
      ]);
      
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g, lambda] = decompose(evalObj);
      
      // Verify lambda calculation
      // aSum = sf(5) + sf(7) = first half
      // bSum = sf(11) + sf(13) = second half
      // lambda = (aSum - bSum) / 4
      const aSum = sf(5).add(sf(7));
      const bSum = sf(11).add(sf(13));
      const expectedLambda = aSum.sub(bSum).divM31(M31.from(4));
      
      expect(lambda.equals(expectedLambda)).toBe(true);
      
      // Verify g values
      expect(g.values.len()).toBe(4);
      
      // First half: subtract lambda
      expect(g.values.at(0).equals(sf(5).sub(lambda))).toBe(true);
      expect(g.values.at(1).equals(sf(7).sub(lambda))).toBe(true);
      
      // Second half: add lambda
      expect(g.values.at(2).equals(sf(11).add(lambda))).toBe(true);
      expect(g.values.at(3).equals(sf(13).add(lambda))).toBe(true);
    });

    it('should handle zero values', () => {
      const domain = new MockCircleDomain(1); // 2 elements
      const values = SecureColumnByCoords.from([
        SecureField.zero(), SecureField.zero()
      ]);
      
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g, lambda] = decompose(evalObj);
      
      // With all zeros, lambda should be zero
      expect(lambda.equals(SecureField.zero())).toBe(true);
      
      // g values should also be zero
      expect(g.values.at(0).equals(SecureField.zero())).toBe(true);
      expect(g.values.at(1).equals(SecureField.zero())).toBe(true);
    });

    it('should handle single element', () => {
      const domain = new MockCircleDomain(0); // 1 element
      const values = SecureColumnByCoords.from([sf(42)]);
      
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g, lambda] = decompose(evalObj);
      
      // With single element (domain size = 1):
      // First half has 0.5 elements (rounds to 0), second half has 0.5 elements (rounds to 1)
      // In practice, half = 0, so aSum = 0, bSum = sf(42)
      // lambda = (0 - sf(42)) / 1 = -sf(42)
      const expectedLambda = SecureField.zero().sub(sf(42));
      expect(lambda.equals(expectedLambda)).toBe(true);
      
      // g should have the original value minus lambda = sf(42) - (-sf(42)) = 2*sf(42)
      expect(g.values.at(0).equals(sf(42).sub(lambda))).toBe(true);
    });

    it('should validate domain size mismatch', () => {
      const domain = new MockCircleDomain(2); // Claims 4 elements
      const values = SecureColumnByCoords.from([sf(1), sf(2)]); // Only 2 elements
      
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      expect(() => decompose(evalObj)).toThrow('Domain size mismatch');
    });
  });

  describe('CpuFriOps class', () => {
    it('should implement singleton pattern', () => {
      const instance1 = CpuFriOps.getInstance();
      const instance2 = CpuFriOps.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should not allow direct construction', () => {
      expect(() => new (CpuFriOps as any)()).toThrow();
    });

    it('should provide decompose method', () => {
      const ops = CpuFriOps.getInstance();
      const domain = new MockCircleDomain(1);
      const values = SecureColumnByCoords.from([sf(1), sf(2)]);
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g, lambda] = ops.decompose(evalObj);
      
      expect(g).toBeDefined();
      expect(lambda).toBeDefined();
    });
  });

  describe('CpuBackend integration', () => {
    it('should extend CpuBackend with friOps', () => {
      const backend = new CpuBackend();
      
      expect(backend.friOps).toBeDefined();
      expect(backend.friOps).toBeInstanceOf(CpuFriOps);
      expect(backend.friOps).toBe(CpuFriOps.getInstance());
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle large evaluations', () => {
      const domain = new MockCircleDomain(8); // 256 elements
      const values = SecureColumnByCoords.from(
        Array.from({ length: 256 }, (_, i) => sf(i + 1))
      );
      
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g, lambda] = decompose(evalObj);
      
      expect(g.values.len()).toBe(256);
      expect(lambda).toBeDefined();
    });

    it('should handle alternating pattern', () => {
      const domain = new MockCircleDomain(2); // 4 elements
      const values = SecureColumnByCoords.from([
        sf(1), sf(-1), sf(1), sf(-1)
      ]);
      
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g, lambda] = decompose(evalObj);
      
      // First half sum: 1 + (-1) = 0
      // Second half sum: 1 + (-1) = 0
      // lambda = (0 - 0) / 4 = 0
      expect(lambda.equals(SecureField.zero())).toBe(true);
    });

    it('should produce deterministic results', () => {
      const domain = new MockCircleDomain(2);
      const values = SecureColumnByCoords.from([sf(1), sf(2), sf(3), sf(4)]);
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g1, lambda1] = decompose(evalObj);
      const [g2, lambda2] = decompose(evalObj);
      
      expect(lambda1.equals(lambda2)).toBe(true);
      expect(g1.values.len()).toBe(g2.values.len());
      
      for (let i = 0; i < g1.values.len(); i++) {
        expect(g1.values.at(i).equals(g2.values.at(i))).toBe(true);
      }
    });
  });

  describe('mathematical properties', () => {
    it('should satisfy decomposition property', () => {
      const domain = new MockCircleDomain(2);
      const values = SecureColumnByCoords.from([sf(10), sf(20), sf(30), sf(40)]);
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g, lambda] = decompose(evalObj);
      
      // Verify that reconstruction works
      // First half: g[i] + lambda should equal original[i]
      expect(g.values.at(0).add(lambda).equals(sf(10))).toBe(true);
      expect(g.values.at(1).add(lambda).equals(sf(20))).toBe(true);
      
      // Second half: g[i] - lambda should equal original[i]
      expect(g.values.at(2).sub(lambda).equals(sf(30))).toBe(true);
      expect(g.values.at(3).sub(lambda).equals(sf(40))).toBe(true);
    });

    it('should handle maximum field values', () => {
      const maxM31 = M31.from(0x7fffffff);
      const maxSecure = SecureField.from(maxM31);
      
      const domain = new MockCircleDomain(1);
      const values = SecureColumnByCoords.from([maxSecure, maxSecure]);
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const [g, lambda] = decompose(evalObj);
      
      expect(g).toBeDefined();
      expect(lambda).toBeDefined();
      // Should not overflow or throw
    });
  });

  describe('performance characteristics', () => {
    it('should handle decomposition efficiently', () => {
      const domain = new MockCircleDomain(10); // 1024 elements
      const values = SecureColumnByCoords.from(
        Array.from({ length: 1024 }, (_, i) => sf(i))
      );
      const evalObj = new MockSecureEvaluation(domain, values) as any;
      
      const start = performance.now();
      const [g, lambda] = decompose(evalObj);
      const end = performance.now();
      
      expect(g.values.len()).toBe(1024);
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });
  });
});
