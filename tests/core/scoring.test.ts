import { describe, expect, it } from "vitest";
import { buildResultFromSession } from "../../src/core/scoring";

describe("scoring", () => {
  it("calculates score from real speed, accuracy, combo, and training dimensions", () => {
    const result = buildResultFromSession({
      date: "2026-05-29",
      mode: "daily",
      trainingId: "quick-math",
      startedAt: 0,
      endedAt: 45_000,
      correct: 9,
      wrong: 1,
      maxCombo: 6,
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.correct).toBe(9);
    expect(result.wrong).toBe(1);
    expect(result.durationMs).toBe(45_000);
    expect(result.dimensions.calculation).toBeGreaterThan(result.dimensions.memory);
    expect(result.dimensions.focus).toBeGreaterThan(0);
  });

  it("throws on impossible session timing instead of inventing a default score", () => {
    expect(() =>
      buildResultFromSession({
        date: "2026-05-29",
        mode: "free",
        trainingId: "color-conflict",
        startedAt: 10_000,
        endedAt: 9_000,
        correct: 1,
        wrong: 0,
        maxCombo: 1,
      }),
    ).toThrow(/Invalid session duration/);
  });
});

