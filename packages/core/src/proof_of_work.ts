// Proof of work implementation

/*
This is the Rust code from proof_of_work.rs that needs to be ported to Typescript in this proof_of_work.ts file:
```rs
use crate::core::channel::Channel;

pub trait GrindOps<C: Channel> {
    /// Searches for a nonce s.t. mixing it to the channel makes the digest have `pow_bits` leading
    /// zero bits.
    fn grind(channel: &C, pow_bits: u32) -> u64;
}
```
*/
// -------------------- TypeScript implementation --------------------

/**
 * Port of `proof_of_work.rs` trait `GrindOps`.
 * Implementers provide a `grind` function that searches for a nonce such
 * that mixing it into the channel yields a digest with `powBits` leading zeros.
 */
export interface GrindOps<C> {
  grind(channel: C, powBits: number): number;
}

