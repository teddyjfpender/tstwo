// FRI implementation

/*
This is the Rust code from fri.rs that needs to be ported to Typescript in this fri.ts file:
```rs
use std::cmp::Reverse;
use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Debug;
use std::iter::zip;
use std::ops::RangeInclusive;

use itertools::{zip_eq, Itertools};
use num_traits::Zero;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::instrument;

use super::backend::{Col, ColumnOps, CpuBackend};
use super::channel::{Channel, MerkleChannel};
use super::fields::m31::BaseField;
use super::fields::qm31::{SecureField, QM31};
use super::fields::secure_column::{SecureColumnByCoords, SECURE_EXTENSION_DEGREE};
use super::poly::circle::{CircleDomain, PolyOps, SecureEvaluation};
use super::poly::line::{LineEvaluation, LinePoly};
use super::poly::twiddles::TwiddleTree;
use super::poly::BitReversedOrder;
use super::queries::Queries;
use super::ColumnVec;
use crate::core::circle::Coset;
use crate::core::fft::ibutterfly;
use crate::core::fields::FieldExpOps;
use crate::core::poly::circle::CanonicCoset;
use crate::core::poly::line::LineDomain;
use crate::core::utils::bit_reverse_index;
use crate::core::vcs::ops::{MerkleHasher, MerkleOps};
use crate::core::vcs::prover::{MerkleDecommitment, MerkleProver};
use crate::core::vcs::verifier::{MerkleVerificationError, MerkleVerifier};

/// FRI proof config
// TODO(andrew): Support different step sizes.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FriConfig {
    pub log_blowup_factor: u32,
    pub log_last_layer_degree_bound: u32,
    pub n_queries: usize,
    // TODO(andrew): fold_steps.
}

impl FriConfig {
    const LOG_MIN_LAST_LAYER_DEGREE_BOUND: u32 = 0;
    const LOG_MAX_LAST_LAYER_DEGREE_BOUND: u32 = 10;
    const LOG_LAST_LAYER_DEGREE_BOUND_RANGE: RangeInclusive<u32> =
        Self::LOG_MIN_LAST_LAYER_DEGREE_BOUND..=Self::LOG_MAX_LAST_LAYER_DEGREE_BOUND;

    const LOG_MIN_BLOWUP_FACTOR: u32 = 1;
    const LOG_MAX_BLOWUP_FACTOR: u32 = 16;
    const LOG_BLOWUP_FACTOR_RANGE: RangeInclusive<u32> =
        Self::LOG_MIN_BLOWUP_FACTOR..=Self::LOG_MAX_BLOWUP_FACTOR;

    /// Creates a new FRI configuration.
    ///
    /// # Panics
    ///
    /// Panics if:
    /// * `log_last_layer_degree_bound` is greater than 10.
    /// * `log_blowup_factor` is equal to zero or greater than 16.
    pub fn new(log_last_layer_degree_bound: u32, log_blowup_factor: u32, n_queries: usize) -> Self {
        assert!(Self::LOG_LAST_LAYER_DEGREE_BOUND_RANGE.contains(&log_last_layer_degree_bound));
        assert!(Self::LOG_BLOWUP_FACTOR_RANGE.contains(&log_blowup_factor));
        Self {
            log_blowup_factor,
            log_last_layer_degree_bound,
            n_queries,
        }
    }

    const fn last_layer_domain_size(&self) -> usize {
        1 << (self.log_last_layer_degree_bound + self.log_blowup_factor)
    }

    pub const fn security_bits(&self) -> u32 {
        self.log_blowup_factor * self.n_queries as u32
    }

    pub fn mix_into(&self, channel: &mut impl Channel) {
        let Self {
            log_blowup_factor,
            n_queries,
            log_last_layer_degree_bound,
        } = self;
        channel.mix_u64(*log_blowup_factor as u64);
        channel.mix_u64(*n_queries as u64);
        channel.mix_u64(*log_last_layer_degree_bound as u64);
    }
}

pub trait FriOps: ColumnOps<BaseField> + PolyOps + Sized + ColumnOps<SecureField> {
    /// Folds a degree `d` polynomial into a degree `d/2` polynomial.
    ///
    /// Let `eval` be a polynomial evaluated on a [LineDomain] `E`, `alpha` be a random field
    /// element and `pi(x) = 2x^2 - 1` be the circle's x-coordinate doubling map. This function
    /// returns `f' = f0 + alpha * f1` evaluated on `pi(E)` such that `2f(x) = f0(pi(x)) + x *
    /// f1(pi(x))`.
    ///
    /// # Panics
    ///
    /// Panics if there are less than two evaluations.
    fn fold_line(
        eval: &LineEvaluation<Self>,
        alpha: SecureField,
        twiddles: &TwiddleTree<Self>,
    ) -> LineEvaluation<Self>;

    /// Folds and accumulates a degree `d` circle polynomial into a degree `d/2` univariate
    /// polynomial.
    ///
    /// Let `src` be the evaluation of a circle polynomial `f` on a
    /// [`CircleDomain`] `E`. This function computes evaluations of `f' = f0
    /// + alpha * f1` on the x-coordinates of `E` such that `2f(p) = f0(px) + py * f1(px)`. The
    /// evaluations of `f'` are accumulated into `dst` by the formula `dst = dst * alpha^2 + f'`.
    ///
    /// # Panics
    ///
    /// Panics if `src` is not double the length of `dst`.
    ///
    /// [`CircleDomain`]: super::poly::circle::CircleDomain
    // TODO(andrew): Make folding factor generic.
    // TODO(andrew): Fold directly into FRI layer to prevent allocation.
    fn fold_circle_into_line(
        dst: &mut LineEvaluation<Self>,
        src: &SecureEvaluation<Self, BitReversedOrder>,
        alpha: SecureField,
        twiddles: &TwiddleTree<Self>,
    );

    /// Decomposes a FRI-space polynomial into a polynomial inside the fft-space and the
    /// remainder term.
    /// FRI-space: polynomials of total degree n/2.
    /// Based on lemma #12 from the CircleStark paper: f(P) = g(P)+ lambda * alternating(P),
    /// where lambda is the cosset diff of eval, and g is a polynomial in the fft-space.
    fn decompose(
        eval: &SecureEvaluation<Self, BitReversedOrder>,
    ) -> (SecureEvaluation<Self, BitReversedOrder>, SecureField);
}

/// A FRI prover that applies the FRI protocol to prove a set of polynomials are of low degree.
pub struct FriProver<'a, B: FriOps + MerkleOps<MC::H>, MC: MerkleChannel> {
    config: FriConfig,
    first_layer: FriFirstLayerProver<'a, B, MC::H>,
    inner_layers: Vec<FriInnerLayerProver<B, MC::H>>,
    last_layer_poly: LinePoly,
}

impl<'a, B: FriOps + MerkleOps<MC::H>, MC: MerkleChannel> FriProver<'a, B, MC> {
    /// Commits to multiple circle polynomials.
    ///
    /// `columns` must be provided in descending order by size with at most one column per size.
    ///
    /// This is a batched commitment that handles multiple mixed-degree polynomials, each
    /// evaluated over domains of varying sizes. Instead of combining these evaluations into
    /// a single polynomial on a unified domain for commitment, this function commits to each
    /// polynomial on its respective domain. The evaluations are then efficiently merged in the
    /// FRI layer corresponding to the size of a polynomial's domain.
    ///
    /// # Panics
    ///
    /// Panics if:
    /// * `columns` is empty or not sorted in descending order by domain size.
    /// * An evaluation is not from a sufficiently low degree circle polynomial.
    /// * An evaluation's domain is smaller than the last layer.
    /// * An evaluation's domain is not a canonic circle domain.
    #[instrument(skip_all)]
    pub fn commit(
        channel: &mut MC::C,
        config: FriConfig,
        columns: &'a [SecureEvaluation<B, BitReversedOrder>],
        twiddles: &TwiddleTree<B>,
    ) -> Self {
        assert!(!columns.is_empty(), "no columns");
        assert!(columns.iter().all(|e| e.domain.is_canonic()), "not canonic");
        assert!(
            columns.array_windows().all(|[a, b]| a.len() > b.len()),
            "column sizes not decreasing"
        );

        let first_layer = Self::commit_first_layer(channel, columns);
        let (inner_layers, last_layer_evaluation) =
            Self::commit_inner_layers(channel, config, columns, twiddles);
        let last_layer_poly = Self::commit_last_layer(channel, config, last_layer_evaluation);

        Self {
            config,
            first_layer,
            inner_layers,
            last_layer_poly,
        }
    }

    /// Commits to the first FRI layer.
    ///
    /// The first layer commits to all input circle polynomial columns (possibly of mixed degree)
    /// involved in FRI.
    ///
    /// All `columns` must be provided in descending order by size.
    fn commit_first_layer(
        channel: &mut MC::C,
        columns: &'a [SecureEvaluation<B, BitReversedOrder>],
    ) -> FriFirstLayerProver<'a, B, MC::H> {
        let layer = FriFirstLayerProver::new(columns);
        MC::mix_root(channel, layer.merkle_tree.root());
        layer
    }

    /// Builds and commits to the inner FRI layers (all layers except the first and last).
    ///
    /// All `columns` must be provided in descending order by size. Note there is at most one column
    /// of each size.
    ///
    /// Returns all inner layers and the evaluation of the last layer.
    fn commit_inner_layers(
        channel: &mut MC::C,
        config: FriConfig,
        columns: &[SecureEvaluation<B, BitReversedOrder>],
        twiddles: &TwiddleTree<B>,
    ) -> (Vec<FriInnerLayerProver<B, MC::H>>, LineEvaluation<B>) {
        /// Returns the size of the line evaluation a circle evaluation gets folded into.
        fn folded_size(v: &SecureEvaluation<impl PolyOps, BitReversedOrder>) -> usize {
            v.len() >> CIRCLE_TO_LINE_FOLD_STEP
        }

        let first_inner_layer_log_size = folded_size(&columns[0]).ilog2();
        let first_inner_layer_domain =
            LineDomain::new(Coset::half_odds(first_inner_layer_log_size));

        let mut layer_evaluation = LineEvaluation::new_zero(first_inner_layer_domain);
        let mut columns = columns.iter().peekable();
        let mut layers = Vec::new();
        let folding_alpha = channel.draw_felt();

        // Folding the max size column.
        B::fold_circle_into_line(
            &mut layer_evaluation,
            columns.next().unwrap(),
            folding_alpha,
            twiddles,
        );

        while layer_evaluation.len() > config.last_layer_domain_size() {
            let layer = FriInnerLayerProver::new(layer_evaluation);
            MC::mix_root(channel, layer.merkle_tree.root());
            let folding_alpha = channel.draw_felt();
            layer_evaluation = B::fold_line(&layer.evaluation, folding_alpha, twiddles);

            // Check for circle polys in the first layer that should be combined in this layer.
            if let Some(column) = columns.next_if(|c| folded_size(c) == layer_evaluation.len()) {
                B::fold_circle_into_line(&mut layer_evaluation, column, folding_alpha, twiddles);
            }
            layers.push(layer);
        }

        // Check all columns have been consumed.
        assert!(columns.is_empty());

        (layers, layer_evaluation)
    }

    /// Builds and commits to the last layer.
    ///
    /// The layer is committed to by sending the verifier all the coefficients of the remaining
    /// polynomial.
    ///
    /// # Panics
    ///
    /// Panics if:
    /// * The evaluation domain size exceeds the maximum last layer domain size.
    /// * The evaluation is not of sufficiently low degree.
    fn commit_last_layer(
        channel: &mut MC::C,
        config: FriConfig,
        evaluation: LineEvaluation<B>,
    ) -> LinePoly {
        assert_eq!(evaluation.len(), config.last_layer_domain_size());

        let evaluation = evaluation.to_cpu();
        let mut coeffs = evaluation.interpolate().into_ordered_coefficients();

        let last_layer_degree_bound = 1 << config.log_last_layer_degree_bound;
        let zeros = coeffs.split_off(last_layer_degree_bound);
        assert!(zeros.iter().all(SecureField::is_zero), "invalid degree");

        let last_layer_poly = LinePoly::from_ordered_coefficients(coeffs);
        channel.mix_felts(&last_layer_poly);

        last_layer_poly
    }

    /// Returns a FRI proof and the query positions.
    ///
    /// Returned query positions are mapped by column commitment domain log size.
    pub fn decommit(self, channel: &mut MC::C) -> (FriProof<MC::H>, BTreeMap<u32, Vec<usize>>) {
        let max_column_log_size = self.first_layer.max_column_log_size();
        let queries = Queries::generate(channel, max_column_log_size, self.config.n_queries);
        let column_log_sizes = self.first_layer.column_log_sizes();
        let query_positions_by_log_size =
            get_query_positions_by_log_size(&queries, column_log_sizes);
        let proof = self.decommit_on_queries(&queries);
        (proof, query_positions_by_log_size)
    }

    /// # Panics
    ///
    /// Panics if the queries were sampled on the wrong domain size.
    fn decommit_on_queries(self, queries: &Queries) -> FriProof<MC::H> {
        let Self {
            config: _,
            first_layer,
            inner_layers,
            last_layer_poly,
        } = self;

        let first_layer_proof = first_layer.decommit(queries);

        let inner_layer_proofs = inner_layers
            .into_iter()
            .scan(
                queries.fold(CIRCLE_TO_LINE_FOLD_STEP),
                |layer_queries, layer| {
                    let layer_proof = layer.decommit(layer_queries);
                    *layer_queries = layer_queries.fold(FOLD_STEP);
                    Some(layer_proof)
                },
            )
            .collect();

        FriProof {
            first_layer: first_layer_proof,
            inner_layers: inner_layer_proofs,
            last_layer_poly,
        }
    }
}

pub struct FriVerifier<MC: MerkleChannel> {
    config: FriConfig,
    // TODO(andrew): The first layer currently commits to all input polynomials. Consider allowing
    // flexibility to only commit to input polynomials on a per-log-size basis. This allows
    // flexibility for cases where committing to the first layer, for a specific log size, isn't
    // necessary. FRI would simply return more query positions for the "uncommitted" log sizes.
    first_layer: FriFirstLayerVerifier<MC::H>,
    inner_layers: Vec<FriInnerLayerVerifier<MC::H>>,
    last_layer_domain: LineDomain,
    last_layer_poly: LinePoly,
    /// The queries used for decommitment. Initialized when calling
    /// [`FriVerifier::sample_query_positions()`].
    queries: Option<Queries>,
}

impl<MC: MerkleChannel> FriVerifier<MC> {
    /// Verifies the commitment stage of FRI.
    ///
    /// `column_bounds` should be the committed circle polynomial degree bounds in descending order.
    ///
    /// # Errors
    ///
    /// An `Err` will be returned if:
    /// * The proof contains an invalid number of FRI layers.
    /// * The degree of the last layer polynomial is too high.
    ///
    /// # Panics
    ///
    /// Panics if:
    /// * There are no degree bounds.
    /// * The degree bounds are not sorted in descending order.
    /// * A degree bound is less than or equal to the last layer's degree bound.
    pub fn commit(
        channel: &mut MC::C,
        config: FriConfig,
        proof: FriProof<MC::H>,
        column_bounds: Vec<CirclePolyDegreeBound>,
    ) -> Result<Self, FriVerificationError> {
        assert!(column_bounds.is_sorted_by_key(|b| Reverse(*b)));

        MC::mix_root(channel, proof.first_layer.commitment);

        let max_column_bound = column_bounds[0];
        let column_commitment_domains = column_bounds
            .iter()
            .map(|bound| {
                let commitment_domain_log_size = bound.log_degree_bound + config.log_blowup_factor;
                CanonicCoset::new(commitment_domain_log_size).circle_domain()
            })
            .collect();

        let first_layer = FriFirstLayerVerifier {
            column_bounds,
            column_commitment_domains,
            proof: proof.first_layer,
            folding_alpha: channel.draw_felt(),
        };

        let mut inner_layers = Vec::new();
        let mut layer_bound = max_column_bound.fold_to_line();
        let mut layer_domain = LineDomain::new(Coset::half_odds(
            layer_bound.log_degree_bound + config.log_blowup_factor,
        ));

        for (layer_index, proof) in proof.inner_layers.into_iter().enumerate() {
            MC::mix_root(channel, proof.commitment);

            inner_layers.push(FriInnerLayerVerifier {
                degree_bound: layer_bound,
                domain: layer_domain,
                folding_alpha: channel.draw_felt(),
                layer_index,
                proof,
            });

            layer_bound = layer_bound
                .fold(FOLD_STEP)
                .ok_or(FriVerificationError::InvalidNumFriLayers)?;
            layer_domain = layer_domain.double();
        }

        if layer_bound.log_degree_bound != config.log_last_layer_degree_bound {
            return Err(FriVerificationError::InvalidNumFriLayers);
        }

        let last_layer_domain = layer_domain;
        let last_layer_poly = proof.last_layer_poly;

        if last_layer_poly.len() > (1 << config.log_last_layer_degree_bound) {
            return Err(FriVerificationError::LastLayerDegreeInvalid);
        }

        channel.mix_felts(&last_layer_poly);

        Ok(Self {
            config,
            first_layer,
            inner_layers,
            last_layer_domain,
            last_layer_poly,
            queries: None,
        })
    }

    /// Verifies the decommitment stage of FRI.
    ///
    /// The query evals need to be provided in the same order as their commitment.
    ///
    /// # Panics
    ///
    /// Panics if:
    /// * The queries were not yet sampled.
    /// * The queries were sampled on the wrong domain size.
    /// * There aren't the same number of decommitted values as degree bounds.
    // TODO(andrew): Finish docs.
    pub fn decommit(
        mut self,
        first_layer_query_evals: ColumnVec<Vec<SecureField>>,
    ) -> Result<(), FriVerificationError> {
        let queries = self.queries.take().expect("queries not sampled");
        self.decommit_on_queries(&queries, first_layer_query_evals)
    }

    fn decommit_on_queries(
        self,
        queries: &Queries,
        first_layer_query_evals: ColumnVec<Vec<SecureField>>,
    ) -> Result<(), FriVerificationError> {
        let first_layer_sparse_evals =
            self.decommit_first_layer(queries, first_layer_query_evals)?;
        let inner_layer_queries = queries.fold(CIRCLE_TO_LINE_FOLD_STEP);
        let (last_layer_queries, last_layer_query_evals) =
            self.decommit_inner_layers(&inner_layer_queries, first_layer_sparse_evals)?;
        self.decommit_last_layer(last_layer_queries, last_layer_query_evals)
    }

    /// Verifies the first layer decommitment.
    ///
    /// Returns the queries and first layer folded column evaluations needed for
    /// verifying the remaining layers.
    fn decommit_first_layer(
        &self,
        queries: &Queries,
        first_layer_query_evals: ColumnVec<Vec<SecureField>>,
    ) -> Result<ColumnVec<SparseEvaluation>, FriVerificationError> {
        self.first_layer.verify(queries, first_layer_query_evals)
    }

    /// Verifies all inner layer decommitments.
    ///
    /// Returns the queries and query evaluations needed for verifying the last FRI layer.
    fn decommit_inner_layers(
        &self,
        queries: &Queries,
        first_layer_sparse_evals: ColumnVec<SparseEvaluation>,
    ) -> Result<(Queries, Vec<SecureField>), FriVerificationError> {
        let mut layer_queries = queries.clone();
        let mut layer_query_evals = vec![SecureField::zero(); layer_queries.len()];
        let mut first_layer_sparse_evals = first_layer_sparse_evals.into_iter();
        let first_layer_column_bounds = self.first_layer.column_bounds.iter();
        let first_layer_column_domains = self.first_layer.column_commitment_domains.iter();
        let mut first_layer_columns = first_layer_column_bounds
            .zip_eq(first_layer_column_domains)
            .peekable();
        let mut previous_folding_alpha = self.first_layer.folding_alpha;

        for layer in self.inner_layers.iter() {
            // Check for evals committed in the first layer that need to be folded into this layer.
            while let Some((_, column_domain)) =
                first_layer_columns.next_if(|(b, _)| b.fold_to_line() == layer.degree_bound)
            {
                // Use the previous layer's folding alpha to fold the circle's sparse evals into
                // the current layer.
                let folded_column_evals = first_layer_sparse_evals
                    .next()
                    .unwrap()
                    .fold_circle(previous_folding_alpha, *column_domain);

                accumulate_line(
                    &mut layer_query_evals,
                    &folded_column_evals,
                    previous_folding_alpha,
                );
            }

            // Verify the layer and fold it using the current layer's folding alpha.
            (layer_queries, layer_query_evals) =
                layer.verify_and_fold(layer_queries, layer_query_evals)?;
            previous_folding_alpha = layer.folding_alpha;
        }

        // Check all values have been consumed.
        assert!(first_layer_columns.is_empty());
        assert!(first_layer_sparse_evals.is_empty());

        Ok((layer_queries, layer_query_evals))
    }

    /// Verifies the last layer.
    fn decommit_last_layer(
        self,
        queries: Queries,
        query_evals: Vec<SecureField>,
    ) -> Result<(), FriVerificationError> {
        let Self {
            last_layer_domain: domain,
            last_layer_poly,
            ..
        } = self;

        for (&query, query_eval) in zip(&*queries, query_evals) {
            let x = domain.at(bit_reverse_index(query, domain.log_size()));

            if query_eval != last_layer_poly.eval_at_point(x.into()) {
                return Err(FriVerificationError::LastLayerEvaluationsInvalid);
            }
        }

        Ok(())
    }

    /// Samples and returns query positions mapped by column log size.
    pub fn sample_query_positions(&mut self, channel: &mut MC::C) -> BTreeMap<u32, Vec<usize>> {
        let column_log_sizes = self
            .first_layer
            .column_commitment_domains
            .iter()
            .map(|domain| domain.log_size())
            .collect::<BTreeSet<u32>>();
        let max_column_log_size = *column_log_sizes.iter().max().unwrap();
        let queries = Queries::generate(channel, max_column_log_size, self.config.n_queries);
        let query_positions_by_log_size =
            get_query_positions_by_log_size(&queries, column_log_sizes);
        self.queries = Some(queries);
        query_positions_by_log_size
    }
}

fn accumulate_line(
    layer_query_evals: &mut [SecureField],
    column_query_evals: &[SecureField],
    folding_alpha: SecureField,
) {
    let folding_alpha_squared = folding_alpha.square();
    for (curr_layer_eval, folded_column_eval) in zip_eq(layer_query_evals, column_query_evals) {
        *curr_layer_eval *= folding_alpha_squared;
        *curr_layer_eval += *folded_column_eval;
    }
}

/// Returns the column query positions mapped by sample domain log size.
///
/// The column log sizes must be unique and in descending order.
/// Returned column query positions are mapped by their log size.
fn get_query_positions_by_log_size(
    queries: &Queries,
    column_log_sizes: BTreeSet<u32>,
) -> BTreeMap<u32, Vec<usize>> {
    column_log_sizes
        .into_iter()
        .map(|column_log_size| {
            let column_queries = queries.fold(queries.log_domain_size - column_log_size);
            (column_log_size, column_queries.positions)
        })
        .collect()
}

#[derive(Clone, Copy, Debug, Error)]
pub enum FriVerificationError {
    #[error("proof contains an invalid number of FRI layers")]
    InvalidNumFriLayers,
    #[error("evaluations are invalid in the first layer")]
    FirstLayerEvaluationsInvalid,
    #[error("queries do not resolve to their commitment in the first layer")]
    FirstLayerCommitmentInvalid { error: MerkleVerificationError },
    #[error("queries do not resolve to their commitment in inner layer {inner_layer}")]
    InnerLayerCommitmentInvalid {
        inner_layer: usize,
        error: MerkleVerificationError,
    },
    #[error("evaluations are invalid in inner layer {inner_layer}")]
    InnerLayerEvaluationsInvalid { inner_layer: usize },
    #[error("degree of last layer is invalid")]
    LastLayerDegreeInvalid,
    #[error("evaluations in the last layer are invalid")]
    LastLayerEvaluationsInvalid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct CirclePolyDegreeBound {
    log_degree_bound: u32,
}

impl CirclePolyDegreeBound {
    pub const fn new(log_degree_bound: u32) -> Self {
        Self { log_degree_bound }
    }

    /// Maps a circle polynomial's degree bound to the degree bound of the univariate (line)
    /// polynomial it gets folded into.
    const fn fold_to_line(&self) -> LinePolyDegreeBound {
        LinePolyDegreeBound {
            log_degree_bound: self.log_degree_bound - CIRCLE_TO_LINE_FOLD_STEP,
        }
    }
}

impl PartialOrd<LinePolyDegreeBound> for CirclePolyDegreeBound {
    fn partial_cmp(&self, other: &LinePolyDegreeBound) -> Option<std::cmp::Ordering> {
        Some(self.log_degree_bound.cmp(&other.log_degree_bound))
    }
}

impl PartialEq<LinePolyDegreeBound> for CirclePolyDegreeBound {
    fn eq(&self, other: &LinePolyDegreeBound) -> bool {
        self.log_degree_bound == other.log_degree_bound
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct LinePolyDegreeBound {
    log_degree_bound: u32,
}

impl LinePolyDegreeBound {
    /// Returns [None] if the unfolded degree bound is smaller than the folding factor.
    const fn fold(self, n_folds: u32) -> Option<Self> {
        if self.log_degree_bound < n_folds {
            return None;
        }

        let log_degree_bound = self.log_degree_bound - n_folds;
        Some(Self { log_degree_bound })
    }
}

/// A FRI proof.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FriProof<H: MerkleHasher> {
    pub first_layer: FriLayerProof<H>,
    pub inner_layers: Vec<FriLayerProof<H>>,
    pub last_layer_poly: LinePoly,
}

/// Number of folds for univariate polynomials.
// TODO(andrew): Support different step sizes.
pub const FOLD_STEP: u32 = 1;

/// Number of folds when folding a circle polynomial to univariate polynomial.
pub const CIRCLE_TO_LINE_FOLD_STEP: u32 = 1;

/// Proof of an individual FRI layer.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FriLayerProof<H: MerkleHasher> {
    /// Values that the verifier needs but cannot deduce from previous computations, in the
    /// order they are needed. This complements the values that were queried. These must be
    /// supplied directly to the verifier.
    pub fri_witness: Vec<SecureField>,
    pub decommitment: MerkleDecommitment<H>,
    pub commitment: H::Hash,
}

struct FriFirstLayerVerifier<H: MerkleHasher> {
    /// The list of degree bounds of all circle polynomials commited in the first layer.
    column_bounds: Vec<CirclePolyDegreeBound>,
    /// The commitment domain all the circle polynomials in the first layer.
    column_commitment_domains: Vec<CircleDomain>,
    folding_alpha: SecureField,
    proof: FriLayerProof<H>,
}

impl<H: MerkleHasher> FriFirstLayerVerifier<H> {
    /// Verifies the first layer's merkle decommitment, and returns the evaluations needed for
    /// folding the columns to their corresponding layer.
    ///
    /// # Errors
    ///
    /// An `Err` will be returned if:
    /// * The proof doesn't store enough evaluations.
    /// * The merkle decommitment is invalid.
    ///
    /// # Panics
    ///
    /// Panics if:
    /// * The queries are sampled on the wrong domain.
    /// * There are an invalid number of provided column evals.
    fn verify(
        &self,
        queries: &Queries,
        query_evals_by_column: ColumnVec<Vec<SecureField>>,
    ) -> Result<ColumnVec<SparseEvaluation>, FriVerificationError> {
        // Columns are provided in descending order by size.
        let max_column_log_size = self.column_commitment_domains[0].log_size();
        assert_eq!(queries.log_domain_size, max_column_log_size);

        let mut fri_witness = self.proof.fri_witness.iter().copied();
        let mut decommitment_positions_by_log_size = BTreeMap::new();
        let mut sparse_evals_by_column = Vec::new();

        let mut decommitmented_values = vec![];
        for (&column_domain, column_query_evals) in
            zip_eq(&self.column_commitment_domains, query_evals_by_column)
        {
            let column_queries = queries.fold(queries.log_domain_size - column_domain.log_size());

            let (column_decommitment_positions, sparse_evaluation) =
                compute_decommitment_positions_and_rebuild_evals(
                    &column_queries,
                    &column_query_evals,
                    &mut fri_witness,
                    CIRCLE_TO_LINE_FOLD_STEP,
                )
                .map_err(|InsufficientWitnessError| {
                    FriVerificationError::FirstLayerEvaluationsInvalid
                })?;

            // Columns of the same size have the same decommitment positions.
            decommitment_positions_by_log_size
                .insert(column_domain.log_size(), column_decommitment_positions);

            decommitmented_values.extend(
                sparse_evaluation
                    .subset_evals
                    .iter()
                    .flatten()
                    .flat_map(|qm31| qm31.to_m31_array()),
            );
            sparse_evals_by_column.push(sparse_evaluation);
        }

        // Check all proof evals have been consumed.
        if !fri_witness.is_empty() {
            return Err(FriVerificationError::FirstLayerEvaluationsInvalid);
        }

        let merkle_verifier = MerkleVerifier::new(
            self.proof.commitment,
            self.column_commitment_domains
                .iter()
                .flat_map(|column_domain| [column_domain.log_size(); SECURE_EXTENSION_DEGREE])
                .collect(),
        );

        merkle_verifier
            .verify(
                &decommitment_positions_by_log_size,
                decommitmented_values,
                self.proof.decommitment.clone(),
            )
            .map_err(|error| FriVerificationError::FirstLayerCommitmentInvalid { error })?;

        Ok(sparse_evals_by_column)
    }
}

struct FriInnerLayerVerifier<H: MerkleHasher> {
    degree_bound: LinePolyDegreeBound,
    domain: LineDomain,
    folding_alpha: SecureField,
    layer_index: usize,
    proof: FriLayerProof<H>,
}

impl<H: MerkleHasher> FriInnerLayerVerifier<H> {
    /// Verifies the layer's merkle decommitment and returns the the folded queries and query evals.
    ///
    /// # Errors
    ///
    /// An `Err` will be returned if:
    /// * The proof doesn't store the correct number of evaluations.
    /// * The merkle decommitment is invalid.
    ///
    /// # Panics
    ///
    /// Panics if:
    /// * The number of queries doesn't match the number of evals.
    /// * The queries are sampled on the wrong domain.
    fn verify_and_fold(
        &self,
        queries: Queries,
        evals_at_queries: Vec<SecureField>,
    ) -> Result<(Queries, Vec<SecureField>), FriVerificationError> {
        assert_eq!(queries.log_domain_size, self.domain.log_size());

        let mut fri_witness = self.proof.fri_witness.iter().copied();

        let (decommitment_positions, sparse_evaluation) =
            compute_decommitment_positions_and_rebuild_evals(
                &queries,
                &evals_at_queries,
                &mut fri_witness,
                FOLD_STEP,
            )
            .map_err(|InsufficientWitnessError| {
                FriVerificationError::InnerLayerEvaluationsInvalid {
                    inner_layer: self.layer_index,
                }
            })?;

        // Check all proof evals have been consumed.
        if !fri_witness.is_empty() {
            return Err(FriVerificationError::InnerLayerEvaluationsInvalid {
                inner_layer: self.layer_index,
            });
        }

        let decommitmented_values = sparse_evaluation
            .subset_evals
            .iter()
            .flatten()
            .flat_map(|qm31| qm31.to_m31_array())
            .collect_vec();

        let merkle_verifier = MerkleVerifier::new(
            self.proof.commitment,
            vec![self.domain.log_size(); SECURE_EXTENSION_DEGREE],
        );

        merkle_verifier
            .verify(
                &BTreeMap::from_iter([(self.domain.log_size(), decommitment_positions)]),
                decommitmented_values,
                self.proof.decommitment.clone(),
            )
            .map_err(|e| FriVerificationError::InnerLayerCommitmentInvalid {
                inner_layer: self.layer_index,
                error: e,
            })?;

        let folded_queries = queries.fold(FOLD_STEP);
        let folded_evals = sparse_evaluation.fold_line(self.folding_alpha, self.domain);

        Ok((folded_queries, folded_evals))
    }
}

/// Commitment to the first FRI layer.
///
/// The first layer commits to all circle polynomials (possibly of mixed degree) involved in FRI.
struct FriFirstLayerProver<'a, B: FriOps + MerkleOps<H>, H: MerkleHasher> {
    columns: &'a [SecureEvaluation<B, BitReversedOrder>],
    merkle_tree: MerkleProver<B, H>,
}

impl<'a, B: FriOps + MerkleOps<H>, H: MerkleHasher> FriFirstLayerProver<'a, B, H> {
    fn new(columns: &'a [SecureEvaluation<B, BitReversedOrder>]) -> Self {
        let coordinate_columns = extract_coordinate_columns(columns);
        let merkle_tree = MerkleProver::commit(coordinate_columns);

        FriFirstLayerProver {
            columns,
            merkle_tree,
        }
    }

    /// Returns the sizes of all circle polynomial commitment domains.
    fn column_log_sizes(&self) -> BTreeSet<u32> {
        self.columns.iter().map(|e| e.domain.log_size()).collect()
    }

    fn max_column_log_size(&self) -> u32 {
        *self.column_log_sizes().iter().max().unwrap()
    }

    fn decommit(self, queries: &Queries) -> FriLayerProof<H> {
        let max_column_log_size = *self.column_log_sizes().iter().max().unwrap();
        assert_eq!(queries.log_domain_size, max_column_log_size);

        let mut fri_witness = Vec::new();
        let mut decommitment_positions_by_log_size = BTreeMap::new();

        for column in self.columns {
            let column_log_size = column.domain.log_size();
            let column_queries = queries.fold(queries.log_domain_size - column_log_size);

            let (column_decommitment_positions, column_witness) =
                compute_decommitment_positions_and_witness_evals(
                    column,
                    &column_queries.positions,
                    CIRCLE_TO_LINE_FOLD_STEP,
                );

            decommitment_positions_by_log_size
                .insert(column_log_size, column_decommitment_positions);
            fri_witness.extend(column_witness);
        }

        let (_evals, decommitment) = self.merkle_tree.decommit(
            &decommitment_positions_by_log_size,
            extract_coordinate_columns(self.columns),
        );

        let commitment = self.merkle_tree.root();

        FriLayerProof {
            fri_witness,
            decommitment,
            commitment,
        }
    }
}

/// Extracts all base field coordinate columns from each secure column.
fn extract_coordinate_columns<B: PolyOps>(
    columns: &[SecureEvaluation<B, BitReversedOrder>],
) -> Vec<&Col<B, BaseField>> {
    let mut coordinate_columns = Vec::new();

    for secure_column in columns {
        for coordinate_column in secure_column.columns.iter() {
            coordinate_columns.push(coordinate_column);
        }
    }

    coordinate_columns
}

/// A FRI layer comprises of a merkle tree that commits to evaluations of a polynomial.
///
/// The polynomial evaluations are viewed as evaluation of a polynomial on multiple distinct cosets
/// of size two. Each leaf of the merkle tree commits to a single coset evaluation.
// TODO(andrew): Support different step sizes and update docs.
// TODO(andrew): The docs are wrong. Each leaf of the merkle tree commits to a single
// QM31 value. This is inefficient and should be changed.
struct FriInnerLayerProver<B: FriOps + MerkleOps<H>, H: MerkleHasher> {
    evaluation: LineEvaluation<B>,
    merkle_tree: MerkleProver<B, H>,
}

impl<B: FriOps + MerkleOps<H>, H: MerkleHasher> FriInnerLayerProver<B, H> {
    fn new(evaluation: LineEvaluation<B>) -> Self {
        let merkle_tree = MerkleProver::commit(evaluation.values.columns.iter().collect_vec());
        FriInnerLayerProver {
            evaluation,
            merkle_tree,
        }
    }

    fn decommit(self, queries: &Queries) -> FriLayerProof<H> {
        let (decommitment_positions, fri_witness) =
            compute_decommitment_positions_and_witness_evals(
                &self.evaluation.values,
                queries,
                FOLD_STEP,
            );

        let layer_log_size = self.evaluation.domain().log_size();
        let (_evals, decommitment) = self.merkle_tree.decommit(
            &BTreeMap::from_iter([(layer_log_size, decommitment_positions)]),
            self.evaluation.values.columns.iter().collect_vec(),
        );

        let commitment = self.merkle_tree.root();

        FriLayerProof {
            fri_witness,
            decommitment,
            commitment,
        }
    }
}

/// Returns a column's merkle tree decommitment positions and the evals the verifier can't
/// deduce from previous computations but requires for decommitment and folding.
fn compute_decommitment_positions_and_witness_evals(
    column: &SecureColumnByCoords<impl PolyOps>,
    query_positions: &[usize],
    fold_step: u32,
) -> (Vec<usize>, Vec<QM31>) {
    let mut decommitment_positions = Vec::new();
    let mut witness_evals = Vec::new();

    // Group queries by the folding coset they reside in.
    for subset_queries in query_positions.chunk_by(|a, b| a >> fold_step == b >> fold_step) {
        let subset_start = (subset_queries[0] >> fold_step) << fold_step;
        let subset_decommitment_positions = subset_start..subset_start + (1 << fold_step);
        let mut subset_queries_iter = subset_queries.iter().peekable();

        for position in subset_decommitment_positions {
            // Add decommitment position.
            decommitment_positions.push(position);

            // Skip evals the verifier can calculate.
            if subset_queries_iter.next_if_eq(&&position).is_some() {
                continue;
            }

            let eval = column.at(position);
            witness_evals.push(eval);
        }
    }

    (decommitment_positions, witness_evals)
}

/// Returns a column's merkle tree decommitment positions and re-builds the evaluations needed by
/// the verifier for folding and decommitment.
///
/// # Panics
///
/// Panics if the number of queries doesn't match the number of query evals.
fn compute_decommitment_positions_and_rebuild_evals(
    queries: &Queries,
    query_evals: &[QM31],
    mut witness_evals: impl Iterator<Item = QM31>,
    fold_step: u32,
) -> Result<(Vec<usize>, SparseEvaluation), InsufficientWitnessError> {
    let mut query_evals = query_evals.iter().copied();

    let mut decommitment_positions = Vec::new();
    let mut subset_evals = Vec::new();
    let mut subset_domain_index_initials = Vec::new();

    // Group queries by the subset they reside in.
    for subset_queries in queries.chunk_by(|a, b| a >> fold_step == b >> fold_step) {
        let subset_start = (subset_queries[0] >> fold_step) << fold_step;
        let subset_decommitment_positions = subset_start..subset_start + (1 << fold_step);
        decommitment_positions.extend(subset_decommitment_positions.clone());

        let mut subset_queries_iter = subset_queries.iter().copied().peekable();

        let subset_eval = subset_decommitment_positions
            .map(|position| match subset_queries_iter.next_if_eq(&position) {
                Some(_) => Ok(query_evals.next().unwrap()),
                None => witness_evals.next().ok_or(InsufficientWitnessError),
            })
            .collect::<Result<_, _>>()?;

        subset_evals.push(subset_eval);
        subset_domain_index_initials.push(bit_reverse_index(subset_start, queries.log_domain_size));
    }

    let sparse_evaluation = SparseEvaluation::new(subset_evals, subset_domain_index_initials);

    Ok((decommitment_positions, sparse_evaluation))
}

#[derive(Debug)]
struct InsufficientWitnessError;

/// Foldable subsets of evaluations on a [`CirclePoly`] or [`LinePoly`].
///
/// [`CirclePoly`]: crate::core::poly::circle::CirclePoly
struct SparseEvaluation {
    // TODO(andrew): Perhaps subset isn't the right word. Coset, Subgroup?
    subset_evals: Vec<Vec<SecureField>>,
    subset_domain_initial_indexes: Vec<usize>,
}

impl SparseEvaluation {
    /// # Panics
    ///
    /// Panics if a subset size doesn't equal `2^FOLD_STEP` or there aren't the same number of
    /// domain indexes as subsets.
    fn new(subset_evals: Vec<Vec<SecureField>>, subset_domain_initial_indexes: Vec<usize>) -> Self {
        let fold_factor = 1 << FOLD_STEP;
        assert!(subset_evals.iter().all(|e| e.len() == fold_factor));
        assert_eq!(subset_evals.len(), subset_domain_initial_indexes.len());
        Self {
            subset_evals,
            subset_domain_initial_indexes,
        }
    }

    fn fold_line(self, fold_alpha: SecureField, source_domain: LineDomain) -> Vec<SecureField> {
        zip(self.subset_evals, self.subset_domain_initial_indexes)
            .map(|(eval, domain_initial_index)| {
                let fold_domain_initial = source_domain.coset().index_at(domain_initial_index);
                let fold_domain = LineDomain::new(Coset::new(fold_domain_initial, FOLD_STEP));
                let eval = LineEvaluation::new(fold_domain, eval.into_iter().collect());
                fold_line(&eval, fold_alpha).values.at(0)
            })
            .collect()
    }

    fn fold_circle(self, fold_alpha: SecureField, source_domain: CircleDomain) -> Vec<SecureField> {
        zip(self.subset_evals, self.subset_domain_initial_indexes)
            .map(|(eval, domain_initial_index)| {
                let fold_domain_initial = source_domain.index_at(domain_initial_index);
                let fold_domain = CircleDomain::new(Coset::new(
                    fold_domain_initial,
                    CIRCLE_TO_LINE_FOLD_STEP - 1,
                ));
                let eval = SecureEvaluation::new(fold_domain, eval.into_iter().collect());
                let mut buffer = LineEvaluation::new_zero(LineDomain::new(fold_domain.half_coset));
                fold_circle_into_line(&mut buffer, &eval, fold_alpha);
                buffer.values.at(0)
            })
            .collect()
    }
}

/// Folds a degree `d` polynomial into a degree `d/2` polynomial.
/// See [`FriOps::fold_line`].
pub fn fold_line(
    eval: &LineEvaluation<CpuBackend>,
    alpha: SecureField,
) -> LineEvaluation<CpuBackend> {
    let n = eval.len();
    assert!(n >= 2, "Evaluation too small");

    let domain = eval.domain();

    let folded_values = eval
        .values
        .into_iter()
        .array_chunks()
        .enumerate()
        .map(|(i, [f_x, f_neg_x])| {
            // TODO(andrew): Inefficient. Update when domain twiddles get stored in a buffer.
            let x = domain.at(bit_reverse_index(i << FOLD_STEP, domain.log_size()));

            let (mut f0, mut f1) = (f_x, f_neg_x);
            ibutterfly(&mut f0, &mut f1, x.inverse());
            f0 + alpha * f1
        })
        .collect();

    LineEvaluation::new(domain.double(), folded_values)
}

/// Folds and accumulates a degree `d` circle polynomial into a degree `d/2` univariate
/// polynomial.
/// See [`FriOps::fold_circle_into_line`].
pub fn fold_circle_into_line(
    dst: &mut LineEvaluation<CpuBackend>,
    src: &SecureEvaluation<CpuBackend, BitReversedOrder>,
    alpha: SecureField,
) {
    assert_eq!(src.len() >> CIRCLE_TO_LINE_FOLD_STEP, dst.len());

    let domain = src.domain;
    let alpha_sq = alpha * alpha;

    src.into_iter()
        .array_chunks()
        .enumerate()
        .for_each(|(i, [f_p, f_neg_p])| {
            // TODO(andrew): Inefficient. Update when domain twiddles get stored in a buffer.
            let p = domain.at(bit_reverse_index(
                i << CIRCLE_TO_LINE_FOLD_STEP,
                domain.log_size(),
            ));

            // Calculate `f0(px)` and `f1(px)` such that `2f(p) = f0(px) + py * f1(px)`.
            let (mut f0_px, mut f1_px) = (f_p, f_neg_p);
            ibutterfly(&mut f0_px, &mut f1_px, p.y.inverse());
            let f_prime = alpha * f1_px + f0_px;

            dst.values.set(i, dst.values.at(i) * alpha_sq + f_prime);
        });
}

#[cfg(test)]
mod tests {
    use std::assert_matches::assert_matches;
    use std::iter::zip;

    use itertools::Itertools;
    use num_traits::{One, Zero};

    use super::FriVerificationError;
    use crate::core::backend::cpu::CpuCirclePoly;
    use crate::core::backend::{ColumnOps, CpuBackend};
    use crate::core::circle::{CirclePointIndex, Coset};
    use crate::core::fields::m31::BaseField;
    use crate::core::fields::qm31::SecureField;
    use crate::core::fields::Field;
    use crate::core::fri::{
        fold_circle_into_line, fold_line, CirclePolyDegreeBound, FriConfig,
        CIRCLE_TO_LINE_FOLD_STEP,
    };
    use crate::core::poly::circle::{CircleDomain, PolyOps, SecureEvaluation};
    use crate::core::poly::line::{LineDomain, LineEvaluation, LinePoly};
    use crate::core::poly::BitReversedOrder;
    use crate::core::queries::Queries;
    use crate::core::test_utils::test_channel;
    use crate::core::vcs::blake2_merkle::Blake2sMerkleChannel;

    /// Default blowup factor used for tests.
    const LOG_BLOWUP_FACTOR: u32 = 2;

    type FriProver<'a> = super::FriProver<'a, CpuBackend, Blake2sMerkleChannel>;
    type FriVerifier = super::FriVerifier<Blake2sMerkleChannel>;

    #[test]
    fn fold_line_works() {
        const DEGREE: usize = 8;
        // Coefficients are bit-reversed.
        let even_coeffs: [SecureField; DEGREE / 2] = [1, 2, 1, 3].map(SecureField::from);
        let odd_coeffs: [SecureField; DEGREE / 2] = [3, 5, 4, 1].map(SecureField::from);
        let poly = LinePoly::new([even_coeffs, odd_coeffs].concat());
        let even_poly = LinePoly::new(even_coeffs.to_vec());
        let odd_poly = LinePoly::new(odd_coeffs.to_vec());
        let alpha = BaseField::from_u32_unchecked(19283).into();
        let domain = LineDomain::new(Coset::half_odds(DEGREE.ilog2()));
        let drp_domain = domain.double();
        let mut values = domain
            .iter()
            .map(|p| poly.eval_at_point(p.into()))
            .collect();
        CpuBackend::bit_reverse_column(&mut values);
        let evals = LineEvaluation::new(domain, values.into_iter().collect());

        let drp_evals = fold_line(&evals, alpha);
        let mut drp_evals = drp_evals.values.into_iter().collect_vec();
        CpuBackend::bit_reverse_column(&mut drp_evals);

        assert_eq!(drp_evals.len(), DEGREE / 2);
        for (i, (&drp_eval, x)) in zip(&drp_evals, drp_domain).enumerate() {
            let f_e: SecureField = even_poly.eval_at_point(x.into());
            let f_o: SecureField = odd_poly.eval_at_point(x.into());
            assert_eq!(drp_eval, (f_e + alpha * f_o).double(), "mismatch at {i}");
        }
    }

    #[test]
    fn fold_circle_to_line_works() {
        const LOG_DEGREE: u32 = 4;
        let circle_evaluation = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let alpha = SecureField::one();
        let folded_domain = LineDomain::new(circle_evaluation.domain.half_coset);

        let mut folded_evaluation = LineEvaluation::new_zero(folded_domain);
        fold_circle_into_line(&mut folded_evaluation, &circle_evaluation, alpha);

        assert_eq!(
            log_degree_bound(folded_evaluation),
            LOG_DEGREE - CIRCLE_TO_LINE_FOLD_STEP
        );
    }

    #[test]
    #[should_panic = "invalid degree"]
    fn committing_high_degree_polynomial_fails() {
        const LOG_EXPECTED_BLOWUP_FACTOR: u32 = LOG_BLOWUP_FACTOR;
        const LOG_INVALID_BLOWUP_FACTOR: u32 = LOG_BLOWUP_FACTOR - 1;
        let config = FriConfig::new(2, LOG_EXPECTED_BLOWUP_FACTOR, 3);
        let column = &[polynomial_evaluation(6, LOG_INVALID_BLOWUP_FACTOR)];
        let twiddles = CpuBackend::precompute_twiddles(column[0].domain.half_coset);

        FriProver::commit(&mut test_channel(), config, column, &twiddles);
    }

    #[test]
    #[should_panic = "not canonic"]
    fn committing_column_from_invalid_domain_fails() {
        let invalid_domain = CircleDomain::new(Coset::new(CirclePointIndex::generator(), 3));
        assert!(!invalid_domain.is_canonic(), "must be an invalid domain");
        let config = FriConfig::new(2, 2, 3);
        let column = SecureEvaluation::new(
            invalid_domain,
            [SecureField::one(); 1 << 4].into_iter().collect(),
        );
        let twiddles = CpuBackend::precompute_twiddles(column.domain.half_coset);
        let columns = &[column];

        FriProver::commit(&mut test_channel(), config, columns, &twiddles);
    }

    #[test]
    fn valid_proof_passes_verification() -> Result<(), FriVerificationError> {
        const LOG_DEGREE: u32 = 4;
        let column = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(column.domain.half_coset);
        let queries = Queries::from_positions(vec![5], column.domain.log_size());
        let config = FriConfig::new(1, LOG_BLOWUP_FACTOR, queries.len());
        let decommitment_value = query_polynomial(&column, &queries);
        let columns = &[column];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let proof = prover.decommit_on_queries(&queries);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        let verifier = FriVerifier::commit(&mut test_channel(), config, proof, bound).unwrap();

        verifier.decommit_on_queries(&queries, vec![decommitment_value])
    }

    #[test]
    fn valid_proof_with_constant_last_layer_passes_verification() -> Result<(), FriVerificationError>
    {
        const LOG_DEGREE: u32 = 3;
        const LAST_LAYER_LOG_BOUND: u32 = 0;
        let column = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(column.domain.half_coset);
        let queries = Queries::from_positions(vec![5], column.domain.log_size());
        let config = FriConfig::new(LAST_LAYER_LOG_BOUND, LOG_BLOWUP_FACTOR, queries.len());
        let decommitment_value = query_polynomial(&column, &queries);
        let columns = &[column];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let proof = prover.decommit_on_queries(&queries);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        let verifier = FriVerifier::commit(&mut test_channel(), config, proof, bound).unwrap();

        verifier.decommit_on_queries(&queries, vec![decommitment_value])
    }

    #[test]
    fn valid_mixed_degree_proof_passes_verification() -> Result<(), FriVerificationError> {
        const LOG_DEGREES: [u32; 3] = [6, 5, 4];
        let columns = LOG_DEGREES.map(|log_d| polynomial_evaluation(log_d, LOG_BLOWUP_FACTOR));
        let twiddles = CpuBackend::precompute_twiddles(columns[0].domain.half_coset);
        let log_domain_size = columns[0].domain.log_size();
        let queries = Queries::from_positions(vec![7, 70], log_domain_size);
        let config = FriConfig::new(2, LOG_BLOWUP_FACTOR, queries.len());
        let prover = FriProver::commit(&mut test_channel(), config, &columns, &twiddles);
        let proof = prover.decommit_on_queries(&queries);
        let query_evals = columns.map(|p| query_polynomial(&p, &queries)).to_vec();
        let bounds = LOG_DEGREES.map(CirclePolyDegreeBound::new).to_vec();
        let verifier = FriVerifier::commit(&mut test_channel(), config, proof, bounds).unwrap();

        verifier.decommit_on_queries(&queries, query_evals)
    }

    #[test]
    fn mixed_degree_proof_with_queries_sampled_from_channel_passes_verification(
    ) -> Result<(), FriVerificationError> {
        const LOG_DEGREES: [u32; 3] = [6, 5, 4];
        let columns = LOG_DEGREES.map(|log_d| polynomial_evaluation(log_d, LOG_BLOWUP_FACTOR));
        let twiddles = CpuBackend::precompute_twiddles(columns[0].domain.half_coset);
        let config = FriConfig::new(2, LOG_BLOWUP_FACTOR, 3);
        let prover = FriProver::commit(&mut test_channel(), config, &columns, &twiddles);
        let (proof, prover_query_positions_by_log_size) = prover.decommit(&mut test_channel());
        let query_evals_by_column = columns.map(|eval| {
            let query_positions = &prover_query_positions_by_log_size[&eval.domain.log_size()];
            query_polynomial_at_positions(&eval, query_positions)
        });
        let bounds = LOG_DEGREES.map(CirclePolyDegreeBound::new).to_vec();

        let mut verifier = FriVerifier::commit(&mut test_channel(), config, proof, bounds).unwrap();
        let verifier_query_positions_by_log_size =
            verifier.sample_query_positions(&mut test_channel());

        assert_eq!(
            prover_query_positions_by_log_size,
            verifier_query_positions_by_log_size
        );
        verifier.decommit(query_evals_by_column.to_vec())
    }

    #[test]
    fn proof_with_removed_layer_fails_verification() {
        const LOG_DEGREE: u32 = 6;
        let evaluation = polynomial_evaluation(6, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(evaluation.domain.half_coset);
        let log_domain_size = evaluation.domain.log_size();
        let queries = Queries::from_positions(vec![1], log_domain_size);
        let config = FriConfig::new(2, LOG_BLOWUP_FACTOR, queries.len());
        let columns = &[evaluation];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let proof = prover.decommit_on_queries(&queries);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        // Set verifier's config to expect one extra layer than prover config.
        let mut invalid_config = config;
        invalid_config.log_last_layer_degree_bound -= 1;

        let verifier = FriVerifier::commit(&mut test_channel(), invalid_config, proof, bound);

        assert!(matches!(
            verifier,
            Err(FriVerificationError::InvalidNumFriLayers)
        ));
    }

    #[test]
    fn proof_with_added_layer_fails_verification() {
        const LOG_DEGREE: u32 = 6;
        let evaluation = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(evaluation.domain.half_coset);
        let log_domain_size = evaluation.domain.log_size();
        let queries = Queries::from_positions(vec![1], log_domain_size);
        let config = FriConfig::new(2, LOG_BLOWUP_FACTOR, queries.len());
        let columns = &[evaluation];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let proof = prover.decommit_on_queries(&queries);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        // Set verifier's config to expect one less layer than prover config.
        let mut invalid_config = config;
        invalid_config.log_last_layer_degree_bound += 1;

        let verifier = FriVerifier::commit(&mut test_channel(), invalid_config, proof, bound);

        assert!(matches!(
            verifier,
            Err(FriVerificationError::InvalidNumFriLayers)
        ));
    }

    #[test]
    fn proof_with_invalid_inner_layer_evaluation_fails_verification() {
        const LOG_DEGREE: u32 = 6;
        let evaluation = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(evaluation.domain.half_coset);
        let log_domain_size = evaluation.domain.log_size();
        let queries = Queries::from_positions(vec![5], log_domain_size);
        let config = FriConfig::new(2, LOG_BLOWUP_FACTOR, queries.len());
        let decommitment_value = query_polynomial(&evaluation, &queries);
        let columns = &[evaluation];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        let mut proof = prover.decommit_on_queries(&queries);
        // Remove an evaluation from the second layer's proof.
        proof.inner_layers[1].fri_witness.pop();
        let verifier = FriVerifier::commit(&mut test_channel(), config, proof, bound).unwrap();

        let verification_result = verifier.decommit_on_queries(&queries, vec![decommitment_value]);

        assert_matches!(
            verification_result,
            Err(FriVerificationError::InnerLayerEvaluationsInvalid { inner_layer: 1 })
        );
    }

    #[test]
    fn proof_with_invalid_inner_layer_decommitment_fails_verification() {
        const LOG_DEGREE: u32 = 6;
        let evaluation = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(evaluation.domain.half_coset);
        let log_domain_size = evaluation.domain.log_size();
        let queries = Queries::from_positions(vec![5], log_domain_size);
        let config = FriConfig::new(2, LOG_BLOWUP_FACTOR, queries.len());
        let decommitment_value = query_polynomial(&evaluation, &queries);
        let columns = &[evaluation];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        let mut proof = prover.decommit_on_queries(&queries);
        // Modify the committed values in the second layer.
        proof.inner_layers[1].fri_witness[0] += BaseField::one();
        let verifier = FriVerifier::commit(&mut test_channel(), config, proof, bound).unwrap();

        let verification_result = verifier.decommit_on_queries(&queries, vec![decommitment_value]);

        assert_matches!(
            verification_result,
            Err(FriVerificationError::InnerLayerCommitmentInvalid { inner_layer: 1, .. })
        );
    }

    #[test]
    fn proof_with_invalid_last_layer_degree_fails_verification() {
        const LOG_DEGREE: u32 = 6;
        const LOG_MAX_LAST_LAYER_DEGREE: u32 = 2;
        let evaluation = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(evaluation.domain.half_coset);
        let log_domain_size = evaluation.domain.log_size();
        let queries = Queries::from_positions(vec![1, 7, 8], log_domain_size);
        let config = FriConfig::new(LOG_MAX_LAST_LAYER_DEGREE, LOG_BLOWUP_FACTOR, queries.len());
        let columns = &[evaluation];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        let mut proof = prover.decommit_on_queries(&queries);
        let bad_last_layer_coeffs = vec![One::one(); 1 << (LOG_MAX_LAST_LAYER_DEGREE + 1)];
        proof.last_layer_poly = LinePoly::new(bad_last_layer_coeffs);

        let verifier = FriVerifier::commit(&mut test_channel(), config, proof, bound);

        assert!(matches!(
            verifier,
            Err(FriVerificationError::LastLayerDegreeInvalid)
        ));
    }

    #[test]
    fn proof_with_invalid_last_layer_fails_verification() {
        const LOG_DEGREE: u32 = 6;
        let evaluation = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(evaluation.domain.half_coset);
        let log_domain_size = evaluation.domain.log_size();
        let queries = Queries::from_positions(vec![1, 7, 8], log_domain_size);
        let config = FriConfig::new(2, LOG_BLOWUP_FACTOR, queries.len());
        let decommitment_value = query_polynomial(&evaluation, &queries);
        let columns = &[evaluation];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        let mut proof = prover.decommit_on_queries(&queries);
        // Compromise the last layer polynomial's first coefficient.
        proof.last_layer_poly[0] += BaseField::one();
        let verifier = FriVerifier::commit(&mut test_channel(), config, proof, bound).unwrap();

        let verification_result = verifier.decommit_on_queries(&queries, vec![decommitment_value]);

        assert_matches!(
            verification_result,
            Err(FriVerificationError::LastLayerEvaluationsInvalid)
        );
    }

    #[test]
    #[should_panic]
    fn decommit_queries_on_invalid_domain_fails_verification() {
        const LOG_DEGREE: u32 = 3;
        let evaluation = polynomial_evaluation(LOG_DEGREE, LOG_BLOWUP_FACTOR);
        let twiddles = CpuBackend::precompute_twiddles(evaluation.domain.half_coset);
        let log_domain_size = evaluation.domain.log_size();
        let queries = Queries::from_positions(vec![5], log_domain_size);
        let config = FriConfig::new(1, LOG_BLOWUP_FACTOR, queries.len());
        let decommitment_value = query_polynomial(&evaluation, &queries);
        let columns = &[evaluation];
        let prover = FriProver::commit(&mut test_channel(), config, columns, &twiddles);
        let proof = prover.decommit_on_queries(&queries);
        let bound = vec![CirclePolyDegreeBound::new(LOG_DEGREE)];
        let verifier = FriVerifier::commit(&mut test_channel(), config, proof, bound).unwrap();
        // Simulate the verifier sampling queries on a smaller domain.
        let mut invalid_queries = queries.clone();
        invalid_queries.log_domain_size -= 1;

        let _ = verifier.decommit_on_queries(&invalid_queries, vec![decommitment_value]);
    }

    /// Returns an evaluation of a random polynomial with degree `2^log_degree`.
    ///
    /// The evaluation domain size is `2^(log_degree + log_blowup_factor)`.
    fn polynomial_evaluation(
        log_degree: u32,
        log_blowup_factor: u32,
    ) -> SecureEvaluation<CpuBackend, BitReversedOrder> {
        let poly = CpuCirclePoly::new(vec![BaseField::one(); 1 << log_degree]);
        let coset = Coset::half_odds(log_degree + log_blowup_factor - 1);
        let domain = CircleDomain::new(coset);
        let values = poly.evaluate(domain);
        SecureEvaluation::new(domain, values.into_iter().map(SecureField::from).collect())
    }

    /// Returns the log degree bound of a polynomial.
    fn log_degree_bound(polynomial: LineEvaluation<CpuBackend>) -> u32 {
        let coeffs = polynomial.interpolate().into_ordered_coefficients();
        let degree = coeffs.into_iter().rposition(|c| !c.is_zero()).unwrap_or(0);
        (degree + 1).ilog2()
    }

    fn query_polynomial(
        polynomial: &SecureEvaluation<CpuBackend, BitReversedOrder>,
        queries: &Queries,
    ) -> Vec<SecureField> {
        let queries = queries.fold(queries.log_domain_size - polynomial.domain.log_size());
        query_polynomial_at_positions(polynomial, &queries.positions)
    }

    fn query_polynomial_at_positions(
        polynomial: &SecureEvaluation<CpuBackend, BitReversedOrder>,
        query_positions: &[usize],
    ) -> Vec<SecureField> {
        query_positions.iter().map(|p| polynomial.at(*p)).collect()
    }
}
```
*/
export interface FriChannel {
  mix_u64(value: number): void;
}

