/**
 * Independent NGN/USD reference. Official-style rates can sit well below the
 * onchain/parallel market, so the engine treats this as a sanity check and a
 * slow anchor, not as the quoting mid.
 */
export async function referenceNgnPerUsd(): Promise<{ rate: number; source: string }> {
  const r = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!r.ok) throw new Error(`reference feed ${r.status}`);
  const d = (await r.json()) as { rates: Record<string, number> };
  return { rate: d.rates.NGN, source: "open.er-api.com" };
}
