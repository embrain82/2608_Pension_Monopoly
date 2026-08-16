import { hashSeed, rollDie } from '../engine/random-engine';
import type { GameState } from '../types';

export const DICE_ROLL_DURATION_MS = 1300;
export const DICE_LAND_HOLD_MS = 350;

const FACE_TRANSFORMS: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(0deg) rotateY(180deg)'
};

export function diceLandTransform(face: number): string {
  const pose = FACE_TRANSFORMS[face] ?? FACE_TRANSFORMS[1];
  return `rotateX(720deg) rotateY(360deg) ${pose}`;
}

export function shouldSkipDiceAnimation(reducedMotion: boolean, prefersReducedMotion = false): boolean {
  return reducedMotion || prefersReducedMotion;
}

export function canRevealNextTurn(state: GameState): boolean {
  return state.status === 'playing' && !state.awaitingAction && !state.currentEventId;
}

export function diceFaceForTurn(seed: string, turn: number): number {
  return rollDie(hashSeed(`${seed}:dice:${turn}`)).value;
}

export function diceFaceParticle(face: number): '이' | '가' {
  return face === 1 || face === 3 || face === 6 ? '이' : '가';
}

export function isUpcomingSpoiler(stepTurn: number, currentTurn: number): boolean {
  return stepTurn > currentTurn;
}

export function isRevealedTurn(stepTurn: number, currentTurn: number, waiting: boolean): boolean {
  return !waiting && stepTurn === currentTurn;
}

export function isCompletedTurn(stepTurn: number, currentTurn: number, waiting: boolean): boolean {
  if (stepTurn < currentTurn) return true;
  return waiting && currentTurn > 0 && stepTurn === currentTurn;
}

const PIP_MAP: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
};

function facePips(face: number): string {
  const active = new Set(PIP_MAP[face] ?? []);
  return Array.from({ length: 9 }, (_, index) => `<i class="pip${active.has(index + 1) ? ' on' : ''}"></i>`).join('');
}

export function renderDiceMarkup(face: number, rolling: boolean): string {
  const faces = [1, 2, 3, 4, 5, 6].map((value) => `<div class="dice-face n${value}">${facePips(value)}</div>`).join('');
  const particle = diceFaceParticle(face);
  return `<div class="dice-overlay" role="status" aria-live="assertive" aria-label="${rolling ? '주사위를 굴리는 중입니다' : `${face}${particle} 나왔습니다`}">
    <div class="dice-scene">
      <div class="dice ${rolling ? 'rolling' : 'landed'}" style="--land:${diceLandTransform(face)};--dice-ms:${DICE_ROLL_DURATION_MS}ms">${faces}</div>
    </div>
    <p>${rolling ? '주사위를 굴리는 중' : `${face} · 이번 턴 시장을 확인하세요`}</p>
  </div>`;
}
