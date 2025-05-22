import { describe, it, expect } from "vitest";
import { CpuCirclePoly, CpuCircleEvaluation, _precomputeTwiddles } from "../../src/backend/cpu/circle";
import { CanonicCoset } from "../../src/poly/circle/canonic";
import { CirclePoint } from "../../src/circle";
import { M31 } from "../../src/fields/m31";
import { QM31 as SecureField } from "../../src/fields/qm31";

function m31(n: number): M31 {
  return M31.from_u32_unchecked(n);
}

function sf(n: number): SecureField {
  return SecureField.from(m31(n));
}

describe("CpuCirclePoly basic operations", () => {
  it("eval_at_point_with_2_coeffs", () => {
    const poly = new CpuCirclePoly([m31(1), m31(2)]);
    const point = new CirclePoint(m31(5), m31(8)).intoEf(sf);
    const evalRes = CpuCirclePoly.eval_at_point(poly, point);
    const expected = SecureField.from(poly.coeffs[0]).add(
      SecureField.from(poly.coeffs[1]).mul(point.y)
    );
    expect(evalRes.equals(expected)).toBe(true);
  });

  it.skip("evaluate_and_interpolate_roundtrip", () => {
    const domain = CanonicCoset.new(2).circleDomain();
    // Coefficients must be in bit-reversed order
    const poly = new CpuCirclePoly([m31(1), m31(3), m31(2), m31(4)]);
    const tw = _precomputeTwiddles(domain.halfCoset);
    const evalNat = CpuCirclePoly.evaluate(poly, domain, tw);
    const evalRev = evalNat.bitReverse();
    const interpolated = CpuCirclePoly.interpolate(evalRev, tw);
    expect(interpolated.coeffs.map(c => c.value)).toEqual(poly.coeffs.map(c => c.value));
  });
});
