import { CirclePoint, Coset } from "./circle";
import { M31 } from "./fields/m31";
import { QM31 as SecureField } from "./fields/qm31";
import type { ExtensionOf, Field } from "./fields/fields";
import type { PointSample } from "./pcs/quotients";

function convertBase<F>(FClass: any, v: M31): F {
  if (FClass === M31) {
    // M31.from accepts number
    return FClass.from(v.value);
  }
  if (typeof FClass.from === "function") {
    return FClass.from(v);
  }
  if (typeof FClass.fromUnchecked === "function") {
    return FClass.fromUnchecked(v.value);
  }
  return v as unknown as F;
}

function addBase<F>(x: any, v: M31, FClass: any): F {
  if (typeof x.addM31 === "function") return x.addM31(v);
  return x.add(convertBase<F>(FClass, v));
}

function subBase<F>(x: any, v: M31, FClass: any): F {
  if (typeof x.subM31 === "function") return x.subM31(v);
  return x.sub(convertBase<F>(FClass, v));
}

/**
 * Port of `constraints.rs` function `coset_vanishing`.
 */
export function cosetVanishing<F extends Field<F>>(
  coset: Coset,
  p: CirclePoint<F>,
  FClass: { one(): F; from(v: any): F; fromUnchecked?: (n: number) => F }
): F {
  const half = coset.step_size.half().to_point();
  const convert = (v: M31) => convertBase<F>(FClass, v);
  const shifted = p
    .sub(coset.initial.intoEf(convert))
    .add(half.intoEf(convert));
  let x = shifted.x;
  for (let i = 1; i < coset.log_size; i++) {
    x = CirclePoint.double_x(x, FClass);
  }
  return x;
}

/**
 * Port of `constraints.rs` function `point_excluder`.
 */
export function pointExcluder<F extends Field<F>>(
  excluded: CirclePoint<M31>,
  p: CirclePoint<F>,
  FClass: { one(): F; from(v: any): F; fromUnchecked?: (n: number) => F }
): F {
  const convert = (v: M31) => convertBase<F>(FClass, v);
  const diff = p.sub(excluded.intoEf(convert));
  return diff.x.sub(convert(M31.one()));
}

/**
 * Port of `constraints.rs` function `pair_vanishing`.
 */
export function pairVanishing<F extends Field<F>>(
  excluded0: CirclePoint<F>,
  excluded1: CirclePoint<F>,
  p: CirclePoint<F>
): F {
  return excluded0.y
    .sub(excluded1.y)
    .mul(p.x)
    .add(
      excluded1.x
        .sub(excluded0.x)
        .mul(p.y)
        .add(excluded0.x.mul(excluded1.y).sub(excluded0.y.mul(excluded1.x)))
    );
}

/**
 * Port of `constraints.rs` function `point_vanishing`.
 */
export function pointVanishing<F extends Field<F>, EF extends Field<EF>>(
  vanishPoint: CirclePoint<F>,
  p: CirclePoint<EF>,
  convert: (v: F) => EF,
  EFClass: { one(): EF }
): EF {
  const diff = p.sub(vanishPoint.intoEf(convert));
  const denom = EFClass.one().add(diff.x).inverse();
  return diff.y.mul(denom);
}

/**
 * Port of `constraints.rs` function `complex_conjugate_line`.
 */
export function complexConjugateLine(
  point: CirclePoint<SecureField>,
  value: SecureField,
  p: CirclePoint<M31>
): SecureField {
  if (point.y.equals(point.y.complexConjugate())) {
    throw new Error("Cannot evaluate a line with a single point");
  }
  const diff = SecureField.from(p.y).sub(point.y);
  const numerator = value.complexConjugate().sub(value).mul(diff);
  const denom = point.complexConjugate().y.sub(point.y).inverse();
  return value.add(numerator.mul(denom));
}

/**
 * Port of `constraints.rs` function `complex_conjugate_line_coeffs`.
 */
export function complexConjugateLineCoeffs(
  sample: PointSample,
  alpha: SecureField
): [SecureField, SecureField, SecureField] {
  if (sample.point.y.equals(sample.point.y.complexConjugate())) {
    throw new Error("Cannot evaluate a line with a single point");
  }
  const a = sample.value.complexConjugate().sub(sample.value);
  const c = sample.point.complexConjugate().y.sub(sample.point.y);
  const b = sample.value.mul(c).sub(a.mul(sample.point.y));
  return [alpha.mul(a), alpha.mul(b), alpha.mul(c)];
}

