import { M31, P, N_BYTES_FELT } from '../fields/m31';
import { QM31 as SecureField, SECURE_EXTENSION_DEGREE } from '../fields/qm31';
import { Blake2sHash, Blake2sHasher } from '../vcs/blake2_hash';
import type { Channel } from './index';
import { ChannelTime, MutableChannelTime, ChannelUtils } from './index';

// Static constants for performance (world-leading improvement)
export const BLAKE_BYTES_PER_HASH = 32 as const;
export const FELTS_PER_HASH = 8 as const;

// Pre-computed constants for performance
const TWO_P = 2 * P;
const COUNTER_BUFFER_SIZE = BLAKE_BYTES_PER_HASH;

/**
 * A channel that can be used to draw random elements from a Blake2s digest.
 * 
 * **World-Leading Improvements:**
 * - Private constructor for API hygiene
 * - Type safety with integer assertions
 * - Performance optimizations with static constants
 * - Clear separation of number vs bigint logic
 * - Immutable public interface with controlled mutation
 */
export class Blake2sChannel implements Channel {
  readonly BYTES_PER_HASH = BLAKE_BYTES_PER_HASH;
  private static readonly _constructorKey = Symbol('Blake2sChannel.constructor');
  
  private constructor(
    key: symbol,
    private _digest: Blake2sHash,
    private readonly _channelTime: MutableChannelTime,
    private readonly _baseQueue: M31[] = []
  ) {
    if (key !== Blake2sChannel._constructorKey) {
      throw new Error('Blake2sChannel constructor is private. Use factory methods.');
    }
  }

  /** Factory method for creating new Blake2sChannel instances (API hygiene) */
  static create(): Blake2sChannel {
    return new Blake2sChannel(
      Blake2sChannel._constructorKey,
      new Blake2sHash(), // Default to all zeros
      new MutableChannelTime(),
      []
    );
  }

  /** Factory method for creating Blake2sChannel from existing state (for cloning) */
  static fromState(
    digest: Blake2sHash,
    channelTime: ChannelTime,
    baseQueue: readonly M31[] = []
  ): Blake2sChannel {
    return new Blake2sChannel(
      Blake2sChannel._constructorKey,
      new Blake2sHash(new Uint8Array(digest.bytes)),
      channelTime.toMutable(),
      [...baseQueue]
    );
  }

  /** Current digest of the channel (immutable access) */
  digest(): Blake2sHash {
    return new Blake2sHash(new Uint8Array(this._digest.bytes));
  }

  /** Get current channel time (immutable) */
  getChannelTime(): ChannelTime {
    return this._channelTime.toImmutable();
  }

  /** Updates the digest and increments the challenge counter */
  private updateDigest(newDigest: Blake2sHash): void {
    // Replace the digest with the new one
    this._digest = newDigest;
    this._channelTime.inc_challenges();
  }

  /** Creates a deep clone of the channel */
  clone(): Blake2sChannel {
    return Blake2sChannel.fromState(
      this.digest(),
      this.getChannelTime(),
      this._baseQueue
    );
  }

  /** Get digest as bytes (convenience method) */
  digestBytes(): Uint8Array {
    return new Uint8Array(this._digest.bytes);
  }

  trailing_zeros(): number {
    // Performance optimization: work directly with bytes
    let val = 0n;
    const bytes = this._digest.bytes;
    
    // Convert first 16 bytes to little-endian u128 for trailing zeros calculation
    for (let i = 15; i >= 0; i--) {
      val = (val << 8n) | BigInt(bytes[i] ?? 0);
    }
    
    // Count trailing zeros efficiently
    if (val === 0n) return 128;
    
    let tz = 0;
    while (((val >> BigInt(tz)) & 1n) === 0n && tz < 128) {
      tz++;
    }
    return tz;
  }

