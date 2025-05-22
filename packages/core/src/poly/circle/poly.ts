import type { CircleDomain } from "./domain";
import { CircleEvaluation } from "./evaluation";
import type { ColumnOps } from "./evaluation";
import type { PolyOps } from "./ops";
import { TwiddleTree } from "../twiddles";
import type { M31 as BaseField } from "../../fields/m31";

/** A polynomial defined on a CircleDomain. */
export class CirclePoly<B extends ColumnOps<any>> {
  coeffs: any[]; // TODO: use proper Col<B, BaseField>
  private logSizeValue: number;

  constructor(coeffs: any[]) {
    if (coeffs.length === 0 || (coeffs.length & (coeffs.length - 1)) !== 0) {
      throw new Error("coeffs length must be a power of two");
    }
    this.coeffs = coeffs;
    this.logSizeValue = Math.log2(coeffs.length);
  }

  static new<B extends ColumnOps<any>>(coeffs: any[]): CirclePoly<B> {
    return new CirclePoly<B>(coeffs);
  }

  logSize(): number {
    return this.logSizeValue;
  }

  evalAtPoint(point: any): any {
    const BClass: any = (this.constructor as any);
    return BClass.eval_at_point(this, point);
  }

  extend(logSize: number): CirclePoly<B> {
    const BClass: any = (this.constructor as any);
    return BClass.extend(this, logSize);
  }

  evaluate(domain: any): any {
    const BClass: any = (this.constructor as any);
    const tw = BClass.precomputeTwiddles(domain.halfCoset);
    return BClass.evaluate(this, domain, tw);
  }

  evaluateWithTwiddles(domain: any, twiddles: TwiddleTree<B, any>): any {
    const BClass: any = (this.constructor as any);
    return BClass.evaluate(this, domain, twiddles);
  }

  /** Check if the polynomial lies in the FFT space of size `2^logFftSize`. */
  isInFftSpace(logFftSize: number): boolean {
    const coeffs = [...this.coeffs];
    while (coeffs.length > 0 && typeof coeffs[coeffs.length - 1].isZero === "function" && coeffs[coeffs.length - 1].isZero()) {
      coeffs.pop();
    }
    const highest = 1 << logFftSize;
    return coeffs.length <= highest;
  }

  /** Check if the polynomial lies in the FRI space of size `2^logFftSize`. */
  isInFriSpace(logFftSize: number): boolean {
    const coeffs = [...this.coeffs];
    while (coeffs.length > 0 && typeof coeffs[coeffs.length - 1].isZero === "function" && coeffs[coeffs.length - 1].isZero()) {
      coeffs.pop();
    }
    const highest = (1 << logFftSize) + 1;
    return coeffs.length <= highest;
  }
}

/*
This is the Rust code from poly.rs that needs to be ported to Typescript in this poly.ts file:

```rs
use super::{CircleDomain, CircleEvaluation, PolyOps};
use crate::core::backend::{Col, Column, ColumnOps};
use crate::core::circle::CirclePoint;
use crate::core::fields::m31::BaseField;
use crate::core::fields::qm31::SecureField;
use crate::core::poly::twiddles::TwiddleTree;
use crate::core::poly::BitReversedOrder;

/// A polynomial defined on a [CircleDomain].
#[derive(Clone, Debug)]
pub struct CirclePoly<B: ColumnOps<BaseField>> {
    /// Coefficients of the polynomial in the FFT basis.
    /// Note: These are not the coefficients of the polynomial in the standard
    /// monomial basis. The FFT basis is a tensor product of the twiddles:
    /// y, x, pi(x), pi^2(x), ..., pi^{log_size-2}(x).
    /// pi(x) := 2x^2 - 1.
    pub coeffs: Col<B, BaseField>,
    /// The number of coefficients stored as `log2(len(coeffs))`.
    log_size: u32,
}

impl<B: PolyOps> CirclePoly<B> {
    /// Creates a new circle polynomial.
    ///
    /// Coefficients must be in the circle IFFT algorithm's basis stored in bit-reversed order.
    ///
    /// # Panics
    ///
    /// Panics if the number of coefficients isn't a power of two.
    pub fn new(coeffs: Col<B, BaseField>) -> Self {
        assert!(coeffs.len().is_power_of_two());
        let log_size = coeffs.len().ilog2();
        Self { log_size, coeffs }
    }

    pub const fn log_size(&self) -> u32 {
        self.log_size
    }

    /// Evaluates the polynomial at a single point.
    pub fn eval_at_point(&self, point: CirclePoint<SecureField>) -> SecureField {
        B::eval_at_point(self, point)
    }

    /// Extends the polynomial to a larger degree bound.
    pub fn extend(&self, log_size: u32) -> Self {
        B::extend(self, log_size)
    }

    /// Evaluates the polynomial at all points in the domain.
    pub fn evaluate(
        &self,
        domain: CircleDomain,
    ) -> CircleEvaluation<B, BaseField, BitReversedOrder> {
        B::evaluate(self, domain, &B::precompute_twiddles(domain.half_coset))
    }

    /// Evaluates the polynomial at all points in the domain, using precomputed twiddles.
    pub fn evaluate_with_twiddles(
        &self,
        domain: CircleDomain,
        twiddles: &TwiddleTree<B>,
    ) -> CircleEvaluation<B, BaseField, BitReversedOrder> {
        B::evaluate(self, domain, twiddles)
    }
}

#[cfg(test)]
impl crate::core::backend::cpu::CpuCirclePoly {
    pub fn is_in_fft_space(&self, log_fft_size: u32) -> bool {
        use num_traits::Zero;

        let mut coeffs = self.coeffs.clone();
        while coeffs.last() == Some(&BaseField::zero()) {
            coeffs.pop();
        }

        // The highest degree monomial in a fft-space polynomial is x^{(n/2) - 1}y.
        // And it is at offset (n-1). x^{(n/2)} is at offset `n`, and is not allowed.
        let highest_degree_allowed_monomial_offset = 1 << log_fft_size;
        coeffs.len() <= highest_degree_allowed_monomial_offset
    }

    /// Fri space is the space of polynomials of total degree n/2.
    /// Highest degree monomials are x^{n/2} and x^{(n/2)-1}y.
    pub fn is_in_fri_space(&self, log_fft_size: u32) -> bool {
        use num_traits::Zero;

        let mut coeffs = self.coeffs.clone();
        while coeffs.last() == Some(&BaseField::zero()) {
            coeffs.pop();
        }

        // x^{n/2} is at offset `n`, and is the last offset allowed to be non-zero.
        let highest_degree_monomial_offset = (1 << log_fft_size) + 1;
        coeffs.len() <= highest_degree_monomial_offset
    }
}

#[cfg(test)]
mod tests {
    use crate::core::backend::cpu::CpuCirclePoly;
    use crate::core::circle::CirclePoint;
    use crate::core::fields::m31::BaseField;

    #[test]
    fn test_circle_poly_extend() {
        let poly = CpuCirclePoly::new((0..16).map(BaseField::from_u32_unchecked).collect());
        let extended = poly.clone().extend(8);
        let random_point = CirclePoint::get_point(21903);

        assert_eq!(
            poly.eval_at_point(random_point),
            extended.eval_at_point(random_point)
        );
    }
}
```
*/