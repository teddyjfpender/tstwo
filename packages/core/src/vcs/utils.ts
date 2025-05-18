export interface PeekableIterator<T> extends Iterator<T>, Iterable<T> {
  peek(): T | undefined;
}

/**
 * Creates a simple peekable iterator from any iterable.
 */
export function makePeekable<T>(iterable: Iterable<T>): PeekableIterator<T> {
  const iterator = iterable[Symbol.iterator]();
  let peeked: IteratorResult<T> | null = null;
  const peekable: PeekableIterator<T> = {
    next() {
      if (peeked) {
        const result = peeked;
        peeked = null;
        return result;
      }
      return iterator.next();
    },
    peek() {
      if (peeked === null) {
        peeked = iterator.next();
      }
      return peeked.done ? undefined : peeked.value;
    },
    [Symbol.iterator]() {
      return this;
    },
  };
  return peekable;
}

/**
 * Fetches the next node that needs to be decommited in the current Merkle layer.
 *
 * Port of `vcs/utils.rs` function `next_decommitment_node`.
 * See original Rust reference below for edge-case behavior.
 */
export function nextDecommitmentNode(
  prevQueries: PeekableIterator<number>,
  layerQueries: PeekableIterator<number>,
): number | undefined {
  const candidates: number[] = [];
  const p = prevQueries.peek();
  if (p !== undefined) {
    candidates.push(Math.floor(p / 2));
  }
  const l = layerQueries.peek();
  if (l !== undefined) {
    candidates.push(l);
  }
  if (candidates.length === 0) {
    return undefined;
  }
  return Math.min(...candidates);
}

/**
 * Helper that converts an optional iterable into a peekable iterator.
 *
 * Port of `vcs/utils.rs` function `option_flatten_peekable`.
 * See original Rust reference below for edge-case behavior.
 */
export function optionFlattenPeekable(
  a?: Iterable<number> | null,
): PeekableIterator<number> {
  return makePeekable(a ?? []);
}

/*
This is the Rust code from vcs/utils.rs that needs to be ported to Typescript in this vcs/utils.ts file:
```rs
use std::iter::Peekable;

/// Fetches the next node that needs to be decommited in the current Merkle layer.
pub fn next_decommitment_node(
    prev_queries: &mut Peekable<impl Iterator<Item = usize>>,
    layer_queries: &mut Peekable<impl Iterator<Item = usize>>,
) -> Option<usize> {
    prev_queries
        .peek()
        .map(|q| *q / 2)
        .into_iter()
        .chain(layer_queries.peek().into_iter().copied())
        .min()
}

pub fn option_flatten_peekable<'a, I: IntoIterator<Item = &'a usize>>(
    a: Option<I>,
) -> Peekable<std::iter::Copied<std::iter::Flatten<<Option<I> as IntoIterator>::IntoIter>>> {
    a.into_iter().flatten().copied().peekable()
}
```
*/