import { afterEach, describe, expect, it, vi } from "vitest";

// config.ts reads env at module load, so each case imports a fresh copy.
async function freshConfig() {
  vi.resetModules();
  return import("../src/config.js");
}

const KEYS = ["BASE_SPREAD_BPS", "MAX_QUOTE_USDT"] as const;

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
  vi.resetModules();
});

describe("config env parsing", () => {
  it("rejects a non-numeric override instead of silently disabling caps", async () => {
    process.env.MAX_QUOTE_USDT = "five-hundred";
    await expect(freshConfig()).rejects.toThrow(/MAX_QUOTE_USDT/);
  });

  it("rejects a negative override", async () => {
    process.env.BASE_SPREAD_BPS = "-3";
    await expect(freshConfig()).rejects.toThrow(/BASE_SPREAD_BPS/);
  });

  it("accepts a valid override", async () => {
    process.env.MAX_QUOTE_USDT = "42";
    const { PARAMS } = await freshConfig();
    expect(PARAMS.maxQuoteUsdt).toBe(42);
  });
});
