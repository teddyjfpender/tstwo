import { describe, it, expect } from 'vitest';
import { commitOnLayer, Blake2sHash } from '../../../../src/backend/cpu/blake2';
import { compress, IV } from '../../../../src/vcs/blake2s_refs';

// Helper functions (copied from blake2.ts as they are not exported)
// These are used here for generating expected values and for their own tests.
function bytesToU32ArrayLittleEndian(bytes: Uint8Array): number[] {
    if (bytes.length % 4 !== 0) {
        // Adjusted to handle lengths that are multiples of 4, not just 32.
        // For commitOnLayer, inputs will be 32 bytes. For direct testing, allow smaller.
        throw new Error("Input Uint8Array length must be a multiple of 4.");
    }
    const u32s = new Array(bytes.length / 4);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < u32s.length; i++) {
        u32s[i] = view.getUint32(i * 4, true); // true for little-endian
    }
    return u32s;
}

function u32ArrayToBytesLittleEndian(u32s: number[]): Uint8Array {
    const bytes = new Uint8Array(u32s.length * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < u32s.length; i++) {
        view.setUint32(i * 4, u32s[i], true); // true for little-endian
    }
    return bytes;
}

// Function to create a dummy Blake2sHash (32 bytes) for testing prevLayer
function createDummyHash(fillValue: number): Blake2sHash {
    const hash = new Uint8Array(32);
    hash.fill(fillValue);
    return hash;
}

