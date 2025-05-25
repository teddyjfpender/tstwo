import type { Channel } from "../../channel";
import type { GrindOps } from "../../proof_of_work";
import { CpuBackend } from "./index";

/**
 * Implementation of GrindOps for CpuBackend.
 * Mirrors the Rust `impl<C: Channel> GrindOps<C> for CpuBackend`.
 */
export class CpuGrindOps implements GrindOps<Channel> {
  /**
   * Searches for a nonce such that mixing it to the channel makes the digest 
   * have `powBits` trailing zero bits.
   * 
   * This is a 1:1 port of the Rust CPU implementation:
   * ```rust
   * let mut nonce = 0;
   * loop {
   *     let mut channel = channel.clone();
   *     channel.mix_u64(nonce);
   *     if channel.trailing_zeros() >= pow_bits {
   *         return nonce;
   *     }
   *     nonce += 1;
   * }
   * ```
   * 
   * @param channel - The channel to use for grinding
   * @param powBits - Number of trailing zero bits required
   * @returns The nonce value that achieves the required trailing zeros
   */
  grind(channel: Channel, powBits: number): number {
    let nonce = 0;
    while (true) {
      const channelClone = channel.clone();
      channelClone.mix_u64(nonce);
      
      if (channelClone.trailing_zeros() >= powBits) {
        return nonce;
      }
      nonce += 1;
    }
  }
}

/**
 * Standalone grind function that mirrors the Rust implementation.
 * This is the functional interface for grinding operations.
 * 
 * @param channel - The channel to use for grinding
 * @param powBits - Number of trailing zero bits required
 * @returns The nonce value that achieves the required trailing zeros
 */
export function grind(channel: Channel, powBits: number): number {
  const grindOps = new CpuGrindOps();
  return grindOps.grind(channel, powBits);
}

// Export the backend implementation
export { CpuBackend };
