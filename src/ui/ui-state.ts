import { clampGoalMonthly } from '../engine/goal';
import { isProfileId } from '../engine/profile-engine';
import { isDefaultOptionId } from '../engine/default-option';
import type { SaveData } from '../types';

export const STORAGE_KEY = 'pension-road-save-v1';

export const defaultSave: SaveData = {
  version: 5,
  settings: { reducedMotion: false, sound: false, characters: true, ghost: true },
  defaultOption: null,
  unlockedCards: [],
  bestScore: 0,
  lastSeed: '',
  disclaimerAccepted: false,
  bestReturnRate: 0,
  bestGoalRate: 0,
  playCount: 0,
  howtoSeen: false,
  profileId: 'balanced',
  goalMonthly: 500_000
};

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function migrateSave(value: unknown): SaveData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as {
    version?: number;
    settings?: { reducedMotion?: unknown; sound?: unknown; characters?: unknown; ghost?: unknown };
    unlockedCards?: unknown;
    bestScore?: unknown;
    lastSeed?: unknown;
    disclaimerAccepted?: unknown;
    bestReturnRate?: unknown;
    bestGoalRate?: unknown;
    playCount?: unknown;
    howtoSeen?: unknown;
    profileId?: unknown;
    goalMonthly?: unknown;
    defaultOption?: unknown;
  };
  if (!finiteNumber(data.bestScore) || typeof data.lastSeed !== 'string') return null;
  if (!Array.isArray(data.unlockedCards) || !data.unlockedCards.every((item) => typeof item === 'string')) return null;
  if (!data.settings || typeof data.settings.reducedMotion !== 'boolean' || typeof data.settings.sound !== 'boolean') return null;
  if (![1, 2, 3, 4, 5].includes(data.version ?? 0)) return null;
  return {
    version: 5,
    settings: {
      reducedMotion: data.settings.reducedMotion,
      sound: data.settings.sound,
      // v1·v2 저장에는 없던 값. 캐릭터는 기본 켬.
      characters: typeof data.settings.characters === 'boolean' ? data.settings.characters : true,
      // v1~v3 저장에는 없던 값. 고스트("그대로 둔 나")는 기본 켬.
      ghost: typeof data.settings.ghost === 'boolean' ? data.settings.ghost : true
    },
    unlockedCards: data.unlockedCards,
    bestScore: data.bestScore,
    lastSeed: data.lastSeed,
    disclaimerAccepted: Boolean(data.disclaimerAccepted),
    bestReturnRate: finiteNumber(data.bestReturnRate) ? data.bestReturnRate : 0,
    bestGoalRate: finiteNumber(data.bestGoalRate) ? data.bestGoalRate : 0,
    playCount: finiteNumber(data.playCount) ? data.playCount : 0,
    howtoSeen: data.howtoSeen === true,
    profileId: isProfileId(data.profileId) ? data.profileId : 'balanced',
    goalMonthly: clampGoalMonthly(finiteNumber(data.goalMonthly) ? data.goalMonthly : 500_000),
    // v1~v4 저장에는 없던 값. null이면 다음 판 시작에 고른다.
    defaultOption: isDefaultOptionId(data.defaultOption) ? data.defaultOption : null
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
