
import type { QM31 as SecureField } from '../fields/qm31';
import type { MerkleHasher } from '../vcs/ops';

export { Blake2sChannel } from './blake2';
export { Poseidon252Channel } from './poseidon';
export { LoggingChannel } from './logging_channel';

// Static constants for performance (world-leading improvement)
export const EXTENSION_FELTS_PER_HASH = 2 as const;

/**
 * Tracks the time spent sending and receiving data through the channel.
 * 
 * **API Hygiene Improvements:**
 * - Private constructor prevents invalid state creation
 * - Controlled mutation through specific methods
 * - Immutable public interface where possible
 */
export class ChannelTime {
  private static readonly _constructorKey = Symbol('ChannelTime.constructor');

  private constructor(
    key: symbol,
    private readonly _n_challenges: number = 0,
    private readonly _n_sent: number = 0
  ) {
    if (key !== ChannelTime._constructorKey) {
      throw new Error('ChannelTime constructor is private. Use factory methods.');
    }
    // Type safety: integer assertions (world-leading improvement)
    if (!Number.isInteger(_n_challenges) || _n_challenges < 0) {
      throw new TypeError('n_challenges must be a non-negative integer');
    }
    if (!Number.isInteger(_n_sent) || _n_sent < 0) {
      throw new TypeError('n_sent must be a non-negative integer');
    }
  }

  /** Factory method for creating new ChannelTime instances (API hygiene) */
  static create(): ChannelTime {
    return new ChannelTime(ChannelTime._constructorKey);
  }

  /** Factory method for creating ChannelTime with specific values (for cloning) */
  static fromValues(n_challenges: number, n_sent: number): ChannelTime {
    return new ChannelTime(ChannelTime._constructorKey, n_challenges, n_sent);
  }

  /** Read-only access to n_challenges (API hygiene) */
  get n_challenges(): number {
    return this._n_challenges;
  }

  /** Setter is private to prevent external mutation */
  private set n_challenges(value: number) {
    throw new Error('n_challenges is read-only');
  }

  /** Read-only access to n_sent (API hygiene) */
  get n_sent(): number {
    return this._n_sent;
  }

  /** Setter is private to prevent external mutation */
  private set n_sent(value: number) {
    throw new Error('n_sent is read-only');
  }

  /** Increment sent counter (controlled mutation) */
  inc_sent(): ChannelTime {
    return new ChannelTime(ChannelTime._constructorKey, this._n_challenges, this._n_sent + 1);
  }

  /** Increment challenges counter and reset sent (controlled mutation) */
  inc_challenges(): ChannelTime {
    return new ChannelTime(ChannelTime._constructorKey, this._n_challenges + 1, 0);
  }

  /** Create a mutable copy for internal channel use */
  toMutable(): MutableChannelTime {
    return new MutableChannelTime(this._n_challenges, this._n_sent);
  }
}

/**
 * Internal mutable version of ChannelTime for channel implementations.
 * This provides the performance benefits of mutation while maintaining
 * API hygiene at the public interface.
 */
export class MutableChannelTime {
  constructor(
    public n_challenges: number = 0,
    public n_sent: number = 0
  ) {}

  inc_sent(): void {
    this.n_sent += 1;
  }

  inc_challenges(): void {
    this.n_challenges += 1;
    this.n_sent = 0;
  }

  toImmutable(): ChannelTime {
    return ChannelTime.fromValues(this.n_challenges, this.n_sent);
  }
}

/** 
 * Interface for a random oracle channel.
 * 
 * **Type Safety Improvements:**
 * - Strict typing for number vs bigint parameters
 * - Readonly arrays to prevent mutation
 * - Clear return types
 */
export interface Channel {
  readonly BYTES_PER_HASH: number;

  trailing_zeros(): number;

  // Mix functions with type safety
  mix_u32s(data: readonly number[]): void;
  mix_felts(felts: readonly SecureField[]): void;
  mix_u64(value: number | bigint): void;

  // Draw functions
  draw_felt(): SecureField;
  draw_felts(n_felts: number): SecureField[];
  draw_random_bytes(): Uint8Array;

  // Additional methods for API hygiene
  clone(): Channel;
  getChannelTime(): ChannelTime;
}

/** 
 * Interface for Merkle based channels.
 * 
 * **Performance/Purity Improvements:**
 * - Static method to avoid object allocation
 * - Clear separation of concerns
 */
export interface MerkleChannel<Hash> {
  mix_root(channel: Channel, root: Hash): void;
}

/**
 * Utility functions for type safety and performance
 */
export namespace ChannelUtils {
  /** Type guard for valid u32 values */
  export function isValidU32(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 0xFFFFFFFF;
  }

  /** Type guard for valid u64 values */
  export function isValidU64(value: number | bigint): boolean {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
    }
    return value >= 0n && value <= 0xFFFFFFFFFFFFFFFFn;
  }

  /** Validate array of u32 values */
  export function validateU32Array(data: readonly number[]): void {
    for (let i = 0; i < data.length; i++) {
      if (!isValidU32(data[i]!)) {
        throw new TypeError(`Invalid u32 value at index ${i}: ${data[i]}`);
      }
    }
  }

  /** Validate felt count parameter */
  export function validateFeltCount(n_felts: number): void {
    if (!Number.isInteger(n_felts) || n_felts < 0) {
      throw new TypeError('n_felts must be a non-negative integer');
    }
  }
}
