import { createEmptySave, type SaveData } from "../core/progress";
import { migrateSaveData } from "../core/save";

export const storageKey = "naoli-rike-save-v1";

export function loadSave(today: string): SaveData {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    const save = createEmptySave(today);
    saveState(save);
    return save;
  }
  const parsed = JSON.parse(raw) as unknown;
  const migrated = migrateSaveData(parsed);
  if (JSON.stringify(migrated) !== raw) {
    saveState(migrated);
  }
  return migrated;
}

export function saveState(save: SaveData): void {
  localStorage.setItem(storageKey, JSON.stringify(save));
}

export function clearSave(today: string): SaveData {
  localStorage.removeItem(storageKey);
  const save = createEmptySave(today);
  saveState(save);
  return save;
}

