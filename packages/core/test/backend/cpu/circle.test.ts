import { describe, it, expect } from "vitest";
import { CpuCirclePoly, CpuCircleEvaluation } from "../../../src/backend/cpu/circle";
import { M31 } from "../../../src/fields/m31";
import { QM31 as SecureField } from "../../../src/fields/qm31";
import { CirclePoint } from "../../../src/circle";
import { CanonicCoset } from "../../../src/poly/circle";

describe("CpuCirclePoly eval_at_point", () => {
  it("test_eval_at_point_with_4_coeffs", () => {
    // Represents the polynomial `1 + 2y + 3x + 4xy`.
    // Note coefficients are passed in bit reversed order.
    const poly = CpuCirclePoly.new([1, 3, 2, 4].map(M31.from));
    const x = SecureField.from(M31.from(5));
    const y = SecureField.from(M31.from(8));

    const eval_result = CpuCirclePoly.eval_at_point(poly, new CirclePoint(x, y));

    const expected = SecureField.from(poly.coeffs[0]!)
      .add(SecureField.from(poly.coeffs[1]!).mul(y))
      .add(SecureField.from(poly.coeffs[2]!).mul(x))
      .add(SecureField.from(poly.coeffs[3]!).mul(x).mul(y));

    expect(eval_result.equals(expected)).toBe(true);
  });

  it("test_eval_at_point_with_2_coeffs", () => {
    // Represents the polynomial `1 + 2y`.
    const poly = CpuCirclePoly.new([M31.from(1), M31.from(2)]);
    const x = SecureField.from(M31.from(5));
    const y = SecureField.from(M31.from(8));

    const eval_result = CpuCirclePoly.eval_at_point(poly, new CirclePoint(x, y));

    const expected = SecureField.from(poly.coeffs[0]!)
      .add(SecureField.from(poly.coeffs[1]!).mul(y));

    expect(eval_result.equals(expected)).toBe(true);
  });

  it("test_eval_at_point_with_1_coeff", () => {
    // Represents the polynomial `1`.
    const poly = CpuCirclePoly.new([M31.one()]);
    const x = SecureField.from(M31.from(5));
    const y = SecureField.from(M31.from(8));

    const eval_result = CpuCirclePoly.eval_at_point(poly, new CirclePoint(x, y));

    expect(eval_result.equals(SecureField.one())).toBe(true);
  });
});

describe("CpuCirclePoly evaluate", () => {
  it("test_evaluate_2_coeffs", () => {
    const domain = CanonicCoset.new(1).circleDomain();
    const poly = CpuCirclePoly.new([1, 2].map(M31.from));
    const twiddles = CpuCircleEvaluation.precomputeTwiddles(domain.halfCoset);

    const evaluation = CpuCirclePoly.evaluate(poly, domain, twiddles);
    const bit_reversed_evaluation = evaluation.bitReverse();

    Array.from(domain.iter()).forEach((point: any, i: number) => {
      const eval_from_domain = SecureField.from(bit_reversed_evaluation.values[i]!);
      const eval_at_point = CpuCirclePoly.eval_at_point(poly, point.intoEf((v: M31) => SecureField.from(v)));
      expect(eval_from_domain.equals(eval_at_point)).toBe(true);
    });
  });

  it("test_evaluate_4_coeffs", () => {
    const domain = CanonicCoset.new(2).circleDomain();
    const poly = CpuCirclePoly.new([1, 2, 3, 4].map(M31.from));
    const twiddles = CpuCircleEvaluation.precomputeTwiddles(domain.halfCoset);

    const evaluation = CpuCirclePoly.evaluate(poly, domain, twiddles);
    const bit_reversed_evaluation = evaluation.bitReverse();

    Array.from(domain.iter()).forEach((point: any, i: number) => {
      const eval_from_domain = SecureField.from(bit_reversed_evaluation.values[i]!);
      const eval_at_point = CpuCirclePoly.eval_at_point(poly, point.intoEf((v: M31) => SecureField.from(v)));
      expect(eval_from_domain.equals(eval_at_point)).toBe(true);
    });
  });

  it("test_evaluate_8_coeffs", () => {
    const domain = CanonicCoset.new(3).circleDomain();
    const poly = CpuCirclePoly.new([1, 2, 3, 4, 5, 6, 7, 8].map(M31.from));
    const twiddles = CpuCircleEvaluation.precomputeTwiddles(domain.halfCoset);

    const evaluation = CpuCirclePoly.evaluate(poly, domain, twiddles);
    const bit_reversed_evaluation = evaluation.bitReverse();

    Array.from(domain.iter()).forEach((point: any, i: number) => {
      const eval_from_domain = SecureField.from(bit_reversed_evaluation.values[i]!);
      const eval_at_point = CpuCirclePoly.eval_at_point(poly, point.intoEf((v: M31) => SecureField.from(v)));
      expect(eval_from_domain.equals(eval_at_point)).toBe(true);
    });
  });
});

