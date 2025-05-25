// TODO(Jules): Port the Rust `impl GkrOps for CpuBackend` and its helper functions
// (`eval_grand_product_sum`, `eval_logup_sum`, `eval_logup_singles_sum`,
// `gen_eq_evals`, `next_grand_product_layer`, `next_logup_layer`, `MleExpr` enum)
// to TypeScript.
//
// Task: Port the Rust `impl GkrOps for CpuBackend` and its helper functions
// (`eval_grand_product_sum`, `eval_logup_sum`, `eval_logup_singles_sum`,
// `gen_eq_evals`, `next_grand_product_layer`, `next_logup_layer`, `MleExpr` enum)
// to TypeScript.
//
// Details:
// - `GkrOps` methods for `CpuBackend`:
//   - `gen_eq_evals()`: Generates evaluations for `eq(x,y)*v`.
//   - `next_layer()`: Computes the next layer in a GKR proof based on the current
//     layer type (GrandProduct, LogUpGeneric, LogUpMultiplicities, LogUpSingles).
//   - `sum_as_poly_in_first_variable()`: Computes the sum over a
//     `GkrMultivariatePolyOracle` as a univariate polynomial.
// - Helper functions:
//   - `eval_grand_product_sum()`: Evaluates sum for grand product layers.
//   - `eval_logup_sum()`: Evaluates sum for generic log-up layers.
//   - `eval_logup_singles_sum()`: Evaluates sum for log-up layers with single numerators.
//   - `gen_eq_evals()`: (Static/helper version, distinct from the interface method if needed).
//   - `next_grand_product_layer()`: Computes next layer for grand products.
//   - `next_logup_layer()`: Computes next layer for log-ups.
// - `MleExpr` enum: Helper for `next_logup_layer` to handle constant or MLE numerators.
//   This will likely be a discriminated union type or a small class hierarchy in TypeScript.
// - These components would ideally be part of a `CpuBackend` class that implements a
//   `GkrOps` interface (which would be defined based on `core/src/lookups/gkr_prover.ts`).
//
// Dependencies:
// - `BaseField`, `SecureField` from `core/src/fields/`.
// - `Mle` (Multivariate Linear Extension) from `core/src/lookups/mle.ts`.
// - `GkrMultivariatePolyOracle`, `EqEvals`, `Layer` types/interfaces (from
//   `core/src/lookups/gkr_prover.ts`).
// - `UnivariatePoly`, `Fraction`, `Reciprocal` utilities (from
//   `core/src/lookups/utils.ts`).
// - `correct_sum_as_poly_in_first_variable` (from `core/src/lookups/gkr_prover.ts`).
// - The future `GkrOps` interface (itself from `core/src/lookups/gkr_prover.ts`).
//
// Goal: Provide CPU-specific implementations for GKR protocol operations, essential
// for lookup arguments and other advanced STARK components.
//
// Tests: Port the extensive Rust test suite (`gen_eq_evals`, `grand_product_works`,
// various `logup_..._works` tests) to TypeScript to ensure correctness and behavioral
// parity.

import { M31 as BaseField } from '../../../fields/m31';
import { QM31 as SecureField } from '../../../fields/qm31';
import { Mle } from '../../../lookups/mle';
import type { GkrOps, Layer, EqEvals, GkrMultivariatePolyOracle } from '../../../lookups/gkr_prover';
import { UnivariatePoly, eq, Fraction, Reciprocal } from '../../../lookups/utils';
import { correctSumAsPolyInFirstVariable } from '../../../lookups/gkr_prover';
import type { Field } from '../../../fields/fields';

/**
 * MLE expression enum for handling constant or MLE numerators in LogUp layers.
 * This is a discriminated union type equivalent to the Rust MleExpr enum.
 */
type MleExpr = 
  | { type: 'Constant'; value: BaseField }
  | { type: 'MleSecure'; value: Mle<SecureField> }
  | { type: 'MleBase'; value: Mle<BaseField> };

/**
 * Index accessor for MleExpr to get values at specific indices.
 */
function indexMleExpr(expr: MleExpr, index: number): BaseField | SecureField {
  switch (expr.type) {
    case 'Constant':
      return expr.value;
    case 'MleSecure':
      return expr.value.at(index);
    case 'MleBase':
      return expr.value.at(index);
  }
}

/**
 * CPU backend implementation of GKR operations.
 * 
 * This class provides CPU-specific implementations for GKR protocol operations,
 * essential for lookup arguments and other advanced STARK components.
 */
