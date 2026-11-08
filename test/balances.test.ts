import { describe, expect, it } from "vitest";
import { selectInventory } from "../src/feeds/balances.js";

const paper = { usdt: 500, cngn: 500 * 1384 };

describe("selectInventory", () => {
  it("uses paper inventory while the wallet holds no corridor tokens", () => {
    const sel = selectInventory({ celo: 4.185, cngn: 0, usdt: 0 }, paper);
    expect(sel.inv).toEqual(paper);
    expect(sel.source).toContain("paper");
  });

  it("switches to real balances the moment the wallet holds either token", () => {
    const sel = selectInventory({ celo: 4.185, cngn: 250_000, usdt: 0 }, paper);
    expect(sel.inv).toEqual({ usdt: 0, cngn: 250_000 });
    expect(sel.source).toBe("onchain");
    const sel2 = selectInventory({ celo: 0, cngn: 0, usdt: 120 }, paper);
    expect(sel2.inv).toEqual({ usdt: 120, cngn: 0 });
    expect(sel2.source).toBe("onchain");
  });
});
