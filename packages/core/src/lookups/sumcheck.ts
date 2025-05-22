import { UnivariatePoly } from './utils';
import type { Channel } from '../channel';
import { M31 } from '../fields/m31';
import { QM31 as SecureField } from '../fields/qm31';

/**
 * Something that can be seen as a multivariate polynomial `g(x_0, ..., x_{n-1})`.
 * 
 * This trait provides methods for evaluating sums and making transformations on
 * `g` in the context of the sumcheck protocol. It is intended to be used in conjunction with
 * `proveBatch()` to generate proofs.
 */
export interface MultivariatePolyOracle {
  /**
   * Returns the number of variables in `g`.
   */
  nVariables(): number;

  /**
   * Computes the sum of `g(x_0, x_1, ..., x_{n-1})` over all `(x_1, ..., x_{n-1})` in
   * `{0, 1}^(n-1)`, effectively reducing the sum over `g` to a univariate polynomial in `x_0`.
   *
   * `claim` equals the claimed sum of `g(x_0, x_2, ..., x_{n-1})` over all `(x_0, ..., x_{n-1})`
   * in `{0, 1}^n`. Knowing the claim can help optimize the implementation: Let `f` denote the
   * univariate polynomial we want to return. Note that `claim = f(0) + f(1)` so knowing `claim`
   * and either `f(0)` or `f(1)` allows determining the other.
   */
  sumAsPolyInFirstVariable(claim: SecureField): UnivariatePoly<SecureField>;

  /**
   * Returns a transformed oracle where the first variable of `g` is fixed to `challenge`.
   *
   * The returned oracle represents the multivariate polynomial `g'`, defined as
   * `g'(x_1, ..., x_{n-1}) = g(challenge, x_1, ..., x_{n-1})`.
   */
  fixFirstVariable(challenge: SecureField): MultivariatePolyOracle;
}

/**
 * Sum-check proof containing the round polynomials.
 */
export class SumcheckProof {
  constructor(public readonly roundPolys: UnivariatePoly<SecureField>[]) {}
}

/**
 * Max degree of polynomials the verifier accepts in each round of the protocol.
 */
export const MAX_DEGREE = 3;

/**
 * Sum-check round index where 0 corresponds to the first round.
 */
export type RoundIndex = number;

/**
 * Sum-check protocol verification error.
 */
export class SumcheckError extends Error {
  constructor(message: string, public readonly round?: RoundIndex) {
    super(message);
    this.name = 'SumcheckError';
  }

  static degreeInvalid(round: RoundIndex): SumcheckError {
    return new SumcheckError(`degree of the polynomial in round ${round} is too high`, round);
  }

  static sumInvalid(claim: SecureField, sum: SecureField, round: RoundIndex): SumcheckError {
    return new SumcheckError(
      `sum does not match the claim in round ${round} (sum ${sum}, claim ${claim})`,
      round
    );
  }
}

/**
 * Performs sum-check on a random linear combinations of multiple multivariate polynomials.
 *
 * Let the multivariate polynomials be `g_0, ..., g_{n-1}`. A single sum-check is performed on
 * multivariate polynomial `h = g_0 + lambda * g_1 + ... + lambda^(n-1) * g_{n-1}`. The `g_i`s do
 * not need to have the same number of variables. `g_i`s with less variables are folded in the
 * latest possible round of the protocol. For instance with `g_0(x, y, z)` and `g_1(x, y)`
 * sum-check is performed on `h(x, y, z) = g_0(x, y, z) + lambda * g_1(y, z)`. Claim `c_i` should
 * equal the claimed sum of `g_i(x_0, ..., x_{j-1})` over all `(x_0, ..., x_{j-1})` in `{0, 1}^j`.
 *
 * The degree of each `g_i` should not exceed `MAX_DEGREE` in any variable. The sum-check proof
 * of `h`, list of challenges (variable assignment) and the constant oracles (i.e. the `g_i` with
 * all variables fixed to the their corresponding challenges) are returned.
 *
 * Output is of the form: `[proof, variable_assignment, constant_poly_oracles, claimed_evals]`
 *
 * @throws Error if:
 * - No multivariate polynomials are provided.
 * - There aren't the same number of multivariate polynomials and claims.
 * - The degree of any multivariate polynomial exceeds `MAX_DEGREE` in any variable.
 * - The round polynomials are inconsistent with their corresponding claimed sum on `0` and `1`.
 */
