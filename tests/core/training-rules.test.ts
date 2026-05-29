import { describe, expect, it } from "vitest";
import {
  answerColorConflict,
  answerFlowCount,
  answerInstantMemory,
  answerMiniSudoku,
  answerQuickMath,
  answerChainCalc,
  createColorConflictRound,
  createFlowCountRound,
  createInstantMemoryRound,
  createMiniSudokuRound,
  createQuickMathRound,
  createChainCalcRound,
} from "../../src/core/rules";

describe("classic training rule generators", () => {
  it("creates quick math rounds with one real answer", () => {
    const round = createQuickMathRound({ difficulty: 2, seed: 101 });
    expect(round.prompt).toMatch(/[+\-x÷]/);
    expect(answerQuickMath(round, round.answer)).toEqual({ correct: true });
    expect(answerQuickMath(round, round.answer + 1)).toEqual({ correct: false });
  });

  it("creates color conflict rounds where actual color is the answer", () => {
    const round = createColorConflictRound({ difficulty: 1, seed: 7 });
    expect(round.wordMeaning).not.toBe(round.inkColor);
    expect(answerColorConflict(round, round.inkColor)).toEqual({ correct: true });
    expect(answerColorConflict(round, round.wordMeaning)).toEqual({ correct: false });
  });

  it("orders instant-memory positions by ascending visible value", () => {
    const round = createInstantMemoryRound({ difficulty: 3, seed: 22 });
    const expected = [...round.items]
      .sort((a, b) => a.value - b.value)
      .map((item) => item.position);
    expect(answerInstantMemory(round, expected)).toEqual({ correct: true });
    expect(answerInstantMemory(round, [...expected].reverse())).toEqual({ correct: false });
  });

  it("creates flow-count events that never make the visible count negative", () => {
    const round = createFlowCountRound({ difficulty: 3, seed: 42 });
    let count = round.initialCount;
    for (const event of round.events) {
      count += event.delta;
      expect(count).toBeGreaterThanOrEqual(0);
    }
    expect(count).toBe(round.answer);
    expect(answerFlowCount(round, round.answer)).toEqual({ correct: true });
  });

  it("creates chain calculation rounds with a verifiable final answer", () => {
    const round = createChainCalcRound({ difficulty: 3, seed: 90 });
    expect(round.steps.length).toBeGreaterThanOrEqual(4);
    expect(answerChainCalc(round, round.answer)).toEqual({ correct: true });
    expect(answerChainCalc(round, round.answer - 1)).toEqual({ correct: false });
  });

  it("creates 4x4 sudoku rounds with valid givens and solution", () => {
    const round = createMiniSudokuRound({ difficulty: 2, seed: 9 });
    expect(round.size).toBe(4);
    expect(round.givens.some((value) => value === 0)).toBe(true);
    expect(answerMiniSudoku(round, round.solution)).toEqual({ correct: true });
    const wrong = [...round.solution];
    wrong[0] = wrong[0] === 1 ? 2 : 1;
    expect(answerMiniSudoku(round, wrong)).toEqual({ correct: false });
  });
});
