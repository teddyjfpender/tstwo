/*
This is the Rust code from lookups/utils.rs that needs to be ported to Typescript in this lookups/utils.ts file:
```rs
use std::iter::{zip, Sum};
use std::ops::{Add, Deref, Mul, Neg, Sub};

use num_traits::{One, Zero};

use crate::core::fields::qm31::SecureField;
use crate::core::fields::{ExtensionOf, Field};

/// Univariate polynomial stored as coefficients in the monomial basis.
#[derive(Debug, Clone)]
pub struct UnivariatePoly<F: Field>(Vec<F>);

impl<F: Field> UnivariatePoly<F> {
    pub fn new(coeffs: Vec<F>) -> Self {
        let mut polynomial = Self(coeffs);
        polynomial.truncate_leading_zeros();
        polynomial
    }

    pub fn eval_at_point(&self, x: F) -> F {
        horner_eval(&self.0, x)
    }

    // <https://en.wikibooks.org/wiki/Algorithm_Implementation/Mathematics/Polynomial_interpolation>
    pub fn interpolate_lagrange(xs: &[F], ys: &[F]) -> Self {
        assert_eq!(xs.len(), ys.len());

        let mut coeffs = Self::zero();

        for (i, (xi, yi)) in zip(xs, ys).enumerate() {
            let mut prod = *yi;

            for (j, xj) in xs.iter().enumerate() {
                if i != j {
                    prod /= *xi - *xj;
                }
            }

            let mut term = Self::new(vec![prod]);

            for (j, xj) in xs.iter().enumerate() {
                if i != j {
                    term = term * (Self::x() - Self::new(vec![*xj]));
                }
            }

            coeffs = coeffs + term;
        }

        coeffs.truncate_leading_zeros();

        coeffs
    }

    pub fn degree(&self) -> usize {
        let mut coeffs = self.0.iter().rev();
        let _ = (&mut coeffs).take_while(|v| v.is_zero());
        coeffs.len().saturating_sub(1)
    }

    fn x() -> Self {
        Self(vec![F::zero(), F::one()])
    }

    fn truncate_leading_zeros(&mut self) {
        while self.0.last() == Some(&F::zero()) {
            self.0.pop();
        }
    }
}

impl<F: Field> From<F> for UnivariatePoly<F> {
    fn from(value: F) -> Self {
        Self::new(vec![value])
    }
}

impl<F: Field> Mul<F> for UnivariatePoly<F> {
    type Output = Self;

    fn mul(mut self, rhs: F) -> Self {
        self.0.iter_mut().for_each(|coeff| *coeff *= rhs);
        self
    }
}

impl<F: Field> Mul for UnivariatePoly<F> {
    type Output = Self;

    fn mul(mut self, mut rhs: Self) -> Self {
        if self.is_zero() || rhs.is_zero() {
            return Self::zero();
        }

        self.truncate_leading_zeros();
        rhs.truncate_leading_zeros();

        let mut res = vec![F::zero(); self.0.len() + rhs.0.len() - 1];

        for (i, coeff_a) in self.0.into_iter().enumerate() {
            for (j, coeff_b) in rhs.0.iter().enumerate() {
                res[i + j] += coeff_a * *coeff_b;
            }
        }

        Self::new(res)
    }
}

impl<F: Field> Add for UnivariatePoly<F> {
    type Output = Self;

    fn add(self, rhs: Self) -> Self {
        let n = self.0.len().max(rhs.0.len());
        let mut res = Vec::new();

        for i in 0..n {
            res.push(match (self.0.get(i), rhs.0.get(i)) {
                (Some(a), Some(b)) => *a + *b,
                (Some(a), None) | (None, Some(a)) => *a,
                _ => unreachable!(),
            })
        }

        Self(res)
    }
}

impl<F: Field> Sub for UnivariatePoly<F> {
    type Output = Self;

    fn sub(self, rhs: Self) -> Self {
        self + (-rhs)
    }
}

impl<F: Field> Neg for UnivariatePoly<F> {
    type Output = Self;

    fn neg(self) -> Self {
        Self(self.0.into_iter().map(|v| -v).collect())
    }
}

impl<F: Field> Zero for UnivariatePoly<F> {
    fn zero() -> Self {
        Self(vec![])
    }

    fn is_zero(&self) -> bool {
        self.0.iter().all(F::is_zero)
    }
}

impl<F: Field> Deref for UnivariatePoly<F> {
    type Target = [F];

    fn deref(&self) -> &[F] {
        &self.0
    }
}

/// Evaluates univariate polynomial using [Horner's method].
///
/// [Horner's method]: https://en.wikipedia.org/wiki/Horner%27s_method
pub fn horner_eval<F: Field>(coeffs: &[F], x: F) -> F {
    coeffs
        .iter()
        .rfold(F::zero(), |acc, coeff| acc * x + *coeff)
}

/// Returns `v_0 + alpha * v_1 + ... + alpha^(n-1) * v_{n-1}`.
pub fn random_linear_combination(v: &[SecureField], alpha: SecureField) -> SecureField {
    horner_eval(v, alpha)
}

/// Evaluates the lagrange kernel of the boolean hypercube.
///
/// The lagrange kernel of the boolean hypercube is a multilinear extension of the function that
/// when given `x, y` in `{0, 1}^n` evaluates to 1 if `x = y`, and evaluates to 0 otherwise.
pub fn eq<F: Field>(x: &[F], y: &[F]) -> F {
    assert_eq!(x.len(), y.len());
    zip(x, y)
        .map(|(xi, yi)| *xi * *yi + (F::one() - *xi) * (F::one() - *yi))
        .product()
}

/// Computes `eq(0, assignment) * eval0 + eq(1, assignment) * eval1`.
pub fn fold_mle_evals<F>(assignment: SecureField, eval0: F, eval1: F) -> SecureField
where
    F: Field,
    SecureField: ExtensionOf<F>,
{
    assignment * (eval1 - eval0) + eval0
}

/// Projective fraction.
#[derive(Debug, Clone, Copy)]
pub struct Fraction<N, D> {
    pub numerator: N,
    pub denominator: D,
}

impl<N, D> Fraction<N, D> {
    pub const fn new(numerator: N, denominator: D) -> Self {
        Self {
            numerator,
            denominator,
        }
    }
}

impl<N, D: Add<Output = D> + Add<N, Output = D> + Mul<N, Output = D> + Mul<Output = D> + Clone> Add
    for Fraction<N, D>
{
    type Output = Fraction<D, D>;

    fn add(self, rhs: Self) -> Fraction<D, D> {
        Fraction {
            numerator: rhs.denominator.clone() * self.numerator
                + self.denominator.clone() * rhs.numerator,
            denominator: self.denominator * rhs.denominator,
        }
    }
}

impl<N: Zero, D: One + Zero> Zero for Fraction<N, D>
where
    Self: Add<Output = Self>,
{
    fn zero() -> Self {
        Self {
            numerator: N::zero(),
            denominator: D::one(),
        }
    }

    fn is_zero(&self) -> bool {
        self.numerator.is_zero() && !self.denominator.is_zero()
    }
}

impl<N, D> Sum for Fraction<N, D>
where
    Self: Zero,
{
    fn sum<I: Iterator<Item = Self>>(mut iter: I) -> Self {
        let first = iter.next().unwrap_or_else(Self::zero);
        iter.fold(first, |a, b| a + b)
    }
}

/// Represents the fraction `1 / x`
pub struct Reciprocal<T> {
    x: T,
}

impl<T> Reciprocal<T> {
    pub const fn new(x: T) -> Self {
        Self { x }
    }
}

impl<T: Add<Output = T> + Mul<Output = T> + Clone> Add for Reciprocal<T> {
    type Output = Fraction<T, T>;

    fn add(self, rhs: Self) -> Fraction<T, T> {
        // `1/a + 1/b = (a + b)/(a * b)`
        Fraction {
            numerator: self.x.clone() + rhs.x.clone(),
            denominator: self.x * rhs.x,
        }
    }
}

impl<T: Sub<Output = T> + Mul<Output = T> + Clone> Sub for Reciprocal<T> {
    type Output = Fraction<T, T>;

    fn sub(self, rhs: Self) -> Fraction<T, T> {
        // `1/a - 1/b = (b - a)/(a * b)`
        Fraction {
            numerator: rhs.x.clone() - self.x.clone(),
            denominator: self.x * rhs.x,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::iter::zip;

    use num_traits::{One, Zero};

    use super::{horner_eval, UnivariatePoly};
    use crate::core::fields::m31::BaseField;
    use crate::core::fields::qm31::SecureField;
    use crate::core::fields::FieldExpOps;
    use crate::core::lookups::utils::{eq, Fraction};

    #[test]
    fn lagrange_interpolation_works() {
        let xs = [5, 1, 3, 9].map(BaseField::from);
        let ys = [1, 2, 3, 4].map(BaseField::from);

        let poly = UnivariatePoly::interpolate_lagrange(&xs, &ys);

        for (x, y) in zip(xs, ys) {
            assert_eq!(poly.eval_at_point(x), y, "mismatch for x={x}");
        }
    }

    #[test]
    fn horner_eval_works() {
        let coeffs = [BaseField::from(9), BaseField::from(2), BaseField::from(3)];
        let x = BaseField::from(7);

        let eval = horner_eval(&coeffs, x);

        assert_eq!(eval, coeffs[0] + coeffs[1] * x + coeffs[2] * x.square());
    }

    #[test]
    fn eq_identical_hypercube_points_returns_one() {
        let zero = SecureField::zero();
        let one = SecureField::one();
        let a = &[one, zero, one];

        let eq_eval = eq(a, a);

        assert_eq!(eq_eval, one);
    }

    #[test]
    fn eq_different_hypercube_points_returns_zero() {
        let zero = SecureField::zero();
        let one = SecureField::one();
        let a = &[one, zero, one];
        let b = &[one, zero, zero];

        let eq_eval = eq(a, b);

        assert_eq!(eq_eval, zero);
    }

    #[test]
    #[should_panic]
    fn eq_different_size_points() {
        let zero = SecureField::zero();
        let one = SecureField::one();

        eq(&[zero, one], &[zero]);
    }

    #[test]
    fn fraction_addition_works() {
        let a = Fraction::new(BaseField::from(1), BaseField::from(3));
        let b = Fraction::new(BaseField::from(2), BaseField::from(6));

        let Fraction {
            numerator,
            denominator,
        } = a + b;

        assert_eq!(
            numerator / denominator,
            BaseField::from(2) / BaseField::from(3)
        );
    }
}
```
*/

