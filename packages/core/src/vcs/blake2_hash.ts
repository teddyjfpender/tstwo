import { blake2s } from '@noble/hashes/blake2.js';
import type { HashLike } from './hash';

/** Wrapper around a 32 byte BLAKE2s hash. */
export class Blake2sHash implements HashLike {
  readonly bytes: Uint8Array;

  constructor(bytes?: Uint8Array) {
    if (bytes) {
      if (bytes.length !== 32) {
        throw new Error('Blake2sHash constructor expects 32 bytes');
      }
      this.bytes = Uint8Array.from(bytes);
    } else {
      this.bytes = new Uint8Array(32);
    }
  }

  static fromBytes(bytes: Uint8Array): Blake2sHash {
    if (bytes.length !== 32) {
      throw new Error('Blake2sHash.fromBytes expects 32 bytes');
    }
    return new Blake2sHash(bytes);
  }

  asBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  toString(): string {
    return Buffer.from(this.bytes).toString('hex');
  }

  equals(other: HashLike): boolean {
    if (!(other instanceof Blake2sHash)) {
      return false;
    }
    // Compare byte arrays element by element
    if (this.bytes.length !== other.bytes.length) { // Should always be 32, but good practice
      return false;
    }
    for (let i = 0; i < this.bytes.length; i++) {
      if (this.bytes[i] !== other.bytes[i]) {
        return false;
      }
    }
    return true;
  }
}

/** Simple BLAKE2s hasher using @noble/hashes. */
export class Blake2sHasher {
  private state = blake2s.create();

  constructor() {
    this.state = blake2s.create();
  }

  private static toBytes(data: Uint8Array | string): Uint8Array {
    return typeof data === 'string' ? new TextEncoder().encode(data) : data;
  }

  update(data: Uint8Array | string): void {
    this.state.update(Blake2sHasher.toBytes(data));
  }

  finalize(): Blake2sHash {
    const digest = new Uint8Array(this.state.digest());
    this.state = blake2s.create(); // Reset the state
    return new Blake2sHash(digest);
  }

  /** @deprecated Test-only functionality in Rust. `finalize` now resets state. */
  finalizeReset(): Blake2sHash {
    return this.finalize();
  }

  static hash(data: Uint8Array | string): Blake2sHash {
    const h = new Blake2sHasher();
    h.update(data);
    return h.finalize();
  }

  static concatAndHash(v1: Blake2sHash, v2: Blake2sHash): Blake2sHash {
    const h = new Blake2sHasher();
    h.update(v1.bytes);
    h.update(v2.bytes);
    return h.finalize();
  }
}
