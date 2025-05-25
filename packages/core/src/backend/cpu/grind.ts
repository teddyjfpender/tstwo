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
   * @param channel - The channel to use for grinding
   * @param powBits - Number of trailing zero bits required
   * @returns The nonce value that achieves the required trailing zeros
   */
  grind(channel: Channel, powBits: number): number {
    let nonce = 0;
    while (true) {
      // Clone the channel state by creating a new instance and copying relevant state
      // For Blake2sChannel this means copying the digest and channel_time
      const channelClone = this.cloneChannel(channel);
      channelClone.mix_u64(nonce);
      
      if (channelClone.trailing_zeros() >= powBits) {
        return nonce;
      }
      nonce += 1;
    }
  }

  /**
   * Creates a deep clone of the channel.
   * This is a helper method that handles the channel cloning logic.
   */
  private cloneChannel(channel: Channel): Channel {
    // Handle Blake2sChannel specifically
    if ('clone' in channel && typeof channel.clone === 'function') {
      return (channel as any).clone();
    }
    
    // For Blake2sChannel, we can create a proper clone manually
    if ('digest' in channel && 'channel_time' in channel && channel.constructor) {
      const ChannelClass = channel.constructor as new () => Channel;
      const clone = new ChannelClass();
      
      // Copy Blake2sChannel state
      if ('updateDigest' in clone && typeof channel.digest === 'function') {
        (clone as any).updateDigest((channel as any).digest());
        // Reset channel_time to match original
        (clone as any).channel_time.n_challenges = (channel as any).channel_time.n_challenges;
        (clone as any).channel_time.n_sent = (channel as any).channel_time.n_sent;
      }
      
      return clone;
    }
    
    // Fallback: attempt shallow copy
    return { ...channel } as Channel;
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
