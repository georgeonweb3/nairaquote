import type { Address } from "viem";

/**
 * ERC-8021 attribution code assigned by Loops for the Agents on Open Rails entry.
 * Every transaction from the agent wallet MUST carry it. Do not derive it from the repo.
 */
export const ATTRIBUTION_TAG = "celo_1491b3c3f297" as const;

export const CHAIN_ID = 42220; // Celo mainnet
export const AGENT_ADDRESS: Address = "0xBdC026bA914e399f367DC880ebA1EF268Ada5938";

/** Verify against docs.textilecredit.com/protocol/address-book.html before use. */
export const ADDR = {
  textileReactor: "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3",
  feeController: "0x7b005466F905DD882A959888154587fA76cd3Ea7",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  erc8004Registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  cNGN: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
} as const satisfies Record<string, Address>;

export const DECIMALS = { cNGN: 6, USDT: 6 } as const;

export const TEXTILE_API = "https://api.textilecredit.com";
export const TEXTILE_V2 = `${TEXTILE_API}/v2`;
export const TEXTILE_FEE_BPS = 1;

const num = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);

export const PARAMS = {
  baseSpreadBps: num("BASE_SPREAD_BPS", 3), // floor half-spread each side
  volMultiplier: num("VOL_MULTIPLIER", 1.5), // half-spread += k * sigma(bps)
  maxSkewBps: num("MAX_SKEW_BPS", 25), // max price shift from inventory imbalance
  targetUsdtShare: num("TARGET_USDT_SHARE", 0.5), // desired USDT share of inventory value
  bandWidth: num("BAND_WIDTH", 0.2), // +/- band around target before rebalance flag
  maxQuoteUsdt: num("MAX_QUOTE_USDT", 500), // hard size cap per quote
  maxInventoryShareUsedPerQuote: num("MAX_SHARE_PER_QUOTE", 0.25),
  maxSpreadBps: num("MAX_SPREAD_BPS", 150), // refuse to quote wider than this
  refDivergenceHaltBps: num("REF_DIVERGENCE_HALT_BPS", 1000),
};
