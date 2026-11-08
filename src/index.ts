import { textileTicker } from "./feeds/textile.js";
import { referenceNgnPerUsd } from "./feeds/reference.js";
import { agentBalances, selectInventory } from "./feeds/balances.js";
import { EwmaVol } from "./engine/volatility.js";
import {
  priceQuote,
  quoteHaltReason,
  quoteSizeUsdt,
  usdtShare,
  type Inventory,
} from "./engine/quote.js";

/**
 * Dry-run loop: reads the live Textile book, builds indicative two-sided quotes,
 * and logs them with the reason for every decision. Sends NO transactions and
 * signs nothing.
 * Maker stream wiring (WSS /v2/maker/stream) lands once Textile enables the maker.
 *
 * Risk posture: a tick quotes only with BOTH feeds healthy. If the reference
 * feed fails, the tick halts instead of quoting without the divergence guard
 * (an earlier version caught the error and quoted anyway — that bypass is gone).
 * Inventory comes from the agent wallet's real cNGN/USDT balances when it
 * holds any; until then a paper inventory is used and the log says so.
 */
const once = process.argv.includes("--once");
const vol = new EwmaVol();
// Paper inventory until the agent wallet holds corridor tokens.
const paperInv: Inventory = { usdt: 500, cngn: 500 * 1384 };

async function tick() {
  const [t, ref, bal] = await Promise.all([
    textileTicker(),
    referenceNgnPerUsd(), // no catch: an outage halts the tick, by design
    agentBalances().catch(() => undefined), // a failed read falls back to paper, logged below
  ]);
  const mid = (t.bid + t.ask) / 2;
  const volBps = vol.update(mid);
  const m = { mid, volBps, refRate: ref.rate };

  let inv = paperInv;
  let inventorySource = "paper — balance read failed";
  if (bal) {
    const sel = selectInventory(bal, paperInv);
    inv = sel.inv;
    inventorySource = sel.source;
  }

  const size = quoteSizeUsdt(m, inv);
  const buy = priceQuote("taker_buys_usdt", size, m, inv);
  const sell = priceQuote("taker_sells_usdt", size, m, inv);
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      book: {
        bid: t.bid,
        ask: t.ask,
        vol24hUsdt: t.baseVolume24h,
        // Present only when the indicative book arrived crossed (small
        // crosses are accepted — see feeds/textile.ts); kept in the log so
        // the data quality of every tick stays auditable.
        ...(t.ask < t.bid
          ? { crossedBps: +(((t.bid - t.ask) / mid) * 10_000).toFixed(2) }
          : {}),
      },
      ref: ref.rate,
      mid: +mid.toFixed(2),
      volBps: +volBps.toFixed(2),
      wallet: bal && {
        celo: +bal.celo.toFixed(4),
        cngn: bal.cngn,
        usdt: bal.usdt,
      },
      inventorySource,
      sizeUsdt: size,
      usdtShare: +usdtShare(inv, mid).toFixed(3),
      ours: { bid: sell && +sell.price.toFixed(2), ask: buy && +buy.price.toFixed(2) },
      reasons: {
        bid: sell?.reason ?? quoteHaltReason("taker_sells_usdt", size, m, inv),
        ask: buy?.reason ?? quoteHaltReason("taker_buys_usdt", size, m, inv),
      },
    }),
  );
}

if (once) {
  // One-shot mode: a failed tick should fail the command (non-zero exit).
  await tick();
} else {
  // Loop mode: a transient feed failure must not kill the process before the
  // interval starts, and a slow tick must never overlap the next one (they
  // share the EWMA state).
  let running = false;
  const guarded = async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (e) {
      console.error(e);
    } finally {
      running = false;
    }
  };
  await guarded();
  setInterval(guarded, 15_000);
}
