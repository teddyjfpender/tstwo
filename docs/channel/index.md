---
title: Channel Interfaces
last-verified: 2025-05-25
source-hash: 429a80c36f02933c6a19442d9428c7511ccd46d4
---

## Executive summary

`index.ts` defines the common interfaces and helper utilities used by all channel implementations. It also exposes `ChannelTime` for tracking how many challenges were issued and how many messages were sent.

## Public surface

| Symbol | Source |
| --- | --- |
| `EXTENSION_FELTS_PER_HASH` | [index.ts:L10](../packages/core/src/channel/index.ts#L10) |
| `ChannelTime` | [index.ts:L20-L84](../packages/core/src/channel/index.ts#L20-L84) |
| `MutableChannelTime` | [index.ts:L91-L109](../packages/core/src/channel/index.ts#L91-L109) |
| `Channel` | [index.ts:L119-L137](../packages/core/src/channel/index.ts#L119-L137) |
| `MerkleChannel` | [index.ts:L146-L148](../packages/core/src/channel/index.ts#L146-L148) |
| `ChannelUtils` | [index.ts:L153-L182](../packages/core/src/channel/index.ts#L153-L182) |

Re-exports of `Blake2sChannel`, `Poseidon252Channel` and `LoggingChannel` are defined at lines [5-7](../packages/core/src/channel/index.ts#L5-L7).

## Walkthrough

`ChannelTime` uses a private constructor and factory methods to enforce invariants:
```typescript
class ChannelTime {
  private static readonly _constructorKey = Symbol('ChannelTime.constructor');
  private constructor(key: symbol, private readonly _n_challenges = 0, private readonly _n_sent = 0) {
    if (key !== ChannelTime._constructorKey) {
      throw new Error('ChannelTime constructor is private. Use factory methods.');
    }
  }
}
```
Counters are incremented by returning new immutable objects so that the public API remains pure.

`MutableChannelTime` is the internal mutable equivalent used within channel implementations to avoid allocation overhead. Conversion functions `toMutable()` and `toImmutable()` bridge the two forms.

The `Channel` interface specifies the basic mix and draw operations. `MerkleChannel` adds a single `mix_root` method for hashing Merkle tree roots.

`ChannelUtils` validates integer inputs before they reach the hashing logic:
```typescript
export function validateU32Array(data: readonly number[]): void {
  for (let i = 0; i < data.length; i++) {
    if (!isValidU32(data[i]!)) {
      throw new TypeError(`Invalid u32 value at index ${i}: ${data[i]}`);
    }
  }
}
```
These guards prevent accidental overflow or negative values.

## Revision log

| Commit | Description |
| --- | --- |
| 429a80c | Initial channel documentation |
