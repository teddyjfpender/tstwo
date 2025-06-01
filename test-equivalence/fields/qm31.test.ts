import { describe, it, expect } from "vitest";
import { QM31, P4 } from "../../packages/core/src/fields/qm31";
import { CM31 } from "../../packages/core/src/fields/cm31";
import { M31 } from "../../packages/core/src/fields/m31";
import fs from "fs";
import path from "path";

// Load test vectors
const testVectorsPath = path.join(__dirname, "../../test-vectors/qm31-test-vectors.json");
const testVectorsData = JSON.parse(fs.readFileSync(testVectorsPath, "utf8"));

interface TestVector {
  operation: string;
  inputs: Record<string, any>;
  intermediates: Record<string, any>;
  output: any;
}

interface QM31TestVectors {
  description: string;
  field_type: string;
  field_modulus: string;
  test_vectors: TestVector[];
}

const testVectors: QM31TestVectors = testVectorsData;

describe("QM31 Test Vector Validation", () => {
  it("should have the correct field modulus", () => {
    expect(BigInt(testVectors.field_modulus)).toBe(P4);
  });

  describe("Basic Operations", () => {
    const addVectors = testVectors.test_vectors.filter(v => v.operation === "add");
    const mulVectors = testVectors.test_vectors.filter(v => v.operation === "mul");
    const subVectors = testVectors.test_vectors.filter(v => v.operation === "sub");
    const negVectors = testVectors.test_vectors.filter(v => v.operation === "neg");

    it(`should pass all ${addVectors.length} addition test vectors`, () => {
      for (const vector of addVectors) {
        const [a0, a1, a2, a3] = vector.inputs.a;
        const [b0, b1, b2, b3] = vector.inputs.b;
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const a = QM31.from_u32_unchecked(a0, a1, a2, a3);
        const b = QM31.from_u32_unchecked(b0, b1, b2, b3);
        const result = a.add(b);
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
      }
    });

    it(`should pass all ${mulVectors.length} multiplication test vectors`, () => {
      for (const vector of mulVectors) {
        const [a0, a1, a2, a3] = vector.inputs.a;
        const [b0, b1, b2, b3] = vector.inputs.b;
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const a = QM31.from_u32_unchecked(a0, a1, a2, a3);
        const b = QM31.from_u32_unchecked(b0, b1, b2, b3);
        const result = a.mul(b);
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
        
        // Verify R constant used in multiplication
        if (vector.intermediates.R_real !== undefined) {
          expect(vector.intermediates.R_real).toBe(2);
          expect(vector.intermediates.R_imag).toBe(1);
        }
      }
    });

    it(`should pass all ${subVectors.length} subtraction test vectors`, () => {
      for (const vector of subVectors) {
        const [a0, a1, a2, a3] = vector.inputs.a;
        const [b0, b1, b2, b3] = vector.inputs.b;
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const a = QM31.from_u32_unchecked(a0, a1, a2, a3);
        const b = QM31.from_u32_unchecked(b0, b1, b2, b3);
        const result = a.sub(b);
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
      }
    });

    it(`should pass all ${negVectors.length} negation test vectors`, () => {
      for (const vector of negVectors) {
        const [a0, a1, a2, a3] = vector.inputs.value;
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const a = QM31.from_u32_unchecked(a0, a1, a2, a3);
        const result = a.neg();
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
      }
    });
  });

  describe("Construction Methods", () => {
    const fromU32UncheckedVectors = testVectors.test_vectors.filter(v => v.operation === "from_u32_unchecked");
    const fromPartialEvalsVectors = testVectors.test_vectors.filter(v => v.operation === "from_partial_evals");

    it(`should pass all ${fromU32UncheckedVectors.length} from_u32_unchecked test vectors`, () => {
      for (const vector of fromU32UncheckedVectors) {
        const [a, b, c, d] = vector.inputs.values;
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const result = QM31.from_u32_unchecked(a, b, c, d);
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
      }
    });

    it(`should pass all ${fromPartialEvalsVectors.length} from_partial_evals test vectors`, () => {
      for (const vector of fromPartialEvalsVectors) {
        const evals = vector.inputs.evals.map((evalArray: number[]) => {
          const [a, b, c, d] = evalArray as [number, number, number, number];
          return QM31.from_u32_unchecked(a, b, c, d);
        });
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const result = QM31.from_partial_evals([evals[0], evals[1], evals[2], evals[3]]);
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
      }
    });
  });

  describe("Inverse Operations", () => {
    const inverseVectors = testVectors.test_vectors.filter(v => v.operation === "inverse");

    it(`should pass all ${inverseVectors.length} inverse test vectors`, () => {
      for (const vector of inverseVectors) {
        const [a, b, c, d] = vector.inputs.value;
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const value = QM31.from_u32_unchecked(a, b, c, d);
        const result = value.inverse();
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
        
        // Verify that inverse * value = 1
        if (vector.intermediates.verification) {
          const [v0, v1, v2, v3] = vector.intermediates.verification;
          const verification = result.mul(value);
          const verificationArray = verification.to_m31_array();
          
          expect(verificationArray[0].value).toBe(v0);
          expect(verificationArray[1].value).toBe(v1);
          expect(verificationArray[2].value).toBe(v2);
          expect(verificationArray[3].value).toBe(v3);
          expect(verificationArray[0].value).toBe(1); // Should always be 1
          expect(verificationArray[1].value).toBe(0); // Should always be 0
          expect(verificationArray[2].value).toBe(0); // Should always be 0
          expect(verificationArray[3].value).toBe(0); // Should always be 0
        }
      }
    });
  });

  describe("CM31 Multiplication", () => {
    const mulCM31Vectors = testVectors.test_vectors.filter(v => v.operation === "mul_cm31");

    it(`should pass all ${mulCM31Vectors.length} mul_cm31 test vectors`, () => {
      for (const vector of mulCM31Vectors) {
        const [q0, q1, q2, q3] = vector.inputs.qm31;
        const [c0, c1] = vector.inputs.cm31;
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const qm31 = QM31.from_u32_unchecked(q0, q1, q2, q3);
        const cm31 = CM31.from_u32_unchecked(c0, c1);
        const result = qm31.mul_cm31(cm31);
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
      }
    });
  });

  describe("Slice Operations", () => {
    const intoSliceVectors = testVectors.test_vectors.filter(v => v.operation === "into_slice");

    it(`should pass all ${intoSliceVectors.length} into_slice test vectors`, () => {
      for (const vector of intoSliceVectors) {
        const elements = vector.inputs.elements.map((elemArray: number[]) => {
          const [a, b, c, d] = elemArray as [number, number, number, number];
          return QM31.from_u32_unchecked(a, b, c, d);
        });
        const result = QM31.into_slice(elements);
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
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const result = QM31.zero();
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
      }
    });

    it(`should pass all ${oneVectors.length} one test vectors`, () => {
      for (const vector of oneVectors) {
        const [expected0, expected1, expected2, expected3] = vector.output;
        
        const result = QM31.one();
        const resultArray = result.to_m31_array();
        
        expect(resultArray[0].value).toBe(expected0);
        expect(resultArray[1].value).toBe(expected1);
        expect(resultArray[2].value).toBe(expected2);
        expect(resultArray[3].value).toBe(expected3);
      }
    });
  });

  describe("Test Vector Statistics", () => {
    it("should report test vector counts", () => {
      const operationCounts = testVectors.test_vectors.reduce((acc, vector) => {
        acc[vector.operation] = (acc[vector.operation] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log("QM31 test vector counts by operation:");
      Object.entries(operationCounts).forEach(([operation, count]) => {
        console.log(`  ${operation}: ${count}`);
      });

      expect(testVectors.test_vectors.length).toBeGreaterThan(0);
    });
  });
}); 