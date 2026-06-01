import type {
  ChainCalcRound,
  ColorConflictRound,
  FlowCountRound,
  InstantMemoryRound,
  MiniSudokuRound,
  QuickMathRound,
  TrainingId,
} from "./core/rules";
import type { GameResult, PlayMode, SaveData } from "./core/progress";

export type Page = "home" | "training-list" | "playing" | "result" | "history" | "settings";

export type Round =
  | QuickMathRound
  | ColorConflictRound
  | InstantMemoryRound
  | FlowCountRound
  | ChainCalcRound
  | MiniSudokuRound;

export type SessionPhase = "countdown" | "question" | "feedback";

export interface TrainingMeta {
  id: TrainingId;
  subtitle: string;
  description: string;
  targetQuestions: number;
  timeLimitMs: number;
  accent: string;
  icon: TrainingId;
}

export interface SessionState {
  id: string;
  mode: PlayMode;
  trainingId: TrainingId;
  startedAt: number;
  correct: number;
  wrong: number;
  combo: number;
  maxCombo: number;
  questionIndex: number;
  targetQuestions: number;
  difficulty: number;
  round: Round;
  timeLimitMs: number;
  deadlineAt: number;
  timeLeftMs: number;
  phase: SessionPhase;
  countdown: number;
  lastFeedback: "correct" | "wrong" | null;
  instantHidden: boolean;
  instantSelections: number[];
  sudokuAnswer: number[];
  message: string;
}

export interface AppState {
  page: Page;
  today: string;
  save: SaveData;
  session: SessionState | null;
  lastResult: GameResult | null;
  error: string | null;
}
