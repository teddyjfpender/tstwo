import { describe, it, expect } from "vitest";
import { LineDomain, LinePoly, LineEvaluation } from "../../src/poly/line";
import { Coset } from "../../src/circle";
import { QM31 } from "../../src/fields/qm31";
import { M31 } from "../../src/fields/m31";
import { CpuBackend } from "../../src/backend/cpu";

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

  it("interpolate round trip", () => {
    // Replicate the exact Rust test: line_evaluation_interpolation  
    // Create a polynomial with coefficients [7, 9, 5, 3] representing:
    // 7 * 1 + 9 * pi(x) + 5 * x + 3 * pi(x)*x
    const poly = LinePoly.new([
      QM31.from_u32_unchecked(7, 0, 0, 0), // 7 * 1
      QM31.from_u32_unchecked(9, 0, 0, 0), // 9 * pi(x)  
      QM31.from_u32_unchecked(5, 0, 0, 0), // 5 * x
      QM31.from_u32_unchecked(3, 0, 0, 0), // 3 * pi(x)*x
    ]);
    
    const coset = Coset.half_odds(Math.log2(poly.len())); // log2(4) = 2
    const domain = LineDomain.new(coset);
    
    // Evaluate using the exact Rust formula: coeffs[0] + coeffs[1] * pi_x + coeffs[2] * x + coeffs[3] * pi_x * x
    let values: QM31[] = [];
    for (const x of domain.iter()) {
      const qm31_x = QM31.from_u32_unchecked(x.value, 0, 0, 0);
      const pi_x = qm31_x.mul(qm31_x).double().sub(QM31.one()); // pi(x) = 2x^2 - 1 (doubling map)
      
      const evaluation = poly.coeffs[0]!
        .add(poly.coeffs[1]!.mul(pi_x))
        .add(poly.coeffs[2]!.mul(qm31_x))
        .add(poly.coeffs[3]!.mul(pi_x).mul(qm31_x));
      values.push(evaluation);
    }
    
    // Bit reverse the values like in Rust
    const backend = new CpuBackend();
    const valuesColumn = backend.createSecureFieldColumn(values);
    backend.bitReverseColumn(valuesColumn);
    const bitReversedValues = valuesColumn.toCpu();
    
    const evals = LineEvaluation.new(domain, bitReversedValues);
    const interpolatedPoly = evals.interpolate();
    
    // The interpolated coefficients should match the original
    expect(interpolatedPoly.coeffs).toEqual(poly.coeffs);
  });
});
