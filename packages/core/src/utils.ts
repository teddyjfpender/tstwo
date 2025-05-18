/**
 * Utility functions used across the core package.
 */

/**
 * Returns the bit reversed index of `idx` with respect to a domain of size
 * `2^logSize`.
 *
 * This mirrors the typical implementation in Rust where the bits of `idx` are
 * reversed up to `logSize` bits. Useful for converting between natural and
 * bit-reversed orderings when performing FFTs.
 */
export function bitReverseIndex(idx: number, logSize: number): number {
  let rev = 0;
  for (let i = 0; i < logSize; i++) {
    rev = (rev << 1) | (idx & 1);
    idx >>>= 1;
  }
  return rev;
}

