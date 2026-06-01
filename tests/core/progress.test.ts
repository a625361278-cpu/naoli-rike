import { describe, expect, it } from "vitest";
import {
  applyGameResult,
  allTrainingIds,
  createEmptySave,
  getDailyTrainingIds,
  getUnlockedTrainingIds,
} from "../../src/core/progress";

describe("daily progress and save semantics", () => {
  it("prioritizes color conflict as the first recommended and listed training", () => {
    expect(getDailyTrainingIds("2026-05-29")[0]).toBe("color-conflict");
    expect(allTrainingIds[0]).toBe("color-conflict");
  });

  it("separates daily completion from free training results", () => {
    const save = createEmptySave("2026-05-29");
    const afterFree = applyGameResult(save, {
      date: "2026-05-29",
      mode: "free",
      trainingId: "quick-math",
      score: 800,
      correct: 8,
      wrong: 1,
      durationMs: 50000,
      maxCombo: 5,
      dimensions: { calculation: 8, memory: 0, reaction: 1, focus: 4, logic: 0 },
    });

    expect(afterFree.days["2026-05-29"]?.dailyCompleted).toBe(false);
    expect(afterFree.bestByTraining["quick-math"]?.score).toBe(800);

    const afterDaily = applyGameResult(afterFree, {
      date: "2026-05-29",
      mode: "daily",
      trainingId: "quick-math",
      score: 900,
      correct: 9,
      wrong: 0,
      durationMs: 45000,
      maxCombo: 9,
      dimensions: { calculation: 10, memory: 0, reaction: 1, focus: 5, logic: 0 },
    });

    expect(afterDaily.days["2026-05-29"]?.dailyTrainingIds).toContain("quick-math");
    expect(afterDaily.days["2026-05-29"]?.dailyCompleted).toBe(false);
  });

  it("marks the day complete only after all recommended trainings are done", () => {
    let save = createEmptySave("2026-05-29");
    for (const trainingId of getDailyTrainingIds("2026-05-29")) {
      save = applyGameResult(save, {
        date: "2026-05-29",
        mode: "daily",
        trainingId,
        score: 700,
        correct: 7,
        wrong: 0,
        durationMs: 40000,
        maxCombo: 7,
        dimensions: { calculation: 2, memory: 2, reaction: 2, focus: 2, logic: 0 },
      });
    }

    expect(save.days["2026-05-29"]?.dailyCompleted).toBe(true);
    expect(save.currentStreak).toBe(1);
  });

  it("unlocks trainings by completed-day count without hiding corrupt save data", () => {
    const save = createEmptySave("2026-05-29");
    save.completedDates = ["2026-05-27", "2026-05-28", "2026-05-29"];

    expect(getUnlockedTrainingIds(save)).toContain("chain-calc");
    expect(() => getUnlockedTrainingIds({ ...save, completedDates: ["bad-date"] })).toThrow(
      /Invalid completed date/,
    );
  });
});
