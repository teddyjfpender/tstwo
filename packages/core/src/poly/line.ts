import { Coset, CirclePoint } from "../circle";
import { M31 } from "../fields/m31";
import { QM31 } from "../fields/qm31";
import { SecureColumnByCoords } from "../fields/secure_columns";
import type { ColumnOps } from "../backend";
import { CpuBackend, CpuColumn, bitReverse } from "../backend/cpu";
import { ibutterfly } from "../fft";
import { bitReverseIndex } from "../utils";
import { fold } from "./utils";
import type { CircleDomain } from "./circle";
import type { Backend } from "../backend";

/**
 * Domain comprising of the x-coordinates of points in a Coset.
 * 
 * For use with univariate polynomials.
 */
export class LineDomain {
  private readonly _coset: Coset;

  /**
   * Private constructor to enforce API hygiene.
   * Use LineDomain.new() instead.
   */
  private constructor(coset: Coset) {
    this._coset = coset;
  }

  /**
   * Returns a domain comprising of the x-coordinates of points in a coset.
   * 
   * @throws Error if the coset items don't have unique x-coordinates.
   */
  static new(coset: Coset): LineDomain {
    const size = coset.size();
    
    if (size < 2) {
      // Size 0 or 1 is always valid
    } else if (size === 2) {
      // If the coset with two points contains (0, y) then the coset is {(0, y), (0, -y)}.
      if (coset.initial.x.isZero()) {
        throw new Error("coset x-coordinates not unique");
      }
    } else {
      // Let our coset be `E = c + <G>` with `|E| > 2` then:
      // 1. if `ord(c) <= ord(G)` the coset contains two points at x=0
      // 2. if `ord(c) = 2 * ord(G)` then `c` and `-c` are in our coset
      // Special case: if initial is the identity point (x=1), it's always valid
      const isIdentity = coset.initial.x.equals(M31.ONE);
      if (!isIdentity && !(coset.initial.log_order(M31) >= coset.step.log_order(M31) + 2)) {
        throw new Error("coset x-coordinates not unique");
      }
    }
    
    return new LineDomain(coset);
  }

  /**
   * Returns the `i`th domain element.
   */
  at(i: number): M31 {
    return this._coset.at(i).x;
  }

  /**
   * Returns the size of the domain.
   */
  size(): number {
    return this._coset.size();
  }

  /**
   * Returns the log size of the domain.
   */
  logSize(): number {
    return this._coset.logSize();
  }

  /**
   * Alias for Rust-style `log_size` method name.
   */
  log_size(): number {
    return this.logSize();
  }

  /**
   * Returns an iterator over elements in the domain.
   */
  *iter(): IterableIterator<M31> {
    for (const p of this._coset.iter()) {
      yield p.x;
    }
  }

  /**
   * Returns a new domain comprising of all points in current domain doubled.
   */
  double(): LineDomain {
    return new LineDomain(this._coset.double());
  }

  /**
   * Returns the domain's underlying coset.
   */
  coset(): Coset {
    return this._coset;
  }

  /**
   * Implements IntoIterator for LineDomain.
   */
  [Symbol.iterator](): IterableIterator<M31> {
    return this.iter();
  }
}

/**
 * Creates a LineDomain from a CircleDomain.
 */
export function lineDomainFromCircleDomain(domain: CircleDomain): LineDomain {
  return LineDomain.new(domain.halfCoset);
}

/**
 * A univariate polynomial defined on a LineDomain.
 */
export class LinePoly {
  /**
   * Coefficients of the polynomial in `line_ifft` algorithm's basis.
   * The coefficients are stored in bit-reversed order.
   */
  private readonly _coeffs: QM31[];
  
  /**
   * The number of coefficients stored as `log2(len(coeffs))`.
   */
  private readonly _logSize: number;

