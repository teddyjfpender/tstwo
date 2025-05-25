import { describe, it, expect } from "vitest";
import { CircleDomain } from "../../../src/poly/circle/domain";
import { CanonicCoset } from "../../../src/poly/circle/canonic";
import { Coset, CirclePointIndex } from "../../../src/circle";

describe("CircleDomain Tests", () => {
  describe("test_circle_domain_iterator", () => {
    it("should iterate over domain points correctly", () => {
      const domain = CircleDomain.new(Coset.new(CirclePointIndex.generator(), 2));
      const points = Array.from(domain.iter());
      
      expect(points).toHaveLength(8); // 2^(2+1) = 8 points
      
      // Test that we get the expected number of points from each half
      // The first 4 points come from the half coset, the next 4 from its conjugate
      const firstHalf = points.slice(0, 4);
      const secondHalf = points.slice(4, 8);
      
      expect(firstHalf).toHaveLength(4);
      expect(secondHalf).toHaveLength(4);
      
      // Verify iteration matches Rust behavior: first half is C + iG_n, second half is conjugate coset
      for (let i = 0; i < 4; i++) {
        const expectedFirstIndex = CirclePointIndex.generator().add(CirclePointIndex.subgroup_gen(2).mul(i));
        expect(firstHalf[i]).toEqual(expectedFirstIndex.to_point());
      }
      
      // For the second half, it's the conjugate coset iteration
      for (let i = 0; i < 4; i++) {
        const expectedSecondIndex = CirclePointIndex.generator().neg().add(CirclePointIndex.subgroup_gen(2).mul(i));
        expect(secondHalf[i]).toEqual(expectedSecondIndex.to_point());
      }
    });
  });

  describe("is_canonic_invalid_domain", () => {
    it("should correctly identify non-canonic domains", () => {
      const halfCoset = Coset.new(CirclePointIndex.generator(), 4);
      const notCanonicDomain = CircleDomain.new(halfCoset);
      
      expect(notCanonicDomain.isCanonic()).toBe(false);
    });
  });

  describe("test_at_circle_domain", () => {
    it("should handle domain indexing correctly", () => {
      const domain = CanonicCoset.new(7).circleDomain();
      const halfDomainSize = domain.size() / 2;
      
      for (let i = 0; i < halfDomainSize; i++) {
        const index1 = domain.indexAt(i);
        const index2 = domain.indexAt(i + halfDomainSize);
        const point1 = domain.at(i);
        const point2 = domain.at(i + halfDomainSize);
        
        // The second half should be the negation of the first half
        expect(index1).toEqual(index2.neg());
        expect(point1).toEqual(point2.conjugate());
      }
    });
  });

  describe("test_domain_split", () => {
    it("should split domain correctly", () => {
      const domain = CanonicCoset.new(5).circleDomain();
      const [subdomain, shifts] = domain.split(2);
      
      expect(shifts).toHaveLength(4); // 2^2 = 4 shifts
      
      const domainPoints = Array.from(domain.iter());
      
      // Collect points from each shifted subdomain
      const pointsForEachDomain = shifts.map(shift => 
        Array.from(subdomain.shift(shift).iter())
      );
      
      // Verify that we have the right number of points in each subdomain
      pointsForEachDomain.forEach(subdomainPoints => {
        expect(subdomainPoints).toHaveLength(8); // 2^3 = 8 points per subdomain
      });
      
      // Verify that the total number of points across all subdomains covers the original domain
      const totalSubdomainPoints = pointsForEachDomain.flat();
      expect(totalSubdomainPoints).toHaveLength(32); // 4 subdomains * 8 points each
      
      // The original domain should have 32 points (2^5 = 32)
      expect(domainPoints).toHaveLength(32);
    });
  });

  describe("CircleDomain iteration", () => {
    it("should support for...of iteration", () => {
      const domain = CanonicCoset.new(2).circleDomain();
      const points: any[] = [];
      
      for (const point of domain) {
        points.push(point);
      }
      
      expect(points).toHaveLength(4); // 2^2 = 4 points
    });

    it("should iterate indices correctly", () => {
      const domain = CanonicCoset.new(2).circleDomain();
      const indices = Array.from(domain.iterIndices());
      
      expect(indices).toHaveLength(4); // 2^2 = 4 indices
      
      // Verify that each index corresponds to the correct point
      indices.forEach((index, i) => {
        expect(domain.indexAt(i)).toEqual(index);
        expect(domain.at(i)).toEqual(index.to_point());
      });
    });
  });

  describe("CircleDomain properties", () => {
    it("should calculate size and log_size correctly", () => {
      const domain = CanonicCoset.new(4).circleDomain();
      
      expect(domain.logSize()).toBe(4);
      expect(domain.log_size()).toBe(4); // Rust-style alias
      expect(domain.size()).toBe(16); // 2^4 = 16
    });

    it("should handle shift operations", () => {
      const domain = CanonicCoset.new(3).circleDomain();
      const shift = CirclePointIndex.generator();
      const shiftedDomain = domain.shift(shift);
      
      expect(shiftedDomain).toBeInstanceOf(CircleDomain);
      expect(shiftedDomain.logSize()).toBe(domain.logSize());
      expect(shiftedDomain.size()).toBe(domain.size());
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty split correctly", () => {
      const domain = CanonicCoset.new(3).circleDomain();
      const [subdomain, shifts] = domain.split(0);
      
      expect(shifts).toHaveLength(1); // 2^0 = 1 shift
      expect(subdomain.logSize()).toBe(domain.logSize());
      expect(Array.from(subdomain.iter())).toEqual(Array.from(domain.iter()));
    });

    it("should handle maximum split correctly", () => {
      const domain = CanonicCoset.new(4).circleDomain();
      const maxLogParts = domain.halfCoset.log_size;
      const [subdomain, shifts] = domain.split(maxLogParts);
      
      expect(shifts).toHaveLength(1 << maxLogParts);
      expect(subdomain.logSize()).toBe(1); // Minimum domain size
    });
  });
}); 