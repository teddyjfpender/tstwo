/*
This is the Rust code from vcs/blake3_hash.rs that needs to be ported to Typescript in this vcs/blake3_hash.ts file:
```rs
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::core::vcs::hash::Hash;

// Wrapper for the blake3 hash type.
#[derive(Clone, Copy, PartialEq, Default, Eq, Serialize, Deserialize)]
pub struct Blake3Hash([u8; 32]);

impl From<Blake3Hash> for Vec<u8> {
    fn from(value: Blake3Hash) -> Self {
        Vec::from(value.0)
    }
}

impl From<Vec<u8>> for Blake3Hash {
    fn from(value: Vec<u8>) -> Self {
        Self(
            value
                .try_into()
                .expect("Failed converting Vec<u8> to Blake3Hash Type!"),
        )
    }
}

impl From<&[u8]> for Blake3Hash {
    fn from(value: &[u8]) -> Self {
        Self(
            value
                .try_into()
                .expect("Failed converting &[u8] to Blake3Hash Type!"),
        )
    }
}

impl AsRef<[u8]> for Blake3Hash {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

impl fmt::Display for Blake3Hash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&hex::encode(self.0))
    }
}

impl fmt::Debug for Blake3Hash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        <Blake3Hash as fmt::Display>::fmt(self, f)
    }
}

impl Hash for Blake3Hash {}

// Wrapper for the blake3 Hashing functionalities.
#[derive(Clone, Default)]
pub struct Blake3Hasher {
    state: blake3::Hasher,
}

impl Blake3Hasher {
    pub fn new() -> Self {
        Self {
            state: blake3::Hasher::new(),
        }
    }
    pub fn update(&mut self, data: &[u8]) {
        self.state.update(data);
    }

    pub fn finalize(self) -> Blake3Hash {
        Blake3Hash(self.state.finalize().into())
    }

    pub fn concat_and_hash(v1: &Blake3Hash, v2: &Blake3Hash) -> Blake3Hash {
        let mut hasher = Self::new();
        hasher.update(v1.as_ref());
        hasher.update(v2.as_ref());
        hasher.finalize()
    }

    pub fn hash(data: &[u8]) -> Blake3Hash {
        let mut hasher = Self::new();
        hasher.update(data);
        hasher.finalize()
    }
}

#[cfg(test)]
impl Blake3Hasher {
    fn finalize_reset(&mut self) -> Blake3Hash {
        let res = Blake3Hash(self.state.finalize().into());
        self.state.reset();
        res
    }
}

#[cfg(test)]
mod tests {
    use crate::core::vcs::blake3_hash::Blake3Hasher;

    #[test]
    fn single_hash_test() {
        let hash_a = Blake3Hasher::hash(b"a");
        assert_eq!(
            hash_a.to_string(),
            "17762fddd969a453925d65717ac3eea21320b66b54342fde15128d6caf21215f"
        );
    }

    #[test]
    fn hash_state_test() {
        let mut state = Blake3Hasher::new();
        state.update(b"a");
        state.update(b"b");
        let hash = state.finalize_reset();
        let hash_empty = state.finalize();

        assert_eq!(hash.to_string(), Blake3Hasher::hash(b"ab").to_string());
        assert_eq!(hash_empty.to_string(), Blake3Hasher::hash(b"").to_string())
    }
}
```
*/
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
