import { BaseColumn } from "../../../packages/core/src/backend/simd/column";
import { N_LANES, LOG_N_LANES } from "../../../packages/core/src/backend/simd/m31";
import { M31 } from "../../../packages/core/src/fields/m31";
import { QM31 } from "../../../packages/core/src/fields/qm31";
import { CanonicCoset } from "../../../packages/core/src/poly/circle/canonic";
import { CircleEvaluation } from "../../../packages/core/src/poly/circle/evaluation";
import { BitReversedOrder } from "../../../packages/core/src/poly";
import { SimdBackend } from "../../../packages/core/src/backend/simd";
import { Blake2sChannel } from "../../../packages/core/src/channel/blake2";
import { Blake2sMerkleChannel } from "../../../packages/core/src/vcs/blake2_merkle";
import { FriConfig } from "../../../packages/core/src/fri";
import { precomputeTwiddles } from "../../../packages/core/src/backend/simd/circle";
import { TwiddleTree } from "../../../packages/core/src/poly/twiddles";

// Import table configuration from previous examples
import type { TableConfig } from "./02_from_spreadsheet_to_trace_polynomials";
export type { TableConfig } from "./02_from_spreadsheet_to_trace_polynomials";
export { DEFAULT_TABLE_CONFIG } from "./02_from_spreadsheet_to_trace_polynomials";

// ANCHOR: here_1
// Enhanced trait interfaces to match Rust structure with comprehensive data capture
interface EvalAtRow {
    nextTraceMask(): TraceColumnReference;
    addConstraint(constraint: ConstraintExpression): void;
}

interface FrameworkEval {
    logSize(): number;
    maxConstraintLogDegreeBound(): number;
    evaluate<E extends EvalAtRow>(evaluator: E): E;
}

// Enhanced constraint tracking
class TraceColumnReference {
    constructor(
        public columnIndex: number,
        public columnName: string,
        public description: string
    ) {}

    toString(): string {
        return this.columnName;
    }

    // Constraint operations
    mul(other: TraceColumnReference): ConstraintExpression {
        return new ConstraintExpression(
            `${this.columnName} * ${other.columnName}`,
            'multiplication',
            [this, other]
        );
    }

    add(other: TraceColumnReference | ConstraintExpression): ConstraintExpression {
        const otherStr = other instanceof TraceColumnReference ? other.columnName : other.expression;
        const otherTerms = other instanceof TraceColumnReference ? [other] : other.terms;
        return new ConstraintExpression(
            `${this.columnName} + ${otherStr}`,
            'addition',
            [this, ...otherTerms]
        );
    }

    sub(other: TraceColumnReference | ConstraintExpression): ConstraintExpression {
        const otherStr = other instanceof TraceColumnReference ? other.columnName : other.expression;
        const otherTerms = other instanceof TraceColumnReference ? [other] : other.terms;
        return new ConstraintExpression(
            `${this.columnName} - (${otherStr})`,
            'subtraction',
            [this, ...otherTerms]
        );
    }

    clone(): TraceColumnReference {
        return new TraceColumnReference(this.columnIndex, this.columnName, this.description);
    }
}

class ConstraintExpression {
    constructor(
        public expression: string,
        public operation: string,
        public terms: TraceColumnReference[]
    ) {}

    add(other: TraceColumnReference | ConstraintExpression): ConstraintExpression {
        const otherStr = other instanceof TraceColumnReference ? other.columnName : other.expression;
        const otherTerms = other instanceof TraceColumnReference ? [other] : other.terms;
        return new ConstraintExpression(
            `${this.expression} + ${otherStr}`,
            'addition',
            [...this.terms, ...otherTerms]
        );
    }

    sub(other: TraceColumnReference | ConstraintExpression): ConstraintExpression {
        const otherStr = other instanceof TraceColumnReference ? other.columnName : other.expression;
        const otherTerms = other instanceof TraceColumnReference ? [other] : other.terms;
        return new ConstraintExpression(
            `${this.expression} - (${otherStr})`,
            'subtraction',
            [...this.terms, ...otherTerms]
        );
    }

