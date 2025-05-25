import type { MultivariatePolyOracle } from './sumcheck';
import { UnivariatePoly, foldMleEvals } from './utils';
import { QM31 as SecureField } from '../fields/qm31';
import { M31 } from '../fields/m31';
import type { Field } from '../fields/fields';

/**
 * Multilinear Extension stored as evaluations of a multilinear polynomial over the boolean
 * hypercube in bit-reversed order.
 */
export class Mle<F extends Field<F>> {
  private evals: F[];

  /**
   * Creates a [`Mle`] from evaluations of a multilinear polynomial on the boolean hypercube.
   *
   * @throws Error if the number of evaluations is not a power of two.
   */
  constructor(evals: F[]) {
    // Allow empty arrays (0-variable MLEs represent constants)
    if (evals.length > 0 && (evals.length & (evals.length - 1)) !== 0) {
      throw new Error('Number of evaluations must be a power of two');
    }
    this.evals = [...evals];
  }

  /**
   * Returns the underlying evaluations.
   */
  intoEvals(): F[] {
    return [...this.evals];
  }

  /**
   * Returns the number of variables in the polynomial.
   */
  nVariables(): number {
    if (this.evals.length === 0) {
      return 0; // 0-variable MLE (constant)
    }
    return Math.log2(this.evals.length);
  }

  /**
   * Returns the length of the evaluation vector.
   */
  len(): number {
    return this.evals.length;
  }

  /**
   * Get evaluation at index.
   */
  at(index: number): F {
    const value = this.evals[index];
    if (value === undefined) {
      throw new Error(`Index ${index} out of bounds`);
    }
    return value;
  }

  /**
   * Set evaluation at index.
   */
  set(index: number, value: F): void {
    if (index < 0 || index >= this.evals.length) {
      throw new Error(`Index ${index} out of bounds`);
    }
    this.evals[index] = value;
  }

  /**
   * Get a slice of evaluations.
   */
  slice(start: number, end?: number): F[] {
    return this.evals.slice(start, end);
  }

  /**
   * Evaluates the multilinear polynomial at `point`.
   */
  evalAtPoint(point: SecureField[]): SecureField {
    function evaluateMle(mleEvals: SecureField[], p: SecureField[]): SecureField {
      if (p.length === 0) {
        const firstEval = mleEvals[0];
        if (firstEval === undefined) {
          throw new Error('Empty evaluation array');
        }
        return firstEval;
      }
      
      const pI = p[0];
      if (pI === undefined) {
        throw new Error('Empty point array');
      }
      const pRest = p.slice(1);
      const mid = mleEvals.length / 2;
      const lhs = mleEvals.slice(0, mid);
      const rhs = mleEvals.slice(mid);
      
      const lhsEval = evaluateMle(lhs, pRest);
      const rhsEval = evaluateMle(rhs, pRest);
      
      // Equivalent to `eq(0, p_i) * lhs_eval + eq(1, p_i) * rhs_eval`.
      return pI.mul(rhsEval.sub(lhsEval)).add(lhsEval);
    }

    // Convert to SecureField - this only works if F is compatible with SecureField
    const secureEvals: SecureField[] = [];
    for (const val of this.evals) {
      // We assume this MLE contains SecureField values or values convertible to SecureField
      secureEvals.push(val as unknown as SecureField);
    }
    return evaluateMle(secureEvals, point);
  }

  /**
   * Returns a transformed polynomial where the first variable is fixed to `assignment`.
   */
  fixFirstVariable(assignment: SecureField): Mle<SecureField> {
    const midpoint = this.len() / 2;
    const lhsEvals = this.slice(0, midpoint);
    const rhsEvals = this.slice(midpoint);

    const result = lhsEvals.map((lhsEval, i) => {
      const rhsEval = rhsEvals[i];
      if (rhsEval === undefined) {
        throw new Error(`Missing evaluation at index ${i}`);
      }
      // Convert to SecureField for folding
      const lhsSecure = lhsEval as unknown as SecureField;
      const rhsSecure = rhsEval as unknown as SecureField;
      return foldMleEvals(assignment, lhsSecure, rhsSecure);
    });

    return new Mle(result);
  }

  /**
   * Creates a clone of this MLE.
   */
  clone(): Mle<F> {
    return new Mle([...this.evals]);
  }
}

/**
 * MLE implementation for SecureField that implements MultivariatePolyOracle.
 */
export class SecureMle extends Mle<SecureField> implements MultivariatePolyOracle {
  constructor(evals: SecureField[]) {
    super(evals);
  }

  /**
   * Returns the number of variables in `g`.
   */
  nVariables(): number {
    return super.nVariables();
  }

  /**
   * Computes the sum of `g(x_0, x_1, ..., x_{n-1})` over all `(x_1, ..., x_{n-1})` in
   * `{0, 1}^(n-1)`, effectively reducing the sum over `g` to a univariate polynomial in `x_0`.
   */
  sumAsPolyInFirstVariable(claim: SecureField): UnivariatePoly<SecureField> {
    const x0 = SecureField.zero();
    const x1 = SecureField.one();

    // Sum the first half (when x_0 = 0)
    const halfLen = this.len() / 2;
    let y0 = SecureField.zero();
    for (let i = 0; i < halfLen; i++) {
      y0 = y0.add(this.at(i));
    }

    // The second half sum (when x_0 = 1) can be computed from claim
    const y1 = claim.sub(y0);

    return UnivariatePoly.interpolateLagrange([x0, x1], [y0, y1]);
  }

  /**
   * Returns a transformed oracle where the first variable of `g` is fixed to `challenge`.
   */
  fixFirstVariable(challenge: SecureField): SecureMle {
    return new SecureMle(super.fixFirstVariable(challenge).intoEvals());
  }
}