---
title: Blake2sChannel
last-verified: 2025-05-25
source-hash: 429a80c36f02933c6a19442d9428c7511ccd46d4
---

## Executive summary

`Blake2sChannel` mixes inputs using Blake2s hashing and draws `QM31` elements in batches of eight base field elements. It is the default random oracle for proofs.

## Public surface

| Symbol | Source |
| --- | --- |
| `BLAKE_BYTES_PER_HASH` | [blake2.ts:L8](../packages/core/src/channel/blake2.ts#L8) |
| `FELTS_PER_HASH` | [blake2.ts:L9](../packages/core/src/channel/blake2.ts#L9) |
| `Blake2sChannel` | [blake2.ts:L25-L225](../packages/core/src/channel/blake2.ts#L25-L225) |

## Walkthrough

The constructor is private and instances are created via `create()` or `fromState()`:
```typescript
static create(): Blake2sChannel {
  return new Blake2sChannel(
    Blake2sChannel._constructorKey,
    new Blake2sHash(),
    new MutableChannelTime(),
    []
  );
}
```
Mixing `u32` values validates the input and hashes each word in little‑endian order:
```typescript
mix_u32s(data: readonly number[]): void {
  ChannelUtils.validateU32Array(data);
  const hasher = new Blake2sHasher();
  hasher.update(this._digest.bytes);
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  for (const word of data) {
    view.setUint32(0, word >>> 0, true);
    hasher.update(buf);
  }
  this.updateDigest(hasher.finalize());
}
```
Drawing a `QM31` element composes four base field draws:
```typescript
const arr = this._baseQueue.splice(0, SECURE_EXTENSION_DEGREE) as [M31,M31,M31,M31];
return SecureField.from_m31_array(arr);
```

## Revision log

| Commit | Description |
| --- | --- |
| 429a80c | Initial channel documentation |
