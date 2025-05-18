import { describe, it, expect } from "vitest";
import { Queries, QueryChannel } from "../../src/queries";
import { CanonicCoset } from "../../src/poly/circle/canonic";
import { CirclePoint } from "../../src/circle";
import { bitReverseIndex } from "../../src/utils";

class DummyChannel implements QueryChannel {
  private counter = 1;
  draw_random_bytes(): Uint8Array {
    const arr = new Uint8Array(32);
    for (let i = 0; i < arr.length; i++) arr[i] = (this.counter++ & 0xff);
    return arr;
  }
}

function bitReverse<T>(vals: T[]): T[] {
  const n = vals.length;
  const logN = Math.log2(n);
  const res = Array(n) as T[];
  for (let i = 0; i < n; i++) {
    const j = bitReverseIndex(i, logN);
    res[j] = vals[i];
  }
  return res;
}

describe("Queries", () => {
  it("generate produces sorted unique queries", () => {
    const channel = new DummyChannel();
    const queries = Queries.generate(channel, 8, 20);
    expect(queries.length).toBe(20);
    const sorted = [...queries.positions].sort((a,b)=>a-b);
    expect(queries.positions).toEqual(sorted);
    expect(new Set(queries.positions).size).toBe(20);
    expect(Math.max(...queries.positions)).toBeLessThan(1<<8);
  });

  it("fold maps to smaller domain", () => {
    const logDomain = 7;
    const queries = Queries.from_positions(
      Array.from({ length: 1 << logDomain }, (_, i) => i),
      logDomain,
    );
    const nFolds = 2;
    const folded = queries.fold(nFolds);
    expect(folded.log_domain_size).toBe(logDomain - nFolds);
    const sorted = [...folded.positions].sort((a, b) => a - b);
    expect(folded.positions).toEqual(sorted);
    expect(new Set(folded.positions).size).toBe(folded.positions.length);
  });
});
