import { describe, it, expect } from 'vitest';
import { Blake3Hash, Blake3Hasher } from '../../src/vcs/blake3_hash';
import type { HashLike } from '../../src/vcs/hash';
import { blake3 } from '@noble/hashes/blake3'; // For advanced tests

const BLAKE3_OUT_LEN = 32;
const ZEROS_32_HEX = '00'.repeat(BLAKE3_OUT_LEN);

function hex(hash: Blake3Hash): string { return hash.toString(); }

// Known hash values from Rust/other implementations for cross-validation
const HASH_A_STR = 'a';
const HASH_A_HEX = '17762fddd969a453925d65717ac3eea21320b66b54342fde15128d6caf21215f';
const HASH_B_STR = 'b';
const HASH_B_HEX = '10e5cf3d3c8a4f9f3468c8cc58eea84892a22fdadbc1acb22410190044c1d553'; // blake3('b')
const HASH_EMPTY_STR = '';
const HASH_EMPTY_HEX = 'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262'; // blake3('')
const HASH_AB_STR = 'ab';
const HASH_AB_HEX = '2dc99999a6aaef3f20349d2ed4057a2b54419545dabb809e6381de1bad8337e2'; // blake3('ab')


describe('Blake3Hash', () => {
  it('constructor with valid 32-byte Uint8Array', () => {
    const bytes = new Uint8Array(BLAKE3_OUT_LEN).fill(1);
    const hash = new Blake3Hash(bytes);
    expect(hash.asBytes()).toEqual(bytes);
  });

  it('constructor with no arguments (defaults to 32 zero bytes)', () => {
    const hash = new Blake3Hash();
    expect(hash.asBytes()).toEqual(new Uint8Array(BLAKE3_OUT_LEN));
    expect(hex(hash)).toBe(ZEROS_32_HEX);
  });

  it('constructor throws for invalid length Uint8Array (31 bytes)', () => {
    expect(() => new Blake3Hash(new Uint8Array(BLAKE3_OUT_LEN - 1)))
      .toThrow(`Blake3Hash constructor expects ${BLAKE3_OUT_LEN} bytes`);
  });

  it('constructor throws for invalid length Uint8Array (33 bytes)', () => {
    expect(() => new Blake3Hash(new Uint8Array(BLAKE3_OUT_LEN + 1)))
      .toThrow(`Blake3Hash constructor expects ${BLAKE3_OUT_LEN} bytes`);
  });

  it('static fromBytes with valid 32-byte Uint8Array', () => {
    const bytes = new Uint8Array(BLAKE3_OUT_LEN).fill(2);
    const hash = Blake3Hash.fromBytes(bytes);
    expect(hash.asBytes()).toEqual(bytes);
  });

  it('static fromBytes throws for invalid length Uint8Array (31 bytes)', () => {
    expect(() => Blake3Hash.fromBytes(new Uint8Array(BLAKE3_OUT_LEN - 1)))
      .toThrow(`Blake3Hash.fromBytes expects ${BLAKE3_OUT_LEN} bytes`);
  });

  it('static fromBytes throws for invalid length Uint8Array (33 bytes)', () => {
    expect(() => Blake3Hash.fromBytes(new Uint8Array(BLAKE3_OUT_LEN + 1)))
      .toThrow(`Blake3Hash.fromBytes expects ${BLAKE3_OUT_LEN} bytes`);
  });

  it('asBytes returns a copy', () => {
    const originalBytes = new Uint8Array(BLAKE3_OUT_LEN).fill(3);
    const hash = new Blake3Hash(originalBytes);
    const returnedBytes = hash.asBytes();
    expect(returnedBytes).toEqual(originalBytes);
    returnedBytes[0] = 99; // Modify the returned array
    expect(hash.asBytes()[0]).toBe(3); // Original should be unchanged
    expect(returnedBytes).not.toEqual(hash.asBytes());
  });

  it('toString returns correct hex for a known hash', () => {
    const hashA = Blake3Hasher.hash(HASH_A_STR);
    expect(hex(hashA)).toBe(HASH_A_HEX);
  });

  it('toString returns 64-char hex for default hash (all zeros)', () => {
    const hash = new Blake3Hash(); // Default (all zeros)
    expect(hex(hash).length).toBe(64);
    expect(hex(hash)).toBe(ZEROS_32_HEX);
  });

  it('equals compares two identical Blake3Hash instances', () => {
    const hash1 = Blake3Hasher.hash('test data');
    const hash2 = Blake3Hasher.hash('test data');
    expect(hash1.equals(hash2)).toBe(true);
  });

  it('equals compares different Blake3Hash instances', () => {
    const hash1 = Blake3Hasher.hash('test data 1');
    const hash2 = Blake3Hasher.hash('test data 2');
    expect(hash1.equals(hash2)).toBe(false);
  });

  it('equals compares with default Blake3Hash', () => {
    const hash1 = Blake3Hasher.hash('not default');
    const defaultHash = new Blake3Hash(); // All zeros
    expect(hash1.equals(defaultHash)).toBe(false);
    const defaultHash2 = new Blake3Hash(new Uint8Array(BLAKE3_OUT_LEN)); // Also all zeros
    expect(defaultHash.equals(defaultHash2)).toBe(true);
  });

  it('equals compares with a non-Blake3Hash object with similar structure', () => {
    const hash1 = Blake3Hasher.hash('abc');
    const fakeHash = {
      bytes: hash1.asBytes(),
      asBytes: () => hash1.asBytes(),
      toString: () => hash1.toString(),
      equals: (other: any) => false, // Not needed as instanceof check fails first
    };
    expect(hash1.equals(fakeHash as HashLike)).toBe(false);
  });

  it('equals compares with a HashLike object that is not a Blake3Hash instance', () => {
    const hash1 = Blake3Hasher.hash('def');
    const otherHashLike: HashLike = {
      asBytes: () => hash1.asBytes(),
      toString: () => hex(hash1),
      equals: () => false, // This method won't be called by Blake3Hash.equals due to instanceof check
    };
    expect(hash1.equals(otherHashLike)).toBe(false);
  });
});

