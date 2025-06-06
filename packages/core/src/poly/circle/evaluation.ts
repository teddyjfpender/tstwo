// Core circle polynomial structures.
import type { CircleDomain } from "./domain";
import type { CirclePoly } from "./poly";
import type { PolyOps } from "./ops";
import type { ColumnOps, Column } from "../../backend";
import { TwiddleTree } from "../twiddles";
import { M31 } from "../../fields"; // Import M31 type

/**
 * Below is the evaluation.rs file that needs to be ported. The TypeScript version
 * defines generic circle evaluation logic operating over a backend `B` and field `F`.
 */

/**
 * Order types for evaluation domains
 */
export class NaturalOrder {}
export class BitReversedOrder {}

/**
 * Simple column wrapper for F[] arrays to work with ColumnOps interface
 */
export class ArrayColumn<F> implements Column<F> {
  constructor(private data: F[]) {}
  
  zeros(len: number): Column<F> {
    throw new Error("Not implemented");
  }
  
  uninitialized(len: number): Column<F> {
    throw new Error("Not implemented");
  }
  
  toCpu(): F[] {
    return [...this.data];
  }
  
  len(): number {
    return this.data.length;
  }
  
  isEmpty(): boolean {
    return this.data.length === 0;
  }
  
  at(index: number): F {
    return this.data[index]!;
  }
  
  set(index: number, value: F): void {
    this.data[index] = value;
  }
}

/**
 * Default implementation of column operations
 */
export class DefaultColumnOps<F> implements ColumnOps<F> {
  bitReverseColumn(col: Column<F>): void {
    // Basic implementation - can be overridden by specific backends
    const values = col.toCpu();
    const n = values.length;
    
    // Check if n is a power of 2 using bit manipulation
    if (n === 0 || (n & (n - 1)) !== 0) {
      throw new Error("Column length must be a power of 2");
    }
    
    const logN = Math.log2(n);
    
    // Bit-reverse permutation
    for (let i = 0; i < n; i++) {
      const j = this.bitReverseIndex(i, logN);
      if (i < j) {
        // Use non-null assertion to handle type safety concerns
        const temp = values[i]!;
        values[i] = values[j]!;
        values[j] = temp;
      }
    }
    
    // Update the column with bit-reversed values
    for (let i = 0; i < n; i++) {
      col.set(i, values[i]!);
    }
  }
  
  private bitReverseIndex(idx: number, logSize: number): number {
    let rev = 0;
    for (let i = 0; i < logSize; i++) {
      rev = (rev << 1) | (idx & 1);
      idx >>>= 1;
    }
    return rev;
  }
}

export class CircleEvaluation<B extends ColumnOps<F>, F, EvalOrder = NaturalOrder> {
  domain: CircleDomain;
  values: F[];
  private backend: B;

  private _evalOrder!: EvalOrder;

  constructor(domain: CircleDomain, values: F[], backend?: B) {
    if (domain.size() !== values.length) {
      throw new Error("CircleEvaluation: domain/values size mismatch");
    }
    this.domain = domain;
    this.values = values;
    this.backend = backend || (new DefaultColumnOps<F>() as unknown as B);
  }

  static new<B extends ColumnOps<F>, F, E = NaturalOrder>(
    domain: CircleDomain,
    values: F[],
    backend?: B
  ): CircleEvaluation<B, F, E> {
    return new CircleEvaluation<B, F, E>(domain, values, backend);
  }

  bitReverse(this: CircleEvaluation<B, F, NaturalOrder>): CircleEvaluation<B, F, BitReversedOrder> {
    const newValues = [...this.values];
    const arrayColumn = new ArrayColumn(newValues);
    this.backend.bitReverseColumn(arrayColumn);
    const Constructor = this.constructor as any;
    return new Constructor(this.domain, newValues, this.backend);
  }

  bitReverseBack(this: CircleEvaluation<B, F, BitReversedOrder>): CircleEvaluation<B, F, NaturalOrder> {
    const newValues = [...this.values];
    const arrayColumn = new ArrayColumn(newValues);
    this.backend.bitReverseColumn(arrayColumn);
    const Constructor = this.constructor as any;
    return new Constructor(this.domain, newValues, this.backend);
  }

  interpolate(this: CircleEvaluation<any, any, BitReversedOrder>): any {
    const BClass: any = this.constructor;
    const coset = this.domain.halfCoset;
    
    if (typeof BClass.precomputeTwiddles === 'function' && typeof BClass.interpolate === 'function') {
      const twiddles = BClass.precomputeTwiddles(coset);
      return BClass.interpolate(this, twiddles);
    }
    
    // Fallback behavior
    return { 
      coeffs: this.values, 
      logSize: () => Math.log2(this.values.length) 
    };
  }

  interpolateWithTwiddles(this: CircleEvaluation<any, any, BitReversedOrder>, twiddles: any): any {
    const BClass: any = this.constructor;
    
    if (typeof BClass.interpolate === 'function') {
      return BClass.interpolate(this, twiddles);
    }
    
    // Fallback behavior
    return { 
      coeffs: this.values, 
      logSize: () => Math.log2(this.values.length) 
    };
  }

  toCpu(this: CircleEvaluation<any, F, EvalOrder>): CircleEvaluation<any, F, EvalOrder> {
    const BClass: any = this.constructor;
    const cpuValues = BClass.to_cpu ? BClass.to_cpu(this.values) : this.values;
    return CircleEvaluation.new<any, F, EvalOrder>(this.domain, cpuValues);
  }

  deref(): F[] {
    return this.values;
  }
}

/**
 * A sub-evaluation referencing a subset of the values.
 */
export class CosetSubEvaluation<F> {
  constructor(private evaluation: F[], private offset: number, private step: number) {}

  at(index: number): F {
    const idx = (this.offset + index * this.step) & (this.evaluation.length - 1);
    // Use non-null assertion to handle type safety
    return this.evaluation[idx]!;
  }

  // Array indexer helpers
  get(index: number): F {
    return this.at(index);
  }
}