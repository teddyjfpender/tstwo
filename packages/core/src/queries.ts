// Queries implementation

/** Interface for a channel capable of providing random bytes. */
export interface QueryChannel {
  draw_random_bytes(): Uint8Array;
}

export const UPPER_BOUND_QUERY_BYTES = 4;

/** Ordered set of query positions. */
export class Queries {
  positions: number[];
  log_domain_size: number;

  constructor(positions: number[], logDomainSize: number) {
    this.positions = positions.slice().sort((a, b) => a - b);
    this.log_domain_size = logDomainSize;
  }

  static generate(
    channel: QueryChannel,
    logDomainSize: number,
    nQueries: number,
  ): Queries {
    const queries = new Set<number>();
    const maxQuery = (1 << logDomainSize) - 1;
    while (queries.size < nQueries) {
      const bytes = channel.draw_random_bytes();
      for (let i = 0; i + UPPER_BOUND_QUERY_BYTES <= bytes.length; i += UPPER_BOUND_QUERY_BYTES) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + i, UPPER_BOUND_QUERY_BYTES);
        const bits = view.getUint32(0, true);
        queries.add(bits & maxQuery);
        if (queries.size === nQueries) break;
      }
    }
    return new Queries(Array.from(queries), logDomainSize);
  }

  fold(nFolds: number): Queries {
    if (nFolds > this.log_domain_size) throw new Error("n_folds too large");
    const folded = Array.from(new Set(this.positions.map((q) => q >> nFolds)));
    folded.sort((a, b) => a - b);
    return new Queries(folded, this.log_domain_size - nFolds);
  }

  static from_positions(positions: number[], logDomainSize: number): Queries {
    const max = 1 << logDomainSize;
    if (!positions.every((p, i) => p < max && (i === 0 || positions[i - 1] <= p))) {
      throw new Error("invalid positions");
    }
    return new Queries(positions, logDomainSize);
  }

  get length(): number {
    return this.positions.length;
  }

  [Symbol.iterator](): Iterator<number> {
    return this.positions[Symbol.iterator]();
  }
}
