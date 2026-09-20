import { expect, test } from "bun:test";
import { decayedConfidence, staleness } from "../src/decay";
import { MIN_CONFIDENCE } from "../src/thresholds";
import { DAY, T0, claim } from "./fixtures";

test("one half-life halves confidence, per volatility tier", () => {
  expect(decayedConfidence(claim({ volatility: "volatile" }), T0 + 7 * DAY)).toBeCloseTo(0.4, 6);
  expect(decayedConfidence(claim({ volatility: "slow" }), T0 + 30 * DAY)).toBeCloseTo(0.4, 6);
  expect(decayedConfidence(claim({ volatility: "stable" }), T0 + 365 * DAY)).toBeCloseTo(0.4, 6);
});

test("confirmation resets the decay anchor", () => {
  const c = claim({ volatility: "volatile", lastConfirmed: new Date(T0 + 6 * DAY).toISOString() });
  expect(decayedConfidence(c, T0 + 7 * DAY)).toBeGreaterThan(0.7);
});

test("never goes below the floor; staleness stays under 1", () => {
  const c = claim({ volatility: "volatile" });
  expect(decayedConfidence(c, T0 + 1000 * DAY)).toBe(MIN_CONFIDENCE);
  expect(staleness(c, T0 + 1000 * DAY)).toBeLessThan(1);
  expect(staleness(c, T0)).toBe(0);
});

test("a clock before the anchor does not inflate confidence", () => {
  expect(decayedConfidence(claim(), T0 - 5 * DAY)).toBe(0.8);
});