export class CpuGkrOps implements GkrOps {
  /**
   * Returns evaluations `eq(x, y) * v` for all `x` in `{0, 1}^n`.
   * 
   * Evaluations are returned in bit-reversed order.
   */
  genEqEvals(y: SecureField[], v: SecureField): Mle<SecureField> {
    const evals: SecureField[] = [v];

    for (const yI of y.slice().reverse()) {
      const currentLen = evals.length;
      for (let j = 0; j < currentLen; j++) {
        // `lhs[j] = eq(0, y_i) * c[i]`
        // `rhs[j] = eq(1, y_i) * c[i]`
        const tmp = evals[j]!.mul(yI);
        evals.push(tmp);
        evals[j] = evals[j]!.sub(tmp);
      }
    }

    return new Mle(evals);
  }

  /**
   * Generates the next GKR layer from the current one.
   */
  nextLayer(layer: Layer): Layer {
    switch (layer.type) {
      case 'GrandProduct':
        return nextGrandProductLayer(layer.data);
      case 'LogUpGeneric':
        return nextLogupLayer({ type: 'MleSecure', value: layer.numerators }, layer.denominators);
      case 'LogUpMultiplicities':
        return nextLogupLayer({ type: 'MleBase', value: layer.numerators }, layer.denominators);
      case 'LogUpSingles':
        return nextLogupLayer({ type: 'Constant', value: BaseField.one() }, layer.denominators);
    }
  }

  /**
   * Returns univariate polynomial `f(t) = sum_x h(t, x)` for all `x` in the boolean hypercube.
   * 
   * `claim` equals `f(0) + f(1)`.
   */
  sumAsPolyInFirstVariable(
    h: GkrMultivariatePolyOracle,
    claim: SecureField
  ): UnivariatePoly<SecureField> {
    const nVariables = h.nVariables();
    if (nVariables === 0) {
      throw new Error('Number of variables must not be zero');
    }
    
    const nTerms = 1 << (nVariables - 1);
    const eqEvals = h.eqEvals;
    // Vector used to generate evaluations of `eq(x, y)` for `x` in the boolean hypercube.
    const y = eqEvals.getY();
    const lambda = h.lambda;

    let [evalAt0, evalAt2] = (() => {
      switch (h.inputLayer.type) {
        case 'GrandProduct':
          return evalGrandProductSum(eqEvals, h.inputLayer.data, nTerms);
        case 'LogUpGeneric':
          return evalLogupSum(eqEvals, h.inputLayer.numerators, h.inputLayer.denominators, nTerms, lambda);
        case 'LogUpMultiplicities':
          return evalLogupSum(eqEvals, h.inputLayer.numerators, h.inputLayer.denominators, nTerms, lambda);
        case 'LogUpSingles':
          return evalLogupSinglesSum(eqEvals, h.inputLayer.denominators, nTerms, lambda);
      }
    })();

    evalAt0 = evalAt0.mul(h.eqFixedVarCorrection);
    evalAt2 = evalAt2.mul(h.eqFixedVarCorrection);
    
    return correctSumAsPolyInFirstVariable(evalAt0, evalAt2, claim, y, nVariables);
  }
}

/**
 * Evaluates `sum_x eq(({0}^|r|, 0, x), y) * inp(r, t, x, 0) * inp(r, t, x, 1)` at `t=0` and `t=2`.
 * 
 * Output of the form: `(eval_at_0, eval_at_2)`.
 */
function evalGrandProductSum(
  eqEvals: EqEvals,
  inputLayer: Mle<SecureField>,
  nTerms: number
): [SecureField, SecureField] {
  let evalAt0 = SecureField.zero();
  let evalAt2 = SecureField.zero();

  for (let i = 0; i < nTerms; i++) {
    // Input polynomial at points `(r, {0, 1, 2}, bits(i), {0, 1})`.
    const inpAtR0i0 = inputLayer.at(i * 2);
    const inpAtR0i1 = inputLayer.at(i * 2 + 1);
    const inpAtR1i0 = inputLayer.at((nTerms + i) * 2);
    const inpAtR1i1 = inputLayer.at((nTerms + i) * 2 + 1);
    
    // Note `inp(r, t, x) = eq(t, 0) * inp(r, 0, x) + eq(t, 1) * inp(r, 1, x)`
    //   => `inp(r, 2, x) = 2 * inp(r, 1, x) - inp(r, 0, x)`
    // TODO(andrew): Consider evaluation at `1/2` to save an addition operation since
    // `inp(r, 1/2, x) = 1/2 * (inp(r, 1, x) + inp(r, 0, x))`. `1/2 * ...` can be factored
    // outside the loop.
    const inpAtR2i0 = inpAtR1i0.double().sub(inpAtR0i0);
    const inpAtR2i1 = inpAtR1i1.double().sub(inpAtR0i1);

    // Product polynomial `prod(x) = inp(x, 0) * inp(x, 1)` at points `(r, {0, 2}, bits(i))`.
    const prodAtR2i = inpAtR2i0.mul(inpAtR2i1);
    const prodAtR0i = inpAtR0i0.mul(inpAtR0i1);

    const eqEvalAt0i = eqEvals.at(i);
    evalAt0 = evalAt0.add(eqEvalAt0i.mul(prodAtR0i));
    evalAt2 = evalAt2.add(eqEvalAt0i.mul(prodAtR2i));
  }

  return [evalAt0, evalAt2];
}

