/**
 * Utility functions used across the core package.
 */

/**
 * Returns the bit reversed index of `idx` with respect to a domain of size
 * `2^logSize`.
 *
 * This mirrors the typical implementation in Rust where the bits of `idx` are
 * reversed up to `logSize` bits. Useful for converting between natural and
 * bit-reversed orderings when performing FFTs.
 */
import type { Field } from "./fields";

export function bitReverseIndex(idx: number, logSize: number): number {
  let rev = 0;
  for (let i = 0; i < logSize; i++) {
    rev = (rev << 1) | (idx & 1);
    idx >>>= 1;
  }
  return rev;
}

/**
 * Iterator extension trait for mutable references
 */
export interface IteratorMutExt<T> {
  assign(other: Iterable<T>): void;
}

/**
 * Implementation of IteratorMutExt for any iterator of mutable references
 */
export function implementIteratorMutExt<T extends object>(iterator: IterableIterator<T>): IteratorMutExt<T> {
  return {
    assign(other: Iterable<T>): void {
      const otherIterator = other[Symbol.iterator]();
      for (const item of iterator) {
        const otherItem = otherIterator.next();
        if (otherItem.done) break;
        Object.assign(item, otherItem.value);
      }
    }
  };
}

/**
 * PeekTakeWhile iterator implementation
 */
export class PeekTakeWhile<T, I extends Iterator<T>, P extends (item: T) => boolean> implements Iterator<T> {
  constructor(
    private iter: I,
    private predicate: P
  ) {}

  next(): IteratorResult<T> {
    const next = this.iter.next();
    if (next.done || !this.predicate(next.value)) {
      return { done: true, value: undefined as unknown as T };
    }
    return next;
  }

  [Symbol.iterator](): Iterator<T> {
    return this;
  }
}

/**
 * Extension trait for Peekable iterators
 */
export interface PeekableExt<T, I extends Iterator<T>> {
  peekTakeWhile<P extends (item: T) => boolean>(predicate: P): PeekTakeWhile<T, I, P>;
}

/**
 * Implementation of PeekableExt for any iterator
 */
export function implementPeekableExt<T, I extends Iterator<T>>(iterator: I): PeekableExt<T, I> {
  return {
    peekTakeWhile<P extends (item: T) => boolean>(predicate: P): PeekTakeWhile<T, I, P> {
      return new PeekTakeWhile(iterator, predicate);
    }
  };
}

/**
 * Returns the bit reversed index of `i` which is represented by `log_size` bits.
 */
export function bitReverseIndexConst(i: number, logSize: number): number {
  if (logSize === 0) return i;
  return bitReverseIndex(i, logSize);
}

/**
 * Returns the index of the previous element in a bit reversed CircleEvaluation
 */
export function previousBitReversedCircleDomainIndex(
  i: number,
  domainLogSize: number,
  evalLogSize: number
): number {
  return offsetBitReversedCircleDomainIndex(i, domainLogSize, evalLogSize, -1);
}

/**
 * Returns the index of the offset element in a bit reversed CircleEvaluation
 */
export function offsetBitReversedCircleDomainIndex(
  i: number,
  domainLogSize: number,
  evalLogSize: number,
  offset: number
): number {
  let prevIndex = bitReverseIndex(i, evalLogSize);
  const halfSize = 1 << (evalLogSize - 1);
  const stepSize = offset * (1 << (evalLogSize - domainLogSize - 1));
  
  if (prevIndex < halfSize) {
    prevIndex = ((prevIndex + stepSize) % halfSize + halfSize) % halfSize;
  } else {
    prevIndex = ((prevIndex - stepSize) % halfSize + halfSize) % halfSize + halfSize;
  }
  
  return bitReverseIndex(prevIndex, evalLogSize);
}

/**
 * Converts circle domain order to coset order
 */
export function circleDomainOrderToCosetOrder<T>(values: T[]): T[] {
  const n = values.length;
  const cosetOrder: T[] = [];
  for (let i = 0; i < n / 2; i++) {
    cosetOrder.push(values[i]!);
    cosetOrder.push(values[n - 1 - i]!);
  }
  return cosetOrder;
}

/**
 * Converts coset order to circle domain order
 */
export function cosetOrderToCircleDomainOrder<T>(values: T[]): T[] {
  const circleDomainOrder: T[] = [];
  const n = values.length;
  const halfLen = n / 2;
  
  for (let i = 0; i < halfLen; i++) {
    circleDomainOrder.push(values[i << 1]!);
  }
  for (let i = 0; i < halfLen; i++) {
    circleDomainOrder.push(values[n - 1 - (i << 1)]!);
  }
  return circleDomainOrder;
}

/**
 * Converts an index within a CircleDomain to the corresponding index in a Coset
 */
export function circleDomainIndexToCosetIndex(
  circleIndex: number,
  logDomainSize: number
): number {
  const n = 1 << logDomainSize;
  if (circleIndex < n / 2) {
    return circleIndex * 2;
  }
  return (n - 1 - circleIndex) * 2 + 1;
}

/**
 * Converts an index within a Coset to the corresponding index in a CircleDomain
 */
export function cosetIndexToCircleDomainIndex(
  cosetIndex: number,
  logDomainSize: number
): number {
  if (cosetIndex % 2 === 0) {
    return cosetIndex / 2;
  }
  return ((2 << logDomainSize) - cosetIndex) >> 1;
}

/**
 * Performs a coset-natural-order to circle-domain-bit-reversed-order permutation in-place
 */
export function bitReverseCosetToCircleDomainOrder<T>(v: T[]): void {
  const n = v.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error("Length must be a power of two");
  }
  const logN = Math.floor(Math.log2(n));
  for (let i = 0; i < n; i++) {
    const j = bitReverseIndex(cosetIndexToCircleDomainIndex(i, logN), logN);
    if (j > i) {
      [v[i]!, v[j]!] = [v[j]!, v[i]!];
    }
  }
}

/**
 * Creates an uninitialized vector of specified length
 */
export function uninitVec<T>(len: number): T[] {
  return new Array(len);
}

/*
        //            2   ·  14
        //         ·      |       ·
        //      13        |          1
        //    ·           |            ·
        //   3            |             15
        //  ·             |              ·
        // 12             |               0
        // ·--------------|---------------·
        // 4              |               8
        //  ·             |              ·
        //   11           |              7
        //    ·           |            ·
        //      5         |          9
        //         ·      |       ·
        //            10  ·   6
*/
