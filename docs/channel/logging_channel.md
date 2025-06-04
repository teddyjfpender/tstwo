---
title: LoggingChannel
last-verified: 2025-05-25
source-hash: 429a80c36f02933c6a19442d9428c7511ccd46d4
---

## Executive summary

`logging_channel.ts` provides wrappers that log every mix and draw operation on an underlying channel. Logging can be enabled or disabled at creation time.

## Public surface

| Symbol | Source |
| --- | --- |
| `ChannelLogger` | [logging_channel.ts:L9-L12](../packages/core/src/channel/logging_channel.ts#L9-L12) |
| `ConsoleChannelLogger` | [logging_channel.ts:L17-L35](../packages/core/src/channel/logging_channel.ts#L17-L35) |
| `LoggingChannel` | [logging_channel.ts:L47-L152](../packages/core/src/channel/logging_channel.ts#L47-L152) |
| `LoggingMerkleChannel` | [logging_channel.ts:L162-L216](../packages/core/src/channel/logging_channel.ts#L162-L216) |

## Walkthrough

`LoggingChannel` forwards each call to the wrapped channel and records the before‑and‑after state using a user‑supplied `ChannelLogger`:
```typescript
mix_u32s(data: readonly number[]): void {
  const initialState = this.getStateString();
  this._channel.mix_u32s(data);
  const newState = this.getStateString();
  this._logger.logMix('mix_u32s', initialState, data, newState);
}
```
The helper `getStateString()` attempts to render the digest as hexadecimal for readable logs.

`LoggingMerkleChannel` performs similar instrumentation for Merkle root mixing. If the underlying channel does not expose `mix_root`, the wrapper falls back to mixing the root as bytes.

## Revision log

| Commit | Description |
| --- | --- |
| 429a80c | Initial channel documentation |
