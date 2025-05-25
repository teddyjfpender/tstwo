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

  intoEf<EF extends Field<EF>>(convert: (v: F) => EF): CirclePoint<EF> {
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
  SecureField.from_u32_unchecked(1, 0, 478637715, 513582971),
  SecureField.from_u32_unchecked(992285211, 649143431, 740191619, 1186584352)
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

  /** Return the logarithmic size of the coset. */
  logSize(): number {
    return this.log_size;
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
    if (this.remaining === 0) {
      return { done: true, value: undefined };
    }
    const value = this.cur;
    this.cur = (this.cur as any).add(this.step);
    this.remaining--;
    return { done: false, value };
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this;
  }
}

/**
 * A coset of the form `G_{2n} + <G_n>`, where `G_n` is the generator of the subgroup of order `n`.
 * 
 * TypeScript port of the Rust CanonicCoset.
 * These cosets avoid zero x-coordinates by using odds cosets.
 */
export class CanonicCoset {
  public coset: Coset;

  constructor(log_size: number) {
    if (log_size <= 0) {
      throw new Error("log_size must be positive");
    }
    this.coset = Coset.odds(log_size);
  }

  /** Gets the full coset represented G_{2n} + <G_n>. */
  getCoset(): Coset {
    return this.coset;
  }

  /** Gets half of the coset (its conjugate complements to the whole coset), G_{2n} + <G_{n/2}> */
  halfCoset(): Coset {
    return Coset.half_odds(this.logSize() - 1);
  }

  /** Gets the CircleDomain representing the same point set (in another order). */
  circleDomain(): CircleDomain {
    return new CircleDomain(this.halfCoset());
  }

  /** Returns the log size of the coset. */
  logSize(): number {
    return this.coset.log_size;
  }

  /** Returns the size of the coset. */
  size(): number {
    return this.coset.size();
  }

  /** Gets the initial index. */
  initialIndex(): CirclePointIndex {
    return this.coset.initial_index;
  }

  /** Gets the step size. */
  stepSize(): CirclePointIndex {
    return this.coset.step_size;
  }

  /** Gets the step. */
  step(): CirclePoint<M31> {
    return this.coset.step;
  }

  /** Gets the index at the given position. */
  indexAt(index: number): CirclePointIndex {
    return this.coset.index_at(index);
  }

  /** Gets the point at the given position. */
  at(i: number): CirclePoint<M31> {
    return this.coset.at(i);
  }
}

/**
 * A valid domain for circle polynomial interpolation and evaluation.
 * 
 * Valid domains are a disjoint union of two conjugate cosets: `+-C + <G_n>`.
 * The ordering defined on this domain is `C + iG_n`, and then `-C - iG_n`.
 * 
 * TypeScript port of the Rust CircleDomain.
 */
export class CircleDomain {
  public half_coset: Coset;

  constructor(half_coset: Coset) {
    this.half_coset = half_coset;
  }

  /** Returns the size of the domain. */
  size(): number {
    return 1 << this.logSize();
  }

  /** Returns the log size of the domain. */
  logSize(): number {
    return this.half_coset.log_size + 1;
  }

  /** Returns the `i` th domain element. */
  at(i: number): CirclePoint<M31> {
    return this.indexAt(i).to_point();
  }

  /** Returns the CirclePointIndex of the `i`th domain element. */
  indexAt(i: number): CirclePointIndex {
    if (i < this.half_coset.size()) {
      return this.half_coset.index_at(i);
    } else {
      return this.half_coset.index_at(i - this.half_coset.size()).neg();
    }
  }

  /** Returns true if the domain is canonic. */
  isCanonic(): boolean {
    return this.half_coset.initial_index.value * 4 === this.half_coset.step_size.value;
  }

  /** Shifts the domain by the given offset. */
  shift(shift: CirclePointIndex): CircleDomain {
    return new CircleDomain(this.half_coset.shift(shift));
  }

  /** TypeScript-style getter for API compatibility */
  get halfCoset(): Coset {
    return this.half_coset;
  }
}