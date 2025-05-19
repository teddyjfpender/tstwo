import { describe, it, expect } from "vitest";
import { FriConfig } from "../../src/fri";

describe("FriConfig", () => {
  it("constructs with valid parameters", () => {
    const cfg = new FriConfig(2, 4, 3);
    expect(cfg.log_last_layer_degree_bound).toBe(2);
    expect(cfg.log_blowup_factor).toBe(4);
    expect(cfg.n_queries).toBe(3);
    expect(cfg.last_layer_domain_size()).toBe(1 << (2 + 4));
    expect(cfg.security_bits()).toBe(4 * 3);
  });

  it("throws on invalid parameters", () => {
    expect(() => new FriConfig(11, 4, 1)).toThrow();
    expect(() => new FriConfig(2, 0, 1)).toThrow();
    expect(() => new FriConfig(2, 17, 1)).toThrow();
  });
});
