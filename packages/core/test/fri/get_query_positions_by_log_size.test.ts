import { describe, it, expect } from "vitest";
import { Queries } from "../../src/queries";
import { get_query_positions_by_log_size } from "../../src/queries";

describe("get_query_positions_by_log_size", () => {
  it("maps queries by column log size", () => {
    const queries = Queries.from_positions([1, 3, 5, 7], 3);
    const columnLogSizes = new Set<number>([3, 2]);
    const res = get_query_positions_by_log_size(queries, columnLogSizes);
    expect(res.get(3)).toEqual([1, 3, 5, 7]);
    expect(res.get(2)).toEqual([0, 1, 2, 3]);
  });
});
