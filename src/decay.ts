import type { Claim } from "./types";
import { DECAY_HALFLIFE_DAYS, MIN_CONFIDENCE } from "./thresholds";

const DAY_MS = 86_400_000;

function anchorMs(claim: Claim): number {
  const t = Date.parse(claim.lastConfirmed ?? claim.createdAt);
  return Number.isNaN(t) ? Date.parse(claim.createdAt) : t;
}

/** Exponential decay by volatility half-life since last confirmation; floored. Pure. */
export function decayedConfidence(claim: Claim, now: number): number {
  const elapsedDays = Math.max(0, (now - anchorMs(claim)) / DAY_MS);
  const decayed = claim.confidence * Math.pow(0.5, elapsedDays / DECAY_HALFLIFE_DAYS[claim.volatility]);
  return Math.max(MIN_CONFIDENCE, decayed);
}

/** 0 (fresh) rising toward, but below, 1: the floor keeps it from reaching 1. */
export function staleness(claim: Claim, now: number): number {
  if (claim.confidence <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - decayedConfidence(claim, now) / claim.confidence));
}

export function decayAll(claims: Claim[], now: number) {
  return claims.map((claim) => ({ claim, decayed: decayedConfidence(claim, now), staleness: staleness(claim, now) }));
}
