/*
This is the Rust code from vcs/blake2_hash.rs that needs to be ported to Typescript in this vcs/blake2_hash.ts file:
```rs
use std::fmt;

use blake2::{Blake2s256, Digest};
use bytemuck::{Pod, Zeroable};
use serde::{Deserialize, Serialize};

// Wrapper for the blake2s hash type.
#[repr(C, align(32))]
#[derive(Clone, Copy, PartialEq, Default, Eq, Pod, Zeroable, Deserialize, Serialize)]
pub struct Blake2sHash(pub [u8; 32]);

impl From<Blake2sHash> for Vec<u8> {
    fn from(value: Blake2sHash) -> Self {
        Vec::from(value.0)
    }
}

impl From<Vec<u8>> for Blake2sHash {
    fn from(value: Vec<u8>) -> Self {
        Self(
            value
                .try_into()
                .expect("Failed converting Vec<u8> to Blake2Hash type"),
        )
    }
}

impl From<&[u8]> for Blake2sHash {
    fn from(value: &[u8]) -> Self {
        Self(
            value
                .try_into()
                .expect("Failed converting &[u8] to Blake2sHash Type!"),
        )
    }
}

impl AsRef<[u8]> for Blake2sHash {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

impl From<Blake2sHash> for [u8; 32] {
    fn from(val: Blake2sHash) -> Self {
        val.0
    }
}

impl fmt::Display for Blake2sHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&hex::encode(self.0))
    }
}

impl fmt::Debug for Blake2sHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        <Blake2sHash as fmt::Display>::fmt(self, f)
    }
}

impl super::hash::Hash for Blake2sHash {}

// Wrapper for the blake2s Hashing functionalities.
#[derive(Clone, Debug, Default)]
pub struct Blake2sHasher {
    state: Blake2s256,
}

impl Blake2sHasher {
    pub fn new() -> Self {
        Self {
            state: Blake2s256::new(),
        }
    }

    pub fn update(&mut self, data: &[u8]) {
        blake2::Digest::update(&mut self.state, data);
    }

    pub fn finalize(self) -> Blake2sHash {
        Blake2sHash(self.state.finalize().into())
    }

    pub fn concat_and_hash(v1: &Blake2sHash, v2: &Blake2sHash) -> Blake2sHash {
        let mut hasher = Self::new();
        hasher.update(v1.as_ref());
        hasher.update(v2.as_ref());
        hasher.finalize()
    }

    pub fn hash(data: &[u8]) -> Blake2sHash {
        let mut hasher = Self::new();
        hasher.update(data);
        hasher.finalize()
    }
}

#[cfg(test)]
mod tests {
    use blake2::Digest;

    use super::{Blake2sHash, Blake2sHasher};

    impl Blake2sHasher {
        fn finalize_reset(&mut self) -> Blake2sHash {
            Blake2sHash(self.state.finalize_reset().into())
        }
    }

    #[test]
    fn single_hash_test() {
        let hash_a = Blake2sHasher::hash(b"a");
        assert_eq!(
            hash_a.to_string(),
            "4a0d129873403037c2cd9b9048203687f6233fb6738956e0349bd4320fec3e90"
        );
    }

    #[test]
    fn hash_state_test() {
        let mut state = Blake2sHasher::new();
        state.update(b"a");
        state.update(b"b");
        let hash = state.finalize_reset();
        let hash_empty = state.finalize();

        assert_eq!(hash.to_string(), Blake2sHasher::hash(b"ab").to_string());
        assert_eq!(hash_empty.to_string(), Blake2sHasher::hash(b"").to_string());
    }
}
```
*/
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
