/*
This is below is the canonic.rs file that needs to be ported to this TypeScript canonic.ts file.
```rs
use super::CircleDomain;
use crate::core::circle::{CirclePoint, CirclePointIndex, Coset};
use crate::core::fields::m31::BaseField;

/// A coset of the form `G_{2n} + <G_n>`, where `G_n` is the generator of the subgroup of order `n`.
///
/// The ordering on this coset is `G_2n + i * G_n`.
/// These cosets can be used as a [`CircleDomain`], and be interpolated on.
/// Note that this changes the ordering on the coset to be like [`CircleDomain`],
/// which is `G_{2n} + i * G_{n/2}` and then `-G_{2n} -i * G_{n/2}`.
/// For example, the `X`s below are a canonic coset with `n=8`.
///
/// ```text
///    X O X
///  O       O
/// X         X
/// O         O
/// X         X
///  O       O
///    X O X
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct CanonicCoset {
    pub coset: Coset,
}

impl CanonicCoset {
    pub fn new(log_size: u32) -> Self {
        assert!(log_size > 0);
        Self {
            coset: Coset::odds(log_size),
        }
    }

    /// Gets the full coset represented G_{2n} + <G_n>.
    pub const fn coset(&self) -> Coset {
        self.coset
    }

    /// Gets half of the coset (its conjugate complements to the whole coset), G_{2n} + <G_{n/2}>
    pub fn half_coset(&self) -> Coset {
        Coset::half_odds(self.log_size() - 1)
    }

    /// Gets the [CircleDomain] representing the same point set (in another order).
    pub fn circle_domain(&self) -> CircleDomain {
        CircleDomain::new(self.half_coset())
    }

    /// Returns the log size of the coset.
    pub const fn log_size(&self) -> u32 {
        self.coset.log_size
    }

    /// Returns the size of the coset.
    pub const fn size(&self) -> usize {
        self.coset.size()
    }

    pub const fn initial_index(&self) -> CirclePointIndex {
        self.coset.initial_index
    }

    pub const fn step_size(&self) -> CirclePointIndex {
        self.coset.step_size
    }

    pub const fn step(&self) -> CirclePoint<BaseField> {
        self.coset.step
    }

    pub fn index_at(&self, index: usize) -> CirclePointIndex {
        self.coset.index_at(index)
    }

    pub fn at(&self, i: usize) -> CirclePoint<BaseField> {
        self.coset.at(i)
    }
}
```
*/

// Import the circle domain once implemented. This mirrors the Rust `mod.rs` re-export
// structure where `CanonicCoset` provides convenience constructors for a
// corresponding `CircleDomain`.
import { CircleDomain } from "./domain";
import { Coset, CirclePoint, CirclePointIndex } from "../../circle";
import type { M31 as BaseField } from "../../fields/m31";

/** A coset of the form `G_{2n} + <G_n>` used for circle FFT domains. */
export class CanonicCoset {
  coset: Coset;

  constructor(coset: Coset) {
    this.coset = coset;
  }

  /**
   * Constructs a canonic coset of size `2^logSize`.
   *
   * Panics in Rust if `log_size` is zero. Here we throw an `Error`.
   */
  static new(logSize: number): CanonicCoset {
    if (logSize <= 0) {
      throw new Error("log_size must be greater than 0");
    }
    return new CanonicCoset(Coset.odds(logSize));
  }

  /** Returns the underlying full coset `G_{2n} + <G_n>`. */
  cosetFull(): Coset {
    return this.coset;
  }

  /** Returns half of the coset `G_{2n} + <G_{n/2}>`. */
  halfCoset(): Coset {
    return Coset.half_odds(this.logSize() - 1);
  }

  /** Converts to a `CircleDomain` representing the same point set. */
  circleDomain(): CircleDomain {
    return CircleDomain.new(this.halfCoset());
  }

  /** Logarithmic size of the coset. */
  logSize(): number {
    return this.coset.log_size;
  }

  /** Size of the coset. */
  size(): number {
    return this.coset.size();
  }

  initialIndex(): CirclePointIndex {
    return this.coset.initial_index;
  }

  stepSize(): CirclePointIndex {
    return this.coset.step_size;
  }

  step(): CirclePoint<BaseField> {
    return this.coset.step;
  }

  indexAt(index: number): CirclePointIndex {
    return this.coset.index_at(index);
  }

  at(i: number): CirclePoint<BaseField> {
    return this.coset.at(i);
  }
}


