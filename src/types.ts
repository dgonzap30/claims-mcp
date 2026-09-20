export type ClaimKind = "priority" | "status" | "fact" | "relationship";
export type Volatility = "stable" | "slow" | "volatile";
export type ClaimState = "active" | "stale" | "contradicted" | "retired";

export interface Claim {
  id: string;
  claim: string;
  entity: string;
  kind: ClaimKind;
  volatility: Volatility;
  confidence: number; // 0..1
  assertedRank: number | null; // priority claims only
  source: string; // free text, e.g. "declared" or "session:abc"
  evidenceJson: string; // JSON array of evidence references
  lastConfirmed: string | null; // ISO
  state: ClaimState;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
