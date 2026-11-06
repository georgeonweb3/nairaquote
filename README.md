# NairaQuote

Inventory- and volatility-aware market-making agent for the **cNGN / USD₮** corridor on [Textile FX](https://app.textilecredit.com/), targeting **Celo mainnet** (chain 42220). Built for the Agents on Open Rails hackathon (Open Corridors · Textile FX).

Current state, honestly: the agent runs in **dry-run** against the live Textile book — it reads real market data and produces real quotes, but it has sent no mainnet transactions yet. The agent wallet is unfunded, Textile maker enrolment is still pending, and the live maker stream is the one piece not wired. Everything upstream of it is built and tested (see Status below).

## Why
Most Textile fillers quote price ± fixed bips. NairaQuote prices every RFQ from:
- **Live mid** from the Textile USDT_NGN book, sanity-checked against an independent NGN/USD reference.
- **Volatility**: EWMA of log returns widens the half-spread when the naira moves fast.
- **Inventory skew**: when the agent is long USD₮ it shades both prices down (and vice versa) to pull inventory back to target without paying for a rebalance.
- **Size caps & size premium**: hard per-quote cap, a cap as a share of payable inventory, and a small premium for larger tickets.
- **Kill switches**: no quote when volatility pushes spread past a max, or when the book diverges sharply from the reference.

The engine (`src/engine/quote.ts`) is a pure function, so it is unit-tested and can be replayed against history.

## Onchain
- Agent wallet: `0xBdC026bA914e399f367DC880ebA1EF268Ada5938` — [view on Celoscan](https://celoscan.io/address/0xBdC026bA914e399f367DC880ebA1EF268Ada5938)
- ERC-8021 attribution: every transaction will be tagged `celo_1491b3c3f297` via `withAttribution` where the wallet client is built (`src/wallet.ts`). Verify the suffix any time with `npm run check:tag`.
- ERC-8004 identity: registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` — [view on Celoscan](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) (**registration pending**: the wallet is not registered yet and holds no registry NFT; registration needs a funded wallet).

## Run
```sh
npm install
npm test            # engine + config tests
npm run typecheck   # tsc --noEmit
npm run check:tag   # prints the ERC-8021 attribution tag and its data suffix
npm run quote:once  # one dry-run tick against the live Textile book (no tx, no signing)
npm run dev         # dry-run loop every 15s
```

No `.env` or key is needed for the dry-run commands. For anything wallet-related, copy `.env.example` to `.env` (loaded automatically; shell-exported variables take precedence) and set `AGENT_PRIVATE_KEY` — it must belong to the agent wallet above; `src/wallet.ts` refuses any other key.

Sample dry-run output (real tick, 2026-11-06):
```json
{"at":"2026-11-06T22:52:58.314Z","book":{"bid":1374.7,"ask":1375.41,"vol24hUsdt":1462925.48},"ref":1348.02,"mid":1375.06,"volBps":0,"usdtShare":0.498,"ours":{"bid":1374.48,"ask":1375.69}}
```

## Status
- [x] Tagged wallet client, live Textile + reference feeds, quoting engine with tests (dry-run)
- [ ] Textile maker enrolment + `WSS /v2/maker/stream` wiring
- [ ] ERC-8004 registration, funded inventory, first tagged mainnet tx
- [ ] Inventory band rebalancing, P&L dashboard

All code in this repository was written during the hackathon. MIT licensed.
