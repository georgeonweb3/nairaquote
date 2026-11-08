import { TEXTILE_API } from "../config.js";

export interface Ticker {
  ticker_id: string;
  bid: number;
  ask: number;
  last: number;
  baseVolume24h: number;
}

/** Public Textile book for USDT_NGN (NGN per USDT, net of fees at ~100 USDT). */
export async function textileTicker(id = "USDT_NGN"): Promise<Ticker> {
  // Bounded wait: a stalled feed must fail the tick, not hang the loop
  // (observed live: an unbounded fetch stalled quote:once for over a minute).
  const r = await fetch(`${TEXTILE_API}/tickers`, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`textile tickers ${r.status}`);
  const rows = (await r.json()) as Array<Record<string, string>>;
  const t = rows.find((x) => x.ticker_id === id);
  if (!t) throw new Error(`ticker ${id} not found`);
  const bid = Number(t.bid);
  const ask = Number(t.ask);
  // Reject malformed payloads here. NaN prices would otherwise flow into the
  // mid and permanently poison the EWMA volatility state.
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
    throw new Error(`malformed ticker ${id}: bid=${t.bid} ask=${t.ask}`);
  }
  // Textile's public book is an indicative snapshot across many fillers and
  // is routinely crossed by a few bps (observed live, repeatedly). The engine
  // consumes only the mid and guards it against an independent reference
  // rate, so a small cross is market noise, not bad data — rejecting it made
  // every other tick fail. A large cross (> 25 bps of mid) still means the
  // snapshot is garbage and is rejected like any other malformed payload.
  const mid = (bid + ask) / 2;
  if (ask < bid && ((bid - ask) / mid) * 10_000 > 25) {
    throw new Error(
      `malformed ticker ${id}: crossed by ${(((bid - ask) / mid) * 10_000).toFixed(1)} bps (bid=${t.bid} ask=${t.ask})`,
    );
  }
  return {
    ticker_id: id,
    bid,
    ask,
    last: Number(t.last_price),
    baseVolume24h: Number(t.base_volume),
  };
}
