//! A reference implementation of the BLAKE2s compression function, in pure TypeScript.
//! Based on the Rust implementation from blake2_simd.

export const IV: readonly number[] = [
  0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 
  0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
] as const;

export const SIGMA: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
] as const;

function add(a: number, b: number): number {
  return (a + b) >>> 0; // Ensure 32-bit unsigned arithmetic
}

function xor(a: number, b: number): number {
  return (a ^ b) >>> 0;
}

function rot16(x: number): number {
  return ((x >>> 16) | (x << 16)) >>> 0;
}

function rot12(x: number): number {
  return ((x >>> 12) | (x << 20)) >>> 0;
}

function rot8(x: number): number {
  return ((x >>> 8) | (x << 24)) >>> 0;
}

function rot7(x: number): number {
  return ((x >>> 7) | (x << 25)) >>> 0;
}

function round(v: number[], m: readonly number[], r: number): void {
  if (r < 0 || r >= SIGMA.length) {
    throw new Error(`Invalid round index: ${r}`);
  }
  
  const sigma = SIGMA[r]!;
  if (sigma.length !== 16) {
    throw new Error(`SIGMA[${r}] is invalid`);
  }
  
  if (m.length !== 16) {
    throw new Error('Message vector must have exactly 16 elements');
  }

  v[0] = add(v[0]!, m[sigma[0]!]!);
  v[1] = add(v[1]!, m[sigma[2]!]!);
  v[2] = add(v[2]!, m[sigma[4]!]!);
  v[3] = add(v[3]!, m[sigma[6]!]!);
  v[0] = add(v[0]!, v[4]!);
  v[1] = add(v[1]!, v[5]!);
  v[2] = add(v[2]!, v[6]!);
  v[3] = add(v[3]!, v[7]!);
  v[12] = xor(v[12]!, v[0]!);
  v[13] = xor(v[13]!, v[1]!);
  v[14] = xor(v[14]!, v[2]!);
  v[15] = xor(v[15]!, v[3]!);
  v[12] = rot16(v[12]!);
  v[13] = rot16(v[13]!);
  v[14] = rot16(v[14]!);
  v[15] = rot16(v[15]!);
  v[8] = add(v[8]!, v[12]!);
  v[9] = add(v[9]!, v[13]!);
  v[10] = add(v[10]!, v[14]!);
  v[11] = add(v[11]!, v[15]!);
  v[4] = xor(v[4]!, v[8]!);
  v[5] = xor(v[5]!, v[9]!);
  v[6] = xor(v[6]!, v[10]!);
  v[7] = xor(v[7]!, v[11]!);
  v[4] = rot12(v[4]!);
  v[5] = rot12(v[5]!);
  v[6] = rot12(v[6]!);
  v[7] = rot12(v[7]!);
  v[0] = add(v[0]!, m[sigma[1]!]!);
  v[1] = add(v[1]!, m[sigma[3]!]!);
  v[2] = add(v[2]!, m[sigma[5]!]!);
  v[3] = add(v[3]!, m[sigma[7]!]!);
  v[0] = add(v[0]!, v[4]!);
  v[1] = add(v[1]!, v[5]!);
  v[2] = add(v[2]!, v[6]!);
  v[3] = add(v[3]!, v[7]!);
  v[12] = xor(v[12]!, v[0]!);
  v[13] = xor(v[13]!, v[1]!);
  v[14] = xor(v[14]!, v[2]!);
  v[15] = xor(v[15]!, v[3]!);
  v[12] = rot8(v[12]!);
  v[13] = rot8(v[13]!);
  v[14] = rot8(v[14]!);
  v[15] = rot8(v[15]!);
  v[8] = add(v[8]!, v[12]!);
  v[9] = add(v[9]!, v[13]!);
  v[10] = add(v[10]!, v[14]!);
  v[11] = add(v[11]!, v[15]!);
  v[4] = xor(v[4]!, v[8]!);
  v[5] = xor(v[5]!, v[9]!);
  v[6] = xor(v[6]!, v[10]!);
  v[7] = xor(v[7]!, v[11]!);
  v[4] = rot7(v[4]!);
  v[5] = rot7(v[5]!);
  v[6] = rot7(v[6]!);
  v[7] = rot7(v[7]!);

  v[0] = add(v[0]!, m[sigma[8]!]!);
  v[1] = add(v[1]!, m[sigma[10]!]!);
  v[2] = add(v[2]!, m[sigma[12]!]!);
  v[3] = add(v[3]!, m[sigma[14]!]!);
  v[0] = add(v[0]!, v[5]!);
  v[1] = add(v[1]!, v[6]!);
  v[2] = add(v[2]!, v[7]!);
  v[3] = add(v[3]!, v[4]!);
  v[15] = xor(v[15]!, v[0]!);
  v[12] = xor(v[12]!, v[1]!);
  v[13] = xor(v[13]!, v[2]!);
  v[14] = xor(v[14]!, v[3]!);
  v[15] = rot16(v[15]!);
  v[12] = rot16(v[12]!);
  v[13] = rot16(v[13]!);
  v[14] = rot16(v[14]!);
  v[10] = add(v[10]!, v[15]!);
  v[11] = add(v[11]!, v[12]!);
  v[8] = add(v[8]!, v[13]!);
  v[9] = add(v[9]!, v[14]!);
  v[5] = xor(v[5]!, v[10]!);
  v[6] = xor(v[6]!, v[11]!);
  v[7] = xor(v[7]!, v[8]!);
  v[4] = xor(v[4]!, v[9]!);
  v[5] = rot12(v[5]!);
  v[6] = rot12(v[6]!);
  v[7] = rot12(v[7]!);
  v[4] = rot12(v[4]!);
  v[0] = add(v[0]!, m[sigma[9]!]!);
  v[1] = add(v[1]!, m[sigma[11]!]!);
  v[2] = add(v[2]!, m[sigma[13]!]!);
  v[3] = add(v[3]!, m[sigma[15]!]!);
  v[0] = add(v[0]!, v[5]!);
  v[1] = add(v[1]!, v[6]!);
  v[2] = add(v[2]!, v[7]!);
  v[3] = add(v[3]!, v[4]!);
  v[15] = xor(v[15]!, v[0]!);
  v[12] = xor(v[12]!, v[1]!);
  v[13] = xor(v[13]!, v[2]!);
  v[14] = xor(v[14]!, v[3]!);
  v[15] = rot8(v[15]!);
  v[12] = rot8(v[12]!);
  v[13] = rot8(v[13]!);
  v[14] = rot8(v[14]!);
  v[10] = add(v[10]!, v[15]!);
  v[11] = add(v[11]!, v[12]!);
  v[8] = add(v[8]!, v[13]!);
  v[9] = add(v[9]!, v[14]!);
  v[5] = xor(v[5]!, v[10]!);
  v[6] = xor(v[6]!, v[11]!);
  v[7] = xor(v[7]!, v[8]!);
  v[4] = xor(v[4]!, v[9]!);
  v[5] = rot7(v[5]!);
  v[6] = rot7(v[6]!);
  v[7] = rot7(v[7]!);
  v[4] = rot7(v[4]!);
}

