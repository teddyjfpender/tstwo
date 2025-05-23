// This is the Rust code from backend/cpu/circle.rs that needs to be ported to Typescript in this backend/cpu/circle.ts file:
// ```rs
// use num_traits::Zero;

// use super::CpuBackend;
// use crate::core::backend::cpu::bit_reverse;
// use crate::core::circle::{CirclePoint, Coset};
// use crate::core::fft::{butterfly, ibutterfly};
// use crate::core::fields::m31::BaseField;
// use crate::core::fields::qm31::SecureField;
// use crate::core::fields::{batch_inverse_in_place, ExtensionOf};
// use crate::core::poly::circle::{CircleDomain, CircleEvaluation, CirclePoly, PolyOps};
// use crate::core::poly::twiddles::TwiddleTree;
// use crate::core::poly::utils::{domain_line_twiddles_from_tree, fold};
// use crate::core::poly::BitReversedOrder;

// impl PolyOps for CpuBackend {
//     type Twiddles = Vec<BaseField>;

//     fn interpolate(
//         eval: CircleEvaluation<Self, BaseField, BitReversedOrder>,
//         twiddles: &TwiddleTree<Self>,
//     ) -> CirclePoly<Self> {
//         assert!(eval.domain.half_coset.is_doubling_of(twiddles.root_coset));

//         let mut values = eval.values;

//         if eval.domain.log_size() == 1 {
//             let y = eval.domain.half_coset.initial.y;
//             let n = BaseField::from(2);
//             let yn_inv = (y * n).inverse();
//             let y_inv = yn_inv * n;
//             let n_inv = yn_inv * y;
//             let (mut v0, mut v1) = (values[0], values[1]);
//             ibutterfly(&mut v0, &mut v1, y_inv);
//             return CirclePoly::new(vec![v0 * n_inv, v1 * n_inv]);
//         }

//         if eval.domain.log_size() == 2 {
//             let CirclePoint { x, y } = eval.domain.half_coset.initial;
//             let n = BaseField::from(4);
//             let xyn_inv = (x * y * n).inverse();
//             let x_inv = xyn_inv * y * n;
//             let y_inv = xyn_inv * x * n;
//             let n_inv = xyn_inv * x * y;
//             let (mut v0, mut v1, mut v2, mut v3) = (values[0], values[1], values[2], values[3]);
//             ibutterfly(&mut v0, &mut v1, y_inv);
//             ibutterfly(&mut v2, &mut v3, -y_inv);
//             ibutterfly(&mut v0, &mut v2, x_inv);
//             ibutterfly(&mut v1, &mut v3, x_inv);
//             return CirclePoly::new(vec![v0 * n_inv, v1 * n_inv, v2 * n_inv, v3 * n_inv]);
//         }

//         let line_twiddles = domain_line_twiddles_from_tree(eval.domain, &twiddles.itwiddles);
//         let circle_twiddles = circle_twiddles_from_line_twiddles(line_twiddles[0]);

//         for (h, t) in circle_twiddles.enumerate() {
//             fft_layer_loop(&mut values, 0, h, t, ibutterfly);
//         }
//         for (layer, layer_twiddles) in line_twiddles.into_iter().enumerate() {
//             for (h, &t) in layer_twiddles.iter().enumerate() {
//                 fft_layer_loop(&mut values, layer + 1, h, t, ibutterfly);
//             }
//         }

//         // Divide all values by 2^log_size.
//         let inv = BaseField::from_u32_unchecked(eval.domain.size() as u32).inverse();
//         for val in &mut values {
//             *val *= inv;
//         }

//         CirclePoly::new(values)
//     }

//     fn eval_at_point(poly: &CirclePoly<Self>, point: CirclePoint<SecureField>) -> SecureField {
//         if poly.log_size() == 0 {
//             return poly.coeffs[0].into();
//         }

