# Core Package Architecture

This document provides an overview of the `packages/core` directory in this repository. The TypeScript code mirrors the original Rust project and many files still contain commented Rust implementations. The goal is to port these modules while eventually splitting the monolithic `core` package into smaller packages with clear responsibilities.

## Current Directory Layout

```
packages/core/src
├── air              # Arithmetic Intermediate Representation traits and utilities
├── backend          # CPU/SIMD backends for field and polynomial operations
├── channel          # Random oracle channels (e.g. Blake2s based)
├── circle.ts        # Circle group utilities and points on the complex unit circle
├── constraints.ts   # Constraint helpers and vanishing polynomials
├── fft.ts           # FFT primitives over M31
├── fields           # Finite field implementations (M31, QM31, etc.)
├── fri.ts           # FRI protocol logic
├── lookups          # Sum-check and GKR lookup helpers
├── pcs              # Polynomial commitment scheme (FRI based)
├── poly             # Circle polynomial types and utilities
├── proof_of_work.ts # Trait for nonce grinding
├── prover           # Stark prover entry points
├── queries.ts       # Query generation helpers
├── utils.ts         # Miscellaneous helpers
└── vcs              # Vector commitment scheme (Merkle trees, hashes)
```

Most files currently export placeholder functions or contain the full Rust source as comments. As the translation progresses these modules will expose TypeScript implementations that mirror the Rust APIs.

## High Level Dependencies

The commented `mod.rs` in `src/index.ts` lists the modules that make up the system:

```
pub mod air;
pub mod backend;
pub mod channel;
pub mod circle;
pub mod constraints;
pub mod fft;
pub mod fields;
pub mod fri;
pub mod lookups;
pub mod pcs;
pub mod poly;
pub mod proof_of_work;
pub mod prover;
pub mod queries;
#[cfg(test)]
pub mod test_utils;
pub mod utils;
pub mod vcs;
```

Conceptually the dependencies between these modules follow the STARK proof pipeline:

1. **Fields & Circle** – Provide arithmetic over the base field (`M31`) and extension field (`QM31`). Circle utilities define subgroup cosets used in FFTs.
2. **Backend** – Concrete implementations (e.g. CPU) of low level operations: FFTs, polynomial interpolation, column accumulation, etc.
3. **Air & Constraints** – An AIR instance defines components and constraint polynomials evaluated over a trace. `air` uses the backend to compute evaluations.
4. **Channel** – A random oracle channel that mixes field elements, hashes and nonces. Both prover and verifier interact with the channel.
5. **PCS & Fri** – The polynomial commitment scheme commits to trace polynomials and proves evaluations using FRI. It relies on the channel and backend.
6. **VCS** – Vector commitment scheme providing Merkle trees and hashing for PCS commitments.
7. **Proof of Work** – Optional nonce grinding to add security bits.
8. **Prover** – Orchestrates all of the above to produce a `StarkProof`. It drives component provers, commits traces, evaluates FRI layers and appends proof-of-work data.
9. **Queries** – Helper utilities for generating verifier queries used in FRI and trace openings.

The verifier follows a similar path in reverse: it reads commitments from the channel, reconstructs polynomial evaluations using the same backend, checks the FRI proof and validates proof-of-work.

### Simplified Dependency Diagram

```
 [fields] <-----+            +--> [utils]
                |            |
 [circle] ------+            |
                             v
 [backend] ---> [fft] ---> [poly]
                             |
 [constraints] -+            |
 [air] ---------+--> [pcs] --+--> [fri]
                             |
 [vcs] <--------+            |
                             v
 [channel] ---> [prover] ---> [proof_of_work]
```

Modules above a given box are generally imported by it. For example `pcs` depends on `backend`, `channel`, `fri` and `vcs`. The `prover` uses most modules to drive the overall proof construction.

## Potential Multi-Package Split

Once the port is complete it may be beneficial to break `core` into several packages to limit scopes and dependencies:

- `@tstwo/fields` – All finite field implementations and utilities.
- `@tstwo/polynomials` – FFTs, circle domains and polynomial types.
- `@tstwo/backend` – CPU/SIMD specific operations implementing interfaces from `polynomials`.
- `@tstwo/channel` – Random oracle channels and proof-of-work utilities.
- `@tstwo/commitment` – PCS, VCS and FRI protocols.
- `@tstwo/stark` – High level prover and verifier APIs built on the above.

This split keeps primitive math separate from protocol logic and would allow projects to depend only on the pieces they need.

## Data Flow Overview

Below is a high level diagram of how data moves through the system when producing a proof. Each arrow represents a dependency or flow of information.

```
        +------------+
        |  Trace/AIR |
        +------------+
               |
               v
        +------------+
        |  Prover    |
        +------------+
          /    |     \
         /     |      \
        v      v       v
  [Backend] [PCS]    [Channel]
        |      |          |
        |      v          v
        |   [FRI]   [Proof of Work]
        |      |          |
        +------+----------+
               |
               v
        +------------+
        | StarkProof |
        +------------+
```

Verification follows the same steps in reverse, using the channel to read commitments and the backend to reconstruct polynomial evaluations.

## Programming Paradigm Recommendations

The modules in `packages/core` serve very different roles. Below are opinions on
which paradigms best suit each piece in order to keep the project fast yet
maintainable:

- **fields** – Primarily **imperative**. Field arithmetic benefits from
  unrolled loops and tight control over memory. Implementations should expose
  small functions that operate on typed arrays for speed.
- **circle** – **functional**. Computing roots of unity and cosets is mostly
  deterministic math. Keeping these utilities pure makes them easy to reason
  about.
- **backend** – Highly **imperative**. This layer implements FFTs and other
  performance‑critical routines. It should favour explicit loops and minimal
  allocations while exposing a simple functional interface on top.
- **air** and **constraints** – Largely **functional**. AIR instances describe
  polynomials evaluated over a trace. Expressing these as pure functions allows
  easier testing and compiler optimisations.
- **fft** and **poly** – Mix of **imperative** and **functional**. The core FFT
  kernels should be imperative, while higher‑level polynomial transforms can be
  written functionally for clarity.
- **lookups** – Mostly **functional**. Lookup arguments compose nicely when
  treated as transformations from one vector to another.
- **pcs**, **fri** and **vcs** – Combination of **object‑oriented** structures
  to maintain state (commitments, Merkle trees) with **imperative** inner loops
  for hashing and field operations.
- **channel** – **object‑oriented**. The channel maintains internal state as
  data is absorbed and squeezed. Encapsulating this in a class keeps the API
  predictable.
- **proof_of_work** – Simple **imperative** loops for nonce grinding.
- **prover** – Mostly **object‑oriented** to coordinate steps of the proof
  generation. Methods can rely on functional helpers from other modules.
- **queries** and **utils** – Lightweight **functional** utilities for creating
  verifier queries and performing small calculations.


## Conclusion

The core package currently aggregates all STARK related logic in one workspace. As the Rust code is fully ported, splitting the modules into dedicated packages as outlined above will make the repository easier to maintain and consume.

