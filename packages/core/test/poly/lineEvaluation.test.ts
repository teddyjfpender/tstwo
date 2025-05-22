import { describe, it, expect } from "vitest";
import { LineDomain, LinePoly, LineEvaluation } from "../../src/poly/line";
import { Coset } from "../../src/circle";
import { QM31 } from "../../src/fields/qm31";

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
    res.push(poly.eval_at_point(x as unknown as QM31));
  }
  return res;
}

describe("LineEvaluation", () => {
  it.skip("interpolate round trip", () => {
    const coset = Coset.half_odds(2);
    const domain = LineDomain.new(coset);
    const poly = new LinePoly(coeffs);
    const values = evalPoly(poly, domain);
    const evals = new LineEvaluation(domain, values);
    const interp = evals.interpolate();
    expect(interp.coeffs.map(c=>c.toM31Array()[0])).toEqual(poly.coeffs.map(c=>c.toM31Array()[0]));
  });
});