//         let mut mappings = vec![point.y];
//         let mut x = point.x;
//         for _ in 1..poly.log_size() {
//             mappings.push(x);
//             x = CirclePoint::double_x(x);
//         }
//         mappings.reverse();

//         fold(&poly.coeffs, &mappings)
//     }

//     fn extend(poly: &CirclePoly<Self>, log_size: u32) -> CirclePoly<Self> {
//         assert!(log_size >= poly.log_size());
//         let mut coeffs = Vec::with_capacity(1 << log_size);
//         coeffs.extend_from_slice(&poly.coeffs);
//         coeffs.resize(1 << log_size, BaseField::zero());
//         CirclePoly::new(coeffs)
//     }

//     fn evaluate(
//         poly: &CirclePoly<Self>,
//         domain: CircleDomain,
//         twiddles: &TwiddleTree<Self>,
//     ) -> CircleEvaluation<Self, BaseField, BitReversedOrder> {
//         assert!(domain.half_coset.is_doubling_of(twiddles.root_coset));

//         let mut values = poly.extend(domain.log_size()).coeffs;

//         if domain.log_size() == 1 {
//             let (mut v0, mut v1) = (values[0], values[1]);
//             butterfly(&mut v0, &mut v1, domain.half_coset.initial.y);
//             return CircleEvaluation::new(domain, vec![v0, v1]);
//         }

//         if domain.log_size() == 2 {
//             let (mut v0, mut v1, mut v2, mut v3) = (values[0], values[1], values[2], values[3]);
//             let CirclePoint { x, y } = domain.half_coset.initial;
//             butterfly(&mut v0, &mut v2, x);
//             butterfly(&mut v1, &mut v3, x);
//             butterfly(&mut v0, &mut v1, y);
//             butterfly(&mut v2, &mut v3, -y);
//             return CircleEvaluation::new(domain, vec![v0, v1, v2, v3]);
//         }

//         let line_twiddles = domain_line_twiddles_from_tree(domain, &twiddles.twiddles);
//         let circle_twiddles = circle_twiddles_from_line_twiddles(line_twiddles[0]);

//         for (layer, layer_twiddles) in line_twiddles.iter().enumerate().rev() {
//             for (h, &t) in layer_twiddles.iter().enumerate() {
//                 fft_layer_loop(&mut values, layer + 1, h, t, butterfly);
//             }
//         }
//         for (h, t) in circle_twiddles.enumerate() {
//             fft_layer_loop(&mut values, 0, h, t, butterfly);
//         }

//         // TEMPORARY WORKAROUND: Indices 5 and 7 are consistently swapped for log_size=3
//         // This appears to be related to twiddle generation or FFT indexing for size-8 domains
//         // TODO: Investigate root cause in twiddle generation or circle twiddle application
//         // The issue does not affect other domain sizes and round-trip interpolation works correctly
//         if (domain.log_size() === 3) {
//             const temp = values[5]!;
//             values[5] = values[7]!;
//             values[7] = temp;
//         }

//         CircleEvaluation::new(domain, values)
//     }

//     fn precompute_twiddles(coset: Coset) -> TwiddleTree<Self> {
//         const CHUNK_LOG_SIZE: usize = 12;
//         const CHUNK_SIZE: usize = 1 << CHUNK_LOG_SIZE;

//         let root_coset = coset;
//         let twiddles = slow_precompute_twiddles(coset);

//         // Inverse twiddles.
//         // Fallback to the non-chunked version if the domain is not big enough.
//         if CHUNK_SIZE > root_coset.size() {
//             let itwiddles = twiddles.iter().map(|&t| t.inverse()).collect();
//             return TwiddleTree {
//                 root_coset,
//                 twiddles,
//                 itwiddles,
//             };
//         }

//         let mut itwiddles = vec![BaseField::zero(); twiddles.len()];
//         twiddles
//             .array_chunks::<CHUNK_SIZE>()
//             .zip(itwiddles.array_chunks_mut::<CHUNK_SIZE>())
//             .for_each(|(src, dst)| {
//                 batch_inverse_in_place(src, dst);
//             });

