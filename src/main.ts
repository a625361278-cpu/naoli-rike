import Phaser from "phaser";
import "./style.css";
import type { AppState, Round, SessionState } from "./app-types";
import {
  answerChainCalc,
  answerColorConflict,
  answerFlowCount,
  answerInstantMemory,
  answerMiniSudoku,
  answerQuickMath,
  createChainCalcRound,
  createColorConflictRound,
  createFlowCountRound,
  createInstantMemoryRound,
  createMiniSudokuRound,
  createQuickMathRound,
  type ColorName,
  type TrainingId,
} from "./core/rules";
import { buildResultFromSession } from "./core/scoring";
import {
  allTrainingIds,
  applyGameResult,
  getUnlockedTrainingIds,
  trainingNames,
  type PlayMode,
} from "./core/progress";
import { updateSoundEnabled } from "./core/save";
import { AudioService } from "./platform/audio";
import { clearSave, loadSave, saveState } from "./platform/storage";
import { renderPage } from "./ui/render";
import { trainingMetas } from "./ui/training-meta";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __naoliAudioLog?: () => string[];
  }
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Missing #app root");
}

const state: AppState = {
  page: "home",
  today: getTodayKey(),
  save: loadSave(getTodayKey()),
  session: null,
  lastResult: null,
  error: null,
};

const audio = new AudioService();
audio.setEnabled(state.save.settings.soundEnabled);

appRoot.innerHTML = `
  <div id="game-bg"></div>
  <main id="ui-root" class="ui-shell" aria-live="polite"></main>
`;

const uiRoot = document.querySelector<HTMLElement>("#ui-root");
if (!uiRoot) {
  throw new Error("Missing UI root");
}
const ui = uiRoot;

class BrainBackgroundScene extends Phaser.Scene {
  private circles: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super("BrainBackgroundScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#f5f8fb");
    for (let index = 0; index < 18; index += 1) {
      const circle = this.add.circle(
        Phaser.Math.Between(20, this.scale.width - 20),
        Phaser.Math.Between(20, this.scale.height - 20),
        Phaser.Math.Between(5, 16),
        0x64c7bc,
        0.12,
      );
      this.circles.push(circle);
    }
    this.scale.on("resize", this.redraw, this);
  }

  update(_time: number, delta: number): void {
    for (const [index, circle] of this.circles.entries()) {
      circle.y += (0.012 + index * 0.0008) * delta;
      circle.x += Math.sin((circle.y + index * 17) * 0.01) * 0.12;
      if (circle.y > this.scale.height + 24) {
        circle.y = -24;
        circle.x = Phaser.Math.Between(20, this.scale.width - 20);
      }
    }
  }

  private redraw(): void {
    this.cameras.main.setBackgroundColor("#f5f8fb");
  }
}

const phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-bg",
  width: window.innerWidth,
  height: window.innerHeight,
  transparent: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BrainBackgroundScene],
});

window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let index = 0; index < steps; index += 1) {
    phaserGame.loop.tick();
  }
};

window.__naoliAudioLog = () => audio.getPlayLog();
window.render_game_to_text = () =>
  JSON.stringify({
    page: state.page,
    today: state.today,
    unlocked: getUnlockedTrainingIds(state.save),
    daily: state.save.days[state.today] ?? null,
    soundEnabled: state.save.settings.soundEnabled,
    audioLog: audio.getPlayLog(),
    session: state.session
      ? {
          trainingId: state.session.trainingId,
          mode: state.session.mode,
          phase: state.session.phase,
          countdown: state.session.countdown,
          timeLeftMs: state.session.timeLeftMs,
          timeLimitMs: state.session.timeLimitMs,
          correct: state.session.correct,
          wrong: state.session.wrong,
          questionIndex: state.session.questionIndex,
          targetQuestions: state.session.targetQuestions,
          message: state.session.message,
        }
      : null,
    lastResult: state.lastResult
      ? {
          trainingId: state.lastResult.trainingId,
          score: state.lastResult.score,
          correct: state.lastResult.correct,
          wrong: state.lastResult.wrong,
        }
      : null,
    error: state.error,
    coordinateSystem: "DOM layout; Phaser background origin top-left, x right, y down",
  });

