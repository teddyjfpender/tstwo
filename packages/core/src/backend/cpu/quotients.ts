// TypeScript implementation of quotient polynomial operations

import { CpuBackend, CpuColumnOps } from "./index";
import { CirclePoint } from "../../circle";
import { complexConjugateLineCoeffs } from "../../constraints";
import { CM31 } from "../../fields/cm31";
import { M31 } from "../../fields/m31";
import { QM31 as SecureField } from "../../fields/qm31";
import { SecureColumnByCoords } from "../../fields/secure_columns";
import { batchInverse } from "../../fields/fields";
import type { CircleDomain } from "../../poly/circle/domain";
import { CircleEvaluation, BitReversedOrder } from "../../poly/circle/evaluation";
import { SecureEvaluation } from "../../poly/circle/secure_poly";
import { bitReverseIndex } from "../../utils";

/**
 * A batch of column samplings at a point.
 */
export interface ColumnSampleBatch {
  /** The point at which the columns are sampled. */
  point: CirclePoint<SecureField>;
  /** The sampled column indices and their values at the point. */
  columns_and_values: Array<[number, SecureField]>;
}

/**
 * A sample at a specific point.
 */
export interface PointSample {
  point: CirclePoint<SecureField>;
  value: SecureField;
}

/**
 * Holds the precomputed constant values used in each quotient evaluation.
 */
export interface QuotientConstants {
  /** The line coefficients for each quotient numerator term. */
  line_coeffs: Array<Array<[SecureField, SecureField, SecureField]>>;
  /** The random coefficients used to linearly combine the batched quotients. */
  batch_random_coeffs: SecureField[];
}

/**
 * CpuBackend implementation of quotient accumulation.
 * 
 * Accumulates the quotients of the columns at the given domain.
 * For a column f(x), and a point sample (p,v), the quotient is
 *   (f(x) - V0(x))/V1(x)
 * where V0(p)=v, V0(conj(p))=conj(v), and V1 is a vanishing polynomial for p,conj(p).
 */
export function accumulateQuotients(
  domain: CircleDomain,
  columns: Array<CircleEvaluation<CpuColumnOps<M31>, M31, BitReversedOrder>>,
  random_coeff: SecureField,
  sample_batches: ColumnSampleBatch[],
  _log_blowup_factor: number,
): SecureEvaluation<CpuColumnOps<M31>, BitReversedOrder> {
  const values = SecureColumnByCoords.uninitialized(domain.size());
  const quotient_constants = quotientConstants(sample_batches, random_coeff);

  for (let row = 0; row < domain.size(); row++) {
    const domain_point = domain.at(bitReverseIndex(row, domain.log_size()));
    const query_values_at_row = columns.map(col => col.values[row]!);
    const row_value = accumulateRowQuotients(
      sample_batches,
      query_values_at_row,
      quotient_constants,
      domain_point,
    );
    values.set(row, row_value);
  }

  return new SecureEvaluation(domain, values);
}

/**
 * Calculates the quotient contribution for a single row in the domain.
 */
export function accumulateRowQuotients(
  sample_batches: ColumnSampleBatch[],
  queried_values_at_row: M31[],
  quotient_constants: QuotientConstants,
  domain_point: CirclePoint<M31>,
): SecureField {
  const denominator_inverses = denominatorInverses(sample_batches, domain_point);
  let row_accumulator = SecureField.zero();

  for (let i = 0; i < sample_batches.length; i++) {
    const sample_batch = sample_batches[i]!;
    const line_coeffs = quotient_constants.line_coeffs[i]!;
    const batch_coeff = quotient_constants.batch_random_coeffs[i]!;
    const denominator_inverse = denominator_inverses[i]!;

    let numerator = SecureField.zero();
    
    for (let j = 0; j < sample_batch.columns_and_values.length; j++) {
      const [column_index, _] = sample_batch.columns_and_values[j]!;
      const [a, b, c] = line_coeffs[j]!;
      
      const value = SecureField.from(queried_values_at_row[column_index]!).mul(c);
      // The numerator is a line equation passing through
      //   (sample_point.y, sample_value), (conj(sample_point), conj(sample_value))
      // evaluated at (domain_point.y, value).
      // When substituting a polynomial in this line equation, we get a polynomial with a root
      // at sample_point and conj(sample_point) if the original polynomial had the values
      // sample_value and conj(sample_value) at these points.
      const linear_term = a.mul(SecureField.from(domain_point.y)).add(b);
      numerator = numerator.add(value.sub(linear_term));
    }

    row_accumulator = row_accumulator.mul(batch_coeff).add(numerator.mulCM31(denominator_inverse));
  }

  return row_accumulator;
}

/**
 * Precomputes the complex conjugate line coefficients for each column in each sample batch.
 *
 * For the `i`-th (in a sample batch) column's numerator term `alpha^i * (c * F(p) - (a * p.y +
 * b))`, we precompute and return the constants: (`alpha^i * a`, `alpha^i * b`, `alpha^i * c`).
 */
export function columnLineCoeffs(
  sample_batches: ColumnSampleBatch[],
  random_coeff: SecureField,
): Array<Array<[SecureField, SecureField, SecureField]>> {
  return sample_batches.map(sample_batch => {
    let alpha = SecureField.one();
    return sample_batch.columns_and_values.map(([_, sampled_value]) => {
      alpha = alpha.mul(random_coeff);
      const sample: PointSample = {
        point: sample_batch.point,
        value: sampled_value,
      };
      return complexConjugateLineCoeffs(sample, alpha);
    });
  });
}

/**
 * Precomputes the random coefficients used to linearly combine the batched quotients.
 *
 * For each sample batch we compute random_coeff^(number of columns in the batch),
 * which is used to linearly combine the batch with the next one.
 */
export function batchRandomCoeffs(
  sample_batches: ColumnSampleBatch[],
  random_coeff: SecureField,
): SecureField[] {
  return sample_batches.map(sb => random_coeff.pow(sb.columns_and_values.length));
}

/**
 * Computes inverses of denominators used in quotient calculation.
 * 
 * We want a P to be on a line that passes through a point Pr + uPi in QM31^2, and its conjugate
 * Pr - uPi. Thus, Pr - P is parallel to Pi. Or, (Pr - P).x * Pi.y - (Pr - P).y * Pi.x = 0.
 */
function denominatorInverses(
  sample_batches: ColumnSampleBatch[],
  domain_point: CirclePoint<M31>,
): CM31[] {
  const denominators: CM31[] = [];

  for (const sample_batch of sample_batches) {
    // Extract Pr, Pi from QM31 coordinates
    const prx = sample_batch.point.x.c0.real; // Real part of c0
    const pry = sample_batch.point.y.c0.real; // Real part of c0
    const pix = sample_batch.point.x.c0.imag; // Imaginary part of c0
    const piy = sample_batch.point.y.c0.imag; // Imaginary part of c0
    
    const denominator = prx.sub(domain_point.x).mul(piy).sub(pry.sub(domain_point.y).mul(pix));
    denominators.push(new CM31(denominator, M31.zero()));
  }

  return batchInverse(denominators);
}

/**
 * Bundles precomputed constants for efficient quotient computation.
 */
export function quotientConstants(
  sample_batches: ColumnSampleBatch[],
  random_coeff: SecureField,
): QuotientConstants {
  return {
    line_coeffs: columnLineCoeffs(sample_batches, random_coeff),
    batch_random_coeffs: batchRandomCoeffs(sample_batches, random_coeff),
  };
}
