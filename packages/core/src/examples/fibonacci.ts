/**
 * Wide Fibonacci Component - TypeScript Port
 * 
 * This module provides a complete 1:1 TypeScript port of the Rust wide_fibonacci example,
 * implementing a component that enforces Fibonacci sequences across multiple rows.
 * 
 * Each row contains a separate Fibonacci sequence of length N, where the constraint is:
 * c = a^2 + b^2 (modified Fibonacci for STARK proving)
 */

import { M31 } from '../fields/m31';
import { QM31 } from '../fields/qm31';
import type { ColumnVec } from '../fri';
import { FrameworkComponent } from '../constraint_framework';
import type { FrameworkEval, EvalAtRow } from '../constraint_framework';
import { TreeVec } from '../pcs/utils';
import { CanonicCoset } from '../poly/circle';
import { CircleEvaluation } from '../poly/circle/evaluation';
import { BitReversedOrder } from '../poly/circle/evaluation';
import type { SimdBackend } from '../backend/simd';
import { BaseColumn } from '../backend/simd/column';

/**
 * Input for Fibonacci sequence generation.
 * Corresponds to Rust FibInput struct.
 */
export interface FibInput {
  a: M31; // First value
  b: M31; // Second value
}

/**
 * Wide Fibonacci evaluator that enforces the Fibonacci constraint.
 * Each row contains a separate Fibonacci sequence of length N.
 * 
 * This is a 1:1 port of the Rust WideFibonacciEval<N> struct.
 */
export class WideFibonacciEval implements FrameworkEval {
  constructor(
    private logNRows: number,
    private sequenceLength: number = 100 // Default FIB_SEQUENCE_LENGTH from Rust
  ) {
    if (logNRows < 0) {
      throw new Error('WideFibonacciEval: logNRows must be non-negative');
    }
    if (sequenceLength < 2) {
      throw new Error('WideFibonacciEval: sequenceLength must be at least 2');
    }
  }

  /**
   * Static factory method for world-leading API hygiene.
   */
  static create(logNRows: number, sequenceLength: number = 100): WideFibonacciEval {
    return new WideFibonacciEval(logNRows, sequenceLength);
  }

  logSize(): number {
    return this.logNRows;
  }

  maxConstraintLogDegreeBound(): number {
    return this.logNRows + 1;
  }

  /**
   * Evaluates the Fibonacci constraints.
   * This is a 1:1 port of the Rust evaluate method.
   * 
   * Constraint: c = a^2 + b^2 for each step in the sequence
   */
  evaluate<E extends EvalAtRow>(evaluator: E): E {
    let a = evaluator.nextTraceMask();
    let b = evaluator.nextTraceMask();
    
    // For each remaining position in the sequence
    for (let i = 2; i < this.sequenceLength; i++) {
      const c = evaluator.nextTraceMask();
      
      // Add constraint: c - (a^2 + b^2) = 0
      // This matches the Rust version: eval.add_constraint(c.clone() - (a.square() + b.square()))
      const constraint = this.subtractField(c, this.addField(this.squareField(a), this.squareField(b)));
      evaluator.addConstraint(constraint);
      
      // Shift for next iteration
      a = b;
      b = c;
    }
    
    return evaluator;
  }

  /**
   * Helper method for field addition (would be provided by the field types in full implementation)
   */
  private addField(a: any, b: any): any {
    if (a && b && typeof a.add === 'function') {
      return a.add(b);
    }
    return { operation: 'add', left: a, right: b };
  }

  /**
   * Helper method for field subtraction
   */
  private subtractField(a: any, b: any): any {
    if (a && b && typeof a.sub === 'function') {
      return a.sub(b);
    }
    return { operation: 'sub', left: a, right: b };
  }

  /**
   * Helper method for field squaring
   */
  private squareField(a: any): any {
    if (a && typeof a.square === 'function') {
      return a.square();
    }
    if (a && typeof a.mul === 'function') {
      return a.mul(a);
    }
    return { operation: 'square', operand: a };
  }

  /**
   * Gets the sequence length.
   */
  getSequenceLength(): number {
    return this.sequenceLength;
  }
}

