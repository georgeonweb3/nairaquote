# NairaQuote

Inventory- and volatility-aware market-making agent for the **cNGN / USD₮** corridor on [Textile FX](https://app.textilecredit.com/), targeting **Celo mainnet** (chain 42220). Built for the Agents on Open Rails hackathon (Open Corridors · Textile FX).

Current state, honestly: quoting still runs in **dry-run** against the live Textile book — it reads real market data and produces real quotes, but has placed no live fills. The agent wallet is funded for gas, has sent its first tagged mainnet transaction, and holds its ERC-8004 identity (agentId 10056, see Onchain). Textile maker enrolment is still pending, and the live maker stream is the one piece not wired. Everything upstream of it is built and tested (see Status below).

## Why
Most Textile fillers quote price ± fixed bips. NairaQuote prices every RFQ from:
- **Live mid** from the Textile USDT_NGN book, sanity-checked against an independent NGN/USD reference.
- **Volatility**: EWMA of log returns widens the half-spread when the naira moves fast.
- **Inventory skew**: when the agent is long USD₮ it shades both prices down (and vice versa) to pull inventory back to target without paying for a rebalance.
- **Size caps & size premium**: hard per-quote cap, a cap as a share of payable inventory, and a small premium for larger tickets.
- **Kill switches**: no quote when volatility pushes spread past a max, or when the book diverges sharply from the reference.

The engine (`src/engine/quote.ts`) is a pure function, so it is unit-tested and can be replayed against history.

## Onchain
- Agent wallet: `0x0A8dE1EEd0722C05f3f1DD16F289f63274A5A40b` — [view on Celoscan](https://celoscan.io/address/0x0A8dE1EEd0722C05f3f1DD16F289f63274A5A40b)
- ERC-8021 attribution: every transaction is tagged `celo_1491b3c3f297` via `withAttribution` where the wallet client is built (`src/wallet.ts`). Verify the suffix any time with `npm run check:tag`.
- ERC-8004 identity: registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, **agentId 10056**, global id `eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:10056`, registration tx [`0x06cc6aa1ed84cd5ca41febad728a9aa22c1d30eeacd69157f2eb5451031bf12b`](https://celoscan.io/tx/0x06cc6aa1ed84cd5ca41febad728a9aa22c1d30eeacd69157f2eb5451031bf12b), agentURI `https://raw.githubusercontent.com/georgeonweb3/nairaquote/main/agent.json`.
- First tagged mainnet tx: [`0x59e7420d77f515a7963b7a7c3e8b8845dc64df7d55025bb015f3e340b96944bf`](https://celoscan.io/tx/0x59e7420d77f515a7963b7a7c3e8b8845dc64df7d55025bb015f3e340b96944bf) — 0-value transfer to the owner's wallet; attribution tag verified on-chain.

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

Sample dry-run output (real tick, 2026-11-08; the indicative book arrived crossed by 1.31 bps and was accepted — small crosses are normal for this multi-filler snapshot, see `src/feeds/textile.ts`):
```json
{"at":"2026-11-08T21:07:54.282Z","book":{"bid":1378.74,"ask":1378.56,"vol24hUsdt":762593.32,"crossedBps":1.31},"ref":1347.74,"mid":1378.65,"volBps":0,"usdtShare":0.499,"ours":{"bid":1378.06,"ask":1379.27}}
```

## Status
- [x] Tagged wallet client, live Textile + reference feeds, quoting engine with tests (dry-run)
- [ ] Textile maker enrolment + `WSS /v2/maker/stream` wiring
- [x] ERC-8004 registration (agentId 10056) + first tagged mainnet tx
- [ ] Funded inventory (cNGN / USD₮ quoting capital)
- [ ] Inventory band rebalancing, P&L dashboard

All code in this repository was written during the hackathon. MIT licensed.
