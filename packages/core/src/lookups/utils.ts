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