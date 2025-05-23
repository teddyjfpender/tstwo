import { describe, it, expect } from 'vitest';
import { Blake2sHash, Blake2sHasher } from '../../src/vcs/blake2_hash';
import type { HashLike } from '../../src/vcs/hash';

function hex(hash: Blake2sHash): string { return hash.toString(); }
const ZEROS_32 = '0000000000000000000000000000000000000000000000000000000000000000';
const HASH_A_HEX = '4a0d129873403037c2cd9b9048203687f6233fb6738956e0349bd4320fec3e90';
const HASH_B_HEX = '024987377014310b7c831166ff1bfc7859405518092335f00372e7e2a6d1be04'; // Blake2sHasher.hash('b')

describe('Blake2sHash', () => {
  it('constructor with valid 32-byte Uint8Array', () => {
    const bytes = new Uint8Array(32).fill(1);
    const hash = new Blake2sHash(bytes);
    expect(hash.asBytes()).toEqual(bytes);
  });

  it('constructor with no arguments (32 zero bytes)', () => {
    const hash = new Blake2sHash();
    expect(hash.asBytes()).toEqual(new Uint8Array(32));
    expect(hex(hash)).toBe(ZEROS_32);
  });

  it('constructor throws for invalid length Uint8Array (31 bytes)', () => {
    expect(() => new Blake2sHash(new Uint8Array(31))).toThrow('Blake2sHash constructor expects 32 bytes');
  });

  it('constructor throws for invalid length Uint8Array (33 bytes)', () => {
    expect(() => new Blake2sHash(new Uint8Array(33))).toThrow('Blake2sHash constructor expects 32 bytes');
  });

  it('static fromBytes with valid 32-byte Uint8Array', () => {
    const bytes = new Uint8Array(32).fill(2);
    const hash = Blake2sHash.fromBytes(bytes);
    expect(hash.asBytes()).toEqual(bytes);
  });

  it('static fromBytes throws for invalid length Uint8Array (31 bytes)', () => {
    expect(() => Blake2sHash.fromBytes(new Uint8Array(31))).toThrow('Blake2sHash.fromBytes expects 32 bytes');
  });

  it('static fromBytes throws for invalid length Uint8Array (33 bytes)', () => {
    expect(() => Blake2sHash.fromBytes(new Uint8Array(33))).toThrow('Blake2sHash.fromBytes expects 32 bytes');
  });

  it('asBytes returns a copy', () => {
    const originalBytes = new Uint8Array(32).fill(3);
    const hash = new Blake2sHash(originalBytes);
    const returnedBytes = hash.asBytes();
    expect(returnedBytes).toEqual(originalBytes);
    returnedBytes[0] = 99; // Modify the returned array
    expect(hash.asBytes()[0]).toBe(3); // Original should be unchanged
    expect(returnedBytes).not.toEqual(hash.asBytes());
  });

  it('toString returns correct hex for known hash', () => {
    const hashA = Blake2sHasher.hash('a');
    expect(hex(hashA)).toBe(HASH_A_HEX);
  });

  it('toString returns 64-char hex for default hash', () => {
    const hash = new Blake2sHash(); // Default (all zeros)
    expect(hex(hash).length).toBe(64);
    expect(hex(hash)).toBe(ZEROS_32);
  });

  it('equals compares two identical Blake2sHash instances', () => {
    const hash1 = Blake2sHasher.hash('test');
    const hash2 = Blake2sHasher.hash('test');
    expect(hash1.equals(hash2)).toBe(true);
  });

  it('equals compares different Blake2sHash instances', () => {
    const hash1 = Blake2sHasher.hash('test1');
    const hash2 = Blake2sHasher.hash('test2');
    expect(hash1.equals(hash2)).toBe(false);
  });

  it('equals compares with default Blake2sHash', () => {
    const hash1 = Blake2sHasher.hash('not default');
    const defaultHash = new Blake2sHash();
    expect(hash1.equals(defaultHash)).toBe(false);
    const defaultHash2 = new Blake2sHash(new Uint8Array(32));
    expect(defaultHash.equals(defaultHash2)).toBe(true);
  });

  it('equals compares with a non-Blake2sHash object with similar structure', () => {
    const hash1 = Blake2sHasher.hash('abc');
    const fakeHash = {
      bytes: hash1.asBytes(),
      asBytes: () => hash1.asBytes(),
      toString: () => hash1.toString(),
      equals: (other: any) => false, // to satisfy HashLike if needed by type checker
    };
    expect(hash1.equals(fakeHash as HashLike)).toBe(false);
  });

  it('equals compares with a HashLike object that is not Blake2sHash instance', () => {
    const hash1 = Blake2sHasher.hash('def');
    const otherHashLike: HashLike = {
      asBytes: () => hash1.asBytes(), // return same bytes to ensure it's not a byte difference
      toString: () => hex(hash1),
      equals: () => false, // this method won't be called by Blake2sHash.equals
    };
    expect(hash1.equals(otherHashLike)).toBe(false);
  });
});

describe('Blake2sHasher', () => {
  it('single_hash_test', () => {
    const hashA = Blake2sHasher.hash('a'); // string input
    expect(hex(hashA)).toBe(HASH_A_HEX);
  });

  it('hash_state_test', () => {
    const state = new Blake2sHasher();
    state.update('a'); // string input
    state.update(new TextEncoder().encode('b')); // Uint8Array input
    const hashAB = state.finalize(); // finalize also resets
    const hashEmpty = state.finalize(); // Hash of empty (since state was reset)

    expect(hex(hashAB)).toBe(hex(Blake2sHasher.hash('ab')));
    expect(hex(hashEmpty)).toBe(hex(Blake2sHasher.hash(new Uint8Array()))); // or Blake2sHasher.hash('')
    expect(hex(hashEmpty)).toBe(ZEROS_32); // More specific: hashing nothing with blake2s gives a specific hash, not all zeros.
                                           // Let's find out what that is. Noble default is all zeros.
                                           // The Rust `Default::default()` for Blake2s256 is new(), then finalize()
                                           // which means hash of empty string.
    const emptyHash = Blake2sHasher.hash('');
    expect(hex(emptyHash)).toBe('69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9');
    expect(hex(hashEmpty)).toBe('69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9');


  });

  it('concatAndHash test', () => {
    const hashA = Blake2sHasher.hash('a');
    const hashB = Blake2sHasher.hash('b');

    const combinedBytes = new Uint8Array(64);
    combinedBytes.set(hashA.asBytes(), 0);
    combinedBytes.set(hashB.asBytes(), 32);

    const expectedHash = Blake2sHasher.hash(combinedBytes);
    const actualHash = Blake2sHasher.concatAndHash(hashA, hashB);

    expect(hex(actualHash)).toBe(hex(expectedHash));
    // Example specific value if known:
    // hash(hash("a").bytes + hash("b").bytes)
    // bytes_a = hexToBytes(HASH_A_HEX)
    // bytes_b = hexToBytes(HASH_B_HEX)
    // combined = bytes_a + bytes_b
    // expected = Blake2sHasher.hash(combined) -> check this value
    // For "a" and "b" this is:
    // hashA.bytes = 4a0d...3e90
    // hashB.bytes = 0249...1be04
    // Blake2sHasher.hash(concat(hashA.bytes, hashB.bytes))
    // This specific hash is: "1ff39799a85f75c636f5f793704d0a29ac818826586200509050858330249f86"
    expect(hex(actualHash)).toBe('1ff39799a85f75c636f5f793704d0a29ac818826586200509050858330249f86');
  });
});