  /**
   * Private constructor to enforce API hygiene.
   * Use LinePoly.new() or LinePoly.fromOrderedCoefficients() instead.
   */
  private constructor(coeffs: QM31[]) {
    if (!Number.isInteger(Math.log2(coeffs.length))) {
      throw new Error("coeffs length must be power of two");
    }
    this._coeffs = coeffs.slice();
    this._logSize = Math.log2(coeffs.length);
  }

  /**
   * Creates a new line polynomial from bit reversed coefficients.
   * 
   * @throws Error if the number of coefficients is not a power of two.
   */
  static new(coeffs: QM31[]): LinePoly {
    return new LinePoly(coeffs);
  }

  /**
   * Evaluates the polynomial at a single point.
   */
  evalAtPoint(x: QM31): QM31 {
    let cur = x;
    const doublings: QM31[] = [];
    for (let i = 0; i < this._logSize; i++) {
      doublings.push(cur);
      cur = CirclePoint.double_x(cur, QM31);
    }
    return fold(this._coeffs, doublings);
  }

  /**
   * Alias for Rust-style method name.
   */
  eval_at_point(x: QM31): QM31 {
    return this.evalAtPoint(x);
  }

  /**
   * Returns the number of coefficients.
   */
  len(): number {
    // `.len().ilog2()` is a common operation. By returning the length like so the compiler
    // optimizes `.len().ilog2()` to a load of `log_size` instead of a branch and a bit count.
    return 1 << this._logSize;
  }

  /**
   * Returns the polynomial's coefficients in their natural order.
   */
  intoOrderedCoefficients(): QM31[] {
    const result = this._coeffs.slice();
    bitReverse(result);
    return result;
  }

  /**
   * Alias for Rust-style method name.
   */
  into_ordered_coefficients(): QM31[] {
    return this.intoOrderedCoefficients();
  }

  /**
   * Creates a new line polynomial from coefficients in their natural order.
   * 
   * @throws Error if the number of coefficients is not a power of two.
   */
  static fromOrderedCoefficients(coeffs: QM31[]): LinePoly {
    const bitReversedCoeffs = coeffs.slice();
    bitReverse(bitReversedCoeffs);
    return new LinePoly(bitReversedCoeffs);
  }

  /**
   * Alias for Rust-style method name.
   */
  static from_ordered_coefficients(coeffs: QM31[]): LinePoly {
    return LinePoly.fromOrderedCoefficients(coeffs);
  }

  /**
   * Provides access to the coefficients (read-only).
   */
  get coeffs(): readonly QM31[] {
    return this._coeffs;
  }

  /**
   * Returns a copy of the coefficients array.
   */
  getCoeffs(): QM31[] {
    return this._coeffs.slice();
  }
}

/**
 * A univariate polynomial evaluation on a LineDomain.
 */
export class LineEvaluation<B extends Backend = CpuBackend> {
  /** The values of the polynomial evaluation. */
  readonly values: SecureColumnByCoords<any>;
  /** The domain on which the polynomial is evaluated. */
  protected readonly _domain: LineDomain;

  /**
   * Private constructor to enforce API hygiene.
   * Use LineEvaluation.new() instead.
   */
  protected constructor(domain: LineDomain, values: SecureColumnByCoords<any> | QM31[]) {
    this._domain = domain;
    if (Array.isArray(values)) {
      // Convert QM31[] to SecureColumnByCoords
      this.values = SecureColumnByCoords.from(values);
    } else {
      this.values = values;
    }
  }

  /**
   * Creates a new line evaluation.
   * 
   * @throws Error if the domain size doesn't match the values length.
   */
  static new<B extends Backend = CpuBackend>(
    domain: LineDomain, 
    values: SecureColumnByCoords<any> | QM31[]
  ): LineEvaluation<B> {
    const valuesLength = Array.isArray(values) ? values.length : values.len();
    if (domain.size() !== valuesLength) {
      throw new Error("domain size must match values length");
    }
    return new LineEvaluation(domain, values);
  }

  /** Creates a new line evaluation with all zero values. */
  static newZero<B extends Backend = CpuBackend>(domain: LineDomain): LineEvaluation<B> {
    const values = SecureColumnByCoords.zeros<any>(domain.size());
    return LineEvaluation.new(domain, values);
  }

