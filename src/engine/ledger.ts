import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Side } from "./quote.js";

/**
 * Quote/fill ledger. The maker loop records every quote it answers and
 * every fill it gets here (JSONL on disk), so volume and P&L are computed
 * from records, never estimated after the fact. In dry-run the tick can
 * record its indicative quotes with NQ_TICK_LOG set; fills only ever come
 * from real executions, so P&L stays at zero until the agent actually trades.
 */
export interface QuoteRecord {
  type: "quote";
  at: string;
  side: Side;
  sizeUsdt: number;
  price: number; // NGN per USDT quoted
  mid: number; // NGN per USDT at quote time
  reason?: string;
  inventorySource?: string;
}

export interface FillRecord {
  type: "fill";
  at: string;
  side: Side;
  sizeUsdt: number;
  price: number; // NGN per USDT actually filled
  midAtFill: number; // NGN per USDT reference mid at fill time
}

export type LedgerRecord = QuoteRecord | FillRecord;

/** P&L of one fill in NGN, marked against the mid at fill time. */
export function fillPnlNgn(f: FillRecord): number {
  // Taker buys USDT -> we sold at our ask (earn price - mid).
  // Taker sells USDT -> we bought at our bid (earn mid - price).
  const perUsdt = f.side === "taker_buys_usdt" ? f.price - f.midAtFill : f.midAtFill - f.price;
  return perUsdt * f.sizeUsdt;
}

export interface LedgerSummary {
  quotesAnswered: number;
  quotesFilled: number;
  volumeQuotedUsdt: number;
  volumeFilledUsdt: number;
  pnlNgn: number;
  /** What a fixed-spread filler would have earned on the same fills. */
  baselineNgn: number;
  pnlVsBaselineNgn: number;
}

export function summarize(
  records: LedgerRecord[],
  baselineHalfSpreadBps = 5,
): LedgerSummary {
  const quotes = records.filter((r): r is QuoteRecord => r.type === "quote");
  const fills = records.filter((r): r is FillRecord => r.type === "fill");
  const pnlNgn = fills.reduce((s, f) => s + fillPnlNgn(f), 0);
  const baselineNgn = fills.reduce(
    (s, f) => s + ((f.midAtFill * baselineHalfSpreadBps) / 1e4) * f.sizeUsdt,
    0,
  );
  return {
    quotesAnswered: quotes.length,
    quotesFilled: fills.length,
    volumeQuotedUsdt: quotes.reduce((s, q) => s + q.sizeUsdt, 0),
    volumeFilledUsdt: fills.reduce((s, f) => s + f.sizeUsdt, 0),
    pnlNgn,
    baselineNgn,
    pnlVsBaselineNgn: pnlNgn - baselineNgn,
  };
}

export function appendRecord(path: string, rec: LedgerRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(rec) + "\n");
}

export function readRecords(path: string): LedgerRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LedgerRecord);
}