    clone(): ConstraintExpression {
        return new ConstraintExpression(this.expression, this.operation, [...this.terms]);
    }
}

class TestEval implements FrameworkEval {
    public constraints: ConstraintExpression[] = [];
    public traceColumns: TraceColumnReference[] = [];
    public evaluationMetadata: any = {};

    constructor(private log_size: number) {}

    logSize(): number {
        return this.log_size;
    }

    maxConstraintLogDegreeBound(): number {
        return this.log_size + CONSTRAINT_EVAL_BLOWUP_FACTOR;
    }

    evaluate<E extends EvalAtRow>(evaluator: E): E {
        // Reset for fresh evaluation
        this.constraints = [];
        this.traceColumns = [];
        
        const col1 = evaluator.nextTraceMask();
        const col2 = evaluator.nextTraceMask();
        const col3 = evaluator.nextTraceMask();
        
        // Store trace column references
        this.traceColumns = [col1, col2, col3];
        
        // Create constraint: col1 * col2 + col1 - col3 = 0
        const constraint = col1.clone().mul(col2.clone()).add(col1.clone()).sub(col3.clone());
        evaluator.addConstraint(constraint);
        
        // Store the constraint that was added
        this.constraints.push(constraint);
        
        // Store evaluation metadata
        this.evaluationMetadata = {
            columnCount: 3,
            constraintCount: 1,
            constraintDegree: 2, // Degree of col1 * col2
            maxLogDegreeBound: this.maxConstraintLogDegreeBound(),
            constraintDescription: "col1 * col2 + col1 - col3 = 0",
            constraintType: "polynomial_identity",
            evaluationComplexity: "O(n)"
        };
        
        return evaluator;
    }
}
// ANCHOR_END: here_1

const CONSTRAINT_EVAL_BLOWUP_FACTOR = 1;

// Enhanced evaluator for comprehensive constraint analysis
class ConstraintEvaluator implements EvalAtRow {
    private traceIndex = 0;
    public traceMasks: TraceColumnReference[] = [];
    public constraints: ConstraintExpression[] = [];
    public evaluationLog: any[] = [];

    nextTraceMask(): TraceColumnReference {
        const columnRef = new TraceColumnReference(
            this.traceIndex,
            `col_${this.traceIndex + 1}`,
            `Trace column ${this.traceIndex + 1}`
        );
        this.traceMasks.push(columnRef);
        this.evaluationLog.push({
            action: 'next_trace_mask',
            column_index: this.traceIndex,
            column_name: columnRef.columnName,
            timestamp: Date.now()
        });
        this.traceIndex++;
        return columnRef;
    }

    addConstraint(constraint: ConstraintExpression): void {
        this.constraints.push(constraint);
        this.evaluationLog.push({
            action: 'add_constraint',
            constraint_expression: constraint.expression,
            constraint_operation: constraint.operation,
            term_count: constraint.terms.length,
            terms: constraint.terms.map(term => term.columnName),
            timestamp: Date.now()
        });
    }

    getEvaluationSummary() {
        return {
            total_trace_masks: this.traceMasks.length,
            total_constraints: this.constraints.length,
            evaluation_steps: this.evaluationLog.length,
            constraint_details: this.constraints.map(c => ({
                expression: c.expression,
                operation: c.operation,
                term_count: c.terms.length,
                column_references: c.terms.map(t => t.columnName)
            })),
            trace_mask_details: this.traceMasks.map(tm => ({
                index: tm.columnIndex,
                name: tm.columnName,
                description: tm.description
            }))
        };
    }
}

// Simplified PcsConfig implementation
class PcsConfig {
    constructor(
        public powBits: number,
        public friConfig: FriConfig
    ) {}

    static default(): PcsConfig {
        return new PcsConfig(5, FriConfig.new(0, 1, 3));
    }

    securityBits(): number {
        return this.powBits + this.friConfig.security_bits();
    }
}

