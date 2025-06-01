import { describe, it, expect } from "vitest";
import { M31, P } from "../../packages/core/src/fields/m31";
import fs from "fs";
import path from "path";

// Load test vectors
const testVectorsPath = path.join(__dirname, "../../test-vectors/m31-test-vectors.json");
const testVectorsData = JSON.parse(fs.readFileSync(testVectorsPath, "utf8"));

interface TestVector {
  operation: string;
  inputs: Record<string, any>;
  intermediates: Record<string, any>;
  output: any;
}

interface M31TestVectors {
  description: string;
  field_modulus: number;
  test_vectors: TestVector[];
}

const testVectors: M31TestVectors = testVectorsData;

describe("M31 Test Vector Validation", () => {
  it("should have the correct field modulus", () => {
    expect(testVectors.field_modulus).toBe(P);
  });

  describe("Basic Operations", () => {
    const addVectors = testVectors.test_vectors.filter(v => v.operation === "add");
    const mulVectors = testVectors.test_vectors.filter(v => v.operation === "mul");
    const subVectors = testVectors.test_vectors.filter(v => v.operation === "sub");
    const negVectors = testVectors.test_vectors.filter(v => v.operation === "neg");

    it(`should pass all ${addVectors.length} addition test vectors`, () => {
      for (const vector of addVectors) {
        const a = M31.from_u32_unchecked(vector.inputs.a);
        const b = M31.from_u32_unchecked(vector.inputs.b);
        const result = a.add(b);
        expect(result.value).toBe(vector.output);
      }
    });

    it(`should pass all ${mulVectors.length} multiplication test vectors`, () => {
      for (const vector of mulVectors) {
        const a = M31.from_u32_unchecked(vector.inputs.a);
        const b = M31.from_u32_unchecked(vector.inputs.b);
        const result = a.mul(b);
        expect(result.value).toBe(vector.output);
        
        // Also verify intermediate values if available
        if (vector.intermediates.product_u64) {
          const expectedProduct = BigInt(vector.inputs.a) * BigInt(vector.inputs.b);
          expect(Number(expectedProduct)).toBe(vector.intermediates.product_u64);
        }
      }
    });

    it(`should pass all ${subVectors.length} subtraction test vectors`, () => {
      for (const vector of subVectors) {
        const a = M31.from_u32_unchecked(vector.inputs.a);
        const b = M31.from_u32_unchecked(vector.inputs.b);
        const result = a.sub(b);
        expect(result.value).toBe(vector.output);
        
        // Verify intermediate calculation
        if (vector.intermediates.intermediate_sum) {
          const expectedIntermediate = vector.inputs.a + P - vector.inputs.b;
          expect(expectedIntermediate).toBe(vector.intermediates.intermediate_sum);
        }
      }
    });

    it(`should pass all ${negVectors.length} negation test vectors`, () => {
      for (const vector of negVectors) {
        const a = M31.from_u32_unchecked(vector.inputs.a);
        const result = a.neg();
        expect(result.value).toBe(vector.output);
      }
    });
  });

  describe("Construction Methods", () => {
    const fromU32UncheckedVectors = testVectors.test_vectors.filter(v => v.operation === "from_u32_unchecked");
    const fromI32Vectors = testVectors.test_vectors.filter(v => v.operation === "from_i32");
    const fromU32Vectors = testVectors.test_vectors.filter(v => v.operation === "from_u32");

    it(`should pass all ${fromU32UncheckedVectors.length} from_u32_unchecked test vectors`, () => {
      for (const vector of fromU32UncheckedVectors) {
        const result = M31.from_u32_unchecked(vector.inputs.value);
        expect(result.value).toBe(vector.output);
      }
    });

    it(`should pass all ${fromI32Vectors.length} from_i32 test vectors`, () => {
      for (const vector of fromI32Vectors) {
        const result = M31.from(vector.inputs.value);
        expect(result.value).toBe(vector.output);
      }
    });

    it(`should pass all ${fromU32Vectors.length} from_u32 test vectors`, () => {
      for (const vector of fromU32Vectors) {
        const result = M31.from(vector.inputs.value);
        expect(result.value).toBe(vector.output);
      }
    });
  });

  describe("Reduction Operations", () => {
    const partialReduceVectors = testVectors.test_vectors.filter(v => v.operation === "partial_reduce");
    const reduceVectors = testVectors.test_vectors.filter(v => v.operation === "reduce");

    it(`should pass all ${partialReduceVectors.length} partial_reduce test vectors`, () => {
      for (const vector of partialReduceVectors) {
        const result = M31.partialReduce(vector.inputs.value);
        expect(result.value).toBe(vector.output);
      }
    });

    it(`should pass all ${reduceVectors.length} reduce test vectors`, () => {
      for (const vector of reduceVectors) {
        // Handle both string and number inputs for large values
        const inputValue = typeof vector.inputs.value === 'string' 
          ? BigInt(vector.inputs.value) 
          : BigInt(vector.inputs.value);
        
        const result = M31.reduce(inputValue);
        expect(result.value).toBe(vector.output);
        
        // Verify intermediate steps of the reduction algorithm
        if (vector.intermediates.shifted1 !== undefined) {
          const val = inputValue;
          const shifted1 = val >> 31n;
          expect(Number(shifted1)).toBe(vector.intermediates.shifted1);
          
          const step1 = shifted1 + val + 1n;
          const expectedStep1 = typeof vector.intermediates.step1 === 'string' 
            ? BigInt(vector.intermediates.step1) 
            : BigInt(vector.intermediates.step1);
          expect(step1).toBe(expectedStep1);
          
          const shifted2 = step1 >> 31n;
          expect(Number(shifted2)).toBe(vector.intermediates.shifted2);
          
          const step2 = shifted2 + val;
          const expectedStep2 = typeof vector.intermediates.step2 === 'string' 
            ? BigInt(vector.intermediates.step2) 
            : BigInt(vector.intermediates.step2);
          expect(step2).toBe(expectedStep2);
        }
      }
    });
  });

  describe("Inverse Operations", () => {
    const inverseVectors = testVectors.test_vectors.filter(v => v.operation === "inverse");
    const pow2147483645Vectors = testVectors.test_vectors.filter(v => v.operation === "pow2147483645");

    it(`should pass all ${inverseVectors.length} inverse test vectors`, () => {
      for (const vector of inverseVectors) {
        const value = M31.from_u32_unchecked(vector.inputs.value);
        const result = value.inverse();
        expect(result.value).toBe(vector.output);
        
        // Verify that inverse * value = 1
        if (vector.intermediates.verification_product !== undefined) {
          const verification = result.mul(value);
          expect(verification.value).toBe(vector.intermediates.verification_product);
          expect(verification.value).toBe(1); // Should always be 1
        }
      }
    });

    it(`should pass all ${pow2147483645Vectors.length} pow2147483645 test vectors`, () => {
      for (const vector of pow2147483645Vectors) {
        const value = M31.from_u32_unchecked(vector.inputs.value);
        // We need to import the pow2147483645 function
        const { pow2147483645 } = require("../../packages/core/src/fields/m31");
        const result = pow2147483645(value);
        expect(result.value).toBe(vector.output);
        
        // Verify that pow2147483645 gives the same result as inverse
        if (vector.intermediates.expected_inverse !== undefined) {
          expect(result.value).toBe(vector.intermediates.expected_inverse);
        }
      }
    });
  });

  describe("Slice Operations", () => {
    const intoSliceVectors = testVectors.test_vectors.filter(v => v.operation === "into_slice");

    it(`should pass all ${intoSliceVectors.length} into_slice test vectors`, () => {
      for (const vector of intoSliceVectors) {
        const elements = vector.inputs.elements.map((val: number) => M31.from_u32_unchecked(val));
        const result = M31.intoSlice(elements);
        const expectedBytes = vector.output as number[];
        
        expect(result.length).toBe(expectedBytes.length);
        for (let i = 0; i < result.length; i++) {
          expect(result[i]).toBe(expectedBytes[i]);
        }
      }
    });
  });

  describe("Edge Cases", () => {
    const zeroVectors = testVectors.test_vectors.filter(v => v.operation === "zero");
    const oneVectors = testVectors.test_vectors.filter(v => v.operation === "one");
    const isZeroVectors = testVectors.test_vectors.filter(v => v.operation === "is_zero");
    const complexConjugateVectors = testVectors.test_vectors.filter(v => v.operation === "complex_conjugate");

    it(`should pass all ${zeroVectors.length} zero test vectors`, () => {
      for (const vector of zeroVectors) {
        const result = M31.zero();
        expect(result.value).toBe(vector.output);
      }
    });

    it(`should pass all ${oneVectors.length} one test vectors`, () => {
      for (const vector of oneVectors) {
        const result = M31.one();
        expect(result.value).toBe(vector.output);
      }
    });

    it(`should pass all ${isZeroVectors.length} is_zero test vectors`, () => {
      for (const vector of isZeroVectors) {
        const value = M31.from_u32_unchecked(vector.inputs.value);
        const result = value.isZero();
        expect(result).toBe(vector.output);
      }
    });

    it(`should pass all ${complexConjugateVectors.length} complex_conjugate test vectors`, () => {
      for (const vector of complexConjugateVectors) {
        const value = M31.from_u32_unchecked(vector.inputs.value);
        const result = value.complexConjugate();
        expect(result.value).toBe(vector.output);
      }
    });
  });

  describe("Test Vector Statistics", () => {
    it("should report test vector counts", () => {
      const operationCounts = testVectors.test_vectors.reduce((acc, vector) => {
        acc[vector.operation] = (acc[vector.operation] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log("Test vector counts by operation:");
      Object.entries(operationCounts).forEach(([operation, count]) => {
        console.log(`  ${operation}: ${count}`);
      });

      expect(testVectors.test_vectors.length).toBeGreaterThan(0);
    });
  });
}); 