describe("CpuCirclePoly interpolate", () => {
  it("test_interpolate_2_evals", () => {
    const poly = CpuCirclePoly.new([M31.one(), M31.from(2)]);
    const domain = CanonicCoset.new(1).circleDomain();
    const twiddles = CpuCircleEvaluation.precomputeTwiddles(domain.halfCoset);
    const evals = CpuCirclePoly.evaluate(poly, domain, twiddles);

    const interpolated_poly = CpuCirclePoly.interpolate(evals, twiddles);

    expect(interpolated_poly.coeffs.length).toBe(poly.coeffs.length);
    interpolated_poly.coeffs.forEach((coeff, i) => {
      expect(coeff.equals(poly.coeffs[i]!)).toBe(true);
    });
  });

  it("test_interpolate_4_evals", () => {
    const poly = CpuCirclePoly.new([1, 2, 3, 4].map(M31.from));
    const domain = CanonicCoset.new(2).circleDomain();
    const twiddles = CpuCircleEvaluation.precomputeTwiddles(domain.halfCoset);
    const evals = CpuCirclePoly.evaluate(poly, domain, twiddles);

    const interpolated_poly = CpuCirclePoly.interpolate(evals, twiddles);

    expect(interpolated_poly.coeffs.length).toBe(poly.coeffs.length);
    interpolated_poly.coeffs.forEach((coeff, i) => {
      expect(coeff.equals(poly.coeffs[i]!)).toBe(true);
    });
  });

  it("test_interpolate_8_evals", () => {
    const poly = CpuCirclePoly.new([1, 2, 3, 4, 5, 6, 7, 8].map(M31.from));
    const domain = CanonicCoset.new(3).circleDomain();
    const twiddles = CpuCircleEvaluation.precomputeTwiddles(domain.halfCoset);
    const evals = CpuCirclePoly.evaluate(poly, domain, twiddles);

    const interpolated_poly = CpuCirclePoly.interpolate(evals, twiddles);

    expect(interpolated_poly.coeffs.length).toBe(poly.coeffs.length);
    interpolated_poly.coeffs.forEach((coeff, i) => {
      expect(coeff.equals(poly.coeffs[i]!)).toBe(true);
    });
  });
});

describe("CpuCirclePoly extend", () => {
  it("should extend polynomial to larger size", () => {
    const poly = CpuCirclePoly.new([M31.from(1), M31.from(2)]);
    const extended = CpuCirclePoly.extend(poly, 3);

    expect(extended.coeffs.length).toBe(8);
    expect(extended.coeffs[0]!.equals(M31.from(1))).toBe(true);
    expect(extended.coeffs[1]!.equals(M31.from(2))).toBe(true);
    for (let i = 2; i < 8; i++) {
      expect(extended.coeffs[i]!.equals(M31.zero())).toBe(true);
    }
  });

  it("should not modify when log_size equals current", () => {
    const poly = CpuCirclePoly.new([M31.from(1), M31.from(2), M31.from(3), M31.from(4)]);
    const extended = CpuCirclePoly.extend(poly, 2);

    expect(extended.coeffs.length).toBe(4);
    extended.coeffs.forEach((coeff, i) => {
      expect(coeff.equals(poly.coeffs[i]!)).toBe(true);
    });
  });

  it("should throw error when log_size is smaller", () => {
    const poly = CpuCirclePoly.new([M31.from(1), M31.from(2), M31.from(3), M31.from(4)]);
    expect(() => CpuCirclePoly.extend(poly, 1)).toThrow("log size too small");
  });
});

