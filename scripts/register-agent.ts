/**
 * ERC-8004 registration for the NairaQuote agent identity.
 *
 * Calls register(agentURI) on the Celo Identity Registry through the
 * attributed agent wallet (so the registration tx itself carries the
 * ERC-8021 tag), then reads the real agentId from the Registered event
 * in the receipt — never from a simulation, per the runbook.
 *
 * agentURI defaults to the agent.json hosted in this repo; override with
 * the AGENT_URI env var if the file moves.
 *
 * Run (with AGENT_PRIVATE_KEY in .env, wallet funded, first tx done):
 *   npm run register:agent
 *
 * Hard stops: wrong chain, no CELO, or the wallet already holds a
 * registry NFT (registering a second identity would be a mistake).
 */
import { decodeEventLog, formatEther, parseAbi } from "viem";
import { ADDR, AGENT_ADDRESS } from "../src/config.js";
import { agentWallet, assertTagged, publicClient } from "../src/wallet.js";

const DEFAULT_AGENT_URI =
  "https://raw.githubusercontent.com/georgeonweb3/nairaquote/main/agent.json";
const agentURI = process.env.AGENT_URI ?? DEFAULT_AGENT_URI;

const REGISTRY_ABI = parseAbi([
  "function register(string agentURI) returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

const chainId = await publicClient.getChainId();
if (chainId !== 42220) {
  throw new Error(`Wrong chain: got ${chainId}, expected 42220 (Celo mainnet)`);
}

const balance = await publicClient.getBalance({ address: AGENT_ADDRESS });
console.log(`Agent wallet ${AGENT_ADDRESS}`);
console.log(`CELO balance: ${formatEther(balance)}`);
if (balance === 0n) {
  throw new Error("Agent wallet holds no CELO — fund it before registering.");
}

const existing = await publicClient.readContract({
  address: ADDR.erc8004Registry,
  abi: REGISTRY_ABI,
  functionName: "balanceOf",
  args: [AGENT_ADDRESS],
});
if (existing > 0n) {
  throw new Error(
    `Agent wallet already holds ${existing} registry NFT(s) — already registered. Do NOT register a second identity.`,
  );
}

console.log(`Registering with agentURI: ${agentURI}`);
const wallet = agentWallet();
const hash = await wallet.writeContract({
  address: ADDR.erc8004Registry,
  abi: REGISTRY_ABI,
  functionName: "register",
  args: [agentURI],
});
console.log(`Tx sent: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  throw new Error(`Registration tx did not succeed: ${hash} (status ${receipt.status})`);
}
console.log(`Confirmed in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}`);

let agentId: bigint | undefined;
for (const log of receipt.logs) {
  if (log.address.toLowerCase() !== ADDR.erc8004Registry.toLowerCase()) continue;
  try {
    const decoded = decodeEventLog({ abi: REGISTRY_ABI, data: log.data, topics: log.topics });
    if (decoded.eventName === "Registered") {
      agentId = decoded.args.agentId;
      break;
    }
  } catch {
    // Not the Registered event — keep scanning.
  }
}
if (agentId === undefined) {
  throw new Error("No Registered event found in the receipt — inspect the tx before doing anything else.");
}

await assertTagged(hash);
console.log(`PASS: attribution tag verified on-chain for ${hash}`);
console.log("");
console.log(`agentId:        ${agentId}`);
console.log(`global id:      eip155:42220:${ADDR.erc8004Registry}:${agentId}`);
console.log(`registration tx: ${hash}`);
console.log(`Explorer: https://celoscan.io/tx/${hash}`);
console.log("");
console.log("Next steps: add the registrations array to agent.json with this agentId,");
console.log("and update the README Onchain/Status sections with the agentId and tx hashes.");