import type { Field, ExtensionOf } from '../fields/fields';
import { M31 as BaseField } from '../fields/m31';
import { QM31 as SecureField } from '../fields/qm31';

/// Univariate polynomial stored as coefficients in the monomial basis.
export class UnivariatePoly<F extends Field<F>> {
  private coeffs: F[];

  constructor(coeffs: F[]) {
    this.coeffs = coeffs.slice(); // Clone the array
    this.truncateLeadingZeros();
  }

  static new<F extends Field<F>>(coeffs: F[]): UnivariatePoly<F> {
    return new UnivariatePoly(coeffs);
  }

  evalAtPoint(x: F): F {
    return hornerEval(this.coeffs, x);
  }

  // Lagrange interpolation
  // https://en.wikibooks.org/wiki/Algorithm_Implementation/Mathematics/Polynomial_interpolation
  static interpolateLagrange<F extends Field<F>>(xs: F[], ys: F[]): UnivariatePoly<F> {
    if (xs.length !== ys.length) {
      throw new Error('xs and ys must have the same length');
    }

    if (xs.length === 0) {
      throw new Error('Cannot interpolate with empty arrays');
    }

    let coeffs = UnivariatePoly.zero<F>(xs[0]!); // Need an example F to create zero

    for (let i = 0; i < xs.length; i++) {
      const xi = xs[i]!;
      const yi = ys[i]!;
      let prod = yi.clone();

      for (let j = 0; j < xs.length; j++) {
        if (i !== j) {
          const xj = xs[j]!;
          prod = prod.mul(xi.sub(xj).inverse());
        }
      }

      let term = UnivariatePoly.new([prod]);

      for (let j = 0; j < xs.length; j++) {
        if (i !== j) {
          const xj = xs[j]!;
          term = term.mul(UnivariatePoly.x<F>(xi).sub(UnivariatePoly.new([xj])));
        }
      }

      coeffs = coeffs.add(term);
    }

    coeffs.truncateLeadingZeros();
    return coeffs;
  }

