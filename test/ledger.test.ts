import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendRecord,
  fillPnlNgn,
  readRecords,
  summarize,
  type FillRecord,
  type QuoteRecord,
} from "../src/engine/ledger.js";

const quote: QuoteRecord = {
  type: "quote",
  at: "2026-11-09T00:00:00.000Z",
  side: "taker_buys_usdt",
  sizeUsdt: 100,
  price: 1379.03,
  mid: 1378.4,
  reason: "quoted: …",
  inventorySource: "paper — agent wallet holds no cNGN/USDT yet",
};
const sellFill: FillRecord = {
  type: "fill",
  at: "2026-11-09T00:01:00.000Z",
  side: "taker_buys_usdt", // we sold USDT at the ask
  sizeUsdt: 100,
  price: 1379.03,
  midAtFill: 1378.4,
};
const buyFill: FillRecord = {
  type: "fill",
  at: "2026-11-09T00:02:00.000Z",
  side: "taker_sells_usdt", // we bought USDT at the bid
  sizeUsdt: 50,
  price: 1377.82,
  midAtFill: 1378.4,
};

describe("ledger", () => {
  it("marks fill P&L against the mid, on both sides", () => {
    expect(fillPnlNgn(sellFill)).toBeCloseTo((1379.03 - 1378.4) * 100);
    expect(fillPnlNgn(buyFill)).toBeCloseTo((1378.4 - 1377.82) * 50);
  });

  it("summarizes volume and P&L vs a fixed-spread baseline", () => {
    const s = summarize([quote, quote, sellFill, buyFill], 5);
    expect(s.quotesAnswered).toBe(2);
    expect(s.quotesFilled).toBe(2);
    expect(s.volumeQuotedUsdt).toBe(200);
    expect(s.volumeFilledUsdt).toBe(150);
    expect(s.pnlNgn).toBeCloseTo(fillPnlNgn(sellFill) + fillPnlNgn(buyFill));
    // Baseline: 5 bps of mid on every filled USDT.
    expect(s.baselineNgn).toBeCloseTo(1378.4 * 0.0005 * 150);
    expect(s.pnlVsBaselineNgn).toBeCloseTo(s.pnlNgn - s.baselineNgn);
  });

  it("reports zero P&L honestly when there are quotes but no fills", () => {
    const s = summarize([quote]);
    expect(s.quotesFilled).toBe(0);
    expect(s.pnlNgn).toBe(0);
    expect(s.volumeFilledUsdt).toBe(0);
  });

  it("round-trips records through JSONL on disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "nq-ledger-"));
    const path = join(dir, "ticks.jsonl");
    appendRecord(path, quote);
    appendRecord(path, sellFill);
    const back = readRecords(path);
    expect(back).toHaveLength(2);
    expect(back[0]).toEqual(quote);
    expect(back[1]).toEqual(sellFill);
    expect(readRecords(join(dir, "missing.jsonl"))).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});
