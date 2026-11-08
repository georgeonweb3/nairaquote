import { PARAMS, TEXTILE_FEE_BPS } from "../config.js";

export interface Inventory {
  usdt: number; // USDT units
  cngn: number; // cNGN units (≈ NGN)
}

export interface MarketState {
  mid: number; // NGN per USDT
  volBps: number; // recent volatility, bps
  refRate?: number; // independent reference, NGN per USDT
}

export type Side = "taker_buys_usdt" | "taker_sells_usdt";

export interface Quote {
  side: Side;
  price: number; // NGN per USDT offered to the taker
  maxUsdt: number;
  halfSpreadBps: number;
  skewBps: number;
  reason?: string;
}

/** Share of inventory value held in USDT, at the given mid. */
export function usdtShare(inv: Inventory, mid: number): number {
  const total = inv.usdt + inv.cngn / mid;
  return total > 0 ? inv.usdt / total : 0;
}

/**
 * Inventory skew in bps, positive when we hold too much USDT.
 * Positive skew lowers both prices: cheaper to buy USDT from us, less paid for USDT sold to us.
 */
export function inventorySkewBps(inv: Inventory, mid: number, p = PARAMS): number {
  const dev = usdtShare(inv, mid) - p.targetUsdtShare; // -0.5..0.5
  const norm = Math.max(-1, Math.min(1, dev / p.bandWidth));
  return norm * p.maxSkewBps;
}

export function halfSpreadBps(volBps: number, p = PARAMS): number {
  return p.baseSpreadBps + p.volMultiplier * volBps + TEXTILE_FEE_BPS;
}

/**
 * Why priceQuote would refuse this request, or null if it would quote.
 * Kept separate from priceQuote so a refused quote is never silent: the
 * caller can log the exact risk check that fired. Pure, like the engine.
 */
export function quoteHaltReason(
  side: Side,
  requestedUsdt: number,
  m: MarketState,
  inv: Inventory,
  p = PARAMS,
): string | null {
  if (!(m.mid > 0)) return "halt: unusable mid";
  if (!(requestedUsdt > 0)) return "halt: invalid request size"; // zero/negative/NaN is not quotable
  if (m.refRate) {
    const divBps = (Math.abs(m.mid - m.refRate) / m.refRate) * 1e4;
    if (divBps > p.refDivergenceHaltBps) {
      // Book far from the independent reference: the feed may be broken.
      return `halt: book/reference divergence ${divBps.toFixed(0)} bps exceeds ${p.refDivergenceHaltBps} bps`;
    }
  }
  const hs = halfSpreadBps(m.volBps, p);
  if (hs > p.maxSpreadBps) {
    return `halt: half-spread ${hs.toFixed(1)} bps exceeds max ${p.maxSpreadBps} bps (volatility too high)`;
  }
  // Size cap: absolute cap and a fraction of the inventory we would pay out.
  const payable = side === "taker_buys_usdt" ? inv.usdt : inv.cngn / m.mid;
  const maxUsdt = Math.min(p.maxQuoteUsdt, payable * p.maxInventoryShareUsedPerQuote);
  if (maxUsdt <= 0) return "halt: no payable inventory on this side";
  if (requestedUsdt > maxUsdt) {
    return `halt: request ${requestedUsdt} USDT exceeds per-quote cap ${maxUsdt.toFixed(2)} USDT`;
  }
  return null;
}

/**
 * Pick the size to quote this tick. Larger inventory earns larger tickets
 * (the engine charges a size premium, so size drives spread), but size is
 * stepped down when volatility rises or inventory is badly skewed, and it
 * never exceeds what the per-quote inventory cap would allow anyway.
 */
export function quoteSizeUsdt(m: MarketState, inv: Inventory, p = PARAMS): number {
  const cap = Math.floor(
    Math.min(
      p.maxQuoteUsdt,
      inv.usdt * p.maxInventoryShareUsedPerQuote,
      (inv.cngn / m.mid) * p.maxInventoryShareUsedPerQuote,
    ),
  );
  const steps = [25, 50, 100, 250, 500];
  let size = steps.filter((s) => s <= cap).pop() ?? cap;
  if (m.volBps >= 30) size = Math.min(size, 50); // volatility: serve smaller tickets
  const share = usdtShare(inv, m.mid);
  if (share < 0.3 || share > 0.7) size = Math.min(size, 100); // skewed: don't deepen the skew
  return size;
}

/**
 * Price one RFQ side. Returns null (no quote) when risk checks fail;
 * quoteHaltReason names the check that fired. Successful quotes carry a
 * `reason` string so every decision in the log explains itself.
 * Pure function: no IO, easy to test and to replay against history.
 */
export function priceQuote(
  side: Side,
  requestedUsdt: number,
  m: MarketState,
  inv: Inventory,
  p = PARAMS,
): Quote | null {
  if (quoteHaltReason(side, requestedUsdt, m, inv, p)) return null;

  const hs = halfSpreadBps(m.volBps, p);
  const skew = inventorySkewBps(inv, m.mid, p);
  const center = m.mid * (1 - skew / 1e4);

  const payable = side === "taker_buys_usdt" ? inv.usdt : inv.cngn / m.mid;
  const maxUsdt = Math.min(p.maxQuoteUsdt, payable * p.maxInventoryShareUsedPerQuote);

  // Larger requests pay a little more (linear size premium up to +50% of half-spread).
  const sizeBps = hs * 0.5 * (requestedUsdt / p.maxQuoteUsdt);
  const edge = (hs + sizeBps) / 1e4;
  const price = side === "taker_buys_usdt" ? center * (1 + edge) : center * (1 - edge);

  return {
    side,
    price,
    maxUsdt,
    halfSpreadBps: hs + sizeBps,
    skewBps: skew,
    reason:
      `quoted: half-spread ${(hs + sizeBps).toFixed(2)} bps ` +
      `(base ${p.baseSpreadBps} + vol ${m.volBps.toFixed(1)}x${p.volMultiplier} + fee ${TEXTILE_FEE_BPS} + size ${sizeBps.toFixed(2)}), ` +
      `skew ${skew.toFixed(2)} bps, size ${requestedUsdt}/${maxUsdt.toFixed(0)} USDT cap`,
  };
}
