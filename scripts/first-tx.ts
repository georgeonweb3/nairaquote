/**
 * First mainnet transaction: a 0-value self-transfer from the agent wallet.
 *
 * Purpose: prove the ERC-8021 attribution tag rides on a real transaction
 * for the cheapest possible gas (21,000) BEFORE spending ~180k gas on the
 * ERC-8004 registration. Moves no value, has no counterparty.
 *
 * Run (with AGENT_PRIVATE_KEY in .env, wallet funded with CELO):
 *   npm run tx:first
 *
 * Hard stops: wrong chain, or the agent wallet holds no CELO.
 * After sending, the tag is verified with the repo's own assertTagged().
 */
import { formatEther } from "viem";
import { AGENT_ADDRESS } from "../src/config.js";
import { agentWallet, assertTagged, publicClient } from "../src/wallet.js";

const chainId = await publicClient.getChainId();
if (chainId !== 42220) {
  throw new Error(`Wrong chain: got ${chainId}, expected 42220 (Celo mainnet)`);
}

const balance = await publicClient.getBalance({ address: AGENT_ADDRESS });
console.log(`Agent wallet ${AGENT_ADDRESS}`);
console.log(`CELO balance: ${formatEther(balance)}`);
if (balance === 0n) {
  throw new Error("Agent wallet holds no CELO — fund it before running this.");
}

const wallet = agentWallet();
console.log("Sending 0-value self-transfer (tagged)...");
const hash = await wallet.sendTransaction({ to: AGENT_ADDRESS, value: 0n });
console.log(`Tx sent: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  throw new Error(`First tx did not succeed: ${hash} (status ${receipt.status})`);
}
console.log(`Confirmed in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}`);

await assertTagged(hash);
console.log(`PASS: attribution tag verified on-chain for ${hash}`);
console.log(`Explorer: https://celoscan.io/tx/${hash}`);
console.log("Next step: npm run register:agent");