/** Performs a Blake2s compression. */
export function compress(
  hVecs: readonly number[],
  msgVecs: readonly number[],
  countLow: number,
  countHigh: number,
  lastblock: number,
  lastnode: number
): number[] {
  if (hVecs.length !== 8) {
    throw new Error('hVecs must have exactly 8 elements');
  }
  if (msgVecs.length !== 16) {
    throw new Error('msgVecs must have exactly 16 elements');
  }

  const v = [
    hVecs[0]!,
    hVecs[1]!,
    hVecs[2]!,
    hVecs[3]!,
    hVecs[4]!,
    hVecs[5]!,
    hVecs[6]!,
    hVecs[7]!,
    IV[0]!,
    IV[1]!,
    IV[2]!,
    IV[3]!,
    xor(IV[4]!, countLow),
    xor(IV[5]!, countHigh),
    xor(IV[6]!, lastblock),
    xor(IV[7]!, lastnode),
  ];

  round(v, msgVecs, 0);
  round(v, msgVecs, 1);
  round(v, msgVecs, 2);
  round(v, msgVecs, 3);
  round(v, msgVecs, 4);
  round(v, msgVecs, 5);
  round(v, msgVecs, 6);
  round(v, msgVecs, 7);
  round(v, msgVecs, 8);
  round(v, msgVecs, 9);

  return [
    xor(xor(hVecs[0]!, v[0]!), v[8]!),
    xor(xor(hVecs[1]!, v[1]!), v[9]!),
    xor(xor(hVecs[2]!, v[2]!), v[10]!),
    xor(xor(hVecs[3]!, v[3]!), v[11]!),
    xor(xor(hVecs[4]!, v[4]!), v[12]!),
    xor(xor(hVecs[5]!, v[5]!), v[13]!),
    xor(xor(hVecs[6]!, v[6]!), v[14]!),
    xor(xor(hVecs[7]!, v[7]!), v[15]!),
  ];
} 