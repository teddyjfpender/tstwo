import type { ExtensionOf, Field } from "../fields";
/*
// Folds values recursively in `O(n)` by a hierarchical application of folding factors.
///
/// i.e. folding `n = 8` values with `folding_factors = [x, y, z]`:
///
/// ```text
///               n2=n1+x*n2
///           /               \
///     n1=n3+y*n4          n2=n5+y*n6
///      /      \            /      \
/// n3=a+z*b  n4=c+z*d  n5=e+z*f  n6=g+z*h
///   /  \      /  \      /  \      /  \
///  a    b    c    d    e    f    g    h
/// ```
///
/// # Panics
///
/// Panics if the number of values is not a power of two or if an incorrect number of of folding
/// factors is provided.
*/
// TODO: import { LineDomain } from "./line";
// Once `line.ts` is implemented, update this import and ensure it exposes
// `LineDomain` with `coset(): { size(): number; logSize(): number }`.

/**
 * Folds values recursively in `O(n)` by a hierarchical application of folding
 * factors.
 *
 * Panics in Rust when the number of values is not a power of two or if an
 * incorrect number of folding factors is provided. In TypeScript we throw an
 * `Error` in these cases.
 */
export function fold<F extends Field<F>, E extends ExtensionOf<F, E>>(
  values: F[],
  foldingFactors: E[],
): E {
  const n = values.length;
  if (n !== 1 << foldingFactors.length) {
    throw new Error("fold: invalid input lengths");
  }

  if (n === 1) {
    // TODO: Convert from base field `F` to extension field `E` when the
    // conversion utilities are implemented.
    return values[0] as unknown as E;
  }

  const half = n / 2;
  const [foldingFactor, ...rest] = foldingFactors;
  const lhsVal = fold(values.slice(0, half), rest);
  const rhsVal = fold(values.slice(half), rest);
  return lhsVal.add(rhsVal.mul(foldingFactor));
}

/**
 * Repeats each value sequentially `duplicity` many times.
 */
export function repeatValue<T>(values: readonly T[], duplicity: number): T[] {
  const res: T[] = [];
  for (const v of values) {
    for (let i = 0; i < duplicity; i++) {
      res.push(v);
    }
  }
  return res;
}

/**
 * Computes the line twiddles for a `CircleDomain` or a `LineDomain` from the
 * precomputed twiddle tree. This function requires the yet-to-be-ported
 * `LineDomain` type.
 */
export function domainLineTwiddlesFromTree<T>(
  domain: unknown, // TODO: replace with `LineDomain` once available
  twiddleBuffer: readonly T[],
): T[][] {
  const d: any = (domain as any).into ? (domain as any).into() : domain;

  if (d.coset().size() > twiddleBuffer.length) {
    throw new Error("Not enough twiddles!");
  }

  const result: T[][] = [];
  for (let i = 0; i < d.coset().logSize(); i++) {
    const len = 1 << i;
    result.unshift(
      twiddleBuffer.slice(
        twiddleBuffer.length - len * 2,
        twiddleBuffer.length - len,
      ),
    );
  }
  return result;
}