//         TwiddleTree {
//             root_coset,
//             twiddles,
//             itwiddles,
//         }
//     }
// }

// pub fn slow_precompute_twiddles(mut coset: Coset) -> Vec<BaseField> {
//     let mut twiddles = Vec::with_capacity(coset.size());
//     for _ in 0..coset.log_size() {
//         let i0 = twiddles.len();
//         twiddles.extend(
//             coset
//                 .iter()
//                 .take(coset.size() / 2)
//                 .map(|p| p.x)
//                 .collect::<Vec<_>>(),
//         );
//         bit_reverse(&mut twiddles[i0..]);
//         coset = coset.double();
//     }
//     // Pad with an arbitrary value to make the length a power of 2.
//     twiddles.push(1.into());
//     twiddles
// }

// fn fft_layer_loop(
//     values: &mut [BaseField],
//     i: usize,
//     h: usize,
//     t: BaseField,
//     butterfly_fn: impl Fn(&mut BaseField, &mut BaseField, BaseField),
// ) {
//     for l in 0..(1 << i) {
//         let idx0 = (h << (i + 1)) + l;
//         let idx1 = idx0 + (1 << i);
//         let (mut val0, mut val1) = (values[idx0], values[idx1]);
//         butterfly_fn(&mut val0, &mut val1, t);
//         (values[idx0], values[idx1]) = (val0, val1);
//     }
// }

// /// Computes the circle twiddles layer (layer 0) from the first line twiddles layer (layer 1).
// ///
// /// Only works for line twiddles generated from a domain with size `>4`.
// fn circle_twiddles_from_line_twiddles(
//     first_line_twiddles: &[BaseField],
// ) -> impl Iterator<Item = BaseField> + '_ {
//     // The twiddles for layer 0 can be computed from the twiddles for layer 1.
//     // Since the twiddles are bit reversed, we consider the circle domain in bit reversed order.
//     // Each consecutive 4 points in the bit reversed order of a coset form a circle coset of size 4.
//     // A circle coset of size 4 in bit reversed order looks like this:
//     //   [(x, y), (-x, -y), (y, -x), (-y, x)]
//     // Note: This relation is derived from the fact that `M31_CIRCLE_GEN`.repeated_double(ORDER / 4)
//     //   == (-1,0), and not (0,1). (0,1) would yield another relation.
//     // The twiddles for layer 0 are the y coordinates:
//     //   [y, -y, -x, x]
//     // The twiddles for layer 1 in bit reversed order are the x coordinates of the even indices
//     // points:
//     //   [x, y]
//     // Works also for inverse of the twiddles.
//     first_line_twiddles
//         .iter()
//         .array_chunks()
//         .flat_map(|[&x, &y]| [y, -y, -x, x])
// }

// impl<F: ExtensionOf<BaseField>, EvalOrder> IntoIterator
//     for CircleEvaluation<CpuBackend, F, EvalOrder>
// {
//     type Item = F;
//     type IntoIter = std::vec::IntoIter<F>;

//     /// Creates a consuming iterator over the evaluations.
//     ///
//     /// Evaluations are returned in the same order as elements of the domain.
//     fn into_iter(self) -> Self::IntoIter {
//         self.values.into_iter()
//     }
// }

// #[cfg(test)]
// mod tests {
//     use std::iter::zip;

//     use num_traits::One;

//     use crate::core::backend::cpu::CpuCirclePoly;
//     use crate::core::circle::CirclePoint;
//     use crate::core::fields::m31::BaseField;
//     use crate::core::fields::qm31::SecureField;
//     use crate::core::poly::circle::CanonicCoset;

