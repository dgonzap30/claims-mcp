# claims-mcp

A small memory for agents that treats what it knows as **claims that age**. You assert a claim about an entity ("acme is priority #1", "the launch is on track"), each claim decays on a half-life set by how volatile it is, and the server tells you which claims have gone stale and which contradict each other.

It is a stdio [MCP](https://modelcontextprotocol.io) server plus a CLI over one local SQLite file. No network, no accounts.

> **Runtime: Bun.** v0 uses `bun:sqlite`, so it runs on [Bun](https://bun.sh) ≥ 1.1, not plain Node. A Node build (`node:sqlite`) is a possible follow-up.

## Model

| Field | Meaning |
|---|---|
| `entity` | What the claim is about (free text key). |
| `kind` | `priority` (may carry `assertedRank`), `status`, `fact`, `relationship`. |
| `volatility` | `stable` (half-life 365d), `slow` (30d), `volatile` (7d). |
| `confidence` | 0..1 at last confirmation. Effective confidence halves every half-life since `lastConfirmed`, floored at 0.05. |
| `state` | `active`, `stale`, `contradicted`, `retired`. Only `active` claims are checked. |

A claim's identity is `(entity, kind, claim)`: asserting it again updates it rather than duplicating.

## MCP tools

| Tool | Does |
|---|---|
| `claim_add` | Assert or update a claim. |
| `claim_search` | Case-insensitive substring search over claim text and entity. |
| `claim_confirm` | Re-confirm now: resets decay, reactivates, optionally sets confidence. |
| `claim_retract` | Retire a claim. |
| `claims_contradictions` | Conflicts among active claims: `duplicate-rank` (two entities claim the same priority rank), `status-conflict` (several active status claims for one entity). Pass `observed` weekly ranks to also get `rank-drop`: an asserted-priority entity that every signal ranks worse than `rank + 2` for 3 valid periods. |
| `claims_decayed` | Active claims past a staleness threshold (default 0.5), stalest first. |

Resource: `claims://all` (every claim as JSON).

`observed` is `{ "signals": [{ "<entity>": [rank_now, rank_1_period_ago, ...] }, ...], "validPeriods": [true, ...] }`. You supply the observations (commit counts, time spent, anything you can rank); the server does not collect them.

## Use

```bash
bun install
```

Add to an MCP client (Claude Code shown):

```bash
claude mcp add claims -- bun /path/to/claims-mcp/src/mcp.ts
```

The database lives at `~/.claims-mcp/claims.db`; override with `--db <path>` or `CLAIMS_MCP_DB`.

CLI:

```bash
bun src/cli.ts add acme priority slow 0.8 "acme comes first" --rank 1
bun src/cli.ts search comes
bun src/cli.ts stale 0.5
bun src/cli.ts contradictions
bun src/cli.ts confirm <id>
bun src/cli.ts retract <id>
```

## Development

```bash
bun test          # 19 tests, synthetic claims only
bun run typecheck
bun run audit     # publish gate: home paths, private names, secret patterns
```

Set `AUDIT_TERMS="name1|name2"` to add your own private names to the audit.

## Provenance

The decay curve and the rank-drop rule are extracted from a personal agent memory. This package is standalone: it shares no code, data or storage with it.

## Licence

MIT
