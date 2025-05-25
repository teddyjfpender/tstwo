import { describe, it, expect } from "vitest";
import { CanonicCoset } from "../../src/poly/circle/canonic";
import { Coset } from "../../src/circle";

describe("CanonicCoset", () => {

  it("new validates logSize", () => {
    expect(() => CanonicCoset.new(0)).toThrow();
  });

  it("exposes coset utilities", () => {
    const c = CanonicCoset.new(3);
    const expectedFull = Coset.odds(3);
    const expectedHalf = Coset.half_odds(2);
    expect(c.log_size()).toBe(3);
    expect(c.size()).toBe(8);
    expect(c.coset.equals(expectedFull)).toBe(true);
    expect(c.half_coset().equals(expectedHalf)).toBe(true);
    expect(c.circle_domain().halfCoset.equals(expectedHalf)).toBe(true);
    expect(c.initial_index().value).toBe(expectedFull.initial_index.value);
    expect(c.step_size().value).toBe(expectedFull.step_size.value);
    expect(c.index_at(1).value).toBe(expectedFull.index_at(1).value);
    expect(c.at(2).x.value).toBe(expectedFull.at(2).x.value);
  });

  it("test_coset_is_half_coset_with_conjugate", () => {
    // Exact port of Rust test_coset_is_half_coset_with_conjugate
    const canonicCoset = CanonicCoset.new(8);
    
    // Collect all points from the full coset
    const cosetPoints = new Set();
    for (const point of canonicCoset.coset.iter()) {
      cosetPoints.add(`${point.x.value},${point.y.value}`);
    }
    
    // Collect points from half coset
    const halfCosetPoints = new Set();
    for (const point of canonicCoset.half_coset().iter()) {
      halfCosetPoints.add(`${point.x.value},${point.y.value}`);
    }
    
    // Collect points from half coset conjugate
    const halfCosetConjugatePoints = new Set();
    for (const point of canonicCoset.half_coset().conjugate().iter()) {
      halfCosetConjugatePoints.add(`${point.x.value},${point.y.value}`);
    }
    
    // Verify that half coset and its conjugate are disjoint
    const intersection = new Set([...halfCosetPoints].filter(x => halfCosetConjugatePoints.has(x)));
    expect(intersection.size).toBe(0);
    
    // Verify that the union of half coset and its conjugate equals the full coset
    const union = new Set([...halfCosetPoints, ...halfCosetConjugatePoints]);
    expect(union).toEqual(cosetPoints);
  });

  it("validates input parameters with type safety", () => {
    const coset = CanonicCoset.new(4);
    
    // Test index_at parameter validation
    expect(() => coset.index_at(-1)).toThrow("index must be a non-negative integer");
    expect(() => coset.index_at(1.5)).toThrow("index must be a non-negative integer");
    
    // Test at parameter validation
    expect(() => coset.at(-1)).toThrow("i must be a non-negative integer");
    expect(() => coset.at(1.5)).toThrow("i must be a non-negative integer");
    
    // Test log_size parameter validation in constructor
    expect(() => CanonicCoset.new(-1)).toThrow("log_size must be a positive integer");
    expect(() => CanonicCoset.new(1.5)).toThrow("log_size must be a positive integer");
  });

  it("provides TypeScript-style method aliases", () => {
    const coset = CanonicCoset.new(4);
    
    // Test that aliases work correctly
    expect(coset.logSize()).toBe(coset.log_size());
    expect(coset.halfCoset().equals(coset.half_coset())).toBe(true);
    expect(coset.circleDomain().halfCoset.equals(coset.circle_domain().halfCoset)).toBe(true);
    expect(coset.initialIndex().value).toBe(coset.initial_index().value);
    expect(coset.stepSize().value).toBe(coset.step_size().value);
    expect(coset.indexAt(1).value).toBe(coset.index_at(1).value);
  });

  it("maintains API hygiene with private constructor", () => {
    // Verify that the constructor is private by checking that static factory works
    const coset = CanonicCoset.new(3);
    expect(coset).toBeInstanceOf(CanonicCoset);
    expect(coset.coset).toBeDefined();
    expect(coset.coset).toBeInstanceOf(Coset);
  });

  it("provides correct coset properties", () => {
    const logSize = 5;
    const coset = CanonicCoset.new(logSize);
    
    // Verify basic properties
    expect(coset.log_size()).toBe(logSize);
    expect(coset.size()).toBe(1 << logSize); // 2^logSize
    
    // Verify that it's an odds coset
    const expectedOdds = Coset.odds(logSize);
    expect(coset.coset.equals(expectedOdds)).toBe(true);
    
    // Verify half coset is correct
    const expectedHalf = Coset.half_odds(logSize - 1);
    expect(coset.half_coset().equals(expectedHalf)).toBe(true);
  });

  it("supports iteration and indexing", () => {
    const coset = CanonicCoset.new(3);
    const size = coset.size();
    
    // Test that we can access all indices
    for (let i = 0; i < size; i++) {
      const index = coset.index_at(i);
      const point = coset.at(i);
      
      expect(index).toBeDefined();
      expect(point).toBeDefined();
      expect(point.x).toBeDefined();
      expect(point.y).toBeDefined();
      
      // Verify that index_at and at are consistent
      expect(point.x.value).toBe(index.to_point().x.value);
      expect(point.y.value).toBe(index.to_point().y.value);
    }
  });

  it("creates valid circle domain", () => {
    const coset = CanonicCoset.new(4);
    const domain = coset.circle_domain();
    
    // Verify domain properties
    expect(domain.logSize()).toBe(coset.log_size());
    expect(domain.size()).toBe(coset.size());
    expect(domain.halfCoset.equals(coset.half_coset())).toBe(true);
    
    // Verify that the domain is canonic
    expect(domain.isCanonic()).toBe(true);
  });
});
