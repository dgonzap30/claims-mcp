#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createApi, type Api } from "./api";
import { resolveDbPath } from "./config";
import { openStore } from "./store";

const kind = z.enum(["priority", "status", "fact", "relationship"]);
const volatility = z.enum(["stable", "slow", "volatile"]);
const state = z.enum(["active", "stale", "contradicted", "retired"]);
const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

export function buildServer(api: Api): McpServer {
  const server = new McpServer({ name: "claims-mcp", version: "0.1.0" });

  server.registerTool("claim_add", {
    description: "Assert a claim about an entity (idempotent on entity+kind+claim). Re-asserting updates it.",
    inputSchema: {
      claim: z.string().min(1), entity: z.string().min(1), kind, volatility,
      confidence: z.number().min(0).max(1), assertedRank: z.number().int().positive().optional(),
      source: z.string().default("declared"), evidence: z.array(z.string()).optional(),
    },
  }, async (a) => json(api.add({
    claim: a.claim, entity: a.entity, kind: a.kind, volatility: a.volatility, confidence: a.confidence,
    assertedRank: a.assertedRank ?? null, source: a.source, evidenceJson: JSON.stringify(a.evidence ?? []),
  })));

  server.registerTool("claim_search", {
    description: "Find claims whose text or entity contains the query (case-insensitive).",
    inputSchema: { query: z.string(), state: state.optional() },
  }, async (a) => json(api.search(a.query, a.state)));

  server.registerTool("claim_confirm", {
    description: "Mark a claim as re-confirmed now (resets decay, reactivates it). Optionally set a new confidence.",
    inputSchema: { id: z.string(), confidence: z.number().min(0).max(1).optional() },
  }, async (a) => (api.confirm(a.id, a.confidence) ? json({ ok: true }) : fail(`no claim ${a.id}`)));

  server.registerTool("claim_retract", {
    description: "Retire a claim. It stays in the store but no longer takes part in decay or contradiction checks.",
    inputSchema: { id: z.string() },
  }, async (a) => (api.retract(a.id) ? json({ ok: true }) : fail(`no claim ${a.id}`)));

  server.registerTool("claims_contradictions", {
    description: "List conflicts among active claims (duplicate priority ranks, multiple status claims per entity). Optionally pass observed weekly ranks to also detect sustained rank drops.",
    inputSchema: {
      observed: z.object({
        signals: z.array(z.record(z.array(z.number()))),
        validPeriods: z.array(z.boolean()).optional(),
      }).optional(),
    },
  }, async (a) => json(api.contradictions(a.observed)));

  server.registerTool("claims_decayed", {
    description: "Active claims whose confidence has decayed past a staleness threshold (0..1, default 0.5), stalest first.",
    inputSchema: { minStaleness: z.number().min(0).max(1).optional() },
  }, async (a) => json(api.decayed(a.minStaleness)));

  server.registerResource("claims-all", "claims://all", {
    description: "Every claim in the store, as JSON.", mimeType: "application/json",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(api.list(), null, 2) }] }));

  return server;
}

if (import.meta.main) {
  const api = createApi(openStore(resolveDbPath(process.argv.slice(2))));
  await buildServer(api).connect(new StdioServerTransport());
}
