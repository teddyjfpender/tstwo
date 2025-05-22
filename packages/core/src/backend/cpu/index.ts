/*
This is the Rust code from backend/cpu/mod.rs that needs to be ported to Typescript in this backend/cpu/index.ts file:
```rs
pub mod accumulation;
mod blake2s;
pub mod circle;
mod fri;
mod grind;
pub mod lookups;
#[cfg(not(target_arch = "wasm32"))]
mod poseidon252;
pub mod quotients;

use std::fmt::Debug;

use serde::{Deserialize, Serialize};

use super::{Backend, BackendForChannel, Column, ColumnOps};
use crate::core::lookups::mle::Mle;
use crate::core::poly::circle::{CircleEvaluation, CirclePoly};
use crate::core::utils::bit_reverse_index;
use crate::core::vcs::blake2_merkle::Blake2sMerkleChannel;
#[cfg(not(target_arch = "wasm32"))]
use crate::core::vcs::poseidon252_merkle::Poseidon252MerkleChannel;

#[derive(Copy, Clone, Debug, Deserialize, Serialize)]
pub struct CpuBackend;

impl Backend for CpuBackend {}
impl BackendForChannel<Blake2sMerkleChannel> for CpuBackend {}
#[cfg(not(target_arch = "wasm32"))]
impl BackendForChannel<Poseidon252MerkleChannel> for CpuBackend {}

/// Performs a naive bit-reversal permutation inplace.
///
/// # Panics
///
/// Panics if the length of the slice is not a power of two.
pub fn bit_reverse<T>(v: &mut [T]) {
    let n = v.len();
    assert!(n.is_power_of_two());
    let log_n = n.ilog2();
    for i in 0..n {
        let j = bit_reverse_index(i, log_n);
        if j > i {
            v.swap(i, j);
        }
    }
}

impl<T: Debug + Clone + Default> ColumnOps<T> for CpuBackend {
    type Column = Vec<T>;

    fn bit_reverse_column(column: &mut Self::Column) {
        bit_reverse(column)
    }
}

impl<T: Debug + Clone + Default> Column<T> for Vec<T> {
    fn zeros(len: usize) -> Self {
        vec![T::default(); len]
    }
    #[allow(clippy::uninit_vec)]
    unsafe fn uninitialized(length: usize) -> Self {
        let mut data = Vec::with_capacity(length);
        data.set_len(length);
        data
    }
    fn to_cpu(&self) -> Vec<T> {
        self.clone()
    }
    fn len(&self) -> usize {
        self.len()
    }
    fn at(&self, index: usize) -> T {
        self[index].clone()
    }
    fn set(&mut self, index: usize, value: T) {
        self[index] = value;
    }
}

pub type CpuCirclePoly = CirclePoly<CpuBackend>;
pub type CpuCircleEvaluation<F, EvalOrder> = CircleEvaluation<CpuBackend, F, EvalOrder>;
pub type CpuMle<F> = Mle<CpuBackend, F>;

#[cfg(test)]
mod tests {
    use itertools::Itertools;
    use rand::prelude::*;
    use rand::rngs::SmallRng;

    use crate::core::backend::cpu::bit_reverse;
    use crate::core::backend::Column;
    use crate::core::fields::qm31::QM31;
    use crate::core::fields::{batch_inverse_in_place, FieldExpOps};

    #[test]
    fn bit_reverse_works() {
        let mut data = [0, 1, 2, 3, 4, 5, 6, 7];
        bit_reverse(&mut data);
        assert_eq!(data, [0, 4, 2, 6, 1, 5, 3, 7]);
    }

    #[test]
    #[should_panic]
    fn bit_reverse_non_power_of_two_size_fails() {
        let mut data = [0, 1, 2, 3, 4, 5];
        bit_reverse(&mut data);
    }

    // TODO(Ohad): remove.
    #[test]
    fn batch_inverse_in_place_test() {
        let mut rng = SmallRng::seed_from_u64(0);
        let column = rng.gen::<[QM31; 16]>().to_vec();
        let expected = column.iter().map(|e| e.inverse()).collect_vec();
        let mut dst = Vec::zeros(column.len());

        batch_inverse_in_place(&column, &mut dst);

        assert_eq!(expected, dst);
    }
}
```
*/

