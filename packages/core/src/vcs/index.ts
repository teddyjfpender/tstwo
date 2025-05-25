/*
This is the Rust code from vcs/mod.rs that needs to be ported to Typescript in this vcs/index.ts file:
```rs
//! Vector commitment scheme (VCS) module.

pub mod blake2_hash;
pub mod blake2_merkle;
pub mod blake2s_ref;
pub mod blake3_hash;
pub mod hash;
pub mod ops;
#[cfg(not(target_arch = "wasm32"))]
pub mod poseidon252_merkle;
pub mod prover;
mod utils;
pub mod verifier;

#[cfg(test)]
mod test_utils;
```
*/

//! Vector commitment scheme (VCS) module.

export * from './blake2_hash';
export * from './blake2_merkle';
export * from './blake3_hash';
export * from './hash';
export * from './ops';
export * from './poseidon252_merkle';
export * from './prover';
export * from './verifier';
export * from './utils';

// Re-export blake2s_ref if available (conditional like Rust)
export * from './blake2s_ref';

// Test utilities are not exported in production (like Rust #[cfg(test)])
// export * from './test_utils';