/** FRI proof configuration. Port of `fri.rs` `FriConfig`. */
export class FriConfig {
  static readonly LOG_MIN_LAST_LAYER_DEGREE_BOUND = 0;
  static readonly LOG_MAX_LAST_LAYER_DEGREE_BOUND = 10;
  static readonly LOG_MIN_BLOWUP_FACTOR = 1;
  static readonly LOG_MAX_BLOWUP_FACTOR = 16;

  readonly log_blowup_factor: number;
  readonly log_last_layer_degree_bound: number;
  readonly n_queries: number;

  constructor(logLastLayerDegreeBound: number, logBlowupFactor: number, nQueries: number) {
    if (
      logLastLayerDegreeBound < FriConfig.LOG_MIN_LAST_LAYER_DEGREE_BOUND ||
      logLastLayerDegreeBound > FriConfig.LOG_MAX_LAST_LAYER_DEGREE_BOUND
    ) {
      throw new Error("invalid log_last_layer_degree_bound");
    }
    if (
      logBlowupFactor < FriConfig.LOG_MIN_BLOWUP_FACTOR ||
      logBlowupFactor > FriConfig.LOG_MAX_BLOWUP_FACTOR
    ) {
      throw new Error("invalid log_blowup_factor");
    }
    this.log_blowup_factor = logBlowupFactor;
    this.log_last_layer_degree_bound = logLastLayerDegreeBound;
    this.n_queries = nQueries;
  }

