import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const text = (r: any) => JSON.parse(r.content[0].text);

test("stdio server exposes the tools and round-trips a claim", async () => {
  const db = join(mkdtempSync(join(tmpdir(), "claims-mcp-")), "c.db");
  const transport = new StdioClientTransport({ command: "bun", args: [join(import.meta.dir, "../src/mcp.ts"), "--db", db] });
  const client = new Client({ name: "smoke", version: "0" });
  await client.connect(transport);
  try {
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(["claim_add", "claim_confirm", "claim_retract", "claim_search", "claims_contradictions", "claims_decayed"]);

    const a = text(await client.callTool({ name: "claim_add", arguments: { claim: "alpha is first", entity: "alpha", kind: "priority", volatility: "slow", confidence: 0.9, assertedRank: 1 } }));
    await client.callTool({ name: "claim_add", arguments: { claim: "beta is first", entity: "beta", kind: "priority", volatility: "slow", confidence: 0.9, assertedRank: 1 } });
    expect(text(await client.callTool({ name: "claim_search", arguments: { query: "alpha" } }))).toHaveLength(1);
    expect(text(await client.callTool({ name: "claims_contradictions", arguments: {} }))).toHaveLength(2);
    expect(text(await client.callTool({ name: "claims_decayed", arguments: {} }))).toHaveLength(0);

    const res = await client.readResource({ uri: "claims://all" });
    expect(JSON.parse((res.contents[0] as { text: string }).text)).toHaveLength(2);

    expect(text(await client.callTool({ name: "claim_retract", arguments: { id: a.id } }))).toEqual({ ok: true });
    expect(text(await client.callTool({ name: "claims_contradictions", arguments: {} }))).toHaveLength(0);
    const miss = await client.callTool({ name: "claim_confirm", arguments: { id: "cl_nope" } });
    expect(miss.isError).toBe(true);
  } finally {
    await client.close();
  }
}, 20_000);
