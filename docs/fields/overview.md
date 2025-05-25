---
title: Field Modules Overview
last-verified: 2024-05-25
source-hash: 8072ec5c35ed072a0b96695700613743d8b8a056
---

The `fields` directory implements finite field arithmetic used across the project. Three field types are provided:

- `M31` – a prime field with modulus $2^{31}-1$.
- `CM31` – a quadratic extension of `M31` representing $a+bi$.
- `QM31` – a quartic extension of `CM31` used as the project's *secure field*.

Utility functions handle batch inversion and column management.

Each module document explains its API, with references back to the TypeScript sources.
