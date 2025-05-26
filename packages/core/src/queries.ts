// Queries implementation

/** Interface for a channel capable of providing random bytes. */
export interface QueryChannel {
  draw_random_bytes(): Uint8Array;
}

// Static constants for performance (world-leading improvement)
export const UPPER_BOUND_QUERY_BYTES = 4 as const;

/**
 * An ordered set of query positions.
 * 
 * **World-Leading Improvements:**
 * - Private constructor for API hygiene
 * - Type safety with integer assertions
 * - Performance optimizations with static constants
 * - Clear separation of number vs bigint logic
 * - Immutable public interface with controlled mutation
 */
export class Queries {
  private static readonly _constructorKey = Symbol('Queries.constructor');
  
  private constructor(
    key: symbol,
    private readonly _positions: readonly number[],
    private readonly _logDomainSize: number
  ) {
    if (key !== Queries._constructorKey) {
      throw new Error('Queries constructor is private. Use factory methods.');
    }
    
    // Type safety: integer assertions (world-leading improvement)
    if (!Number.isInteger(_logDomainSize) || _logDomainSize < 0) {
      throw new TypeError('logDomainSize must be a non-negative integer');
    }
    
    // Validate positions are sorted and within domain
    const maxQuery = (1 << _logDomainSize) - 1;
    for (let i = 0; i < _positions.length; i++) {
      const pos = _positions[i]!;
      if (!Number.isInteger(pos) || pos < 0 || pos > maxQuery) {
        throw new TypeError(`Invalid position at index ${i}: ${pos}`);
      }
      if (i > 0 && _positions[i - 1]! > pos) {
        throw new TypeError('Positions must be sorted in ascending order');
      }
    }
  }

  /** Factory method for creating Queries from generation (API hygiene) */
  static generate(
    channel: QueryChannel,
    logDomainSize: number,
    nQueries: number,
  ): Queries {
    // Type safety validations
    if (!Number.isInteger(logDomainSize) || logDomainSize < 0) {
      throw new TypeError('logDomainSize must be a non-negative integer');
    }
    if (!Number.isInteger(nQueries) || nQueries < 0) {
      throw new TypeError('nQueries must be a non-negative integer');
    }
    if (logDomainSize > 31) {
      throw new TypeError('logDomainSize must be at most 31 for JavaScript safety');
    }
    
    const queries = new Set<number>();
    const maxQuery = (1 << logDomainSize) - 1;
    
    while (queries.size < nQueries) {
      const bytes = channel.draw_random_bytes();
      for (let i = 0; i + UPPER_BOUND_QUERY_BYTES <= bytes.length; i += UPPER_BOUND_QUERY_BYTES) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + i, UPPER_BOUND_QUERY_BYTES);
        const bits = view.getUint32(0, true); // Little-endian
        queries.add(bits & maxQuery);
        if (queries.size === nQueries) break;
      }
    }
    
    return new Queries(
      Queries._constructorKey,
      Array.from(queries).sort((a, b) => a - b),
      logDomainSize
    );
  }

  /** Factory method for creating Queries from positions (API hygiene) */
  static fromPositions(positions: readonly number[], logDomainSize: number): Queries {
    // Type safety validations
    if (!Number.isInteger(logDomainSize) || logDomainSize < 0) {
      throw new TypeError('logDomainSize must be a non-negative integer');
    }
    if (logDomainSize > 31) {
      throw new TypeError('logDomainSize must be at most 31 for JavaScript safety');
    }
    
    const max = 1 << logDomainSize;
    
    // Validate positions
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (p === undefined) {
        throw new TypeError(`Position at index ${i} is undefined`);
      }
      if (!Number.isInteger(p) || p < 0 || p >= max) {
        throw new TypeError(`Invalid position at index ${i}: ${p}`);
      }
      if (i > 0) {
        const prev = positions[i - 1];
        if (prev !== undefined && prev > p) {
          throw new TypeError('Positions must be sorted in ascending order');
        }
      }
    }
    
    return new Queries(Queries._constructorKey, [...positions], logDomainSize);
  }

  /**
   * Calculates the matching query indices in a folded domain.
   * Each domain point is doubled given `this` (the queries of the original domain) 
   * and the number of folds between domains.
   */
  fold(nFolds: number): Queries {
    // Type safety validations
    if (!Number.isInteger(nFolds) || nFolds < 0) {
      throw new TypeError('nFolds must be a non-negative integer');
    }
    if (nFolds > this._logDomainSize) {
      throw new Error('nFolds too large');
    }
    
    // Performance optimization: use Set for deduplication, then sort
    const folded = Array.from(new Set(this._positions.map((q) => q >> nFolds)));
    folded.sort((a, b) => a - b);
    
    return new Queries(
      Queries._constructorKey,
      folded,
      this._logDomainSize - nFolds
    );
  }

  /** Read-only access to positions (API hygiene) */
  get positions(): readonly number[] {
    return this._positions;
  }

  /** Read-only access to log domain size (API hygiene) */
  get log_domain_size(): number {
    return this._logDomainSize;
  }

  /** Get the number of queries */
  get length(): number {
    return this._positions.length;
  }

  /** Iterator support for positions */
  [Symbol.iterator](): Iterator<number> {
    return this._positions[Symbol.iterator]();
  }

  /** Create a deep clone of the queries */
  clone(): Queries {
    return new Queries(Queries._constructorKey, [...this._positions], this._logDomainSize);
  }

  /** Check equality with another Queries instance */
  equals(other: Queries): boolean {
    return (
      this._logDomainSize === other._logDomainSize &&
      this._positions.length === other._positions.length &&
      this._positions.every((pos, i) => pos === other._positions[i])
    );
  }

  /** Convert to a plain object for serialization */
  toJSON(): { positions: number[]; logDomainSize: number } {
    return {
      positions: [...this._positions],
      logDomainSize: this._logDomainSize,
    };
  }

  /** Create from a plain object (for deserialization) */
  static fromJSON(data: { positions: number[]; logDomainSize: number }): Queries {
    return Queries.fromPositions(data.positions, data.logDomainSize);
  }
}

