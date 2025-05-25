---
title: Poseidon252Channel
last-verified: 2025-05-25
source-hash: 429a80c36f02933c6a19442d9428c7511ccd46d4
---

## Executive summary

`Poseidon252Channel` uses the Starknet Poseidon hash to produce random field elements. It works with 252‑bit field elements and derives base field elements by splitting the hash output.

## Public surface

| Symbol | Source |
| --- | --- |
| `BYTES_PER_FELT252` | [poseidon.ts:L8](../packages/core/src/channel/poseidon.ts#L8) |
| `FELTS_PER_HASH` | [poseidon.ts:L9](../packages/core/src/channel/poseidon.ts#L9) |
| `FieldElement252` | [poseidon.ts:L28-L110](../packages/core/src/channel/poseidon.ts#L28-L110) |
| `Poseidon252Channel` | [poseidon.ts:L122-L360](../packages/core/src/channel/poseidon.ts#L122-L360) |

## Walkthrough

`FieldElement252` validates its value against Starknet's prime and exposes arithmetic operations. `Poseidon252Channel` keeps an internal digest and a mutable `ChannelTime`. Every mix updates the digest via `poseidonHash` or `poseidonHashMany`, and every draw increments the counters.

Base field elements are derived from the digest by repeatedly dividing by $2^{31}$:
```typescript
let cur = this.drawFelt252();
const u32s: number[] = [];
for (let i = 0; i < 8; i++) {
  const next = cur.floorDiv(FieldElement252.from(SHIFT_31));
  const res = cur.sub(next.mul(FieldElement252.from(SHIFT_31)));
  cur = next;
  const u32Val = res.tryIntoU32();
  if (u32Val === null) throw new Error('Failed to convert to u32');
  u32s.push(u32Val);
}
```
The resulting `u32s` are reduced into `M31` elements and grouped into `QM31` values.

## Revision log

| Commit | Description |
| --- | --- |
| 429a80c | Initial channel documentation |
