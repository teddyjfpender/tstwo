/*
This is the Rust code from backend/cpu/grind.rs that needs to be ported to Typescript in this backend/cpu/grind.ts file:
```rs
use super::CpuBackend;
use crate::core::channel::Channel;
use crate::core::proof_of_work::GrindOps;

impl<C: Channel> GrindOps<C> for CpuBackend {
    fn grind(channel: &C, pow_bits: u32) -> u64 {
        let mut nonce = 0;
        loop {
            let mut channel = channel.clone();
            channel.mix_u64(nonce);
            if channel.trailing_zeros() >= pow_bits {
                return nonce;
            }
            nonce += 1;
        }
    }
}
```
*/

// TODO(Jules): Verify and finalize the TypeScript implementation of `grind` against
// the Rust `impl<C: Channel> GrindOps<C> for CpuBackend`.
//
// Task: Verify and finalize the TypeScript implementation of `grind` against the Rust
// `impl<C: Channel> GrindOps<C> for CpuBackend`.
//
// Details:
// - The existing TypeScript `grind` function implements proof-of-work by iterating
//   nonces and checking `trailing_zeros` on a cloned channel.
// - Ensure this function precisely matches the behavior of the Rust implementation.
// - This function should eventually become a method of a `CpuBackend` class that
//   implements a `GrindOps<C: Channel>` interface (where `C` is a TypeScript
//   `Channel` interface, to be defined based on `core/src/channel/index.ts`).
// - The current TypeScript `grind` function uses a shallow clone (`{ ...channel } as any`)
//   for the channel. This needs to be compatible with how channels are actually
//   cloned or reset in the TypeScript channel implementations.
//
// Dependencies:
// - A `Channel` interface (from `core/src/channel/index.ts`) that defines
//   `mix_u64`, `trailing_zeros`, and a `clone` or state-reset mechanism.
// - The future `GrindOps` interface (to be defined based on
//   `core/src/proof_of_work.ts` if it exists, or as a general interface).
//
// Goal: Provide a correct and verified CPU backend implementation for proof-of-work
// grinding.
//
// Tests: Add unit tests to verify the grinding logic. This might involve creating a
// mock channel or using a simple channel implementation for testing purposes.

export function grind(channel: { mix_u64(n: number): void; trailing_zeros(): number }, powBits: number): number {
  let nonce = 0;
  while (true) {
    const c = { ...channel } as any; // shallow clone
    c.mix_u64(nonce);
    if (c.trailing_zeros() >= powBits) return nonce;
    nonce++;
  }
}
