import type { Database } from "bun:sqlite";
import { decayAll } from "./decay";
import { findContradictions, type ObservedRanks } from "./contradiction";
import { confirmClaim, listClaims, searchClaims, setClaimState, upsertClaim, type UpsertClaimInput } from "./store";
import type { Claim, ClaimState } from "./types";

/** The single operations layer both the MCP server and the CLI call. `now` is injectable for tests. */
export function createApi(db: Database, clock: () => Date = () => new Date()) {
  const iso = () => clock().toISOString();
  return {
    add(input: Omit<UpsertClaimInput, "now">): Claim {
      return upsertClaim(db, { ...input, now: iso() });
    },
    search(text: string, state?: ClaimState): Claim[] {
      return searchClaims(db, text, { state });
    },
    list(opts?: { state?: ClaimState; entity?: string }): Claim[] {
      return listClaims(db, opts);
    },
    confirm(id: string, confidence?: number): boolean {
      return confirmClaim(db, id, iso(), confidence);
    },
    retract(id: string): boolean {
      return setClaimState(db, id, "retired", iso());
    },
    contradictions(observed?: ObservedRanks) {
      return findContradictions(listClaims(db, { state: "active" }), observed);
    },
    /** Active claims whose decayed confidence has fallen; sorted stalest first. */
    decayed(minStaleness = 0.5) {
      return decayAll(listClaims(db, { state: "active" }), clock().getTime())
        .filter((d) => d.staleness >= minStaleness)
        .sort((a, b) => b.staleness - a.staleness);
    },
  };
}
export type Api = ReturnType<typeof createApi>;