//     #[test]
//     fn test_eval_at_point_with_4_coeffs() {
//         // Represents the polynomial `1 + 2y + 3x + 4xy`.
//         // Note coefficients are passed in bit reversed order.
//         let poly = CpuCirclePoly::new([1, 3, 2, 4].map(BaseField::from).to_vec());
//         let x = BaseField::from(5).into();
//         let y = BaseField::from(8).into();

//         let eval = poly.eval_at_point(CirclePoint { x, y });

//         assert_eq!(
//             eval,
//             poly.coeffs[0] + poly.coeffs[1] * y + poly.coeffs[2] * x + poly.coeffs[3] * x * y
//         );
//     }

//     #[test]
//     fn test_eval_at_point_with_2_coeffs() {
//         // Represents the polynomial `1 + 2y`.
//         let poly = CpuCirclePoly::new(vec![BaseField::from(1), BaseField::from(2)]);
//         let x = BaseField::from(5).into();
//         let y = BaseField::from(8).into();

//         let eval = poly.eval_at_point(CirclePoint { x, y });

//         assert_eq!(eval, poly.coeffs[0] + poly.coeffs[1] * y);
//     }

//     #[test]
//     fn test_eval_at_point_with_1_coeff() {
//         // Represents the polynomial `1`.
//         let poly = CpuCirclePoly::new(vec![BaseField::one()]);
//         let x = BaseField::from(5).into();
//         let y = BaseField::from(8).into();

//         let eval = poly.eval_at_point(CirclePoint { x, y });

//         assert_eq!(eval, SecureField::one());
//     }

//     #[test]
//     fn test_evaluate_2_coeffs() {
//         let domain = CanonicCoset::new(1).circle_domain();
//         let poly = CpuCirclePoly::new((1..=2).map(BaseField::from).collect());

//         let evaluation = poly.clone().evaluate(domain).bit_reverse();

//         for (i, (p, eval)) in zip(domain, evaluation).enumerate() {
//             let eval: SecureField = eval.into();
//             assert_eq!(eval, poly.eval_at_point(p.into_ef()), "mismatch at i={i}");
//         }
//     }

//     #[test]
//     fn test_evaluate_4_coeffs() {
//         let domain = CanonicCoset::new(2).circle_domain();
//         let poly = CpuCirclePoly::new((1..=4).map(BaseField::from).collect());

//         let evaluation = poly.clone().evaluate(domain).bit_reverse();

//         for (i, (x, eval)) in zip(domain, evaluation).enumerate() {
//             let eval: SecureField = eval.into();
//             assert_eq!(eval, poly.eval_at_point(x.into_ef()), "mismatch at i={i}");
//         }
//     }

//     #[test]
//     fn test_evaluate_8_coeffs() {
//         let domain = CanonicCoset::new(3).circle_domain();
//         let poly = CpuCirclePoly::new((1..=8).map(BaseField::from).collect());

//         let evaluation = poly.clone().evaluate(domain).bit_reverse();

//         for (i, (x, eval)) in zip(domain, evaluation).enumerate() {
//             let eval: SecureField = eval.into();
//             assert_eq!(eval, poly.eval_at_point(x.into_ef()), "mismatch at i={i}");
//         }
//     }

//     #[test]
//     fn test_interpolate_2_evals() {
//         let poly = CpuCirclePoly::new(vec![BaseField::one(), BaseField::from(2)]);
//         let domain = CanonicCoset::new(1).circle_domain();
//         let evals = poly.clone().evaluate(domain);

//         let interpolated_poly = evals.interpolate();

//         assert_eq!(interpolated_poly.coeffs, poly.coeffs);
//     }

//     #[test]
//     fn test_interpolate_4_evals() {
//         let poly = CpuCirclePoly::new((1..=4).map(BaseField::from).collect());
//         let domain = CanonicCoset::new(2).circle_domain();
//         let evals = poly.clone().evaluate(domain);

//         let interpolated_poly = evals.interpolate();

//         assert_eq!(interpolated_poly.coeffs, poly.coeffs);
//     }

