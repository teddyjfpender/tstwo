import { describe, it, expect } from 'bun:test';
import { SecureColumnByCoords } from '../../packages/core/src/fields/secure_columns';
import { QM31 } from '../../packages/core/src/fields/qm31';
import secureColumnVectors from '../../test-vectors/securecolumn-test-vectors.json';

// The JSON structure wraps vectors in a `test_vectors` array. Extract it once
// so tests operate on the expected array of vector objects.
const testVectors = secureColumnVectors.test_vectors;

describe('SecureColumn Test Vector Validation', () => {
  describe('Column Operations', () => {
    it('should pass all set_and_at test vectors', () => {
      const setAndAtVectors = testVectors.filter((v: any) => v.operation === 'set_and_at');
      expect(setAndAtVectors.length).toBeGreaterThan(0);
      
      for (const vector of setAndAtVectors) {
        // Create column with enough space
        const column = SecureColumnByCoords.zeros(10);
        
        // Set the value at the specified index
        const qm31Value = QM31.from_u32_unchecked(
          vector.inputs.value[0],
          vector.inputs.value[1], 
          vector.inputs.value[2],
          vector.inputs.value[3]
        );
        
        column.set(vector.inputs.index, qm31Value);
        
        // Verify the value was set correctly by retrieving it
        const retrievedValue = column.at(vector.inputs.index);
        const retrievedArray = retrievedValue.to_m31_array().map(m31 => m31.value);
        
        expect(retrievedArray).toEqual(vector.output);
      }
    });

    it('should pass all len test vectors', () => {
      const lenVectors = testVectors.filter((v: any) => v.operation === 'len');
      expect(lenVectors.length).toBeGreaterThan(0);
      
      for (const vector of lenVectors) {
        const column = SecureColumnByCoords.zeros(vector.inputs.column_size);
        expect(column.len()).toBe(vector.output);
      }
    });

    it('should pass all is_empty test vectors', () => {
      const isEmptyVectors = testVectors.filter((v: any) => v.operation === 'is_empty');
      expect(isEmptyVectors.length).toBeGreaterThan(0);
      
      for (const vector of isEmptyVectors) {
        const column = SecureColumnByCoords.zeros(vector.inputs.column_size);
        expect(column.is_empty()).toBe(vector.output);
      }
    });

    it('should pass all to_vec test vectors', () => {
      const toVecVectors = testVectors.filter((v: any) => v.operation === 'to_vec');
      expect(toVecVectors.length).toBeGreaterThan(0);
      
      for (const vector of toVecVectors) {
        // Create column and populate with test data
        const column = SecureColumnByCoords.zeros(vector.inputs.column_values.length);
        
        for (let i = 0; i < vector.inputs.column_values.length; i++) {
          const qm31Value = QM31.from_u32_unchecked(
            vector.inputs.column_values[i][0],
            vector.inputs.column_values[i][1],
            vector.inputs.column_values[i][2],
            vector.inputs.column_values[i][3]
          );
          column.set(i, qm31Value);
        }
        
        // Convert to vector and compare
        const vec = column.to_vec();
        const vecAsArrays = vec.map((qm31: QM31) => qm31.to_m31_array().map(m31 => m31.value));
        
        expect(vecAsArrays).toEqual(vector.output);
      }
    });

    it('should pass all from_iter test vectors', () => {
      const fromIterVectors = testVectors.filter((v: any) => v.operation === 'from_iter');
      expect(fromIterVectors.length).toBeGreaterThan(0);
      
      for (const vector of fromIterVectors) {
        // Create QM31 values from input data
        const qm31Values = vector.inputs.input_values.map((arr: number[]) => {
          const [a, b, c, d] = arr as [number, number, number, number];
          return QM31.from_u32_unchecked(a, b, c, d);
        });
        
        // Create column from iterator
        const column = SecureColumnByCoords.from(qm31Values);
        
        // Convert back to arrays for comparison
        const resultAsArrays = column.to_vec().map((qm31: QM31) => qm31.to_m31_array().map(m31 => m31.value));
        
        expect(resultAsArrays).toEqual(vector.output);
      }
    });
  });

  describe('Test Vector Statistics', () => {
    it('should report test vector counts', () => {
      const operationCounts: Record<string, number> = {};
      
      for (const vector of testVectors) {
        operationCounts[vector.operation] = (operationCounts[vector.operation] || 0) + 1;
      }
      
      console.log('SecureColumn test vector counts by operation:');
      for (const [operation, count] of Object.entries(operationCounts)) {
        console.log(`  ${operation}: ${count}`);
      }
      
      // Verify we have test vectors for all expected operations
      expect(operationCounts.set_and_at).toBeGreaterThan(0);
      expect(operationCounts.len).toBeGreaterThan(0);
      expect(operationCounts.is_empty).toBeGreaterThan(0);
      expect(operationCounts.to_vec).toBeGreaterThan(0);
      expect(operationCounts.from_iter).toBeGreaterThan(0);
    });
  });
}); 