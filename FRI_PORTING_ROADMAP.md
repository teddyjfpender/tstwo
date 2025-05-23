# FRI Porting Roadmap

This document outlines the steps required to finish the TypeScript port of the Fast Reed--Solomon Interactive Oracle Proof of Proximity (FRI) used in the original Rust `stwo` project.  Numerous TODOs across the codebase highlight incomplete pieces.  The goal of this roadmap is to order the work so that each dependency is implemented at the right stage and future tasks build upon stable foundations.

## 1. Stabilise Fundamental Types

1. **CpuBackend primitives and poly structures**
   - Implement `CpuCirclePoly` in the backend.  `fri.test.ts` currently uses a placeholder class for polynomial evaluations and notes this TODO at line 106【F:packages/core/src/fri.test.ts†L106-L112】.
   - Other CPU backends such as `accumulation.ts`, `quotients.ts`, and `circle.ts` contain placeholders for field operations.  These should be verified and completed so all arithmetic and polynomial operations work on the CPU backend.
2. **Field operations**
   - Ensure `QM31` and `M31` expose all field methods used in the FRI flow.  Several TODOs inside `fri.ts` mention `SecureField` methods like `is_zero`, `mul`, `add`, and `square`【F:packages/core/src/fri.ts†L2868-L3367】.
3. **Twiddle tree generation**
   - Implement `core::poly::twiddles::TwiddleTree<B>` and the `precompute_twiddles` helper.  The tests rely on this functionality but currently call a mock in `fri.test.ts` at lines 58‑63【F:packages/core/src/fri.test.ts†L58-L63】.

## 2. Domain and Evaluation Infrastructure

1. **Coset, CircleDomain, and LineDomain**
   - Multiple TODOs in the tests require real domain structures.  For example the `fold_circle_to_line_works` test notes the need for a real Coset and Circle/Line domains at lines 289‑298【F:packages/core/src/fri.test.ts†L289-L299】.
   - Implement the domain classes with methods `log_size`, `at`, `double`, and `coset().index_at` as referenced in `fri.ts` around lines 1649‑1655【F:packages/core/src/fri.ts†L1649-L1657】.
2. **Evaluations and Polynomials**
   - Port `LineEvaluation`, `CircleEvaluation`, `LinePoly`, and related types.  `fri.ts` defines placeholder interfaces (`TypescriptLineEvaluation`, `TypescriptSecureEvaluation`, etc.) and highlights missing methods such as `to_cpu()` and `interpolate`【F:packages/core/src/fri.ts†L1660-L1675】【F:packages/core/src/fri.ts†L1707-L1724】.
   - Once the evaluation types are complete, re‑implement functions like `fold_line` and `fold_circle_into_line` in `backend/cpu/fri.ts` which currently throw `not yet implemented` errors【F:packages/core/src/backend/cpu/fri.ts†L154-L166】.

## 3. Merkle and Channel Infrastructure

1. **Merkle operations**
   - Implement `MerkleOps` and corresponding `MerkleProver`/`MerkleVerifier` ports.  `fri.ts` defines placeholder interfaces for these around lines 1738‑1765 and 2416 onwards【F:packages/core/src/fri.ts†L1738-L1765】【F:packages/core/src/fri.ts†L2416-L2420】.
   - The tests currently skip sections that require Merkle commitments.  Completing these implementations will allow the skipped tests to run.
2. **Channel and Queries**
   - Define a real channel implementation (e.g., Blake2sChannel) exposing `mix_root`, `mix_felts`, and `draw_felt`.  Mocks exist in `fri.test.ts`, but they must be replaced for accurate verification【F:packages/core/src/fri.test.ts†L83-L102】.
   - Port the `Queries` structure and helper `get_query_positions_by_log_size`.  Many TODOs inside `fri.ts` rely on a real queries module around lines 2222‑2230 and 2153‑2170【F:packages/core/src/fri.ts†L2153-L2170】【F:packages/core/src/fri.ts†L2222-L2230】.

## 4. FriProver and FriVerifier

1. **FriProver**
   - After the domain and Merkle infrastructure is ready, port the logic of `FriProver` in `fri.ts`.  Numerous placeholder checks depend on the real types and operations, for example the channel interactions around lines 2056‑2085 and the polynomial interpolation at lines 2119‑2142【F:packages/core/src/fri.ts†L2051-L2085】【F:packages/core/src/fri.ts†L2119-L2142】.
2. **FriVerifier**
   - Implement `FriVerifier`, ensuring it can verify proofs produced by the prover.  The section around lines 2621‑2834 contains TODOs for the verifier layers and sparse evaluation folding【F:packages/core/src/fri.ts†L2621-L2834】.
   - Revisit generic constraints so that the TypeScript generics mirror the Rust traits as noted at line 2885【F:packages/core/src/fri.ts†L2885-L2890】.

## 5. Test Suite Completion

1. **Existing tests**
   - The initial tests for folding and committing currently rely on placeholders.  Once the above infrastructure is complete they should pass without mocking.
2. **Remaining FRI tests**
   - The bottom of `fri.test.ts` lists several skipped tests with a TODO to port them fully (lines 345‑366)【F:packages/core/src/fri.test.ts†L345-L366】.
   - These tests cover full proof generation and verification using real Merkle trees and channels.  They will serve as the final integration check for the port.

## 6. Suggested Implementation Order

1. **Complete primitive structures** (`CpuCirclePoly`, field operations, twiddle tree).
2. **Domain classes and evaluations**, enabling folding functions in the backend.
3. **Merkle ops and channel implementation** so proofs can be committed and verified.
4. **FriProver/FriVerifier logic**, leveraging the complete infrastructure.
5. **Expand the test suite** by enabling the skipped tests and adding edge cases.

By following this roadmap, each stage unlocks the next set of tasks and minimises rework.  Many TODO comments in `fri.ts` and `fri.test.ts` document the required traits and method names.  Implementing these in the order above ensures the TypeScript FRI will mirror the Rust original and integrate seamlessly with the rest of the codebase.