describe("CpuCirclePoly constructor and basic operations", () => {
  it("should create polynomial with correct coefficients", () => {
    const coeffs = [M31.from(1), M31.from(2), M31.from(3), M31.from(4)];
    const poly = CpuCirclePoly.new(coeffs);

    expect(poly.coeffs.length).toBe(4);
    poly.coeffs.forEach((coeff, i) => {
      expect(coeff.equals(coeffs[i]!)).toBe(true);
    });
  });

  it("should calculate correct log_size", () => {
    const poly1 = CpuCirclePoly.new([M31.from(1)]);
    expect(poly1.logSize()).toBe(0);

    const poly2 = CpuCirclePoly.new([M31.from(1), M31.from(2)]);
    expect(poly2.logSize()).toBe(1);

    const poly4 = CpuCirclePoly.new([M31.from(1), M31.from(2), M31.from(3), M31.from(4)]);
    expect(poly4.logSize()).toBe(2);

    const poly8 = CpuCirclePoly.new(new Array(8).fill(0).map((_, i) => M31.from(i + 1)));
    expect(poly8.logSize()).toBe(3);
  });
});

describe("CpuCircleEvaluation", () => {
  it("should create evaluation with correct domain and values", () => {
    const domain = CanonicCoset.new(2).circleDomain();
    const values = [1, 2, 3, 4].map(M31.from);
    const eval_obj = CpuCircleEvaluation.new(domain, values);

    expect(eval_obj.domain).toBe(domain);
    expect(eval_obj.values.length).toBe(4);
    eval_obj.values.forEach((val, i) => {
      expect(val.equals(values[i]!)).toBe(true);
    });
  });

  it("should bit reverse column correctly", () => {
    const col = [M31.from(1), M31.from(2), M31.from(3), M31.from(4)];
    const original = col.slice();
    CpuCircleEvaluation.bitReverseColumn(col);

    // For size 4, bit reversal should swap indices 1 and 2
    expect(col[0]!.equals(original[0]!)).toBe(true);
    expect(col[1]!.equals(original[2]!)).toBe(true);
    expect(col[2]!.equals(original[1]!)).toBe(true);
    expect(col[3]!.equals(original[3]!)).toBe(true);
  });

  it("should convert to cpu correctly", () => {
    const values = [M31.from(1), M31.from(2), M31.from(3)];
    const result = CpuCircleEvaluation.to_cpu(values);

    expect(result.length).toBe(values.length);
    result.forEach((val, i) => {
      expect(val.equals(values[i]!)).toBe(true);
    });
    // Should be a copy, not the same reference
    expect(result).not.toBe(values);
  });
});

describe("Round-trip consistency", () => {
  it("should maintain consistency for all sizes", () => {
    for (let log_size = 1; log_size <= 6; log_size++) {
      const domain = CanonicCoset.new(log_size).circleDomain();
      const coeffs = new Array(1 << log_size).fill(0).map((_, i) => M31.from(i + 1));
      const poly = CpuCirclePoly.new(coeffs);
      const twiddles = CpuCircleEvaluation.precomputeTwiddles(domain.halfCoset);

      // Forward: polynomial -> evaluation
      const evaluation = CpuCirclePoly.evaluate(poly, domain, twiddles);
      
      // Backward: evaluation -> polynomial  
      const interpolated = CpuCirclePoly.interpolate(evaluation, twiddles);

      // Check round-trip consistency
      expect(interpolated.coeffs.length).toBe(poly.coeffs.length);
      interpolated.coeffs.forEach((coeff, i) => {
        expect(coeff.equals(poly.coeffs[i]!)).toBe(true);
      });
    }
  });
}); 