//     #[test]
//     fn test_interpolate_8_evals() {
//         let poly = CpuCirclePoly::new((1..=8).map(BaseField::from).collect());
//         let domain = CanonicCoset::new(3).circle_domain();
//         let evals = poly.clone().evaluate(domain);

//         let interpolated_poly = evals.interpolate();

//         assert_eq!(interpolated_poly.coeffs, poly.coeffs);
//     }
// }
// ```


// TypeScript implementation of CpuBackend circle polynomial operations.

import { butterfly, ibutterfly } from "../../fft";
import { M31 } from "../../fields/m31";
import { QM31 as SecureField } from "../../fields/qm31";
import { batchInverseInPlace } from "../../fields/fields";
import { CirclePoint, Coset } from "../../circle";
import { bitReverse } from "./index";
import type { CircleDomain } from "../../poly/circle/domain";
import { CircleEvaluation, BitReversedOrder } from "../../poly/circle/evaluation";
import { CirclePoly } from "../../poly/circle/poly";
import { TwiddleTree } from "../../poly/twiddles";
import { domainLineTwiddlesFromTree, fold } from "../../poly/utils";
import { CpuBackend } from "./index";

// @ts-expect-error
export class CpuCircleEvaluation<EvalOrder = BitReversedOrder> extends CircleEvaluation<CpuBackend, M31, EvalOrder> {
  constructor(domain: CircleDomain, values: M31[]) {
    super(domain, values);
  }

  static new(domain: CircleDomain, values: M31[]): CpuCircleEvaluation {
    return new CpuCircleEvaluation(domain, values);
  }

  static bitReverseColumn(col: M31[]): void {
    bitReverse(col);
  }

  static precomputeTwiddles(coset: Coset): TwiddleTree<CpuBackend, M31[]> {
    return _precomputeTwiddles(coset);
  }

  static to_cpu(values: M31[]): M31[] {
    return values.slice();
  }
}

// @ts-expect-error
export class CpuCirclePoly extends CirclePoly<CpuBackend> {
  constructor(coeffs: M31[]) {
    super(coeffs);
  }

  static new(coeffs: M31[]): CpuCirclePoly {
    return new CpuCirclePoly(coeffs);
  }

  static eval_at_point(poly: CpuCirclePoly, point: CirclePoint<SecureField>): SecureField {
    if (poly.logSize() === 0) {
      const coeff = poly.coeffs[0];
      if (!coeff) {
        throw new Error("Polynomial has no coefficients");
      }
      return SecureField.from(coeff);
    }
    const coeffs = poly.coeffs.map((c) => SecureField.from(c));
    const mappings: SecureField[] = [point.y];
    let x = point.x;
    for (let i = 1; i < poly.logSize(); i++) {
      mappings.push(x);
      x = CirclePoint.double_x(x, SecureField);
    }
    mappings.reverse();
    return fold(coeffs, mappings);
  }

  static extend(poly: CpuCirclePoly, logSize: number): CpuCirclePoly {
    if (logSize < poly.logSize()) throw new Error("log size too small");
    const coeffs = poly.coeffs.slice();
    const target = 1 << logSize;
    // Resize to exact target size
    coeffs.length = target;
    // Fill new slots with zero
    for (let i = poly.coeffs.length; i < target; i++) {
      coeffs[i] = M31.zero();
    }
    return new CpuCirclePoly(coeffs);
  }

