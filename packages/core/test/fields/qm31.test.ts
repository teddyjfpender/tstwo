import { describe, it, expect } from "vitest";
import { M31, P } from "../../src/fields/m31";
import { CM31 } from "../../src/fields/cm31";
import { QM31 } from "../../src/fields/qm31";

function qm31(m0: number, m1: number, m2: number, m3: number): QM31 {
  return QM31.fromUnchecked(m0, m1, m2, m3);
}

function m31(value: number): M31 {
  return M31.fromUnchecked(value);
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
  it("should compute the inverse correctly", () => {
    const qm = qm31(1, 2, 3, 4);
    const qmInv = qm.inverse();
    expect(qm.mul(qmInv).equals(QM31.one())).toBe(true);
  });

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

  it("should serialize to bytes correctly", () => {
    const rng = new SimpleRng(0);
    const elements: QM31[] = [];
    for (let i = 0; i < 100; i++) {
      elements.push(rng.nextQM31());
    }

    const slice = QM31.intoSlice(elements);

    for (let i = 0; i < 100; i++) {
      const sub = slice.slice(i * 16, (i + 1) * 16);
      const a = new DataView(sub.buffer).getUint32(0, true);
      const b = new DataView(sub.buffer).getUint32(4, true);
      const c = new DataView(sub.buffer).getUint32(8, true);
      const d = new DataView(sub.buffer).getUint32(12, true);
      expect(elements[i]!.equals(qm31(a, b, c, d))).toBe(true);
    }
  });

  it("fromPartialEvals and other helpers", () => {
    const e0 = qm31(1,0,0,0);
    const e1 = qm31(0,1,0,0);
    const e2 = qm31(0,0,1,0);
    const e3 = qm31(0,0,0,1);
    const combined = QM31.fromPartialEvals([e0,e1,e2,e3]);
    expect(combined.equals(QM31.zero())).toBe(true);
    expect(combined.square().equals(combined.mul(combined))).toBe(true);
    expect(combined.pow(3).equals(combined.mul(combined).mul(combined))).toBe(true);
    const m = QM31.from(m31(5));
    expect(m.tryIntoM31()!.value).toBe(5);
  });
  it("additional helpers", () => {
    const arr = [m31(1), m31(2), m31(3), m31(4)];
    const f1 = QM31.fromM31(arr[0], arr[1], arr[2], arr[3]);
    const f2 = QM31.fromM31Array(arr);
    expect(f1.equals(qm31(1,2,3,4))).toBe(true);
    expect(f2.equals(f1)).toBe(true);
    expect(f1.toM31Array().map(v => v.value)).toEqual([1,2,3,4]);
    const cm = CM31.fromUnchecked(5,6);
    expect(f1.mulCM31(cm).equals(new QM31(f1.c0.mul(cm), f1.c1.mul(cm)))).toBe(true);
    const conj = f1.complexConjugate();
    expect(conj.c0.imag.value).toBe(P - 2);
  });

});
