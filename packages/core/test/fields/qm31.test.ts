import { describe, it, expect } from "vitest";
import { M31, P } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";
import { QM31, FieldError, P4 } from "../../src/fields/qm31";

function qm31(m0: number, m1: number, m2: number, m3: number): QM31 {
  return QM31.from_u32_unchecked(m0, m1, m2, m3);
}

function m31(value: number): M31 {
  return M31.from_u32_unchecked(value);
}

class SimpleRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x;
    return Math.abs(x);
  }
  nextQM31(): QM31 {
    const a = this.next() % P;
    const b = this.next() % P;
    const c = this.next() % P;
    const d = this.next() % P;
    return qm31(a, b, c, d);
  }
}

describe("QM31", () => {
  // Test exact port of Rust test_inverse
  it("should compute the inverse correctly", () => {
    const qm = qm31(1, 2, 3, 4);
    const qmInv = qm.inverse();
    expect(qm.mul(qmInv).equals(QM31.one())).toBe(true);
  });

  // Test exact port of Rust test_ops
  it("should perform basic operations correctly", () => {
    const qm0 = qm31(1, 2, 3, 4);
    const qm1 = qm31(4, 5, 6, 7);
    const m = m31(8);
    const qm = QM31.from(m);
    const qm0_x_qm1 = qm31(P - 71, 93, P - 16, 50);

    expect(qm0.add(qm1).equals(qm31(5, 7, 9, 11))).toBe(true);
    expect(qm1.addM31(m).equals(qm1.add(qm))).toBe(true);
    expect(qm0.mul(qm1).equals(qm0_x_qm1)).toBe(true);
    expect(qm1.mulM31(m).equals(qm1.mul(qm))).toBe(true);
    expect(qm0.neg().equals(qm31(P - 1, P - 2, P - 3, P - 4))).toBe(true);
    expect(qm0.sub(qm1).equals(qm31(P - 3, P - 3, P - 3, P - 3))).toBe(true);
    expect(qm1.subM31(m).equals(qm1.sub(qm))).toBe(true);
    expect(qm0_x_qm1.div(qm1).equals(qm31(1, 2, 3, 4))).toBe(true);
    expect(qm1.divM31(m).equals(qm1.div(qm))).toBe(true);
  });

  // Test exact port of Rust test_into_slice
  it("should serialize to bytes correctly", () => {
    const rng = new SimpleRng(0);
    const elements: QM31[] = [];
    for (let i = 0; i < 100; i++) {
      elements.push(rng.nextQM31());
    }

    const slice = QM31.into_slice(elements);

    for (let i = 0; i < 100; i++) {
      const sub = slice.slice(i * 16, (i + 1) * 16);
      const view = new DataView(sub.buffer, sub.byteOffset);
      const a = view.getUint32(0, true);
      const b = view.getUint32(4, true);
      const c = view.getUint32(8, true);
      const d = view.getUint32(12, true);
      expect(elements[i]!.equals(qm31(a, b, c, d))).toBe(true);
    }
  });

  // Additional comprehensive tests for full coverage
  describe("Constructor and factory methods", () => {
    it("should validate inputs in from_u32_unchecked and throw FieldError", () => {
      expect(() => QM31.from_u32_unchecked(-1, 0, 0, 0)).toThrow(FieldError);
      expect(() => QM31.from_u32_unchecked(P, 0, 0, 0)).toThrow(FieldError);
      expect(() => QM31.from_u32_unchecked(0, -1, 0, 0)).toThrow(FieldError);
      expect(() => QM31.from_u32_unchecked(0, P, 0, 0)).toThrow(FieldError);
      expect(() => QM31.from_u32_unchecked(0, 0, -1, 0)).toThrow(FieldError);
      expect(() => QM31.from_u32_unchecked(0, 0, P, 0)).toThrow(FieldError);
      expect(() => QM31.from_u32_unchecked(0, 0, 0, -1)).toThrow(FieldError);
      expect(() => QM31.from_u32_unchecked(0, 0, 0, P)).toThrow(FieldError);
      expect(() => QM31.from_u32_unchecked(1.5, 0, 0, 0)).toThrow(FieldError);
      
      // Check that the error messages are descriptive
      expect(() => QM31.from_u32_unchecked(-1, 0, 0, 0)).toThrow("first component must be an integer in [0, P)");
      expect(() => QM31.from_u32_unchecked(0, -1, 0, 0)).toThrow("second component must be an integer in [0, P)");
      expect(() => QM31.from_u32_unchecked(0, 0, -1, 0)).toThrow("third component must be an integer in [0, P)");
      expect(() => QM31.from_u32_unchecked(0, 0, 0, -1)).toThrow("fourth component must be an integer in [0, P)");
    });

    it("should create elements from M31 components", () => {
      const arr: [M31, M31, M31, M31] = [m31(1), m31(2), m31(3), m31(4)];
      const f1 = QM31.from_m31(arr[0], arr[1], arr[2], arr[3]);
      const f2 = QM31.from_m31_array(arr);
      expect(f1.equals(qm31(1, 2, 3, 4))).toBe(true);
      expect(f2.equals(f1)).toBe(true);
      expect(f1.to_m31_array().map(v => v.value)).toEqual([1, 2, 3, 4]);
    });
  });

  describe("from_partial_evals", () => {
    it("should combine partial evaluations correctly", () => {
      const e0 = qm31(1, 0, 0, 0);
      const e1 = qm31(0, 1, 0, 0);
      const e2 = qm31(0, 0, 1, 0);
      const e3 = qm31(0, 0, 0, 1);
      const combined = QM31.from_partial_evals([e0, e1, e2, e3]);
      
      // This should result in zero based on the Rust formula
      expect(combined.equals(QM31.zero())).toBe(true);
    });
  });

  describe("Arithmetic operations", () => {
    it("should handle addition optimizations", () => {
      const zero = QM31.zero();
      const one = QM31.one();
      expect(zero.add(zero).equals(QM31.ZERO)).toBe(true);
      expect(one.add(zero).equals(one)).toBe(true);
    });

    it("should handle subtraction optimizations", () => {
      const zero = QM31.zero();
      const one = QM31.one();
      expect(one.sub(one).equals(QM31.ZERO)).toBe(true);
      expect(one.sub(zero).equals(one)).toBe(true);
    });

    it("should handle negation optimizations", () => {
      const zero = QM31.zero();
      expect(zero.neg().equals(QM31.ZERO)).toBe(true);
    });

    it("should handle multiplication optimizations", () => {
      const zero = QM31.zero();
      const one = QM31.one();
      const f = qm31(1, 2, 3, 4);
      
      expect(zero.mul(f).equals(QM31.ZERO)).toBe(true);
      expect(f.mul(zero).equals(QM31.ZERO)).toBe(true);
      expect(one.mul(f).equals(f)).toBe(true);
      expect(f.mul(one).equals(f)).toBe(true);
    });

    it("should handle mulM31 optimizations", () => {
      const zero = QM31.zero();
      const f = qm31(1, 2, 3, 4);
      const zeroM31 = M31.zero();
      const oneM31 = M31.one();
      
      expect(zero.mulM31(oneM31).equals(QM31.ZERO)).toBe(true);
      expect(f.mulM31(zeroM31).equals(QM31.ZERO)).toBe(true);
      expect(f.mulM31(oneM31).equals(f)).toBe(true);
    });

    it("should handle double operation", () => {
      const f = qm31(1, 2, 3, 4);
      expect(f.double().equals(f.add(f))).toBe(true);
    });

    it("should handle square operation", () => {
      const f = qm31(1, 2, 3, 4);
      expect(f.square().equals(f.mul(f))).toBe(true);
    });

    it("should handle pow operation and throw FieldError for invalid exponents", () => {
      const f = qm31(1, 2, 3, 4);
      expect(f.pow(0).equals(QM31.one())).toBe(true);
      expect(f.pow(1).equals(f)).toBe(true);
      expect(f.pow(2).equals(f.square())).toBe(true);
      expect(f.pow(3).equals(f.mul(f).mul(f))).toBe(true);
      
      expect(() => f.pow(-1)).toThrow(FieldError);
      expect(() => f.pow(1.5)).toThrow(FieldError);
      expect(() => f.pow(-1)).toThrow("Exponent must be a non-negative integer");
    });
  });

  describe("CM31 multiplication", () => {
    it("should multiply by CM31 elements", () => {
      const f = qm31(1, 2, 3, 4);
      const cm = CM31.from_u32_unchecked(5, 6);
      const result = f.mul_cm31(cm);
      const expected = QM31.from_u32_unchecked(
        f.c0.mul(cm).real.value,
        f.c0.mul(cm).imag.value,
        f.c1.mul(cm).real.value,
        f.c1.mul(cm).imag.value
      );
      expect(result.equals(expected)).toBe(true);
    });
  });

  describe("Inverse operations", () => {
    it("should handle inverse optimizations and throw FieldError for zero", () => {
      const one = QM31.one();
      expect(one.inverse().equals(QM31.ONE)).toBe(true);
      
      expect(() => QM31.zero().inverse()).toThrow(FieldError);
      expect(() => QM31.zero().inverse()).toThrow("0 has no inverse");
    });

    it("should verify inverse correctness", () => {
      const f = qm31(5, 7, 11, 13);
      const inv = f.inverse();
      expect(f.mul(inv).equals(QM31.one())).toBe(true);
    });
  });

  describe("Utility methods", () => {
    it("should handle zero checking", () => {
      expect(QM31.zero().isZero()).toBe(true);
      expect(QM31.zero().is_zero()).toBe(true);
      expect(QM31.one().isZero()).toBe(false);
      expect(QM31.one().is_zero()).toBe(false);
    });

    it("should handle equality checking", () => {
      const f1 = qm31(1, 2, 3, 4);
      const f2 = qm31(1, 2, 3, 4);
      const f3 = qm31(1, 2, 3, 5);
      
      expect(f1.equals(f2)).toBe(true);
      expect(f1.equals(f3)).toBe(false);
    });

    it("should handle cloning", () => {
      const f = qm31(1, 2, 3, 4);
      const clone = f.clone();
      expect(f.equals(clone)).toBe(true);
    });

    it("should handle complex conjugate", () => {
      const f = qm31(1, 2, 3, 4);
      const conj = f.complexConjugate();
      expect(conj.c0.imag.value).toBe(P - 2);
      expect(conj.c1.imag.value).toBe(P - 4);
    });

    it("should handle string representation", () => {
      const f = qm31(1, 2, 3, 4);
      const str = f.toString();
      expect(str).toMatch(/\(.+\) \+ \(.+\)u/);
    });
  });

  describe("Conversion methods", () => {
    it("should convert from M31", () => {
      const m = m31(5);
      const f = QM31.from(m);
      expect(f.tryIntoM31()?.value).toBe(5);
    });

    it("should handle tryIntoM31", () => {
      const m = QM31.from(m31(5));
      expect(m.tryIntoM31()?.value).toBe(5);
      
      const f = qm31(1, 2, 3, 4);
      expect(f.tryIntoM31()).toBe(null);
    });
  });

  describe("Serialization", () => {
    it("should handle empty arrays in into_slice", () => {
      const emptyElements: QM31[] = [];
      const slice = QM31.into_slice(emptyElements);
      expect(slice.length).toBe(0);
    });

    it("should handle single element serialization", () => {
      const element = qm31(1, 2, 3, 4);
      const slice = QM31.into_slice([element]);
      expect(slice.length).toBe(16);
      
      const view = new DataView(slice.buffer);
      expect(view.getUint32(0, true)).toBe(1);
      expect(view.getUint32(4, true)).toBe(2);
      expect(view.getUint32(8, true)).toBe(3);
      expect(view.getUint32(12, true)).toBe(4);
    });
  });

  describe("Static constants", () => {
    it("should provide static ZERO and ONE", () => {
      expect(QM31.ZERO.isZero()).toBe(true);
      expect(QM31.ONE.equals(QM31.one())).toBe(true);
      expect(QM31.ZERO.equals(QM31.zero())).toBe(true);
    });
  });

  describe("FieldError class", () => {
    it("should be a proper Error subclass", () => {
      const error = new FieldError("test message");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FieldError);
      expect(error.name).toBe("FieldError");
      expect(error.message).toBe("test message");
    });
  });

  describe("Constants", () => {
    it("should define P4 constant matching Rust implementation", () => {
      // Verify P4 = (2^31 - 1)^4 exactly as in Rust
      const expected = BigInt(P) ** 4n;
      expect(P4).toBe(expected);
      expect(P4).toBe(BigInt('21267647892944572736998860269687930881'));
    });
  });
});