ui.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const actionTarget = target.closest<HTMLElement>("[data-action]");
  if (!actionTarget) {
    return;
  }
  try {
    if (actionTarget.dataset.action !== "answer" && actionTarget.dataset.action !== "memory-cell") {
      audio.play("click");
    }
    handleAction(actionTarget.dataset.action ?? "", actionTarget);
  } catch (error) {
    showError(error);
  }
});

ui.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.sudokuIndex && state.session?.round.type === "mini-sudoku") {
    const index = Number(input.dataset.sudokuIndex);
    const value = Number(input.value);
    if (Number.isInteger(index)) {
      state.session.sudokuAnswer[index] = Number.isInteger(value) && value >= 1 && value <= 4 ? value : 0;
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  }
  if (state.page === "playing" && event.key === "Enter") {
    try {
      submitTypedAnswer();
    } catch (error) {
      showError(error);
    }
  }
});

render();

function handleAction(action: string, target: HTMLElement): void {
  if (action === "go-home") {
    state.page = "home";
    state.session = null;
    render();
    return;
  }
  if (action === "go-list") {
    state.page = "training-list";
    render();
    return;
  }
  if (action === "go-history") {
    state.page = "history";
    render();
    return;
  }
  if (action === "go-settings") {
    state.page = "settings";
    render();
    return;
  }
  if (action === "toggle-sound") {
    state.save = updateSoundEnabled(state.save, !state.save.settings.soundEnabled);
    audio.setEnabled(state.save.settings.soundEnabled);
    saveState(state.save);
    render();
    return;
  }
  if (action === "start") {
    startTraining(parseTrainingId(target.dataset.training), parseMode(target.dataset.mode));
    return;
  }
  if (action === "answer") {
    submitAnswer(target.dataset.value ?? "");
    return;
  }
  if (action === "memory-cell") {
    submitMemoryCell(Number(target.dataset.position));
    return;
  }
  if (action === "submit-input") {
    submitTypedAnswer();
    return;
  }
  if (action === "submit-sudoku") {
    submitSudoku();
    return;
  }
  if (action === "clear-save") {
    state.save = clearSave(state.today);
    audio.setEnabled(state.save.settings.soundEnabled);
    state.lastResult = null;
    state.session = null;
    state.page = "home";
    render();
  }
}

function startTraining(trainingId: TrainingId, mode: PlayMode): void {
  const unlocked = getUnlockedTrainingIds(state.save);
  if (!unlocked.includes(trainingId)) {
    throw new Error(`训练尚未解锁：${trainingNames[trainingId]}`);
  }
  const difficulty = getDifficultyForTraining(trainingId);
  const round = createRound(trainingId, difficulty);
  const timeLimitMs = trainingMetas[trainingId].timeLimitMs;
  const session: SessionState = {
    id: `${trainingId}-${Date.now()}`,
    mode,
    trainingId,
    startedAt: 0,
    correct: 0,
    wrong: 0,
    combo: 0,
    maxCombo: 0,
    questionIndex: 1,
    targetQuestions: trainingMetas[trainingId].targetQuestions,
    difficulty,
    round,
    timeLimitMs,
    deadlineAt: 0,
    timeLeftMs: timeLimitMs,
    phase: "countdown",
    countdown: 3,
    lastFeedback: null,
    instantHidden: false,
    instantSelections: [],
    sudokuAnswer: round.type === "mini-sudoku" ? [...round.givens] : [],
    message: "准备",
  };
  state.session = session;
  state.page = "playing";
  render();
  runCountdown(session.id);
}

function runCountdown(sessionId: string): void {
  const tick = () => {
    const session = state.session;
    if (!session || session.id !== sessionId || session.phase !== "countdown") {
      return;
    }
    if (session.countdown <= 1) {
      session.phase = "question";
      session.countdown = 0;
      session.startedAt = performance.now();
      session.deadlineAt = session.startedAt + session.timeLimitMs;
      session.timeLeftMs = session.timeLimitMs;
      session.message = "开始答题";
      scheduleInstantHide();
      runTimer(session.id);
      render();
      return;
    }
    session.countdown -= 1;
    render();
    window.setTimeout(tick, 650);
  };
  window.setTimeout(tick, 650);
}

