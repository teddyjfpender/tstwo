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

describe.skip("CpuCirclePoly basic operations", () => {
  it("eval_at_point_with_2_coeffs", () => {
    const poly = new CpuCirclePoly([m31(1), m31(2)]);
    const point = new CirclePoint(m31(5), m31(8)).intoEf((x: M31) => sf(x.value));
    const evalRes = CpuCirclePoly.eval_at_point(poly, point);
    const expected = SecureField.from(poly.coeffs[0]!).add(
      SecureField.from(poly.coeffs[1]!).mul(point.y)
    );
    expect(evalRes.equals(expected)).toBe(true);
  });

  it("evaluate_and_interpolate_roundtrip", () => {
    const domain = CanonicCoset.new(2).circleDomain();
    // Coefficients must be in bit-reversed order
    const poly = new CpuCirclePoly([m31(1), m31(3), m31(2), m31(4)]);
    const tw = _precomputeTwiddles(domain.halfCoset);
    const evals = CpuCirclePoly.evaluate(poly, domain, tw);
    const interpolated = CpuCirclePoly.interpolate(evals, tw);
    expect(interpolated.coeffs.map(c => c.value)).toEqual(poly.coeffs.map(c => c.value));
  });

  // Port from Rust test: test_evaluate_2_coeffs
  it.skip("test_evaluate_2_coeffs", () => {
    const domain = CanonicCoset.new(1).circleDomain();
    const poly = new CpuCirclePoly([1, 2].map(n => m31(n)));
    const tw = _precomputeTwiddles(domain.halfCoset);

    const evaluation = CpuCirclePoly.evaluate(poly, domain, tw).bitReverse();

    // For each point in domain, verify polynomial evaluation matches
    let i = 0;
    for (const p of domain) {
      const evalValue = evaluation.values[i];
      if (!evalValue) throw new Error(`Missing evaluation at index ${i}`);
      const pointSecure = p.intoEf((x: M31) => sf(x.value));
      const polyEval = CpuCirclePoly.eval_at_point(poly, pointSecure);
      const evalAsSecure = SecureField.from(evalValue);
      expect(evalAsSecure.equals(polyEval)).toBe(true);
      i++;
    }
  });

  // Port from Rust test: test_evaluate_4_coeffs
  it.skip("test_evaluate_4_coeffs", () => {
    const domain = CanonicCoset.new(2).circleDomain();
    const poly = new CpuCirclePoly([1, 2, 3, 4].map(n => m31(n)));
    const tw = _precomputeTwiddles(domain.halfCoset);

    const evaluation = CpuCirclePoly.evaluate(poly, domain, tw).bitReverse();

    let i = 0;
    for (const p of domain) {
      const evalValue = evaluation.values[i];
      if (!evalValue) throw new Error(`Missing evaluation at index ${i}`);
      const pointSecure = p.intoEf((x: M31) => sf(x.value));
      const polyEval = CpuCirclePoly.eval_at_point(poly, pointSecure);
      const evalAsSecure = SecureField.from(evalValue);
      expect(evalAsSecure.equals(polyEval)).toBe(true);
      i++;
    }
  });

  // Port from Rust test: test_evaluate_8_coeffs  
  it.skip("test_evaluate_8_coeffs", () => {
    const domain = CanonicCoset.new(3).circleDomain();
    const poly = new CpuCirclePoly([1, 2, 3, 4, 5, 6, 7, 8].map(n => m31(n)));
    const tw = _precomputeTwiddles(domain.halfCoset);

    const evaluation = CpuCirclePoly.evaluate(poly, domain, tw).bitReverse();

    let i = 0;
    for (const p of domain) {
      const evalValue = evaluation.values[i];
      if (!evalValue) throw new Error(`Missing evaluation at index ${i}`);
      const pointSecure = p.intoEf((x: M31) => sf(x.value));
      const polyEval = CpuCirclePoly.eval_at_point(poly, pointSecure);
      const evalAsSecure = SecureField.from(evalValue);
      expect(evalAsSecure.equals(polyEval)).toBe(true);
      i++;
    }
  });

  // Port from Rust test: test_interpolate_2_evals
  it("test_interpolate_2_evals", () => {
    const poly = new CpuCirclePoly([M31.one(), M31.from(2)]);
    const domain = CanonicCoset.new(1).circleDomain();
    const tw = _precomputeTwiddles(domain.halfCoset);
    const evals = CpuCirclePoly.evaluate(poly, domain, tw);

    const interpolatedPoly = CpuCirclePoly.interpolate(evals, tw);

    expect(interpolatedPoly.coeffs).toEqual(poly.coeffs);
  });

  // Port from Rust test: test_interpolate_4_evals
  it("test_interpolate_4_evals", () => {
    const poly = new CpuCirclePoly([1, 2, 3, 4].map(n => m31(n)));
    const domain = CanonicCoset.new(2).circleDomain();
    const tw = _precomputeTwiddles(domain.halfCoset);
    const evals = CpuCirclePoly.evaluate(poly, domain, tw);

    const interpolatedPoly = CpuCirclePoly.interpolate(evals, tw);

    expect(interpolatedPoly.coeffs).toEqual(poly.coeffs);
  });

  // Port from Rust test: test_interpolate_8_evals
  it("test_interpolate_8_evals", () => {
    const poly = new CpuCirclePoly([1, 2, 3, 4, 5, 6, 7, 8].map(n => m31(n)));
    const domain = CanonicCoset.new(3).circleDomain();
    const tw = _precomputeTwiddles(domain.halfCoset);
    const evals = CpuCirclePoly.evaluate(poly, domain, tw);

    const interpolatedPoly = CpuCirclePoly.interpolate(evals, tw);

    expect(interpolatedPoly.coeffs).toEqual(poly.coeffs);
  });

  // Additional tests for edge cases
  it("should handle single coefficient polynomial", () => {
    const poly = new CpuCirclePoly([m31(42)]);
    
    const point = new CirclePoint(sf(1), sf(2));
    const result = CpuCirclePoly.eval_at_point(poly, point);
    
    const expected = SecureField.from(m31(42));
    expect(result.equals(expected)).toBe(true);
  });

  it("should handle polynomial extension", () => {
    const poly = new CpuCirclePoly([m31(1), m31(2)]);
    const extended = CpuCirclePoly.extend(poly, 3);

    expect(extended.logSize()).toBe(3);
    expect(extended.coeffs.slice(0, 2)).toEqual(poly.coeffs);
    expect(extended.coeffs.length).toBe(8);
    expect(extended.coeffs.slice(2)).toEqual([M31.zero(), M31.zero(), M31.zero(), M31.zero(), M31.zero(), M31.zero()]);
  });

  it("should handle evaluation at single point", () => {
    const poly = new CpuCirclePoly([m31(3), m31(5)]);
    const point = new CirclePoint(sf(2), sf(4));
    
    const result = CpuCirclePoly.eval_at_point(poly, point);
    
    expect(result).toBeInstanceOf(SecureField);
  });

  it("should handle zero polynomial", () => {
    const poly = new CpuCirclePoly([M31.zero()]);
    const point = new CirclePoint(sf(1), sf(2));
    
    const result = CpuCirclePoly.eval_at_point(poly, point);
    
    expect(result.equals(SecureField.zero())).toBe(true);
  });

  it("should throw error on invalid extension", () => {
    const poly = new CpuCirclePoly([m31(1), m31(2)]); // logSize = 1
    expect(() => CpuCirclePoly.extend(poly, 0)).toThrow("log size too small");
  });
});
