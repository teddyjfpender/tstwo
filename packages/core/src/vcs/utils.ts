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