import { bitReverseIndex } from "../../utils";
import type { Backend, Column, ColumnOps } from "../index";
import { Coset } from "../../circle";
import { M31 } from "../../fields/m31";
import { batchInverseInPlace } from "../../fields/fields";
import { TwiddleTree } from "../../poly/twiddles";

/**
 * TypeScript implementation of the CpuBackend from `backend/cpu/mod.rs`.
 */
export class CpuBackend implements Backend {}

/** In-place bit reverse. Mirrors the Rust function `bit_reverse`. */
export function bitReverse<T>(arr: T[]): void {
  const n = arr.length;
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error("length is not power of two");
  }
  const logN = Math.floor(Math.log2(n));
  for (let i = 0; i < n; i++) {
    const j = bitReverseIndex(i, logN);
    if (j > i) {
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
}

export class CpuColumnOps<T> implements ColumnOps<T> {
  bitReverseColumn(column: T[]): void {
    bitReverse(column);
  }
}

export class CpuColumn<T> implements Column<T> {
  constructor(private data: T[]) {}

  static zeros<T>(len: number, defaultValue: T): CpuColumn<T> {
    return new CpuColumn(Array.from({ length: len }, () => defaultValue));
  }

  static uninitialized<T>(len: number): CpuColumn<T> {
    return new CpuColumn(new Array(len).fill(undefined as unknown as T));
  }

  toCPU(): T[] {
    return [...this.data];
  }
  len(): number {
    return this.data.length;
  }
  at(index: number): T {
    return this.data[index];
  }
  set(index: number, value: T): void {
    this.data[index] = value;
  }
}

import { CirclePoly, CircleEvaluation } from "../../poly/circle";

export type CpuCirclePoly = CirclePoly<CpuBackend>;
export type CpuCircleEvaluation<F, EvalOrder = unknown> = CircleEvaluation<CpuBackend, F, EvalOrder>;
export type CpuMle<F> = unknown; // TODO: define once lookups/mle.ts is ported

/**
 * Compute the FFT twiddle factors for the given coset using a straightforward
 * implementation. Mirrors the Rust `slow_precompute_twiddles` helper.
 */
export function slowPrecomputeTwiddles(coset: Coset): M31[] {
  let c = coset;
  const twiddles: M31[] = [];
  for (let i = 0; i < coset.log_size; i++) {
    const points = Array.from(c.iter()).slice(0, c.size() / 2).map((p) => p.x);
    bitReverse(points);
    twiddles.push(...points);
    c = c.double();
  }
  twiddles.push(M31.one());
  return twiddles;
}

/**
 * Precomputes twiddle and inverse twiddle tables for the provided coset.
 */
export function precomputeTwiddles(coset: Coset): TwiddleTree<CpuBackend, M31[]> {
  const CHUNK_SIZE = 1 << 12;
  const rootCoset = coset;
  const twiddles = slowPrecomputeTwiddles(coset);

  // Generate inverse twiddles
  if (CHUNK_SIZE > rootCoset.size()) {
    const itw = twiddles.map((t) => t.inverse());
    return new TwiddleTree(rootCoset, twiddles, itw);
  }

  const itw: M31[] = new Array(twiddles.length).fill(M31.zero());
  for (let i = 0; i < twiddles.length; i += CHUNK_SIZE) {
    const src = twiddles.slice(i, i + CHUNK_SIZE);
    const dst = new Array<M31>(src.length).fill(M31.zero());
    batchInverseInPlace(src, dst);
    for (let j = 0; j < dst.length; j++) itw[i + j] = dst[j];
  }

  return new TwiddleTree(rootCoset, twiddles, itw);
}