describe('commitOnLayer with Blake2s', () => {

    describe('Helper Function Tests (copied scope)', () => {
        it('bytesToU32ArrayLittleEndian should convert bytes to u32s (LE)', () => {
            expect(bytesToU32ArrayLittleEndian(new Uint8Array([1, 2, 3, 4]))).toEqual([0x04030201]);
            expect(bytesToU32ArrayLittleEndian(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual([0x04030201, 0x08070605]);
            const thirtyTwoBytes = new Uint8Array(32).map((_, i) => i + 1); // 1, 2, ..., 32
            const expectedU32s = [
                0x04030201, 0x08070605, 0x0C0B0A09, 0x100F0E0D,
                0x14131211, 0x18171615, 0x1C1B1A19, 0x201F1E1D,
            ];
            expect(bytesToU32ArrayLittleEndian(thirtyTwoBytes)).toEqual(expectedU32s);
        });

        it('u32ArrayToBytesLittleEndian should convert u32s to bytes (LE)', () => {
            expect(u32ArrayToBytesLittleEndian([0x04030201])).toEqual(new Uint8Array([1, 2, 3, 4]));
            expect(u32ArrayToBytesLittleEndian([0x04030201, 0x08070605])).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
            const u32s = [
                0x04030201, 0x08070605, 0x0C0B0A09, 0x100F0E0D,
                0x14131211, 0x18171615, 0x1C1B1A19, 0x201F1E1D,
            ];
            const expectedThirtyTwoBytes = new Uint8Array(32).map((_, i) => i + 1);
            expect(u32ArrayToBytesLittleEndian(u32s)).toEqual(expectedThirtyTwoBytes);
        });

        it('bytesToU32ArrayLittleEndian should throw for invalid length', () => {
            expect(() => bytesToU32ArrayLittleEndian(new Uint8Array([1, 2, 3]))).toThrow("Input Uint8Array length must be a multiple of 4.");
        });
    });

    describe('Leaf Node Hashing', () => {
        it('should hash a single leaf node with 1 column, 2 elements (logSize=0)', () => {
            const logSize = 0;
            const columns = [[0x12345678, 0xabcdef01]]; // commitOnLayer expects columns[colIdx][nodeIdx]
                                                      // For logSize=0, nodeIdx is 0. So columns = [[val_for_node_0_col_0]]
                                                      // The current structure is columns[colIdx][commitmentElementIdx]
                                                      // So for logSize=0, there's 1 commitment element (i=0).
                                                      // columns = [[column0_val_at_i0], [column1_val_at_i0]] for multiple columns.
                                                      // If only one column: columns = [[column0_val_at_i0]]
            const singleNodeColumns = [[columns[0][0]]]; // Data for node 0, column 0 is columns[0][0]

            const msg_vecs_expected = new Array(16).fill(0);
            msg_vecs_expected[0] = singleNodeColumns[0][0] >>> 0;
            const count_low_expected = 1 * 4;

            const expected_u32s = compress(IV, msg_vecs_expected, count_low_expected, 0, 0xFFFFFFFF, 0);
            const expected_hash = u32ArrayToBytesLittleEndian(expected_u32s);
            
            const result = commitOnLayer(logSize, undefined, singleNodeColumns);
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(expected_hash);
        });

        it('should hash leaf nodes with 3 columns (logSize=1)', () => {
            const logSize = 1; // 2 nodes
            const columnsData = [ // columns[colIdx][nodeIdx]
                [0x1111, 0x2222], // Column 0, values for node 0 and node 1
                [0x3333, 0x4444], // Column 1
                [0x5555, 0x6666], // Column 2
            ];

            const result = commitOnLayer(logSize, undefined, columnsData);
            expect(result.length).toBe(2);

            // Expected for node 0
            const msg_vecs0_expected = new Array(16).fill(0);
            msg_vecs0_expected[0] = columnsData[0][0] >>> 0;
            msg_vecs0_expected[1] = columnsData[1][0] >>> 0;
            msg_vecs0_expected[2] = columnsData[2][0] >>> 0;
            const count_low0_expected = 3 * 4;
            const expected_u32s0 = compress(IV, msg_vecs0_expected, count_low0_expected, 0, 0xFFFFFFFF, 0);
            const expected_hash0 = u32ArrayToBytesLittleEndian(expected_u32s0);
            expect(result[0]).toEqual(expected_hash0);

            // Expected for node 1
            const msg_vecs1_expected = new Array(16).fill(0);
            msg_vecs1_expected[0] = columnsData[0][1] >>> 0;
            msg_vecs1_expected[1] = columnsData[1][1] >>> 0;
            msg_vecs1_expected[2] = columnsData[2][1] >>> 0;
            const count_low1_expected = 3 * 4;
            const expected_u32s1 = compress(IV, msg_vecs1_expected, count_low1_expected, 0, 0xFFFFFFFF, 0);
            const expected_hash1 = u32ArrayToBytesLittleEndian(expected_u32s1);
            expect(result[1]).toEqual(expected_hash1);
        });

        it('should hash a leaf node with exactly 16 column elements (logSize=0)', () => {
            const logSize = 0;
            const sixteenElements = new Array(16).fill(0).map((_, idx) => (idx + 1) * 0x1010101);
            const columnsForNode0 = sixteenElements.map(val => [val]); // Each element is a column for node 0

            const msg_vecs_expected = new Array(16).fill(0);
            for(let k=0; k<16; ++k) {
                msg_vecs_expected[k] = sixteenElements[k] >>> 0;
            }
            const count_low_expected = 16 * 4;
            const expected_u32s = compress(IV, msg_vecs_expected, count_low_expected, 0, 0xFFFFFFFF, 0);
            const expected_hash = u32ArrayToBytesLittleEndian(expected_u32s);

            const result = commitOnLayer(logSize, undefined, columnsForNode0);
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(expected_hash);
        });

        it('should hash a leaf node with 0 column elements (logSize=0)', () => {
            const logSize = 0;
            const columnsData: (readonly number[])[] = [];

            const msg_vecs_expected = new Array(16).fill(0);
            const count_low_expected = 0 * 4;
            const expected_u32s = compress(IV, msg_vecs_expected, count_low_expected, 0, 0xFFFFFFFF, 0);
            const expected_hash = u32ArrayToBytesLittleEndian(expected_u32s);
            
            const result = commitOnLayer(logSize, undefined, columnsData);
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(expected_hash); // Should be hash of all-zero block with len 0
        });

        it('should throw error if leaf node has > 16 column elements', () => {
            const logSize = 0;
            const seventeenElements = new Array(17).fill(0).map((_, idx) => idx + 1);
            const columnsForNode0 = seventeenElements.map(val => [val]);
            
            expect(() => commitOnLayer(logSize, undefined, columnsForNode0)).toThrow(
                "Too much column data for a single Blake2s compress call: 17 u32s. Max is 16."
            );
        });
    });

    describe('Internal Node Hashing', () => {
        it('should hash a single internal node (logSize=0 from 2 children)', () => {
            const logSize = 0; // Compute 1 hash
            const childHash1 = createDummyHash(0xAA);
            const childHash2 = createDummyHash(0xBB);
            const prevLayer = [childHash1, childHash2]; // These are for node 0 (2*i) and node 1 (2*i+1) for parent i
                                                     // For logSize=0, we compute result[0]. So prevLayer[0] and prevLayer[1] are its children.

            const msg_vecs_expected = new Array(16).fill(0);
            const child1_u32s = bytesToU32ArrayLittleEndian(childHash1);
            const child2_u32s = bytesToU32ArrayLittleEndian(childHash2);
            msg_vecs_expected.set(child1_u32s, 0);
            msg_vecs_expected.set(child2_u32s, 8);
            const count_low_expected = 64;

            const expected_u32s = compress(IV, msg_vecs_expected, count_low_expected, 0, 0xFFFFFFFF, 0);
            const expected_hash = u32ArrayToBytesLittleEndian(expected_u32s);

            const result = commitOnLayer(logSize, prevLayer, []); // Columns are ignored for internal nodes
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(expected_hash);
        });

        it('should hash two internal nodes (logSize=1 from 4 children)', () => {
            const logSize = 1; // Compute 2 hashes: result[0] and result[1]
            const children = [
                createDummyHash(0x11), // Child of result[0]
                createDummyHash(0x22), // Child of result[0]
                createDummyHash(0x33), // Child of result[1]
                createDummyHash(0x44)  // Child of result[1]
            ];
            const prevLayer = children;

            const result = commitOnLayer(logSize, prevLayer, []);
            expect(result.length).toBe(2);

            // Expected for result[0] (from children[0] and children[1])
            const msg_vecs0_expected = new Array(16).fill(0);
            msg_vecs0_expected.set(bytesToU32ArrayLittleEndian(children[0]), 0);
            msg_vecs0_expected.set(bytesToU32ArrayLittleEndian(children[1]), 8);
            const expected_u32s0 = compress(IV, msg_vecs0_expected, 64, 0, 0xFFFFFFFF, 0);
            const expected_hash0 = u32ArrayToBytesLittleEndian(expected_u32s0);
            expect(result[0]).toEqual(expected_hash0);

            // Expected for result[1] (from children[2] and children[3])
            const msg_vecs1_expected = new Array(16).fill(0);
            msg_vecs1_expected.set(bytesToU32ArrayLittleEndian(children[2]), 0);
            msg_vecs1_expected.set(bytesToU32ArrayLittleEndian(children[3]), 8);
            const expected_u32s1 = compress(IV, msg_vecs1_expected, 64, 0, 0xFFFFFFFF, 0);
            const expected_hash1 = u32ArrayToBytesLittleEndian(expected_u32s1);
            expect(result[1]).toEqual(expected_hash1);
        });
    });
});

// Note: The current `commitOnLayer` expects `columns` to be `readonly (readonly number[])[]`.
// This means `columns[columnIndex][elementIndexInCommitment]`.
// My leaf tests:
// - `singleNodeColumns = [[columns[0][0]]]`. This means 1 column, and we take element 0 from it.
//   If `columns = [[0x12345678]]`, then `singleNodeColumns` becomes `[[0x12345678]]`.
//   Then `columnDataU32s.push(column[i] >>> 0)` loop:
//   `column` is `[0x12345678]`. `i` (node index) is `0`. So `columnDataU32s.push(singleNodeColumns[0][0])`. Correct.

// - `columnsData` for `logSize=1`:
//   `columnsData = [[0x1111, 0x2222], [0x3333, 0x4444], [0x5555, 0x6666]]`
//   For node `i=0`: `columnDataU32s` becomes `[columnsData[0][0], columnsData[1][0], columnsData[2][0]]`
//   This means `[0x1111, 0x3333, 0x5555]`. Correct.

// - `sixteenElements` test:
//   `columnsForNode0 = sixteenElements.map(val => [val])`
//   This creates `[[elem0], [elem1], ..., [elem15]]`. So 16 columns, each column has 1 value (for node 0).
//   The loop `for (const column of columns)` will iterate 16 times.
//   `columnDataU32s.push(column[i] >>> 0)`. `i` is 0.
//   `columnDataU32s` will be `[elem0, elem1, ..., elem15]`. Correct.
// All seems fine.I've created the test file `packages/core/test/backend/cpu/blake2.test.ts` and populated it with tests according to the plan.

Here's a summary of what's included:

1.  **Helper Functions**:
    *   The definitions for `bytesToU32ArrayLittleEndian` and `u32ArrayToBytesLittleEndian` were copied into the test file's scope to allow for direct testing and for use in generating expected hash values.
    *   Tests were added for these two functions, covering basic conversions, little-endianness, and, for `bytesToU32ArrayLittleEndian`, handling of input arrays whose length is not a multiple of 4 (though `commitOnLayer` itself will always pass 32-byte arrays to it).

2.  **Leaf Node Hashing**:
    *   **Single Node (logSize=0), Single Column**: Tests hashing a single leaf node with data from one column.
    *   **Multiple Nodes (logSize=1), Multiple Columns**: Tests hashing two leaf nodes, each taking data from three columns.
    *   **Exactly 16 Column Elements**: Tests a leaf node that uses the maximum capacity (16 u32 values / 64 bytes) for `msg_vecs` from column data.
    *   **Zero Column Elements**: Tests a leaf node with no column data, which should result in hashing a block of zeros with `count_low = 0`.
    *   **Error on >16 Elements**: Verifies that `commitOnLayer` throws the specified error if a leaf node attempts to use more than 16 u32 values from columns.

3.  **Internal Node Hashing**:
    *   **Single Node (logSize=0 from 2 children)**: Tests hashing a single internal node derived from two child hashes. `columns` is passed as an empty array, as it should be ignored.
    *   **Multiple Nodes (logSize=1 from 4 children)**: Tests hashing two internal nodes, each derived from their respective pairs of child hashes.

4.  **Test Logic for Expected Values**:
    *   For each leaf and internal node test case, the expected hash is generated *within the test itself*. This is done by:
        1.  Preparing the `msg_vecs` (16 u32 numbers) exactly as `commitOnLayer` would for that specific case (e.g., formatting column data for leaves, or concatenating child hash u32s for internal nodes).
        2.  Determining the correct `count_low` value.
        3.  Calling `compress(IV, msg_vecs_expected, count_low_expected, 0, 0xFFFFFFFF, 0)` to get the 8 u32s of the expected hash.
        4.  Converting these 8 u32s to a `Blake2sHash` (Uint8Array) using `u32ArrayToBytesLittleEndian`.
    *   The actual result from `commitOnLayer` is then compared against this dynamically generated expected hash using `expect().toEqual()`.

A helper `createDummyHash` was also added to easily generate 32-byte `Uint8Array`s for child hashes in internal node tests.

The tests cover various scenarios and ensure that the data preparation within `commitOnLayer` for both leaf and internal nodes, and its use of the `compress` function, aligns with the standalone calculation of these expected values.

The structure of the test file uses `describe` and `it` from Vitest, and assertions are made with `expect`.
The file `packages/core/test/backend/cpu/blake2.test.ts` has been successfully created with the tests outlined.
