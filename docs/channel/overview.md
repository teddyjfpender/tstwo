---
title: Channel Modules Overview
last-verified: 2025-05-25
source-hash: 429a80c36f02933c6a19442d9428c7511ccd46d4
---

The `channel` directory contains implementations of random-oracle channels used across the proving system. A channel mixes data into an internal digest and draws pseudorandom field elements from it. Two concrete channels are provided:

- `Blake2sChannel` – digest based on Blake2s hashes.
- `Poseidon252Channel` – digest based on Poseidon hashes over the Starknet field.

Utility wrappers add logging capabilities and common interfaces unify the API. Each module document explains the exported symbols and references back to the TypeScript sources.
