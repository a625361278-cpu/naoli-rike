import type { TrainingId } from "../core/rules";

export type AssetKey = "hero" | "training-icon-sheet";

const assetUrls: Record<AssetKey, string> = {
  hero: "/concept/hero-brain-world.png",
  "training-icon-sheet": "/concept/training-icon-sheet.png",
};

export const trainingIconIndex: Record<TrainingId, number> = {
  "quick-math": 0,
  "color-conflict": 1,
  "instant-memory": 2,
  "flow-count": 3,
  "chain-calc": 4,
  "mini-sudoku": 5,
};

export function getAssetUrl(key: AssetKey): string {
  const url = assetUrls[key];
  if (!url) {
    throw new Error(`Unknown asset key: ${key}`);
  }
  return url;
}