  /** Alias for Rust-style method name. */
  static new_zero<B extends Backend = CpuBackend>(domain: LineDomain): LineEvaluation<B> {
    return LineEvaluation.newZero(domain);
  }

  /** Returns the number of evaluations. */
  len(): number {
    return this._domain.size();
  }

  /** Returns the domain. */
  domain(): LineDomain {
    return this._domain;
  }

  /** Converts to CPU backend. */
  toCpu(): LineEvaluation<CpuBackend> {
    return new LineEvaluation(this._domain, this.values.to_cpu()) as LineEvaluation<CpuBackend>;
  }

  /** Alias for Rust-style method name. */
  to_cpu(): LineEvaluation<CpuBackend> {
    return this.toCpu();
  }

  /**
   * Interpolates the polynomial as evaluations on `domain`.
   * This method works for any backend but is most efficient on CPU.
   */
  interpolate(): LinePoly {
    const values = this.values.to_vec(); // Get QM31[] from SecureColumnByCoords
    bitReverse(values);
    lineIfft(values, this._domain);
    
    // Normalize the coefficients.
    const lenInv = M31.from(values.length).inverse();
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (!value) {
        throw new Error(`Undefined value at index ${i}`);
      }
      values[i] = value.mulM31(lenInv);
    }
    
    return LinePoly.new(values);
  }
}

/**
 * Performs a univariate IFFT on a polynomial's evaluation over a LineDomain.
 *
 * This is not the standard univariate IFFT, because LineDomain is not a cyclic group.
 *
 * The transform happens in-place. `values` should be the evaluations of a polynomial over `domain`
 * in their natural order. After the transformation `values` becomes the coefficients of the
 * polynomial stored in bit-reversed order.
 *
 * For performance reasons and flexibility the normalization of the coefficients is omitted. The
 * normalized coefficients can be obtained by scaling all coefficients by `1 / len(values)`.
 *
 * This algorithm does not return coefficients in the standard monomial basis but rather returns
 * coefficients in a basis relating to the circle's x-coordinate doubling map `pi(x) = 2x^2 - 1`
 * i.e.
 *
 * ```text
 * B = { 1 } * { x } * { pi(x) } * { pi(pi(x)) } * ...
 *   = { 1, x, pi(x), pi(x) * x, pi(pi(x)), pi(pi(x)) * x, pi(pi(x)) * pi(x), ... }
 * ```
 *
 * @throws Error if the number of values doesn't match the size of the domain.
 */
function lineIfft(values: QM31[], domain: LineDomain): void {
  if (values.length !== domain.size()) {
    throw new Error("lineIfft: values length doesn't match domain size");
  }
  
  let currentDomain = domain;
  while (currentDomain.size() > 1) {
    const domainSize = currentDomain.size();
    
    // Process each chunk of the current domain size
    for (let chunkStart = 0; chunkStart < values.length; chunkStart += domainSize) {
      const halfSize = domainSize / 2;
      
      // Split the chunk into left and right halves
      for (let i = 0; i < halfSize; i++) {
        const leftIdx = chunkStart + i;
        const rightIdx = chunkStart + i + halfSize;
        
        // Use the domain element at index i for the ibutterfly operation
        const x = currentDomain.at(i).inverse();
        
        const leftValue = values[leftIdx];
        const rightValue = values[rightIdx];
        if (!leftValue || !rightValue) {
          throw new Error(`Undefined values at indices ${leftIdx}, ${rightIdx}`);
        }
        
        const [newLeft, newRight] = ibutterfly(leftValue, rightValue, x);
        values[leftIdx] = newLeft;
        values[rightIdx] = newRight;
      }
    }
    
    // Double the domain for the next iteration
    currentDomain = currentDomain.double();
  }
}

/**
 * Alias for Rust-style function name.
 */
function line_ifft(values: QM31[], domain: LineDomain): void {
  return lineIfft(values, domain);
}