import { textileTicker } from "./feeds/textile.js";
import { referenceNgnPerUsd } from "./feeds/reference.js";
import { EwmaVol } from "./engine/volatility.js";
import { priceQuote, usdtShare, type Inventory } from "./engine/quote.js";

/**
 * Dry-run loop: reads the live Textile book, builds indicative two-sided quotes,
 * and logs them. Sends NO transactions and signs nothing.
 * Maker stream wiring (WSS /v2/maker/stream) lands once Textile enables the maker.
 */
const once = process.argv.includes("--once");
const vol = new EwmaVol();
// Paper inventory until the agent wallet is funded.
const inv: Inventory = { usdt: 500, cngn: 500 * 1384 };

async function tick() {
  const [t, ref] = await Promise.all([textileTicker(), referenceNgnPerUsd().catch(() => undefined)]);
  const mid = (t.bid + t.ask) / 2;
  const volBps = vol.update(mid);
  const m = { mid, volBps, refRate: ref?.rate };
  const buy = priceQuote("taker_buys_usdt", 100, m, inv);
  const sell = priceQuote("taker_sells_usdt", 100, m, inv);
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      book: { bid: t.bid, ask: t.ask, vol24hUsdt: t.baseVolume24h },
      ref: ref?.rate,
      mid: +mid.toFixed(2),
      volBps: +volBps.toFixed(2),
      usdtShare: +usdtShare(inv, mid).toFixed(3),
      ours: { bid: sell && +sell.price.toFixed(2), ask: buy && +buy.price.toFixed(2) },
    }),
  );
}

await tick();
if (!once) setInterval(() => tick().catch((e) => console.error(e)), 15_000);
