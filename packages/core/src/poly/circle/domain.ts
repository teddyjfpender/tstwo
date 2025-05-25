import { Coset, CirclePoint, CirclePointIndex, M31_CIRCLE_LOG_ORDER } from "../../circle";
import { M31 } from "../../fields";

export const MAX_CIRCLE_DOMAIN_LOG_SIZE = M31_CIRCLE_LOG_ORDER - 1;

/**
 * A valid domain for circle polynomial interpolation and evaluation.
 *
 * Valid domains are a disjoint union of two conjugate cosets: `+-C + <G_n>`.
 * The ordering defined on this domain is `C + iG_n`, and then `-C - iG_n`.
 */
export class CircleDomain {
  public readonly halfCoset: Coset;

  /**
   * Private constructor to enforce API hygiene.
   * Use static factory methods instead.
   */
  private constructor(halfCoset: Coset) {
    this.halfCoset = halfCoset;
  }

  /**
   * Given a coset C + <G_n>, constructs the circle domain +-C + <G_n> (i.e.,
   * this coset and its conjugate).
   */
  static new(halfCoset: Coset): CircleDomain {
    return new CircleDomain(halfCoset);
  }

  /**
   * Iterates over all points in the domain.
   * The first iterated points are `c + <G>`, then `-c + <-G>`.
   */
  *iter(): IterableIterator<CirclePoint<M31>> {
    yield* this.halfCoset.iter();
    yield* this.halfCoset.conjugate().iter();
  }

  /**
   * Iterates over point indices.
   */
  *iterIndices(): IterableIterator<CirclePointIndex> {
    yield* this.halfCoset.iter_indices();
    yield* this.halfCoset.conjugate().iter_indices();
  }

  /**
   * Returns the size of the domain.
   */
  size(): number {
    return 1 << this.logSize();
  }

  /**
   * Returns the log size of the domain.
   */
  logSize(): number {
    return this.halfCoset.log_size + 1;
  }

  /**
   * Returns the `i`th domain element.
   */
  at(i: number): CirclePoint<M31> {
    // Type safety: ensure i is a non-negative integer
    if (!Number.isInteger(i) || i < 0) {
      throw new Error("i must be a non-negative integer");
    }
    return this.indexAt(i).to_point();
  }

  /**
   * Returns the [CirclePointIndex] of the `i`th domain element.
   */
  indexAt(i: number): CirclePointIndex {
    // Type safety: ensure i is a non-negative integer
    if (!Number.isInteger(i) || i < 0) {
      throw new Error("i must be a non-negative integer");
    }
    
    const halfSize = this.halfCoset.size();
    if (i < halfSize) {
      return this.halfCoset.index_at(i);
    } else {
      return this.halfCoset.index_at(i - halfSize).neg();
    }
  }

  /**
   * Returns true if the domain is canonic.
   *
   * Canonic domains are domains with elements that are the entire set of points defined by
   * `G_2n + <G_n>` where `G_n` and `G_2n` are obtained by repeatedly doubling
   * the circle generator.
   */
  isCanonic(): boolean {
    return this.halfCoset.initial_index.mul(4).value === this.halfCoset.step_size.value;
  }

  /**
   * Splits a circle domain into smaller [CircleDomain]s, shifted by offsets.
   */
  split(logParts: number): [CircleDomain, CirclePointIndex[]] {
    // Type safety: ensure logParts is a non-negative integer
    if (!Number.isInteger(logParts) || logParts < 0) {
      throw new Error("logParts must be a non-negative integer");
    }
    if (logParts > this.halfCoset.log_size) {
      throw new Error('logParts cannot exceed half coset log size');
    }
    
    const subdomain = CircleDomain.new(
      Coset.new(this.halfCoset.initial_index, this.halfCoset.log_size - logParts)
    );
    
    const shifts: CirclePointIndex[] = [];
    const numShifts = 1 << logParts;
    for (let i = 0; i < numShifts; i++) {
      shifts.push(this.halfCoset.step_size.mul(i));
    }
    
    return [subdomain, shifts];
  }

  /**
   * Returns a shifted domain by the given offset.
   */
  shift(shift: CirclePointIndex): CircleDomain {
    return CircleDomain.new(this.halfCoset.shift(shift));
  }

  /**
   * Enables `for...of` iteration over the domain points.
   */
  [Symbol.iterator](): IterableIterator<CirclePoint<M31>> {
    return this.iter();
  }

  // Rust-style method aliases for compatibility
  log_size(): number {
    return this.logSize();
  }

  index_at(i: number): CirclePointIndex {
    return this.indexAt(i);
  }
}
