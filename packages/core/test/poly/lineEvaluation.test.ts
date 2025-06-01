import { describe, it, expect } from "vitest";
import { LineDomain, LinePoly, LineEvaluation } from "../../src/poly/line";
import { Coset } from "../../src/circle";
import { QM31 } from "../../src/fields/qm31";
import { M31 } from "../../src/fields/m31";

// Simple polynomial 1 + 2*x + 3*pi(x) + 4*pi(x)*x over domain size 4
const coeffs = [
  QM31.from_u32_unchecked(1,0,0,0),
  QM31.from_u32_unchecked(2,0,0,0),
  QM31.from_u32_unchecked(3,0,0,0),
  QM31.from_u32_unchecked(4,0,0,0),
];

function evalPoly(poly: LinePoly, domain: LineDomain): QM31[] {
  const res: QM31[] = [];
  for (const x of domain.iter()) {
    // Convert M31 to QM31 properly
    const qm31_x = QM31.from_u32_unchecked(x.value, 0, 0, 0);
    res.push(poly.eval_at_point(qm31_x));
  }
  return res;
}

describe("LineEvaluation", () => {
  it("simple constant polynomial", () => {
    // Test with a simple constant polynomial: f(x) = 1
    const constantCoeffs = [QM31.from_u32_unchecked(1,0,0,0)];
    const coset = Coset.half_odds(0); // Size 1
    const domain = LineDomain.new(coset);
    const poly = LinePoly.new(constantCoeffs);
    const values = evalPoly(poly, domain);
    const evals = LineEvaluation.new(domain, values);
    const interp = evals.interpolate();
    
    expect(interp.coeffs.length).toBe(1);
    expect(interp.coeffs[0]?.toM31Array()[0].value).toBe(1);
  });

  it("debug interpolation steps", () => {
    // Test with a simple linear polynomial: f(x) = 1 + x
    const linearCoeffs = [
      QM31.from_u32_unchecked(1,0,0,0), // constant term
      QM31.from_u32_unchecked(1,0,0,0), // linear term
    ];
    const coset = Coset.half_odds(1); // Size 2
    const domain = LineDomain.new(coset);
    const poly = LinePoly.new(linearCoeffs);
    
    console.log("Original coeffs:", poly.coeffs.map(c => c.toM31Array()[0].value));
    
    const values = evalPoly(poly, domain);
    console.log("Evaluated values:", values.map(v => v.toM31Array()[0].value));
    
    const evals = LineEvaluation.new(domain, values);
    const interp = evals.interpolate();
    
    console.log("Interpolated coeffs:", interp.coeffs.map(c => c.toM31Array()[0].value));
    
    expect(interp.coeffs.map((c: QM31) => c.toM31Array()[0].value)).toEqual(poly.coeffs.map((c: QM31) => c.toM31Array()[0].value));
  });

  it.skip("interpolate round trip", () => {
    const coset = Coset.half_odds(2);
    const domain = LineDomain.new(coset);
    const poly = LinePoly.new(coeffs);
    const values = evalPoly(poly, domain);
    const evals = LineEvaluation.new(domain, values);
    const interp = evals.interpolate();
    expect(interp.coeffs.map((c: QM31) => c.toM31Array()[0])).toEqual(poly.coeffs.map((c: QM31) => c.toM31Array()[0]));
  });
});
