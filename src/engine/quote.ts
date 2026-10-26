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
 * Price one RFQ side. Returns null (no quote) when risk checks fail.
 * Pure function: no IO, easy to test and to replay against history.
 */
export function priceQuote(
  side: Side,
  requestedUsdt: number,
  m: MarketState,
  inv: Inventory,
  p = PARAMS,
): Quote | null {
  if (!(m.mid > 0)) return null;
  if (m.refRate) {
    const divBps = (Math.abs(m.mid - m.refRate) / m.refRate) * 1e4;
    if (divBps > p.refDivergenceHaltBps) return null; // book far from reference: feed may be broken
  }
  const hs = halfSpreadBps(m.volBps, p);
  if (hs > p.maxSpreadBps) return null; // too volatile to quote responsibly

  const skew = inventorySkewBps(inv, m.mid, p);
  const center = m.mid * (1 - skew / 1e4);

  // Size cap: absolute cap and a fraction of the inventory we would pay out.
  const payable = side === "taker_buys_usdt" ? inv.usdt : inv.cngn / m.mid;
  const maxUsdt = Math.min(p.maxQuoteUsdt, payable * p.maxInventoryShareUsedPerQuote);
  if (requestedUsdt > maxUsdt || maxUsdt <= 0) return null;

  // Larger requests pay a little more (linear size premium up to +50% of half-spread).
  const sizeBps = hs * 0.5 * (requestedUsdt / p.maxQuoteUsdt);
  const edge = (hs + sizeBps) / 1e4;
  const price = side === "taker_buys_usdt" ? center * (1 + edge) : center * (1 - edge);

  return { side, price, maxUsdt, halfSpreadBps: hs + sizeBps, skewBps: skew };
}
