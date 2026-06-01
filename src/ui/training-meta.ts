import type { ColorName, TrainingId } from "../core/rules";
import type { TrainingMeta } from "../app-types";

export const trainingMetas: Record<TrainingId, TrainingMeta> = {
  "color-conflict": {
    id: "color-conflict",
    subtitle: "30 秒内选择真实颜色",
    description: "忽略文字含义，越快选出文字真实颜色分越高。",
    targetQuestions: 12,
    timeLimitMs: 30_000,
    accent: "#18a66a",
    icon: "color-conflict",
  },
  "quick-math": {
    id: "quick-math",
    subtitle: "45 秒限时心算",
    description: "连续回答加减乘除题，速度和正确率共同影响成绩。",
    targetQuestions: 10,
    timeLimitMs: 45_000,
    accent: "#1b8aef",
    icon: "quick-math",
  },
  "instant-memory": {
    id: "instant-memory",
    subtitle: "60 秒记忆挑战",
    description: "记住数字位置，隐藏后按从小到大的顺序点击。",
    targetQuestions: 5,
    timeLimitMs: 60_000,
    accent: "#8d5cf6",
    icon: "instant-memory",
  },
  "flow-count": {
    id: "flow-count",
    subtitle: "跟踪进出数量",
    description: "观察进入和离开的数量变化，回答最后剩余多少。",
    targetQuestions: 6,
    timeLimitMs: 50_000,
    accent: "#e38b29",
    icon: "flow-count",
  },
  "chain-calc": {
    id: "chain-calc",
    subtitle: "连续运算记结果",
    description: "从起始数字开始，连续心算每一步，输入最终结果。",
    targetQuestions: 6,
    timeLimitMs: 55_000,
    accent: "#dd4f7a",
    icon: "chain-calc",
  },
  "mini-sudoku": {
    id: "mini-sudoku",
    subtitle: "4x4 逻辑格",
    description: "补全每行、每列、每宫都包含 1-4 的迷你数独。",
    targetQuestions: 1,
    timeLimitMs: 120_000,
    accent: "#5462e7",
    icon: "mini-sudoku",
  },
};

export const colorMap: Record<ColorName, string> = {
  红: "#e34d59",
  蓝: "#2476e8",
  绿: "#20a46b",
  黄: "#e0a51a",
};

export function dimensionLabel(key: string): string {
  const labels: Record<string, string> = {
    calculation: "计算",
    memory: "记忆",
    reaction: "反应",
    focus: "专注",
    logic: "逻辑",
  };
  return labels[key] ?? key;
}
