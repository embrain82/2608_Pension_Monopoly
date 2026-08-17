import type { GameState } from '../types';

export const DICE_ROLL_DURATION_MS = 1120;
export const DICE_LAND_HOLD_MS = 280;

const FACE_TRANSFORMS: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(0deg) rotateY(180deg)'
};

export function diceLandTransform(face: number, variant = 0): string {
  const pose = FACE_TRANSFORMS[face] ?? FACE_TRANSFORMS[1];
  const spin = variant === 0
    ? 'rotateX(360deg) rotateY(360deg)'
    : 'rotateX(-360deg) rotateY(360deg)';
  return `${spin} ${pose}`;
}

export function shouldSkipDiceAnimation(reducedMotion: boolean, prefersReducedMotion = false): boolean {
  return reducedMotion || prefersReducedMotion;
}

export function canRevealNextTurn(state: GameState): boolean {
  return state.status === 'playing' && !state.awaitingAction && !state.currentEventId;
}

export { dicePairForTurn } from '../engine/random-engine';

export function diceSteps(faces: [number, number]): number {
  return faces[0] + faces[1];
}

export function dicePairLabel(left: number, right: number): string {
  return `${left} · ${right}`;
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

function cubeMarkup(face: number, variant: 0 | 1, rolling: boolean): string {
  const faces = [1, 2, 3, 4, 5, 6].map((value) => `<div class="dice-face n${value}">${facePips(value)}</div>`).join('');
  const alt = variant === 1 ? ' alt' : '';
  return `<div class="dice-slot${alt}"><div class="dice ${rolling ? `rolling${alt}` : 'landed'}" style="--land:${diceLandTransform(face, variant)};--dice-ms:${DICE_ROLL_DURATION_MS}ms">${faces}</div></div>`;
}

export function renderDiceMarkup(faces: [number, number], rolling: boolean): string {
  const label = dicePairLabel(faces[0], faces[1]);
  return `<div class="dice-overlay" role="status" aria-live="assertive" aria-label="${rolling ? '주사위 두 개를 굴리는 중입니다' : `주사위 결과 ${label}`}">
    <div class="dice-scene" style="--dice-ms:${DICE_ROLL_DURATION_MS}ms">
      ${cubeMarkup(faces[0], 0, rolling)}
      ${cubeMarkup(faces[1], 1, rolling)}
    </div>
    <p>${rolling ? '주사위를 굴리는 중' : `${label} · 이번 턴 시장을 확인하세요`}</p>
  </div>`;
}
