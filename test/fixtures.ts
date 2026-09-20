import type { Claim } from "../src/types";

export const T0 = Date.parse("2026-01-01T00:00:00.000Z");
export const DAY = 86_400_000;

export function claim(over: Partial<Claim> = {}): Claim {
  return {
    id: "cl_test", claim: "ships weekly", entity: "acme", kind: "fact", volatility: "slow",
    confidence: 0.8, assertedRank: null, source: "declared", evidenceJson: "[]",
    lastConfirmed: null, state: "active",
    createdAt: new Date(T0).toISOString(), updatedAt: new Date(T0).toISOString(), ...over,
  };
}
