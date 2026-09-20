import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Claim, ClaimState } from "./types";

export interface UpsertClaimInput {
  claim: string;
  entity: string;
  kind: Claim["kind"];
  volatility: Claim["volatility"];
  confidence: number;
  assertedRank?: number | null;
  source: string;
  evidenceJson?: string;
  lastConfirmed?: string | null;
  state?: ClaimState;
  now: string;
}

const SCHEMA = `
create table if not exists claims (
  id text primary key,
  claim text not null,
  entity text not null,
  kind text not null,
  volatility text not null,
  confidence real not null,
  asserted_rank integer,
  source text not null,
  evidence_json text not null default '[]',
  last_confirmed text,
  state text not null default 'active',
  created_at text not null,
  updated_at text not null,
  unique (entity, kind, claim)
)`;

/** Open (creating if needed) a claims database. ":memory:" is allowed. */
export function openStore(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.run("pragma journal_mode = wal");
  db.run(SCHEMA);
  return db;
}

/** Deterministic id from the natural key so re-asserting never duplicates. */
export function claimId(entity: string, kind: string, claim: string): string {
  return "cl_" + createHash("sha256").update(`${entity}:${kind}:${claim}`).digest("hex").slice(0, 16);
}

interface Row {
  id: string; claim: string; entity: string; kind: string; volatility: string;
  confidence: number; asserted_rank: number | null; source: string; evidence_json: string;
  last_confirmed: string | null; state: string; created_at: string; updated_at: string;
}

function toClaim(r: Row): Claim {
  return {
    id: r.id, claim: r.claim, entity: r.entity, kind: r.kind as Claim["kind"],
    volatility: r.volatility as Claim["volatility"], confidence: r.confidence,
    assertedRank: r.asserted_rank, source: r.source, evidenceJson: r.evidence_json,
    lastConfirmed: r.last_confirmed, state: r.state as ClaimState,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function getClaim(db: Database, id: string): Claim | null {
  const r = db.query("select * from claims where id = ?").get(id) as Row | null;
  return r ? toClaim(r) : null;
}

export function listClaims(db: Database, opts?: { state?: ClaimState; entity?: string }): Claim[] {
  const where: string[] = [];
  const args: string[] = [];
  if (opts?.state) { where.push("state = ?"); args.push(opts.state); }
  if (opts?.entity) { where.push("entity = ?"); args.push(opts.entity); }
  const sql = `select * from claims ${where.length ? "where " + where.join(" and ") : ""} order by entity, kind, claim`;
  return (db.query(sql).all(...args) as Row[]).map(toClaim);
}

/** Case-insensitive substring match over claim text and entity. */
export function searchClaims(db: Database, text: string, opts?: { state?: ClaimState }): Claim[] {
  const like = `%${text.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const rows = opts?.state
    ? db.query("select * from claims where (claim like ? escape '\\' or entity like ? escape '\\') and state = ? order by entity, kind").all(like, like, opts.state)
    : db.query("select * from claims where claim like ? escape '\\' or entity like ? escape '\\' order by entity, kind").all(like, like);
  return (rows as Row[]).map(toClaim);
}

export function upsertClaim(db: Database, input: UpsertClaimInput): Claim {
  const id = claimId(input.entity, input.kind, input.claim);
  db.query(
    `insert into claims
       (id, claim, entity, kind, volatility, confidence, asserted_rank, source, evidence_json, last_confirmed, state, created_at, updated_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?)
     on conflict(entity, kind, claim) do update set
       volatility = excluded.volatility, confidence = excluded.confidence,
       asserted_rank = excluded.asserted_rank, source = excluded.source,
       evidence_json = excluded.evidence_json, last_confirmed = excluded.last_confirmed,
       state = excluded.state, updated_at = excluded.updated_at`,
  ).run(
    id, input.claim, input.entity, input.kind, input.volatility, input.confidence,
    input.assertedRank ?? null, input.source, input.evidenceJson ?? "[]",
    input.lastConfirmed ?? null, input.state ?? "active", input.now, input.now,
  );
  return getClaim(db, id)!;
}

export function setClaimState(db: Database, id: string, state: ClaimState, now: string): boolean {
  return db.query("update claims set state = ?, updated_at = ? where id = ?").run(state, now, id).changes > 0;
}

export function confirmClaim(db: Database, id: string, now: string, confidence?: number): boolean {
  const r = confidence == null
    ? db.query("update claims set last_confirmed = ?, state = 'active', updated_at = ? where id = ?").run(now, now, id)
    : db.query("update claims set last_confirmed = ?, confidence = ?, state = 'active', updated_at = ? where id = ?").run(now, confidence, now, id);
  return r.changes > 0;
}