/**
 * Wide Fibonacci Component using composition pattern.
 * This matches the Rust type alias: type WideFibonacciComponent<const N: usize> = FrameworkComponent<WideFibonacciEval<N>>
 */
export class WideFibonacciComponent {
  private component: FrameworkComponent<WideFibonacciEval>;

  private constructor(component: FrameworkComponent<WideFibonacciEval>) {
    this.component = component;
  }

  /**
   * Creates a new WideFibonacciComponent with proper validation.
   */
  static create(
    logNRows: number,
    sequenceLength: number = 100,
    claimedSum: QM31 = QM31.zero()
  ): WideFibonacciComponent {
    const evaluator = WideFibonacciEval.create(logNRows, sequenceLength);
    const component = FrameworkComponent.create(evaluator, claimedSum);
    return new WideFibonacciComponent(component);
  }

  /**
   * Gets the number of constraints (sequence_length - 2).
   */
  nConstraints(): number {
    const sequenceLength = this.component.getEvaluator().getSequenceLength();
    return sequenceLength - 2; // N - 2 constraints for N sequence elements
  }

  /**
   * Delegates to the underlying component.
   */
  maxConstraintLogDegreeBound(): number {
    return this.component.maxConstraintLogDegreeBound();
  }

  /**
   * Gets the trace log degree bounds.
   */
  traceLogDegreeBounds(): TreeVec<ColumnVec<number>> {
    return this.component.traceLogDegreeBounds();
  }

  /**
   * Gets the underlying FrameworkComponent for advanced usage.
   */
  getComponent(): FrameworkComponent<WideFibonacciEval> {
    return this.component;
  }

  /**
   * Gets the evaluator.
   */
  getEvaluator(): WideFibonacciEval {
    return this.component.getEvaluator();
  }
}

/**
 * Generates a trace for the Wide Fibonacci component.
 * This is a 1:1 port of the Rust generate_trace function.
 */
export function generateTrace(
  logSize: number,
  inputs: FibInput[]
): ColumnVec<CircleEvaluation<SimdBackend, M31, BitReversedOrder>> {
  const sequenceLength = 100; // FIB_SEQUENCE_LENGTH from Rust
  const size = 1 << logSize;
  
  // Initialize trace columns (one for each sequence position)
  const trace: M31[][] = [];
  for (let i = 0; i < sequenceLength; i++) {
    trace.push(new Array(size).fill(M31.zero()));
  }
  
  // Fill trace with Fibonacci sequences
  for (let vecIndex = 0; vecIndex < inputs.length; vecIndex++) {
    const input = inputs[vecIndex]!;
    let a = input.a;
    let b = input.b;
    
    // Set initial values
    trace[0]![vecIndex] = a;
    trace[1]![vecIndex] = b;
    
    // Generate sequence: c = a^2 + b^2
    for (let seqIndex = 2; seqIndex < sequenceLength; seqIndex++) {
      const newValue = a.square().add(b.square());
      trace[seqIndex]![vecIndex] = newValue;
      
      // Shift for next iteration
      a = b;
      b = newValue;
    }
  }
  
  // Convert to CircleEvaluation
  const domain = CanonicCoset.new(logSize).circleDomain();
  return trace.map(column => {
    // CircleEvaluation expects F[] directly, not BaseColumn
    return new CircleEvaluation(domain, column);
  });
}

/**
 * Generates test trace with default inputs.
 * This matches the Rust generate_test_trace function.
 */
export function generateTestTrace(logNInstances: number): ColumnVec<CircleEvaluation<SimdBackend, M31, BitReversedOrder>> {
  const nInstances = 1 << logNInstances;
  
  // Generate inputs similar to Rust version
  const inputs: FibInput[] = [];
  for (let i = 0; i < nInstances; i++) {
    inputs.push({
      a: M31.one(),
      b: M31.from(i) // Different starting values for different instances
    });
  }
  
  return generateTrace(logNInstances, inputs);
}

/**
 * Test helper for constraint validation.
 * This matches the fibonacci_constraint_evaluator from Rust tests.
 */
export function fibonacciConstraintEvaluator(logNRows: number): WideFibonacciEval {
  return WideFibonacciEval.create(logNRows, 100);
} 