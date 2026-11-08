import { describe, expect, it } from "vitest";
import {
  inventorySkewBps,
  priceQuote,
  halfSpreadBps,
  quoteHaltReason,
  quoteSizeUsdt,
} from "../src/engine/quote.js";
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

  it("refuses requests above the per-quote share of payable inventory", () => {
    // 200 USDT is under the 500 absolute cap but over 25% of the 500 USDT held.
    expect(priceQuote("taker_buys_usdt", 200, { mid, volBps: 0 }, balanced)).toBeNull();
    expect(priceQuote("taker_buys_usdt", 125, { mid, volBps: 0 }, balanced)).not.toBeNull();
  });

  it("refuses zero, negative and NaN request sizes", () => {
    for (const size of [0, -10, Number.NaN]) {
      expect(priceQuote("taker_buys_usdt", size, { mid, volBps: 0 }, balanced)).toBeNull();
      expect(priceQuote("taker_sells_usdt", size, { mid, volBps: 0 }, balanced)).toBeNull();
    }
  });

  it("halts when the book diverges sharply from the reference rate", () => {
    // Reference 20% away from mid — far beyond the 1000 bps halt.
    expect(priceQuote("taker_buys_usdt", 50, { mid, volBps: 0, refRate: mid * 0.8 }, balanced)).toBeNull();
    // Reference ~2% away (typical official-vs-market gap) still quotes.
    expect(priceQuote("taker_buys_usdt", 50, { mid, volBps: 0, refRate: mid * 0.98 }, balanced)).not.toBeNull();
  });

  it("explains every decision: reason on quotes, halt reason on refusals", () => {
    const q = priceQuote("taker_buys_usdt", 50, { mid, volBps: 0 }, balanced)!;
    expect(q.reason).toContain("quoted:");
    expect(q.reason).toContain("skew");
    // Divergence halt names itself.
    expect(
      quoteHaltReason("taker_buys_usdt", 50, { mid, volBps: 0, refRate: mid * 0.8 }, balanced),
    ).toContain("divergence");
    // Volatility halt names itself.
    expect(
      quoteHaltReason("taker_buys_usdt", 50, { mid, volBps: 500 }, balanced),
    ).toContain("half-spread");
    // Oversize halt names the cap.
    expect(
      quoteHaltReason("taker_buys_usdt", 200, { mid, volBps: 0 }, balanced),
    ).toContain("per-quote cap");
  });

  it("priceQuote refuses exactly when quoteHaltReason fires", () => {
    const scenarios: Array<[Parameters<typeof priceQuote>[2], number]> = [
      [{ mid, volBps: 0 }, 50],
      [{ mid, volBps: 0, refRate: mid * 0.8 }, 50],
      [{ mid, volBps: 500 }, 50],
      [{ mid, volBps: 0 }, 10_000],
      [{ mid, volBps: 0 }, 0],
    ];
    for (const [m, size] of scenarios) {
      for (const side of ["taker_buys_usdt", "taker_sells_usdt"] as const) {
        expect(priceQuote(side, size, m, balanced) === null).toBe(
          quoteHaltReason(side, size, m, balanced) !== null,
        );
      }
    }
  });

  it("sizes quotes by inventory, volatility and skew", () => {
    // Balanced paper-sized inventory, calm: the 100 USDT step (cap is 125).
    expect(quoteSizeUsdt({ mid, volBps: 0 }, balanced)).toBe(100);
    // Deep inventory, calm and balanced: the ladder tops out at the 500 cap.
    expect(quoteSizeUsdt({ mid, volBps: 0 }, { usdt: 5000, cngn: 5000 * mid })).toBe(500);
    // Elevated volatility steps size down.
    expect(quoteSizeUsdt({ mid, volBps: 40 }, { usdt: 5000, cngn: 5000 * mid })).toBe(50);
    // Heavy skew steps size down even with deep inventory.
    expect(quoteSizeUsdt({ mid, volBps: 0 }, { usdt: 9000, cngn: 1000 * mid })).toBe(100);
  });

  it("ewma vol is zero for a flat series and rises on moves", () => {
    const v = new EwmaVol();
    [mid, mid, mid].forEach((p) => v.update(p));
    expect(v.bps()).toBe(0);
    v.update(mid * 1.01);
    expect(v.bps()).toBeGreaterThan(0);
  });

  it("ewma vol ignores unusable prices instead of poisoning its state", () => {
    const v = new EwmaVol();
    v.update(mid);
    for (const bad of [Number.NaN, 0, -5, Number.POSITIVE_INFINITY]) v.update(bad);
    expect(v.bps()).toBe(0);
    v.update(mid * 1.01);
    expect(Number.isFinite(v.bps())).toBe(true);
    expect(v.bps()).toBeGreaterThan(0);
  });
});