/**
 * Utility namespace for query operations with type safety and validation.
 * 
 * **API Hygiene:** Centralized validation and utility functions
 */
export namespace QueryUtils {
  /** Maximum safe log domain size for JavaScript */
  export const MAX_LOG_DOMAIN_SIZE = 31 as const;
  
  /** Minimum log domain size */
  export const MIN_LOG_DOMAIN_SIZE = 0 as const;

  /**
   * Validates log domain size parameter for type safety.
   * 
   * @param logDomainSize - The log domain size to validate
   * @throws TypeError if logDomainSize is not a valid non-negative integer
   */
  export function validateLogDomainSize(logDomainSize: number): void {
    if (!Number.isInteger(logDomainSize)) {
      throw new TypeError('logDomainSize must be an integer');
    }
    if (logDomainSize < MIN_LOG_DOMAIN_SIZE) {
      throw new TypeError(`logDomainSize must be at least ${MIN_LOG_DOMAIN_SIZE}`);
    }
    if (logDomainSize > MAX_LOG_DOMAIN_SIZE) {
      throw new TypeError(`logDomainSize must be at most ${MAX_LOG_DOMAIN_SIZE}`);
    }
  }

  /**
   * Validates number of queries parameter for type safety.
   * 
   * @param nQueries - The number of queries to validate
   * @throws TypeError if nQueries is not a valid non-negative integer
   */
  export function validateNQueries(nQueries: number): void {
    if (!Number.isInteger(nQueries)) {
      throw new TypeError('nQueries must be an integer');
    }
    if (nQueries < 0) {
      throw new TypeError('nQueries must be non-negative');
    }
  }

  /**
   * Type guard to check if a value is a valid query channel.
   * 
   * @param channel - The value to check
   * @returns true if the value implements the QueryChannel interface
   */
  export function isValidQueryChannel(channel: unknown): channel is QueryChannel {
    return (
      typeof channel === 'object' &&
      channel !== null &&
      'draw_random_bytes' in channel &&
      typeof (channel as any).draw_random_bytes === 'function'
    );
  }

  /**
   * Validates that a channel implements the required interface.
   * 
   * @param channel - The channel to validate
   * @throws TypeError if channel doesn't implement QueryChannel interface
   */
  export function validateQueryChannel(channel: QueryChannel): void {
    if (!isValidQueryChannel(channel)) {
      throw new TypeError('channel must implement QueryChannel interface');
    }
  }
}
