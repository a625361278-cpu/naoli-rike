import type { AppState, SessionState } from "../app-types";
import { getAssetUrl, trainingIconIndex } from "../assets/manifest";
import type { DimensionKey, TrainingId } from "../core/rules";
import {
  allTrainingIds,
  getDailyTrainingIds,
  getUnlockedTrainingIds,
  summarizeRecentDays,
  trainingDimensions,
  trainingNames,
} from "../core/progress";
import { colorMap, dimensionLabel, trainingMetas } from "./training-meta";

export function renderPage(state: AppState): string {
  if (state.page === "home") {
    return renderHome(state);
  }
  if (state.page === "training-list") {
    return renderTrainingList(state);
  }
  if (state.page === "playing") {
    return renderPlaying(state);
  }
  if (state.page === "result") {
    return renderResult(state);
  }
  if (state.page === "history") {
    return renderHistory(state);
  }
  return renderSettings(state);
}

function renderHome(state: AppState): string {
  const day = state.save.days[state.today];
  const dailyIds = getDailyTrainingIds(state.today);
  const completedCount = day?.dailyTrainingIds.length ?? 0;
  const completed = day?.dailyCompleted ?? false;
  const nextTraining = dailyIds.find((id) => !day?.dailyTrainingIds.includes(id)) ?? dailyIds[0];
  return `
    <section class="panel home-panel">
      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">每日脑力训练</p>
          <h1>脑力日课</h1>
          <p class="subtitle">每天 3 个经典训练，记录计算、记忆、反应、专注和逻辑变化。</p>
          <div class="hero-actions">
            <button class="primary" data-action="start" data-training="${nextTraining}" data-mode="daily">
              ${completed ? "再练一次" : "开始今日训练"}
            </button>
            <button data-action="go-list">全部训练</button>
          </div>
        </div>
        <div class="hero-art">
          <img src="${getAssetUrl("hero")}" alt="" />
          <div class="streak" aria-label="连续打卡">
            <span>${state.save.currentStreak}</span>
            <small>连续天数</small>
          </div>
        </div>
      </header>
      <div class="daily-card">
        <div>
          <h2>今日训练</h2>
          <p>${completed ? "今日已完成，仍可自由练习。" : `已完成 ${completedCount}/${dailyIds.length} 项`}</p>
        </div>
        <div class="daily-ring" style="--daily:${Math.round((completedCount / dailyIds.length) * 100)}%">${completedCount}/${dailyIds.length}</div>
      </div>
      <div class="training-strip">
        ${dailyIds.map((id) => renderMiniTraining(id, day?.dailyTrainingIds.includes(id) ?? false)).join("")}
      </div>
      <nav class="bottom-actions">
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
      ${renderTrainingIcon(id, "mini-icon")}
      <div>
        <strong>${trainingNames[id]}</strong>
        <span>${done ? "已完成" : meta.subtitle}</span>
      </div>
    </article>
  `;
}

