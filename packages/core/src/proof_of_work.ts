import type { Channel } from './channel';

/**
 * Trait for proof-of-work grinding operations.
 * 
 * **World-Leading Improvements:**
 * - Type safety with strict channel constraints
 * - Clear separation of number vs bigint logic
 * - API hygiene with controlled entry points
 * - Performance optimizations with static constants
 */
export interface GrindOps<C extends Channel> {
  /**
   * Searches for a nonce such that mixing it to the channel makes the digest 
   * have `powBits` leading zero bits.
   * 
   * @param channel - The channel to grind on (must implement Channel interface)
   * @param powBits - Number of leading zero bits required (must be non-negative integer)
   * @returns The nonce value as a 64-bit number
   * 
   * **Type Safety:** Validates powBits is a non-negative integer
   * **Performance:** Returns number for compatibility with JavaScript's safe integer range
   */
  grind(channel: C, powBits: number): number;
}

/**
 * Utility namespace for proof-of-work operations with type safety and validation.
 * 
 * **API Hygiene:** Centralized validation and utility functions
 */
export namespace ProofOfWork {
  /** Maximum safe pow bits to prevent infinite loops */
  export const MAX_POW_BITS = 64 as const;
  
  /** Minimum pow bits (must be at least 0) */
  export const MIN_POW_BITS = 0 as const;

  /**
   * Validates pow bits parameter for type safety.
   * 
   * @param powBits - The pow bits value to validate
   * @throws TypeError if powBits is not a valid non-negative integer
   */
  export function validatePowBits(powBits: number): void {
    if (!Number.isInteger(powBits)) {
      throw new TypeError('powBits must be an integer');
    }
    if (powBits < MIN_POW_BITS) {
      throw new TypeError(`powBits must be at least ${MIN_POW_BITS}`);
    }
    if (powBits > MAX_POW_BITS) {
      throw new TypeError(`powBits must be at most ${MAX_POW_BITS}`);
    }
  }

  /**
   * Type guard to check if a value is a valid channel.
   * 
   * @param channel - The value to check
   * @returns true if the value implements the Channel interface
   */
  export function isValidChannel(channel: unknown): channel is Channel {
    return (
      typeof channel === 'object' &&
      channel !== null &&
      'trailing_zeros' in channel &&
      'mix_u64' in channel &&
      'draw_random_bytes' in channel &&
      typeof (channel as any).trailing_zeros === 'function' &&
      typeof (channel as any).mix_u64 === 'function' &&
      typeof (channel as any).draw_random_bytes === 'function'
    );
  }

  /**
   * Validates that a channel implements the required interface.
   * 
   * @param channel - The channel to validate
   * @throws TypeError if channel doesn't implement Channel interface
   */
  export function validateChannel<C extends Channel>(channel: C): void {
    if (!isValidChannel(channel)) {
      throw new TypeError('channel must implement Channel interface');
    }
  }

  /**
   * Converts a number to a 64-bit representation for mixing.
   * Handles both number and bigint inputs safely.
   * 
   * @param value - The value to convert (number or bigint)
   * @returns The value as a number or bigint suitable for mixing
   */
  export function toU64(value: number | bigint): number | bigint {
    if (typeof value === 'bigint') {
      // Ensure it fits in u64 range
      if (value < 0n || value > 0xFFFFFFFFFFFFFFFFn) {
        throw new RangeError('bigint value must be in u64 range [0, 2^64-1]');
      }
      return value;
    }
    
    // For numbers, ensure they're in safe integer range
    if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('number value must be a non-negative safe integer');
    }
    
    return value;
  }
}

