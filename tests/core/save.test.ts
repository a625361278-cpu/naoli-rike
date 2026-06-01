import { describe, expect, it } from "vitest";
import { createEmptySave } from "../../src/core/progress";
import { migrateSaveData, updateSoundEnabled } from "../../src/core/save";

describe("save schema v2", () => {
  it("creates saves with explicit sound settings", () => {
    const save = createEmptySave("2026-05-30");

    expect(save.schemaVersion).toBe(2);
    expect(save.settings.soundEnabled).toBe(true);
  });

  it("migrates v1 saves to v2 without hiding invalid shapes", () => {
    const migrated = migrateSaveData({
      schemaVersion: 1,
      createdAt: "2026-05-29",
      days: {},
      bestByTraining: {},
      completedDates: ["2026-05-29"],
      currentStreak: 1,
    });

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.settings.soundEnabled).toBe(true);
    expect(migrated.completedDates).toEqual(["2026-05-29"]);
    expect(() => migrateSaveData({ schemaVersion: 1, createdAt: "bad" })).toThrow(/Invalid v1 save/);
  });

  it("updates sound settings immutably", () => {
    const save = createEmptySave("2026-05-30");
    const next = updateSoundEnabled(save, false);

    expect(next.settings.soundEnabled).toBe(false);
    expect(save.settings.soundEnabled).toBe(true);
  });
});

