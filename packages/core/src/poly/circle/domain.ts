/*
This is below is the domain.rs file that needs to be ported to this TypeScript domain.ts file.
```rs
(use comment from Rust file, omitted here for brevity)
```
*/

// TODO: import { Coset } from "../../circle";
// TODO: import { CirclePoint, CirclePointIndex } from "../../circle";
// TODO: import { M31_CIRCLE_LOG_ORDER } from "../../circle";
// Once the circle geometry module is implemented, update these imports.

// Placeholder constant until circle constants are ported.
export const MAX_CIRCLE_DOMAIN_LOG_SIZE = 0; // M31_CIRCLE_LOG_ORDER - 1

/** A valid domain for circle polynomial interpolation and evaluation. */
export class CircleDomain {
  halfCoset: any; // Coset

  constructor(halfCoset: any) {
    this.halfCoset = halfCoset;
  }

  /** Given a coset C + <G_n>, constructs the circle domain +-C + <G_n>. */
  static new(halfCoset: any): CircleDomain {
    return new CircleDomain(halfCoset);
  }

  /** Iterates over all points in the domain. */
  *iter(): IterableIterator<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const first: Iterable<any> = this.halfCoset.iter();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const second: Iterable<any> = this.halfCoset.conjugate().iter();
    yield* first;
    yield* second;
  }

  /** Iterates over point indices. */
  *iterIndices(): IterableIterator<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const first: Iterable<any> = this.halfCoset.iter_indices();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const second: Iterable<any> = this.halfCoset.conjugate().iter_indices();
    yield* first;
    yield* second;
  }

  /** Returns the size of the domain. */
  size(): number {
    return 1 << this.logSize();
  }

  /** Returns the log size of the domain. */
  logSize(): number {
    return this.halfCoset.log_size + 1;
  }

  /** Returns the `i`th domain element. */
  at(i: number): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.indexAt(i).to_point();
  }

  /** Returns the index of the `i`th domain element. */
  indexAt(i: number): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (i < this.halfCoset.size()) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return this.halfCoset.index_at(i);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return -this.halfCoset.index_at(i - this.halfCoset.size());
  }

  /** Returns true if the domain is canonic. */
  isCanonic(): boolean {
    return this.halfCoset.initial_index * 4 === this.halfCoset.step_size;
  }

  /** Splits a circle domain into smaller subdomains shifted by offsets. */
  split(logParts: number): [CircleDomain, any[]] {
    if (logParts > this.halfCoset.log_size) {
      throw new Error('logParts out of range');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const subdomain = CircleDomain.new(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.halfCoset.constructor.new(
        this.halfCoset.initial_index,
        this.halfCoset.log_size - logParts,
      ),
    );
    const shifts: any[] = [];
    for (let i = 0; i < 1 << logParts; i++) {
      shifts.push(this.halfCoset.step_size * i);
    }
    return [subdomain, shifts];
  }

  /** Returns a shifted domain by the given offset. */
  shift(shift: any): CircleDomain {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return CircleDomain.new(this.halfCoset.shift(shift));
  }

  /** Enables `for...of` iteration over the domain points. */
  [Symbol.iterator](): IterableIterator<any> {
    return this.iter();
  }
}