  degree(): number {
    let i = this.coeffs.length - 1;
    while (i >= 0 && this.coeffs[i]?.isZero()) {
      i--;
    }
    return Math.max(0, i);
  }

  private static x<F extends Field<F>>(example: F): UnivariatePoly<F> {
    const zero = example.add(example.neg()); // create zero from example
    
    // Create one using field's static methods if available
    let one: F;
    if ('constructor' in example && 'one' in (example.constructor as any)) {
      one = (example.constructor as any).one();
    } else if (!example.isZero()) {
      one = example.mul(example.inverse()); // create one (x * x^-1 = 1)
    } else {
      throw new Error('Cannot create one from zero field element without static one() method');
    }
    
    return new UnivariatePoly([zero, one]);
  }

  private truncateLeadingZeros(): void {
    while (this.coeffs.length > 0 && this.coeffs[this.coeffs.length - 1]?.isZero()) {
      this.coeffs.pop();
    }
  }

  // Convert from single field element
  static from<F extends Field<F>>(value: F): UnivariatePoly<F> {
    return UnivariatePoly.new([value]);
  }

  // Scalar multiplication
  mulScalar(rhs: F): UnivariatePoly<F> {
    const newCoeffs = this.coeffs.map(coeff => coeff.mul(rhs));
    return new UnivariatePoly(newCoeffs);
  }

