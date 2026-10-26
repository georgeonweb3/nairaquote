# NairaQuote

Inventory- and volatility-aware market-making agent for the **cNGN / USD₮** corridor on [Textile FX](https://app.textilecredit.com/), live on **Celo mainnet** (chain 42220). Built for the Agents on Open Rails hackathon (Open Corridors · Textile FX).

## Why
Most Textile fillers quote price ± fixed bips. NairaQuote prices every RFQ from:
- **Live mid** from the Textile USDT_NGN book, sanity-checked against an independent NGN/USD reference.
- **Volatility**: EWMA of log returns widens the half-spread when the naira moves fast.
- **Inventory skew**: when the agent is long USD₮ it shades both prices down (and vice versa) to pull inventory back to target without paying for a rebalance.
- **Size caps & size premium**: hard per-quote cap, a cap as a share of payable inventory, and a small premium for larger tickets.
- **Kill switches**: no quote when volatility pushes spread past a max, or when the book diverges sharply from the reference.

The engine (`src/engine/quote.ts`) is a pure function, so it is unit-tested and can be replayed against history.

## Onchain
- Agent wallet: `0xBdC026bA914e399f367DC880ebA1EF268Ada5938`
- ERC-8021 attribution: every transaction is tagged `celo_1491b3c3f297` via `withAttribution` where the wallet client is built (`src/wallet.ts`).
- ERC-8004 identity: registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (registration pending).

## Run
```sh
npm install
npm test            # engine tests
npm run quote:once  # one dry-run tick against the live Textile book (no tx, no signing)
npm run dev         # dry-run loop every 15s
```

## Status
- [x] Tagged wallet client, live Textile + reference feeds, quoting engine with tests (dry-run)
- [ ] Textile maker enrolment + `WSS /v2/maker/stream` wiring
- [ ] ERC-8004 registration, funded inventory, first tagged mainnet tx
- [ ] Inventory band rebalancing, P&L dashboard

All code in this repository was written during the hackathon. MIT licensed.
