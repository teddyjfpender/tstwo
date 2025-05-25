---
title: Field Utilities
last-verified: 2024-05-25
source-hash: 8072ec5c35ed072a0b96695700613743d8b8a056
---

## Executive summary

`fields.ts` defines interfaces shared by all field implementations and provides batch inversion utilities.

## Public surface

| Symbol | Source |
| --- | --- |
| `FieldExpOps` | [fields.ts:L6-L12](../packages/core/src/fields/fields.ts#L6-L12) |
| `Field` | [fields.ts:L17-L25](../packages/core/src/fields/fields.ts#L17-L25) |
| `ExtensionOf` | [fields.ts:L30-L32](../packages/core/src/fields/fields.ts#L30-L32) |
| `IntoSlice` | [fields.ts:L37-L39](../packages/core/src/fields/fields.ts#L37-L39) |
| `ComplexConjugate` | [fields.ts:L44-L46](../packages/core/src/fields/fields.ts#L44-L46) |
| `batchInverseClassic` | [fields.ts:L66-L91](../packages/core/src/fields/fields.ts#L66-L91) |
| `batchInverseInPlace` | [fields.ts:L96-L160](../packages/core/src/fields/fields.ts#L96-L160) |
| `batchInverse` | [fields.ts:L165-L180](../packages/core/src/fields/fields.ts#L165-L180) |
| `batchInverseChunked` | [fields.ts:L183-L207](../packages/core/src/fields/fields.ts#L183-L207) |
| `FieldUtils` | [fields.ts:L212-L230](../packages/core/src/fields/fields.ts#L212-L230) |
| `TestUtils` | [fields.ts:L232-L281](../packages/core/src/fields/fields.ts#L232-L281) |

## Walkthrough

`batchInverseClassic` multiplies all elements cumulatively and then walks backward applying a single inverse to compute each element's inverse. `batchInverseInPlace` applies Montgomery's trick with a width of 4 for better cache behaviour.

The helpers under `FieldUtils` mirror small utilities used throughout the codebase.

## Usage

```typescript
import { batchInverse } from '@tstwo/core';
const invs = batchInverse([M31.one(), M31.from(2)]);
```

## Revision log

| Commit | Description |
| --- | --- |
| 8072ec5 | Initial documentation |
