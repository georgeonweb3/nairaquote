import { describe, expect, it } from "vitest";
import { ERC_8021_MARKER, fromDataSuffix, toDataSuffix } from "@celo/attribution-tags";
import { ATTRIBUTION_TAG } from "../src/config.js";

describe("ERC-8021 attribution suffix", () => {
  it("round-trips: the suffix decodes back to the entry's tag", () => {
    const suffix = toDataSuffix(ATTRIBUTION_TAG) as `0x${string}`;
    expect(suffix.endsWith(ERC_8021_MARKER.slice(2))).toBe(true);
    expect(fromDataSuffix(suffix)?.codes).toEqual([ATTRIBUTION_TAG]);
  });

  it("is found on tagged calldata, not just on a bare suffix", () => {
    const calldata = `0xdeadbeef${toDataSuffix(ATTRIBUTION_TAG).slice(2)}` as `0x${string}`;
    expect(fromDataSuffix(calldata)?.codes).toEqual([ATTRIBUTION_TAG]);
  });

  it("is deterministic, so check:tag output is stable", () => {
    expect(toDataSuffix(ATTRIBUTION_TAG)).toBe(toDataSuffix(ATTRIBUTION_TAG));
  });
});