/**
 * Evaluates `sum_x eq(({0}^|r|, 0, x), y) * (inp_numer(r, t, x, 0) * inp_denom(r, t, x, 1) +
 * inp_numer(r, t, x, 1) * inp_denom(r, t, x, 0) + lambda * inp_denom(r, t, x, 0) * inp_denom(r, t,
 * x, 1))` at `t=0` and `t=2`.
 * 
 * Output of the form: `(eval_at_0, eval_at_2)`.
 */
function evalLogupSum<F extends Field<F>>(
  eqEvals: EqEvals,
  inputNumerators: Mle<F>,
  inputDenominators: Mle<SecureField>,
  nTerms: number,
  lambda: SecureField
): [SecureField, SecureField] {
  let evalAt0 = SecureField.zero();
  let evalAt2 = SecureField.zero();

  for (let i = 0; i < nTerms; i++) {
    // Input polynomials at points `(r, {0, 1, 2}, bits(i), {0, 1})`.
    const inpNumerAtR0i0 = inputNumerators.at(i * 2);
    const inpDenomAtR0i0 = inputDenominators.at(i * 2);
    const inpNumerAtR0i1 = inputNumerators.at(i * 2 + 1);
    const inpDenomAtR0i1 = inputDenominators.at(i * 2 + 1);
    const inpNumerAtR1i0 = inputNumerators.at((nTerms + i) * 2);
    const inpDenomAtR1i0 = inputDenominators.at((nTerms + i) * 2);
    const inpNumerAtR1i1 = inputNumerators.at((nTerms + i) * 2 + 1);
    const inpDenomAtR1i1 = inputDenominators.at((nTerms + i) * 2 + 1);
    
    // Note `inp_denom(r, t, x) = eq(t, 0) * inp_denom(r, 0, x) + eq(t, 1) * inp_denom(r, 1, x)`
    //   => `inp_denom(r, 2, x) = 2 * inp_denom(r, 1, x) - inp_denom(r, 0, x)`
    const inpNumerAtR2i0 = convertToSecureField(inpNumerAtR1i0).double().sub(convertToSecureField(inpNumerAtR0i0));
    const inpDenomAtR2i0 = inpDenomAtR1i0.double().sub(inpDenomAtR0i0);
    const inpNumerAtR2i1 = convertToSecureField(inpNumerAtR1i1).double().sub(convertToSecureField(inpNumerAtR0i1));
    const inpDenomAtR2i1 = inpDenomAtR1i1.double().sub(inpDenomAtR0i1);

    // Fraction addition polynomials:
    // - `numer(x) = inp_numer(x, 0) * inp_denom(x, 1) + inp_numer(x, 1) * inp_denom(x, 0)`
    // - `denom(x) = inp_denom(x, 1) * inp_denom(x, 0)`
    // at points `(r, {0, 2}, bits(i))`.
    const fracAtR0i = Fraction.new(convertToSecureField(inpNumerAtR0i0), inpDenomAtR0i0)
      .addSecureField(Fraction.new(convertToSecureField(inpNumerAtR0i1), inpDenomAtR0i1));
    const fracAtR2i = Fraction.new(inpNumerAtR2i0, inpDenomAtR2i0)
      .addSecureField(Fraction.new(inpNumerAtR2i1, inpDenomAtR2i1));

    const eqEvalAt0i = eqEvals.at(i);
    evalAt0 = evalAt0.add(eqEvalAt0i.mul(fracAtR0i.numerator.add(lambda.mul(fracAtR0i.denominator))));
    evalAt2 = evalAt2.add(eqEvalAt0i.mul(fracAtR2i.numerator.add(lambda.mul(fracAtR2i.denominator))));
  }

  return [evalAt0, evalAt2];
}

