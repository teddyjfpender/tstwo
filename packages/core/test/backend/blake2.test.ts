import { describe, it, expect } from "vitest";
import { commitOnLayer } from "../../src/backend/cpu/blake2";
import { M31 } from "../../src/fields/m31";
import { blake2s } from '@noble/hashes/blake2';

function hashColumns(prev: Uint8Array[] | undefined, columns: number[][]): Uint8Array[] {
  if (!columns.length || !columns[0]?.length) {
    throw new Error("Columns must be non-empty");
  }
  const size = columns[0].length;
  const result: Uint8Array[] = new Array(size);
  for (let i = 0; i < size; i++) {
    let message: Uint8Array;
    if (prev && prev[2 * i] && prev[2 * i + 1]) {
      const left = prev[2 * i]!;
      const right = prev[2 * i + 1]!;
      message = new Uint8Array(left.length + right.length);
      message.set(left, 0);
      message.set(right, left.length);
    } else {
      const leafNumbers: number[] = [];
      for (const col of columns) {
        const value = col[i];
        if (typeof value === 'number') {
          leafNumbers.push(value >>> 0);
        }
      }
      const bytes = new Uint8Array(leafNumbers.length * 4);
      const view = new DataView(bytes.buffer);
      for (let j = 0; j < leafNumbers.length; j++) {
        view.setUint32(j * 4, leafNumbers[j], true);
      }
      message = bytes;
    }
    result[i] = blake2s(message, { dkLen: 32 });
  }
  return result;
}

describe("commitOnLayer", () => {
  it("hashes columns into next layer", () => {
    const cols = [
      [M31.from(1).value, M31.from(2).value],
      [M31.from(3).value, M31.from(4).value],
    ];
    const res = commitOnLayer(1, undefined, cols);
    const expected = hashColumns(undefined, cols);
    expect(Array.from(res[0] as Uint8Array)).toEqual(Array.from(expected[0]));
    expect(Array.from(res[1] as Uint8Array)).toEqual(Array.from(expected[1]));
  });
});
