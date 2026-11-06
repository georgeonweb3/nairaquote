/**
 * Independent NGN/USD reference. Official-style rates can sit well below the
 * onchain/parallel market, so the engine treats this as a sanity check and a
 * slow anchor, not as the quoting mid.
 */
export async function referenceNgnPerUsd(): Promise<{ rate: number; source: string }> {
  const r = await fetch("https://open.er-api.com/v6/latest/USD", {
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`reference feed ${r.status}`);
  const d = (await r.json()) as { rates: Record<string, number> };
  const rate = d.rates?.NGN;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("reference feed returned no usable NGN rate");
  }
  return { rate, source: "open.er-api.com" };
}