describe('Blake3Hasher', () => {
  it('single_hash_test', () => {
    const hashA = Blake3Hasher.hash(HASH_A_STR);
    expect(hex(hashA)).toBe(HASH_A_HEX);
    const hashB = Blake3Hasher.hash(HASH_B_STR);
    expect(hex(hashB)).toBe(HASH_B_HEX);
  });

  it('hash_state_test (finalize resets state)', () => {
    const state = new Blake3Hasher();
    state.update(HASH_A_STR);
    state.update(HASH_B_STR); // state is now hash("a"+"b")
    const hashAB = state.finalize(); // hashAB = hash("ab"), state is reset

    // After finalize, state should be reset, so next finalize is hash of empty
    const hashEmptyFromResetState = state.finalize();

    expect(hex(hashAB)).toBe(HASH_AB_HEX);
    expect(hex(hashEmptyFromResetState)).toBe(HASH_EMPTY_HEX);

    // Further check: ensure Blake3Hasher.hash('') gives the same empty hash
    expect(hex(Blake3Hasher.hash(HASH_EMPTY_STR))).toBe(HASH_EMPTY_HEX);
  });

  it('explicit_finalize_reset_test (matching exact Rust pattern)', () => {
    // This test explicitly matches the Rust #[cfg(test)] finalize_reset behavior
    const state = new Blake3Hasher();
    state.update(HASH_A_STR);
    state.update(HASH_B_STR);
    const hash = state.finalize(); // Should work like finalize_reset in Rust
    const hashEmpty = state.finalize(); // Should be empty hash since state was reset

    expect(hex(hash)).toBe(hex(Blake3Hasher.hash(HASH_AB_STR)));
    expect(hex(hashEmpty)).toBe(hex(Blake3Hasher.hash(HASH_EMPTY_STR)));
  });

  it('concatAndHash_test', () => {
    const hashA = Blake3Hasher.hash(HASH_A_STR);
    const hashB = Blake3Hasher.hash(HASH_B_STR);

    const concatHash = Blake3Hasher.concatAndHash(hashA, hashB);

    // Manually compute expected: blake3(hashA.bytes + hashB.bytes)
    const combinedBytes = new Uint8Array(BLAKE3_OUT_LEN * 2);
    combinedBytes.set(hashA.asBytes(), 0);
    combinedBytes.set(hashB.asBytes(), BLAKE3_OUT_LEN);
    const expectedHash = Blake3Hasher.hash(combinedBytes); // Use our hasher for consistency

    expect(hex(concatHash)).toBe(hex(expectedHash));
    // A specific known value for blake3(blake3('a').bytes || blake3('b').bytes)
    // Bytes for HASH_A_HEX and HASH_B_HEX are concatenated and then hashed.
    // The expected hex is: "8912f1e49d6c94830787bc8765e92f409d6db9041739884a42e59f16388756b1"
    expect(hex(concatHash)).toBe('8912f1e49d6c94830787bc8765e92f409d6db9041739884a42e59f16388756b1');
  });

  it('static hash produces consistent results', () => {
    const data = "some consistent data string";
    const hash1 = Blake3Hasher.hash(data);
    const hash2 = Blake3Hasher.hash(data);
    expect(hex(hash1)).toBe(hex(hash2));
    expect(hash1.equals(hash2)).toBe(true);
  });

  it('hasher produces different results for different data', () => {
    const hash1 = Blake3Hasher.hash("data1");
    const hash2 = Blake3Hasher.hash("data2");
    expect(hex(hash1)).not.toBe(hex(hash2));
  });

  it('hasher handles Uint8Array input', () => {
    const dataStr = "hello world";
    const dataBytes = new TextEncoder().encode(dataStr);
    const hashFromString = Blake3Hasher.hash(dataStr);
    const hashFromBytes = Blake3Hasher.hash(dataBytes);
    expect(hex(hashFromBytes)).toBe(hex(hashFromString));
  });
});

