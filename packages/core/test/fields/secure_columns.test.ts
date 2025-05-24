import { describe, it, expect } from "vitest";
import { SecureColumnByCoords } from "../../src/fields/secure_columns";
import { M31 } from "../../src/fields/m31";
import { QM31, SECURE_EXTENSION_DEGREE } from "../../src/fields/qm31";

describe("SecureColumnByCoords", () => {
  const m0 = M31.zero();
  const m1 = M31.one();
  const m2 = M31.from(2);
  const m3 = M31.from(3);
  const m4 = M31.from(4);
  const m5 = M31.from(5);
  const m6 = M31.from(6);
  const m7 = M31.from(7);

  const qm1 = QM31.fromM31Array([m0, m1, m2, m3]);
  const qm2 = QM31.fromM31Array([m4, m5, m6, m7]);
  const qm_zero = QM31.zero();

  const createValidColumns = (len: number, offset: number = 0): M31[][] => {
    const cols: M31[][] = [];
    for (let i = 0; i < SECURE_EXTENSION_DEGREE; i++) {
      const col: M31[] = [];
      for (let j = 0; j < len; j++) {
        col.push(M31.from((i + 1) * (j + 1) + offset));
      }
      cols.push(col);
    }
    return cols;
  };

  describe("constructor", () => {
    it("should create an instance with valid column data", () => {
      const cols = createValidColumns(3);
      const sc = new SecureColumnByCoords(cols);
      expect(sc).toBeInstanceOf(SecureColumnByCoords);
      expect(sc.len()).toBe(3);
      // Verify the internal columns are copies
      expect(sc.columns[0]![0]).toEqual(cols[0]![0]);
      cols[0]![0] = M31.from(100); // Modify original
      expect(sc.columns[0]![0]).not.toEqual(M31.from(100)); // Instance should be unaffected
    });

    it("should throw an error if the number of columns is not SECURE_EXTENSION_DEGREE", () => {
      const invalidCols = [createValidColumns(2)[0]]; // Only one column
      expect(() => new SecureColumnByCoords(invalidCols)).toThrow(
        `expected ${SECURE_EXTENSION_DEGREE} coordinate columns`
      );
    });

    it("should throw an error if column lengths are mismatched", () => {
      const mismatchedCols = createValidColumns(2);
      mismatchedCols[1].push(M31.one()); // Make one column longer
      expect(() => new SecureColumnByCoords(mismatchedCols)).toThrow(
        "coordinate column length mismatch"
      );
    });

    it("should create a defensive copy of the input columns array and their inner arrays", () => {
      const originalCols = createValidColumns(2);
      const sc = new SecureColumnByCoords(originalCols);

      // Modify the outer array of the original
      const replacementCol = Array(2).fill(M31.from(99));
      originalCols[0] = replacementCol;
      expect(sc.columns[0]![0]).not.toEqual(M31.from(99)); // Instance's structure should be unaffected

      // Modify an inner array of the original (that was already copied by createValidColumns)
      // To test the constructor's own slice, we need to ensure the originalCols passed in
      // are not modified if the instance's columns are modified.
      const originalColsForInnerTest = createValidColumns(1);
      const scInner = new SecureColumnByCoords(originalColsForInnerTest);
      // Direct modification of scInner.columns would bypass any protective measures.
      // The constructor's job is to copy `originalColsForInnerTest` and its sub-arrays.
      // If scInner.columns[0] was a reference to originalColsForInnerTest[0], this would change originalColsForInnerTest.
      scInner.columns[0]![0] = M31.from(123);
      expect(originalColsForInnerTest[0]![0]).not.toEqual(M31.from(123));
    });
  });

  describe("zeros(len)", () => {
    it("should create a column of the specified length", () => {
      const len = 5;
      const sc = SecureColumnByCoords.zeros(len);
      expect(sc.len()).toBe(len);
    });

    it("should ensure all QM31 elements are zero", () => {
      const len = 3;
      const sc = SecureColumnByCoords.zeros(len);
      for (let i = 0; i < len; i++) {
        expect(sc.at(i).equals(qm_zero)).toBe(true);
      }
    });

    it("should create an empty column if len is 0", () => {
      const sc = SecureColumnByCoords.zeros(0);
      expect(sc.len()).toBe(0);
      expect(sc.is_empty()).toBe(true);
    });
  });

  describe("uninitialized(len)", () => {
    it("should behave like zeros(len)", () => {
      const len = 4;
      const scUninit = SecureColumnByCoords.uninitialized(len);
      const scZeros = SecureColumnByCoords.zeros(len);
      expect(scUninit.len()).toBe(len);
      for (let i = 0; i < len; i++) {
        expect(scUninit.at(i).equals(scZeros.at(i))).toBe(true);
        expect(scUninit.at(i).equals(qm_zero)).toBe(true);
      }
    });
  });

  describe("len() and is_empty()", () => {
    it("should return correct length", () => {
      const sc0 = SecureColumnByCoords.zeros(0);
      const sc3 = SecureColumnByCoords.from([qm1, qm2, qm_zero]);
      expect(sc0.len()).toBe(0);
      expect(sc3.len()).toBe(3);
    });

    it("should correctly report if empty", () => {
      const sc0 = SecureColumnByCoords.zeros(0);
      const sc3 = SecureColumnByCoords.from([qm1, qm2, qm_zero]);
      expect(sc0.is_empty()).toBe(true);
      expect(sc3.is_empty()).toBe(false);
    });
  });

  describe("at(index) and set(index, value)", () => {
    it("should set and get a QM31 value correctly", () => {
      const sc = SecureColumnByCoords.zeros(3);
      sc.set(1, qm1);
      const retrieved = sc.at(1);
      expect(retrieved.equals(qm1)).toBe(true);
      // Ensure other elements are still zero
      expect(sc.at(0).equals(qm_zero)).toBe(true);
      expect(sc.at(2).equals(qm_zero)).toBe(true);
    });

    it("should retrieve values from beginning, middle, and end", () => {
      const sc = SecureColumnByCoords.from([qm1, qm2, qm_zero]);
      expect(sc.at(0).equals(qm1)).toBe(true);
      expect(sc.at(1).equals(qm2)).toBe(true);
      expect(sc.at(2).equals(qm_zero)).toBe(true);
    });

    it("should correctly update underlying M31 coordinate values on set", () => {
      const sc = SecureColumnByCoords.zeros(1);
      sc.set(0, qm2);
      const qm2Coords = qm2.toM31Array();
      for (let i = 0; i < SECURE_EXTENSION_DEGREE; i++) {
        expect(sc.columns[i][0].equals(qm2Coords[i])).toBe(true);
      }
    });

    it("should throw error for at() if index is out of bounds", () => {
      const sc = SecureColumnByCoords.zeros(1); // Valid index is 0
      expect(() => sc.at(1)).toThrow("Index out of bounds");
      expect(() => sc.at(-1)).toThrow("Index out of bounds");
      const scEmpty = SecureColumnByCoords.zeros(0);
      expect(() => scEmpty.at(0)).toThrow("Index out of bounds");
    });

    it("should throw error for set() if index is out of bounds", () => {
      const sc = SecureColumnByCoords.zeros(1); // Valid index is 0
      expect(() => sc.set(1, qm1)).toThrow("Index out of bounds");
      expect(() => sc.set(-1, qm1)).toThrow("Index out of bounds");
      const scEmpty = SecureColumnByCoords.zeros(0);
      expect(() => scEmpty.set(0, qm1)).toThrow("Index out of bounds");
    });
  });

  describe("to_cpu()", () => {
    it("should return a new SecureColumnByCoords instance", () => {
      const original = SecureColumnByCoords.from([qm1, qm2]);
      const cpuCopy = original.to_cpu();
      expect(cpuCopy).toBeInstanceOf(SecureColumnByCoords);
      expect(cpuCopy).not.toBe(original);
    });

    it("should have the same values as the original", () => {
      const original = SecureColumnByCoords.from([qm1, qm2]);
      const cpuCopy = original.to_cpu();
      expect(cpuCopy.len()).toBe(original.len());
      for (let i = 0; i < original.len(); i++) {
        expect(cpuCopy.at(i).equals(original.at(i))).toBe(true);
      }
    });

    it("should ensure the columns are new arrays (deep copy for structure, M31s are immutable)", () => {
      const original = SecureColumnByCoords.from([qm1]);
      const cpuCopy = original.to_cpu();

      expect(cpuCopy.columns).not.toBe(original.columns); // Outer array is different
      for (let i = 0; i < SECURE_EXTENSION_DEGREE; i++) {
        expect(cpuCopy.columns[i]).not.toBe(original.columns[i]); // Inner arrays are different (due to slice in constructor)
        expect(cpuCopy.columns[i][0].equals(original.columns[i][0])).toBe(true); // M31 values are the same
      }
      
      // Modify a value in the copy's columns directly (testing the copy's independence)
      const originalM31Value = cpuCopy.columns[0]![0]!;
      cpuCopy.columns[0]![0] = M31.from(originalM31Value.value + 100); 
      expect(original.columns[0][0].equals(originalM31Value)).toBe(true); // Original should be unchanged.
    });
  });

  describe("Iterator ([Symbol.iterator])", () => {
    it("should not yield any values for an empty column", () => {
      const sc = SecureColumnByCoords.zeros(0);
      const iteratedValues = Array.from(sc); // Uses the iterator
      expect(iteratedValues.length).toBe(0);
    });

    it("should yield each QM31 element in order", () => {
      const values = [qm1, qm2, qm_zero, qm1];
      const sc = SecureColumnByCoords.from(values);
      const iteratedValues = Array.from(sc);
      expect(iteratedValues.length).toBe(values.length);
      for (let i = 0; i < values.length; i++) {
        expect(iteratedValues[i].equals(values[i])).toBe(true);
      }
    });
  });

  describe("static from(values: Iterable<QM31>)", () => {
    it("should create an empty column from an empty iterable", () => {
      const sc = SecureColumnByCoords.from([]);
      expect(sc.len()).toBe(0);
      expect(sc.is_empty()).toBe(true);
    });

    it("should create a column from an array with multiple QM31 values", () => {
      const values = [qm1, qm2, qm_zero];
      const sc = SecureColumnByCoords.from(values);
      expect(sc.len()).toBe(values.length);
      expect(sc.at(0).equals(qm1)).toBe(true);
      expect(sc.at(1).equals(qm2)).toBe(true);
      expect(sc.at(2).equals(qm_zero)).toBe(true);
    });

    it("should handle generic iterables like a generator function", () => {
      function* qm31Generator() {
        yield qm1;
        yield qm2;
      }
      const sc = SecureColumnByCoords.from(qm31Generator());
      expect(sc.len()).toBe(2);
      expect(sc.at(0).equals(qm1)).toBe(true);
      expect(sc.at(1).equals(qm2)).toBe(true);
    });

     it("should handle iterables like Set (order might not be guaranteed by Set but insertion order is often preserved)", () => {
      // For testing, ensure predictable order by converting set to array if needed,
      // or test for presence if order is not critical for `from`.
      // The current implementation of `from` uses `Array.from` which preserves insertion order for Sets.
      const valueSet = new Set([qm1, qm2, qm_zero]); // qm1, qm2, qm_zero is insertion order
      const sc = SecureColumnByCoords.from(valueSet);
      const expectedOrder = [qm1, qm2, qm_zero];
      expect(sc.len()).toBe(valueSet.size);
       for(let i=0; i<expectedOrder.length; ++i) {
        expect(sc.at(i).equals(expectedOrder[i])).toBe(true);
      }
    });
  });

  describe("to_vec()", () => {
    it("should return an empty array for an empty column", () => {
      const sc = SecureColumnByCoords.zeros(0);
      const vec = sc.to_vec();
      expect(vec).toEqual([]);
    });

    it("should return an array with correct QM31 values in order", () => {
      const values = [qm1, qm_zero, qm2];
      const sc = SecureColumnByCoords.from(values);
      const vec = sc.to_vec();
      expect(vec.length).toBe(values.length);
      for (let i = 0; i < values.length; i++) {
        expect(vec[i].equals(values[i])).toBe(true);
      }
    });
  });
});
