import { formatUnits, parseAbi } from "viem";
import { ADDR, AGENT_ADDRESS, DECIMALS } from "../config.js";
import { publicClient } from "../wallet.js";
import type { Inventory } from "../engine/quote.js";

export interface AgentBalances {
  celo: number;
  cngn: number;
  usdt: number;
}

const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

/** Live balances of the agent wallet: native CELO plus the two corridor tokens. */
export async function agentBalances(): Promise<AgentBalances> {
  const [celo, cngn, usdt] = await Promise.all([
    publicClient.getBalance({ address: AGENT_ADDRESS }),
    publicClient.readContract({
      address: ADDR.cNGN,
      abi: erc20,
      functionName: "balanceOf",
      args: [AGENT_ADDRESS],
    }),
    publicClient.readContract({
      address: ADDR.USDT,
      abi: erc20,
      functionName: "balanceOf",
      args: [AGENT_ADDRESS],
    }),
  ]);
  return {
    celo: Number(formatUnits(celo, 18)),
    cngn: Number(formatUnits(cngn, DECIMALS.cNGN)),
    usdt: Number(formatUnits(usdt, DECIMALS.USDT)),
  };
}

/**
 * Inventory selection, kept pure so it is testable without the chain.
 * Real corridor balances win the moment the wallet holds any; until then
 * the paper inventory is used and the tick log says so — paper numbers are
 * never silently presented as real ones.
 */
export function selectInventory(
  bal: AgentBalances,
  paper: Inventory,
): { inv: Inventory; source: string } {
  if (bal.cngn > 0 || bal.usdt > 0) {
    return { inv: { usdt: bal.usdt, cngn: bal.cngn }, source: "onchain" };
  }
  return { inv: paper, source: "paper — agent wallet holds no cNGN/USDT yet" };
}
