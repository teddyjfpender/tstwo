import type { Field, FieldExpOps, ComplexConjugate } from "./fields/fields";
import { M31 } from "./fields/m31";
import { QM31 as SecureField, P4 } from "./fields/qm31";

/**
 * Minimal interface for a randomness channel capable of drawing a `SecureField`.
 * The real channel implementations are not yet ported but `get_random_point`
 * relies on this functionality.
 */
export interface Channel {
  draw_felt(): SecureField;
}

/**
 * A point on the complex circle. Treated as an additive group.
 *
 * Port of `circle.rs` struct `CirclePoint`.
 */
export class CirclePoint<F extends Field<F>> implements ComplexConjugate<CirclePoint<F>> {
  constructor(public x: F, public y: F) {}

  clone(): CirclePoint<F> {
    return new CirclePoint(this.x.clone(), this.y.clone());
  }

  /** Construct the identity element using the provided field implementation. */
  static zero<F extends Field<F>>(FClass: { one(): F; zero(): F }): CirclePoint<F> {
    return new CirclePoint(FClass.one(), FClass.zero());
  }

  /** Additive doubling. */
  double(): CirclePoint<F> {
    return this.add(this);
  }

  /** Apply the circle's x-coordinate doubling map. */
  static double_x<F extends Field<F>>(x: F, FClass: { one(): F }): F {
    const sx = x.square();
    return sx.clone().add(sx).sub(FClass.one());
  }

  /** Returns the log order of a point. All points have order `2^k`. */
  log_order(this: CirclePoint<F>, FClass: { one(): F }): number {
    let res = 0;
    let cur = this.x.clone();
    const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loops
    while (!cur.equals(FClass.one()) && res < MAX_ITERATIONS) {
      cur = CirclePoint.double_x(cur, FClass);
      res += 1;
    }
    if (res === MAX_ITERATIONS) {
      console.warn("Maximum iterations reached in log_order calculation, may not have found the true order");
    }
    return res;
  }

  /** Multiply the point by a scalar using double and add. */
  mul(this: CirclePoint<F>, scalar: bigint, FClass: { one(): F; zero(): F }): CirclePoint<F> {
    let res = CirclePoint.zero(FClass);
    let cur = this.clone();
    let s = BigInt(scalar);
    while (s > 0n) {
      if (s & 1n) {
        res = res.add(cur);
      }
      cur = cur.double();
      s >>= 1n;
    }
    return res;
  }

  /** Repeatedly doubles the point n times. */
  repeated_double(this: CirclePoint<F>, n: number): CirclePoint<F> {
    let res = this.clone();
    for (let i = 0; i < n; i++) {
      res = res.double();
    }
    return res;
  }

  conjugate(): CirclePoint<F> {
    return new CirclePoint(this.x.clone(), this.y.neg());
  }

  antipode(): CirclePoint<F> {
    return new CirclePoint(this.x.neg(), this.y.neg());
  }

  intoEf<EF>(convert: (v: F) => EF): CirclePoint<EF> {
    return new CirclePoint(convert(this.x), convert(this.y));
  }

  mul_signed(this: CirclePoint<F>, off: number, FClass: { one(): F; zero(): F }): CirclePoint<F> {
    if (off >= 0) {
      return this.mul(BigInt(off), FClass);
    } else {
      return this.conjugate().mul(BigInt(-off), FClass);
    }
  }

  add(rhs: CirclePoint<F>): CirclePoint<F> {
    const x = this.x.clone().mul(rhs.x).sub(this.y.clone().mul(rhs.y));
    const y = this.x.mul(rhs.y).add(this.y.mul(rhs.x));
    return new CirclePoint(x, y);
  }

  neg(): CirclePoint<F> {
    return this.conjugate();
  }

  sub(rhs: CirclePoint<F>): CirclePoint<F> {
    return this.add(rhs.neg());
  }

  complexConjugate(): CirclePoint<F> {
    return new CirclePoint(this.x.complexConjugate(), this.y.complexConjugate());
  }