  // Polynomial multiplication
  mul(rhs: UnivariatePoly<F>): UnivariatePoly<F> {
    if (this.isZero() || rhs.isZero()) {
      const example = this.coeffs[0] || rhs.coeffs[0];
      if (!example) {
        throw new Error('Cannot multiply polynomials without a field element example');
      }
      return UnivariatePoly.zero(example);
    }

    const thisClone = new UnivariatePoly(this.coeffs);
    const rhsClone = new UnivariatePoly(rhs.coeffs);
    thisClone.truncateLeadingZeros();
    rhsClone.truncateLeadingZeros();

    if (thisClone.coeffs.length === 0 || rhsClone.coeffs.length === 0) {
      const example = this.coeffs[0] || rhs.coeffs[0];
      if (!example) {
        throw new Error('Cannot multiply polynomials without a field element example');
      }
      return UnivariatePoly.zero(example);
    }

    const resultLen = thisClone.coeffs.length + rhsClone.coeffs.length - 1;
    const res: F[] = [];
    
    // Initialize with zeros
    const zero = thisClone.coeffs[0]!.add(thisClone.coeffs[0]!.neg());
    for (let i = 0; i < resultLen; i++) {
      res[i] = zero.clone();
    }

    for (let i = 0; i < thisClone.coeffs.length; i++) {
      for (let j = 0; j < rhsClone.coeffs.length; j++) {
        res[i + j] = res[i + j]!.add(thisClone.coeffs[i]!.mul(rhsClone.coeffs[j]!));
      }
    }

    return UnivariatePoly.new(res);
  }

  // Polynomial addition
  add(rhs: UnivariatePoly<F>): UnivariatePoly<F> {
    const n = Math.max(this.coeffs.length, rhs.coeffs.length);
    const res: F[] = [];

    for (let i = 0; i < n; i++) {
      const a = i < this.coeffs.length ? this.coeffs[i] : null;
      const b = i < rhs.coeffs.length ? rhs.coeffs[i] : null;

      if (a && b) {
        res.push(a.add(b));
      } else if (a) {
        res.push(a.clone());
      } else if (b) {
        res.push(b.clone());
      }
    }

    return new UnivariatePoly(res);
  }

  // Polynomial subtraction
  sub(rhs: UnivariatePoly<F>): UnivariatePoly<F> {
    return this.add(rhs.neg());
  }

  // Polynomial negation
  neg(): UnivariatePoly<F> {
    const newCoeffs = this.coeffs.map(v => v.neg());
    return new UnivariatePoly(newCoeffs);
  }

  // Zero polynomial
  static zero<F extends Field<F>>(example: F): UnivariatePoly<F> {
    return new UnivariatePoly<F>([]);
  }

