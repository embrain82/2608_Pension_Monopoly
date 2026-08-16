import type { SaveData } from '../types';

export const STORAGE_KEY = 'pension-road-save-v1';

export const defaultSave: SaveData = {
  version: 2,
  settings: { reducedMotion: false, sound: false },
  unlockedCards: [],
  bestScore: 0,
  lastSeed: '',
  disclaimerAccepted: false,
  bestReturnRate: 0,
  bestGoalRate: 0,
  playCount: 0
};

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function migrateSave(value: unknown): SaveData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as {
    version?: number;
    settings?: SaveData['settings'];
    unlockedCards?: unknown;
    bestScore?: unknown;
    lastSeed?: unknown;
    disclaimerAccepted?: unknown;
    bestReturnRate?: unknown;
    bestGoalRate?: unknown;
    playCount?: unknown;
  };
  if (!finiteNumber(data.bestScore) || typeof data.lastSeed !== 'string') return null;
  if (!Array.isArray(data.unlockedCards) || !data.unlockedCards.every((item) => typeof item === 'string')) return null;
  if (!data.settings || typeof data.settings.reducedMotion !== 'boolean' || typeof data.settings.sound !== 'boolean') return null;
  if (data.version !== 1 && data.version !== 2) return null;
  return {
    version: 2,
    settings: data.settings,
    unlockedCards: data.unlockedCards,
    bestScore: data.bestScore,
    lastSeed: data.lastSeed,
    disclaimerAccepted: Boolean(data.disclaimerAccepted),
    bestReturnRate: finiteNumber(data.bestReturnRate) ? data.bestReturnRate : 0,
    bestGoalRate: finiteNumber(data.bestGoalRate) ? data.bestGoalRate : 0,
    playCount: finiteNumber(data.playCount) ? data.playCount : 0
  };
}

export function loadSave(storage: Pick<Storage, 'getItem'> = localStorage): SaveData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultSave);
    const parsed: unknown = JSON.parse(raw);
    return migrateSave(parsed) ?? structuredClone(defaultSave);
  } catch {
    return structuredClone(defaultSave);
  }
}

export function saveData(data: SaveData, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 저장 공간 차단은 게임 진행을 막지 않습니다.
  }
}
