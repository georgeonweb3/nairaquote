import { afterEach, describe, expect, it, vi } from "vitest";
import { textileTicker } from "../src/feeds/textile.js";

function stubTickers(rows: Array<Record<string, string>>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => rows })),
  );
}

const row = (bid: string, ask: string) => ({
  ticker_id: "USDT_NGN",
  bid,
  ask,
  last_price: ask,
  base_volume: "1000",
});

describe("textileTicker validation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses a normal book", async () => {
    stubTickers([row("1374.70", "1375.41")]);
    const t = await textileTicker();
    expect(t.bid).toBe(1374.7);
    expect(t.ask).toBe(1375.41);
  });

  it("accepts a small cross (indicative multi-filler snapshot noise)", async () => {
    // bid 1378.59 / ask 1378.41 is a ~1.3 bps cross, observed live 2026-11-08.
    stubTickers([row("1378.59", "1378.41")]);
    const t = await textileTicker();
    expect(t.bid).toBe(1378.59);
    expect(t.ask).toBe(1378.41);
  });

  it("rejects a large cross as malformed data", async () => {
    // bid 101 / ask 100 is a ~99.5 bps cross — the snapshot is garbage.
    stubTickers([row("101", "100")]);
    await expect(textileTicker()).rejects.toThrow(/malformed ticker/);
  });

  it("rejects non-numeric and non-positive prices", async () => {
    stubTickers([row("n/a", "1375.41")]);
    await expect(textileTicker()).rejects.toThrow(/malformed ticker/);
    stubTickers([row("1374.70", "0")]);
    await expect(textileTicker()).rejects.toThrow(/malformed ticker/);
  });
});