export function proveBatch<O extends MultivariatePolyOracle>(
  claims: SecureField[],
  multivariatePolys: O[],
  lambda: SecureField,
  channel: Channel
): [SumcheckProof, SecureField[], O[], SecureField[]] {
  if (multivariatePolys.length === 0) {
    throw new Error('No multivariate polynomials provided');
  }
  if (claims.length !== multivariatePolys.length) {
    throw new Error('Mismatch between number of claims and polynomials');
  }

  const nVariables = Math.max(...multivariatePolys.map(p => p.nVariables()));
  const mutableClaims = [...claims];
  let mutablePolys = [...multivariatePolys];

  const roundPolys: UnivariatePoly<SecureField>[] = [];
  const assignment: SecureField[] = [];

  // Update the claims for the sum over `h`'s hypercube.
  for (let i = 0; i < mutableClaims.length; i++) {
    const nUnusedVariables = nVariables - mutablePolys[i].nVariables();
    mutableClaims[i] = mutableClaims[i].mulM31(M31.from(1 << nUnusedVariables));
  }

  // Prove sum-check rounds
  for (let round = 0; round < nVariables; round++) {
    const nRemainingRounds = nVariables - round;

    const thisRoundPolys = mutablePolys.map((multivariatePolyM, i) => {
      const claim = mutableClaims[i];
      
      const roundPoly = nRemainingRounds === multivariatePolyM.nVariables()
        ? multivariatePolyM.sumAsPolyInFirstVariable(claim)
        : UnivariatePoly.from(claim.divM31(M31.from(2)));

      const evalAt0 = roundPoly.evalAtPoint(SecureField.zero());
      const evalAt1 = roundPoly.evalAtPoint(SecureField.one());
      
      if (!evalAt0.add(evalAt1).equals(claim)) {
        throw new Error(`Round polynomial check failed: i=${i}, round=${round}`);
      }
      if (roundPoly.degree() > MAX_DEGREE) {
        throw new Error(`Polynomial degree too high: i=${i}, round=${round}`);
      }

      return roundPoly;
    });

    const roundPoly = randomLinearCombination(thisRoundPolys, lambda);

    channel.mix_felts(roundPoly.getCoeffs());

    const challenge = channel.draw_felt();

    for (let i = 0; i < mutableClaims.length; i++) {
      mutableClaims[i] = thisRoundPolys[i].evalAtPoint(challenge);
    }

    mutablePolys = mutablePolys.map(multivariatePolyM => {
      if (nRemainingRounds !== multivariatePolyM.nVariables()) {
        return multivariatePolyM;
      }
      return multivariatePolyM.fixFirstVariable(challenge) as O;
    });

    roundPolys.push(roundPoly);
    assignment.push(challenge);
  }

  const proof = new SumcheckProof(roundPolys);
  return [proof, assignment, mutablePolys, mutableClaims];
}

/**
 * Returns `p_0 + alpha * p_1 + ... + alpha^(n-1) * p_{n-1}`.
 */
function randomLinearCombination(
  polys: UnivariatePoly<SecureField>[],
  alpha: SecureField
): UnivariatePoly<SecureField> {
  return polys.reduceRight(
    (acc, poly) => acc.mulScalar(alpha).add(poly),
    UnivariatePoly.zero(SecureField.zero())
  );
}

/**
 * Partially verifies a sum-check proof.
 *
 * Only "partial" since it does not fully verify the prover's claimed evaluation on the variable
 * assignment but checks if the sum of the round polynomials evaluated on `0` and `1` matches the
 * claim for each round. If the proof passes these checks, the variable assignment and the prover's
 * claimed evaluation are returned for the caller to validate otherwise an error is thrown.
 *
 * @returns `[variable_assignment, claimed_eval]`
 * @throws SumcheckError if verification fails
 */
