import type { SaveData } from '../types';

export const STORAGE_KEY = 'pension-road-save-v1';

export const defaultSave: SaveData = {
  version: 1,
  settings: { reducedMotion: false, sound: false },
  unlockedCards: [],
  bestScore: 0,
  lastSeed: ''
};

function validSave(value: unknown): value is SaveData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SaveData>;
  return data.version === 1 &&
    typeof data.bestScore === 'number' && Number.isFinite(data.bestScore) &&
    typeof data.lastSeed === 'string' &&
    Array.isArray(data.unlockedCards) && data.unlockedCards.every((item) => typeof item === 'string') &&
    Boolean(data.settings) && typeof data.settings?.reducedMotion === 'boolean' && typeof data.settings?.sound === 'boolean';
}

export function loadSave(storage: Pick<Storage, 'getItem'> = localStorage): SaveData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultSave);
    const parsed: unknown = JSON.parse(raw);
    return validSave(parsed) ? parsed : structuredClone(defaultSave);
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