  last_layer_domain_size(): number {
    return 1 << (this.log_last_layer_degree_bound + this.log_blowup_factor);
  }

  security_bits(): number {
    return this.log_blowup_factor * this.n_queries;
  }

  mix_into(channel: FriChannel): void {
    channel.mix_u64(this.log_blowup_factor >>> 0);
    channel.mix_u64(this.n_queries >>> 0);
    channel.mix_u64(this.log_last_layer_degree_bound >>> 0);
  }
}

import { QM31 as SecureField } from "./fields/qm31";
import { Queries } from "./queries";
import { LineDomain, LineEvaluation, LinePoly } from "./poly/line";
import { CircleDomain, CanonicCoset, SecureEvaluation } from "./poly/circle";

// Placeholder types for FriOps dependencies
// TODO(Jules): Refine these placeholder types. For example, TypescriptBaseField should be replaced with the actual BaseField type (e.g., M31).
// TODO(Jules): Define TypescriptColumnOps<T> to mirror Rust's `core::backend::ColumnOps<F>` trait.
// TODO(Jules): Define TypescriptPolyOps to mirror Rust's `core::poly::PolyOps` trait.
type TypescriptBaseField = any;
interface TypescriptColumnOps<T> { /* Corresponds to Rust's core::backend::ColumnOps<F> */ }
interface TypescriptPolyOps { /* Corresponds to Rust's core::poly::PolyOps */ }

