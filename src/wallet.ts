import { withAttribution, verifyTx } from "@celo/attribution-tags";
import { createPublicClient, createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { AGENT_ADDRESS, ATTRIBUTION_TAG } from "./config.js";

const rpc = () => http(process.env.CELO_RPC_URL ?? "https://forno.celo.org");

export const publicClient = createPublicClient({ chain: celo, transport: rpc() });

/**
 * The ONLY place a wallet client is built. Every sendTransaction / writeContract
 * on the returned client carries the ERC-8021 suffix for ATTRIBUTION_TAG.
 */
export function agentWallet() {
  const pk = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("AGENT_PRIVATE_KEY not set");
  const account = privateKeyToAccount(pk);
  if (account.address.toLowerCase() !== AGENT_ADDRESS.toLowerCase()) {
    throw new Error(`Key does not match agent wallet ${AGENT_ADDRESS}`);
  }
  return createWalletClient({ account, chain: celo, transport: rpc() }).extend(
    withAttribution(ATTRIBUTION_TAG),
  );
}

/** Run on the FIRST mainnet tx before sending anything else. */
export async function assertTagged(hash: Hash) {
  const res = await verifyTx({ client: publicClient, hash });
  if (!res?.codes.includes(ATTRIBUTION_TAG)) {
    throw new Error(`tx ${hash} is missing attribution tag ${ATTRIBUTION_TAG}`);
  }
  return res;
}
