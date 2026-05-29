import Phaser from "phaser";
import "./style.css";
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
  type ChainCalcRound,
  type ColorConflictRound,
  type ColorName,
  type FlowCountRound,
  type InstantMemoryRound,
  type MiniSudokuRound,
  type QuickMathRound,
  type TrainingId,
} from "./core/rules";
import { buildResultFromSession } from "./core/scoring";
import {
  allTrainingIds,
  applyGameResult,
  createEmptySave,
  getDailyTrainingIds,
  getUnlockedTrainingIds,
  summarizeRecentDays,
  trainingDimensions,
  trainingNames,
  type GameResult,
  type PlayMode,
  type SaveData,
} from "./core/progress";

type Page = "home" | "training-list" | "playing" | "result" | "history" | "settings";
type Round = QuickMathRound | ColorConflictRound | InstantMemoryRound | FlowCountRound | ChainCalcRound | MiniSudokuRound;

interface TrainingMeta {
  id: TrainingId;
  subtitle: string;
  description: string;
  targetQuestions: number;
  accent: string;
}

interface SessionState {
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
  instantHidden: boolean;
  instantSelections: number[];
  sudokuAnswer: number[];
  message: string;
}

interface AppState {
  page: Page;
  today: string;
  save: SaveData;
  session: SessionState | null;
  lastResult: GameResult | null;
  error: string | null;
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

const storageKey = "naoli-rike-save-v1";
const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root");
}

const trainingMetas: Record<TrainingId, TrainingMeta> = {
  "quick-math": {
    id: "quick-math",
    subtitle: "限时基础心算",
    description: "连续回答加减乘除题，速度和正确率共同影响成绩。",
    targetQuestions: 10,
    accent: "#1b8aef",
  },
  "color-conflict": {
    id: "color-conflict",
    subtitle: "选择真实文字颜色",
    description: "忽略文字含义，点击文字实际显示的颜色。",
    targetQuestions: 12,
    accent: "#18a66a",
  },
  "instant-memory": {
    id: "instant-memory",
    subtitle: "短暂显示后顺序点击",
    description: "记住数字位置，隐藏后按从小到大的顺序点击。",
    targetQuestions: 5,
    accent: "#8d5cf6",
  },
  "flow-count": {
    id: "flow-count",
    subtitle: "跟踪进出数量",
    description: "观察进入和离开的数量变化，回答最后剩余多少。",
    targetQuestions: 6,
    accent: "#e38b29",
  },
  "chain-calc": {
    id: "chain-calc",
    subtitle: "连续运算记结果",
    description: "从起始数字开始，连续心算每一步，输入最终结果。",
    targetQuestions: 6,
    accent: "#dd4f7a",
  },
  "mini-sudoku": {
    id: "mini-sudoku",
    subtitle: "4x4 逻辑格",
    description: "补全每行、每列、每宫都包含 1-4 的迷你数独。",
    targetQuestions: 1,
    accent: "#5462e7",
  },
};

const colorMap: Record<ColorName, string> = {
  红: "#e34d59",
  蓝: "#2476e8",
  绿: "#20a46b",
  黄: "#e0a51a",
};

const state: AppState = {
  page: "home",
  today: getTodayKey(),
  save: loadSave(getTodayKey()),
  session: null,
  lastResult: null,
  error: null,
};

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

