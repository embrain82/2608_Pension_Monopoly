import { investorProfiles } from '../data/content';
import type { GameState, ProfileId } from '../types';

const PROFILE_IDS: ProfileId[] = ['stable', 'stableGrowth', 'balanced', 'growth', 'aggressive'];

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && PROFILE_IDS.includes(value as ProfileId);
}

export function profileFromScore(score: number): ProfileId {
  return investorProfiles.find((profile) => score >= profile.minScore && score <= profile.maxScore)?.id ?? 'balanced';
}

export function applyProfileToGame(game: GameState, profileId: ProfileId): GameState {
  if (game.profileId === profileId) return game;
  const unlocked = game.unlockedCards.includes('profile') ? game.unlockedCards : [...game.unlockedCards, 'profile'];
  return { ...game, profileId, unlockedCards: unlocked };
}
