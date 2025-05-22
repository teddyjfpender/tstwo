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
Original Rust reference for context:
```rs
use std::iter::Peekable;

use super::fields::m31::BaseField;
use super::fields::Field;

pub trait IteratorMutExt<'a, T: 'a>: Iterator<Item = &'a mut T> {
    fn assign(self, other: impl IntoIterator<Item = T>)
    where
        Self: Sized,
    {
        self.zip(other).for_each(|(a, b)| *a = b);
    }
}

impl<'a, T: 'a, I: Iterator<Item = &'a mut T>> IteratorMutExt<'a, T> for I {}

/// An iterator that takes elements from the underlying [Peekable] while the predicate is true.
/// Used to implement [PeekableExt::peek_take_while].
pub struct PeekTakeWhile<'a, I: Iterator, P: FnMut(&I::Item) -> bool> {
    iter: &'a mut Peekable<I>,
    predicate: P,
}
impl<I: Iterator, P: FnMut(&I::Item) -> bool> Iterator for PeekTakeWhile<'_, I, P> {
    type Item = I::Item;

    fn next(&mut self) -> Option<Self::Item> {
        self.iter.next_if(&mut self.predicate)
    }
}
pub trait PeekableExt<'a, I: Iterator> {
    /// Returns an iterator that takes elements from the underlying [Peekable] while the predicate
    /// is true.
    /// Unlike [Iterator::take_while], this iterator does not consume the first element that does
    /// not satisfy the predicate.
    fn peek_take_while<P: FnMut(&I::Item) -> bool>(
        &'a mut self,
        predicate: P,
    ) -> PeekTakeWhile<'a, I, P>;
}
impl<'a, I: Iterator> PeekableExt<'a, I> for Peekable<I> {
    fn peek_take_while<P: FnMut(&I::Item) -> bool>(
        &'a mut self,
        predicate: P,
    ) -> PeekTakeWhile<'a, I, P> {
        PeekTakeWhile {
            iter: self,
            predicate,
        }
    }
}

/// Returns the bit reversed index of `i` which is represented by `log_size` bits.
pub const fn bit_reverse_index(i: usize, log_size: u32) -> usize {
    if log_size == 0 {
        return i;
    }
    i.reverse_bits() >> (usize::BITS - log_size)
}

/// Returns the index of the previous element in a bit reversed
/// [super::poly::circle::CircleEvaluation] of log size `eval_log_size` relative to a smaller domain
/// of size `domain_log_size`.
pub const fn previous_bit_reversed_circle_domain_index(
    i: usize,
    domain_log_size: u32,
    eval_log_size: u32,
) -> usize {
    offset_bit_reversed_circle_domain_index(i, domain_log_size, eval_log_size, -1)
}

/// Returns the index of the offset element in a bit reversed
/// [super::poly::circle::CircleEvaluation] of log size `eval_log_size` relative to a smaller domain
/// of size `domain_log_size`.
pub const fn offset_bit_reversed_circle_domain_index(
    i: usize,
    domain_log_size: u32,
    eval_log_size: u32,
    offset: isize,
) -> usize {
    let mut prev_index = bit_reverse_index(i, eval_log_size);
    let half_size = 1 << (eval_log_size - 1);
    let step_size = offset * (1 << (eval_log_size - domain_log_size - 1)) as isize;
    if prev_index < half_size {
        prev_index = (prev_index as isize + step_size).rem_euclid(half_size as isize) as usize;
    } else {
        prev_index =
            ((prev_index as isize - step_size).rem_euclid(half_size as isize) as usize) + half_size;
    }
    bit_reverse_index(prev_index, eval_log_size)
}

// TODO(AlonH): Pair both functions below with bit reverse. Consider removing both and calculating
// the indices instead.
pub(crate) fn circle_domain_order_to_coset_order(values: &[BaseField]) -> Vec<BaseField> {
    let n = values.len();
    let mut coset_order = vec![];
    for i in 0..(n / 2) {
        coset_order.push(values[i]);
        coset_order.push(values[n - 1 - i]);
    }
    coset_order
}

pub(crate) fn coset_order_to_circle_domain_order<F: Field>(values: &[F]) -> Vec<F> {
    let mut circle_domain_order = Vec::with_capacity(values.len());
    let n = values.len();
    let half_len = n / 2;
    for i in 0..half_len {
        circle_domain_order.push(values[i << 1]);
    }
    for i in 0..half_len {
        circle_domain_order.push(values[n - 1 - (i << 1)]);
    }
    circle_domain_order
}

/// Converts an index within a [`CircleDomain`] to the corresponding index in a [`Coset`].
///
/// [`CircleDomain`]: crate::core::poly::circle::CircleDomain
/// [`Coset`]: crate::core::circle::Coset
pub(crate) const fn circle_domain_index_to_coset_index(
    circle_index: usize,
    log_domain_size: u32,
) -> usize {
    let n = 1 << log_domain_size;
    if circle_index < n / 2 {
        circle_index * 2
    } else {
        (n - 1 - circle_index) * 2 + 1
    }
}

/// Converts an index within a [`Coset`] to the corresponding index in a [`CircleDomain`].
///
/// [`CircleDomain`]: crate::core::poly::circle::CircleDomain
/// [`Coset`]: crate::core::circle::Coset
pub const fn coset_index_to_circle_domain_index(coset_index: usize, log_domain_size: u32) -> usize {
    if coset_index % 2 == 0 {
        coset_index / 2
    } else {
        ((2 << log_domain_size) - coset_index) / 2
    }
}

/// Performs a coset-natural-order to circle-domain-bit-reversed-order permutation in-place.
///
/// # Panics
///
/// Panics if the length of the slice is not a power of two.
pub fn bit_reverse_coset_to_circle_domain_order<T>(v: &mut [T]) {
    let n = v.len();
    assert!(n.is_power_of_two());
    let log_n = n.ilog2();
    for i in 0..n {
        let j = bit_reverse_index(coset_index_to_circle_domain_index(i, log_n), log_n);
        if j > i {
            v.swap(i, j);
        }
    }
}

/// # Safety
///
/// The caller must ensure that the vector is initialized before use.
#[allow(clippy::uninit_vec)]
pub unsafe fn uninit_vec<T>(len: usize) -> Vec<T> {
    let mut vec = Vec::with_capacity(len);
    vec.set_len(len);
    vec
}

#[cfg(test)]
mod tests {
    use itertools::Itertools;

    use super::{
        offset_bit_reversed_circle_domain_index, previous_bit_reversed_circle_domain_index,
    };
    use crate::core::backend::cpu::CpuCircleEvaluation;
    use crate::core::poly::circle::CanonicCoset;
    use crate::core::poly::NaturalOrder;
    use crate::core::utils::{
        circle_domain_index_to_coset_index, coset_index_to_circle_domain_index,
    };
    use crate::m31;

    #[test]
    fn test_offset_bit_reversed_circle_domain_index() {
        let domain_log_size = 3;
        let eval_log_size = 6;
        let initial_index = 5;

        let actual = offset_bit_reversed_circle_domain_index(
            initial_index,
            domain_log_size,
            eval_log_size,
            -2,
        );
        let expected_prev = previous_bit_reversed_circle_domain_index(
            initial_index,
            domain_log_size,
            eval_log_size,
        );
        let expected_prev2 = previous_bit_reversed_circle_domain_index(
            expected_prev,
            domain_log_size,
            eval_log_size,
        );
        assert_eq!(actual, expected_prev2);
    }

    #[test]
    fn test_previous_bit_reversed_circle_domain_index() {
        let log_size = 4;
        let n = 1 << log_size;
        let domain = CanonicCoset::new(log_size).circle_domain();
        let values = (0..n).map(|i| m31!(i as u32)).collect_vec();
        let evaluation = CpuCircleEvaluation::<_, NaturalOrder>::new(domain, values);
        let bit_reversed_evaluation = evaluation.clone().bit_reverse();

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
        let neighbor_pairs = (0..n)
            .map(|index| {
                let prev_index =
                    previous_bit_reversed_circle_domain_index(index, log_size - 3, log_size);
                (
                    bit_reversed_evaluation[index],
                    bit_reversed_evaluation[prev_index],
                )
            })
            .sorted()
            .collect_vec();
        let mut expected_neighbor_pairs = vec![
            (m31!(0), m31!(4)),
            (m31!(15), m31!(11)),
            (m31!(1), m31!(5)),
            (m31!(14), m31!(10)),
            (m31!(2), m31!(6)),
            (m31!(13), m31!(9)),
            (m31!(3), m31!(7)),
            (m31!(12), m31!(8)),
            (m31!(4), m31!(0)),
            (m31!(11), m31!(15)),
            (m31!(5), m31!(1)),
            (m31!(10), m31!(14)),
            (m31!(6), m31!(2)),
            (m31!(9), m31!(13)),
            (m31!(7), m31!(3)),
            (m31!(8), m31!(12)),
        ];
        expected_neighbor_pairs.sort();

        assert_eq!(neighbor_pairs, expected_neighbor_pairs);
    }

    #[test]
    fn test_circle_domain_and_coset_index_conversion() {
        let log_size = 3;
        let n = 1 << log_size;

        // Test that both functions are inverses of each other
        for i in 0..n {
            let coset_idx = circle_domain_index_to_coset_index(i, log_size);
            let circle_idx = coset_index_to_circle_domain_index(coset_idx, log_size);
            assert_eq!(i, circle_idx);
        }
    }
}

```
*/