  /** Return the SecureField point at the given index. */
  static get_point(index: bigint): CirclePoint<SecureField> {
    if (index >= SECURE_FIELD_CIRCLE_ORDER) throw new Error("index out of range");
    return SECURE_FIELD_CIRCLE_GEN.mul(index, SecureField);
  }

  /** Draw a random SecureField circle point from a channel. */
  static get_random_point(channel: Channel): CirclePoint<SecureField> {
    const t = channel.draw_felt();
    const t_square = t.square();
    const one_plus_tsquared_inv = t_square.add(SecureField.one()).inverse();
    const x = SecureField.one().add(t_square.neg()).mul(one_plus_tsquared_inv);
    const y = t.double().mul(one_plus_tsquared_inv);
    return new CirclePoint(x, y);
  }
}

/** Generator for the circle group over {@link M31}. */
export const M31_CIRCLE_GEN = new CirclePoint(M31.fromUnchecked(2), M31.fromUnchecked(1268011823));

/** Log order of {@link M31_CIRCLE_GEN}. */
export const M31_CIRCLE_LOG_ORDER = 31;

/** Generator for the circle group over {@link SecureField}. */
export const SECURE_FIELD_CIRCLE_GEN = new CirclePoint(
  SecureField.fromUnchecked(1, 0, 478637715, 513582971),
  SecureField.fromUnchecked(992285211, 649143431, 740191619, 1186584352)
);

/** Order of {@link SECURE_FIELD_CIRCLE_GEN}. */
export const SECURE_FIELD_CIRCLE_ORDER = BigInt(P4) - 1n;

/** Integer representing the circle point `i * CIRCLE_GEN`. */
export class CirclePointIndex {
  constructor(public value: number) {}

  static zero(): CirclePointIndex {
    return new CirclePointIndex(0);
  }

  static generator(): CirclePointIndex {
    return new CirclePointIndex(1);
  }

  reduce(): CirclePointIndex {
    return new CirclePointIndex(this.value & ((1 << M31_CIRCLE_LOG_ORDER) - 1));
  }

  static subgroup_gen(logSize: number): CirclePointIndex {
    if (logSize > M31_CIRCLE_LOG_ORDER) throw new Error("log_size too large");
    return new CirclePointIndex(1 << (M31_CIRCLE_LOG_ORDER - logSize));
  }

  to_point(): CirclePoint<M31> {
    return M31_CIRCLE_GEN.mul(BigInt(this.value), M31);
  }

  half(): CirclePointIndex {
    if (this.value & 1) throw new Error("not even");
    return new CirclePointIndex(this.value >> 1);
  }

  add(rhs: CirclePointIndex): CirclePointIndex {
    return new CirclePointIndex(this.value + rhs.value).reduce();
  }

  sub(rhs: CirclePointIndex): CirclePointIndex {
    return new CirclePointIndex(this.value + (1 << M31_CIRCLE_LOG_ORDER) - rhs.value).reduce();
  }

  mul(rhs: number): CirclePointIndex {
    return new CirclePointIndex(Math.imul(this.value, rhs)).reduce();
  }

  neg(): CirclePointIndex {
    return new CirclePointIndex((1 << M31_CIRCLE_LOG_ORDER) - this.value).reduce();
  }
}

/** Represents the coset `initial + <step>`. */
export class Coset {
  constructor(
    public initial_index: CirclePointIndex,
    public log_size: number,
  ) {
    if (log_size > M31_CIRCLE_LOG_ORDER) throw new Error("log_size too large");
    this.initial_index = initial_index;
    this.log_size = log_size;
    const step_size = CirclePointIndex.subgroup_gen(log_size);
    this.step_size = step_size;
    this.step = step_size.to_point();
    this.initial = initial_index.to_point();
  }

  initial: CirclePoint<M31>;
  step_size: CirclePointIndex;
  step: CirclePoint<M31>;

  static new(initial_index: CirclePointIndex, log_size: number): Coset {
    return new Coset(initial_index, log_size);
  }

