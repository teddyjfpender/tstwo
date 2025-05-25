import { blake3 } from '@noble/hashes/blake3.js';
import type { HashLike } from './hash';

const BLAKE3_OUT_LEN = 32; // blake3 default output length is 32 bytes

/** Wrapper around a 32 byte BLAKE3 hash. */
export class Blake3Hash implements HashLike {
  readonly bytes: Uint8Array;

  constructor(bytes?: Uint8Array) {
    if (bytes) {
      if (bytes.length !== BLAKE3_OUT_LEN) {
        throw new Error(`Blake3Hash constructor expects ${BLAKE3_OUT_LEN} bytes, got ${bytes.length}`);
      }
      this.bytes = Uint8Array.from(bytes);
    } else {
      this.bytes = new Uint8Array(BLAKE3_OUT_LEN); // Defaults to all zeros
    }
  }

  static fromBytes(bytes: Uint8Array): Blake3Hash {
    if (bytes.length !== BLAKE3_OUT_LEN) {
      throw new Error(`Blake3Hash.fromBytes expects ${BLAKE3_OUT_LEN} bytes, got ${bytes.length}`);
    }
    return new Blake3Hash(bytes);
  }

  asBytes(): Uint8Array {
    return Uint8Array.from(this.bytes); // Return a copy
  }

  toString(): string {
    // Node.js Buffer is often available in test environments like Vitest.
    // For broader compatibility (browsers), a manual hex conversion might be needed
    // if Buffer is not polyfilled or available.
    // For this project, assuming a Node.js-like environment for tests is acceptable.
    return Buffer.from(this.bytes).toString('hex');
  }

  equals(other: HashLike): boolean {
    if (!(other instanceof Blake3Hash)) {
      return false;
    }
    // Explicitly check type of other.bytes if necessary, but instanceof check above is strong.
    // if (!(other.bytes instanceof Uint8Array)) return false;

    if (this.bytes.length !== other.bytes.length) {
      // This case should ideally not be reached if constructors enforce length,
      // but good for robustness.
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

/** Simple BLAKE3 hasher using @noble/hashes. */
export class Blake3Hasher {
  private state = blake3.create({});

  private static toBytes(data: Uint8Array | string): Uint8Array {
    return typeof data === 'string' ? new TextEncoder().encode(data) : data;
  }

  constructor() {
    // this.state is initialized at declaration
  }

  update(data: Uint8Array | string): void {
    this.state.update(Blake3Hasher.toBytes(data));
  }

  finalize(): Blake3Hash {
    // Default output length for blake3 is 32 bytes.
    // If @noble/hashes ever changes this, or if a different default was set on create,
    // ensure the slice or dkLen is appropriate.
    const digest = this.state.digest();
    this.state = blake3.create({}); // Reset the state for subsequent use
    return new Blake3Hash(digest);
  }

  static hash(data: Uint8Array | string): Blake3Hash {
    const h = new Blake3Hasher();
    h.update(data);
    return h.finalize();
  }

  static concatAndHash(v1: Blake3Hash, v2: Blake3Hash): Blake3Hash {
    const h = new Blake3Hasher();
    h.update(v1.bytes);
    h.update(v2.bytes);
    return h.finalize();
  }
}
