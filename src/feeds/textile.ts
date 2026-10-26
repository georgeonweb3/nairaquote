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
  const r = await fetch(`${TEXTILE_API}/tickers`);
  if (!r.ok) throw new Error(`textile tickers ${r.status}`);
  const rows = (await r.json()) as Array<Record<string, string>>;
  const t = rows.find((x) => x.ticker_id === id);
  if (!t) throw new Error(`ticker ${id} not found`);
  return {
    ticker_id: id,
    bid: Number(t.bid),
    ask: Number(t.ask),
    last: Number(t.last_price),
    baseVolume24h: Number(t.base_volume),
  };
}
