import type { GameResult, PlayMode } from "./progress";
import { emptyDimensions, trainingDimensions } from "./progress";
import type { DimensionKey, TrainingId } from "./rules";

export interface SessionSummary {
  date: string;
  mode: PlayMode;
  trainingId: TrainingId;
  startedAt: number;
  endedAt: number;
  timeLimitMs?: number;
  correct: number;
  wrong: number;
  maxCombo: number;
}

export function buildResultFromSession(session: SessionSummary): GameResult {
  const durationMs = session.endedAt - session.startedAt;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`Invalid session duration: ${durationMs}`);
  }
  if (session.timeLimitMs !== undefined && (!Number.isFinite(session.timeLimitMs) || session.timeLimitMs <= 0)) {
    throw new Error(`Invalid time limit: ${String(session.timeLimitMs)}`);
  }
  if (session.correct < 0 || session.wrong < 0 || session.maxCombo < 0) {
    throw new Error("Invalid negative session value");
  }

  const attempts = session.correct + session.wrong;
  const accuracy = attempts === 0 ? 0 : session.correct / attempts;
  const dimensions = emptyDimensions();
  if (attempts === 0) {
    return {
      date: session.date,
      mode: session.mode,
      trainingId: session.trainingId,
      score: 0,
      correct: session.correct,
      wrong: session.wrong,
      durationMs,
      maxCombo: session.maxCombo,
      dimensions,
    };
  }
  const timeLimitMs = session.timeLimitMs ?? 120_000;
  const remainingRatio = Math.max(0, Math.min(1, (timeLimitMs - durationMs) / timeLimitMs));
  const speedBonus = Math.round(remainingRatio * 520);
  const comboBonus = Math.min(session.maxCombo * 12, 160);
  const score = Math.round(session.correct * 80 + accuracy * 300 + speedBonus + comboBonus - session.wrong * 45);
  const activeDimensions = trainingDimensions[session.trainingId];
  const baseValue = Math.max(1, Math.round((score / 100) * accuracy));

  for (const key of activeDimensions) {
    dimensions[key] = baseValue;
  }
  if (activeDimensions.includes("focus")) {
    dimensions.focus += Math.max(1, session.maxCombo);
  }
  spreadSupportDimensions(dimensions, activeDimensions, Math.max(0, Math.round(session.correct / 2)));

  return {
    date: session.date,
    mode: session.mode,
    trainingId: session.trainingId,
    score: Math.max(0, score),
    correct: session.correct,
    wrong: session.wrong,
    durationMs,
    maxCombo: session.maxCombo,
    dimensions,
  };
}

function spreadSupportDimensions(dimensions: Record<DimensionKey, number>, active: DimensionKey[], value: number): void {
  if (value === 0) {
    return;
  }
  for (const key of active) {
    if (dimensions[key] === 0) {
      dimensions[key] = value;
    }
  }
}