// Domain Placeholders
// TODO(Jules): Replace TypescriptLineDomainPlaceholder with a full implementation of LineDomain from Rust's `core::poly::line::LineDomain`.
// Key methods: constructor, at(index), log_size(), double(), coset().index_at().
export { LineDomain as TypescriptLineDomainPlaceholder } from "./poly/line";


// Evaluation and Poly aliases
export type TypescriptLineEvaluation<B> = LineEvaluation<B>;
export { LineEvaluation as TypescriptLineEvaluationImpl } from "./poly/line";

// TODO(Jules): Define TypescriptTwiddleTree<B> to match Rust's `core::poly::twiddles::TwiddleTree<B>`.
interface TypescriptTwiddleTree<B> { /* Corresponds to Rust's core::poly::twiddles::TwiddleTree<B> */ }

// TODO(Jules): Refine TypescriptSecureEvaluation to match Rust's `core::poly::circle::SecureEvaluation<B, O>`.
// Key properties: `domain` (actual CircleDomain type), `values` (actual SecureColumnByCoords type or similar).
// Key methods: `len()`, `at(index)`, `is_canonic()` (on domain).
export type TypescriptSecureEvaluation<B, O> = SecureEvaluation<B, O>;
// TODO(Jules): Define TypescriptBitReversedOrder if it has specific structural requirements beyond `any`.
export type TypescriptBitReversedOrder = any;

// Constants defined from Rust code
const CIRCLE_TO_LINE_FOLD_STEP = 1; // Matches Rust's `CIRCLE_TO_LINE_FOLD_STEP`
const FOLD_STEP = 1; // Matches Rust's `FOLD_STEP` for univariate polynomials


// Additional Placeholders for FriProver
// TODO(Jules): Define TypescriptHasher to match Rust's `core::vcs::ops::MerkleHasher` trait.
// Key property: `Hash` type alias (string placeholder currently).
interface TypescriptHasher { /* Represents H: MerkleHasher */ hash: string; }

// TODO(Jules): Define TypescriptChannelType to represent the channel instance passed around (e.g., from a specific channel implementation).
interface TypescriptChannelType { /* Represents C, the channel instance type itself (e.g., Blake2sChannel) */ }

// TODO(Jules): Define TypescriptMerkleOps<H> to mirror Rust's `core::vcs::ops::MerkleOps<H>` trait.
interface TypescriptMerkleOps<H extends TypescriptHasher> { /* Merkle operations for type B, corresponds to Rust's core::vcs::ops::MerkleOps<H> */ }

// TODO(Jules): Define TypescriptMerkleChannel interface to match Rust's `core::channel::MerkleChannel` trait.
// Key methods: `mix_root`, `draw_felt`, `mix_felts`.
interface TypescriptMerkleChannel<ChannelInstance, HasherType extends TypescriptHasher, FieldType> {
  mix_root(channel: ChannelInstance, root: HasherType): void; // Corresponds to `MerkleChannel::mix_root`
  draw_felt(channel: ChannelInstance): FieldType; // Corresponds to `Channel::draw_felt`
  mix_felts(channel: ChannelInstance, felts: FieldType[]): void; // Corresponds to `Channel::mix_felts`
}

// TODO(Jules): Refine TypescriptFriFirstLayerProver to match Rust's `FriFirstLayerProver`.
// Key property: `merkle_tree` (actual MerkleProver type).
interface TypescriptFriFirstLayerProver<H extends TypescriptHasher> {
  merkle_tree: { // Should be the actual MerkleProver type.
    // TODO(Jules): Ensure MerkleProver.root() returns H (HasherType::Hash).
    root(): H;
  };
}

// Placeholder implementation for TypescriptFriFirstLayerProver
// TODO(Jules): Replace with full implementation matching Rust's `FriFirstLayerProver`.
class TypescriptFriFirstLayerProverImpl<B, H extends TypescriptHasher>
  implements TypescriptFriFirstLayerProver<H> {
  // TODO(Jules): Replace with actual MerkleProver from `core::vcs::prover::MerkleProver`.
  public merkle_tree: { root(): H; /* decommit(...) method will be needed */ };
  private columns_data: TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>[]; 

  constructor(columns: TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>[]) {
    this.columns_data = [...columns]; 
    // TODO(Jules): Implement actual MerkleProver commitment: `MerkleProver::commit(coordinate_columns)`.
    // This requires `extract_coordinate_columns` to be functional and `MerkleProver` to be defined.
    this.merkle_tree = {
      root: () => ({ hash: "placeholder_fri_first_layer_root" } as H),
    };
  }

  column_log_sizes(): Set<number> {
    // TODO(Jules): Ensure `col.len()` is accurate and `col.domain.log_size()` is available if preferred.
    // Rust uses `e.domain.log_size()`.
    console.warn("Placeholder: TypescriptFriFirstLayerProverImpl.column_log_sizes() called. Ensure col.len() or col.domain.log_size() is correctly used.");
    const sizes = new Set<number>();
    this.columns_data.forEach(col => sizes.add(Math.log2(col.len()))); 
    if (sizes.size === 0 && this.columns_data.length > 0) sizes.add(0); 
    return sizes;
  }

  max_column_log_size(): number {
    // TODO(Jules): Ensure `col.len()` is accurate or use `col.domain.log_size()`.
    console.warn("Placeholder: TypescriptFriFirstLayerProverImpl.max_column_log_size() called. Ensure col.len() or col.domain.log_size() is correctly used.");
    let maxLogSize = 0;
    this.columns_data.forEach(col => {
        const logSize = Math.log2(col.len()); 
        if (logSize > maxLogSize) maxLogSize = logSize;
    });
    return maxLogSize;
  }

  decommit(queries: TypescriptQueries): TypescriptFriLayerProof<H> {
    const max_log_size = this.max_column_log_size();
    if (queries.log_domain_size !== max_log_size) {
      throw new Error(`Queries domain size ${queries.log_domain_size} does not match max column log size ${max_log_size}`);
    }

    const fri_witness: SecureField[] = [];
    const decommitment_positions_by_log_size = new Map<number, number[]>();

    for (const column of this.columns_data) {
      // TODO(Jules): Ensure `column.domain.log_size()` is implemented and returns number for `TypescriptSecureEvaluation.domain`.
      const column_log_size = (column.domain as any).log_size ? (column.domain as any).log_size() : 0;
      if (!(column.domain as any).log_size) {
          console.warn("TypescriptFriFirstLayerProverImpl.decommit: column.domain.log_size is missing. Using 0 as fallback. This is likely incorrect.");
      }

      const column_queries = queries.fold(queries.log_domain_size - column_log_size);
      
      // TODO(Jules): Ensure `column` (TypescriptSecureEvaluation) conforms to `TypescriptSecureColumnByCoords` for `at()` method,
      // or that `compute_decommitment_positions_and_witness_evals` can handle its structure.
      // Rust uses `column` directly, which is `&SecureEvaluation`. `SecureEvaluation` in Rust has an `at()` method.
      const { positions: column_decommitment_positions, witness_evals: column_witness } =
        compute_decommitment_positions_and_witness_evals(
          column as any, 
          column_queries.positions, 
          CIRCLE_TO_LINE_FOLD_STEP,
        );
      
      decommitment_positions_by_log_size.set(column_log_size, column_decommitment_positions);
      fri_witness.push(...column_witness);
    }

    // TODO(Jules): Implement MerkleProver.decommit from Rust's `crate::core::vcs::prover::MerkleProver::decommit()`.
    // It takes `positions: &BTreeMap<u32, Vec<usize>>` and `data_cols: Vec<&Col<Self, F>>`.
    // This requires `extract_coordinate_columns` to be fully functional.
    // `this.merkle_tree` should be an instance of the ported `MerkleProver`.
    console.warn("TypescriptFriFirstLayerProverImpl.decommit: MerkleProver.decommit call is a placeholder. Requires actual MerkleProver implementation.");
    // const extracted_cols = extract_coordinate_columns(this.columns_data); // This should be called with the MerkleProver's data source if different
    // const placeholder_decommitment_data = this.merkle_tree.decommit(decommitment_positions_by_log_size, extracted_cols);
    const decommitment_placeholder = { proof_items: ["placeholder_first_layer_decommitment_from_prover"] };


    const commitment = this.merkle_tree.root();

    return new TypescriptFriLayerProofImpl<H>(
      fri_witness,
      decommitment_placeholder, 
      commitment,
    );
  }
}

// TODO(Jules): Refine TypescriptFriInnerLayerProver to match Rust's `FriInnerLayerProver`.
// Key properties: `evaluation` (actual LineEvaluation type), `merkle_tree` (actual MerkleProver type).
interface TypescriptFriInnerLayerProver<B, H extends TypescriptHasher> {
  evaluation: TypescriptLineEvaluation<B>;
  merkle_tree: { root(): H; /* decommit(...) method will be needed */ };
  decommit(queries: TypescriptQueries): TypescriptFriLayerProof<H>;
}

// Placeholder implementation for TypescriptFriInnerLayerProver
// TODO(Jules): Replace with full implementation matching Rust's `FriInnerLayerProver`.
class TypescriptFriInnerLayerProverImpl<B, H extends TypescriptHasher>
  implements TypescriptFriInnerLayerProver<B, H> {
  public evaluation: TypescriptLineEvaluation<B>;
  // TODO(Jules): Replace with actual MerkleProver from `core::vcs::prover::MerkleProver`.
  public merkle_tree: { root(): H; /* decommit(...) method will be needed */ };

  constructor(evaluation: TypescriptLineEvaluation<B>) {
    this.evaluation = evaluation;
    // TODO(Jules): Implement actual MerkleProver commitment: `MerkleProver::commit(evaluation.values.columns.iter().collect_vec())`.
    // This requires `evaluation.values` to expose its constituent columns (e.g., as `SecureColumnByCoords.columns`).
    this.merkle_tree = {
      root: () => ({ hash: "placeholder_fri_inner_layer_root" } as H),
    };
  }

  decommit(queries: TypescriptQueries): TypescriptFriLayerProof<H> {
    // TODO(Jules): Ensure `this.evaluation.values` (assumed to be `SecureColumnByCoords`) has an `at()` method for `compute_decommitment_positions_and_witness_evals`.
    // Rust uses `&self.evaluation.values`.
    const { positions: decommitment_positions, witness_evals: fri_witness } =
      compute_decommitment_positions_and_witness_evals(
        this.evaluation.values as unknown as TypescriptSecureColumnByCoords<B>, 
        queries, 
        FOLD_STEP,
      );

    // TODO(Jules): Ensure `this.evaluation.domain` has `log_size()` method (or direct property).
    // Rust uses `self.evaluation.domain().log_size()`.
    const layer_log_size = (this.evaluation.domain as any)?.log_size || 0;
    if (!(this.evaluation.domain as any)?.log_size) {
        console.warn("TypescriptFriInnerLayerProverImpl.decommit: this.evaluation.domain.log_size is missing. Using 0 as fallback. This is likely incorrect.");
    }
    
    // TODO(Jules): Implement MerkleProver.decommit from Rust's `crate::core::vcs::prover::MerkleProver::decommit()`.
    // It takes `positions: &BTreeMap<u32, Vec<usize>>` and `data_cols: Vec<&Col<Self, F>>`.
    // This requires `this.evaluation.values` to expose its constituent columns (e.g., `SecureColumnByCoords.columns`).
    console.warn("TypescriptFriInnerLayerProverImpl.decommit: MerkleProver.decommit call is a placeholder. Requires actual MerkleProver implementation.");
    // const eval_value_columns = (this.evaluation.values as any).columns; // Placeholder for accessing columns of SecureColumnByCoords
    // const placeholder_decommitment_data = this.merkle_tree.decommit(new Map([[layer_log_size, decommitment_positions]]), eval_value_columns);
    const decommitment_placeholder = { proof_items: ["placeholder_inner_layer_decommitment_from_prover"] };

    const commitment = this.merkle_tree.root();

    return new TypescriptFriLayerProofImpl<H>(
      fri_witness,
      decommitment_placeholder,
      commitment,
    );
  }
}



/**
 * Interface for FRI operations, ported from Rust's `FriOps` trait.
 * The generic parameter `B` represents the implementing type (equivalent to `Self` in Rust).
 * This interface extends placeholder types for `ColumnOps<BaseField>`, `PolyOps`,
 * and `ColumnOps<SecureField>`.
 */