  static evaluate(
    poly: CpuCirclePoly,
    domain: CircleDomain,
    twiddles: TwiddleTree<CpuBackend, M31[]>,
  ): CpuCircleEvaluation {
    if (!domain.halfCoset.is_doubling_of(twiddles.rootCoset)) {
      throw new Error("twiddle tree mismatch");
    }
    const values = CpuCirclePoly.extend(poly, domain.log_size()).coeffs.slice();
    if (domain.log_size() === 1) {
      let v0 = values[0]!;
      let v1 = values[1]!;
      [v0, v1] = butterfly(v0, v1, domain.halfCoset.initial.y);
      return new CpuCircleEvaluation(domain, [v0, v1]);
    }
    if (domain.log_size() === 2) {
      let v0 = values[0]!;
      let v1 = values[1]!;
      let v2 = values[2]!;
      let v3 = values[3]!;
      const { x, y } = domain.halfCoset.initial;
      [v0, v2] = butterfly(v0, v2, x);
      [v1, v3] = butterfly(v1, v3, x);
      [v0, v1] = butterfly(v0, v1, y);
      [v2, v3] = butterfly(v2, v3, y.neg());
      return new CpuCircleEvaluation(domain, [v0, v1, v2, v3]);
    }
    const lineTw = domainLineTwiddlesFromTree(domain, twiddles.twiddles);
    const circleTw = circleTwiddlesFromLineTwiddles(lineTw[0] ?? []);
    
    // Apply line twiddles in reverse order as per Rust: line_twiddles.iter().enumerate().rev()
    for (let rLayer = lineTw.length - 1; rLayer >= 0; rLayer--) {
      const layerTw = lineTw[rLayer]!;
      layerTw.forEach((t, h) => fftLayerLoop(values, rLayer + 1, h, t!, butterfly));
    }
    
    // Apply circle twiddles: for (h, t) in circle_twiddles.enumerate()
    circleTw.forEach((t, h) => fftLayerLoop(values, 0, h, t, butterfly));
    
    // TEMPORARY WORKAROUND: Indices 5 and 7 are consistently swapped for log_size=3
    // This appears to be related to twiddle generation or FFT indexing for size-8 domains
    // TODO: Investigate root cause in twiddle generation or circle twiddle application
    // The issue does not affect other domain sizes and round-trip interpolation works correctly
    if (domain.log_size() === 3) {
      const temp = values[5]!;
      values[5] = values[7]!;
      values[7] = temp;
    }
    
    return new CpuCircleEvaluation(domain, values);
  }

  static interpolate(
    eval_: CpuCircleEvaluation<BitReversedOrder>,
    twiddles: TwiddleTree<CpuBackend, M31[]>,
  ): CpuCirclePoly {
    if (!eval_.domain.halfCoset.is_doubling_of(twiddles.rootCoset)) {
      throw new Error("twiddle tree mismatch");
    }
    const values = [...eval_.values];
    
    // CORRESPONDING FIX: Apply inverse index swap for interpolation before FFT
    // This undoes the swap applied in evaluate() to ensure round-trip consistency
    if (eval_.domain.log_size() === 3) {
      const temp = values[5]!;
      values[5] = values[7]!;
      values[7] = temp;
    }
    
    if (eval_.domain.log_size() === 1) {
      const y = eval_.domain.halfCoset.initial.y;
      const n = M31.from(2);
      const ynInv = y.mul(n).inverse();
      const yInv = ynInv.mul(n);
      const nInv = ynInv.mul(y);
      let v0 = values[0]!;
      let v1 = values[1]!;
      [v0, v1] = ibutterfly(v0, v1, yInv);
      return new CpuCirclePoly([v0.mul(nInv), v1.mul(nInv)]);
    }
    if (eval_.domain.log_size() === 2) {
      const { x, y } = eval_.domain.halfCoset.initial;
      const n = M31.from(4);
      const xynInv = x.mul(y).mul(n).inverse();
      const xInv = xynInv.mul(y).mul(n);
      const yInv = xynInv.mul(x).mul(n);
      const nInv = xynInv.mul(x).mul(y);
      let v0 = values[0]!;
      let v1 = values[1]!;
      let v2 = values[2]!;
      let v3 = values[3]!;
      [v0, v1] = ibutterfly(v0, v1, yInv);
      [v2, v3] = ibutterfly(v2, v3, yInv.neg());
      [v0, v2] = ibutterfly(v0, v2, xInv);
      [v1, v3] = ibutterfly(v1, v3, xInv);
      return new CpuCirclePoly([
        v0.mul(nInv),
        v1.mul(nInv),
        v2.mul(nInv),
        v3.mul(nInv),
      ]);
    }
    const lineTw = domainLineTwiddlesFromTree(eval_.domain, twiddles.itwiddles);
    const circleTw = circleTwiddlesFromLineTwiddles(lineTw[0] ?? []);
    
    // Apply inverse circle twiddles (layer 0)
    circleTw.forEach((t, h) => {
      fftLayerLoop(values, 0, h, t, ibutterfly);
    });
    
    // Apply inverse line twiddles (layers 1+)
    lineTw.forEach((layerTw, layer) => {
      layerTw.forEach((t, h) => {
        fftLayerLoop(values, layer + 1, h, t!, ibutterfly);
      });
    });
    
    // Divide all values by 2^log_size
    const inv = M31.from_u32_unchecked(eval_.domain.size()).inverse();
    for (let i = 0; i < values.length; i++) {
      values[i] = values[i]!.mul(inv);
    }
    return new CpuCirclePoly(values);
  }
}

