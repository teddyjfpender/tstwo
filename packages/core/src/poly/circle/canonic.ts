import { Coset, CirclePoint, CirclePointIndex } from "../../circle";
import type { M31 as BaseField } from "../../fields/m31";
import { CircleDomain } from "./domain";

/**
 * A coset of the form `G_{2n} + <G_n>`, where `G_n` is the generator of the subgroup of order `n`.
 *
 * The ordering on this coset is `G_2n + i * G_n`.
 * These cosets can be used as a [`CircleDomain`], and be interpolated on.
 * Note that this changes the ordering on the coset to be like [`CircleDomain`],
 * which is `G_{2n} + i * G_{n/2}` and then `-G_{2n} -i * G_{n/2}`.
 * For example, the `X`s below are a canonic coset with `n=8`.
 *
 * ```text
 *    X O X
 *  O       O
 * X         X
 * O         O
 * X         X
 *  O       O
 *    X O X
 * ```
 */
export class CanonicCoset {
  public readonly coset: Coset;

  /**
   * Private constructor to enforce API hygiene.
   * Use static factory methods instead.
   */
  private constructor(coset: Coset) {
    this.coset = coset;
  }

  /**
   * Constructs a canonic coset of size `2^logSize`.
   * 
   * @param logSize - Must be a positive integer
   * @throws {Error} If logSize is not a positive integer
   */
  static new(logSize: number): CanonicCoset {
    // Type safety: integer assertions
    if (!Number.isInteger(logSize) || logSize <= 0) {
      throw new Error("log_size must be a positive integer");
    }
    
    return new CanonicCoset(Coset.odds(logSize));
  }

  /**
   * Gets half of the coset (its conjugate complements to the whole coset), G_{2n} + <G_{n/2}>
   */
  half_coset(): Coset {
    return Coset.half_odds(this.log_size() - 1);
  }

  /**
   * Gets the [CircleDomain] representing the same point set (in another order).
   */
  circle_domain(): CircleDomain {
    return CircleDomain.new(this.half_coset());
  }

  /**
   * Returns the log size of the coset.
   */
  log_size(): number {
    return this.coset.log_size;
  }

  /**
   * Returns the size of the coset.
   */
  size(): number {
    return this.coset.size();
  }

  initial_index(): CirclePointIndex {
    return this.coset.initial_index;
  }

  step_size(): CirclePointIndex {
    return this.coset.step_size;
  }

  step(): CirclePoint<BaseField> {
    return this.coset.step;
  }

  index_at(index: number): CirclePointIndex {
    // Type safety: ensure index is a non-negative integer
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("index must be a non-negative integer");
    }
    return this.coset.index_at(index);
  }

  at(i: number): CirclePoint<BaseField> {
    // Type safety: ensure i is a non-negative integer
    if (!Number.isInteger(i) || i < 0) {
      throw new Error("i must be a non-negative integer");
    }
    return this.coset.at(i);
  }

  // TypeScript-style method aliases for better ergonomics
  logSize(): number {
    return this.log_size();
  }

  halfCoset(): Coset {
    return this.half_coset();
  }

  circleDomain(): CircleDomain {
    return this.circle_domain();
  }

  initialIndex(): CirclePointIndex {
    return this.initial_index();
  }

  stepSize(): CirclePointIndex {
    return this.step_size();
  }

  indexAt(index: number): CirclePointIndex {
    return this.index_at(index);
  }
}