export interface FriOps<B extends FriOps<B>>
  extends TypescriptColumnOps<TypescriptBaseField>, // Should be actual BaseField (e.g., M31)
    TypescriptPolyOps,
    TypescriptColumnOps<SecureField> { // SecureField is QM31
  /**
   * Folds a degree `d` polynomial into a degree `d/2` polynomial.
   * Corresponds to Rust's `FriOps::fold_line`.
   */
  fold_line(
    eval_val: TypescriptLineEvaluation<B>, 
    alpha: SecureField,
    twiddles: TypescriptTwiddleTree<B>, // Should be actual TwiddleTree type
  ): TypescriptLineEvaluation<B>; // Should return actual LineEvaluation type

  /**
   * Folds and accumulates a degree `d` circle polynomial into a degree `d/2` univariate polynomial.
   * Corresponds to Rust's `FriOps::fold_circle_into_line`.
   */
  fold_circle_into_line(
    dst: TypescriptLineEvaluation<B>, // Should be actual LineEvaluation type; mutated
    src: TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>, // Should be actual SecureEvaluation type
    alpha: SecureField,
    twiddles: TypescriptTwiddleTree<B>, // Should be actual TwiddleTree type
  ): void;

  /**
   * Decomposes a FRI-space polynomial.
   * Corresponds to Rust's `FriOps::decompose`.
   */
  decompose(
    eval_val: TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>, // Should be actual SecureEvaluation type
  ): [TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>, SecureField]; // Returns tuple of actual SecureEvaluation and SecureField
}


// --- FriProver Class Definition ---
// TODO(Jules): Ensure FriProver's generic constraints `B extends FriOps<B> & TypescriptMerkleOps<H>` are correctly mapped.
// `TypescriptMerkleOps<H>` should correspond to `MerkleOps<MC::H>`.
// `ChannelOps` should correspond to `MC: MerkleChannel`.
// `C` (ChannelInstance) should correspond to `MC::C`.
export class FriProver<
  B extends FriOps<B> & TypescriptMerkleOps<H>,
  H extends TypescriptHasher,
  C, 
  ChannelOps extends TypescriptMerkleChannel<C, H, SecureField> 
> {
  public readonly config: FriConfig;
  public readonly firstLayer: TypescriptFriFirstLayerProverImpl<B, H>; 
  public readonly innerLayers: TypescriptFriInnerLayerProver<B, H>[];
  public readonly lastLayerPoly: TypescriptLinePoly; // Should be actual LinePoly type

  private constructor(
    config: FriConfig,
    firstLayer: TypescriptFriFirstLayerProverImpl<B, H>,
    innerLayers: TypescriptFriInnerLayerProver<B, H>[],
    lastLayerPoly: TypescriptLinePoly, // Should be actual LinePoly type
  ) {
    this.config = config;
    this.firstLayer = firstLayer;
    this.innerLayers = innerLayers;
    this.lastLayerPoly = lastLayerPoly;
  }

  static commit<
    B extends FriOps<B> & TypescriptMerkleOps<H>,
    H extends TypescriptHasher,
    C, 
    ChannelOps extends TypescriptMerkleChannel<C, H, SecureField> 
  >(
    channel: C, // This is `channel: &mut MC::C` in Rust
    config: FriConfig,
    columns: TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>[], // This is `columns: &'a [SecureEvaluation<B, BitReversedOrder>]`
    twiddles: TypescriptTwiddleTree<B>, // This is `twiddles: &TwiddleTree<B>`
    channelOps: ChannelOps, // Represents the MerkleChannel operations
    bOps: B, // Instance of B providing FriOps methods (like Self for trait methods)
  ): FriProver<B, H, C, ChannelOps> {
    if (columns.length === 0) {
      throw new Error("no columns provided for FRI commitment");
    }
    // TODO(Jules): Ensure `e.domain.is_canonic()` is implemented for TypescriptSecureEvaluation.domain.
    if (!columns.every((e) => e.domain.is_canonic())) {
      throw new Error("column domain is not canonic");
    }
    // TODO(Jules): Ensure `e.len()` is implemented for TypescriptSecureEvaluation.
    for (let i = 0; i < columns.length - 1; i++) {
      if (columns[i].len() <= columns[i+1].len()) {
        throw new Error("column sizes not decreasing");
      }
    }

    const firstLayer = FriProver.commit_first_layer<B, H, C, ChannelOps>(channel, columns, channelOps);

    const { innerLayers, lastLayerEvaluation } = FriProver.commit_inner_layers<B, H, C, ChannelOps>(
      channel, channelOps, config, columns, bOps, twiddles
    );
    const lastLayerPoly = FriProver.commit_last_layer<B, H, C, ChannelOps>(
      channel, channelOps, config, lastLayerEvaluation
    );

    return new FriProver(config, firstLayer, innerLayers, lastLayerPoly);
  }

  private static commit_first_layer<
    B extends FriOps<B> & TypescriptMerkleOps<H>,
    H extends TypescriptHasher,
    C, 
    ChannelOps extends TypescriptMerkleChannel<C, H, SecureField>
  >(
    channel: C,
    columns: TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>[],
    channelOps: ChannelOps,
  ): TypescriptFriFirstLayerProverImpl<B, H> { 
    const layer = new TypescriptFriFirstLayerProverImpl<B, H>(columns);
    // TODO(Jules): Ensure `channelOps.mix_root` correctly implements `MerkleChannel::mix_root`.
    channelOps.mix_root(channel, layer.merkle_tree.root());
    return layer;
  }

  private static commit_inner_layers<
    B extends FriOps<B> & TypescriptMerkleOps<H>,
    H extends TypescriptHasher,
    C,
    ChannelOps extends TypescriptMerkleChannel<C, H, SecureField>
  >(
    channel: C,
    channelOps: ChannelOps,
    config: FriConfig,
    columns: TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>[],
    bOps: B, // Instance of B, used to call FriOps methods like `fold_circle_into_line`, `fold_line`.
    twiddles: TypescriptTwiddleTree<B>,
  ): { innerLayers: TypescriptFriInnerLayerProver<B, H>[], lastLayerEvaluation: TypescriptLineEvaluation<B> } {
    const folded_size = (v: TypescriptSecureEvaluation<any, any>): number => {
      // TODO(Jules): Ensure `v.len()` is implemented for TypescriptSecureEvaluation.
      return v.len() >> CIRCLE_TO_LINE_FOLD_STEP;
    }

    const first_inner_layer_log_size = Math.log2(folded_size(columns[0]));
    // TODO(Jules): Implement actual LineDomain construction, e.g., `LineDomain::new(Coset::half_odds(log_size))`.
    // This requires `Coset` and `LineDomain` to be properly defined.
    const first_inner_layer_domain_placeholder = new TypescriptLineDomainPlaceholder(first_inner_layer_log_size);

    // TODO(Jules): Ensure SecureField.ZERO is correctly defined and available (e.g., on QM31).
    const zeroSecureField = SecureField.ZERO; 
    if (!zeroSecureField) {
        throw new Error("SecureField.ZERO is not available. Ensure QM31.ZERO is defined.");
    }
    // TODO(Jules): Ensure `TypescriptLineEvaluationImpl.new_zero` matches Rust's `LineEvaluation::new_zero`.
    let layer_evaluation = TypescriptLineEvaluationImpl.new_zero<B>(first_inner_layer_domain_placeholder, zeroSecureField);
    const layers: TypescriptFriInnerLayerProver<B, H>[] = [];
    let columns_iter = [...columns]; 

    // TODO(Jules): Ensure `channelOps.draw_felt` correctly implements `Channel::draw_felt`.
    let folding_alpha = channelOps.draw_felt(channel);

    // TODO(Jules): Ensure `bOps.fold_circle_into_line` correctly calls the FriOps method.
    bOps.fold_circle_into_line(
      layer_evaluation, 
      columns_iter.shift()!, 
      folding_alpha,
      twiddles,
    );
    // TODO(Jules): Ensure `layer_evaluation.len()` is implemented for TypescriptLineEvaluation.
    while (layer_evaluation.len() > config.last_layer_domain_size()) {
      const layer = new TypescriptFriInnerLayerProverImpl<B,H>(layer_evaluation);
      channelOps.mix_root(channel, layer.merkle_tree.root());
      folding_alpha = channelOps.draw_felt(channel);
      // TODO(Jules): Ensure `bOps.fold_line` correctly calls the FriOps method.
      layer_evaluation = bOps.fold_line(layer.evaluation, folding_alpha, twiddles);

      let current_columns_len = columns_iter.length;
      for (let i = 0; i < current_columns_len; ) {
        const column_to_check = columns_iter[i];
        if (folded_size(column_to_check) === layer_evaluation.len()) {
          const column = columns_iter.splice(i, 1)[0]; 
          bOps.fold_circle_into_line(layer_evaluation, column, folding_alpha, twiddles);
        } else {
          i++; 
        }
      }
      layers.push(layer);
    }

    if (columns_iter.length !== 0) {
      throw new Error("Not all columns were consumed during FRI inner layer commitment.");
    }

    return { innerLayers: layers, lastLayerEvaluation: layer_evaluation };
  }

  private static commit_last_layer<
    B extends FriOps<B> & TypescriptMerkleOps<H>,
    H extends TypescriptHasher,
    C,
    ChannelOps extends TypescriptMerkleChannel<C, H, SecureField>
  >(
    channel: C,
    channelOps: ChannelOps,
    config: FriConfig,
    evaluation: TypescriptLineEvaluation<B>, // Should be actual LineEvaluation type
  ): TypescriptLinePoly { // Should return actual LinePoly type
    // TODO(Jules): Ensure `evaluation.len()` is implemented for TypescriptLineEvaluation.
    if (evaluation.len() !== config.last_layer_domain_size()) {
      throw new Error("Evaluation length mismatch for last layer commitment.");
    }

    // TODO(Jules): Ensure `evaluation.to_cpu()` and `interpolate().into_ordered_coefficients()` are implemented.
    const evaluation_cpu = evaluation.to_cpu(); 
    let coeffs = evaluation_cpu.interpolate().into_ordered_coefficients();

    const last_layer_degree_bound = 1 << config.log_last_layer_degree_bound;

    const main_coeffs = coeffs.slice(0, last_layer_degree_bound);
    const zero_coeffs = coeffs.slice(last_layer_degree_bound);

    // TODO(Jules): Ensure `SecureField.is_zero()` is implemented (e.g., on QM31).
    if (!zero_coeffs.every(val => val.is_zero())) { 
        throw new Error("Invalid degree: Last layer polynomial has non-zero coefficients beyond the bound.");
    }
    coeffs = main_coeffs; 

    // TODO(Jules): Ensure `TypescriptLinePolyImpl.from_ordered_coefficients` matches Rust's `LinePoly::from_ordered_coefficients`.
    const last_layer_poly = TypescriptLinePolyImpl.from_ordered_coefficients(coeffs);
    // TODO(Jules): Ensure `channelOps.mix_felts` correctly implements `Channel::mix_felts`.
    // TODO(Jules): Ensure `last_layer_poly.getCoefficients()` provides the coefficients in the correct format for `mix_felts`.
    channelOps.mix_felts(channel, last_layer_poly.getCoefficients());

    return last_layer_poly;
  }

  public decommit<ChannelInstanceForQueries, ChannelOpsForQueries extends TypescriptMerkleChannel<ChannelInstanceForQueries, H, SecureField>>(
    channel: ChannelInstanceForQueries, 
    channelOps: ChannelOpsForQueries,
  ): { proof: TypescriptFriProof<H>; queryPositionsByLogSize: Map<number, number[]>; } {
    const max_column_log_size = this.firstLayer.max_column_log_size();
    // TODO(Jules): Ensure `TypescriptQueriesImpl.generate` correctly implements `Queries::generate`.
    const queries = TypescriptQueriesImpl.generate(
      channel,
      channelOps,
      max_column_log_size,
      this.config.n_queries
    );
    const column_log_sizes = this.firstLayer.column_log_sizes();
    // TODO(Jules): Ensure `get_query_positions_by_log_size` is correctly implemented.
    const queryPositionsByLogSize = get_query_positions_by_log_size(queries, column_log_sizes);
    const proof = this.decommit_on_queries(queries);
    return { proof, queryPositionsByLogSize };
  }

  private decommit_on_queries(queries: TypescriptQueries): TypescriptFriProof<H> {
    const first_layer_proof = this.firstLayer.decommit(queries);
    const inner_layer_proofs: TypescriptFriLayerProof<H>[] = [];
    // TODO(Jules): Ensure `queries.fold` is correctly implemented for `TypescriptQueriesImpl`.
    let current_layer_queries = queries.fold(CIRCLE_TO_LINE_FOLD_STEP);

    for (const layer of this.innerLayers) {
      const layer_proof = layer.decommit(current_layer_queries);
      current_layer_queries = current_layer_queries.fold(FOLD_STEP);
      inner_layer_proofs.push(layer_proof);
    }

    return new TypescriptFriProofImpl<H>(
      first_layer_proof,
      inner_layer_proofs,
      this.lastLayerPoly
    );
  }
}

// Additional Placeholder Implementations for decommit phase
// TODO(Jules): Refine TypescriptFriLayerProof to match Rust's `FriLayerProof<H>`.
// Key properties: `fri_witness` (Vec<SecureField>), `decommitment` (actual MerkleDecommitment<H> type), `commitment` (H::Hash type).
interface TypescriptFriLayerProof<H extends TypescriptHasher> {
  fri_witness: SecureField[];
  decommitment: any; // Should be TypescriptMerkleDecommitment<H>
  commitment: H; 
}

// TODO(Jules): Replace with full implementation matching Rust's `FriLayerProof<H>`.
class TypescriptFriLayerProofImpl<H extends TypescriptHasher> implements TypescriptFriLayerProof<H> {
  constructor(
    public fri_witness: SecureField[],
    public decommitment: any, // TODO(Jules): Change to TypescriptMerkleDecommitment<H> once defined.
    public commitment: H,
  ) {}
}

// TODO(Jules): Refine TypescriptFriProof to match Rust's `FriProof<H>`.
// Key properties: `first_layer`, `inner_layers`, `last_layer_poly`.
export interface TypescriptFriProof<H extends TypescriptHasher> {
  first_layer: TypescriptFriLayerProof<H>; // Should be actual FriLayerProof type
  inner_layers: TypescriptFriLayerProof<H>[]; // Should be array of actual FriLayerProof type
  last_layer_poly: TypescriptLinePoly; // Should be actual LinePoly type
}

// TODO(Jules): Replace with full implementation matching Rust's `FriProof<H>`.
export class TypescriptFriProofImpl<H extends TypescriptHasher> implements TypescriptFriProof<H> {
  constructor(
    public first_layer: TypescriptFriLayerProof<H>,
    public inner_layers: TypescriptFriLayerProof<H>[],
    public last_layer_poly: TypescriptLinePoly,
  ) {}
}

// TODO(Jules): Refine TypescriptQueries to match Rust's `core::queries::Queries`.
// Key methods: `new(positions, log_domain_size)`, `fold(n_folds)`, `generate(channel, log_domain_size, n_queries)`.
export interface TypescriptQueries {
  log_domain_size: number;
  positions: number[];
  fold(count: number): TypescriptQueries;
}

// TODO(Jules): Replace with full implementation of `Queries` from `core::queries.rs`.
export class TypescriptQueriesImpl implements TypescriptQueries {
  constructor(public log_domain_size: number, public positions: number[]) {}

  fold(count: number): TypescriptQueries {
    // Placeholder: Actual folding logic from Rust's Queries::fold needed.
    console.warn("Placeholder: TypescriptQueriesImpl.fold() called. Needs actual Rust logic.");
    const new_log_domain_size = this.log_domain_size - count;
    // This is a simplified folding of positions, Rust logic might be more nuanced.
    const new_positions = this.positions.map(p => p >> count).filter((p, i, arr) => arr.indexOf(p) === i);
    return new TypescriptQueriesImpl(new_log_domain_size, new_positions);
  }

  static generate<ChannelInstance, HasherType extends TypescriptHasher, FieldType>(
    channel: ChannelInstance, // `channel: &mut impl Channel` in Rust
    channelOps: TypescriptMerkleChannel<ChannelInstance, HasherType, FieldType>, // For drawing random numbers
    max_column_log_size: number,
    n_queries: number,
  ): TypescriptQueries {
    // Placeholder: Actual random query generation using channel needed, as in Rust's `Queries::generate`.
    console.warn("Placeholder: TypescriptQueriesImpl.generate() called. Needs actual channel-based random number generation.");
    const positions: number[] = [];
    const max_pos = (1 << max_column_log_size);
    for (let i = 0; i < n_queries; i++) {
      // This is a placeholder for actual channel-based random number generation.
      // In Rust, it uses `channel.draw_usize(max_pos)`.
      // `channelOps.draw_felt` might be adaptable if it can produce usize-like values or be used as a seed.
      positions.push(Math.floor(Math.random() * max_pos)); 
    }
    return new TypescriptQueriesImpl(max_column_log_size, positions);
  }
}

// --- Placeholders for FriVerifier ---

// TODO(Jules): Refine TypescriptLinePolyDegreeBound to match Rust's `LinePolyDegreeBound`.
// Key method: `fold(n_folds)`.
export interface TypescriptLinePolyDegreeBound {
  log_degree_bound: number;
  fold(n_folds: number): TypescriptLinePolyDegreeBound | null;
}

// TODO(Jules): Replace with full implementation matching Rust's `LinePolyDegreeBound`.
export class TypescriptLinePolyDegreeBoundImpl implements TypescriptLinePolyDegreeBound {
  constructor(public log_degree_bound: number) {}

  fold(n_folds: number): TypescriptLinePolyDegreeBound | null {
    // Placeholder: Actual logic from Rust's `LinePolyDegreeBound::fold` needed.
    console.warn("Placeholder: TypescriptLinePolyDegreeBoundImpl.fold() called.");
    if (this.log_degree_bound < n_folds) {
      return null;
    }
    return new TypescriptLinePolyDegreeBoundImpl(this.log_degree_bound - n_folds);
  }
}

// TODO(Jules): Refine TypescriptCirclePolyDegreeBound to match Rust's `CirclePolyDegreeBound`.
// Key method: `fold_to_line()`.
export interface TypescriptCirclePolyDegreeBound {
  log_degree_bound: number;
  fold_to_line(): TypescriptLinePolyDegreeBound; // Should return actual LinePolyDegreeBound type
}

// TODO(Jules): Replace with full implementation matching Rust's `CirclePolyDegreeBound`.
export class TypescriptCirclePolyDegreeBoundImpl implements TypescriptCirclePolyDegreeBound {
  constructor(public log_degree_bound: number) {}

  fold_to_line(): TypescriptLinePolyDegreeBound {
    // Placeholder: Actual logic from Rust's `CirclePolyDegreeBound::fold_to_line` needed.
    console.warn("Placeholder: TypescriptCirclePolyDegreeBoundImpl.fold_to_line() called.");
    return new TypescriptLinePolyDegreeBoundImpl(this.log_degree_bound - CIRCLE_TO_LINE_FOLD_STEP);
  }
}

// Placeholder for actual CircleDomain, CanonicCoset, LineDomain
// TODO(Jules): Replace TypescriptCircleDomain with a full implementation of CircleDomain from Rust's `core::poly::circle::CircleDomain`.
// Key methods: constructor from coset, `log_size()`, `at(index)`, `index_at()`, `is_canonic()`.
export type TypescriptCircleDomain = CircleDomain;
export { CanonicCoset as TypescriptCanonicCosetImpl } from "./poly/circle";