window.render_game_to_text = () =>
  JSON.stringify({
    page: state.page,
    today: state.today,
    unlocked: getUnlockedTrainingIds(state.save),
    daily: state.save.days[state.today] ?? null,
    session: state.session
      ? {
          trainingId: state.session.trainingId,
          mode: state.session.mode,
          correct: state.session.correct,
          wrong: state.session.wrong,
          questionIndex: state.session.questionIndex,
          targetQuestions: state.session.targetQuestions,
          message: state.session.message,
        }
      : null,
    lastResult: state.lastResult
      ? { trainingId: state.lastResult.trainingId, score: state.lastResult.score, correct: state.lastResult.correct, wrong: state.lastResult.wrong }
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
  const action = actionTarget.dataset.action;
  try {
    handleAction(action ?? "", actionTarget);
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
  if (action === "start") {
    const trainingId = parseTrainingId(target.dataset.training);
    const mode = parseMode(target.dataset.mode);
    startTraining(trainingId, mode);
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
    localStorage.removeItem(storageKey);
    state.save = createEmptySave(state.today);
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
  const meta = trainingMetas[trainingId];
  state.session = {
    id: `${trainingId}-${Date.now()}`,
    mode,
    trainingId,
    startedAt: performance.now(),
    correct: 0,
    wrong: 0,
    combo: 0,
    maxCombo: 0,
    questionIndex: 1,
    targetQuestions: meta.targetQuestions,
    difficulty: getDifficultyForTraining(trainingId),
    round: createRound(trainingId, getDifficultyForTraining(trainingId)),
    instantHidden: false,
    instantSelections: [],
    sudokuAnswer: [],
    message: "开始",
  };
  if (state.session.round.type === "mini-sudoku") {
    state.session.sudokuAnswer = [...state.session.round.givens];
  }
  state.page = "playing";
  scheduleInstantHide();
  render();
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
  const session = requireSession();
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
  const session = requireSession();
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
  const session = requireSession();
  if (session.round.type !== "mini-sudoku") {
    throw new Error("当前不是迷你数独训练");
  }
  if (session.sudokuAnswer.some((value) => value < 1 || value > 4)) {
    throw new Error("数独还有空格未填写");
  }
  finishQuestion(answerMiniSudoku(session.round, session.sudokuAnswer).correct);
}

function finishQuestion(correct: boolean): void {
  const session = requireSession();
  if (correct) {
    session.correct += 1;
    session.combo += 1;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    session.message = "正确";
  } else {
    session.wrong += 1;
    session.combo = 0;
    session.message = "错误";
  }

  if (session.questionIndex >= session.targetQuestions) {
    finishSession();
    return;
  }

  session.questionIndex += 1;
  session.round = createRound(session.trainingId, session.difficulty);
  session.instantHidden = false;
  session.instantSelections = [];
  if (session.round.type === "mini-sudoku") {
    session.sudokuAnswer = [...session.round.givens];
  }
  scheduleInstantHide();
  render();
}

function finishSession(): void {
  const session = requireSession();
  const result = buildResultFromSession({
    date: state.today,
    mode: session.mode,
    trainingId: session.trainingId,
    startedAt: session.startedAt,
    endedAt: performance.now(),
    correct: session.correct,
    wrong: session.wrong,
    maxCombo: session.maxCombo,
  });
  state.save = applyGameResult(state.save, result);
  saveState(state.save);
  state.lastResult = result;
  state.session = null;
  state.page = "result";
  render();
}

function scheduleInstantHide(): void {
  const session = state.session;
  if (!session || session.round.type !== "instant-memory") {
    return;
  }
  const sessionId = session.id;
  window.setTimeout(() => {
    if (state.session?.id === sessionId && state.session.round.type === "instant-memory") {
      state.session.instantHidden = true;
      state.session.message = "按从小到大顺序点击";
      render();
    }
  }, session.round.revealMs);
}

function render(): void {
  state.error = null;
  if (state.page === "home") {
    ui.innerHTML = renderHome();
  } else if (state.page === "training-list") {
    ui.innerHTML = renderTrainingList();
  } else if (state.page === "playing") {
    ui.innerHTML = renderPlaying();
  } else if (state.page === "result") {
    ui.innerHTML = renderResult();
  } else if (state.page === "history") {
    ui.innerHTML = renderHistory();
  } else {
    ui.innerHTML = renderSettings();
  }
}

function renderHome(): string {
  const day = state.save.days[state.today];
  const dailyIds = getDailyTrainingIds(state.today);
  const completedCount = day?.dailyTrainingIds.length ?? 0;
  const completed = day?.dailyCompleted ?? false;
  return `
    <section class="panel home-panel">
      <header class="hero">
        <div>
          <p class="eyebrow">每日脑力训练</p>
          <h1>脑力日课</h1>
          <p class="subtitle">每天 3 个经典训练，记录计算、记忆、反应、专注和逻辑变化。</p>
        </div>
        <div class="streak" aria-label="连续打卡">
          <span>${state.save.currentStreak}</span>
          <small>连续天数</small>
        </div>
      </header>
      <div class="daily-card">
        <div>
          <h2>今日训练</h2>
          <p>${completed ? "今日已完成，仍可自由练习。" : `已完成 ${completedCount}/${dailyIds.length} 项`}</p>
        </div>
        <button class="primary" data-action="start" data-training="${dailyIds.find((id) => !day?.dailyTrainingIds.includes(id)) ?? dailyIds[0]}" data-mode="daily">
          ${completed ? "再练一次" : "开始今日训练"}
        </button>
      </div>
      <div class="training-strip">
        ${dailyIds.map((id) => renderMiniTraining(id, day?.dailyTrainingIds.includes(id) ?? false)).join("")}
      </div>
      <nav class="bottom-actions">
        <button data-action="go-list">全部训练</button>
        <button data-action="go-history">历史</button>
        <button data-action="go-settings">设置</button>
      </nav>
    </section>
  `;
}

function renderMiniTraining(id: TrainingId, done: boolean): string {
  const meta = trainingMetas[id];
  return `
    <article class="mini-card ${done ? "done" : ""}" style="--accent:${meta.accent}">
      <strong>${trainingNames[id]}</strong>
      <span>${done ? "已完成" : meta.subtitle}</span>
    </article>
  `;
}

function renderTrainingList(): string {
  const unlocked = getUnlockedTrainingIds(state.save);
  return `
    <section class="panel">
      ${renderTopBar("训练列表")}
      <div class="cards-grid">
        ${allTrainingIds
          .map((id) => {
            const meta = trainingMetas[id];
            const locked = !unlocked.includes(id);
            return `
              <article class="training-card ${locked ? "locked" : ""}" style="--accent:${meta.accent}">
                <div class="card-icon">${trainingNames[id].slice(0, 1)}</div>
                <div>
                  <h2>${trainingNames[id]}</h2>
                  <p>${meta.description}</p>
                  <div class="tags">${trainingDimensions[id].map((dimension) => `<span>${dimensionLabel(dimension)}</span>`).join("")}</div>
                </div>
                <button class="primary" data-action="start" data-training="${id}" data-mode="free" ${locked ? "disabled" : ""}>
                  ${locked ? "未解锁" : "自由训练"}
                </button>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderPlaying(): string {
  const session = requireSession();
  const meta = trainingMetas[session.trainingId];
  return `
    <section class="panel play-panel" style="--accent:${meta.accent}">
      <div class="play-head">
        <button class="icon-button" data-action="go-home" aria-label="返回">←</button>
        <div>
          <strong>${trainingNames[session.trainingId]}</strong>
          <span>${session.questionIndex}/${session.targetQuestions} · 正确 ${session.correct} · 错误 ${session.wrong}</span>
        </div>
        <div class="combo">连击 ${session.combo}</div>
      </div>
      <div class="progress-bar"><span style="width:${Math.round(((session.questionIndex - 1) / session.targetQuestions) * 100)}%"></span></div>
      <div class="playfield">
        ${renderRound(session)}
      </div>
      <p class="message">${session.message}</p>
    </section>
  `;
}

function renderRound(session: SessionState): string {
  const round = session.round;
  if (round.type === "quick-math") {
    return `
      <p class="round-label">输入计算结果</p>
      <div class="big-prompt">${round.prompt}</div>
      ${renderNumberInput()}
    `;
  }
  if (round.type === "color-conflict") {
    return `
      <p class="round-label">选择文字真实颜色</p>
      <div class="color-word" style="color:${colorMap[round.inkColor]}">${round.wordMeaning}</div>
      <div class="choice-row">
        ${round.choices.map((choice) => `<button data-action="answer" data-value="${choice}" style="--choice:${colorMap[choice]}">${choice}</button>`).join("")}
      </div>
    `;
  }
  if (round.type === "instant-memory") {
    return `
      <p class="round-label">${session.instantHidden ? "按数字从小到大点击位置" : "记住数字位置"}</p>
      <div class="memory-grid">
        ${Array.from({ length: 9 }, (_, position) => {
          const item = round.items.find((entry) => entry.position === position);
          const selected = session.instantSelections.includes(position);
          return `<button class="${selected ? "selected" : ""}" data-action="memory-cell" data-position="${position}">
            ${!session.instantHidden && item ? item.value : selected ? "✓" : ""}
          </button>`;
        }).join("")}
      </div>
    `;
  }
  if (round.type === "flow-count") {
    return `
      <p class="round-label">从 ${round.initialCount} 开始，计算最终剩余</p>
      <div class="event-list">
        ${round.events.map((event) => `<span class="${event.delta > 0 ? "in" : "out"}">${event.delta > 0 ? "+" : ""}${event.delta}</span>`).join("")}
      </div>
      ${renderNumberInput()}
    `;
  }
  if (round.type === "chain-calc") {
    return `
      <p class="round-label">从起始数字开始连续心算</p>
      <div class="chain">
        <strong>${round.start}</strong>
        ${round.steps.map((step) => `<span>${step.operator}${step.value}</span>`).join("")}
      </div>
      ${renderNumberInput()}
    `;
  }
  return `
    <p class="round-label">补全 4x4 数独</p>
    <div class="sudoku-grid">
      ${round.givens
        .map((given, index) => {
          if (given !== 0) {
            return `<div class="sudoku-given">${given}</div>`;
          }
          const value = session.sudokuAnswer[index] || "";
          return `<input inputmode="numeric" maxlength="1" data-sudoku-index="${index}" value="${value}" aria-label="格子 ${index + 1}" />`;
        })
        .join("")}
    </div>
    <button class="primary wide" data-action="submit-sudoku">提交数独</button>
  `;
}

function renderNumberInput(): string {
  return `
    <div class="answer-line">
      <input data-role="answer-input" inputmode="numeric" autocomplete="off" placeholder="答案" autofocus />
      <button class="primary" data-action="submit-input">提交</button>
    </div>
  `;
}

function renderResult(): string {
  const result = state.lastResult;
  if (!result) {
    return `<section class="panel">${renderTopBar("结算")}<p>暂无结算结果。</p></section>`;
  }
  return `
    <section class="panel result-panel">
      <p class="eyebrow">训练完成</p>
      <h1>${trainingNames[result.trainingId]}</h1>
      <div class="score">${result.score}</div>
      <div class="result-grid">
        <span>正确 <strong>${result.correct}</strong></span>
        <span>错误 <strong>${result.wrong}</strong></span>
        <span>用时 <strong>${Math.round(result.durationMs / 1000)}s</strong></span>
        <span>最大连击 <strong>${result.maxCombo}</strong></span>
      </div>
      <div class="dimension-bars">
        ${(Object.entries(result.dimensions) as [keyof typeof result.dimensions, number][])
          .map(([key, value]) => `<label><span>${dimensionLabel(key)}</span><i style="width:${Math.min(100, value * 6)}%"></i></label>`)
          .join("")}
      </div>
      <nav class="bottom-actions">
        <button class="primary" data-action="go-home">返回首页</button>
        <button data-action="go-list">自由训练</button>
        <button data-action="go-history">看历史</button>
      </nav>
    </section>
  `;
}

function renderHistory(): string {
  const days = summarizeRecentDays(state.save, 7);
  return `
    <section class="panel">
      ${renderTopBar("历史记录")}
      <div class="history-chart">
        ${
          days.length === 0
            ? `<p>还没有训练记录。</p>`
            : days
                .map((day) => {
                  const height = Math.max(12, Math.min(100, day.totalScore / 40));
                  return `<div><span style="height:${height}%"></span><small>${day.date.slice(5)}</small></div>`;
                })
                .join("")
        }
      </div>
      <div class="best-list">
        ${allTrainingIds
          .map((id) => {
            const best = state.save.bestByTraining[id];
            return `<article><strong>${trainingNames[id]}</strong><span>${best ? `${best.score} 分` : "暂无成绩"}</span></article>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSettings(): string {
  return `
    <section class="panel">
      ${renderTopBar("设置")}
      <div class="settings-list">
        <article><strong>版本</strong><span>0.1.0 首版</span></article>
        <article><strong>平台</strong><span>H5，预留微信小游戏适配层</span></article>
        <article><strong>全屏</strong><span>按 F 切换</span></article>
      </div>
      <button class="danger" data-action="clear-save">清除本地记录</button>
    </section>
  `;
}

function renderTopBar(title: string): string {
  return `
    <div class="top-bar">
      <button class="icon-button" data-action="go-home" aria-label="返回首页">←</button>
      <h1>${title}</h1>
    </div>
  `;
}

function finishWithInputFocus(): void {
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

function dimensionLabel(key: string): string {
  const labels: Record<string, string> = {
    calculation: "计算",
    memory: "记忆",
    reaction: "反应",
    focus: "专注",
    logic: "逻辑",
  };
  return labels[key] ?? key;
}

function loadSave(today: string): SaveData {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    const save = createEmptySave(today);
    saveState(save);
    return save;
  }
  const parsed = JSON.parse(raw) as SaveData;
  getUnlockedTrainingIds(parsed);
  return parsed;
}

function saveState(save: SaveData): void {
  localStorage.setItem(storageKey, JSON.stringify(save));
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

const observer = new MutationObserver(finishWithInputFocus);
observer.observe(ui, { childList: true, subtree: true });
