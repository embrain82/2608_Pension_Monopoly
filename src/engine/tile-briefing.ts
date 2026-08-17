import { tileBriefings } from '../data/content';
import type { TileBriefing } from '../types';
import { hashSeed, nextRandom } from './random-engine';

export function pickTileBriefing(seed: string, turn: number, tileIndex: number): TileBriefing {
  const set = tileBriefings[tileIndex];
  if (!set) throw new Error(`알 수 없는 칸: ${tileIndex}`);
  const roll = nextRandom(hashSeed(`${seed}:tile-brief:${turn}:${tileIndex}`));
  return set.pool[Math.floor(roll.value * set.pool.length)];
}
