import { expect, test } from "bun:test";
import { findConflicts, findContradictions, findRankDrops } from "../src/contradiction";
import { claim } from "./fixtures";

const prio = (entity: string, rank: number, id = entity) =>
  claim({ id, entity, kind: "priority", assertedRank: rank, claim: `${entity} is #${rank}` });

test("two entities claiming the same priority rank conflict", () => {
  const out = findConflicts([prio("alpha", 1), prio("beta", 1), prio("gamma", 2)]);
  expect(out.map((c) => c.entity).sort()).toEqual(["alpha", "beta"]);
  expect(out.every((c) => c.kind === "duplicate-rank")).toBe(true);
});

test("two active status claims for one entity conflict; a retired one does not", () => {
  const a = claim({ id: "a", kind: "status", claim: "launching" });
  const b = claim({ id: "b", kind: "status", claim: "paused" });
  expect(findConflicts([a, b])).toHaveLength(2);
  expect(findConflicts([a, { ...b, state: "retired" }])).toHaveLength(0);
});

const signals = (ranks: number[]) => ({ signals: [{ alpha: ranks, beta: [1, 1, 1, 1] }, { alpha: ranks, beta: [1, 1, 1, 1] }] });

test("sustained rank drop across all signals is flagged", () => {
  const out = findRankDrops([prio("alpha", 1)], signals([5, 5, 5, 1]));
  expect(out).toHaveLength(1);
  expect(out[0]!.kind).toBe("rank-drop");
});

test("a drop shorter than the sustain window, or inside the margin, is not flagged", () => {
  expect(findRankDrops([prio("alpha", 1)], signals([5, 5, 1, 1]))).toHaveLength(0);
  expect(findRankDrops([prio("alpha", 1)], signals([3, 3, 3, 3]))).toHaveLength(0);
});

test("periods marked invalid are skipped, not counted as drops or recoveries", () => {
  const observed = { ...signals([5, 1, 5, 5, 5]), validPeriods: [true, false, true, true, true] };
  expect(findRankDrops([prio("alpha", 1)], observed)).toHaveLength(1);
});

test("both signals must agree", () => {
  const observed = { signals: [{ alpha: [5, 5, 5] }, { alpha: [1, 1, 1] }] };
  expect(findRankDrops([prio("alpha", 1)], observed)).toHaveLength(0);
});

test("findContradictions merges and sorts by severity, and omits rank-drop without observations", () => {
  const claims = [prio("alpha", 1), prio("beta", 1)];
  expect(findContradictions(claims).every((c) => c.kind === "duplicate-rank")).toBe(true);
  const sev = findContradictions(claims, signals([5, 5, 5])).map((c) => c.severity);
  expect(sev).toEqual([...sev].sort((a, b) => b - a));
});