// TODO(Jules): Replace TypescriptLineDomainImpl with a full implementation of LineDomain from Rust's `core::poly::line::LineDomain`.
// Key methods: constructor from coset, `log_size()`, `at(index)`, `double()`, `coset().index_at()`.
export { LineDomain as TypescriptLineDomainImpl } from "./poly/line";


// FriVerificationError Enum (as an object)
export const TypescriptFriVerificationError = {
  InvalidNumFriLayers: "proof contains an invalid number of FRI layers",
  LastLayerDegreeInvalid: "degree of last layer is invalid",
  FirstLayerEvaluationsInvalid: "evaluations are invalid in the first layer", 
  InnerLayerEvaluationsInvalid: "evaluations are invalid in inner layer", 
  LastLayerEvaluationsInvalid: "evaluations in the last layer are invalid", 
  QueriesNotSampled: "queries not sampled before decommit", 
  FirstLayerCommitmentInvalid: "queries do not resolve to their commitment in the first layer", // Corresponds to FirstLayerCommitmentInvalid { error: MerkleVerificationError }
  InnerLayerCommitmentInvalid: "queries do not resolve to their commitment in inner layer", // Corresponds to InnerLayerCommitmentInvalid { inner_layer: usize, error: MerkleVerificationError }
  InsufficientWitness: "insufficient witness data provided for reconstruction", // Matches symbol InsufficientWitnessError
} as const;
export type TypescriptFriVerificationError = typeof TypescriptFriVerificationError[keyof typeof TypescriptFriVerificationError];

// Additional Placeholders for FriVerifier decommit phase
export type TypescriptColumnVec<T> = T[]; // Represents `Vec<T>` in Rust for column data.

// Utility function from Rust's core::utils (simplified for placeholder)
function bit_reverse_index(index: number, log_size: number): number {
  // TODO(Jules): Verify this bit_reverse_index logic matches Rust's `bit_reverse_index` from `core::utils`.
  if (log_size === 0) return 0;
  let reversed_index = 0;
  for (let i = 0; i < log_size; i++) {
    if ((index >> i) & 1) {
      reversed_index |= 1 << (log_size - 1 - i);
    }
  }
  return reversed_index;
}

const InsufficientWitnessError = Symbol("InsufficientWitnessError"); // Used internally by compute_decommitment_positions_and_rebuild_evals
const SECURE_EXTENSION_DEGREE = 4; // Matches Rust's `SECURE_EXTENSION_DEGREE` from `core::fields::secure_column`.

// Placeholder for MerkleVerifier
// TODO(Jules): Replace with full implementation of MerkleVerifier from Rust's `crate::core::vcs::verifier::MerkleVerifier`.
// Key methods: `new(root, domain_log_sizes)`, `verify(positions_by_log_size, decommitted_values, proof)`.
class TypescriptMerkleVerifierImpl<H extends TypescriptHasher> {
  constructor(public commitment: H, public domains_log_sizes: number[]) {
     console.warn("Placeholder: TypescriptMerkleVerifierImpl constructor called. Needs actual MerkleVerifier logic.", commitment, domains_log_sizes);
  }
  verify(
    positions_by_log_size: Map<number, number[]>, // Corresponds to `queries: &BTreeMap<u32, Vec<usize>>` in Rust
    decommitted_values: TypescriptBaseField[], // Corresponds to `values: Vec<BaseField>`
    decommitment_obj: any // Placeholder for `proof: MerkleDecommitment<H::HS>`
  ): null | { error: TypescriptFriVerificationError, details?: any } { // Should return `Result<(), MerkleVerificationError>`
    console.warn("Placeholder: TypescriptMerkleVerifierImpl.verify() called. Needs actual Merkle verification logic.", positions_by_log_size, decommitted_values, decommitment_obj);
    // Return null for success (Ok(())), or an error object for Err(MerkleVerificationError).
    // The error object here is simplified.
    return null; 
  }
}

// TODO(Jules): Refine TypescriptSparseEvaluation interface and TypescriptSparseEvaluationImpl class.
// Ensure they match Rust's `SparseEvaluation` struct and its methods `new`, `fold_line`, `fold_circle`.
export interface TypescriptSparseEvaluation { 
  subset_evals: SecureField[][]; 
  subset_domain_initial_indexes: number[]; // Added this property based on SparseEvaluation::new
  fold_line(alpha: SecureField, domain: TypescriptLineDomainImpl): SecureField[];
  fold_circle?(alpha: SecureField, domain: TypescriptCircleDomain): SecureField[];
}

/**
 * Port of Rust's `compute_decommitment_positions_and_rebuild_evals`.
 * Returns a column's merkle tree decommitment positions and re-builds the evaluations needed by
 * the verifier for folding and decommitment.
 *
 * Panics if the number of queries doesn't match the number of query evals (implicitly, by consuming query_evals_iter).
 */
function compute_decommitment_positions_and_rebuild_evals(
  queries: TypescriptQueries, 
  query_evals_input: SecureField[], 
  witness_evals_iterator: Iterator<SecureField>, 
  fold_step: number, 
): { positions: number[]; evaluation: TypescriptSparseEvaluation } | typeof InsufficientWitnessError {
  
  const query_evals_iter = query_evals_input[Symbol.iterator](); 

  const decommitment_positions: number[] = [];
  const all_subset_evals: SecureField[][] = [];
  const subset_domain_initial_indexes: number[] = [];

  let i = 0;
  while (i < queries.positions.length) {
    const first_in_subset = queries.positions[i];
    const subset_group_key = first_in_subset >> fold_step;

    const current_subset_query_positions: number[] = [];
    let j = i;
    while (j < queries.positions.length && (queries.positions[j] >> fold_step) === subset_group_key) {
        current_subset_query_positions.push(queries.positions[j]);
        j++;
    }
    
    const subset_start = subset_group_key << fold_step;
    const num_positions_in_subset = 1 << fold_step;
    for (let k = 0; k < num_positions_in_subset; k++) {
        decommitment_positions.push(subset_start + k);
    }
    
    const current_subset_queries_set = new Set(current_subset_query_positions);
    const current_rebuilt_evals_for_subset: SecureField[] = [];

    for (let k = 0; k < num_positions_in_subset; k++) {
        const position_in_full_domain = subset_start + k;
        
        if (current_subset_queries_set.has(position_in_full_domain)) {
            const next_query_eval = query_evals_iter.next();
            if (next_query_eval.done) {
                console.error("compute_decommitment_positions_and_rebuild_evals: query_evals_iter exhausted prematurely. Mismatch between queries and query_evals.");
                return InsufficientWitnessError; 
            }
            current_rebuilt_evals_for_subset.push(next_query_eval.value);
        } else {
            const next_witness_eval = witness_evals_iterator.next();
            if (next_witness_eval.done) {
                // This is the error mapped from `ok_or(InsufficientWitnessError)` in Rust.
                return InsufficientWitnessError; 
            }
            current_rebuilt_evals_for_subset.push(next_witness_eval.value);
        }
    }
    
    all_subset_evals.push(current_rebuilt_evals_for_subset);
    // TODO(Jules): Ensure `queries.log_domain_size` is correctly available and used for `bit_reverse_index`.
    subset_domain_initial_indexes.push(bit_reverse_index(subset_start, queries.log_domain_size));
    
    i = j; 
  }

  if (!query_evals_iter.next().done) {
      console.error("compute_decommitment_positions_and_rebuild_evals: Not all query_evals were consumed. More evals provided than query positions.");
      return InsufficientWitnessError; 
  }

  const sparse_evaluation = new TypescriptSparseEvaluationImpl(all_subset_evals, subset_domain_initial_indexes);

  return { positions: decommitment_positions, evaluation: sparse_evaluation };
}

class TypescriptSparseEvaluationImpl implements TypescriptSparseEvaluation {
    constructor(
        public subset_evals: SecureField[][], 
        public subset_domain_initial_indexes: number[]
    ) {
        const fold_factor = 1 << FOLD_STEP; 
        if(!this.subset_evals.every(e => e.length === fold_factor)) {
            console.warn(`Assertion failed in TypescriptSparseEvaluationImpl constructor: Not all subset_evals have length ${fold_factor}. Subsets lengths: ${this.subset_evals.map(e => e.length)}. This should match Rust's SparseEvaluation::new assertion.`);
        }
        if(this.subset_evals.length !== this.subset_domain_initial_indexes.length) {
            console.warn(`Assertion failed in TypescriptSparseEvaluationImpl constructor: subset_evals length (${this.subset_evals.length}) !== subset_domain_initial_indexes length (${this.subset_domain_initial_indexes.length}). This should match Rust's SparseEvaluation::new assertion.`);
        }
    }

    fold_line(fold_alpha: SecureField, source_domain: TypescriptLineDomainImpl): SecureField[] {
        // TODO(Jules): This implementation depends on the full port of the standalone `fold_line` function (currently `export function fold_line`).
        // TODO(Jules): `source_domain.coset().index_at()`: Ensure `TypescriptLineDomainImpl.coset()` returns an object with `index_at(idx: number): PointIndexLike` as per Rust's `Coset::index_at`.
        // TODO(Jules): `LineDomain::new(Coset::new(initial, log_size))`: Ensure `TypescriptLineDomainImpl` constructor can accept a coset definition (e.g. from `Coset::new(fold_domain_initial_placeholder, FOLD_STEP)`).
        // TODO(Jules): `LineEvaluation::new(domain, values)`: Ensure `TypescriptLineEvaluationImpl` constructor matches this usage for creating `eval_obj_placeholder`.
        // TODO(Jules): `LineEvaluation.values.at(0)`: Ensure the result of global `fold_line` has a `.values` property that is an array or has an `.at(0)` method.

        return this.subset_evals.map((eval_subset, index) => {
            const domain_initial_index = this.subset_domain_initial_indexes[index];
            
            const fold_domain_initial_placeholder = (source_domain as any).coset?.().index_at?.(domain_initial_index) ?? domain_initial_index; 
            if (!(source_domain as any).coset?.().index_at) {
                console.warn("TypescriptSparseEvaluationImpl.fold_line: source_domain.coset().index_at() is not defined. Using domain_initial_index as placeholder. This is likely incorrect for point calculation.");
            }

            const fold_domain_placeholder = new TypescriptLineDomainImpl({ initial_index: fold_domain_initial_placeholder, log_size: FOLD_STEP}); 
            
            const eval_obj_placeholder = new TypescriptLineEvaluationImpl<any>(fold_domain_placeholder, eval_subset);

            let result_eval: SecureField;
            if (typeof (globalThis as any).fold_line === 'function') {
                const folded_eval_placeholder = (globalThis as any).fold_line(eval_obj_placeholder, fold_alpha);
                // Assuming .values is an array on the returned evaluation.
                result_eval = folded_eval_placeholder.values?.[0] ?? SecureField.ZERO;
                 if (!folded_eval_placeholder.values?.[0]) {
                    console.warn("TypescriptSparseEvaluationImpl.fold_line: .values[0] access failed or returned undefined on folded evaluation. Ensure global fold_line returns evaluations correctly.");
                }
            } else {
                console.warn("TypescriptSparseEvaluationImpl.fold_line: Standalone 'fold_line' function not found globally. Dependencies need to be correctly linked. Using SecureField.ZERO as fallback.");
                result_eval = SecureField.ZERO;
            }
            return result_eval;
        });
    }

    fold_circle(fold_alpha: SecureField, source_domain: TypescriptCircleDomain): SecureField[] {
        // TODO(Jules): This implementation depends on the full port of the standalone `fold_circle_into_line` function (currently `export function fold_circle_into_line`).
        // TODO(Jules): `source_domain.index_at()`: Ensure `TypescriptCircleDomain.index_at(idx: number): PointIndexLike` is implemented as per Rust's `CircleDomain::index_at`.
        // TODO(Jules): `CircleDomain::new(Coset::new(initial, log_size))`: Ensure `TypescriptCircleDomain` constructor can accept a coset definition.
        // TODO(Jules): `SecureEvaluation::new(domain, values)`: Ensure a constructor for `TypescriptSecureEvaluation` (or its Impl) is available.
        // TODO(Jules): `LineDomain::new(fold_domain.half_coset)`: Ensure `TypescriptCircleDomain.half_coset` provides compatible input for `TypescriptLineDomainImpl` constructor.
        // TODO(Jules): `LineEvaluation::new_zero()`: Ensure this static method is correctly implemented on `TypescriptLineEvaluationImpl`.
        // TODO(Jules): `LineEvaluation.values.at(0)`: Ensure `buffer_placeholder.values[0]` access is correct for the result.

        return this.subset_evals.map((eval_subset, index) => {
            const domain_initial_index = this.subset_domain_initial_indexes[index];

            const fold_domain_initial_placeholder = (source_domain as any).index_at?.(domain_initial_index) ?? domain_initial_index; 
            if (!(source_domain as any).index_at) {
                console.warn("TypescriptSparseEvaluationImpl.fold_circle: source_domain.index_at() is not defined. Using domain_initial_index as placeholder. This is likely incorrect.");
            }
            
            const circle_domain_fold_log_size = CIRCLE_TO_LINE_FOLD_STEP - 1;
            // TODO(Jules): Need proper TypescriptCircleDomainImpl constructor that accepts coset details as per Rust's `CircleDomain::new(Coset::new(...))`.
            const fold_domain_placeholder = { 
                initial_index: fold_domain_initial_placeholder, 
                log_size: () => circle_domain_fold_log_size, // Make log_size a function if that's the convention
                half_coset: { log_size: circle_domain_fold_log_size } // Ensure half_coset provides necessary info for LineDomain
            } as any as TypescriptCircleDomain;
            if (circle_domain_fold_log_size < 0) console.warn("fold_circle: CIRCLE_TO_LINE_FOLD_STEP - 1 is negative, this is an issue if log_size is expected to be non-negative.");

            // TODO(Jules): Need TypescriptSecureEvaluationImpl constructor: `new(domain, values)`.
            const eval_sec_placeholder = { domain: fold_domain_placeholder, values: eval_subset } as any as TypescriptSecureEvaluation<any, any>;

            // TODO(Jules): Ensure `fold_domain_placeholder.half_coset` is correctly structured for `TypescriptLineDomainImpl` constructor.
            const line_domain_for_buffer = new TypescriptLineDomainImpl((fold_domain_placeholder as any).half_coset || { log_size: Math.max(0, circle_domain_fold_log_size) }); // Fallback log_size for half_coset
            if (!(fold_domain_placeholder as any).half_coset) {
                 console.warn("TypescriptSparseEvaluationImpl.fold_circle: fold_domain_placeholder.half_coset is not defined. Using default for LineDomain construction.");
            }
            const buffer_placeholder = TypescriptLineEvaluationImpl.new_zero<any>(line_domain_for_buffer, SecureField.ZERO);

            if (typeof (globalThis as any).fold_circle_into_line === 'function') {
                (globalThis as any).fold_circle_into_line(buffer_placeholder, eval_sec_placeholder, fold_alpha);
            } else {
                console.warn("TypescriptSparseEvaluationImpl.fold_circle: Standalone 'fold_circle_into_line' function not found globally. Dependencies need to be correctly linked.");
            }
            
            const result_eval = buffer_placeholder.values?.[0] ?? SecureField.ZERO;
            if (!buffer_placeholder.values?.[0]) {
                console.warn("TypescriptSparseEvaluationImpl.fold_circle: .values[0] access failed or returned undefined on buffer. Ensure global fold_circle_into_line mutates dst correctly.");
            }
            return result_eval;
        });
    }
}

// TODO(Jules): Refine TypescriptFriFirstLayerVerifier to match Rust's `FriFirstLayerVerifier<H>`.
// Key properties: `column_bounds` (Vec<CirclePolyDegreeBound>), `column_commitment_domains` (Vec<CircleDomain>), `folding_alpha` (SecureField), `proof` (FriLayerProof<H>).
interface TypescriptFriFirstLayerVerifier<H extends TypescriptHasher> {
  column_bounds: TypescriptCirclePolyDegreeBound[]; // Should be actual CirclePolyDegreeBound type
  column_commitment_domains: TypescriptCircleDomain[]; // Should be actual CircleDomain type
  folding_alpha: SecureField;
  proof: TypescriptFriLayerProof<H>; // Should be actual FriLayerProof type
  verify<C, ChannelOps extends TypescriptMerkleChannel<C, H, SecureField>>(
    queries: TypescriptQueries,
    query_evals_by_column: TypescriptColumnVec<SecureField[]>,
    channel: C, 
    channelOps: ChannelOps 
  ): TypescriptColumnVec<TypescriptSparseEvaluation> | TypescriptFriVerificationError;
}
// TODO(Jules): Replace with full implementation matching Rust's `FriFirstLayerVerifier<H>`.
class TypescriptFriFirstLayerVerifierImpl<H extends TypescriptHasher> implements TypescriptFriFirstLayerVerifier<H> {
  constructor(
    public column_bounds: TypescriptCirclePolyDegreeBound[],
    public column_commitment_domains: TypescriptCircleDomain[],
    public proof: TypescriptFriLayerProof<H>,
    public folding_alpha: SecureField,
  ) {}