function renderTrainingList(state: AppState): string {
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
                ${renderTrainingIcon(id, "card-icon")}
                <div class="training-copy">
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

function renderPlaying(state: AppState): string {
  const session = requireSession(state);
  const meta = trainingMetas[session.trainingId];
  return `
    <section class="panel play-panel ${session.lastFeedback ? `feedback-${session.lastFeedback}` : ""}" style="--accent:${meta.accent}">
      <div class="play-head">
        <button class="icon-button" data-action="go-home" aria-label="返回">←</button>
        <div>
          <strong>${trainingNames[session.trainingId]}</strong>
          <span>${session.questionIndex}/${session.targetQuestions} · 正确 ${session.correct} · 错误 ${session.wrong}</span>
        </div>
        <div class="play-stats">
          <div class="timer-chip ${session.timeLeftMs <= 10_000 && session.phase === "question" ? "danger" : ""}">
            ${Math.ceil(session.timeLeftMs / 1000)}s
          </div>
          <div class="combo">连击 ${session.combo}</div>
        </div>
      </div>
      <div class="timer-bar ${session.timeLeftMs <= 10_000 && session.phase === "question" ? "danger" : ""}">
        <span style="width:${timePercent(session)}%"></span>
      </div>
      <div class="progress-bar"><span style="width:${Math.round(((session.questionIndex - 1) / session.targetQuestions) * 100)}%"></span></div>
      <div class="playfield">
        ${session.phase === "countdown" ? renderCountdown(session) : renderRound(session)}
      </div>
      <p class="message">${session.message}</p>
    </section>
  `;
}

function renderCountdown(session: SessionState): string {
  return `
    <div class="countdown-card">
      ${renderTrainingIcon(session.trainingId, "countdown-icon")}
      <p>${trainingNames[session.trainingId]}</p>
      <strong>${session.countdown}</strong>
    </div>
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
      <p class="round-label">${session.instantHidden ? "按数字从小到大点击位置" : "记住数字位置，倒计时后会隐藏"}</p>
      <div class="memory-grid ${session.instantHidden ? "hidden-phase" : "reveal-phase"}">
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
        ${round.events.map((event, index) => `<span class="${event.delta > 0 ? "in" : "out"}" style="--i:${index}">${event.delta > 0 ? "+" : ""}${event.delta}</span>`).join("")}
      </div>
      ${renderNumberInput()}
    `;
  }
  if (round.type === "chain-calc") {
    return `
      <p class="round-label">从起始数字开始连续心算</p>
      <div class="chain">
        <strong>${round.start}</strong>
        ${round.steps.map((step, index) => `<span style="--i:${index}">${step.operator}${step.value}</span>`).join("")}
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
          return `<input inputmode="numeric" pattern="[1-4]" maxlength="1" data-sudoku-index="${index}" value="${value}" aria-label="格子 ${index + 1}" />`;
        })
        .join("")}
    </div>
    <button class="primary wide" data-action="submit-sudoku">提交数独</button>
  `;
}

function renderResult(state: AppState): string {
  const result = state.lastResult;
  if (!result) {
    return `<section class="panel">${renderTopBar("结算")}<p>暂无结算结果。</p></section>`;
  }
  return `
    <section class="panel result-panel">
      <p class="eyebrow">训练完成</p>
      ${renderTrainingIcon(result.trainingId, "result-icon")}
      <h1>${trainingNames[result.trainingId]}</h1>
      <div class="score">${result.score}</div>
      <div class="result-grid">
        <span>正确 <strong>${result.correct}</strong></span>
        <span>错误 <strong>${result.wrong}</strong></span>
        <span>用时 <strong>${Math.round(result.durationMs / 1000)}s</strong></span>
        <span>剩余 <strong>${Math.max(0, Math.ceil((trainingMetas[result.trainingId].timeLimitMs - result.durationMs) / 1000))}s</strong></span>
        <span>最大连击 <strong>${result.maxCombo}</strong></span>
      </div>
      <div class="dimension-bars">
        ${(Object.entries(result.dimensions) as [DimensionKey, number][])
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

function renderHistory(state: AppState): string {
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
            return `<article>${renderTrainingIcon(id, "mini-icon")}<strong>${trainingNames[id]}</strong><span>${best ? `${best.score} 分` : "暂无成绩"}</span></article>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSettings(state: AppState): string {
  return `
    <section class="panel">
      ${renderTopBar("设置")}
      <div class="settings-list">
        <article><strong>音效</strong><button class="toggle ${state.save.settings.soundEnabled ? "on" : ""}" data-action="toggle-sound">${state.save.settings.soundEnabled ? "开启" : "关闭"}</button></article>
        <article><strong>版本</strong><span>0.2.0 体验打磨版</span></article>
        <article><strong>平台</strong><span>H5，预留微信小游戏适配层</span></article>
        <article><strong>全屏</strong><span>按 F 切换</span></article>
      </div>
      <button class="danger" data-action="clear-save">清除本地记录</button>
    </section>
  `;
}

function renderTrainingIcon(id: TrainingId, className: string): string {
  const index = trainingIconIndex[id];
  const col = index % 2;
  const row = Math.floor(index / 2);
  return `<div class="${className} training-icon" style="--icon-x:${col};--icon-y:${row};background-image:url('${getAssetUrl("training-icon-sheet")}')" aria-hidden="true"></div>`;
}

function timePercent(session: SessionState): number {
  if (session.timeLimitMs <= 0) {
    throw new Error(`Invalid session time limit: ${session.timeLimitMs}`);
  }
  return Math.max(0, Math.min(100, Math.round((session.timeLeftMs / session.timeLimitMs) * 100)));
}

function renderNumberInput(): string {
  return `
    <div class="answer-line">
      <input data-role="answer-input" inputmode="numeric" autocomplete="off" placeholder="答案" />
      <button class="primary" data-action="submit-input">提交</button>
    </div>
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

function requireSession(state: AppState): SessionState {
  if (!state.session) {
    throw new Error("当前没有进行中的训练");
  }
  return state.session;
}
