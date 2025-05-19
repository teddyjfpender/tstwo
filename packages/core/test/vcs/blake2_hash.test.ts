import { describe, it, expect } from 'vitest';
import { Blake2sHash, Blake2sHasher } from '../../src/vcs/blake2_hash';

function hex(hash: Blake2sHash): string { return hash.toString(); }

describe('Blake2sHasher', () => {
  it('single_hash_test', () => {
    const hashA = Blake2sHasher.hash(new TextEncoder().encode('a'));
    expect(hex(hashA)).toBe('4a0d129873403037c2cd9b9048203687f6233fb6738956e0349bd4320fec3e90');
  });

  it('hash_state_test', () => {
    const state = new Blake2sHasher();
    state.update(new TextEncoder().encode('a'));
    state.update(new TextEncoder().encode('b'));
    const hash = state.finalizeReset();
    const hashEmpty = state.finalize();

    expect(hex(hash)).toBe(hex(Blake2sHasher.hash(new TextEncoder().encode('ab'))));
    expect(hex(hashEmpty)).toBe(hex(Blake2sHasher.hash(new Uint8Array())));
  });
});