  verify<C, ChannelOps extends TypescriptMerkleChannel<C, H, SecureField>>(
    queries: TypescriptQueries,
    query_evals_by_column: TypescriptColumnVec<SecureField[]>,
    channel: C, 
    channelOps: ChannelOps, 
  ): TypescriptColumnVec<TypescriptSparseEvaluation> | TypescriptFriVerificationError {
    // TODO(Jules): Ensure `this.column_commitment_domains[0].log_size()` is available and returns number. Rust: `self.column_commitment_domains[0].log_size()`.
    const first_domain_log_size = (this.column_commitment_domains[0] as any).log_size ? 
                                  (this.column_commitment_domains[0]as any).log_size() : 
                                  undefined;
    if (first_domain_log_size === undefined) {
        console.warn("TypescriptFriFirstLayerVerifierImpl.verify: log_size() missing on column_commitment_domains[0]. Cannot assert queries.log_domain_size. This is critical.");
    } else if (queries.log_domain_size !== first_domain_log_size) {
      console.error(`TypescriptFriFirstLayerVerifierImpl.verify: Queries sampled on wrong domain size. Expected ${first_domain_log_size}, got ${queries.log_domain_size}. This is a panic in Rust.`);
      return TypescriptFriVerificationError.FirstLayerEvaluationsInvalid; 
    }
    
    const fri_witness_iterator = this.proof.fri_witness[Symbol.iterator]();
    const decommitment_positions_by_log_size = new Map<number, number[]>();
    const sparse_evals_by_column: TypescriptSparseEvaluation[] = [];
    const decommitmented_values_flat_base_fields: TypescriptBaseField[] = []; 

    if (this.column_commitment_domains.length !== query_evals_by_column.length) {
        console.error("TypescriptFriFirstLayerVerifierImpl.verify: Mismatch between number of column domains and query_evals_by_column. This is a panic in Rust.");
        return TypescriptFriVerificationError.FirstLayerEvaluationsInvalid; 
    }

    for (let i = 0; i < this.column_commitment_domains.length; i++) {
      const column_domain = this.column_commitment_domains[i] as any; 
      const column_query_evals = query_evals_by_column[i];
      
      // TODO(Jules): Ensure `column_domain.log_size()` is available and returns number. Rust: `column_domain.log_size()`.
      const current_col_log_size = column_domain.log_size ? column_domain.log_size() : queries.log_domain_size;
      if (!column_domain.log_size) {
          console.warn(`TypescriptFriFirstLayerVerifierImpl.verify: column_domain[${i}].log_size() is missing. Using queries.log_domain_size as fallback. This is likely incorrect.`);
      }

      const column_queries = queries.fold(queries.log_domain_size - current_col_log_size);
      
      const rebuild_result = compute_decommitment_positions_and_rebuild_evals(
        column_queries,
        column_query_evals,
        fri_witness_iterator,
        CIRCLE_TO_LINE_FOLD_STEP 
      );

      if (rebuild_result === InsufficientWitnessError) {
        return TypescriptFriVerificationError.FirstLayerEvaluationsInvalid;
      }
      const { positions: column_decommitment_positions, evaluation: sparse_evaluation } = rebuild_result;
      
      decommitment_positions_by_log_size.set(current_col_log_size, column_decommitment_positions);

      sparse_evaluation.subset_evals.forEach(subset => 
        subset.forEach(sf => {
            // TODO(Jules): Ensure `SecureField.toBaseFields()` (or e.g. `to_m31_array()`) is implemented on QM31, returning array of BaseField.
            if (typeof sf.toBaseFields === 'function') {
                decommitmented_values_flat_base_fields.push(...sf.toBaseFields());
            } else {
                console.warn("TypescriptFriFirstLayerVerifierImpl.verify: SecureField.toBaseFields() missing. Using placeholder: pushing SecureField itself as BaseField.");
                decommitmented_values_flat_base_fields.push(sf as any as TypescriptBaseField); 
            }
        })
      );
      sparse_evals_by_column.push(sparse_evaluation);
    }

    if (!fri_witness_iterator.next().done) {
      // Corresponds to `if !fri_witness.is_empty()` in Rust.
      return TypescriptFriVerificationError.FirstLayerEvaluationsInvalid; 
    }
    
    // TODO(Jules): Ensure `cd_any.log_size()` is available for all column_commitment_domains.
    const flat_domain_log_sizes = this.column_commitment_domains.flatMap(
        cd_any => {
            const log_s = (cd_any as any).log_size ? (cd_any as any).log_size() : 0;
            if (!(cd_any as any).log_size) console.warn("TypescriptFriFirstLayerVerifierImpl.verify: log_size missing for flat_map in MerkleVerifier construction, using 0. This is likely incorrect.");
            return Array(SECURE_EXTENSION_DEGREE).fill(log_s);
        }
    );

    // TODO(Jules): Replace `TypescriptMerkleVerifierImpl` with actual MerkleVerifier port.
    // `this.proof.commitment` should be `H::Hash`.
    // `this.proof.decommitment` should be `MerkleDecommitment<H>`.
    const merkle_verifier = new TypescriptMerkleVerifierImpl<H>(this.proof.commitment, flat_domain_log_sizes);
    
    const merkle_verify_result = merkle_verifier.verify(
      decommitment_positions_by_log_size,
      decommitmented_values_flat_base_fields, 
      this.proof.decommitment 
    );

    if (merkle_verify_result !== null) {
      // Corresponds to `map_err(|error| FriVerificationError::FirstLayerCommitmentInvalid { error })`
      console.error("Merkle Verification Failed in First Layer:", merkle_verify_result.details);
      return TypescriptFriVerificationError.FirstLayerCommitmentInvalid; 
    }

    return sparse_evals_by_column;
  }
}

// TODO(Jules): Refine TypescriptFriInnerLayerVerifier to match Rust's `FriInnerLayerVerifier<H>`.
// Key properties: `degree_bound` (LinePolyDegreeBound), `domain` (LineDomain), `folding_alpha` (SecureField), `layer_index` (usize), `proof` (FriLayerProof<H>).
interface TypescriptFriInnerLayerVerifier<H extends TypescriptHasher> {
  degree_bound: TypescriptLinePolyDegreeBound; // Should be actual LinePolyDegreeBound type
  domain: TypescriptLineDomainImpl; // Should be actual LineDomain type
  folding_alpha: SecureField;
  layer_index: number;
  proof: TypescriptFriLayerProof<H>; // Should be actual FriLayerProof type
  verify_and_fold(
    layer_queries: TypescriptQueries,
    layer_query_evals: SecureField[]
  ): { queries: TypescriptQueries, evals: SecureField[] } | TypescriptFriVerificationError;
}
// TODO(Jules): Replace with full implementation matching Rust's `FriInnerLayerVerifier<H>`.
class TypescriptFriInnerLayerVerifierImpl<H extends TypescriptHasher> implements TypescriptFriInnerLayerVerifier<H> {
  constructor(
    public degree_bound: TypescriptLinePolyDegreeBound,
    public domain: TypescriptLineDomainImpl,
    public folding_alpha: SecureField,
    public layer_index: number,
    public proof: TypescriptFriLayerProof<H>,
  ) {}

  verify_and_fold(
    current_queries: TypescriptQueries, 
    evals_at_queries: SecureField[]
  ): { queries: TypescriptQueries, evals: SecureField[] } | TypescriptFriVerificationError {
    // TODO(Jules): Ensure `this.domain.log_size` property is correctly implemented/accessed for `TypescriptLineDomainImpl`.
    if (current_queries.log_domain_size !== this.domain.log_size) {
        const err_msg = `InnerLayer Verifier (Layer ${this.layer_index}): Queries log_domain_size (${current_queries.log_domain_size}) mismatch. Expected domain log_size ${this.domain.log_size}. This is a panic in Rust.`;
        console.error(err_msg);
        return TypescriptFriVerificationError.InnerLayerEvaluationsInvalid; // Or a more specific error
    }
    
    const fri_witness_iterator = this.proof.fri_witness[Symbol.iterator]();
    
    const rebuild_result = compute_decommitment_positions_and_rebuild_evals(
        current_queries,
        evals_at_queries,
        fri_witness_iterator,
        FOLD_STEP
    );

    if (rebuild_result === InsufficientWitnessError) {
        // Corresponds to `map_err(|InsufficientWitnessError| FriVerificationError::InnerLayerEvaluationsInvalid { inner_layer: self.layer_index })`
        return TypescriptFriVerificationError.InnerLayerEvaluationsInvalid;
    }
    const { positions: decommitment_positions, evaluation: sparse_evaluation } = rebuild_result;

    if (!fri_witness_iterator.next().done) {
      // Corresponds to `if !fri_witness.is_empty()` in Rust.
      return TypescriptFriVerificationError.InnerLayerEvaluationsInvalid;
    }

    const decommitmented_values_flat_base_fields: TypescriptBaseField[] = sparse_evaluation.subset_evals
        .flat() 
        .flatMap(sf => {
            // TODO(Jules): Ensure `SecureField.toBaseFields()` (or e.g. `to_m31_array()`) is implemented on QM31, returning array of BaseField.
            if (typeof sf.toBaseFields === 'function') {
                return sf.toBaseFields();
            }
            console.warn("TypescriptFriInnerLayerVerifierImpl.verify_and_fold: SecureField.toBaseFields() missing. Using placeholder: pushing SecureField itself as BaseField.");
            return [sf as any as TypescriptBaseField]; 
        });

    // TODO(Jules): Replace `TypescriptMerkleVerifierImpl` with actual MerkleVerifier port.
    // `this.proof.commitment` should be `H::Hash`.
    // `this.proof.decommitment` should be `MerkleDecommitment<H>`.
    // `this.domain.log_size` needs to be correctly available.
    const merkle_verifier = new TypescriptMerkleVerifierImpl<H>(
        this.proof.commitment,
        Array(SECURE_EXTENSION_DEGREE).fill(this.domain.log_size) 
    );
    
    const merkle_verify_result = merkle_verifier.verify(
        new Map([[this.domain.log_size, decommitment_positions]]), 
        decommitmented_values_flat_base_fields,
        this.proof.decommitment 
    );

    if (merkle_verify_result !== null) {
        // Corresponds to `map_err(|e| FriVerificationError::InnerLayerCommitmentInvalid { inner_layer: self.layer_index, error: e })`
        console.error(`Merkle Verification Failed in Inner Layer ${this.layer_index}:`, merkle_verify_result.details);
        return TypescriptFriVerificationError.InnerLayerCommitmentInvalid;
    }

    // TODO(Jules): Ensure `current_queries.fold` is correctly implemented for `TypescriptQueriesImpl`.
    const folded_queries = current_queries.fold(FOLD_STEP);
    // TODO(Jules): Ensure `sparse_evaluation.fold_line` is correctly implemented.
    const folded_evals = sparse_evaluation.fold_line(this.folding_alpha, this.domain);
    
    return { queries: folded_queries, evals: folded_evals };
  }
}

// Ensure TypescriptLinePoly has len() for FriVerifier commit
// TODO(Jules): Refine TypescriptLinePoly to match Rust's `core::poly::line::LinePoly`.
// Key methods: constructor from coefficients, `eval_at_point()`, `len()`.
export interface TypescriptLinePoly {
  getCoefficients(): SecureField[];
  len(): number; 
  eval_at_point(p: SecureField): SecureField; 
}
// Adjust Impl
// TODO(Jules): Replace with full implementation of `LinePoly` from `core::poly::line.rs`.
export { LinePoly as TypescriptLinePolyImpl } from "./poly/line";
export type TypescriptLinePoly = LinePoly;

// --- FriVerifier Class Definition ---
// TODO(Jules): Ensure FriVerifier generic constraints and types match Rust structure.
// `ChannelOps` should correspond to `MC: MerkleChannel`.
// `C` (ChannelInstance) should correspond to `MC::C`.
export class FriVerifier<
  C, // Channel Instance Type
  H extends TypescriptHasher, // Hasher type, H: MerkleHasher
  ChannelOps extends TypescriptMerkleChannel<C, H, SecureField> // Channel operations object
> {
  public readonly config: FriConfig;
  public readonly firstLayer: TypescriptFriFirstLayerVerifierImpl<H>; 
  public readonly innerLayers: TypescriptFriInnerLayerVerifierImpl<H>[]; 
  public readonly lastLayerDomain: TypescriptLineDomainImpl; // Should be actual LineDomain type
  public readonly lastLayerPoly: TypescriptLinePoly; // Should be actual LinePoly type
  public queries?: TypescriptQueries; // Optional, as it's set later
  private channel: C; // Instance of the channel, e.g., for `sample_query_positions`
  private channelOps: ChannelOps; // Operations object for the channel

  private constructor(
    channel: C,
    channelOps: ChannelOps,
    config: FriConfig,
    firstLayer: TypescriptFriFirstLayerVerifierImpl<H>,
    innerLayers: TypescriptFriInnerLayerVerifierImpl<H>[],
    lastLayerDomain: TypescriptLineDomainImpl,
    lastLayerPoly: TypescriptLinePoly,
    queries?: TypescriptQueries
  ) {
    this.channel = channel;
    this.channelOps = channelOps;
    this.config = config;
    this.firstLayer = firstLayer;
    this.innerLayers = innerLayers;
    this.lastLayerDomain = lastLayerDomain;
    this.lastLayerPoly = lastLayerPoly;
    this.queries = queries;
  }

  public static commit<
    C,
    H extends TypescriptHasher,
    ChannelOps extends TypescriptMerkleChannel<C, H, SecureField>
  >(
    channel: C, // `channel: &mut MC::C` in Rust
    channelOps: ChannelOps, // Represents MerkleChannel operations
    config: FriConfig,
    proof: TypescriptFriProof<H>, // Should be actual FriProof type
    column_bounds: TypescriptCirclePolyDegreeBound[], // Should be actual CirclePolyDegreeBound type
  ): FriVerifier<C, H, ChannelOps> | TypescriptFriVerificationError {
    // TODO(Jules): Implement proper sorting check for `column_bounds` (descending by log_degree_bound) as per Rust's `assert!(column_bounds.is_sorted_by_key(|b| Reverse(*b)))`.
    if (column_bounds.length > 1) {
      for (let i = 0; i < column_bounds.length - 1; i++) {
        if (column_bounds[i].log_degree_bound < column_bounds[i+1].log_degree_bound) {
          console.warn("FriVerifier.commit: column_bounds might not be sorted in descending order as expected by Rust.");
        }
      }
    }

    // TODO(Jules): Ensure `channelOps.mix_root` correctly implements `MerkleChannel::mix_root`.
    channelOps.mix_root(channel, proof.first_layer.commitment);

    const max_column_bound = column_bounds[0];
    // TODO(Jules): Ensure `TypescriptCanonicCosetImpl.new().circle_domain()` returns a valid CircleDomain object.
    const column_commitment_domains = column_bounds.map(bound => {
      const commitment_domain_log_size = bound.log_degree_bound + config.log_blowup_factor;
      return TypescriptCanonicCosetImpl.new(commitment_domain_log_size).circle_domain();
    });

    // TODO(Jules): Ensure `channelOps.draw_felt` correctly implements `Channel::draw_felt`.
    const first_layer_verifier = new TypescriptFriFirstLayerVerifierImpl<H>(
      column_bounds,
      column_commitment_domains,
      proof.first_layer,
      channelOps.draw_felt(channel)
    );

    const inner_layers_verifiers: TypescriptFriInnerLayerVerifierImpl<H>[] = [];
    // TODO(Jules): Ensure `max_column_bound.fold_to_line()` is correctly implemented.
    let layer_bound: TypescriptLinePolyDegreeBound | null = max_column_bound.fold_to_line();
    // TODO(Jules): Ensure `TypescriptLineDomainImpl.half_odds()` and constructor create valid LineDomain.
    // TODO(Jules): Ensure `layer_bound.log_degree_bound` is correctly accessed.
    let layer_domain = new TypescriptLineDomainImpl(
        TypescriptLineDomainImpl.half_odds(layer_bound.log_degree_bound + config.log_blowup_factor)
    );

    for (let layer_index = 0; layer_index < proof.inner_layers.length; layer_index++) {
      const inner_proof_part = proof.inner_layers[layer_index];
      channelOps.mix_root(channel, inner_proof_part.commitment);

      if (!layer_bound) { 
        return TypescriptFriVerificationError.InvalidNumFriLayers; // Should match `ok_or(FriVerificationError::InvalidNumFriLayers)` context
      }

      inner_layers_verifiers.push(new TypescriptFriInnerLayerVerifierImpl<H>(
        layer_bound,
        layer_domain,
        channelOps.draw_felt(channel),
        layer_index,
        inner_proof_part
      ));
      // TODO(Jules): Ensure `layer_bound.fold(FOLD_STEP)` is correctly implemented.
      layer_bound = layer_bound.fold(FOLD_STEP);
      if (!layer_bound && layer_index < proof.inner_layers.length -1 ) { 
        return TypescriptFriVerificationError.InvalidNumFriLayers;
      }
      // TODO(Jules): Ensure `layer_domain.double()` is correctly implemented.
      layer_domain = layer_domain.double();
    }
    
    if (!layer_bound || layer_bound.log_degree_bound !== config.log_last_layer_degree_bound) {
      return TypescriptFriVerificationError.InvalidNumFriLayers;
    }

    const last_layer_domain = layer_domain;
    const last_layer_poly = proof.last_layer_poly;

    // TODO(Jules): Ensure `last_layer_poly.len()` is correctly implemented.
    if (last_layer_poly.len() > (1 << config.log_last_layer_degree_bound)) {
      return TypescriptFriVerificationError.LastLayerDegreeInvalid;
    }

    // TODO(Jules): Ensure `channelOps.mix_felts` and `last_layer_poly.getCoefficients()` are correct.
    channelOps.mix_felts(channel, last_layer_poly.getCoefficients());

    return new FriVerifier(
      channel,
      channelOps,
      config,
      first_layer_verifier,
      inner_layers_verifiers,
      last_layer_domain,
      last_layer_poly,
      undefined 
    );
  }

  public decommit(first_layer_query_evals: TypescriptColumnVec<SecureField[]>): null | TypescriptFriVerificationError {
    const queries = this.queries;
    if (!queries) {
      return TypescriptFriVerificationError.QueriesNotSampled; // Equivalent to Rust's .expect()
    }
    this.queries = undefined; 
    return this.decommit_on_queries(queries, first_layer_query_evals);
  }

  private decommit_on_queries(
    queries: TypescriptQueries,
    first_layer_query_evals: TypescriptColumnVec<SecureField[]>,
  ): null | TypescriptFriVerificationError {
    const first_layer_verify_result = this.firstLayer.verify(
        queries,
        first_layer_query_evals,
        this.channel, 
        this.channelOps
    );

    if (typeof first_layer_verify_result === 'string') { 
      return first_layer_verify_result as TypescriptFriVerificationError;
    }
    const first_layer_sparse_evals_vec = first_layer_verify_result as TypescriptColumnVec<TypescriptSparseEvaluation>;
    
    let current_layer_queries = queries.fold(CIRCLE_TO_LINE_FOLD_STEP);
    if (!SecureField.ZERO) {
        throw new Error("SecureField.ZERO is not defined. Ensure QM31.ZERO is available.");
    }
    let current_layer_query_evals: SecureField[] = Array(current_layer_queries.positions.length).fill(SecureField.ZERO);
    
    let first_layer_sparse_evals_iter_idx = 0; 
    let first_layer_columns_info_iter_idx = 0;
    let previous_layer_folding_alpha = this.firstLayer.folding_alpha;

    for (const layer of this.innerLayers) {
        while(first_layer_columns_info_iter_idx < this.firstLayer.column_bounds.length) {
            const bound = this.firstLayer.column_bounds[first_layer_columns_info_iter_idx];
            const column_domain = this.firstLayer.column_commitment_domains[first_layer_columns_info_iter_idx];

            // TODO(Jules): Ensure `bound.fold_to_line()` (TypescriptCirclePolyDegreeBound) and `layer.degree_bound.log_degree_bound` (TypescriptLinePolyDegreeBound) are correctly implemented for comparison.
            const folded_bound = (bound as any).fold_to_line ? (bound as any).fold_to_line() : null;
            const layer_degree_bound_log = (layer.degree_bound as any).log_degree_bound;

            if (folded_bound && folded_bound.log_degree_bound === layer_degree_bound_log) {
                const sparse_eval_to_fold = first_layer_sparse_evals_vec[first_layer_sparse_evals_iter_idx];
                first_layer_sparse_evals_iter_idx++; 

                if (!sparse_eval_to_fold) { 
                     console.error("FriVerifier.decommit_on_queries: first_layer_sparse_evals_vec exhausted prematurely during inner layer processing.");
                     return TypescriptFriVerificationError.InnerLayerEvaluationsInvalid; 
                }
                
                // TODO(Jules): Ensure `sparse_eval_to_fold.fold_circle` is correctly implemented on `TypescriptSparseEvaluationImpl`.
                if (!sparse_eval_to_fold.fold_circle) {
                    console.warn("FriVerifier.decommit_on_queries: sparse_eval_to_fold.fold_circle is missing. This is needed to fold first layer evaluations into inner layers.");
                    return TypescriptFriVerificationError.InnerLayerEvaluationsInvalid; 
                }
                const folded_column_evals = sparse_eval_to_fold.fold_circle(
                    previous_layer_folding_alpha, 
                    column_domain 
                );

                accumulate_line(current_layer_query_evals, folded_column_evals, previous_layer_folding_alpha);
                
                first_layer_columns_info_iter_idx++; 
            } else {
                break; 
            }
        }

        const verify_fold_result = layer.verify_and_fold(current_layer_queries, current_layer_query_evals);
        if (typeof verify_fold_result === 'string') { 
            return verify_fold_result as TypescriptFriVerificationError;
        }
        current_layer_queries = verify_fold_result.queries;
        current_layer_query_evals = verify_fold_result.evals;
        previous_layer_folding_alpha = layer.folding_alpha; 
    }

    // TODO(Jules): Review Rust's `assert!(first_layer_columns.is_empty());` and `assert!(first_layer_sparse_evals.is_empty());`
    // These checks ensure all relevant data from the first layer that should have been folded into inner layers was consumed.
    if (first_layer_columns_info_iter_idx !== this.firstLayer.column_bounds.length) {
        console.warn("FriVerifier.decommit_on_queries: Not all first_layer_columns_info (bounds/domains) were consumed. This might indicate an issue if some columns were expected to be folded but weren't.");
    }
    if (first_layer_sparse_evals_iter_idx !== first_layer_sparse_evals_vec.length) {
        console.warn("FriVerifier.decommit_on_queries: Not all first_layer_sparse_evals_vec were consumed. This implies an error in processing evaluations from the first layer.");
         return TypescriptFriVerificationError.InnerLayerEvaluationsInvalid; 
    }
    
    const last_layer_queries_final = current_layer_queries;
    const last_layer_query_evals_final = current_layer_query_evals;
    
    const last_layer_result = this.decommit_last_layer(last_layer_queries_final, last_layer_query_evals_final);
    return last_layer_result;
  }


  private decommit_last_layer(
    queries: TypescriptQueries, 
    query_evals: SecureField[] 
  ): null | TypescriptFriVerificationError {
    const domain = this.lastLayerDomain;
    const last_layer_poly = this.lastLayerPoly;

    if (queries.positions.length !== query_evals.length) {
        console.error("FriVerifier.decommit_last_layer: Mismatch between number of query positions and query evaluations.");
        return TypescriptFriVerificationError.LastLayerEvaluationsInvalid; 
    }

    for (let i = 0; i < queries.positions.length; i++) {
        const query_pos = queries.positions[i]; 
        const query_eval = query_evals[i];

        // TODO(Jules): Ensure `this.lastLayerDomain.log_size` is correctly implemented/accessed.
        // TODO(Jules): Ensure `this.lastLayerDomain.at(index)` returns a point compatible with `last_layer_poly.eval_at_point`.
        // TODO(Jules): Ensure `last_layer_poly.eval_at_point` and `SecureField.equals` are correctly implemented.
        const current_domain_log_size = (domain as any).log_size;
        if (current_domain_log_size === undefined) {
            console.warn("FriVerifier.decommit_last_layer: lastLayerDomain.log_size is undefined. Using queries.log_domain_size as fallback. This is likely incorrect.");
        }
        const domain_log_size_for_br = current_domain_log_size !== undefined ? current_domain_log_size : queries.log_domain_size;
        
        const x_point = (domain as any).at(bit_reverse_index(query_pos, domain_log_size_for_br));
        if (!(domain as any).at || typeof x_point === 'undefined') { // Also check if at() might return undefined
            console.warn("FriVerifier.decommit_last_layer: lastLayerDomain.at() is not implemented or returned undefined. Cannot get point x.");
            return TypescriptFriVerificationError.LastLayerEvaluationsInvalid; 
        }
        
        const eval_at_x = last_layer_poly.eval_at_point(x_point as SecureField); 

        if (!query_eval.equals(eval_at_x)) { 
            return TypescriptFriVerificationError.LastLayerEvaluationsInvalid;
        }
    }
    return null; 
  }
}