export function partiallyVerify(
  claim: SecureField,
  proof: SumcheckProof,
  channel: Channel
): [SecureField[], SecureField] {
  let mutableClaim = claim;
  const assignment: SecureField[] = [];

  for (let round = 0; round < proof.roundPolys.length; round++) {
    const roundPoly = proof.roundPolys[round];

    if (roundPoly.degree() > MAX_DEGREE) {
      throw SumcheckError.degreeInvalid(round);
    }

    // TODO: optimize this by sending one less coefficient, and computing it from the
    // claim, instead of checking the claim. (Can also be done by quotienting).
    const sum = roundPoly.evalAtPoint(SecureField.zero()).add(roundPoly.evalAtPoint(SecureField.one()));

    if (!mutableClaim.equals(sum)) {
      throw SumcheckError.sumInvalid(mutableClaim, sum, round);
    }

    channel.mix_felts(roundPoly.getCoeffs());
    const challenge = channel.draw_felt();
    mutableClaim = roundPoly.evalAtPoint(challenge);
    assignment.push(challenge);
  }

  return [assignment, mutableClaim];
}

/*
```rs
//! Sum-check protocol that proves and verifies claims about `sum_x g(x)` for all x in `{0, 1}^n`.
//!
//! [`MultivariatePolyOracle`] provides methods for evaluating sums and making transformations on
//! `g` in the context of the protocol. It is intended to be used in conjunction with
//! [`prove_batch()`] to generate proofs.

use std::iter::zip;

use itertools::Itertools;
use num_traits::{One, Zero};
use thiserror::Error;

use super::utils::UnivariatePoly;
use crate::core::channel::Channel;
use crate::core::fields::m31::BaseField;
use crate::core::fields::qm31::SecureField;

/// Something that can be seen as a multivariate polynomial `g(x_0, ..., x_{n-1})`.
pub trait MultivariatePolyOracle: Sized {
    /// Returns the number of variables in `g`.
    fn n_variables(&self) -> usize;

    /// Computes the sum of `g(x_0, x_1, ..., x_{n-1})` over all `(x_1, ..., x_{n-1})` in
    /// `{0, 1}^(n-1)`, effectively reducing the sum over `g` to a univariate polynomial in `x_0`.
    ///
    /// `claim` equals the claimed sum of `g(x_0, x_2, ..., x_{n-1})` over all `(x_0, ..., x_{n-1})`
    /// in `{0, 1}^n`. Knowing the claim can help optimize the implementation: Let `f` denote the
    /// univariate polynomial we want to return. Note that `claim = f(0) + f(1)` so knowing `claim`
    /// and either `f(0)` or `f(1)` allows determining the other.
    fn sum_as_poly_in_first_variable(&self, claim: SecureField) -> UnivariatePoly<SecureField>;

    /// Returns a transformed oracle where the first variable of `g` is fixed to `challenge`.
    ///
    /// The returned oracle represents the multivariate polynomial `g'`, defined as
    /// `g'(x_1, ..., x_{n-1}) = g(challenge, x_1, ..., x_{n-1})`.
    fn fix_first_variable(self, challenge: SecureField) -> Self;
}

/// Performs sum-check on a random linear combinations of multiple multivariate polynomials.
///
/// Let the multivariate polynomials be `g_0, ..., g_{n-1}`. A single sum-check is performed on
/// multivariate polynomial `h = g_0 + lambda * g_1 + ... + lambda^(n-1) * g_{n-1}`. The `g_i`s do
/// not need to have the same number of variables. `g_i`s with less variables are folded in the
/// latest possible round of the protocol. For instance with `g_0(x, y, z)` and `g_1(x, y)`
/// sum-check is performed on `h(x, y, z) = g_0(x, y, z) + lambda * g_1(y, z)`. Claim `c_i` should
/// equal the claimed sum of `g_i(x_0, ..., x_{j-1})` over all `(x_0, ..., x_{j-1})` in `{0, 1}^j`.
///
/// The degree of each `g_i` should not exceed [`MAX_DEGREE`] in any variable.  The sum-check proof
/// of `h`, list of challenges (variable assignment) and the constant oracles (i.e. the `g_i` with
/// all variables fixed to the their corresponding challenges) are returned.
///
/// Output is of the form: `(proof, variable_assignment, constant_poly_oracles, claimed_evals)`
///
/// # Panics
///
/// Panics if:
/// - No multivariate polynomials are provided.
/// - There aren't the same number of multivariate polynomials and claims.
/// - The degree of any multivariate polynomial exceeds [`MAX_DEGREE`] in any variable.
/// - The round polynomials are inconsistent with their corresponding claimed sum on `0` and `1`.
// TODO: Consider returning constant oracles as separate type.
pub fn prove_batch<O: MultivariatePolyOracle>(
    mut claims: Vec<SecureField>,
    mut multivariate_polys: Vec<O>,
    lambda: SecureField,
    channel: &mut impl Channel,
) -> (SumcheckProof, Vec<SecureField>, Vec<O>, Vec<SecureField>) {
    let n_variables = multivariate_polys.iter().map(O::n_variables).max().unwrap();
    assert_eq!(claims.len(), multivariate_polys.len());

    let mut round_polys = Vec::new();
    let mut assignment = Vec::new();

    // Update the claims for the sum over `h`'s hypercube.
    for (claim, multivariate_poly) in zip(&mut claims, &multivariate_polys) {
        let n_unused_variables = n_variables - multivariate_poly.n_variables();
        *claim *= BaseField::from(1 << n_unused_variables);
    }

    // Prove sum-check rounds
    for round in 0..n_variables {
        let n_remaining_rounds = n_variables - round;

        let this_round_polys = zip(&multivariate_polys, &claims)
            .enumerate()
            .map(|(i, (multivariate_poly, &claim))| {
                let round_poly = if n_remaining_rounds == multivariate_poly.n_variables() {
                    multivariate_poly.sum_as_poly_in_first_variable(claim)
                } else {
                    (claim / BaseField::from(2)).into()
                };

                let eval_at_0 = round_poly.eval_at_point(SecureField::zero());
                let eval_at_1 = round_poly.eval_at_point(SecureField::one());
                assert_eq!(eval_at_0 + eval_at_1, claim, "i={i}, round={round}");
                assert!(round_poly.degree() <= MAX_DEGREE, "i={i}, round={round}");

                round_poly
            })
            .collect_vec();

        let round_poly = random_linear_combination(&this_round_polys, lambda);

        channel.mix_felts(&round_poly);

        let challenge = channel.draw_felt();

        claims = this_round_polys
            .iter()
            .map(|round_poly| round_poly.eval_at_point(challenge))
            .collect();

        multivariate_polys = multivariate_polys
            .into_iter()
            .map(|multivariate_poly| {
                if n_remaining_rounds != multivariate_poly.n_variables() {
                    return multivariate_poly;
                }

                multivariate_poly.fix_first_variable(challenge)
            })
            .collect();

        round_polys.push(round_poly);
        assignment.push(challenge);
    }

    let proof = SumcheckProof { round_polys };

    (proof, assignment, multivariate_polys, claims)
}

/// Returns `p_0 + alpha * p_1 + ... + alpha^(n-1) * p_{n-1}`.
fn random_linear_combination(
    polys: &[UnivariatePoly<SecureField>],
    alpha: SecureField,
) -> UnivariatePoly<SecureField> {
    polys
        .iter()
        .rfold(Zero::zero(), |acc, poly| acc * alpha + poly.clone())
}

/// Partially verifies a sum-check proof.
///
/// Only "partial" since it does not fully verify the prover's claimed evaluation on the variable
/// assignment but checks if the sum of the round polynomials evaluated on `0` and `1` matches the
/// claim for each round. If the proof passes these checks, the variable assignment and the prover's
/// claimed evaluation are returned for the caller to validate otherwise an [`Err`] is returned.
///
/// Output is of the form `(variable_assignment, claimed_eval)`.
pub fn partially_verify(
    mut claim: SecureField,
    proof: &SumcheckProof,
    channel: &mut impl Channel,
) -> Result<(Vec<SecureField>, SecureField), SumcheckError> {
    let mut assignment = Vec::new();

    for (round, round_poly) in proof.round_polys.iter().enumerate() {
        if round_poly.degree() > MAX_DEGREE {
            return Err(SumcheckError::DegreeInvalid { round });
        }

        // TODO: optimize this by sending one less coefficient, and computing it from the
        // claim, instead of checking the claim. (Can also be done by quotienting).
        let sum = round_poly.eval_at_point(Zero::zero()) + round_poly.eval_at_point(One::one());

        if claim != sum {
            return Err(SumcheckError::SumInvalid { claim, sum, round });
        }

        channel.mix_felts(round_poly);
        let challenge = channel.draw_felt();
        claim = round_poly.eval_at_point(challenge);
        assignment.push(challenge);
    }

    Ok((assignment, claim))
}

#[derive(Debug, Clone)]
pub struct SumcheckProof {
    pub round_polys: Vec<UnivariatePoly<SecureField>>,
}

/// Max degree of polynomials the verifier accepts in each round of the protocol.
pub const MAX_DEGREE: usize = 3;

/// Sum-check protocol verification error.
#[derive(Error, Debug)]
pub enum SumcheckError {
    #[error("degree of the polynomial in round {round} is too high")]
    DegreeInvalid { round: RoundIndex },
    #[error("sum does not match the claim in round {round} (sum {sum}, claim {claim})")]
    SumInvalid {
        claim: SecureField,
        sum: SecureField,
        round: RoundIndex,
    },
}

/// Sum-check round index where 0 corresponds to the first round.
pub type RoundIndex = usize;

#[cfg(test)]
mod tests {

    use num_traits::One;

    use crate::core::backend::CpuBackend;
    use crate::core::channel::{Blake2sChannel, Channel};
    use crate::core::fields::qm31::SecureField;
    use crate::core::fields::Field;
    use crate::core::lookups::mle::Mle;
    use crate::core::lookups::sumcheck::{partially_verify, prove_batch};

    #[test]
    fn sumcheck_works() {
        let values = test_channel().draw_felts(32);
        let claim = values.iter().sum();
        let mle = Mle::<CpuBackend, SecureField>::new(values);
        let lambda = SecureField::one();
        let (proof, ..) = prove_batch(vec![claim], vec![mle.clone()], lambda, &mut test_channel());

        let (assignment, eval) = partially_verify(claim, &proof, &mut test_channel()).unwrap();

        assert_eq!(eval, mle.eval_at_point(&assignment));
    }

    #[test]
    fn batch_sumcheck_works() {
        let mut channel = test_channel();
        let values0 = channel.draw_felts(32);
        let values1 = channel.draw_felts(32);
        let claim0 = values0.iter().sum();
        let claim1 = values1.iter().sum();
        let mle0 = Mle::<CpuBackend, SecureField>::new(values0.clone());
        let mle1 = Mle::<CpuBackend, SecureField>::new(values1.clone());
        let lambda = channel.draw_felt();
        let claims = vec![claim0, claim1];
        let mles = vec![mle0.clone(), mle1.clone()];
        let (proof, ..) = prove_batch(claims, mles, lambda, &mut test_channel());

        let claim = claim0 + lambda * claim1;
        let (assignment, eval) = partially_verify(claim, &proof, &mut test_channel()).unwrap();

        let eval0 = mle0.eval_at_point(&assignment);
        let eval1 = mle1.eval_at_point(&assignment);
        assert_eq!(eval, eval0 + lambda * eval1);
    }

    #[test]
    fn batch_sumcheck_with_different_n_variables() {
        let mut channel = test_channel();
        let values0 = channel.draw_felts(64);
        let values1 = channel.draw_felts(32);
        let claim0 = values0.iter().sum();
        let claim1 = values1.iter().sum();
        let mle0 = Mle::<CpuBackend, SecureField>::new(values0.clone());
        let mle1 = Mle::<CpuBackend, SecureField>::new(values1.clone());
        let lambda = channel.draw_felt();
        let claims = vec![claim0, claim1];
        let mles = vec![mle0.clone(), mle1.clone()];
        let (proof, ..) = prove_batch(claims, mles, lambda, &mut test_channel());

        let claim = claim0 + lambda * claim1.double();
        let (assignment, eval) = partially_verify(claim, &proof, &mut test_channel()).unwrap();

        let eval0 = mle0.eval_at_point(&assignment);
        let eval1 = mle1.eval_at_point(&assignment[1..]);
        assert_eq!(eval, eval0 + lambda * eval1);
    }

    #[test]
    fn invalid_sumcheck_proof_fails() {
        let values = test_channel().draw_felts(8);
        let claim = values.iter().sum::<SecureField>();
        let lambda = SecureField::one();
        // Compromise the first value.
        let mut invalid_values = values;
        invalid_values[0] += SecureField::one();
        let invalid_claim = vec![invalid_values.iter().sum::<SecureField>()];
        let invalid_mle = vec![Mle::<CpuBackend, SecureField>::new(invalid_values.clone())];
        let (invalid_proof, ..) =
            prove_batch(invalid_claim, invalid_mle, lambda, &mut test_channel());

        assert!(partially_verify(claim, &invalid_proof, &mut test_channel()).is_err());
    }

    fn test_channel() -> Blake2sChannel {
        Blake2sChannel::default()
    }
}
```
*/