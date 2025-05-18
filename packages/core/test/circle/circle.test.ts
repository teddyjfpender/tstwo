import { describe, it, expect } from "vitest";
import { CirclePoint, CirclePointIndex, Coset, SECURE_FIELD_CIRCLE_GEN, SECURE_FIELD_CIRCLE_ORDER, M31_CIRCLE_LOG_ORDER } from "../../src/circle";
import { QM31 as SecureField } from "../../src/fields/qm31";

class DummyChannel {
  private c = 1;
  draw_felt(): SecureField {
    const val = this.c++;
    return SecureField.fromUnchecked(val, val + 1, val + 2, val + 3);
  }
}

describe("Coset iteration", () => {
  it("produces expected indices and points", () => {
    const coset = Coset.new(new CirclePointIndex(1), 3);
    const actualIndices = Array.from(coset.iter_indices()).map(i => i.value);
    const step = CirclePointIndex.subgroup_gen(3);
    const expectedIndices = Array.from({length: 8}, (_,i)=> new CirclePointIndex(1).add(step.mul(i)).value);
    expect(actualIndices).toEqual(expectedIndices);

    const actualPoints = Array.from(coset.iter()).map(p=>p.x.value);
    const expectedPoints = expectedIndices.map(v => new CirclePointIndex(v).to_point().x.value);
    expect(actualPoints).toEqual(expectedPoints);
  });
});

describe("Coset splitting", () => {
  it("half coset and its conjugate partition odds", () => {
    const logSize = 5;
    const coset = Coset.odds(logSize);
    const half = Coset.half_odds(logSize - 1);
    const conj = half.conjugate();
    const toKey = (p: any) => `${p.x.value},${p.y.value}`;
    const setHalf = new Set(Array.from(half.iter()).map(toKey));
    const setConj = new Set(Array.from(conj.iter()).map(toKey));
    expect([...setHalf].filter(x=>setConj.has(x)).length).toBe(0);
    const union = new Set([...setHalf, ...setConj]);
    const full = new Set(Array.from(coset.iter()).map(toKey));
    expect(union).toEqual(full);
  });
});

describe("CirclePoint utilities", () => {
  it("get_random_point draws different points", () => {
    const channel = new DummyChannel();
    const first = CirclePoint.get_random_point(channel);
    const second = CirclePoint.get_random_point(channel);
    expect(first.x.equals(second.x)).toBe(false);
  });

  it("secure field generator has correct order", () => {
    const sum = SECURE_FIELD_CIRCLE_GEN.mul(SECURE_FIELD_CIRCLE_ORDER, SecureField);
    const zero = CirclePoint.zero(SecureField);
    expect(sum.x.equals(zero.x)).toBe(true);
    expect(sum.y.equals(zero.y)).toBe(true);
    const lhs = SECURE_FIELD_CIRCLE_GEN.x.square().add(SECURE_FIELD_CIRCLE_GEN.y.square());
    expect(lhs.equals(SecureField.one())).toBe(true);
  });
});

describe("CirclePoint math helpers", () => {
  const F = SecureField;
  it("double_x matches point doubling", () => {
    const p = CirclePoint.get_point(5n);
    const doubled = p.add(p);
    expect(CirclePoint.double_x(p.x, F).equals(doubled.x)).toBe(true);
  });

  it("log_order returns expected", () => {
    expect(SECURE_FIELD_CIRCLE_GEN.log_order(F)).toBe(M31_CIRCLE_LOG_ORDER);
  });

  it("mul matches repeated addition", () => {
    const p = CirclePoint.get_point(3n);
    const q = p.mul(5n, F);
    let r = CirclePoint.zero(F);
    for(let i=0;i<5;i++) r = r.add(p);
    expect(q.x.equals(r.x)).toBe(true);
    expect(q.y.equals(r.y)).toBe(true);
  });

  it("repeated_double matches iterative doubling", () => {
    const p = CirclePoint.get_point(7n);
    const q = p.repeated_double(4);
    let r = p.clone();
    for(let i=0;i<4;i++) r = r.double();
    expect(q.x.equals(r.x)).toBe(true);
    expect(q.y.equals(r.y)).toBe(true);
  });
});