  isZero(): boolean {
    return this.coeffs.length === 0 || this.coeffs.every(coeff => coeff.isZero());
  }

  // Get coefficients (like Deref in Rust)
  getCoeffs(): readonly F[] {
    return this.coeffs;
  }

  // Get coefficient at index
  at(index: number): F | undefined {
    return this.coeffs[index];
  }

  length(): number {
    return this.coeffs.length;
  }
}

/// Evaluates univariate polynomial using [Horner's method].
///
/// [Horner's method]: https://en.wikipedia.org/wiki/Horner%27s_method
export function hornerEval<F extends Field<F>>(coeffs: F[], x: F): F {
  if (coeffs.length === 0) {
    // Need to create zero from x
    return x.add(x.neg());
  }

  return coeffs.reduceRight((acc, coeff) => acc.mul(x).add(coeff), coeffs[0]!.add(coeffs[0]!.neg()));
}

/// Returns `v_0 + alpha * v_1 + ... + alpha^(n-1) * v_{n-1}`.
export function randomLinearCombination(v: SecureField[], alpha: SecureField): SecureField {
  return hornerEval(v, alpha);
}

/// Evaluates the lagrange kernel of the boolean hypercube.
///
/// The lagrange kernel of the boolean hypercube is a multilinear extension of the function that
/// when given `x, y` in `{0, 1}^n` evaluates to 1 if `x = y`, and evaluates to 0 otherwise.
export function eq<F extends Field<F>>(x: F[], y: F[]): F {
  if (x.length !== y.length) {
    throw new Error('x and y must have the same length');
  }

  if (x.length === 0) {
    throw new Error('Empty arrays not supported');
  }

  // Create one using the constructor's static method
  const firstElem = x[0]!;
  let one: F;
  
  // Try to use static one() method if available
  if ('constructor' in firstElem && 'one' in (firstElem.constructor as any)) {
    one = (firstElem.constructor as any).one();
  } else {
    // Find a non-zero element to create one
    const nonZeroElement = x.find(elem => !elem.isZero()) || y.find(elem => !elem.isZero());
    if (nonZeroElement) {
      one = nonZeroElement.mul(nonZeroElement.inverse()); // x * x^-1 = 1
    } else {
      throw new Error('Cannot create field one element - all inputs are zero and no static one() method available');
    }
  }

  return x.reduce((product, xi, i) => {
    const yi = y[i]!;
    const term = xi.mul(yi).add(one.sub(xi).mul(one.sub(yi)));
    return product.mul(term);
  }, one);
}

/// Computes `eq(0, assignment) * eval0 + eq(1, assignment) * eval1`.
export function foldMleEvals<F extends Field<F>>(
  assignment: SecureField, 
  eval0: F, 
  eval1: F
): SecureField {
  // Convert F elements to SecureField
  let secureEval0: SecureField;
  let secureEval1: SecureField;
  
  // Check if F is BaseField (M31) and convert accordingly
  if (eval0 instanceof BaseField) {
    secureEval0 = SecureField.from(eval0 as unknown as BaseField);
    secureEval1 = SecureField.from(eval1 as unknown as BaseField);
  } else if (eval0 instanceof SecureField) {
    // If F is already SecureField, use directly
    secureEval0 = eval0 as unknown as SecureField;
    secureEval1 = eval1 as unknown as SecureField;
  } else {
    throw new Error('foldMleEvals currently only supports BaseField (M31) and SecureField (QM31) inputs');
  }
  
  // assignment * (eval1 - eval0) + eval0
  return assignment.mul(secureEval1.sub(secureEval0)).add(secureEval0);
}

/// Projective fraction.
export class Fraction<N, D> {
  constructor(public numerator: N, public denominator: D) {}

  static new<N, D>(numerator: N, denominator: D): Fraction<N, D> {
    return new Fraction(numerator, denominator);
  }

  // Create zero fraction for BaseField (M31)
  static zeroBaseField(): Fraction<BaseField, BaseField> {
    return new Fraction(BaseField.zero(), BaseField.one());
  }

  // Create zero fraction for SecureField (QM31)
  static zeroSecureField(): Fraction<SecureField, SecureField> {
    return new Fraction(SecureField.zero(), SecureField.one());
  }

