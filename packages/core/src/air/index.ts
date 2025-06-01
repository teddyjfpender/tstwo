// Re-export all air components
export { Components, ComponentProvers } from './components';
export { PointEvaluationAccumulator, DomainEvaluationAccumulator, ColumnAccumulator } from './accumulator';
export { fixedMaskPoints, shiftedMaskPoints } from './mask';

// Core imports for air functionality
import type { Backend, ColumnOps } from '../backend';
import type { CirclePoint } from '../circle';
import type { BaseField } from '../fields/m31';
import type { SecureField } from '../fields/qm31';
import type { TreeVec } from '../pcs/utils';
import type { CircleEvaluation, CirclePoly } from '../poly/circle';
import type { BitReversedOrder } from '../poly/circle/evaluation';
import type { ColumnVec } from '../fri';
import type { PointEvaluationAccumulator, DomainEvaluationAccumulator } from './accumulator';

/**
 * Arithmetic Intermediate Representation (AIR).
 *
 * An Air instance is assumed to already contain all the information needed to evaluate the
 * constraints. For instance, all interaction elements are assumed to be present in it. Therefore,
 * an AIR is generated only after the initial trace commitment phase.
 * 
 * This is a 1:1 port of the Rust Air trait.
 */
export interface Air {
  components(): Component[];
}

/**
 * Air prover interface that extends Air with backend-specific functionality.
 * 
 * This is a 1:1 port of the Rust AirProver trait.
 */
export interface AirProver<B extends ColumnOps<BaseField>> extends Air {
  componentProvers(): ComponentProver<B>[];
}

/**
 * A component is a set of trace columns of various sizes along with a set of
 * constraints on them.
 * 
 * This is a 1:1 port of the Rust Component trait.
 */
export interface Component<B extends ColumnOps<BaseField> = ColumnOps<BaseField>> {
  nConstraints(): number;

  maxConstraintLogDegreeBound(): number;

  /**
   * Returns the degree bounds of each trace column. The returned TreeVec should be of size
   * `n_interaction_phases`.
   */
  traceLogDegreeBounds(): TreeVec<ColumnVec<number>>;

  /**
   * Returns the mask points for each trace column. The returned TreeVec should be of size
   * `n_interaction_phases`.
   */
  maskPoints(
    point: CirclePoint<SecureField>
  ): TreeVec<ColumnVec<CirclePoint<SecureField>[]>>;

  preprocessedColumnIndices(): ColumnVec<number>;

  /**
   * Evaluates the constraint quotients combination of the component at a point.
   */
  evaluateConstraintQuotientsAtPoint(
    point: CirclePoint<SecureField>,
    mask: TreeVec<ColumnVec<SecureField[]>>,
    evaluationAccumulator: PointEvaluationAccumulator
  ): void;
}

/**
 * Component prover interface that extends Component with backend-specific functionality.
 * 
 * This is a 1:1 port of the Rust ComponentProver trait.
 */
export interface ComponentProver<B extends ColumnOps<BaseField>> extends Component {
  /**
   * Evaluates the constraint quotients of the component on the evaluation domain.
   * Accumulates quotients in `evaluation_accumulator`.
   */
  evaluateConstraintQuotientsOnDomain(
    trace: Trace<B>,
    evaluationAccumulator: DomainEvaluationAccumulator<B>
  ): void;
}

/**
 * The set of polynomials that make up the trace.
 *
 * Each polynomial is stored both in a coefficients, and evaluations form (for efficiency)
 * 
 * This is a 1:1 port of the Rust Trace struct.
 */
export class Trace<B extends ColumnOps<BaseField>> {
  /**
   * Private constructor for API hygiene - use static factory methods instead
   */
  private constructor(
    /** Polynomials for each column. */
    public readonly polys: TreeVec<ColumnVec<CirclePoly<B>>>,
    /** Evaluations for each column (evaluated on their commitment domains). */
    public readonly evals: TreeVec<ColumnVec<CircleEvaluation<B, BaseField, BitReversedOrder>>>
  ) {
    // Validate that polys and evals have the same structure
    if (polys.length !== evals.length) {
      throw new Error('Trace: polys and evals must have the same tree structure');
    }
    
    for (let i = 0; i < polys.length; i++) {
      if (polys.at(i)?.length !== evals.at(i)?.length) {
        throw new Error(`Trace: polys and evals must have the same column structure at tree ${i}`);
      }
    }
  }

  /**
   * Create a new Trace instance with proper validation.
   * 
   * **World-Leading Improvements:**
   * - API hygiene with private constructor
   * - Type safety with structure validation
   * - Clear factory method naming
   */
  static create<B extends ColumnOps<BaseField>>(
    polys: TreeVec<ColumnVec<CirclePoly<B>>>,
    evals: TreeVec<ColumnVec<CircleEvaluation<B, BaseField, BitReversedOrder>>>
  ): Trace<B> {
    return new Trace(polys, evals);
  }
}
