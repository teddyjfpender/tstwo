import { describe, it, expect } from "vitest";
import { commitOnLayer } from "../../src/backend/cpu/blake2";
import { M31 } from "../../src/fields/m31";
import { createHash } from "crypto";

function hashColumns(prev: Uint8Array[] | undefined, columns: number[][]) {
  const size = columns[0].length;
  const result: Uint8Array[] = new Array(size);
  for (let i = 0; i < size; i++) {
    const h = createHash("sha256");
    if (prev) {
      h.update(prev[2 * i]);
      h.update(prev[2 * i + 1]);
    }
    for (const col of columns) {
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(col[i] >>> 0, 0);
      h.update(buf);
    }
    result[i] = new Uint8Array(h.digest());
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
    expect(Array.from(res[0])).toEqual(Array.from(expected[0]));
    expect(Array.from(res[1])).toEqual(Array.from(expected[1]));
  });
});