function createRound(trainingId: TrainingId, difficulty: number): Round {
  const seed = Date.now() + Math.floor(Math.random() * 100_000);
  if (trainingId === "quick-math") {
    return createQuickMathRound({ difficulty, seed });
  }
  if (trainingId === "color-conflict") {
    return createColorConflictRound({ difficulty, seed });
  }
  if (trainingId === "instant-memory") {
    return createInstantMemoryRound({ difficulty, seed });
  }
  if (trainingId === "flow-count") {
    return createFlowCountRound({ difficulty, seed });
  }
  if (trainingId === "chain-calc") {
    return createChainCalcRound({ difficulty, seed });
  }
  return createMiniSudokuRound({ difficulty, seed });
}

function submitAnswer(raw: string): void {
  const session = requireQuestionSession();
  const round = session.round;
  let correct = false;
  if (round.type === "color-conflict") {
    correct = answerColorConflict(round, raw as ColorName).correct;
  } else if (round.type === "quick-math") {
    correct = answerQuickMath(round, Number(raw)).correct;
  } else if (round.type === "flow-count") {
    correct = answerFlowCount(round, Number(raw)).correct;
  } else if (round.type === "chain-calc") {
    correct = answerChainCalc(round, Number(raw)).correct;
  } else {
    throw new Error(`当前题型不接受普通答案：${round.type}`);
  }
  finishQuestion(correct);
}

function submitTypedAnswer(): void {
  const input = ui.querySelector<HTMLInputElement>("[data-role='answer-input']");
  if (!input) {
    return;
  }
  if (input.value.trim() === "") {
    throw new Error("请输入答案");
  }
  submitAnswer(input.value.trim());
}

function submitMemoryCell(position: number): void {
  const session = requireQuestionSession();
  if (session.round.type !== "instant-memory") {
    throw new Error("当前不是瞬间记忆训练");
  }
  if (!session.instantHidden) {
    return;
  }
  if (!Number.isInteger(position) || position < 0 || position >= 9) {
    throw new Error(`无效格子位置：${position}`);
  }
  if (!session.instantSelections.includes(position)) {
    session.instantSelections.push(position);
  }
  const expectedLength = session.round.items.length;
  if (session.instantSelections.length >= expectedLength) {
    finishQuestion(answerInstantMemory(session.round, session.instantSelections).correct);
  } else {
    render();
  }
}

function submitSudoku(): void {
  const session = requireQuestionSession();
  if (session.round.type !== "mini-sudoku") {
    throw new Error("当前不是迷你数独训练");
  }
  if (session.sudokuAnswer.some((value) => value < 1 || value > 4)) {
    throw new Error("数独还有空格未填写");
  }
  finishQuestion(answerMiniSudoku(session.round, session.sudokuAnswer).correct);
}

function finishQuestion(correct: boolean): void {
  const session = requireQuestionSession();
  if (correct) {
    session.correct += 1;
    session.combo += 1;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    session.message = "正确";
    session.lastFeedback = "correct";
    audio.play("correct");
  } else {
    session.wrong += 1;
    session.combo = 0;
    session.message = "错误";
    session.lastFeedback = "wrong";
    audio.play("wrong");
  }
  session.phase = "feedback";
  render();

  const sessionId = session.id;
  window.setTimeout(() => {
    if (!state.session || state.session.id !== sessionId) {
      return;
    }
    if (state.session.questionIndex >= state.session.targetQuestions) {
      finishSession();
      return;
    }
    startNextQuestion();
  }, 460);
}

function startNextQuestion(): void {
  const session = requireSession();
  session.questionIndex += 1;
  session.round = createRound(session.trainingId, session.difficulty);
  session.phase = "question";
  session.lastFeedback = null;
  session.instantHidden = false;
  session.instantSelections = [];
  session.sudokuAnswer = session.round.type === "mini-sudoku" ? [...session.round.givens] : [];
  session.message = "继续";
  scheduleInstantHide();
  render();
}

