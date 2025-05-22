import { describe, it, expect } from 'vitest';
import { foldLine, foldCircleIntoLine, decompose } from '../../../src/backend/cpu/fri';
import { LineDomain, LineEvaluation } from '../../../src/poly/line';
import { CanonicCoset } from '../../../src/poly/circle/canonic';
import { SecureEvaluation, BitReversedOrder } from '../../../src/poly/circle';
import { SecureColumnByCoords } from '../../../src/fields/secure_columns';
import { QM31 as SecureField } from '../../../src/fields/qm31';
import { M31 } from '../../../src/fields/m31';
import { Coset } from '../../../src/circle';
import { ibutterfly } from '../../../src/fft';
import { bitReverseIndex } from '../../../src/utils';

function sf(n: number): SecureField {
  return SecureField.from(M31.from(n));
}

function manualFoldLine(domain: LineDomain, values: SecureField[], alpha: SecureField): SecureField[] {
  const res: SecureField[] = [];
  for (let i = 0; i < values.length / 2; i++) {
    const x = domain.at(bitReverseIndex(i << 1, domain.logSize()));
    const [f0, f1] = ibutterfly(values[2 * i], values[2 * i + 1], x.inverse());
    res.push(f0.add(alpha.mul(f1)));
  }
  return res;
}

function manualFoldCircle(domain: any, values: SecureField[], alpha: SecureField): SecureField[] {
  const dst: SecureField[] = Array(values.length / 2).fill(SecureField.ZERO);
  const alphaSq = alpha.mul(alpha);
  for (let i = 0; i < dst.length; i++) {
    const p = domain.at(bitReverseIndex(i << 1, domain.logSize()));
    const [f0, f1] = ibutterfly(values[2 * i], values[2 * i + 1], p.y.inverse());
    const fPrime = alpha.mul(f1).add(f0);
    dst[i] = dst[i].mul(alphaSq).add(fPrime);
  }
  return dst;
}

function manualDecompose(values: SecureField[], domainSize: number): {g: SecureField[]; lambda: SecureField} {
  const half = domainSize / 2;
  let aSum = SecureField.ZERO;
  for (let i = 0; i < half; i++) aSum = aSum.add(values[i]);
  let bSum = SecureField.ZERO;
  for (let i = half; i < domainSize; i++) bSum = bSum.add(values[i]);
  const lambda = aSum.sub(bSum).divM31(M31.from_u32_unchecked(domainSize));
  const g: SecureField[] = [];
  for (let i = 0; i < half; i++) g.push(values[i].sub(lambda));
  for (let i = half; i < domainSize; i++) g.push(values[i].add(lambda));
  return { g, lambda };
}

describe('cpu fri ops', () => {
  it('foldLine matches manual computation', () => {
    const coset = Coset.subgroup(2);
    const domain = new LineDomain(coset);
    const evalValues = [sf(1), sf(2), sf(3), sf(4)];
    const evalObj = new LineEvaluation(domain, evalValues);
    const alpha = sf(5);
    const result = foldLine(evalObj, alpha);
    const expected = manualFoldLine(domain, evalValues, alpha);
    expect(result.values.map(v => v.value)).toEqual(expected.map(v => v.value));
    expect(result.domain.size()).toBe(domain.double().size());
  });

  it('foldCircleIntoLine matches manual computation', () => {
    const cc = CanonicCoset.new(2);
    const domain = cc.circleDomain();
    const lineDomain = new LineDomain(domain.halfCoset);
    const values = [sf(1), sf(2), sf(3), sf(4)];
    const column = SecureColumnByCoords.from(values);
    const evalObj = {
      domain,
      values: column,
      len: () => column.len(),
    } as SecureEvaluation<any, BitReversedOrder>;
    const dst = LineEvaluation.new_zero(lineDomain, SecureField.ZERO);
    const alpha = sf(3);
    foldCircleIntoLine(dst, evalObj, alpha);
    const expected = manualFoldCircle(domain, values, alpha);
    expect(dst.values.map(v => v.value)).toEqual(expected.map(v => v.value));
  });

  it('decompose matches manual computation', () => {
    const cc = CanonicCoset.new(2);
    const domain = cc.circleDomain();
    const values = [sf(5), sf(7), sf(11), sf(13)];
    const column = SecureColumnByCoords.from(values);
    const evalObj = {
      domain,
      values: column,
      len: () => column.len(),
    } as SecureEvaluation<any, BitReversedOrder>;
    const [g, lambda] = decompose(evalObj);
    const manual = manualDecompose(values, column.len());
    expect(lambda.value).toBe(manual.lambda.value);
    const gLen = g.values.len();
    const got = Array.from({ length: gLen }, (_, i) => g.values.at(i).value);
    expect(got).toEqual(manual.g.map(v => v.value));
  });
});
