/*
This is the Rust code from vcs/hash.rs that needs to be ported to Typescript in this vcs/hash.ts file:
```rs
use std::fmt::{Debug, Display};

use serde::{Deserialize, Serialize};

pub trait Hash:
    Copy
    + Default
    + Display
    + Debug
    + Eq
    + Send
    + Sync
    + 'static
    + Serialize
    + for<'de> Deserialize<'de>
{
}
```
*/
/**
 * Base interface for hash objects.
 *
 * Port of `vcs/hash.rs` trait `Hash`.
 * See original Rust reference above for trait bounds.
 */
export interface HashLike {
  /** Return the raw bytes for this hash. */
  asBytes(): Uint8Array;

  /** String representation, typically hex encoded. */
  toString(): string;

  /**
   * Compares this hash with another hash for equality.
   * @param other The other hash to compare against.
   * @returns True if the hashes are equal, false otherwise.
   */
  equals(other: HashLike): boolean;
}
