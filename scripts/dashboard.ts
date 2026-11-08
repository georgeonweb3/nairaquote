import { createServer } from "node:http";
import { readRecords, summarize } from "../src/engine/ledger.js";

/**
 * Minimal read-only dashboard over the quote/fill ledger (NQ_TICK_LOG,
 * default data/ticks.jsonl). Shows quotes answered, volume, fills, P&L vs
 * a fixed-spread baseline, and the latest quotes with their reasons.
 * In dry-run there are no fills, and the page says so — it never invents
 * trading numbers. Run: npm run dashboard (PORT env, default 8787).
 */
const path = process.env.NQ_TICK_LOG ?? "data/ticks.jsonl";
const port = Number(process.env.PORT ?? 8787);

const esc = (s: unknown) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (x: number, d = 2) => x.toLocaleString("en-US", { maximumFractionDigits: d });

createServer((_req, res) => {
  const records = readRecords(path);
  const s = summarize(records);
  const quotes = records.filter((r) => r.type === "quote").slice(-10).reverse();
  const last = quotes[0];
  const rows = quotes
    .map(
      (q) =>
        `<tr><td>${esc(q.at)}</td><td>${esc(q.side)}</td><td>${n(q.sizeUsdt, 0)}</td>` +
        `<td>${n(q.price)}</td><td>${n(q.mid)}</td><td>${esc(q.reason ?? "")}</td></tr>`,
    )
    .join("");
  res.writeHead(200, { "content-type": "text/html" });
  res.end(`<!doctype html><meta charset="utf-8"><title>NairaQuote dashboard</title>
<style>body{font-family:system-ui;background:#0b0f14;color:#e6edf3;margin:2rem}
.card{display:inline-block;background:#151b24;border:1px solid #26303d;border-radius:10px;padding:1rem 1.25rem;margin:.35rem}
.card b{font-size:1.5rem;display:block}table{border-collapse:collapse;margin-top:1rem}
td,th{border:1px solid #26303d;padding:.35rem .6rem;font-size:.85rem;text-align:left}</style>
<h1>NairaQuote — cNGN/USDT quoting agent</h1>
<p>Ledger: ${esc(path)} · Inventory source: ${esc(last?.inventorySource ?? "no ticks recorded yet")} · Updated ${new Date().toISOString()}</p>
<div>
<span class="card">Quotes answered<b>${s.quotesAnswered}</b></span>
<span class="card">Volume quoted (USDT)<b>${n(s.volumeQuotedUsdt, 0)}</b></span>
<span class="card">Fills<b>${s.quotesFilled}</b></span>
<span class="card">Volume filled (USDT)<b>${n(s.volumeFilledUsdt, 0)}</b></span>
<span class="card">Strategy P&L (NGN)<b>${s.quotesFilled ? n(s.pnlNgn) : "no fills yet"}</b></span>
<span class="card">P&L vs fixed-spread baseline (NGN)<b>${s.quotesFilled ? n(s.pnlVsBaselineNgn) : "—"}</b></span>
</div>
<h2>Latest quotes</h2>
<table><tr><th>Time</th><th>Side</th><th>Size</th><th>Price</th><th>Mid</th><th>Reason</th></tr>${rows}</table>`);
}).listen(port, () => console.log(`NairaQuote dashboard on http://localhost:${port} (ledger: ${path})`));
