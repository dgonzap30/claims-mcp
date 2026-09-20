import { homedir } from "node:os";
import { join } from "node:path";

/** Database path: --db flag, then CLAIMS_MCP_DB, then ~/.claims-mcp/claims.db. */
export function resolveDbPath(argv: string[]): string {
  const i = argv.indexOf("--db");
  if (i >= 0 && argv[i + 1]) return argv[i + 1]!;
  return process.env.CLAIMS_MCP_DB || join(homedir(), ".claims-mcp", "claims.db");
}