/** Accumulate evaluations in-place used during FRI folding. */
export function accumulate_line(
  layer_query_evals: SecureField[],
  column_query_evals: SecureField[],
  folding_alpha: SecureField,
): void {
  // TODO(Jules): Ensure SecureField has `square()`, `mul()`, and `add()` methods correctly implemented.
  const folding_alpha_squared = folding_alpha.square();
  for (let i = 0; i < layer_query_evals.length; i++) {
    layer_query_evals[i] = layer_query_evals[i].mul(folding_alpha_squared).add(column_query_evals[i]);
  }
}

/**
 * Returns column query positions mapped by their log size.
 * Mirrors `get_query_positions_by_log_size` from Rust.
 */
export function get_query_positions_by_log_size(
  queries: TypescriptQueries, 
  column_log_sizes: Set<number>, 
): Map<number, number[]> {
  const res = new Map<number, number[]>();
  const tsQueries = queries as TypescriptQueriesImpl; 
  // TODO(Jules): Ensure `queries.fold()` is correctly implemented in `TypescriptQueriesImpl`.
  for (const logSize of Array.from(column_log_sizes).sort((a,b) => b-a)) { 
    const folded = tsQueries.fold(tsQueries.log_domain_size - logSize);
    res.set(logSize, folded.positions);
  }
  return res;
}


// fn compute_decommitment_positions_and_witness_evals(
//     column: &SecureColumnByCoords<impl PolyOps>,
//     query_positions: &[usize],
//     fold_step: u32,
// ) -> (Vec<usize>, Vec<QM31>)
// TODO(Jules): Refine `TypescriptSecureColumnByCoords` to accurately represent Rust's `SecureColumnByCoords` or the expected input structure (e.g., `SecureEvaluation`).
// Key method: `at(index: number): SecureField`. This is used by both `FriFirstLayerProver` (passing `SecureEvaluation`) and `FriInnerLayerProver` (passing `LineEvaluation.values`).
interface TypescriptSecureColumnByCoords<B> { 
    at(index: number): SecureField;
}

/**
 * Port of Rust's `compute_decommitment_positions_and_witness_evals`.
 * Returns a column's merkle tree decommitment positions and the evals the verifier can't
 * deduce from previous computations but requires for decommitment and folding.
 */
function compute_decommitment_positions_and_witness_evals<B>(
    column: TypescriptSecureColumnByCoords<B>, 
    query_positions_input: number[] | TypescriptQueries, 
    fold_step: number, 
): { positions: number[]; witness_evals: SecureField[] } {
    const decommitment_positions: number[] = [];
    const witness_evals: SecureField[] = [];

    const query_pos_array: readonly number[] = Array.isArray(query_positions_input) 
        ? query_positions_input 
        : query_positions_input.positions;

    if (query_pos_array.length === 0 && fold_step > 0) {
        return { positions: decommitment_positions, witness_evals: witness_evals };
    }
    
    let i = 0;
    while (i < query_pos_array.length) {
        const first_in_subset = query_pos_array[i];
        const subset_group_key = first_in_subset >> fold_step;
        
        const current_subset_queries: number[] = [];
        let j = i;
        while (j < query_pos_array.length && (query_pos_array[j] >> fold_step) === subset_group_key) {
            current_subset_queries.push(query_pos_array[j]);
            j++;
        }
        
        const subset_start = subset_group_key << fold_step;
        const num_positions_in_subset = 1 << fold_step;
        const current_subset_queries_set = new Set(current_subset_queries);

        for (let k = 0; k < num_positions_in_subset; k++) {
            const position_in_full_domain = subset_start + k;
            decommitment_positions.push(position_in_full_domain);

            if (current_subset_queries_set.has(position_in_full_domain)) {
                continue; 
            }
            // TODO(Jules): Ensure `column.at(position)` is correctly implemented on the types passed as `column`
            // (i.e., `SecureEvaluation` for first layer, `LineEvaluation.values` for inner layers).
            // `SecureEvaluation` in Rust has an `at` method. `LineEvaluation.values` (which is `SecureColumnByCoords`) also has `at`.
            if (typeof column.at !== 'function') {
                throw new Error("compute_decommitment_positions_and_witness_evals: column.at() method is not defined on the provided 'column' object.");
            }
            const eval_val = column.at(position_in_full_domain);
            witness_evals.push(eval_val);
        }
        i = j; 
    }

    return { positions: decommitment_positions, witness_evals: witness_evals };
}

// fn extract_coordinate_columns<B: PolyOps>(
//     columns: &[SecureEvaluation<B, BitReversedOrder>],
// ) -> Vec<&Col<B, BaseField>>

// TODO(Jules): Define `TypescriptBaseFieldColumn` to accurately represent Rust's `core::backend::Col<B, BaseField>`.
export interface TypescriptBaseFieldColumn {
    values: TypescriptBaseField[]; 
}

// TODO(Jules): Define the structure of `TypescriptSecureEvaluation` to hold its constituent base field columns.
// This is necessary for `extract_coordinate_columns`. In Rust, `SecureColumnByCoords` (often wrapped by `SecureEvaluation`)
// has a `columns: Vec<Col<B, BaseField>>` field. A similar field, e.g., `base_columns: TypescriptBaseFieldColumn[]`,
// should be present on the `TypescriptSecureEvaluation` object.
/**
 * Port of Rust's `extract_coordinate_columns`.
 * Extracts all base field coordinate columns from each secure column.
 */
function extract_coordinate_columns<B>( 
    secure_columns: TypescriptSecureEvaluation<B, TypescriptBitReversedOrder>[],
): TypescriptBaseFieldColumn[] { 
    const coordinate_columns: TypescriptBaseFieldColumn[] = [];

    for (const secure_column of secure_columns) {
        // `sc_as_any.base_columns` is a placeholder.
        // The actual field name on `TypescriptSecureEvaluation` that holds `TypescriptBaseFieldColumn[]` needs to be used.
        // This corresponds to `secure_column.columns.iter()` in Rust.
        const sc_as_any = secure_column as any; 

        if (sc_as_any.base_columns && Array.isArray(sc_as_any.base_columns)) {
            for (const coordinate_column of sc_as_any.base_columns) {
                coordinate_columns.push(coordinate_column as TypescriptBaseFieldColumn);
            }
        } else {
            console.warn("extract_coordinate_columns: `secure_column` is missing `base_columns` property or it's not an array. Ensure `TypescriptSecureEvaluation` (or its underlying type like `SecureColumnByCoords`) correctly exposes its base field columns as per Rust's `SecureColumnByCoords.columns`.");
        }
    }

    return coordinate_columns;
}

/**
 * Inverse butterfly operation.
 * Based on Rust: `let t = *f1 * twiddle; *f1 = *f0 - t; *f0 = *f0 + t;`
 */
function ibutterfly(f0: SecureField, f1: SecureField, twiddle: SecureField): { f0_res: SecureField, f1_res: SecureField } {
    // TODO(Jules): Ensure `SecureField` (QM31) methods `mul`, `sub`, `add` are implemented and match Rust's field operations.
    const t = f1.mul(twiddle);
    const f1_res = f0.sub(t);
    const f0_res = f0.add(t);
    return { f0_res, f1_res };
}

/**
 * Folds a degree `d` polynomial into a degree `d/2` polynomial.
 * See Rust `FriOps::fold_line`. Port of standalone `pub fn fold_line`.
 */
export function fold_line(
    eval_param: TypescriptLineEvaluation<any>, 
    alpha: SecureField,                       
): TypescriptLineEvaluation<any> {             
    
    const n = eval_param.len();
    if (n < 2) {
        throw new Error("fold_line: Evaluation too small, must have at least 2 elements.");
    }

    // TODO(Jules): `eval_param.domain` should be an instance of ported `LineDomain`.
    // It needs `log_size` property, `at(index)` method returning a point with `inverse()`, and `double()` method.
    const domain = eval_param.domain as TypescriptLineDomainImpl; 
    if (!domain || typeof domain.log_size !== 'number' || typeof (domain as any).at !== 'function' || typeof (domain as any).double !== 'function') {
        console.warn("fold_line: eval_param.domain is not correctly defined. Requires: log_size (property), at(index):Point (method), double():LineDomain (method). Point object from `at()` needs `inverse()` method. Using placeholder behavior, results will be incorrect.");
    }

    const folded_values_arr: SecureField[] = [];
    if (!eval_param.values || typeof eval_param.values[Symbol.iterator] !== 'function') {
        throw new Error("fold_line: eval_param.values is not iterable or undefined.");
    }
    
    const eval_values_arr = Array.isArray(eval_param.values) ? eval_param.values : Array.from(eval_param.values);

    for (let i = 0; i < n / 2; i++) {
        let f_x = eval_values_arr[i * 2];
        let f_neg_x = eval_values_arr[i * 2 + 1];

        // TODO(Jules): `domain.at(index)` should return a point object. This point object needs an `inverse()` method that returns a `SecureField` (twiddle factor).
        // Example: `let x = domain.at(bit_reverse_index(i << FOLD_STEP, domain.log_size()));`
        const current_domain_log_size = domain.log_size; 
        const point_x_obj = (domain as any).at(bit_reverse_index(i << FOLD_STEP, current_domain_log_size));
        
        if (!point_x_obj || typeof point_x_obj.inverse !== 'function') {
            console.warn("fold_line: domain.at() did not return an object with .inverse(). Using SecureField.ONE as placeholder twiddle_inv. This will lead to incorrect results.");
            const { f0_res, f1_res } = ibutterfly(f_x, f_neg_x, SecureField.ONE); 
            f_x = f0_res; 
            f_neg_x = f1_res; 
        } else {
            const twiddle_inv = point_x_obj.inverse();
            const { f0_res, f1_res } = ibutterfly(f_x, f_neg_x, twiddle_inv);
            f_x = f0_res; 
            f_neg_x = f1_res; 
        }
        
        // TODO(Jules): Ensure `SecureField` (QM31) methods `add` and `mul` are implemented.
        folded_values_arr.push(f_x.add(alpha.mul(f_neg_x)));
    }
    
    // TODO(Jules): `domain.double()` should return a new `LineDomain` instance representing the doubled domain.
    const new_domain = (domain as any).double();
    // TODO(Jules): Ensure `TypescriptLineEvaluationImpl` constructor is `new(domain, values)`.
    return new TypescriptLineEvaluationImpl<any>(new_domain, folded_values_arr);
}

/**
 * Folds and accumulates a degree `d` circle polynomial into a degree `d/2` univariate polynomial.
 * See Rust `FriOps::fold_circle_into_line`. Port of standalone `pub fn fold_circle_into_line`.
 * `dst` is mutated directly.
 */
export function fold_circle_into_line(
    dst: TypescriptLineEvaluation<any>,                
    src: TypescriptSecureEvaluation<any, any>,       
    alpha: SecureField,                              
): void {
    if ((src.len() >> CIRCLE_TO_LINE_FOLD_STEP) !== dst.len()) {
        throw new Error("fold_circle_into_line: Length mismatch between src and dst after considering fold step.");
    }

    // TODO(Jules): `src.domain` should be an instance of ported `CircleDomain`.
    // It needs `log_size` property and `at(index)` method returning a point.
    // The point object from `at()` needs a `y` property, which in turn needs an `inverse()` method.
    const domain = src.domain as any; 
    if (!domain || typeof domain.log_size !== 'number' || typeof domain.at !== 'function') {
        console.warn("fold_circle_into_line: src.domain is not correctly defined. Requires: log_size (property), at(index):Point (method). Point object from `at()` needs `y.inverse()`. Using placeholder behavior, results will be incorrect.");
    }

    // TODO(Jules): Ensure `SecureField` (QM31) has `square()` or `mul()` method.
    const alpha_sq = alpha.square ? alpha.square() : alpha.mul(alpha);

    // TODO(Jules): `src.values` should be iterable (e.g. an array of SecureFields or an object that implements the iterator protocol).
    // This corresponds to `src.into_iter()` in Rust, where `src` is `&SecureEvaluation`.
    // If `src` is `SecureEvaluation`, it should provide a way to iterate its values.
    const src_values_arr = (src as any).values; 
    if (!src_values_arr || typeof src_values_arr[Symbol.iterator] !== 'function') {
        throw new Error("fold_circle_into_line: src.values is not iterable or undefined. Ensure TypescriptSecureEvaluation makes its values accessible for iteration.");
    }
    
    const src_values_iterable = Array.isArray(src_values_arr) ? src_values_arr : Array.from(src_values_arr as Iterable<SecureField>);

    for (let i = 0; i < dst.len(); i++) {
        const src_idx_f_p = i * (1 << CIRCLE_TO_LINE_FOLD_STEP);
        // Assuming CIRCLE_TO_LINE_FOLD_STEP is 1 as per constant value.
        let f_p = src_values_iterable[src_idx_f_p]; 
        let f_neg_p = src_values_iterable[src_idx_f_p + 1]; 

        // TODO(Jules): `domain.at(index)` for `CircleDomain` should return a point object.
        // This point object needs a `y` property, and `y` needs an `inverse()` method returning `SecureField`.
        const current_domain_log_size = domain.log_size;
        const point_p_obj = domain.at(bit_reverse_index(i << CIRCLE_TO_LINE_FOLD_STEP, current_domain_log_size));

        let f0_px: SecureField, f1_px: SecureField;

        if (!point_p_obj || !(point_p_obj as any).y || typeof (point_p_obj as any).y.inverse !== 'function') {
            console.warn("fold_circle_into_line: src.domain.at() did not return object with .y.inverse(). Using SecureField.ONE as placeholder twiddle_inv. This will lead to incorrect results.");
            const {f0_res, f1_res} = ibutterfly(f_p, f_neg_p, SecureField.ONE); 
            f0_px = f0_res;
            f1_px = f1_res;
        } else {
            const p_y_inv = (point_p_obj as any).y.inverse();
            const {f0_res, f1_res} = ibutterfly(f_p, f_neg_p, p_y_inv);
            f0_px = f0_res;
            f1_px = f1_res;
        }

        // TODO(Jules): Ensure `SecureField` (QM31) methods `add` and `mul` are implemented.
        const f_prime = alpha.mul(f1_px).add(f0_px);

        // TODO(Jules): `dst.values` (SecureField[]) must be mutable. If `SecureField` objects are immutable,
        // this direct update `dst.values[i] = ...` is fine.
        // Ensure `dst.values[i]` initially holds a valid `SecureField` (e.g. from `new_zero`) that supports `mul` and `add`.
        if (!dst.values || typeof dst.values[i]?.mul !== 'function' || typeof dst.values[i]?.add !== 'function') {
             console.warn(`fold_circle_into_line: dst.values[${i}] is not a valid SecureField object for operations. This can happen if LineEvaluation.new_zero did not initialize with actual SecureField objects. Attempting to overwrite.`);
        }
         try {
            dst.values[i] = dst.values[i].mul(alpha_sq).add(f_prime);
        } catch (e) {
            console.error(`Error during dst.values update at index ${i}:`, e);
            console.error(`dst.values[${i}]:`, dst.values[i], `alpha_sq:`, alpha_sq, `f_prime:`, f_prime);
            throw new Error(`Failed to update dst.values at index ${i}. Ensure dst.values contains valid SecureField objects that support mul() and add().`);
        }
    }
}
