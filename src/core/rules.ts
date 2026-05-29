export type TrainingId =
  | "quick-math"
  | "color-conflict"
  | "instant-memory"
  | "flow-count"
  | "chain-calc"
  | "mini-sudoku";

export type DimensionKey = "calculation" | "memory" | "reaction" | "focus" | "logic";

export type Dimensions = Record<DimensionKey, number>;

export interface GeneratorOptions {
  difficulty: number;
  seed?: number;
}

export interface AnswerResult {
  correct: boolean;
}

interface Rng {
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

function createRng(seed = Date.now()): Rng {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    int(min, max) {
      if (max < min) {
        throw new Error(`Invalid random range: ${min}..${max}`);
      }
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick(items) {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty list");
      }
      return items[this.int(0, items.length - 1)];
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = this.int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

function clampDifficulty(difficulty: number): number {
  if (!Number.isInteger(difficulty) || difficulty < 1) {
    throw new Error(`Invalid difficulty: ${difficulty}`);
  }
  return Math.min(difficulty, 5);
}

export interface QuickMathRound {
  type: "quick-math";
  prompt: string;
  left: number;
  right: number;
  operator: "+" | "-" | "x" | "÷";
  answer: number;
}

export function createQuickMathRound(options: GeneratorOptions): QuickMathRound {
  const difficulty = clampDifficulty(options.difficulty);
  const rng = createRng(options.seed);
  const opsByDifficulty: QuickMathRound["operator"][][] = [
    ["+", "-"],
    ["+", "-", "x"],
    ["+", "-", "x", "÷"],
    ["+", "-", "x", "÷"],
    ["+", "-", "x", "÷"],
  ];
  const operator = rng.pick(opsByDifficulty[difficulty - 1]);
  const max = difficulty === 1 ? 9 : difficulty * 12;
  let left = rng.int(1, max);
  let right = rng.int(1, Math.max(3, Math.floor(max / 2)));
  let answer: number;

  if (operator === "+") {
    answer = left + right;
  } else if (operator === "-") {
    if (right > left) {
      [left, right] = [right, left];
    }
    answer = left - right;
  } else if (operator === "x") {
    right = rng.int(2, Math.min(12, Math.max(3, difficulty * 3)));
    answer = left * right;
  } else {
    right = rng.int(2, Math.min(12, Math.max(3, difficulty * 3)));
    answer = rng.int(2, Math.max(4, difficulty * 8));
    left = answer * right;
  }

  return { type: "quick-math", prompt: `${left} ${operator} ${right}`, left, right, operator, answer };
}

export function answerQuickMath(round: QuickMathRound, answer: number): AnswerResult {
  return { correct: round.answer === answer };
}

export type ColorName = "红" | "蓝" | "绿" | "黄";

export interface ColorConflictRound {
  type: "color-conflict";
  wordMeaning: ColorName;
  inkColor: ColorName;
  choices: ColorName[];
}

const colorNames: ColorName[] = ["红", "蓝", "绿", "黄"];

export function createColorConflictRound(options: GeneratorOptions): ColorConflictRound {
  clampDifficulty(options.difficulty);
  const rng = createRng(options.seed);
  const wordMeaning = rng.pick(colorNames);
  let inkColor = rng.pick(colorNames);
  if (inkColor === wordMeaning) {
    inkColor = colorNames[(colorNames.indexOf(wordMeaning) + 1 + rng.int(0, colorNames.length - 2)) % colorNames.length];
  }
  return { type: "color-conflict", wordMeaning, inkColor, choices: colorNames };
}

export function answerColorConflict(round: ColorConflictRound, answer: ColorName): AnswerResult {
  return { correct: round.inkColor === answer };
}

export interface InstantMemoryItem {
  value: number;
  position: number;
}

export interface InstantMemoryRound {
  type: "instant-memory";
  gridSize: 9;
  revealMs: number;
  items: InstantMemoryItem[];
}

export function createInstantMemoryRound(options: GeneratorOptions): InstantMemoryRound {
  const difficulty = clampDifficulty(options.difficulty);
  const rng = createRng(options.seed);
  const count = Math.min(7, 2 + difficulty);
  const positions = rng.shuffle(Array.from({ length: 9 }, (_, index) => index)).slice(0, count);
  const values = rng.shuffle(Array.from({ length: 9 }, (_, index) => index + 1)).slice(0, count);
  const items = positions.map((position, index) => ({ position, value: values[index] }));
  return {
    type: "instant-memory",
    gridSize: 9,
    revealMs: Math.max(900, 2600 - difficulty * 260),
    items,
  };
}

export function answerInstantMemory(round: InstantMemoryRound, positions: number[]): AnswerResult {
  const expected = [...round.items].sort((a, b) => a.value - b.value).map((item) => item.position);
  return { correct: expected.length === positions.length && expected.every((position, index) => position === positions[index]) };
}

export interface FlowEvent {
  delta: number;
  count: number;
}

export interface FlowCountRound {
  type: "flow-count";
  initialCount: number;
  events: FlowEvent[];
  answer: number;
}

export function createFlowCountRound(options: GeneratorOptions): FlowCountRound {
  const difficulty = clampDifficulty(options.difficulty);
  const rng = createRng(options.seed);
  const eventCount = 4 + difficulty * 2;
  let current = rng.int(0, difficulty);
  const initialCount = current;
  const events: FlowEvent[] = [];

  for (let index = 0; index < eventCount; index += 1) {
    let direction: 1 | -1 = rng.int(0, 1) === 0 ? -1 : 1;
    if (current === 0) {
      direction = 1;
    }
    const count = rng.int(1, Math.min(3, difficulty + 1));
    const actualDelta = direction === -1 ? Math.min(count, current) : count;
    if (actualDelta === 0) {
      events.push({ delta: 1, count: 1 });
      current += 1;
    } else {
      events.push({ delta: direction * actualDelta, count: actualDelta });
      current += direction * actualDelta;
    }
    if (current < 0) {
      throw new Error("Flow-count generator produced a negative state");
    }
  }

  return { type: "flow-count", initialCount, events, answer: current };
}

export function answerFlowCount(round: FlowCountRound, answer: number): AnswerResult {
  return { correct: round.answer === answer };
}

export interface ChainStep {
  operator: "+" | "-" | "x" | "÷";
  value: number;
}

export interface ChainCalcRound {
  type: "chain-calc";
  start: number;
  steps: ChainStep[];
  answer: number;
}

export function createChainCalcRound(options: GeneratorOptions): ChainCalcRound {
  const difficulty = clampDifficulty(options.difficulty);
  const rng = createRng(options.seed);
  const stepsCount = 3 + difficulty;
  let answer = rng.int(3, 10 + difficulty * 4);
  const start = answer;
  const steps: ChainStep[] = [];

  for (let index = 0; index < stepsCount; index += 1) {
    const operators: ChainStep["operator"][] = difficulty >= 3 ? ["+", "-", "x", "÷"] : ["+", "-"];
    let operator = rng.pick(operators);
    let value = rng.int(1, Math.max(4, difficulty * 3));

    if (operator === "-") {
      value = Math.min(value, answer);
    }
    if (operator === "x") {
      value = rng.int(2, Math.min(4, difficulty + 1));
    }
    if (operator === "÷") {
      const divisors = [2, 3, 4].filter((divisor) => answer % divisor === 0);
      if (divisors.length === 0) {
        operator = "+";
        value = rng.int(1, Math.max(4, difficulty * 3));
      } else {
        value = rng.pick(divisors);
      }
    }

    steps.push({ operator, value });
    if (operator === "+") {
      answer += value;
    } else if (operator === "-") {
      answer -= value;
    } else if (operator === "x") {
      answer *= value;
    } else {
      answer /= value;
    }
  }

  return { type: "chain-calc", start, steps, answer };
}

export function answerChainCalc(round: ChainCalcRound, answer: number): AnswerResult {
  return { correct: round.answer === answer };
}

export interface MiniSudokuRound {
  type: "mini-sudoku";
  size: 4;
  givens: number[];
  solution: number[];
}

const sudokuBase = [
  1, 2, 3, 4,
  3, 4, 1, 2,
  2, 1, 4, 3,
  4, 3, 2, 1,
];

export function createMiniSudokuRound(options: GeneratorOptions): MiniSudokuRound {
  const difficulty = clampDifficulty(options.difficulty);
  const rng = createRng(options.seed);
  const symbols = rng.shuffle([1, 2, 3, 4]);
  const solution = sudokuBase.map((value) => symbols[value - 1]);
  const givens = [...solution];
  const removeCount = Math.min(11, 4 + difficulty * 2);
  for (const index of rng.shuffle(Array.from({ length: 16 }, (_, cell) => cell)).slice(0, removeCount)) {
    givens[index] = 0;
  }
  if (!isValidSudokuSolution(solution)) {
    throw new Error("Mini-sudoku generator produced an invalid solution");
  }
  return { type: "mini-sudoku", size: 4, givens, solution };
}

export function answerMiniSudoku(round: MiniSudokuRound, answer: number[]): AnswerResult {
  if (answer.length !== 16) {
    return { correct: false };
  }
  return { correct: round.solution.every((value, index) => value === answer[index]) && isValidSudokuSolution(answer) };
}

function isValidSudokuSolution(cells: number[]): boolean {
  if (cells.length !== 16) {
    return false;
  }
  const groups: number[][] = [];
  for (let row = 0; row < 4; row += 1) {
    groups.push([0, 1, 2, 3].map((col) => cells[row * 4 + col]));
  }
  for (let col = 0; col < 4; col += 1) {
    groups.push([0, 1, 2, 3].map((row) => cells[row * 4 + col]));
  }
  for (const start of [0, 2, 8, 10]) {
    groups.push([cells[start], cells[start + 1], cells[start + 4], cells[start + 5]]);
  }
  return groups.every((group) => [...group].sort((a, b) => a - b).join(",") === "1,2,3,4");
}
