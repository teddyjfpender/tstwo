
// TODO: import type { PolyOps } from "./circle/ops";
// Once `circle/ops.ts` is ported, update this import path and ensure `PolyOps`
// matches the Rust trait.

import type { Coset } from "../circle";

/**
 * Precomputed twiddles for a specific coset tower.
 *
 * A coset tower is every repeated doubling of a `root_coset`. The largest
 * `CircleDomain` that can be FFTed using these twiddles is one with `root_coset`
 * as its `half_coset`.
 */
export class TwiddleTree<B, Twiddle> {
  /** The root coset of the tower. */
  rootCoset: Coset;

  /** Forward FFT twiddles. */
  twiddles: Twiddle;

  /** Inverse FFT twiddles. */
  itwiddles: Twiddle;

  constructor(rootCoset: Coset, twiddles: Twiddle, itwiddles: Twiddle) {
    this.rootCoset = rootCoset;
    this.twiddles = twiddles;
    this.itwiddles = itwiddles;
  }
}