import { describe, it, expect } from "vitest";
import { CM31, P2 } from "../../packages/core/src/fields/cm31";
import { M31 } from "../../packages/core/src/fields/m31";
import fs from "fs";
import path from "path";

// Load test vectors
const testVectorsPath = path.join(__dirname, "../../test-vectors/cm31-test-vectors.json");
const testVectorsData = JSON.parse(fs.readFileSync(testVectorsPath, "utf8"));

interface TestVector {
  operation: string;
  inputs: Record<string, any>;
  intermediates: Record<string, any>;
  output: any;
}

interface CM31TestVectors {
  description: string;
  field_type: string;
  field_modulus: string;
  test_vectors: TestVector[];
}

const testVectors: CM31TestVectors = testVectorsData;

describe("CM31 Test Vector Validation", () => {
  it("should have the correct field modulus", () => {
    expect(BigInt(testVectors.field_modulus)).toBe(P2);
  });

  describe("Basic Operations", () => {
    const addVectors = testVectors.test_vectors.filter(v => v.operation === "add");
    const mulVectors = testVectors.test_vectors.filter(v => v.operation === "mul");
    const subVectors = testVectors.test_vectors.filter(v => v.operation === "sub");
    const negVectors = testVectors.test_vectors.filter(v => v.operation === "neg");

    it(`should pass all ${addVectors.length} addition test vectors`, () => {
      for (const vector of addVectors) {
        const a = CM31.from_u32_unchecked(vector.inputs.a_real, vector.inputs.a_imag);
        const b = CM31.from_u32_unchecked(vector.inputs.b_real, vector.inputs.b_imag);
        const result = a.add(b);
        
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
      }
    });

    it(`should pass all ${mulVectors.length} multiplication test vectors`, () => {
      for (const vector of mulVectors) {
        const a = CM31.from_u32_unchecked(vector.inputs.a_real, vector.inputs.a_imag);
        const b = CM31.from_u32_unchecked(vector.inputs.b_real, vector.inputs.b_imag);
        const result = a.mul(b);
        
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
        
        // Verify intermediate calculations if available
        if (vector.intermediates.ac !== undefined) {
          const ac = BigInt(vector.inputs.a_real) * BigInt(vector.inputs.b_real);
          const bd = BigInt(vector.inputs.a_imag) * BigInt(vector.inputs.b_imag);
          const ad = BigInt(vector.inputs.a_real) * BigInt(vector.inputs.b_imag);
          const bc = BigInt(vector.inputs.a_imag) * BigInt(vector.inputs.b_real);
          
          expect(Number(ac)).toBe(vector.intermediates.ac);
          expect(Number(bd)).toBe(vector.intermediates.bd);
          expect(Number(ad)).toBe(vector.intermediates.ad);
          expect(Number(bc)).toBe(vector.intermediates.bc);
        }
      }
    });

    it(`should pass all ${subVectors.length} subtraction test vectors`, () => {
      for (const vector of subVectors) {
        const a = CM31.from_u32_unchecked(vector.inputs.a_real, vector.inputs.a_imag);
        const b = CM31.from_u32_unchecked(vector.inputs.b_real, vector.inputs.b_imag);
        const result = a.sub(b);
        
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
      }
    });

    it(`should pass all ${negVectors.length} negation test vectors`, () => {
      for (const vector of negVectors) {
        const a = CM31.from_u32_unchecked(vector.inputs.real, vector.inputs.imag);
        const result = a.neg();
        
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
      }
    });
  });

  describe("Construction Methods", () => {
    const fromU32UncheckedVectors = testVectors.test_vectors.filter(v => v.operation === "from_u32_unchecked");

    it(`should pass all ${fromU32UncheckedVectors.length} from_u32_unchecked test vectors`, () => {
      for (const vector of fromU32UncheckedVectors) {
        const result = CM31.from_u32_unchecked(vector.inputs.real, vector.inputs.imag);
        
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
      }
    });
  });

  describe("Inverse Operations", () => {
    const inverseVectors = testVectors.test_vectors.filter(v => v.operation === "inverse");

    it(`should pass all ${inverseVectors.length} inverse test vectors`, () => {
      for (const vector of inverseVectors) {
        const value = CM31.from_u32_unchecked(vector.inputs.real, vector.inputs.imag);
        const result = value.inverse();
        
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
        
        // Verify that inverse * value = 1
        if (vector.intermediates.verification_real !== undefined) {
          const verification = result.mul(value);
          expect(verification.real.value).toBe(vector.intermediates.verification_real);
          expect(verification.imag.value).toBe(vector.intermediates.verification_imag);
          expect(verification.real.value).toBe(1); // Should always be 1
          expect(verification.imag.value).toBe(0); // Should always be 0
        }
      }
    });
  });

  describe("Complex Conjugate Operations", () => {
    const complexConjugateVectors = testVectors.test_vectors.filter(v => v.operation === "complex_conjugate");

    it(`should pass all ${complexConjugateVectors.length} complex_conjugate test vectors`, () => {
      for (const vector of complexConjugateVectors) {
        const value = CM31.from_u32_unchecked(vector.inputs.real, vector.inputs.imag);
        const result = value.complexConjugate();
        
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
      }
    });
  });

  describe("Slice Operations", () => {
    const intoSliceVectors = testVectors.test_vectors.filter(v => v.operation === "into_slice");

    it(`should pass all ${intoSliceVectors.length} into_slice test vectors`, () => {
      for (const vector of intoSliceVectors) {
        const elements = vector.inputs.elements.map((elem: any) => 
          CM31.from_u32_unchecked(elem.real, elem.imag)
        );
        const result = CM31.intoSlice(elements);
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

    it(`should pass all ${zeroVectors.length} zero test vectors`, () => {
      for (const vector of zeroVectors) {
        const result = CM31.zero();
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
      }
    });

    it(`should pass all ${oneVectors.length} one test vectors`, () => {
      for (const vector of oneVectors) {
        const result = CM31.one();
        expect(result.real.value).toBe(vector.output.real);
        expect(result.imag.value).toBe(vector.output.imag);
      }
    });
  });

  describe("Test Vector Statistics", () => {
    it("should report test vector counts", () => {
      const operationCounts = testVectors.test_vectors.reduce((acc, vector) => {
        acc[vector.operation] = (acc[vector.operation] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log("CM31 test vector counts by operation:");
      Object.entries(operationCounts).forEach(([operation, count]) => {
        console.log(`  ${operation}: ${count}`);
      });

      expect(testVectors.test_vectors.length).toBeGreaterThan(0);
    });
  });
}); 