/**
 * Evaluates `sum_x eq(({0}^|r|, 0, x), y) * (inp_denom(r, t, x, 1) + inp_denom(r, t, x, 0) +
 * lambda * inp_denom(r, t, x, 0) * inp_denom(r, t, x, 1))` at `t=0` and `t=2`.
 * 
 * Output of the form: `(eval_at_0, eval_at_2)`.
 */
function evalLogupSinglesSum(
  eqEvals: EqEvals,
  inputDenominators: Mle<SecureField>,
  nTerms: number,
  lambda: SecureField
): [SecureField, SecureField] {
  let evalAt0 = SecureField.zero();
  let evalAt2 = SecureField.zero();

  for (let i = 0; i < nTerms; i++) {
    // Input polynomial at points `(r, {0, 1, 2}, bits(i), {0, 1})`.
    const inpDenomAtR0i0 = inputDenominators.at(i * 2);
    const inpDenomAtR0i1 = inputDenominators.at(i * 2 + 1);
    const inpDenomAtR1i0 = inputDenominators.at((nTerms + i) * 2);
    const inpDenomAtR1i1 = inputDenominators.at((nTerms + i) * 2 + 1);
    
    // Note `inp_denom(r, t, x) = eq(t, 0) * inp_denom(r, 0, x) + eq(t, 1) * inp_denom(r, 1, x)`
    //   => `inp_denom(r, 2, x) = 2 * inp_denom(r, 1, x) - inp_denom(r, 0, x)`
    const inpDenomAtR2i0 = inpDenomAtR1i0.double().sub(inpDenomAtR0i0);
    const inpDenomAtR2i1 = inpDenomAtR1i1.double().sub(inpDenomAtR0i1);

    // Fraction addition polynomials at points:
    // - `numer(x) = inp_denom(x, 1) + inp_denom(x, 0)`
    // - `denom(x) = inp_denom(x, 1) * inp_denom(x, 0)`
    // at points `(r, {0, 2}, bits(i))`.
    const fracAtR0i = Reciprocal.new(inpDenomAtR0i0).add<SecureField>(Reciprocal.new(inpDenomAtR0i1));
    const fracAtR2i = Reciprocal.new(inpDenomAtR2i0).add<SecureField>(Reciprocal.new(inpDenomAtR2i1));

    const eqEvalAt0i = eqEvals.at(i);
    evalAt0 = evalAt0.add(eqEvalAt0i.mul(fracAtR0i.numerator.add(lambda.mul(fracAtR0i.denominator))));
    evalAt2 = evalAt2.add(eqEvalAt0i.mul(fracAtR2i.numerator.add(lambda.mul(fracAtR2i.denominator))));
  }

  return [evalAt0, evalAt2];
}

/**
 * Generates the next grand product layer.
 */
function nextGrandProductLayer(layer: Mle<SecureField>): Layer {
  const nextLayerLen = Math.floor(layer.len() / 2);
  const data: SecureField[] = new Array(nextLayerLen);

  for (let i = 0; i < nextLayerLen; i++) {
    const a = layer.at(i * 2);
    const b = layer.at(i * 2 + 1);
    data[i] = a.mul(b);
  }

  return { type: 'GrandProduct', data: new Mle(data) };
}

/**
 * Generates the next logup layer.
 */
function nextLogupLayer(
  numerators: MleExpr,
  denominators: Mle<SecureField>
): Layer {
  const nextLayerLen = Math.floor(denominators.len() / 2);
  const nextNumerators: SecureField[] = new Array(nextLayerLen);
  const nextDenominators: SecureField[] = new Array(nextLayerLen);

  for (let i = 0; i < nextLayerLen; i++) {
    const numerEven = convertToSecureField(indexMleExpr(numerators, i * 2));
    const denomEven = denominators.at(i * 2);
    const numerOdd = convertToSecureField(indexMleExpr(numerators, i * 2 + 1));
    const denomOdd = denominators.at(i * 2 + 1);

    const fracEven = Fraction.new(numerEven, denomEven);
    const fracOdd = Fraction.new(numerOdd, denomOdd);
    const result = fracEven.addSecureField(fracOdd);

    nextNumerators[i] = result.numerator;
    nextDenominators[i] = result.denominator;
  }

  return {
    type: 'LogUpGeneric',
    numerators: new Mle(nextNumerators),
    denominators: new Mle(nextDenominators)
  };
}

/**
 * Helper function to convert field values to SecureField.
 * Handles both BaseField and SecureField inputs.
 */
function convertToSecureField<F>(value: F): SecureField {
  if (value instanceof SecureField) {
    return value;
  } else if (value instanceof BaseField) {
    return SecureField.from(value);
  } else {
    throw new Error('Unsupported field type for conversion to SecureField');
  }
}