function finishSession(): void {
  const session = requireSession();
  if (session.startedAt <= 0) {
    throw new Error("训练计时状态异常，无法结算");
  }
  const result = buildResultFromSession({
    date: state.today,
    mode: session.mode,
    trainingId: session.trainingId,
    startedAt: session.startedAt,
    endedAt: performance.now(),
    timeLimitMs: session.timeLimitMs,
    correct: session.correct,
    wrong: session.wrong,
    maxCombo: session.maxCombo,
  });
  state.save = applyGameResult(state.save, result);
  saveState(state.save);
  state.lastResult = result;
  state.session = null;
  state.page = "result";
  audio.play("complete");
  render();
}

function runTimer(sessionId: string): void {
  const tick = () => {
    const session = state.session;
    if (!session || session.id !== sessionId || session.phase === "countdown") {
      return;
    }
    const now = performance.now();
    session.timeLeftMs = Math.max(0, session.deadlineAt - now);
    if (session.timeLeftMs <= 0) {
      session.message = "时间到";
      finishSession();
      return;
    }
    syncTimerDisplay(session);
    window.setTimeout(tick, 200);
  };
  window.setTimeout(tick, 200);
}

function syncTimerDisplay(session: SessionState): void {
  const seconds = Math.ceil(session.timeLeftMs / 1000);
  const percent = Math.max(0, Math.min(100, Math.round((session.timeLeftMs / session.timeLimitMs) * 100)));
  const danger = session.timeLeftMs <= 10_000 && session.phase === "question";
  const chip = ui.querySelector<HTMLElement>(".timer-chip");
  const bar = ui.querySelector<HTMLElement>(".timer-bar");
  const barFill = ui.querySelector<HTMLElement>(".timer-bar span");
  if (chip) {
    chip.textContent = `${seconds}s`;
    chip.classList.toggle("danger", danger);
  }
  if (bar) {
    bar.classList.toggle("danger", danger);
  }
  if (barFill) {
    barFill.style.width = `${percent}%`;
  }
}

function scheduleInstantHide(): void {
  const session = state.session;
  if (!session || session.round.type !== "instant-memory" || session.phase !== "question") {
    return;
  }
  const sessionId = session.id;
  const questionIndex = session.questionIndex;
  window.setTimeout(() => {
    if (
      state.session?.id === sessionId &&
      state.session.questionIndex === questionIndex &&
      state.session.round.type === "instant-memory" &&
      state.session.phase === "question"
    ) {
      state.session.instantHidden = true;
      state.session.message = "按从小到大顺序点击";
      render();
    }
  }, session.round.revealMs);
}

function render(): void {
  state.error = null;
  ui.innerHTML = renderPage(state);
}

function focusAnswerInput(): void {
  window.setTimeout(() => ui.querySelector<HTMLInputElement>("[data-role='answer-input']")?.focus(), 0);
}

function getDifficultyForTraining(trainingId: TrainingId): number {
  const best = state.save.bestByTraining[trainingId];
  if (!best) {
    return 1;
  }
  if (best.score > 1200) {
    return 3;
  }
  if (best.score > 800) {
    return 2;
  }
  return 1;
}

function requireSession(): SessionState {
  if (!state.session) {
    throw new Error("当前没有进行中的训练");
  }
  return state.session;
}

function requireQuestionSession(): SessionState {
  const session = requireSession();
  if (session.phase !== "question") {
    throw new Error("训练尚未进入答题阶段");
  }
  return session;
}

function parseTrainingId(value: string | undefined): TrainingId {
  if (!value || !allTrainingIds.includes(value as TrainingId)) {
    throw new Error(`未知训练：${value ?? "空"}`);
  }
  return value as TrainingId;
}

function parseMode(value: string | undefined): PlayMode {
  if (value !== "daily" && value !== "free") {
    throw new Error(`未知训练模式：${value ?? "空"}`);
  }
  return value;
}

function showError(error: unknown): void {
  state.error = error instanceof Error ? error.message : String(error);
  ui.insertAdjacentHTML("afterbegin", `<div class="toast">${state.error}</div>`);
}

function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen();
  }
}

const observer = new MutationObserver(focusAnswerInput);
observer.observe(ui, { childList: true, subtree: true });
