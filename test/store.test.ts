import { expect, test } from "bun:test";
import { createApi } from "../src/api";
import { claimId, openStore } from "../src/store";
import { DAY, T0 } from "./fixtures";

function setup() {
  let now = T0;
  const api = createApi(openStore(":memory:"), () => new Date(now));
  return { api, advance: (ms: number) => { now += ms; } };
}
const base = { entity: "acme", kind: "fact" as const, volatility: "volatile" as const, confidence: 0.9, source: "test" };

test("add is idempotent on the natural key and updates in place", () => {
  const { api } = setup();
  const a = api.add({ ...base, claim: "ships weekly" });
  const b = api.add({ ...base, claim: "ships weekly", confidence: 0.5 });
  expect(b.id).toBe(a.id);
  expect(b.id).toBe(claimId("acme", "fact", "ships weekly"));
  expect(api.list()).toHaveLength(1);
  expect(api.list()[0]!.confidence).toBe(0.5);
});

test("search matches claim text and entity, case-insensitively, and treats % literally", () => {
  const { api } = setup();
  api.add({ ...base, claim: "ships weekly" });
  api.add({ ...base, entity: "zeta", claim: "100% done" });
  expect(api.search("WEEKLY")).toHaveLength(1);
  expect(api.search("zeta")).toHaveLength(1);
  expect(api.search("%")).toHaveLength(1);
});

test("decayed lists stale claims; confirm resets, retract removes", () => {
  const { api, advance } = setup();
  const c = api.add({ ...base, claim: "ships weekly" });
  expect(api.decayed()).toHaveLength(0);
  advance(14 * DAY);
  expect(api.decayed().map((d) => d.claim.id)).toEqual([c.id]);
  expect(api.confirm(c.id)).toBe(true);
  expect(api.decayed()).toHaveLength(0);
  expect(api.retract(c.id)).toBe(true);
  advance(60 * DAY);
  expect(api.decayed()).toHaveLength(0);
  expect(api.confirm("cl_missing")).toBe(false);
});

test("contradictions run over active claims only", () => {
  const { api } = setup();
  const a = api.add({ ...base, kind: "priority", assertedRank: 1, entity: "alpha", claim: "alpha first" });
  api.add({ ...base, kind: "priority", assertedRank: 1, entity: "beta", claim: "beta first" });
  expect(api.contradictions()).toHaveLength(2);
  api.retract(a.id);
  expect(api.contradictions()).toHaveLength(0);
});

test("a file-backed store persists across opens", async () => {
  const dir = await import("node:fs").then((f) => f.mkdtempSync(require("node:os").tmpdir() + "/claims-"));
  const path = dir + "/nested/claims.db";
  createApi(openStore(path), () => new Date(T0)).add({ ...base, claim: "persisted" });
  expect(createApi(openStore(path)).search("persisted")).toHaveLength(1);
});
