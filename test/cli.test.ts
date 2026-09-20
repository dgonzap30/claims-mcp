import { expect, test } from "bun:test";
import { createApi } from "../src/api";
import { run } from "../src/cli";
import { openStore } from "../src/store";
import { T0 } from "./fixtures";

const api = () => createApi(openStore(":memory:"), () => new Date(T0));

test("add then search and list through the CLI dispatcher", () => {
  const a = api();
  const added = run(["add", "acme", "priority", "slow", "0.8", "acme", "comes", "first", "--rank", "1"], a);
  expect(added.code).toBe(0);
  expect(JSON.parse(added.out).assertedRank).toBe(1);
  expect(JSON.parse(run(["search", "comes"], a).out)).toHaveLength(1);
  expect(JSON.parse(run(["list"], a).out)).toHaveLength(1);
});

test("bad input returns usage with code 2; unknown ids return code 1", () => {
  const a = api();
  expect(run(["add", "acme", "fact", "slow", "7", "x"], a).code).toBe(2);
  expect(run(["nope"], a).code).toBe(2);
  expect(run(["retract", "cl_missing"], a).code).toBe(1);
});