describe('Blake3 Advanced Usage with @noble/hashes', () => {
  const testData = new TextEncoder().encode('test data for advanced features');

  it('blake3 with dkLen (output length)', () => {
    const dkLen64 = 64;
    const digest64 = blake3(testData, { dkLen: dkLen64 });
    expect(digest64.byteLength).toBe(dkLen64);
    // Ensure it's different from default 32-byte hash
    const digest32 = blake3(testData); // Default dkLen is 32
    expect(Buffer.from(digest64).toString('hex')).not.toBe(Buffer.from(digest32).toString('hex'));
  });

  it('blake3 with key (keyed hashing)', () => {
    const key = new Uint8Array(BLAKE3_OUT_LEN); // 32-byte key
    key.fill(1); // Fill with some non-zero value

    const digestKeyed = blake3(testData, { key });
    const digestDefault = blake3(testData); // No key

    expect(Buffer.from(digestKeyed).toString('hex')).not.toBe(Buffer.from(digestDefault).toString('hex'));

    // Hashing same data with different key should produce different result
    const key2 = new Uint8Array(BLAKE3_OUT_LEN);
    key2.fill(2);
    const digestKeyed2 = blake3(testData, { key: key2 });
    expect(Buffer.from(digestKeyed).toString('hex')).not.toBe(Buffer.from(digestKeyed2).toString('hex'));
  });

  it('blake3 with context (personalization)', () => {
    const contextString = 'MyApp-v1.0-UserProfileHashes';

    const digestContext = blake3(testData, { context: contextString });
    const digestDefault = blake3(testData); // No context

    expect(Buffer.from(digestContext).toString('hex')).not.toBe(Buffer.from(digestDefault).toString('hex'));

    // Hashing same data with different context should produce different result
    const contextString2 = 'MyApp-v1.0-DocumentHashes';
    const digestContext2 = blake3(testData, { context: contextString2 });
    expect(Buffer.from(digestContext).toString('hex')).not.toBe(Buffer.from(digestContext2).toString('hex'));
  });
});
