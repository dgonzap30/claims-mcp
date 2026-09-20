#!/usr/bin/env bun
import { createApi } from "./api";
import { resolveDbPath } from "./config";
import { openStore } from "./store";
import type { ClaimKind, Volatility } from "./types";

const USAGE = `claims-mcp <command> [--db path]
  add <entity> <kind> <volatility> <confidence> <claim...> [--rank N]
  search <text>
  list
  confirm <id> [confidence]
  retract <id>
  contradictions
  stale [minStaleness]
  serve            run the MCP server on stdio`;

export function run(argv: string[], api: ReturnType<typeof createApi>): { code: number; out: string } {
  const [cmd, ...rest] = argv;
  const ok = (v: unknown) => ({ code: 0, out: JSON.stringify(v, null, 2) });
  switch (cmd) {
    case "add": {
      const ri = rest.indexOf("--rank");
      const rank = ri >= 0 ? Number(rest[ri + 1]) : null;
      const args = ri >= 0 ? rest.filter((_, i) => i !== ri && i !== ri + 1) : rest;
      const [entity, kind, volatility, confidence, ...text] = args;
      const conf = Number(confidence);
      if (!entity || !kind || !volatility || !text.length || Number.isNaN(conf) || conf < 0 || conf > 1) return { code: 2, out: USAGE };
      return ok(api.add({ entity, kind: kind as ClaimKind, volatility: volatility as Volatility, confidence: conf, claim: text.join(" "), assertedRank: rank, source: "cli" }));
    }
    case "search": return rest.length ? ok(api.search(rest.join(" "))) : { code: 2, out: USAGE };
    case "list": return ok(api.list());
    case "confirm": return rest[0] && api.confirm(rest[0], rest[1] ? Number(rest[1]) : undefined) ? ok({ ok: true }) : { code: 1, out: "no such claim" };
    case "retract": return rest[0] && api.retract(rest[0]) ? ok({ ok: true }) : { code: 1, out: "no such claim" };
    case "contradictions": return ok(api.contradictions());
    case "stale": return ok(api.decayed(rest[0] ? Number(rest[0]) : undefined));
    default: return { code: 2, out: USAGE };
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const dbIdx = argv.indexOf("--db");
  const args = dbIdx >= 0 ? argv.filter((_, i) => i !== dbIdx && i !== dbIdx + 1) : argv;
  if (args[0] === "serve") {
    const { buildServer } = await import("./mcp");
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    await buildServer(createApi(openStore(resolveDbPath(argv)))).connect(new StdioServerTransport());
  } else {
    const { code, out } = run(args, createApi(openStore(resolveDbPath(argv))));
    console.log(out);
    process.exit(code);
  }
}