  isZero(): boolean {
    // Check if numerator is zero and denominator is not zero
    const num = this.numerator as any;
    const denom = this.denominator as any;
    
    if (typeof num?.isZero === 'function' && typeof denom?.isZero === 'function') {
      return num.isZero() && !denom.isZero();
    }
    
    throw new Error('isZero() requires types with isZero() method');
  }

  // Add operation for BaseField: (a/b) + (c/d) = (a*d + b*c)/(b*d)
  addBaseField(rhs: Fraction<BaseField, BaseField>): Fraction<BaseField, BaseField> {
    if (!(this.numerator instanceof BaseField) || !(this.denominator instanceof BaseField)) {
      throw new Error('addBaseField requires BaseField numerator and denominator');
    }
    
    const thisNum = this.numerator as BaseField;
    const thisDenom = this.denominator as BaseField;
    const rhsNum = rhs.numerator;
    const rhsDenom = rhs.denominator;
    
    // numerator = rhs.denominator * self.numerator + self.denominator * rhs.numerator
    const numerator = rhsDenom.mul(thisNum).add(thisDenom.mul(rhsNum));
    // denominator = self.denominator * rhs.denominator
    const denominator = thisDenom.mul(rhsDenom);
    
    return new Fraction(numerator, denominator);
  }

  // Add operation for SecureField: (a/b) + (c/d) = (a*d + b*c)/(b*d)
  addSecureField(rhs: Fraction<SecureField, SecureField>): Fraction<SecureField, SecureField> {
    if (!(this.numerator instanceof SecureField) || !(this.denominator instanceof SecureField)) {
      throw new Error('addSecureField requires SecureField numerator and denominator');
    }
    
    const thisNum = this.numerator as SecureField;
    const thisDenom = this.denominator as SecureField;
    const rhsNum = rhs.numerator;
    const rhsDenom = rhs.denominator;
    
    // numerator = rhs.denominator * self.numerator + self.denominator * rhs.numerator
    const numerator = rhsDenom.mul(thisNum).add(thisDenom.mul(rhsNum));
    // denominator = self.denominator * rhs.denominator
    const denominator = thisDenom.mul(rhsDenom);
    
    return new Fraction(numerator, denominator);
  }
}

// Sum implementation for BaseField Fraction arrays (equivalent to Rust's Sum trait)
export function sumBaseFractions(fractions: Fraction<BaseField, BaseField>[]): Fraction<BaseField, BaseField> {
  if (fractions.length === 0) {
    return Fraction.zeroBaseField();
  }
  
  let result = fractions[0]!;
  for (let i = 1; i < fractions.length; i++) {
    result = result.addBaseField(fractions[i]!);
  }
  
  return result;
}

// Sum implementation for SecureField Fraction arrays (equivalent to Rust's Sum trait)
export function sumSecureFractions(fractions: Fraction<SecureField, SecureField>[]): Fraction<SecureField, SecureField> {
  if (fractions.length === 0) {
    return Fraction.zeroSecureField();
  }
  
  let result = fractions[0]!;
  for (let i = 1; i < fractions.length; i++) {
    result = result.addSecureField(fractions[i]!);
  }
  
  return result;
}

/// Represents the fraction `1 / x`
export class Reciprocal<T> {
  constructor(public x: T) {}

  static new<T>(x: T): Reciprocal<T> {
    return new Reciprocal(x);
  }

  // Addition: 1/a + 1/b = (a + b)/(a * b)
  add<U extends Field<U>>(rhs: Reciprocal<T>): Fraction<T, T> {
    const x = this.x as unknown as U;
    const rhsX = rhs.x as unknown as U;
    
    return new Fraction(
      x.add(rhsX) as unknown as T,
      x.mul(rhsX) as unknown as T
    );
  }

  // Subtraction: 1/a - 1/b = (b - a)/(a * b)
  sub<U extends Field<U>>(rhs: Reciprocal<T>): Fraction<T, T> {
    const x = this.x as unknown as U;
    const rhsX = rhs.x as unknown as U;
    
    return new Fraction(
      rhsX.sub(x) as unknown as T,
      x.mul(rhsX) as unknown as T
    );
  }
}