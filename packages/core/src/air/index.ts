/*
This is the Rust code from air/mod.rs that needs to be ported to Typescript in this air/index.ts file:
```rs
pub use components::{ComponentProvers, Components};

use self::accumulation::{DomainEvaluationAccumulator, PointEvaluationAccumulator};
use super::backend::Backend;
use super::circle::CirclePoint;
use super::fields::m31::BaseField;
use super::fields::qm31::SecureField;
use super::pcs::TreeVec;
use super::poly::circle::{CircleEvaluation, CirclePoly};
use super::poly::BitReversedOrder;
use super::ColumnVec;

pub mod accumulation;
mod components;
pub mod mask;

/// Arithmetic Intermediate Representation (AIR).
///
/// An Air instance is assumed to already contain all the information needed to evaluate the
/// constraints. For instance, all interaction elements are assumed to be present in it. Therefore,
/// an AIR is generated only after the initial trace commitment phase.
pub trait Air {
    fn components(&self) -> Vec<&dyn Component>;
}

pub trait AirProver<B: Backend>: Air {
    fn component_provers(&self) -> Vec<&dyn ComponentProver<B>>;
}

/// A component is a set of trace columns of various sizes along with a set of
/// constraints on them.
pub trait Component {
    fn n_constraints(&self) -> usize;

    fn max_constraint_log_degree_bound(&self) -> u32;

    /// Returns the degree bounds of each trace column. The returned TreeVec should be of size
    /// `n_interaction_phases`.
    fn trace_log_degree_bounds(&self) -> TreeVec<ColumnVec<u32>>;

    /// Returns the mask points for each trace column. The returned TreeVec should be of size
    /// `n_interaction_phases`.
    fn mask_points(
        &self,
        point: CirclePoint<SecureField>,
    ) -> TreeVec<ColumnVec<Vec<CirclePoint<SecureField>>>>;

    fn preproccessed_column_indices(&self) -> ColumnVec<usize>;

    /// Evaluates the constraint quotients combination of the component at a point.
    fn evaluate_constraint_quotients_at_point(
        &self,
        point: CirclePoint<SecureField>,
        mask: &TreeVec<ColumnVec<Vec<SecureField>>>,
        evaluation_accumulator: &mut PointEvaluationAccumulator,
    );
}

pub trait ComponentProver<B: Backend>: Component {
    /// Evaluates the constraint quotients of the component on the evaluation domain.
    /// Accumulates quotients in `evaluation_accumulator`.
    fn evaluate_constraint_quotients_on_domain(
        &self,
        trace: &Trace<'_, B>,
        evaluation_accumulator: &mut DomainEvaluationAccumulator<B>,
    );
}

/// The set of polynomials that make up the trace.
///
/// Each polynomial is stored both in a coefficients, and evaluations form (for efficiency)
pub struct Trace<'a, B: Backend> {
    /// Polynomials for each column.
    pub polys: TreeVec<ColumnVec<&'a CirclePoly<B>>>,
    /// Evaluations for each column (evaluated on their commitment domains).
    pub evals: TreeVec<ColumnVec<&'a CircleEvaluation<B, BaseField, BitReversedOrder>>>,
}
```
*/

// TODO(Jules): Define TypeScript interfaces or abstract classes corresponding to the Rust traits
// `Air`, `AirProver`, `Component`, `ComponentProver`, and the `Trace` struct.
//
// Task: Define TypeScript interfaces or abstract classes for core AIR (Arithmetic
// Intermediate Representation) structures.
//
// Details:
// - Air interface: Represents the AIR, providing a list of its `Component`s.
//   - `components()`: Component[]
//
// - AirProver interface: Extends `Air` for provers, providing `ComponentProver`s.
//   Will need to be generic over a Backend type `B`.
//   - `component_provers()`: ComponentProver<B>[]
//
// - Component interface: Defines the interface for an AIR component.
//   - `n_constraints()`: number
//   - `max_constraint_log_degree_bound()`: u32
//   - `trace_log_degree_bounds()`: TreeVec<ColumnVec<u32>>
//   - `mask_points(point: CirclePoint<SecureField>)`: TreeVec<ColumnVec<Vec<CirclePoint<SecureField>>>>
//   - `preproccessed_column_indices()`: ColumnVec<usize>  // Note: usize might be just number in TS
//   - `evaluate_constraint_quotients_at_point(point: CirclePoint<SecureField>, mask: TreeVec<ColumnVec<Vec<SecureField>>>, evaluation_accumulator: PointEvaluationAccumulator)`: void
//
// - ComponentProver interface: Extends `Component` for provers. Will need to be
//   generic over a Backend type `B`.
//   - `evaluate_constraint_quotients_on_domain(trace: Trace<B>, evaluation_accumulator: DomainEvaluationAccumulator<B>)`: void
//
// - Trace struct/interface: Represents the execution trace. Will be generic over a
//   Backend type `B`.
//   - `polys`: TreeVec<ColumnVec<CirclePoly<B>>>
//   - `evals`: TreeVec<ColumnVec<CircleEvaluation<B, BaseField, BitReversedOrder>>>
//
// Dependencies:
// - `PointEvaluationAccumulator`, `DomainEvaluationAccumulator` from `core/src/air/accumulator.ts`.
// - `CirclePoint` (likely from `core/src/poly/circle/point.ts` or similar, e.g. `core/src/circle.ts`).
// - `SecureField`, `BaseField` from `core/src/fields/`.
// - `TreeVec`, `ColumnVec` utility types/classes (e.g., from `core/src/pcs/utils.ts` or to be defined).
// - `CirclePoly`, `CircleEvaluation`, `BitReversedOrder` from `core/src/poly/circle/`.
// - A generic `Backend` interface/type will be needed for `AirProver`, `ComponentProver`, and `Trace`.
//
// Goal: Establish the fundamental interfaces for defining and interacting with AIRs and
// their components within the STARK system. These interfaces will be implemented by
// specific AIRs (e.g., for different computations) and used by the prover/verifier logic.
//
// Unification: These interfaces are critical for decoupling the generic STARK machinery
// from specific AIR definitions. The `Components` and `ComponentProvers` structs (to be
// defined in `core/src/air/components.ts`) will consume these interfaces.