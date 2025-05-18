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
