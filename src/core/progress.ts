import type { DimensionKey, Dimensions, TrainingId } from "./rules";

export type PlayMode = "daily" | "free";

export interface GameResult {
  date: string;
  mode: PlayMode;
  trainingId: TrainingId;
  score: number;
  correct: number;
  wrong: number;
  durationMs: number;
  maxCombo: number;
  dimensions: Dimensions;
}

export interface DayRecord {
  date: string;
  dailyTrainingIds: TrainingId[];
  dailyCompleted: boolean;
  totalScore: number;
  dimensions: Dimensions;
  results: GameResult[];
}

export interface SaveData {
  schemaVersion: 2;
  createdAt: string;
  days: Record<string, DayRecord>;
  bestByTraining: Partial<Record<TrainingId, GameResult>>;
  completedDates: string[];
  currentStreak: number;
  settings: SaveSettings;
}

export interface SaveSettings {
  soundEnabled: boolean;
}

export const allTrainingIds: TrainingId[] = [
  "color-conflict",
  "quick-math",
  "instant-memory",
  "flow-count",
  "chain-calc",
  "mini-sudoku",
];

export const trainingNames: Record<TrainingId, string> = {
  "quick-math": "极速计算",
  "color-conflict": "颜色冲突",
  "instant-memory": "瞬间记忆",
  "flow-count": "进出计数",
  "chain-calc": "连续心算",
  "mini-sudoku": "迷你数独",
};

export const trainingDimensions: Record<TrainingId, DimensionKey[]> = {
  "quick-math": ["calculation", "focus"],
  "color-conflict": ["reaction", "focus"],
  "instant-memory": ["memory", "focus"],
  "flow-count": ["memory", "focus"],
  "chain-calc": ["calculation", "memory"],
  "mini-sudoku": ["logic", "focus"],
};

export function emptyDimensions(): Dimensions {
  return { calculation: 0, memory: 0, reaction: 0, focus: 0, logic: 0 };
}

export function createEmptySave(today: string): SaveData {
  assertDate(today, "today");
  return {
    schemaVersion: 2,
    createdAt: today,
    days: {},
    bestByTraining: {},
    completedDates: [],
    currentStreak: 0,
    settings: { soundEnabled: true },
  };
}

export function getDailyTrainingIds(_date: string): TrainingId[] {
  return ["color-conflict", "quick-math", "instant-memory"];
}

export function getUnlockedTrainingIds(save: SaveData): TrainingId[] {
  validateSaveShape(save);
  const completedCount = save.completedDates.length;
  const unlocked: TrainingId[] = ["color-conflict", "quick-math", "instant-memory"];
  if (completedCount >= 1) {
    unlocked.push("flow-count");
  }
  if (completedCount >= 2) {
    unlocked.push("chain-calc");
  }
  if (completedCount >= 4) {
    unlocked.push("mini-sudoku");
  }
  return unlocked;
}

export function applyGameResult(save: SaveData, result: GameResult): SaveData {
  validateSaveShape(save);
  validateResult(result);
  const dailyIds = getDailyTrainingIds(result.date);
  const day = cloneDay(
    save.days[result.date] ?? {
      date: result.date,
      dailyTrainingIds: [],
      dailyCompleted: false,
      totalScore: 0,
      dimensions: emptyDimensions(),
      results: [],
    },
  );

  day.results.push(result);
  day.totalScore = day.results.reduce((sum, item) => sum + item.score, 0);
  day.dimensions = sumDimensions(day.results.map((item) => item.dimensions));

  if (result.mode === "daily" && !day.dailyTrainingIds.includes(result.trainingId)) {
    day.dailyTrainingIds.push(result.trainingId);
  }
  day.dailyCompleted = dailyIds.every((trainingId) => day.dailyTrainingIds.includes(trainingId));

  const bestByTraining = { ...save.bestByTraining };
  const previousBest = bestByTraining[result.trainingId];
  if (!previousBest || result.score > previousBest.score) {
    bestByTraining[result.trainingId] = result;
  }

  const completedDates = new Set(save.completedDates);
  if (day.dailyCompleted) {
    completedDates.add(result.date);
  }

  const nextSave: SaveData = {
    ...save,
    days: { ...save.days, [result.date]: day },
    bestByTraining,
    completedDates: [...completedDates].sort(),
    currentStreak: calculateCurrentStreak([...completedDates].sort(), result.date),
  };
  validateSaveShape(nextSave);
  return nextSave;
}

export function summarizeRecentDays(save: SaveData, days = 7): DayRecord[] {
  validateSaveShape(save);
  return [...Object.values(save.days)]
    .sort((a: DayRecord, b: DayRecord) => a.date.localeCompare(b.date))
    .slice(-days);
}

function cloneDay(day: DayRecord): DayRecord {
  return {
    ...day,
    dailyTrainingIds: [...day.dailyTrainingIds],
    dimensions: { ...day.dimensions },
    results: [...day.results],
  };
}

function sumDimensions(items: Dimensions[]): Dimensions {
  const total = emptyDimensions();
  for (const item of items) {
    for (const key of Object.keys(total) as DimensionKey[]) {
      total[key] += item[key];
    }
  }
  return total;
}

function calculateCurrentStreak(completedDates: string[], today: string): number {
  assertDate(today, "today");
  if (completedDates.length === 0) {
    return 0;
  }
  const completed = new Set(completedDates);
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00.000Z`);
  while (completed.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function validateResult(result: GameResult): void {
  assertDate(result.date, "result date");
  if (!allTrainingIds.includes(result.trainingId)) {
    throw new Error(`Unknown training id: ${result.trainingId}`);
  }
  for (const numericField of ["score", "correct", "wrong", "durationMs", "maxCombo"] as const) {
    if (!Number.isFinite(result[numericField]) || result[numericField] < 0) {
      throw new Error(`Invalid result ${numericField}: ${result[numericField]}`);
    }
  }
  for (const key of Object.keys(emptyDimensions()) as DimensionKey[]) {
    if (!Number.isFinite(result.dimensions[key]) || result.dimensions[key] < 0) {
      throw new Error(`Invalid dimension ${key}: ${result.dimensions[key]}`);
    }
  }
}

function validateSaveShape(save: SaveData): void {
  if (save.schemaVersion !== 2) {
    throw new Error(`Unsupported save schema version: ${save.schemaVersion}`);
  }
  assertDate(save.createdAt, "save createdAt");
  if (!save.settings || typeof save.settings.soundEnabled !== "boolean") {
    throw new Error("Invalid save settings");
  }
  for (const date of save.completedDates) {
    assertDate(date, "completed date");
  }
}

function assertDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}
