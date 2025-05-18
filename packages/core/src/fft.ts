// FFT implementation

/*
This is the Rust code from fft.rs that needs to be ported to Typescript in this fft.ts file:
```rs
use std::ops::{Add, AddAssign, Mul, Sub};

use super::fields::m31::BaseField;

pub fn butterfly<F>(v0: &mut F, v1: &mut F, twid: BaseField)
where
    F: AddAssign<F> + Sub<F, Output = F> + Mul<BaseField, Output = F> + Copy,
{
    let tmp = *v1 * twid;
    *v1 = *v0 - tmp;
    *v0 += tmp;
}

pub fn ibutterfly<F>(v0: &mut F, v1: &mut F, itwid: BaseField)
where
    F: AddAssign<F> + Add<F, Output = F> + Sub<F, Output = F> + Mul<BaseField, Output = F> + Copy,
{
    let tmp = *v0;
    *v0 = tmp + *v1;
    *v1 = (tmp - *v1) * itwid;
}
```
*/

import type { Field } from "./fields";
import { M31 } from "./fields/m31";

/**
 * Port of `fft.rs` function `butterfly`.
 * See original Rust reference above for edge-case behavior.
 *
 * Returns the updated pair `[v0, v1]` since JavaScript lacks mutable references.
 */
export function butterfly<F extends Field<F>>(v0: F, v1: F, twid: M31): [F, F] {
  const tmp = v1.mul(twid);
  const newV1 = v0.sub(tmp as unknown as F);
  const newV0 = v0.add(tmp as unknown as F);
  return [newV0, newV1];
}

/**
 * Port of `fft.rs` function `ibutterfly`.
 * See original Rust reference above for edge-case behavior.
 *
 * Returns the updated pair `[v0, v1]` since JavaScript lacks mutable references.
 */
export function ibutterfly<F extends Field<F>>(v0: F, v1: F, itwid: M31): [F, F] {
  const tmp = v0.clone();
  const newV0 = tmp.add(v1);
  const newV1 = tmp.sub(v1).mul(itwid) as unknown as F;
  return [newV0, newV1];
}

/**
 * Performs an in-place radix-2 decimation-in-time FFT on `values`.
 *
 * `twiddles` is expected to contain `(n - 1)` twiddle factors arranged by
 * layers: the first layer has `1` twiddle, the next has `2`, etc. The length of
 * `values` must be a power of two.
 */
export function fft<F extends Field<F>>(values: F[], twiddles: M31[]): void {
  const n = values.length;
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error("fft: length must be a power of two");
  }
  if (twiddles.length < n - 1) {
    throw new Error("fft: not enough twiddles");
  }

  let tIdx = 0;
  for (let m = 2; m <= n; m <<= 1) {
    const half = m >> 1;
    for (let start = 0; start < n; start += m) {
      for (let j = 0; j < half; j++) {
        const idx0 = start + j;
        const idx1 = idx0 + half;
        const [nv0, nv1] = butterfly(values[idx0], values[idx1], twiddles[tIdx + j]);
        values[idx0] = nv0;
        values[idx1] = nv1;
      }
    }
    tIdx += half;
  }
}

/**
 * Performs an in-place inverse FFT on `values`.
 *
 * `itwiddles` must contain the multiplicative inverses of the twiddles provided
 * to {@link fft} in the same layout. The result is scaled by `values.length`.
 */
export function ifft<F extends Field<F>>(values: F[], itwiddles: M31[]): void {
  const n = values.length;
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error("ifft: length must be a power of two");
  }
  if (itwiddles.length < n - 1) {
    throw new Error("ifft: not enough twiddles");
  }

  let tIdx = itwiddles.length;
  for (let m = n; m >= 2; m >>= 1) {
    const half = m >> 1;
    tIdx -= half;
    for (let start = 0; start < n; start += m) {
      for (let j = 0; j < half; j++) {
        const idx0 = start + j;
        const idx1 = idx0 + half;
        const [nv0, nv1] = ibutterfly(
          values[idx0],
          values[idx1],
          itwiddles[tIdx + j],
        );
        values[idx0] = nv0;
        values[idx1] = nv1;
      }
    }
  }
}
