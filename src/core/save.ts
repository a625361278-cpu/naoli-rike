import type { SaveData } from "./progress";

interface LegacySaveV1 {
  schemaVersion: 1;
  createdAt: string;
  days: SaveData["days"];
  bestByTraining: SaveData["bestByTraining"];
  completedDates: string[];
  currentStreak: number;
}

type UnknownSave = Partial<SaveData> | Partial<LegacySaveV1> | unknown;

export function migrateSaveData(raw: UnknownSave): SaveData {
  if (!isRecord(raw)) {
    throw new Error("Invalid save: expected object");
  }

  if (raw.schemaVersion === 2) {
    assertV2Save(raw);
    return raw;
  }

  if (raw.schemaVersion === 1) {
    assertV1Save(raw);
    return {
      schemaVersion: 2,
      createdAt: raw.createdAt,
      days: raw.days,
      bestByTraining: raw.bestByTraining,
      completedDates: raw.completedDates,
      currentStreak: raw.currentStreak,
      settings: { soundEnabled: true },
    };
  }

  throw new Error(`Unsupported save schema version: ${String(raw.schemaVersion)}`);
}

export function updateSoundEnabled(save: SaveData, soundEnabled: boolean): SaveData {
  assertV2Save(save);
  return {
    ...save,
    settings: {
      ...save.settings,
      soundEnabled,
    },
  };
}

function assertV2Save(value: unknown): asserts value is SaveData {
  if (!isRecord(value)) {
    throw new Error("Invalid v2 save: expected object");
  }
  if (value.schemaVersion !== 2) {
    throw new Error(`Invalid v2 save: schemaVersion=${String(value.schemaVersion)}`);
  }
  assertBaseSaveFields(value, "v2");
  if (!isRecord(value.settings) || typeof value.settings.soundEnabled !== "boolean") {
    throw new Error("Invalid v2 save: missing settings.soundEnabled");
  }
}

function assertV1Save(value: unknown): asserts value is LegacySaveV1 {
  if (!isRecord(value)) {
    throw new Error("Invalid v1 save: expected object");
  }
  if (value.schemaVersion !== 1) {
    throw new Error(`Invalid v1 save: schemaVersion=${String(value.schemaVersion)}`);
  }
  assertBaseSaveFields(value, "v1");
}

function assertBaseSaveFields(value: Record<string, unknown>, schema: string): void {
  if (typeof value.createdAt !== "string" || !isDateKey(value.createdAt)) {
    throw new Error(`Invalid ${schema} save: createdAt`);
  }
  if (!isRecord(value.days)) {
    throw new Error(`Invalid ${schema} save: days`);
  }
  if (!isRecord(value.bestByTraining)) {
    throw new Error(`Invalid ${schema} save: bestByTraining`);
  }
  if (!Array.isArray(value.completedDates) || !value.completedDates.every((date) => typeof date === "string" && isDateKey(date))) {
    throw new Error(`Invalid ${schema} save: completedDates`);
  }
  if (typeof value.currentStreak !== "number" || !Number.isInteger(value.currentStreak) || value.currentStreak < 0) {
    throw new Error(`Invalid ${schema} save: currentStreak`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
