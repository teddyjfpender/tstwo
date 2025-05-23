import type { CircleDomain } from "./domain";
import { CircleEvaluation } from "./evaluation";
import { CirclePoly } from "./poly";
import type { PolyOps } from "./ops";
import type { ColumnOps } from "./evaluation";
import { TwiddleTree } from "../twiddles";
// TODO: import type { SecureField } from "../../fields/qm31";

export const SECURE_EXTENSION_DEGREE = 4; // placeholder constant

export class SecureCirclePoly<B extends ColumnOps<any>> {
  constructor(public polys: [CirclePoly<B>, CirclePoly<B>, CirclePoly<B>, CirclePoly<B>]) {}

  evalAtPoint(point: any): any {
    // TODO: combine coordinate evaluations as SecureField when implemented
    return this.polys[0].evalAtPoint(point);
  }

  evalColumnsAtPoint(point: any): any[] {
    return this.polys.map((p) => p.evalAtPoint(point));
  }

  logSize(): number {
    return this.polys[0].logSize();
  }

  evaluateWithTwiddles(domain: any, twiddles: TwiddleTree<B, any>): SecureEvaluation<B, BitReversedOrder> {
    const columns = this.polys.map((p) => p.evaluateWithTwiddles(domain, twiddles).values);
    return new SecureEvaluation(domain, { columns } as any);
  }

  intoCoordinatePolys(): [CirclePoly<B>, CirclePoly<B>, CirclePoly<B>, CirclePoly<B>] {
    return this.polys;
  }
}

export class SecureEvaluation<B extends ColumnOps<any>, EvalOrder> {
  constructor(public domain: any, public values: any, private _evalOrder?: EvalOrder) {
    if ((domain as any).size() !== values.len()) {
      throw new Error("SecureEvaluation: size mismatch");
    }
  }

  intoCoordinateEvals(): any[] {
    const { domain, values } = this;
    return values.columns.map((c: any) => new CircleEvaluation<B, any, EvalOrder>(domain, c));
  }

  toCpu(): SecureEvaluation<any, EvalOrder> {
    return new SecureEvaluation(this.domain, this.values.to_cpu(), this._evalOrder);
  }

  interpolateWithTwiddles(twiddles: TwiddleTree<B, any>): SecureCirclePoly<B> {
    const domain = this.domain;
    const cols = this.values.columns;
    const polys = cols.map((c: any) =>
      new CircleEvaluation<B, any, BitReversedOrder>(domain, c).interpolateWithTwiddles(twiddles),
    );
    return new SecureCirclePoly(polys as any);
  }
}

import { BitReversedOrder } from "../index";

/*
This is the Rust code from secure_poly.rs that needs to be ported to Typescript in this secure_poly.ts file:

```rs
use std::marker::PhantomData;
use std::ops::{Deref, DerefMut};

use super::{CircleDomain, CircleEvaluation, CirclePoly, PolyOps};
use crate::core::backend::{ColumnOps, CpuBackend};
use crate::core::circle::CirclePoint;
use crate::core::fields::m31::BaseField;
use crate::core::fields::qm31::SecureField;
use crate::core::fields::secure_column::{SecureColumnByCoords, SECURE_EXTENSION_DEGREE};
use crate::core::poly::twiddles::TwiddleTree;
use crate::core::poly::BitReversedOrder;

pub struct SecureCirclePoly<B: ColumnOps<BaseField>>(pub [CirclePoly<B>; SECURE_EXTENSION_DEGREE]);

impl<B: PolyOps> SecureCirclePoly<B> {
    pub fn eval_at_point(&self, point: CirclePoint<SecureField>) -> SecureField {
        SecureField::from_partial_evals(self.eval_columns_at_point(point))
    }

    pub fn eval_columns_at_point(
        &self,
        point: CirclePoint<SecureField>,
    ) -> [SecureField; SECURE_EXTENSION_DEGREE] {
        [
            self[0].eval_at_point(point),
            self[1].eval_at_point(point),
            self[2].eval_at_point(point),
            self[3].eval_at_point(point),
        ]
    }

    pub fn log_size(&self) -> u32 {
        self[0].log_size()
    }

    pub fn evaluate_with_twiddles(
        &self,
        domain: CircleDomain,
        twiddles: &TwiddleTree<B>,
    ) -> SecureEvaluation<B, BitReversedOrder> {
        let polys = self.0.each_ref();
        let columns = polys.map(|poly| poly.evaluate_with_twiddles(domain, twiddles).values);
        SecureEvaluation::new(domain, SecureColumnByCoords { columns })
    }

    pub fn into_coordinate_polys(self) -> [CirclePoly<B>; SECURE_EXTENSION_DEGREE] {
        self.0
    }
}

impl<B: ColumnOps<BaseField>> Deref for SecureCirclePoly<B> {
    type Target = [CirclePoly<B>; SECURE_EXTENSION_DEGREE];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// A [`SecureField`] evaluation defined on a [CircleDomain].
///
/// The evaluation is stored as a column major array of [`SECURE_EXTENSION_DEGREE`] many base field
/// evaluations. The evaluations are ordered according to the [CircleDomain] ordering.
#[derive(Clone)]
pub struct SecureEvaluation<B: ColumnOps<BaseField>, EvalOrder> {
    pub domain: CircleDomain,
    pub values: SecureColumnByCoords<B>,
    _eval_order: PhantomData<EvalOrder>,
}

impl<B: ColumnOps<BaseField>, EvalOrder> SecureEvaluation<B, EvalOrder> {
    pub fn new(domain: CircleDomain, values: SecureColumnByCoords<B>) -> Self {
        assert_eq!(domain.size(), values.len());
        Self {
            domain,
            values,
            _eval_order: PhantomData,
        }
    }

    pub fn into_coordinate_evals(
        self,
    ) -> [CircleEvaluation<B, BaseField, EvalOrder>; SECURE_EXTENSION_DEGREE] {
        let Self { domain, values, .. } = self;
        values.columns.map(|c| CircleEvaluation::new(domain, c))
    }

    pub fn to_cpu(&self) -> SecureEvaluation<CpuBackend, EvalOrder> {
        SecureEvaluation {
            domain: self.domain,
            values: self.values.to_cpu(),
            _eval_order: PhantomData,
        }
    }
}

impl<B: ColumnOps<BaseField>, EvalOrder> Deref for SecureEvaluation<B, EvalOrder> {
    type Target = SecureColumnByCoords<B>;

    fn deref(&self) -> &Self::Target {
        &self.values
    }
}

impl<B: ColumnOps<BaseField>, EvalOrder> DerefMut for SecureEvaluation<B, EvalOrder> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.values
    }
}

impl<B: PolyOps> SecureEvaluation<B, BitReversedOrder> {
    /// Computes a minimal [`SecureCirclePoly`] that evaluates to the same values as this
    /// evaluation, using precomputed twiddles.
    pub fn interpolate_with_twiddles(self, twiddles: &TwiddleTree<B>) -> SecureCirclePoly<B> {
        let domain = self.domain;
        let cols = self.values.columns;
        SecureCirclePoly(cols.map(|c| {
            CircleEvaluation::<B, BaseField, BitReversedOrder>::new(domain, c)
                .interpolate_with_twiddles(twiddles)
        }))
    }
}

impl<EvalOrder> From<CircleEvaluation<CpuBackend, SecureField, EvalOrder>>
    for SecureEvaluation<CpuBackend, EvalOrder>
{
    fn from(evaluation: CircleEvaluation<CpuBackend, SecureField, EvalOrder>) -> Self {
        Self::new(evaluation.domain, evaluation.values.into_iter().collect())
    }
}
```
*/