import { Coset, CirclePoint } from "../circle";
import { M31 } from "../fields/m31";
import { QM31 } from "../fields/qm31";
import { CpuBackend } from "../backend/cpu";
import { ibutterfly } from "../fft";
import { bitReverseIndex } from "../utils";
import { fold } from "./utils";

/** A domain comprising the x-coordinates of points in a coset. */
export class LineDomain {
  coset: Coset;

  constructor(coset: Coset) {
    // The Rust implementation validates that the coset points have unique
    // x-coordinates. Once the real Coset type is available this check should be
    // reinstated.
    this.coset = coset;
  }

  static new(coset: Coset): LineDomain {
    return new LineDomain(coset);
  }

  at(i: number): M31 {
    return this.coset.at(i).x;
  }

  size(): number {
    return this.coset.size();
  }

  logSize(): number {
    return this.coset.log_size;
  }

  /** Alias for Rust-style `log_size` method name. */
  log_size(): number {
    return this.logSize();
  }

  *iter(): IterableIterator<M31> {
    const it: Iterable<CirclePoint<M31>> = this.coset.iter();
    for (const p of it) {
      yield p.x;
    }
  }

  double(): LineDomain {
    return new LineDomain(this.coset.double());
  }

  /** Returns the domain's underlying coset. */
  coset(): Coset {
    return this.coset;
  }
}

/** A univariate polynomial defined on a LineDomain. */
export class LinePoly {
  coeffs: QM31[];
  log_size: number;

  constructor(coeffs: QM31[]) {
    if (coeffs.length === 0 || (coeffs.length & (coeffs.length - 1)) !== 0) {
      throw new Error("coeffs length must be power of two");
    }
    this.coeffs = coeffs.slice();
    this.log_size = Math.log2(coeffs.length);
  }

  static new(coeffs: QM31[]): LinePoly {
    return new LinePoly(coeffs);
  }

  len(): number {
    return this.coeffs.length;
  }

  eval_at_point(x: QM31): QM31 {
    let cur = x;
    const doublings: QM31[] = [];
    for (let i = 0; i < this.log_size; i++) {
      doublings.push(cur);
      cur = CirclePoint.double_x(cur, QM31);
    }
    return fold(this.coeffs, doublings);
  }

  into_ordered_coefficients(): QM31[] {
    const arr = this.coeffs.slice();
    bitReverseArray(arr);
    return arr;
  }

  static from_ordered_coefficients(coeffs: QM31[]): LinePoly {
    const arr = coeffs.slice();
    bitReverseArray(arr);
    return new LinePoly(arr);
  }
}

export class LineEvaluation<B = CpuBackend> {
  domain: LineDomain;
  values: QM31[];

  constructor(domain: LineDomain, values: QM31[]) {
    if (domain.size() !== values.length) throw new Error("size mismatch");
    this.domain = domain;
    this.values = values.slice();
  }

  static new(domain: LineDomain, values: QM31[]): LineEvaluation<B> {
    return new LineEvaluation(domain, values);
  }

  static new_zero(domain: LineDomain, zero: QM31): LineEvaluation<B> {
    return new LineEvaluation(domain, Array(domain.size()).fill(zero));
  }

  len(): number {
    return this.values.length;
  }

  to_cpu(): LineEvaluation {
    return new LineEvaluation(this.domain, this.values);
  }

  interpolate(): LinePoly {
    const vals = this.values.slice();
    bitReverseArray(vals);
    lineIFFT(vals, this.domain);
    const lenInv = M31.from_u32_unchecked(vals.length as number).inverse();
    for (let i = 0; i < vals.length; i++) {
      vals[i] = vals[i].mulM31(lenInv);
    }
    return new LinePoly(vals);
  }
}

/** In-place line-domain inverse FFT. */
function lineIFFT(values: QM31[], domain: LineDomain) {
  let d = domain;
  while (d.size() > 1) {
    for (let chunkStart = 0; chunkStart < values.length; chunkStart += d.size()) {
      for (let i = 0; i < d.size() / 2; i++) {
        const idx0 = chunkStart + i;
        const idx1 = idx0 + d.size() / 2;
        const x = d.at(i).inverse();
        const [v0, v1] = ibutterfly(values[idx0], values[idx1], x);
        values[idx0] = v0;
        values[idx1] = v1;
      }
    }
    d = d.double();
  }
}

