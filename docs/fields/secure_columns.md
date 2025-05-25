---
title: Secure Columns
last-verified: 2024-05-25
source-hash: 8072ec5c35ed072a0b96695700613743d8b8a056
---

## Executive summary

`secure_columns.ts` provides `SecureColumnByCoords`, a column-major container for `QM31` elements used in the CPU backend.

## Public surface

| Symbol | Source |
| --- | --- |
| `SecureColumnByCoords` | [secure_columns.ts:L121-L211](../packages/core/src/fields/secure_columns.ts#L121-L211) |

## Walkthrough

The class stores four arrays of `M31` coordinates (see line [121](../packages/core/src/fields/secure_columns.ts#L121)). `at(index)` reconstructs a `QM31` element from these arrays, while `set(index,value)` writes back its coordinates.

## Usage

```typescript
import { SecureColumnByCoords, QM31 } from '@tstwo/core';
const col = SecureColumnByCoords.zeros(8);
col.set(0, QM31.ONE);
```

## Revision log

| Commit | Description |
| --- | --- |
| 8072ec5 | Initial documentation |
