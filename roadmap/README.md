# Roadmapping

Quick `stwo-prover` intra-crate dependency analysis to see what root-node porting there is to be done.

## Next Steps for TypeScript Core Port

The `rust-reference/core` module is being translated into `packages/core`. Our objective is full API and functional parity so that both implementations produce identical results.

1. **Complete FRI and FFT support**
   - Finish porting `fri.rs` logic including folding options and step-size configuration.
   - Port remaining FFT helpers and domain utilities used by FRI.

2. **Implement SIMD backend features**
   - Translate SIMD-specific functions such as prefix sums, field conversions and Poseidon252 routines.
   - Provide CPU fallbacks identical to the Rust behavior.

3. **Finalize prover and query APIs**
   - Finish the `prove()` implementation and add quotient commitment handling.
   - Mirror Rust trait bounds with TypeScript interfaces for all prover components.

4. **Cross-check with Rust implementation**
   - Add tests that feed the same inputs to Rust and TypeScript builds and compare outputs.
   - Expand edge case coverage for column, field and channel operations.

5. **Documentation and examples**
   - Document module APIs and link back to corresponding Rust sources.
   - Provide example scripts demonstrating identical usage between languages.

Following this plan will bring the TypeScript core package to feature parity with the Rust reference implementation.