  /** Creates a coset of the form `<G_n>`. */
  static subgroup(log_size: number): Coset {
    return Coset.new(CirclePointIndex.zero(), log_size);
  }

  /** Creates a coset of the form `G_2n + <G_n>`. */
  static odds(log_size: number): Coset {
    return Coset.new(CirclePointIndex.subgroup_gen(log_size + 1), log_size);
  }

  /** Creates a coset of the form `G_4n + <G_n>`. */
  static half_odds(log_size: number): Coset {
    return Coset.new(CirclePointIndex.subgroup_gen(log_size + 2), log_size);
  }

  size(): number {
    return 1 << this.log_size;
  }

  iter(): CosetIterator<CirclePoint<M31>> {
    return new CosetIterator(this.initial, this.step, this.size());
  }

  iter_indices(): CosetIterator<CirclePointIndex> {
    return new CosetIterator(this.initial_index, this.step_size, this.size());
  }

  double(): Coset {
    if (this.log_size <= 0) throw new Error("log_size must be >0 to double");
    return new Coset(this.initial_index.mul(2), this.log_size - 1);
  }

  repeated_double(n: number): Coset {
    let c: Coset = this;
    for (let i = 0; i < n; i++) c = c.double();
    return c;
  }

  is_doubling_of(other: Coset): boolean {
    return this.log_size <= other.log_size && this.equals(other.repeated_double(other.log_size - this.log_size));
  }

  equals(other: Coset): boolean {
    return (
      this.initial_index.value === other.initial_index.value &&
      this.step_size.value === other.step_size.value &&
      this.log_size === other.log_size
    );
  }

  index_at(index: number): CirclePointIndex {
    return this.initial_index.add(this.step_size.mul(index));
  }

  at(index: number): CirclePoint<M31> {
    return this.index_at(index).to_point();
  }

  shift(shift_size: CirclePointIndex): Coset {
    return Coset.new(this.initial_index.add(shift_size), this.log_size);
  }

  conjugate(): Coset {
    return Coset.new(this.initial_index.neg(), this.log_size);
  }
}

export class CosetIterator<T> implements IterableIterator<T> {
  constructor(public cur: T, public step: T, public remaining: number) {}

  next(): IteratorResult<T> {
    if (this.remaining === 0) return { done: true, value: undefined as any };
    this.remaining -= 1;
    const res = this.cur;
    // @ts-ignore - relies on add method presence
    this.cur = this.cur.add(this.step);
    return { done: false, value: res };
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this;
  }
}

