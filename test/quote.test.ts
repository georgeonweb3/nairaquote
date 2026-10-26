import { describe, expect, it } from "vitest";
import { inventorySkewBps, priceQuote, halfSpreadBps } from "../src/engine/quote.js";
import { EwmaVol } from "../src/engine/volatility.js";

const mid = 1384;
const balanced = { usdt: 500, cngn: 500 * mid };

describe("quoting engine", () => {
  it("quotes around mid with a positive spread when balanced", () => {
    const m = { mid, volBps: 0 };
    const ask = priceQuote("taker_buys_usdt", 50, m, balanced)!;
    const bid = priceQuote("taker_sells_usdt", 50, m, balanced)!;
    expect(ask.price).toBeGreaterThan(mid);
    expect(bid.price).toBeLessThan(mid);
    expect(ask.skewBps).toBeCloseTo(0);
  });

  it("widens with volatility", () => {
    expect(halfSpreadBps(20)).toBeGreaterThan(halfSpreadBps(0));
  });

  it("skews prices down when long USDT", () => {
    const longUsdt = { usdt: 900, cngn: 100 * mid };
    expect(inventorySkewBps(longUsdt, mid)).toBeGreaterThan(0);
    const a = priceQuote("taker_buys_usdt", 50, { mid, volBps: 0 }, longUsdt)!;
    const b = priceQuote("taker_buys_usdt", 50, { mid, volBps: 0 }, balanced)!;
    expect(a.price).toBeLessThan(b.price);
  });

  it("refuses oversized requests and extreme volatility", () => {
    expect(priceQuote("taker_buys_usdt", 10_000, { mid, volBps: 0 }, balanced)).toBeNull();
    expect(priceQuote("taker_buys_usdt", 50, { mid, volBps: 500 }, balanced)).toBeNull();
  });

  it("ewma vol is zero for a flat series and rises on moves", () => {
    const v = new EwmaVol();
    [mid, mid, mid].forEach((p) => v.update(p));
    expect(v.bps()).toBe(0);
    v.update(mid * 1.01);
    expect(v.bps()).toBeGreaterThan(0);
  });
});
