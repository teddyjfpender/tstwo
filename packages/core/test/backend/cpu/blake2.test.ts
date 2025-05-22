import { describe, it, expect } from 'vitest';
import { commitOnLayer, Blake2sHash } from '../../../src/backend/cpu/blake2';
let blake2s: any;
try {
  blake2s = require('@noble/hashes/blake2').blake2s;
} catch {
  blake2s = undefined;
}

// Helper function to convert an array of numbers to a little-endian Uint8Array (for leaf nodes)
// This logic needs to be available in the test to prepare messages for blake2s
function test_numbersToLEUint8Array(nums: number[]): Uint8Array {
    const bytes = new Uint8Array(nums.length * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < nums.length; i++) {
        view.setUint32(i * 4, nums[i], true); // true for little-endian
    }
    return bytes;
}

// Helper function to concatenate Uint8Arrays (for internal nodes)
function test_concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const arr of arrays) {
        totalLength += arr.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// Function to create a dummy Blake2sHash (32 bytes) for testing prevLayer
function createDummyHash(fillValue: number): Blake2sHash {
    const hash = new Uint8Array(32);
    hash.fill(fillValue);
    return hash;
}

describe.skip('commitOnLayer with Blake2s from @noble/hashes', () => {
    // Note: These tests verify the behavior of `commitOnLayer` which now uses
    // `@noble/hashes/blake2s` for its hashing operations. The expected values
    // in these tests are derived by directly applying `blake2s` (from @noble/hashes)
    // to the input data, prepared in the same way `commitOnLayer` prepares it
    // (i.e., serializing leaf data to LE Uint8Array, concatenating child hashes).
    //
    // TODO: If the specific behavior of the original Rust
    // `Blake2sMerkleHasher::hash_node` becomes known and differs significantly
    // from a direct application of Blake2s (e.g., unique data serialization,
    // specific Blake2s parameterization), further test cases reflecting those
    // specific Rust behaviors might be needed to ensure full functional parity
    // with the original Rust system's intent.

    // No longer testing bytesToU32ArrayLittleEndian or u32ArrayToBytesLittleEndian directly here
    // as they are not part of the main code's API or specific test logic for noble/hashes.

    describe('Leaf Node Hashing', () => {
        it('should hash a single leaf node with 1 column (logSize=0)', () => {
            const logSize = 0;
            // For logSize=0, nodeIdx is 0.
            // columns = [[column0_val_at_node0]]
            const columnsData = [[0x12345678]]; 

            const leafNumbers: number[] = [];
            for (const column of columnsData) {
                leafNumbers.push(column[0] >>> 0);
            }
            const message_bytes = test_numbersToLEUint8Array(leafNumbers);
            const expected_hash = blake2s(message_bytes, { dkLen: 32 });
            
            const result = commitOnLayer(logSize, undefined, columnsData);
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
            const leafNumbers0: number[] = [];
            for (const column of columnsData) {
                leafNumbers0.push(column[0] >>> 0);
            }
            const message_bytes0 = test_numbersToLEUint8Array(leafNumbers0);
            const expected_hash0 = blake2s(message_bytes0, { dkLen: 32 });
            expect(result[0]).toEqual(expected_hash0);

            // Expected for node 1
            const leafNumbers1: number[] = [];
            for (const column of columnsData) {
                leafNumbers1.push(column[1] >>> 0);
            }
            const message_bytes1 = test_numbersToLEUint8Array(leafNumbers1);
            const expected_hash1 = blake2s(message_bytes1, { dkLen: 32 });
            expect(result[1]).toEqual(expected_hash1);
        });

        it('should hash a leaf node with many column elements (logSize=0)', () => {
            const logSize = 0;
            // Using 20 elements to show it handles more than 16 (previous limit)
            const manyElements = new Array(20).fill(0).map((_, idx) => (idx + 1) * 0x1010101);
            const columnsForNode0 = manyElements.map(val => [val]); 

            const leafNumbers: number[] = [];
            for (const column of columnsForNode0) {
                leafNumbers.push(column[0] >>> 0);
            }
            const message_bytes = test_numbersToLEUint8Array(leafNumbers);
            const expected_hash = blake2s(message_bytes, { dkLen: 32 });

            const result = commitOnLayer(logSize, undefined, columnsForNode0);
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(expected_hash);
        });

        it('should hash a leaf node with 0 column elements (logSize=0)', () => {
            const logSize = 0;
            const columnsData: (readonly number[])[] = [];

            const leafNumbers: number[] = []; // Will be empty
            const message_bytes = test_numbersToLEUint8Array(leafNumbers); // Empty Uint8Array
            const expected_hash = blake2s(message_bytes, { dkLen: 32 });
            
            const result = commitOnLayer(logSize, undefined, columnsData);
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(expected_hash); 
        });

        // The error for >16 elements is removed as @noble/hashes handles arbitrary length.
    });

    describe('Internal Node Hashing', () => {
        it('should hash a single internal node (logSize=0 from 2 children)', () => {
            const logSize = 0; 
            const childHash1 = createDummyHash(0xAA);
            const childHash2 = createDummyHash(0xBB);
            const prevLayer = [childHash1, childHash2];

            const message_bytes = test_concatUint8Arrays([childHash1, childHash2]);
            const expected_hash = blake2s(message_bytes, { dkLen: 32 });

            const result = commitOnLayer(logSize, prevLayer, []); 
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(expected_hash);
        });

        it('should hash two internal nodes (logSize=1 from 4 children)', () => {
            const logSize = 1; 
            const children = [
                createDummyHash(0x11), 
                createDummyHash(0x22), 
                createDummyHash(0x33), 
                createDummyHash(0x44)  
            ];
            const prevLayer = children;

            const result = commitOnLayer(logSize, prevLayer, []);
            expect(result.length).toBe(2);

            // Expected for result[0] (from children[0] and children[1])
            const message_bytes0 = test_concatUint8Arrays([children[0], children[1]]);
            const expected_hash0 = blake2s(message_bytes0, { dkLen: 32 });
            expect(result[0]).toEqual(expected_hash0);

            // Expected for result[1] (from children[2] and children[3])
            const message_bytes1 = test_concatUint8Arrays([children[2], children[3]]);
            const expected_hash1 = blake2s(message_bytes1, { dkLen: 32 });
            expect(result[1]).toEqual(expected_hash1);
        });
    });
});