function bitReverseArray<T>(arr: T[]) {
  const n = arr.length;
  const logN = Math.log2(n);
  for (let i = 0; i < n; i++) {
    const j = bitReverseIndex(i, logN);
    if (j > i) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}


/*
This is the Rust code from line.rs that needs to be ported to this TypeScript line.ts file.
```rs
use std::cmp::Ordering;
use std::fmt::Debug;
use std::iter::Map;
use std::ops::{Deref, DerefMut};

use itertools::Itertools;
use num_traits::Zero;
use serde::{Deserialize, Serialize};

use super::circle::CircleDomain;
use super::utils::fold;
use crate::core::backend::cpu::bit_reverse;
use crate::core::backend::{ColumnOps, CpuBackend};
use crate::core::circle::{CirclePoint, Coset, CosetIterator};
use crate::core::fft::ibutterfly;
use crate::core::fields::m31::BaseField;
use crate::core::fields::qm31::SecureField;
use crate::core::fields::secure_column::SecureColumnByCoords;
use crate::core::fields::ExtensionOf;

/// Domain comprising of the x-coordinates of points in a [Coset].
///
/// For use with univariate polynomials.
#[derive(Copy, Clone, Debug)]
pub struct LineDomain {
    coset: Coset,
}

impl LineDomain {
    /// Returns a domain comprising of the x-coordinates of points in a coset.
    ///
    /// # Panics
    ///
    /// Panics if the coset items don't have unique x-coordinates.
    pub fn new(coset: Coset) -> Self {
        match coset.size().cmp(&2) {
            Ordering::Less => {}
            Ordering::Equal => {
                // If the coset with two points contains (0, y) then the coset is {(0, y), (0, -y)}.
                assert!(!coset.initial.x.is_zero(), "coset x-coordinates not unique");
            }
            Ordering::Greater => {
                // Let our coset be `E = c + <G>` with `|E| > 2` then:
                // 1. if `ord(c) <= ord(G)` the coset contains two points at x=0
                // 2. if `ord(c) = 2 * ord(G)` then `c` and `-c` are in our coset
                assert!(
                    coset.initial.log_order() >= coset.step.log_order() + 2,
                    "coset x-coordinates not unique"
                );
            }
        }
        Self { coset }
    }

    /// Returns the `i`th domain element.
    pub fn at(&self, i: usize) -> BaseField {
        self.coset.at(i).x
    }

    /// Returns the size of the domain.
    pub const fn size(&self) -> usize {
        self.coset.size()
    }

    /// Returns the log size of the domain.
    pub const fn log_size(&self) -> u32 {
        self.coset.log_size()
    }

    /// Returns an iterator over elements in the domain.
    pub fn iter(&self) -> LineDomainIterator {
        self.coset.iter().map(|p| p.x)
    }

    /// Returns a new domain comprising of all points in current domain doubled.
    pub fn double(&self) -> Self {
        Self {
            coset: self.coset.double(),
        }
    }

    /// Returns the domain's underlying coset.
    pub const fn coset(&self) -> Coset {
        self.coset
    }
}

impl IntoIterator for LineDomain {
    type Item = BaseField;
    type IntoIter = LineDomainIterator;

    /// Returns an iterator over elements in the domain.
    fn into_iter(self) -> LineDomainIterator {
        self.iter()
    }
}

impl From<CircleDomain> for LineDomain {
    fn from(domain: CircleDomain) -> Self {
        Self {
            coset: domain.half_coset,
        }
    }
}

/// An iterator over the x-coordinates of points in a coset.
type LineDomainIterator =
    Map<CosetIterator<CirclePoint<BaseField>>, fn(CirclePoint<BaseField>) -> BaseField>;

/// A univariate polynomial defined on a [LineDomain].
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize)]
pub struct LinePoly {
    /// Coefficients of the polynomial in [`line_ifft`] algorithm's basis.
    ///
    /// The coefficients are stored in bit-reversed order.
    #[allow(rustdoc::private_intra_doc_links)]
    coeffs: Vec<SecureField>,
    /// The number of coefficients stored as `log2(len(coeffs))`.
    log_size: u32,
}

impl LinePoly {
    /// Creates a new line polynomial from bit reversed coefficients.
    ///
    /// # Panics
    ///
    /// Panics if the number of coefficients is not a power of two.
    pub fn new(coeffs: Vec<SecureField>) -> Self {
        assert!(coeffs.len().is_power_of_two());
        let log_size = coeffs.len().ilog2();
        Self { coeffs, log_size }
    }

    /// Evaluates the polynomial at a single point.
    pub fn eval_at_point(&self, mut x: SecureField) -> SecureField {
        let mut doublings = Vec::new();
        for _ in 0..self.log_size {
            doublings.push(x);
            x = CirclePoint::double_x(x);
        }
        fold(&self.coeffs, &doublings)
    }

    /// Returns the number of coefficients.
    #[allow(clippy::len_without_is_empty)]
    pub fn len(&self) -> usize {
        // `.len().ilog2()` is a common operation. By returning the length like so the compiler
        // optimizes `.len().ilog2()` to a load of `log_size` instead of a branch and a bit count.
        debug_assert_eq!(self.coeffs.len(), 1 << self.log_size);
        1 << self.log_size
    }

    /// Returns the polynomial's coefficients in their natural order.
    pub fn into_ordered_coefficients(mut self) -> Vec<SecureField> {
        bit_reverse(&mut self.coeffs);
        self.coeffs
    }

    /// Creates a new line polynomial from coefficients in their natural order.
    ///
    /// # Panics
    ///
    /// Panics if the number of coefficients is not a power of two.
    pub fn from_ordered_coefficients(mut coeffs: Vec<SecureField>) -> Self {
        bit_reverse(&mut coeffs);
        Self::new(coeffs)
    }
}

impl Deref for LinePoly {
    type Target = [SecureField];

    fn deref(&self) -> &[SecureField] {
        &self.coeffs
    }
}

impl DerefMut for LinePoly {
    fn deref_mut(&mut self) -> &mut [SecureField] {
        &mut self.coeffs
    }
}

/// Evaluations of a univariate polynomial on a [LineDomain].
// TODO(andrew): Remove EvalOrder. Bit-reversed evals are only necessary since LineEvaluation is
// only used by FRI where evaluations are in bit-reversed order.
// TODO(andrew): Remove pub.
#[derive(Clone, Debug)]
pub struct LineEvaluation<B: ColumnOps<BaseField>> {
    /// Evaluations of a univariate polynomial on `domain`.
    pub values: SecureColumnByCoords<B>,
    domain: LineDomain,
}

impl<B: ColumnOps<BaseField>> LineEvaluation<B> {
    /// Creates new [LineEvaluation] from a set of polynomial evaluations over a [LineDomain].
    ///
    /// # Panics
    ///
    /// Panics if the number of evaluations does not match the size of the domain.
    pub fn new(domain: LineDomain, values: SecureColumnByCoords<B>) -> Self {
        assert_eq!(values.len(), domain.size());
        Self { values, domain }
    }

    pub fn new_zero(domain: LineDomain) -> Self {
        Self::new(domain, SecureColumnByCoords::zeros(domain.size()))
    }

    /// Returns the number of evaluations.
    #[allow(clippy::len_without_is_empty)]
    pub const fn len(&self) -> usize {
        1 << self.domain.log_size()
    }

    pub const fn domain(&self) -> LineDomain {
        self.domain
    }

    /// Clones the values into a new line evaluation in the CPU.
    pub fn to_cpu(&self) -> LineEvaluation<CpuBackend> {
        LineEvaluation::new(self.domain, self.values.to_cpu())
    }
}

impl LineEvaluation<CpuBackend> {
    /// Interpolates the polynomial as evaluations on `domain`.
    pub fn interpolate(self) -> LinePoly {
        let mut values = self.values.into_iter().collect_vec();
        CpuBackend::bit_reverse_column(&mut values);
        line_ifft(&mut values, self.domain);
        // Normalize the coefficients.
        let len_inv = BaseField::from(values.len()).inverse();
        values.iter_mut().for_each(|v| *v *= len_inv);
        LinePoly::new(values)
    }
}

/// Performs a univariate IFFT on a polynomial's evaluation over a [LineDomain].
///
/// This is not the standard univariate IFFT, because [LineDomain] is not a cyclic group.
///
/// The transform happens in-place. `values` should be the evaluations of a polynomial over `domain`
/// in their natural order. After the transformation `values` becomes the coefficients of the
/// polynomial stored in bit-reversed order.
///
/// For performance reasons and flexibility the normalization of the coefficients is omitted. The
/// normalized coefficients can be obtained by scaling all coefficients by `1 / len(values)`.
///
/// This algorithm does not return coefficients in the standard monomial basis but rather returns
/// coefficients in a basis relating to the circle's x-coordinate doubling map `pi(x) = 2x^2 - 1`
/// i.e.
///
/// ```text
/// B = { 1 } * { x } * { pi(x) } * { pi(pi(x)) } * ...
///   = { 1, x, pi(x), pi(x) * x, pi(pi(x)), pi(pi(x)) * x, pi(pi(x)) * pi(x), ... }
/// ```
///
/// # Panics
///
/// Panics if the number of values doesn't match the size of the domain.
fn line_ifft<F: ExtensionOf<BaseField> + Copy>(values: &mut [F], mut domain: LineDomain) {
    assert_eq!(values.len(), domain.size());
    while domain.size() > 1 {
        for chunk in values.chunks_exact_mut(domain.size()) {
            let (l, r) = chunk.split_at_mut(domain.size() / 2);
            for (i, x) in domain.iter().take(domain.size() / 2).enumerate() {
                ibutterfly(&mut l[i], &mut r[i], x.inverse());
            }
        }
        domain = domain.double();
    }
}

#[cfg(test)]
mod tests {
    type B = CpuBackend;

    use itertools::Itertools;

    use super::LineDomain;
    use crate::core::backend::{ColumnOps, CpuBackend};
    use crate::core::circle::{CirclePoint, Coset};
    use crate::core::fields::m31::BaseField;
    use crate::core::poly::line::{LineEvaluation, LinePoly};
    use crate::core::utils::bit_reverse_index;

    #[test]
    #[should_panic]
    fn bad_line_domain() {
        // This coset doesn't have points with unique x-coordinates.
        let coset = Coset::odds(2);

        LineDomain::new(coset);
    }

    #[test]
    fn line_domain_of_size_two_works() {
        const LOG_SIZE: u32 = 1;
        let coset = Coset::subgroup(LOG_SIZE);

        LineDomain::new(coset);
    }

    #[test]
    fn line_domain_of_size_one_works() {
        const LOG_SIZE: u32 = 0;
        let coset = Coset::subgroup(LOG_SIZE);

        LineDomain::new(coset);
    }

    #[test]
    fn line_domain_size_is_correct() {
        const LOG_SIZE: u32 = 8;
        let coset = Coset::half_odds(LOG_SIZE);
        let domain = LineDomain::new(coset);

        let size = domain.size();

        assert_eq!(size, 1 << LOG_SIZE);
    }

    #[test]
    fn line_domain_coset_returns_the_coset() {
        let coset = Coset::half_odds(5);
        let domain = LineDomain::new(coset);

        assert_eq!(domain.coset(), coset);
    }

    #[test]
    fn line_domain_double_works() {
        const LOG_SIZE: u32 = 8;
        let coset = Coset::half_odds(LOG_SIZE);
        let domain = LineDomain::new(coset);

        let doubled_domain = domain.double();

        assert_eq!(doubled_domain.size(), 1 << (LOG_SIZE - 1));
        assert_eq!(doubled_domain.at(0), CirclePoint::double_x(domain.at(0)));
        assert_eq!(doubled_domain.at(1), CirclePoint::double_x(domain.at(1)));
    }

    #[test]
    fn line_domain_iter_works() {
        const LOG_SIZE: u32 = 8;
        let coset = Coset::half_odds(LOG_SIZE);
        let domain = LineDomain::new(coset);

        let elements = domain.iter().collect::<Vec<BaseField>>();

        assert_eq!(elements.len(), domain.size());
        for (i, element) in elements.into_iter().enumerate() {
            assert_eq!(element, domain.at(i), "mismatch at {i}");
        }
    }

    #[test]
    fn line_evaluation_interpolation() {
        let poly = LinePoly::new(vec![
            BaseField::from(7).into(), // 7 * 1
            BaseField::from(9).into(), // 9 * pi(x)
            BaseField::from(5).into(), // 5 * x
            BaseField::from(3).into(), // 3 * pi(x)*x
        ]);
        let coset = Coset::half_odds(poly.len().ilog2());
        let domain = LineDomain::new(coset);
        let mut values = domain
            .iter()
            .map(|x| {
                let pi_x = CirclePoint::double_x(x);
                poly.coeffs[0]
                    + poly.coeffs[1] * pi_x
                    + poly.coeffs[2] * x
                    + poly.coeffs[3] * pi_x * x
            })
            .collect_vec();
        CpuBackend::bit_reverse_column(&mut values);
        let evals = LineEvaluation::<B>::new(domain, values.into_iter().collect());

        let interpolated_poly = evals.interpolate();

        assert_eq!(interpolated_poly.coeffs, poly.coeffs);
    }

    #[test]
    fn line_polynomial_eval_at_point() {
        const LOG_SIZE: u32 = 2;
        let coset = Coset::half_odds(LOG_SIZE);
        let domain = LineDomain::new(coset);
        let evals = LineEvaluation::<B>::new(
            domain,
            (0..1 << LOG_SIZE)
                .map(BaseField::from)
                .map(|x| x.into())
                .collect(),
        );
        let poly = evals.clone().interpolate();

        for (i, x) in domain.iter().enumerate() {
            assert_eq!(
                poly.eval_at_point(x.into()),
                evals.values.at(bit_reverse_index(i, domain.log_size())),
                "mismatch at {i}"
            );
        }
    }
}
```
*/