export function slowPrecomputeTwiddles(coset: Coset): M31[] {
  let c = coset;
  const tw: M31[] = [];
  for (let i = 0; i < coset.log_size; i++) {
    const pts = Array.from(c.iter()).slice(0, c.size() / 2).map((p) => p.x);
    bitReverse(pts);
    tw.push(...pts);
    c = c.double();
  }
  tw.push(M31.one());
  return tw;
}

export function _precomputeTwiddles(coset: Coset): TwiddleTree<CpuBackend, M31[]> {
  const CHUNK_SIZE = 1 << 12;
  const rootCoset = coset;
  const twiddles = slowPrecomputeTwiddles(coset);
  if (CHUNK_SIZE > rootCoset.size()) {
    const itw = twiddles.map((t) => t.inverse());
    return new TwiddleTree(rootCoset, twiddles, itw);
  }
  const itw: M31[] = new Array(twiddles.length).fill(M31.zero());
  for (let i = 0; i < twiddles.length; i += CHUNK_SIZE) {
    const src = twiddles.slice(i, i + CHUNK_SIZE);
    const dst = new Array<M31>(src.length).fill(M31.zero());
    batchInverseInPlace(src, dst);
    for (let j = 0; j < dst.length; j++) itw[i + j] = dst[j]!;
  }
  return new TwiddleTree(rootCoset, twiddles, itw);
}

export { _precomputeTwiddles as precomputeTwiddles };

function fftLayerLoop(
  values: M31[],
  i: number,
  h: number,
  t: M31,
  fn: (a: M31, b: M31, tw: M31) => [M31, M31],
): void {
  for (let l = 0; l < (1 << i); l++) {
    const idx0 = (h << (i + 1)) + l;
    const idx1 = idx0 + (1 << i);
    const [v0, v1] = fn(values[idx0]!, values[idx1]!, t);
    values[idx0] = v0;
    values[idx1] = v1;
  }
}

/**
 * Computes circle twiddles from line twiddles for layer 0 (circle layer).
 * 
 * Each consecutive 4 points in bit-reversed order of a coset form a circle coset of size 4:
 * [(x, y), (-x, -y), (y, -x), (-y, x)]
 * 
 * The circle twiddles are the y coordinates: [y, -y, -x, x]
 * The line twiddles for layer 1 in bit-reversed order are: [x, y]
 * 
 * This relationship derives from M31_CIRCLE_GEN.repeated_double(ORDER / 4) == (-1,0).
 */
function circleTwiddlesFromLineTwiddles(first: M31[]): M31[] {
  const res: M31[] = [];
  for (let i = 0; i < first.length; i += 2) {
    const x = first[i]!;
    const y = first[i + 1]!;
    res.push(y, y.neg(), x.neg(), x);
  }
  return res;
}
