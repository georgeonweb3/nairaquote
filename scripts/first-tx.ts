/**
 * First mainnet transaction: a 0-value transfer from the agent wallet to
 * George's main wallet (recipient set by George, 2026-11-07; override with
 * the FIRST_TX_TO env var).
 *
 * Purpose: prove the ERC-8021 attribution tag rides on a real transaction
 * for the cheapest possible gas (21,000) BEFORE spending ~180k gas on the
 * ERC-8004 registration. The tag lives in the tx data, so the value can
 * stay 0 — nothing of George's moves, the counterparty is his own wallet.
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

const RECIPIENT = (process.env.FIRST_TX_TO ??
  "0xfFDd2f83555c64d1CaA17f5646C08b80013ED38b") as `0x${string}`;

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
console.log(`Sending 0-value tagged transfer to ${RECIPIENT}...`);
const hash = await wallet.sendTransaction({ to: RECIPIENT, value: 0n });
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
