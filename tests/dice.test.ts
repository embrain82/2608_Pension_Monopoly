import { describe, expect, it } from 'vitest';
import { createGame, performAction, startTurn } from '../src/engine/game-engine';
import {
  DICE_LAND_HOLD_MS,
  DICE_ROLL_DURATION_MS,
  canRevealNextTurn,
  diceFaceForTurn,
  diceFaceParticle,
  diceLandTransform,
  isCompletedTurn,
  isRevealedTurn,
  isUpcomingSpoiler,
  renderDiceMarkup,
  shouldSkipDiceAnimation
} from '../src/ui/dice';

describe('주사위 연출', () => {
  it('1부터 6까지 서로 다른 착지 회전을 갖는다', () => {
    const transforms = [1, 2, 3, 4, 5, 6].map((face) => diceLandTransform(face));
    expect(new Set(transforms).size).toBe(6);
    expect(diceLandTransform(1)).toContain('rotate');
  });

  it('동작 줄이기면 주사위 연출을 생략한다', () => {
    expect(shouldSkipDiceAnimation(true)).toBe(true);
    expect(shouldSkipDiceAnimation(false)).toBe(false);
    expect(shouldSkipDiceAnimation(false, true)).toBe(true);
    expect(DICE_ROLL_DURATION_MS).toBeGreaterThan(800);
    expect(DICE_LAND_HOLD_MS).toBeGreaterThan(200);
  });

  it('새 판과 행동 직후에는 다음 상황을 바로 열지 않고 주사위를 기다린다', () => {
    const created = createGame('dice-wait');
    expect(canRevealNextTurn(created)).toBe(true);
    expect(created.turn).toBe(0);

    let state = startTurn(created).state;
    expect(state.turn).toBe(1);
    expect(canRevealNextTurn(state)).toBe(false);
    if (!state.currentEventId) {
      state = performAction(state, { kind: 'hold' }).state;
      expect(state.status).toBe('playing');
      expect(canRevealNextTurn(state)).toBe(true);
    }
  });

  it('굴리는 중 마크업은 착지 회전과 여섯 면을 포함한다', () => {
    const markup = renderDiceMarkup(4, true);
    expect(markup).toContain('dice-overlay');
    expect(markup).toContain('dice rolling');
    expect(markup).toContain('--land:');
    expect(markup).toContain(diceLandTransform(4));
    expect(markup).toContain(`--dice-ms:${DICE_ROLL_DURATION_MS}ms`);
    for (const face of [1, 2, 3, 4, 5, 6]) {
      expect(markup).toContain(`dice-face n${face}`);
    }
  });

  it('주사위 눈은 시드와 대기 턴만으로 정하고 엔진 rng를 쓰지 않는다', () => {
    const game = createGame('dice-rng');
    const rng = game.rngState;
    const first = diceFaceForTurn(game.seed, game.turn);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(6);
    expect(diceFaceForTurn(game.seed, game.turn)).toBe(first);
    expect(game.rngState).toBe(rng);
    const faces = Array.from({ length: 12 }, (_, turn) => diceFaceForTurn(game.seed, turn));
    expect(faces.every((face) => face >= 1 && face <= 6)).toBe(true);
    expect(new Set(faces).size).toBeGreaterThan(1);
  });

  it('조사는 1·3·6에 이, 나머지에 가를 쓴다', () => {
    expect(diceFaceParticle(1)).toBe('이');
    expect(diceFaceParticle(3)).toBe('이');
    expect(diceFaceParticle(6)).toBe('이');
    expect(diceFaceParticle(2)).toBe('가');
    expect(diceFaceParticle(5)).toBe('가');
  });

  it('대기 중에는 아직 공개되지 않은 턴 브리핑을 스포일러로 본다', () => {
    expect(isUpcomingSpoiler(1, 0)).toBe(true);
    expect(isRevealedTurn(1, 0, true)).toBe(false);
    expect(isCompletedTurn(1, 0, true)).toBe(false);

    expect(isRevealedTurn(1, 1, false)).toBe(true);
    expect(isUpcomingSpoiler(2, 1)).toBe(true);

    expect(isRevealedTurn(1, 1, true)).toBe(false);
    expect(isCompletedTurn(1, 1, true)).toBe(true);
    expect(isUpcomingSpoiler(1, 1)).toBe(false);
    expect(isUpcomingSpoiler(2, 1)).toBe(true);
  });
});
