/**
 * SIMD domain operations.
 * 1:1 port of rust-reference/core/backend/simd/domain.rs
 */

import type { CircleDomain } from "../../poly/circle/domain";
import { CirclePoint, M31_CIRCLE_LOG_ORDER } from "../../circle";
import { PackedM31, LOG_N_LANES, N_LANES } from "./m31";
import { M31 } from "../../fields/m31";
import { bitReverseIndex } from "../../utils";

/**
 * Simple point structure for SIMD operations.
 * Represents a packed circle point with PackedM31 coordinates.
 */
export interface PackedCirclePoint {
  x: PackedM31;
  y: PackedM31;
}

/**
 * Iterator for traversing a CircleDomain in bit-reversed order using SIMD operations.
 * TypeScript port of the Rust CircleDomainBitRevIterator.
 */
export class CircleDomainBitRevIterator implements Iterator<PackedCirclePoint> {
  private domain: CircleDomain;
  private i: number;
  private current: PackedCirclePoint;
  private flips: CirclePoint<M31>[];

  constructor(domain: CircleDomain) {
    const logSize = domain.logSize();
    if (logSize < LOG_N_LANES) {
      throw new Error(`Domain too small for SIMD operations: ${logSize} < ${LOG_N_LANES}`);
    }

    this.domain = domain;
    this.i = 0;

    // Initialize current with first N_LANES points in bit-reversed order
    const initialPoints: CirclePoint<M31>[] = [];
    for (let i = 0; i < N_LANES; i++) {
      initialPoints.push(domain.at(bitReverseIndex(i, logSize)));
    }

    this.current = {
      x: PackedM31.fromArray(initialPoints.map(p => p.x)),
      y: PackedM31.fromArray(initialPoints.map(p => p.y))
    };

    // Precompute flip values for efficient iteration
    this.flips = [];
    for (let i = 0; i < logSize - LOG_N_LANES; i++) {
      const prevMul = bitReverseIndex((1 << i) - 1, logSize - LOG_N_LANES);
      const newMul = bitReverseIndex(1 << i, logSize - LOG_N_LANES);
      const flip = domain.halfCoset.step.mul(BigInt(newMul), M31).sub(domain.halfCoset.step.mul(BigInt(prevMul), M31));
      this.flips.push(flip);
    }
  }

  /**
   * Creates a new iterator starting at the given index.
   */
  startAt(i: number): CircleDomainBitRevIterator {
    const newIterator = new CircleDomainBitRevIterator(this.domain);
    newIterator.i = i;

    // Compute current position for the new starting index
    const currentPoints: CirclePoint<M31>[] = [];
    for (let j = 0; j < N_LANES; j++) {
      const index = (i << LOG_N_LANES) + j;
      currentPoints.push(this.domain.at(bitReverseIndex(index, this.domain.logSize())));
    }

    newIterator.current = {
      x: PackedM31.fromArray(currentPoints.map(p => p.x)),
      y: PackedM31.fromArray(currentPoints.map(p => p.y))
    };

    return newIterator;
  }

  /**
   * Iterator interface implementation.
   */
  next(): IteratorResult<PackedCirclePoint> {
    if ((this.i << LOG_N_LANES) >= this.domain.size()) {
      return { done: true, value: undefined };
    }

    const result: PackedCirclePoint = {
      x: this.current.x,
      y: this.current.y
    };

    // Compute the flip for the next iteration
    const trailingOnes = this.countTrailingOnes(this.i);
    if (trailingOnes < this.flips.length) {
      const flip = this.flips[trailingOnes]!;
      
      // Apply flip to current position
      const flipX = PackedM31.broadcast(flip.x);
      const flipY = this.createFlipY(flip.y);
      
      this.current = {
        x: this.current.x.add(flipX),
        y: this.current.y.add(flipY)
      };
    }

    this.i += 1;
    return { done: false, value: result };
  }

  /**
   * Creates the Y flip pattern matching the Rust implementation.
   * Rust uses simd_swizzle to create pattern [flip.y, -flip.y, flip.y, -flip.y, ...]
   */
  private createFlipY(flipY: M31): PackedM31 {
    const negFlipY = flipY.neg();
    const pattern: M31[] = [];
    
    // Create pattern: [flipY, -flipY, flipY, -flipY, ...]
    for (let i = 0; i < N_LANES; i++) {
      pattern.push(i % 2 === 0 ? flipY : negFlipY);
    }
    
    return PackedM31.fromArray(pattern);
  }

  /**
   * Counts trailing ones in the binary representation of n.
   */
  private countTrailingOnes(n: number): number {
    let count = 0;
    while ((n & 1) === 1) {
      count++;
      n >>>= 1;
    }
    return count;
  }

  /**
   * Returns an array of chunks of size 4 from this iterator.
   * Used for processing 4 * N_LANES rows at a time in quotient accumulation.
   */
  arrayChunks(chunkSize: number): Array<[number, PackedCirclePoint[]]> {
    const chunks: Array<[number, PackedCirclePoint[]]> = [];
    let chunkIndex = 0;
    let currentChunk: PackedCirclePoint[] = [];

    let result = this.next();
    while (!result.done) {
      currentChunk.push(result.value);
      
      if (currentChunk.length === chunkSize) {
        chunks.push([chunkIndex, currentChunk]);
        currentChunk = [];
        chunkIndex++;
      }
      
      result = this.next();
    }

    // Add remaining items if any
    if (currentChunk.length > 0) {
      chunks.push([chunkIndex, currentChunk]);
    }

    return chunks;
  }

  /**
   * Converts to an iterable for use with for...of loops.
   */
  [Symbol.iterator](): Iterator<PackedCirclePoint> {
    return this;
  }

  /**
   * Flattens the packed points into individual points.
   * Used for testing and compatibility with CPU implementations.
   */
  flatMap<T>(fn: (point: PackedCirclePoint) => T[]): T[] {
    const results: T[] = [];
    let result = this.next();
    while (!result.done) {
      results.push(...fn(result.value));
      result = this.next();
    }
    return results;
  }

  /**
   * Takes the first n elements from the iterator.
   */
  take(n: number): PackedCirclePoint[] {
    const results: PackedCirclePoint[] = [];
    for (let i = 0; i < n; i++) {
      const result = this.next();
      if (result.done) break;
      results.push(result.value);
    }
    return results;
  }
}

export function placeholder(): void {
  // TODO: Implement SIMD domain functions
} 