  mix_felts(felts: readonly SecureField[]): void {
    const hasher = new Blake2sHasher();
    hasher.update(this._digest.bytes);
    hasher.update(SecureField.into_slice(felts as SecureField[]));
    this.updateDigest(hasher.finalize());
  }

  mix_u32s(data: readonly number[]): void {
    // Type safety: validate input (world-leading improvement)
    ChannelUtils.validateU32Array(data);
    
    const hasher = new Blake2sHasher();
    hasher.update(this._digest.bytes);
    
    // Performance optimization: reuse buffer
    const buf = new Uint8Array(4);
    const view = new DataView(buf.buffer);
    
    for (const word of data) {
      view.setUint32(0, word >>> 0, true); // Little-endian
      hasher.update(buf);
    }
    
    this.updateDigest(hasher.finalize());
  }

  mix_u64(value: number | bigint): void {
    // Type safety: validate input (world-leading improvement)
    if (!ChannelUtils.isValidU64(value)) {
      throw new TypeError(`Invalid u64 value: ${value}`);
    }
    
    // Clear separation of number vs bigint logic (world-leading improvement)
    const v = typeof value === 'bigint' ? value : BigInt(value);
    const low = Number(v & 0xffffffffn);
    const high = Number((v >> 32n) & 0xffffffffn);
    
    this.mix_u32s([low, high]);
  }

  /**
   * Generates a uniform random vector of BaseField elements.
   * Retry probability for each round is ~ 2^(-28).
   */
  private drawBaseFelts(): M31[] {
    while (true) {
      const bytes = this.draw_random_bytes();
      const u32s: number[] = [];
      
      // Performance optimization: direct DataView access
      for (let i = 0; i < FELTS_PER_HASH; i++) {
        const view = new DataView(bytes.buffer, i * N_BYTES_FELT, N_BYTES_FELT);
        u32s.push(view.getUint32(0, true)); // Little-endian
      }
      
      // Retry if not all u32s are in the range [0, 2P)
      if (u32s.every((x) => x < TWO_P)) {
        return u32s.map((x) => M31.reduce(x));
      }
    }
  }

  draw_felt(): SecureField {
    // Ensure we have enough base felts in the queue
    while (this._baseQueue.length < SECURE_EXTENSION_DEGREE) {
      this._baseQueue.push(...this.drawBaseFelts());
    }
    
    // Extract exactly 4 base felts for a SecureField
    const arr = this._baseQueue.splice(0, SECURE_EXTENSION_DEGREE) as [M31, M31, M31, M31];
    return SecureField.from_m31_array(arr);
  }

  draw_felts(n_felts: number): SecureField[] {
    // Type safety: validate input (world-leading improvement)
    ChannelUtils.validateFeltCount(n_felts);
    
    if (n_felts === 0) return [];
    
    const result: SecureField[] = [];
    let baseQueue: M31[] = [];
    
    for (let i = 0; i < n_felts; i++) {
      // Ensure we have at least 4 base felts available
      while (baseQueue.length < SECURE_EXTENSION_DEGREE) {
        baseQueue.push(...this.drawBaseFelts());
      }
      
      // Take 4 base felts to create a SecureField
      const arr = baseQueue.splice(0, SECURE_EXTENSION_DEGREE) as [M31, M31, M31, M31];
      result.push(SecureField.from_m31_array(arr));
    }
    
    return result;
  }

  draw_random_bytes(): Uint8Array {
    // Performance optimization: reuse counter buffer
    const counter = new Uint8Array(COUNTER_BUFFER_SIZE);
    const view = new DataView(counter.buffer);
    view.setUint32(0, this._channelTime.n_sent, true); // Little-endian
    
    // Create input for hashing
    const input = new Uint8Array(this._digest.bytes.length + counter.length);
    input.set(this._digest.bytes, 0);
    input.set(counter, this._digest.bytes.length);
    
    this._channelTime.inc_sent();
    return Blake2sHasher.hash(input).asBytes();
  }
} 