/*
This is the Rust code from circle.rs that needs to be ported to Typescript in this circle.ts file:
```rs
use std::ops::{Add, Mul, Neg, Sub};

use num_traits::{One, Zero};

use super::fields::m31::{BaseField, M31};
use super::fields::qm31::SecureField;
use super::fields::{ComplexConjugate, Field, FieldExpOps};
use crate::core::channel::Channel;
use crate::core::fields::qm31::P4;

/// A point on the complex circle. Treated as an additive group.
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, Hash)]
pub struct CirclePoint<F> {
    pub x: F,
    pub y: F,
}

impl<F: Zero + Add<Output = F> + FieldExpOps + Sub<Output = F> + Neg<Output = F>> CirclePoint<F> {
    pub fn zero() -> Self {
        Self {
            x: F::one(),
            y: F::zero(),
        }
    }

    pub fn double(&self) -> Self {
        self.clone() + self.clone()
    }

    /// Applies the circle's x-coordinate doubling map.
    ///
    /// # Examples
    ///
    /// ```
    /// use stwo_prover::core::circle::{CirclePoint, M31_CIRCLE_GEN};
    /// use stwo_prover::core::fields::m31::M31;
    /// let p = M31_CIRCLE_GEN.mul(17);
    /// assert_eq!(CirclePoint::double_x(p.x), (p + p).x);
    /// ```
    pub fn double_x(x: F) -> F {
        let sx = x.square();
        sx.clone() + sx - F::one()
    }

    /// Returns the log order of a point.
    ///
    /// All points have an order of the form `2^k`.
    ///
    /// # Examples
    ///
    /// ```
    /// use stwo_prover::core::circle::{CirclePoint, M31_CIRCLE_GEN, M31_CIRCLE_LOG_ORDER};
    /// use stwo_prover::core::fields::m31::M31;
    /// assert_eq!(M31_CIRCLE_GEN.log_order(), M31_CIRCLE_LOG_ORDER);
    /// ```
    pub fn log_order(&self) -> u32
    where
        F: PartialEq + Eq,
    {
        // we only need the x-coordinate to check order since the only point
        // with x=1 is the circle's identity
        let mut res = 0;
        let mut cur = self.x.clone();
        while cur != F::one() {
            cur = Self::double_x(cur);
            res += 1;
        }
        res
    }

    pub fn mul(&self, mut scalar: u128) -> CirclePoint<F> {
        let mut res = Self::zero();
        let mut cur = self.clone();
        while scalar > 0 {
            if scalar & 1 == 1 {
                res = res + cur.clone();
            }
            cur = cur.double();
            scalar >>= 1;
        }
        res
    }

    pub fn repeated_double(&self, n: u32) -> Self {
        let mut res = self.clone();
        for _ in 0..n {
            res = res.double();
        }
        res
    }

    pub fn conjugate(&self) -> CirclePoint<F> {
        Self {
            x: self.x.clone(),
            y: -self.y.clone(),
        }
    }

    pub fn antipode(&self) -> CirclePoint<F> {
        Self {
            x: -self.x.clone(),
            y: -self.y.clone(),
        }
    }

    pub fn into_ef<EF: From<F>>(self) -> CirclePoint<EF> {
        CirclePoint {
            x: self.x.clone().into(),
            y: self.y.clone().into(),
        }
    }

    pub fn mul_signed(&self, off: isize) -> CirclePoint<F> {
        if off > 0 {
            self.mul(off as u128)
        } else {
            self.conjugate().mul(-off as u128)
        }
    }
}

impl<F: Zero + Add<Output = F> + FieldExpOps + Sub<Output = F> + Neg<Output = F>> Add
    for CirclePoint<F>
{
    type Output = Self;

    fn add(self, rhs: Self) -> Self::Output {
        let x = self.x.clone() * rhs.x.clone() - self.y.clone() * rhs.y.clone();
        let y = self.x * rhs.y + self.y * rhs.x;
        Self { x, y }
    }
}

impl<F: Zero + Add<Output = F> + FieldExpOps + Sub<Output = F> + Neg<Output = F>> Neg
    for CirclePoint<F>
{
    type Output = Self;

    fn neg(self) -> Self::Output {
        self.conjugate()
    }
}

impl<F: Zero + Add<Output = F> + FieldExpOps + Sub<Output = F> + Neg<Output = F>> Sub
    for CirclePoint<F>
{
    type Output = Self;

    fn sub(self, rhs: Self) -> Self::Output {
        self + (-rhs)
    }
}

impl<F: Field> ComplexConjugate for CirclePoint<F> {
    fn complex_conjugate(&self) -> Self {
        Self {
            x: self.x.complex_conjugate(),
            y: self.y.complex_conjugate(),
        }
    }
}

impl CirclePoint<SecureField> {
    pub fn get_point(index: u128) -> Self {
        assert!(index < SECURE_FIELD_CIRCLE_ORDER);
        SECURE_FIELD_CIRCLE_GEN.mul(index)
    }

    pub fn get_random_point<C: Channel>(channel: &mut C) -> Self {
        let t = channel.draw_felt();
        let t_square = t.square();

        let one_plus_tsquared_inv = t_square.add(SecureField::one()).inverse();

        let x = SecureField::one()
            .add(t_square.neg())
            .mul(one_plus_tsquared_inv);
        let y = t.double().mul(one_plus_tsquared_inv);

        Self { x, y }
    }
}

/// A generator for the circle group over [M31].
///
/// # Examples
///
/// ```
/// use stwo_prover::core::circle::{CirclePoint, M31_CIRCLE_GEN};
/// use stwo_prover::core::fields::m31::M31;
///
/// // Adding a generator to itself (2^30) times should NOT yield the identity.
/// let circle_point = M31_CIRCLE_GEN.repeated_double(30);
/// assert_ne!(circle_point, CirclePoint::zero());
///
/// // Shown above ord(M31_CIRCLE_GEN) > 2^30 . Group order is 2^31.
/// // Ord(M31_CIRCLE_GEN) must be a divisor of it, Hence ord(M31_CIRCLE_GEN) = 2^31.
/// // Adding the generator to itself (2^31) times should yield the identity.
/// let circle_point = M31_CIRCLE_GEN.repeated_double(31);
/// assert_eq!(circle_point, CirclePoint::zero());
/// ```
pub const M31_CIRCLE_GEN: CirclePoint<M31> = CirclePoint {
    x: M31::from_u32_unchecked(2),
    y: M31::from_u32_unchecked(1268011823),
};

/// Order of [M31_CIRCLE_GEN].
pub const M31_CIRCLE_LOG_ORDER: u32 = 31;

/// A generator for the circle group over [SecureField].
pub const SECURE_FIELD_CIRCLE_GEN: CirclePoint<SecureField> = CirclePoint {
    x: SecureField::from_u32_unchecked(1, 0, 478637715, 513582971),
    y: SecureField::from_u32_unchecked(992285211, 649143431, 740191619, 1186584352),
};

/// Order of [SECURE_FIELD_CIRCLE_GEN].
pub const SECURE_FIELD_CIRCLE_ORDER: u128 = P4 - 1;

/// Integer i that represent the circle point i * CIRCLE_GEN. Treated as an
/// additive ring modulo `1 << M31_CIRCLE_LOG_ORDER`.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Ord, PartialOrd)]
pub struct CirclePointIndex(pub usize);

impl CirclePointIndex {
    pub const fn zero() -> Self {
        Self(0)
    }

    pub const fn generator() -> Self {
        Self(1)
    }

    pub const fn reduce(self) -> Self {
        Self(self.0 & ((1 << M31_CIRCLE_LOG_ORDER) - 1))
    }

    pub fn subgroup_gen(log_size: u32) -> Self {
        assert!(log_size <= M31_CIRCLE_LOG_ORDER);
        Self(1 << (M31_CIRCLE_LOG_ORDER - log_size))
    }

    pub fn to_point(self) -> CirclePoint<M31> {
        M31_CIRCLE_GEN.mul(self.0 as u128)
    }

    pub fn half(self) -> Self {
        assert!(self.0 & 1 == 0);
        Self(self.0 >> 1)
    }
}

impl Add for CirclePointIndex {
    type Output = Self;

    fn add(self, rhs: Self) -> Self::Output {
        Self(self.0 + rhs.0).reduce()
    }
}

impl Sub for CirclePointIndex {
    type Output = Self;

    fn sub(self, rhs: Self) -> Self::Output {
        Self(self.0 + (1 << M31_CIRCLE_LOG_ORDER) - rhs.0).reduce()
    }
}

impl Mul<usize> for CirclePointIndex {
    type Output = Self;

    fn mul(self, rhs: usize) -> Self::Output {
        Self(self.0.wrapping_mul(rhs)).reduce()
    }
}

impl Neg for CirclePointIndex {
    type Output = Self;

    fn neg(self) -> Self::Output {
        Self((1 << M31_CIRCLE_LOG_ORDER) - self.0).reduce()
    }
}

/// Represents the coset initial + \<step\>.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct Coset {
    pub initial_index: CirclePointIndex,
    pub initial: CirclePoint<M31>,
    pub step_size: CirclePointIndex,
    pub step: CirclePoint<M31>,
    pub log_size: u32,
}

impl Coset {
    pub fn new(initial_index: CirclePointIndex, log_size: u32) -> Self {
        assert!(log_size <= M31_CIRCLE_LOG_ORDER);
        let step_size = CirclePointIndex::subgroup_gen(log_size);
        Self {
            initial_index,
            initial: initial_index.to_point(),
            step: step_size.to_point(),
            step_size,
            log_size,
        }
    }

    /// Creates a coset of the form <G_n>.
    /// For example, for n=8, we get the point indices \[0,1,2,3,4,5,6,7\].
    pub fn subgroup(log_size: u32) -> Self {
        Self::new(CirclePointIndex::zero(), log_size)
    }

    /// Creates a coset of the form G_2n + \<G_n\>.
    /// For example, for n=8, we get the point indices \[1,3,5,7,9,11,13,15\].
    pub fn odds(log_size: u32) -> Self {
        Self::new(CirclePointIndex::subgroup_gen(log_size + 1), log_size)
    }

    /// Creates a coset of the form G_4n + <G_n>.
    /// For example, for n=8, we get the point indices \[1,5,9,13,17,21,25,29\].
    /// Its conjugate will be \[3,7,11,15,19,23,27,31\].
    pub fn half_odds(log_size: u32) -> Self {
        Self::new(CirclePointIndex::subgroup_gen(log_size + 2), log_size)
    }

    /// Returns the size of the coset.
    pub const fn size(&self) -> usize {
        1 << self.log_size()
    }

    /// Returns the log size of the coset.
    pub const fn log_size(&self) -> u32 {
        self.log_size
    }

    pub const fn iter(&self) -> CosetIterator<CirclePoint<M31>> {
        CosetIterator {
            cur: self.initial,
            step: self.step,
            remaining: self.size(),
        }
    }

    pub const fn iter_indices(&self) -> CosetIterator<CirclePointIndex> {
        CosetIterator {
            cur: self.initial_index,
            step: self.step_size,
            remaining: self.size(),
        }
    }

    /// Returns a new coset comprising of all points in current coset doubled.
    pub fn double(&self) -> Self {
        assert!(self.log_size > 0);
        Self {
            initial_index: self.initial_index * 2,
            initial: self.initial.double(),
            step: self.step.double(),
            step_size: self.step_size * 2,
            log_size: self.log_size.saturating_sub(1),
        }
    }

    pub fn repeated_double(&self, n_doubles: u32) -> Self {
        (0..n_doubles).fold(*self, |coset, _| coset.double())
    }

    pub fn is_doubling_of(&self, other: Self) -> bool {
        self.log_size <= other.log_size
            && *self == other.repeated_double(other.log_size - self.log_size)
    }

    pub const fn initial(&self) -> CirclePoint<M31> {
        self.initial
    }

    pub fn index_at(&self, index: usize) -> CirclePointIndex {
        self.initial_index + self.step_size.mul(index)
    }

    pub fn at(&self, index: usize) -> CirclePoint<M31> {
        self.index_at(index).to_point()
    }

      pub fn shift(&self, shift_size: CirclePointIndex) -> Self {
          let initial_index = self.initial_index + shift_size;
          Self {
            initial_index,
            initial: initial_index.to_point(),
            ..*self
        }
    }

    /// Creates the conjugate coset: -initial -\<step\>.
    pub fn conjugate(&self) -> Self {
        let initial_index = -self.initial_index;
        let step_size = -self.step_size;
        Self {
            initial_index,
            initial: initial_index.to_point(),
            step_size,
            step: step_size.to_point(),
            log_size: self.log_size,
        }
    }
}

impl IntoIterator for Coset {
    type Item = CirclePoint<BaseField>;
    type IntoIter = CosetIterator<CirclePoint<BaseField>>;

    /// Iterates over the points in the coset.
    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}

#[derive(Clone)]
pub struct CosetIterator<T: Add> {
    pub cur: T,
    pub step: T,
    pub remaining: usize,
}

impl<T: Add<Output = T> + Copy> Iterator for CosetIterator<T> {
    type Item = T;

    fn next(&mut self) -> Option<Self::Item> {
        if self.remaining == 0 {
            return None;
        }
        self.remaining -= 1;
        let res = self.cur;
        self.cur = self.cur + self.step;
        Some(res)
    }
}

#[cfg(test)]
mod tests {
    use indexmap::IndexSet;
    use num_traits::{One, Pow};

    use super::{CirclePointIndex, Coset};
    use crate::core::channel::Blake2sChannel;
    use crate::core::circle::{CirclePoint, SECURE_FIELD_CIRCLE_GEN};
    use crate::core::fields::qm31::{SecureField, P4};
    use crate::core::fields::FieldExpOps;
    use crate::core::poly::circle::CanonicCoset;

    #[test]
    fn test_iterator() {
        let coset = Coset::new(CirclePointIndex(1), 3);
        let actual_indices: Vec<_> = coset.iter_indices().collect();
        let expected_indices = vec![
            CirclePointIndex(1),
            CirclePointIndex(1) + CirclePointIndex::subgroup_gen(3) * 1,
            CirclePointIndex(1) + CirclePointIndex::subgroup_gen(3) * 2,
            CirclePointIndex(1) + CirclePointIndex::subgroup_gen(3) * 3,
            CirclePointIndex(1) + CirclePointIndex::subgroup_gen(3) * 4,
            CirclePointIndex(1) + CirclePointIndex::subgroup_gen(3) * 5,
            CirclePointIndex(1) + CirclePointIndex::subgroup_gen(3) * 6,
            CirclePointIndex(1) + CirclePointIndex::subgroup_gen(3) * 7,
        ];
        assert_eq!(actual_indices, expected_indices);

        let actual_points = coset.iter().collect::<Vec<_>>();
        let expected_points: Vec<_> = expected_indices.iter().map(|i| i.to_point()).collect();
        assert_eq!(actual_points, expected_points);
    }

    #[test]
    fn test_coset_is_half_coset_with_conjugate() {
        let canonic_coset = CanonicCoset::new(8);
        let coset_points: IndexSet<_> = canonic_coset.coset().iter().collect();

        let half_coset_points: IndexSet<_> = canonic_coset.half_coset().iter().collect();
        let half_coset_conjugate_points: IndexSet<_> =
            canonic_coset.half_coset().conjugate().iter().collect();

        assert!((&half_coset_points & &half_coset_conjugate_points).is_empty());
        assert_eq!(
            coset_points,
            &half_coset_points | &half_coset_conjugate_points
        )
    }

    #[test]
    pub fn test_get_random_circle_point() {
        let mut channel = Blake2sChannel::default();

        let first_random_circle_point = CirclePoint::get_random_point(&mut channel);

        // Assert that the next random circle point is different.
        assert_ne!(
            first_random_circle_point,
            CirclePoint::get_random_point(&mut channel)
        );
    }

    #[test]
    pub fn test_secure_field_circle_gen() {
        let prime_factors = [
            (2, 33),
            (3, 2),
            (5, 1),
            (7, 1),
            (11, 1),
            (31, 1),
            (151, 1),
            (331, 1),
            (733, 1),
            (1709, 1),
            (368140581013, 1),
        ];

        assert_eq!(
            prime_factors
                .iter()
                .map(|(p, e)| p.pow(*e as u32))
                .product::<u128>(),
            P4 - 1
        );
        assert_eq!(
            SECURE_FIELD_CIRCLE_GEN.x.square() + SECURE_FIELD_CIRCLE_GEN.y.square(),
            SecureField::one()
        );
        assert_eq!(SECURE_FIELD_CIRCLE_GEN.mul(P4 - 1), CirclePoint::zero());
        for (p, _) in prime_factors.iter() {
            assert_ne!(
                SECURE_FIELD_CIRCLE_GEN.mul((P4 - 1) / *p),
                CirclePoint::zero()
            );
        }
    }
}
```

 */