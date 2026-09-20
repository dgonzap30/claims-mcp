import type { Claim } from "./types";
import { RANK_MARGIN, SUSTAINED_PERIODS } from "./thresholds";

export interface Contradiction {
  kind: "duplicate-rank" | "status-conflict" | "rank-drop";
  entity: string;
  claimId: string | null;
  severity: number; // 0..1
  detail: string;
}

/**
 * Observed evidence for the rank-drop rule, supplied by the caller. Each signal maps
 * entity -> weekly rank (1 = best), index 0 = most recent period. `validPeriods[i]`
 * says whether period i had enough activity to count.
 */
export interface ObservedRanks {
  signals: Array<Record<string, number[]>>;
  validPeriods?: boolean[];
}

export interface FindOptions {
  sustainedPeriods?: number;
  rankMargin?: number;
}

/** Claim-vs-claim conflicts among ACTIVE claims: no outside data needed. */
export function findConflicts(claims: Claim[]): Contradiction[] {
  const out: Contradiction[] = [];
  const active = claims.filter((c) => c.state === "active");

  const byRank = new Map<number, Claim[]>();
  for (const c of active) {
    if (c.kind === "priority" && c.assertedRank != null) {
      byRank.set(c.assertedRank, [...(byRank.get(c.assertedRank) ?? []), c]);
    }
  }
  for (const [rank, group] of byRank) {
    const entities = new Set(group.map((c) => c.entity));
    if (entities.size > 1) {
      for (const c of group) {
        out.push({
          kind: "duplicate-rank", entity: c.entity, claimId: c.id, severity: 0.6,
          detail: `${entities.size} entities all claim priority #${rank}: ${[...entities].sort().join(", ")}`,
        });
      }
    }
  }

  const byEntityStatus = new Map<string, Claim[]>();
  for (const c of active) {
    if (c.kind === "status") byEntityStatus.set(c.entity, [...(byEntityStatus.get(c.entity) ?? []), c]);
  }
  for (const [entity, group] of byEntityStatus) {
    if (group.length > 1) {
      for (const c of group) {
        out.push({
          kind: "status-conflict", entity, claimId: c.id, severity: 0.5,
          detail: `${group.length} active status claims for one entity`,
        });
      }
    }
  }
  return out;
}

/** Sustained rank-drop: every signal ranks the entity worse than asserted+margin for N valid periods. */
export function findRankDrops(claims: Claim[], observed: ObservedRanks, opts: FindOptions = {}): Contradiction[] {
  const need = opts.sustainedPeriods ?? SUSTAINED_PERIODS;
  const margin = opts.rankMargin ?? RANK_MARGIN;
  const out: Contradiction[] = [];
  if (observed.signals.length === 0) return out;

  for (const claim of claims) {
    if (claim.state !== "active" || claim.kind !== "priority" || claim.assertedRank == null) continue;
    const threshold = claim.assertedRank + margin;
    const series = observed.signals.map((s) => s[claim.entity]);
    if (series.some((s) => !s)) continue;

    let seenValid = 0;
    let allDrop = true;
    let worst = 0;
    const periods = Math.max(...series.map((s) => s!.length));
    for (let w = 0; w < periods && seenValid < need; w++) {
      if (observed.validPeriods && !observed.validPeriods[w]) continue;
      seenValid += 1;
      const ranks = series.map((s) => s![w]);
      if (ranks.some((r) => r == null || r <= threshold)) { allDrop = false; break; }
      worst = Math.max(worst, ...(ranks as number[]));
    }
    if (allDrop && seenValid >= need) {
      const population = Math.max(1, ...observed.signals.map((s) => Object.keys(s).length));
      const severity = Math.min(1, ((worst - claim.assertedRank) / population) * (1 / claim.assertedRank) + 0.4);
      out.push({
        kind: "rank-drop", entity: claim.entity, claimId: claim.id, severity,
        detail: `asserted #${claim.assertedRank}; ranked below #${threshold} in ${series.length} signal(s) for ${need} valid periods`,
      });
    }
  }
  return out;
}

export function findContradictions(claims: Claim[], observed?: ObservedRanks, opts?: FindOptions): Contradiction[] {
  const all = [...findConflicts(claims), ...(observed ? findRankDrops(claims, observed, opts) : [])];
  return all.sort((a, b) => b.severity - a.severity);
}
