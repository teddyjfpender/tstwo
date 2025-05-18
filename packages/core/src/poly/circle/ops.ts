/*
This is below is the ops.rs file that needs to be ported to this TypeScript ops.ts file.
```rs
use itertools::Itertools;

use super::{CanonicCoset, CircleDomain, CircleEvaluation, CirclePoly};
use crate::core::backend::ColumnOps;
use crate::core::circle::{CirclePoint, Coset};
use crate::core::fields::m31::BaseField;
use crate::core::fields::qm31::SecureField;
use crate::core::poly::twiddles::TwiddleTree;
use crate::core::poly::BitReversedOrder;
use crate::core::ColumnVec;

/// Operations on BaseField polynomials.
pub trait PolyOps: ColumnOps<BaseField> + Sized {
    // TODO(alont): Use a column instead of this type.
    /// The type for precomputed twiddles.
    type Twiddles;

    /// Computes a minimal [CirclePoly] that evaluates to the same values as this evaluation.
    /// Used by the [`CircleEvaluation::interpolate()`] function.
    fn interpolate(
        eval: CircleEvaluation<Self, BaseField, BitReversedOrder>,
        itwiddles: &TwiddleTree<Self>,
    ) -> CirclePoly<Self>;

    fn interpolate_columns(
        columns: impl IntoIterator<Item = CircleEvaluation<Self, BaseField, BitReversedOrder>>,
        twiddles: &TwiddleTree<Self>,
    ) -> Vec<CirclePoly<Self>> {
        columns
            .into_iter()
            .map(|eval| eval.interpolate_with_twiddles(twiddles))
            .collect()
    }

    /// Evaluates the polynomial at a single point.
    /// Used by the [`CirclePoly::eval_at_point()`] function.
    fn eval_at_point(poly: &CirclePoly<Self>, point: CirclePoint<SecureField>) -> SecureField;

    /// Extends the polynomial to a larger degree bound.
    /// Used by the [`CirclePoly::extend()`] function.
    fn extend(poly: &CirclePoly<Self>, log_size: u32) -> CirclePoly<Self>;

    /// Evaluates the polynomial at all points in the domain.
    /// Used by the [`CirclePoly::evaluate()`] function.
    fn evaluate(
        poly: &CirclePoly<Self>,
        domain: CircleDomain,
        twiddles: &TwiddleTree<Self>,
    ) -> CircleEvaluation<Self, BaseField, BitReversedOrder>;

    fn evaluate_polynomials(
        polynomials: &ColumnVec<CirclePoly<Self>>,
        log_blowup_factor: u32,
        twiddles: &TwiddleTree<Self>,
    ) -> Vec<CircleEvaluation<Self, BaseField, BitReversedOrder>> {
        polynomials
            .iter()
            .map(|poly| {
                poly.evaluate_with_twiddles(
                    CanonicCoset::new(poly.log_size() + log_blowup_factor).circle_domain(),
                    twiddles,
                )
            })
            .collect_vec()
    }

    /// Precomputes twiddles for a given coset.
    fn precompute_twiddles(coset: Coset) -> TwiddleTree<Self>;
}
```
*/

import type { CirclePoint, Coset } from "../../circle";
import type { SecureField } from "../../fields/qm31";
// Once the secure field implementation is available, replace `unknown` with
// `SecureField`.

import type { M31 as BaseField } from "../../fields/m31";
import type { CanonicCoset } from "./canonic";
import type { CircleDomain } from "./domain";
import type { CircleEvaluation, BitReversedOrder, ColumnOps } from "./evaluation";
import type { CirclePoly } from "./poly";
import type { TwiddleTree } from "../twiddles";

/**
 * Operations on base field polynomials.
 *
 * This interface mirrors the Rust `PolyOps` trait. Implementations should
 * provide efficient FFT and polynomial arithmetic routines specialized for a
 * particular backend `B`.
 */
export interface PolyOps<B extends ColumnOps<BaseField>, Twiddles = unknown>
  extends ColumnOps<BaseField> {
  /** Computes a polynomial that evaluates to the given values. */
  interpolate(
    eval_: CircleEvaluation<B, BaseField, BitReversedOrder>,
    itwiddles: TwiddleTree<B, Twiddles>,
  ): CirclePoly<B>;

  /**
   * Computes multiple polynomials by interpolating each evaluation column.
   *
   * Implementations may override this for efficiency. The default logic is
   * provided by {@link interpolateColumnsDefault}.
   */
  interpolateColumns?(
    columns: Iterable<CircleEvaluation<B, BaseField, BitReversedOrder>>,
    twiddles: TwiddleTree<B, Twiddles>,
  ): CirclePoly<B>[];

  /** Evaluates the polynomial at a single point. */
  evalAtPoint(poly: CirclePoly<B>, point: unknown /* CirclePoint<SecureField> */): unknown /* SecureField */;

  /** Extends the polynomial to a larger degree bound. */
  extend(poly: CirclePoly<B>, logSize: number): CirclePoly<B>;

  /** Evaluates the polynomial over an entire domain. */
  evaluate(
    poly: CirclePoly<B>,
    domain: CircleDomain,
    twiddles: TwiddleTree<B, Twiddles>,
  ): CircleEvaluation<B, BaseField, BitReversedOrder>;

  /**
   * Evaluates multiple polynomials on a larger domain with a blowup factor.
   *
   * Implementations may override this for efficiency. The default logic is
   * provided by {@link evaluatePolynomialsDefault}.
   */
  evaluatePolynomials?(
    polynomials: readonly CirclePoly<B>[],
    logBlowupFactor: number,
    twiddles: TwiddleTree<B, Twiddles>,
  ): CircleEvaluation<B, BaseField, BitReversedOrder>[];

  /** Precomputes twiddles for a given coset. */
  precomputeTwiddles(coset: unknown /* Coset */): TwiddleTree<B, Twiddles>;
}

/**
 * Default implementation of `interpolateColumns` following the behavior of the
 * Rust trait. It iterates over the provided evaluations and interpolates each
 * one using the given twiddle tree.
 */
export function interpolateColumnsDefault<B extends ColumnOps<BaseField>, T>(
  columns: Iterable<CircleEvaluation<B, BaseField, BitReversedOrder>>,
  twiddles: TwiddleTree<B, T>,
): CirclePoly<B>[] {
  const result: CirclePoly<B>[] = [];
  for (const evaluation of columns) {
    result.push(evaluation.interpolateWithTwiddles(twiddles));
  }
  return result;
}

/**
 * Default implementation of `evaluatePolynomials` following the Rust trait. It
 * evaluates each polynomial on a blown-up canonic domain using the supplied
 * twiddle tree.
 */
export function evaluatePolynomialsDefault<B extends ColumnOps<BaseField>, T>(
  polynomials: readonly CirclePoly<B>[],
  logBlowupFactor: number,
  twiddles: TwiddleTree<B, T>,
  CanonicCosetCtor: { new (logSize: number): CanonicCoset },
): CircleEvaluation<B, BaseField, BitReversedOrder>[] {
  return polynomials.map((poly) =>
    poly.evaluateWithTwiddles(
      new CanonicCosetCtor(poly.logSize() + logBlowupFactor).circleDomain(),
      twiddles,
    ),
  );
}