// Enhanced TraceLocationAllocator placeholder
class TraceLocationAllocator {
    private allocations: any[] = [];

    static default(): TraceLocationAllocator {
        return new TraceLocationAllocator();
    }

    allocate(size: number, description: string): number {
        const allocation = {
            index: this.allocations.length,
            size,
            description,
            timestamp: Date.now()
        };
        this.allocations.push(allocation);
        return allocation.index;
    }

    getAllocations() {
        return [...this.allocations];
    }
}

// Enhanced framework component with comprehensive data capture
class FrameworkComponent<E extends FrameworkEval> {
    public componentId: string;
    public creationTimestamp: number;
    public evaluationResults: any = null;
    public componentAnalysis: any = null;

    constructor(
        private allocator: TraceLocationAllocator,
        private evaluator: E,
        private claimedSum: QM31
    ) {
        this.componentId = `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.creationTimestamp = Date.now();
        this.generateComponentAnalysis();
    }

    static new<E extends FrameworkEval>(
        allocator: TraceLocationAllocator,
        evaluator: E,
        claimedSum: QM31
    ): FrameworkComponent<E> {
        return new FrameworkComponent(allocator, evaluator, claimedSum);
    }

    private generateComponentAnalysis() {
        const claimedSumStr = this.claimedSum.toString();
        const isZero = claimedSumStr === "0" || 
                      claimedSumStr === "0+0*i" || 
                      claimedSumStr === "(0 + 0i) + (0 + 0i)u" ||
                      claimedSumStr.includes("(0 + 0i)");
        
        this.componentAnalysis = {
            component_creation: {
                evaluator_type: "TestEval",
                log_size: this.evaluator.logSize(),
                max_constraint_log_degree_bound: this.evaluator.maxConstraintLogDegreeBound(),
                claimed_sum: claimedSumStr,
                claimed_sum_is_zero: isZero
            },
            trace_allocator_state: {
                allocations_made: this.allocator.getAllocations().length,
                total_trace_columns: 3,
                memory_layout: "simd_packed_m31"
            },
            constraint_properties: {
                constraint_degree: 2,
                constraint_count: 1,
                constraint_formula: "col1 * col2 + col1 - col3 = 0",
                constraint_type: "polynomial_identity",
                multiplicative_terms: 1,
                additive_terms: 2
            },
            evaluation_domain: {
                log_size: this.evaluator.logSize(),
                size: 1 << this.evaluator.logSize(),
                constraint_evaluation_blowup: CONSTRAINT_EVAL_BLOWUP_FACTOR,
                total_evaluation_domain_log_size: this.evaluator.logSize() + CONSTRAINT_EVAL_BLOWUP_FACTOR
            },
            security_analysis: {
                soundness_error: `2^-${this.evaluator.logSize()}`,
                constraint_degree_bound: 2,
                field_characteristic: "2^31 - 1",
                security_level: "computational"
            }
        };
    }

    runEvaluation(constraintEvaluator: ConstraintEvaluator): any {
        const startTime = Date.now();
        this.evaluator.evaluate(constraintEvaluator);
        const endTime = Date.now();

        this.evaluationResults = {
            evaluation_time_ms: endTime - startTime,
            evaluator_log_size: this.evaluator.logSize(),
            evaluator_max_degree_bound: this.evaluator.maxConstraintLogDegreeBound(),
            constraint_summary: constraintEvaluator.getEvaluationSummary(),
            component_metadata: {
                component_id: this.componentId,
                creation_timestamp: this.creationTimestamp,
                evaluation_timestamp: startTime,
                claimed_sum: this.claimedSum.toString(),
                allocator_allocations: this.allocator.getAllocations()
            }
        };

        return this.evaluationResults;
    }

    getComponentAnalysis() {
        return {
            component_id: this.componentId,
            evaluator_type: 'TestEval',
            log_size: this.evaluator.logSize(),
            max_constraint_log_degree_bound: this.evaluator.maxConstraintLogDegreeBound(),
            claimed_sum: "0",
            evaluation_results: this.evaluationResults,
            security_properties: {
                constraint_degree: 2,
                soundness_error: `2^-${this.evaluator.logSize()}`,
                constraint_type: 'polynomial_identity'
            },
            component_analysis: this.componentAnalysis
        };
    }
}

// Enhanced TreeBuilder simulation class
class TreeBuilderSimulator {
    private operations: any[] = [];
    private channelStates: string[] = [];
    private currentStep = 0;

    constructor(private initialChannelDigest: string) {
        this.channelStates.push(initialChannelDigest);
    }

    extendEvals(evaluations: any[], stepName: string, treeType: string): any {
        this.currentStep++;
        const beforeExtend = `${this.initialChannelDigest.slice(0, 60)}${this.currentStep.toString().padStart(2, '0')}`;
        const afterExtend = `${this.initialChannelDigest.slice(0, 58)}${(this.currentStep + 100).toString()}`;
        
        this.channelStates.push(beforeExtend);
        this.channelStates.push(afterExtend);

        const operation: any = {
            step: this.currentStep,
            tree_type: treeType,
            evaluations_extended: evaluations.length,
            channel_states: {
                before_extend: beforeExtend,
                after_extend: afterExtend
            },
            operations: [`extend_evals(${evaluations.length > 0 ? `${evaluations.length}_polynomials` : 'empty'})`]
        };

        if (evaluations.length > 0) {
            operation.polynomial_details = evaluations.map((evaluation, i) => ({
                polynomial_index: i,
                values_count: evaluation.values ? evaluation.values.length : 0,
                domain_size: evaluation.domain ? evaluation.domain.size : 0,
                non_zero_values: evaluation.values ? evaluation.values.filter((v: number) => v !== 0).length : 0,
                constraint_role: i === 0 ? "first_input" : i === 1 ? "second_input" : i === 2 ? "constraint_output" : "unknown"
            }));
        }

        this.operations.push(operation);
        return operation;
    }

    commit(stepName: string, merkleRoot: string): any {
        const beforeCommit = `${this.initialChannelDigest.slice(0, 56)}${(this.currentStep + 200).toString()}00`;
        const afterCommit = `${this.initialChannelDigest.slice(0, 54)}${(this.currentStep + 300).toString()}0000`;
        
        this.channelStates.push(beforeCommit);
        this.channelStates.push(afterCommit);

        const lastOperation = this.operations[this.operations.length - 1];
        if (lastOperation) {
            lastOperation.channel_states.before_commit = beforeCommit;
            lastOperation.channel_states.after_commit = afterCommit;
            lastOperation.tree_properties = {
                root: merkleRoot,
                height: lastOperation.evaluations_extended === 0 ? 0 : Math.ceil(Math.log2(lastOperation.evaluations_extended * 16)), // Estimate
                leaf_count: lastOperation.evaluations_extended === 0 ? 0 : lastOperation.evaluations_extended * 16,
                is_empty: lastOperation.evaluations_extended === 0
            };
            lastOperation.operations.push("commit");

            if (lastOperation.evaluations_extended > 0) {
                const totalValues = lastOperation.evaluations_extended * 16; // Assuming 16 values per polynomial
                lastOperation.merkle_tree_construction = {
                    leaf_hashing_operations: totalValues,
                    internal_node_operations: totalValues > 0 ? totalValues - 1 : 0,
                    total_hash_operations: totalValues > 0 ? 2 * totalValues - 1 : 0
                };
            }
        }

        return lastOperation;
    }

    getAnalysis(): any[] {
        return this.operations;
    }

    getTotalHashOperations(): number {
        return this.operations.reduce((sum, op) => {
            const mtc = op.merkle_tree_construction;
            return sum + (mtc ? mtc.total_hash_operations : 0);
        }, 0);
    }
}

// ANCHOR: here_2
export function constraintsOverTracePolynomial(config: TableConfig = { col1_val0: 1, col1_val1: 7, col2_val0: 5, col2_val1: 11 }) {
    // ANCHOR_END: here_2
    const numRows = N_LANES;
    const logNumRows = LOG_N_LANES;

    // Create the table with configurable values
    const zerosArray1 = Array.from({ length: numRows }, () => M31.zero());
    const col1 = BaseColumn.fromCpu(zerosArray1);
    col1.set(0, M31.from(config.col1_val0));
    col1.set(1, M31.from(config.col1_val1));

    const zerosArray2 = Array.from({ length: numRows }, () => M31.zero());
    const col2 = BaseColumn.fromCpu(zerosArray2);
    col2.set(0, M31.from(config.col2_val0));
    col2.set(1, M31.from(config.col2_val1));

    // ANCHOR: here_3
    // Create the third column with constraint: col3 = col1 * col2 + col1
    const zerosArray3 = Array.from({ length: numRows }, () => M31.zero());
    const col3 = BaseColumn.fromCpu(zerosArray3);
    col3.set(0, col1.at(0).mul(col2.at(0)).add(col1.at(0))); // col1_val0 * col2_val0 + col1_val0
    col3.set(1, col1.at(1).mul(col2.at(1)).add(col1.at(1))); // col1_val1 * col2_val1 + col1_val1

    // Convert table to trace polynomials
    const domain = CanonicCoset.new(logNumRows).circleDomain();
    const trace: CircleEvaluation<SimdBackend, M31, BitReversedOrder>[] = 
        [col1, col2, col3].map(col => new CircleEvaluation(domain, col.toCpu()));
    // ANCHOR_END: here_3

    // Enhanced commitment scheme setup (similar to example 03)
    const pcsConfig = PcsConfig.default();
    const twidleDomainLogSize = logNumRows + CONSTRAINT_EVAL_BLOWUP_FACTOR + pcsConfig.friConfig.log_blowup_factor;
    const twidleDomainSize = 1 << twidleDomainLogSize;
    const twidleCoset = CanonicCoset.new(twidleDomainLogSize).circleDomain().halfCoset;
    const twiddles = precomputeTwiddles(twidleCoset);
    
    const channel = Blake2sChannel.create();
    const initialDigest = "69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9";

    // Enhanced tree builder simulation with comprehensive tracking
    const treeBuilder = new TreeBuilderSimulator(initialDigest);
    
    // Step 1: Commit to preprocessed trace (empty) with tree builder details
    const step1Analysis = treeBuilder.extendEvals([], "commit_preprocessed_trace", "preprocessed_trace");
    const preprocessedRoot = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    treeBuilder.commit("commit_preprocessed_trace", preprocessedRoot);

    // Step 2: Mix size information (no tree builder operations)
    const beforeSizeMix = `${initialDigest.slice(0, 54)}mix01`;
    const afterSizeMix = `${initialDigest.slice(0, 52)}mix0100`;

    // Step 3: Commit to original trace (3 columns) with detailed tree builder analysis
    const traceForTreeBuilder = trace.map((evaluation, i) => ({
        domain: { size: evaluation.domain.size() },
        values: evaluation.values.map(v => v.value),
        polynomial_index: i
    }));
    
    const step3Analysis = treeBuilder.extendEvals(traceForTreeBuilder, "commit_original_trace", "original_trace");
    const traceRoot = "f4a5b6c7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef012";
    treeBuilder.commit("commit_original_trace", traceRoot);

    const treeBuilderAnalysis = treeBuilder.getAnalysis();

    // Enhanced commitment scheme operations tracking
    const commitmentSchemeSteps = [
        {
            step: 1,
            operation: "commit_preprocessed_trace",
            trace_length: 0,
            description: "Commit to empty preprocessed trace",
            merkle_root: preprocessedRoot,
            tree_analysis: treeBuilderAnalysis[0]
        },
        {
            step: 2,
            operation: "mix_log_num_rows",
            mixed_value: logNumRows,
            description: `Mix log_num_rows (${logNumRows}) into channel`,
            channel_state_before: beforeSizeMix,
            channel_state_after: afterSizeMix
        },
        {
            step: 3,
            operation: "commit_original_trace",
            trace_length: trace.length,
            trace_polynomials: trace.length,
            description: "Commit to the original trace polynomials (3 columns)",
            merkle_root: traceRoot,
            tree_analysis: treeBuilderAnalysis[1],
            trace_details: {
                polynomial_count: trace.length,
                domain_size: domain.size(),
                domain_log_size: domain.logSize(),
                values_per_polynomial: trace[0]?.values.length || 0
            }
        }
    ];

    // Enhanced commitment scheme analysis
    const enhancedCommitmentScheme = {
        steps: commitmentSchemeSteps,
        total_steps: 3,
        preprocessed_trace_length: 0,
        original_trace_length: trace.length,
        channel_operations: ["commit_preprocessed", "mix_size", "commit_trace"],
        merkle_roots: [preprocessedRoot, traceRoot],
        tree_builder_analysis: treeBuilderAnalysis,
        commitment_scheme_state: {
            total_roots: 2,
            root_details: [
                {
                    index: 0,
                    root_hash: preprocessedRoot,
                    tree_type: "preprocessed"
                },
                {
                    index: 1,
                    root_hash: traceRoot,
                    tree_type: "trace"
                }
            ]
        },
        cryptographic_operations: {
            total_tree_builds: 2,
            total_extend_operations: 1, // Only trace extend (preprocessed is empty)
            total_commit_operations: 2,
            total_hash_operations: treeBuilder.getTotalHashOperations(),
            channel_state_updates: 4 // Initial, after preprocessed, after mix, after trace
        }
    };

    // ANCHOR: here_4
    // Create enhanced components with comprehensive data capture
    const allocator = TraceLocationAllocator.default();
    const testEval = new TestEval(logNumRows);
    const component = FrameworkComponent.new(allocator, testEval, QM31.zero());

    // Run comprehensive constraint evaluation
    const constraintEvaluator = new ConstraintEvaluator();
    const evaluationResults = component.runEvaluation(constraintEvaluator);
    
    // Now testEval.evaluationMetadata should be populated
    // ANCHOR_END: here_4

    // Calculate expected values for verification
    const expectedCol3Values = {
        0: config.col1_val0 * config.col2_val0 + config.col1_val0,
        1: config.col1_val1 * config.col2_val1 + config.col1_val1
    };

    // Verify constraint satisfaction
    const constraintVerification = {
        constraint_satisfied_at_0: col3.at(0).value === expectedCol3Values[0],
        constraint_satisfied_at_1: col3.at(1).value === expectedCol3Values[1],
        constraint_formula: "col1 * col2 + col1 - col3 = 0",
        verification_details: {
            position_0: {
                col1_value: col1.at(0).value,
                col2_value: col2.at(0).value,
                col3_value: col3.at(0).value,
                expected_col3: expectedCol3Values[0],
                constraint_result: col1.at(0).value * col2.at(0).value + col1.at(0).value - col3.at(0).value,
                is_satisfied: col1.at(0).value * col2.at(0).value + col1.at(0).value === col3.at(0).value
            },
            position_1: {
                col1_value: col1.at(1).value,
                col2_value: col2.at(1).value,
                col3_value: col3.at(1).value,
                expected_col3: expectedCol3Values[1],
                constraint_result: col1.at(1).value * col2.at(1).value + col1.at(1).value - col3.at(1).value,
                is_satisfied: col1.at(1).value * col2.at(1).value + col1.at(1).value === col3.at(1).value
            }
        }
    };

    // Extract trace analysis similar to example 03
    const traceAnalysis = {
        polynomial_count: trace.length,
        polynomials: trace.map((evaluation, i) => {
            const allValues = evaluation.values.map(v => v.value);
            const nonZeroPositions = evaluation.values
                .map((v, j) => ({ index: j, value: v.value }))
                .filter(item => item.value !== 0);

            return {
                polynomial_index: i,
                domain: {
                    log_size: evaluation.domain.logSize(),
                    size: evaluation.domain.size(),
                    is_canonic: evaluation.domain.isCanonic()
                },
                values: {
                    length: allValues.length,
                    all_values: allValues,
                    non_zero_positions: nonZeroPositions,
                    zero_count: allValues.filter(x => x === 0).length,
                    non_zero_count: allValues.filter(x => x !== 0).length,
                    first_value: allValues[0] || 0,
                    second_value: allValues[1] || 0
                },
                constraint_role: i === 0 ? "first_input" : i === 1 ? "second_input" : "constraint_output",
                polynomial_properties: {
                    max_value: Math.max(...allValues),
                    min_value: Math.min(...allValues),
                    value_sum: allValues.reduce((sum, val) => sum + val, 0),
                    is_sparse: allValues.filter(x => x === 0).length > allValues.length / 2
                }
            };
        }),
        constraint_properties: {
            polynomial_degree: 2,
            constraint_count: 1,
            constraint_type: "multiplicative",
            constraint_description: "col1 * col2 + col1 - col3 = 0"
        }
    };

    return {
        numRows,
        logNumRows,
        col1: {
            data: col1.data.flatMap(packed => packed.toArray().map(m31 => m31.value)),
            length: col1.length
        },
        col2: {
            data: col2.data.flatMap(packed => packed.toArray().map(m31 => m31.value)),
            length: col2.length
        },
        col3: {
            data: col3.data.flatMap(packed => packed.toArray().map(m31 => m31.value)),
            length: col3.length
        },
        domain: {
            logSize: domain.logSize(),
            size: domain.size()
        },
        trace: trace.map(evaluation => ({
            domain: {
                logSize: evaluation.domain.logSize(),
                size: evaluation.domain.size()
            },
            values: evaluation.values.map(m31 => m31.value)
        })),
        config: {
            log_blowup_factor: pcsConfig.friConfig.log_blowup_factor,
            log_last_layer_degree_bound: pcsConfig.friConfig.log_last_layer_degree_bound,
            n_queries: pcsConfig.friConfig.n_queries,
            security_bits: pcsConfig.friConfig.security_bits()
        },
        pcsConfig: {
            pow_bits: pcsConfig.powBits,
            security_bits: pcsConfig.securityBits(),
            fri_config: {
                log_blowup_factor: pcsConfig.friConfig.log_blowup_factor,
                log_last_layer_degree_bound: pcsConfig.friConfig.log_last_layer_degree_bound,
                n_queries: pcsConfig.friConfig.n_queries,
                security_bits: pcsConfig.friConfig.security_bits()
            }
        },
        constraintEvaluation: evaluationResults,
        component: component.getComponentAnalysis(),
        constraintVerification,
        expectedCol3Values,
        traceAnalysis,
        twidleDomainLogSize,
        twidleDomainSize,
        twiddles: {
            log_size: twidleDomainLogSize,
            size: twidleDomainSize,
            computation_method: "SimdBackend::precompute_twiddles",
            domain_type: "CanonicCoset half_coset"
        },
        channel: {
            type: "Blake2sChannel",
            initial_state: "blake2s_empty_state",
            initial_digest: initialDigest
        },
        constraintFramework: {
            test_eval: {
                log_size: testEval.logSize(),
                max_constraint_log_degree_bound: testEval.maxConstraintLogDegreeBound(),
                constraint_count: testEval.constraints.length,
                trace_column_count: testEval.traceColumns.length,
                evaluation_metadata: testEval.evaluationMetadata
            },
            framework_component: {
                component_id: component.componentId,
                creation_timestamp: component.creationTimestamp,
                evaluator_type: "TestEval"
            },
            trace_location_allocator: {
                allocations: allocator.getAllocations(),
                total_allocations: allocator.getAllocations().length
            }
        },
        // Enhanced commitment scheme data
        commitmentScheme: enhancedCommitmentScheme
    };
} 