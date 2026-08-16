import { describe, expect, it } from 'vitest';
import { createGame, performAction, startTurn } from '../src/engine/game-engine';
import { DICE_ROLL_DURATION_MS, canRevealNextTurn, diceLandTransform, renderDiceMarkup, shouldSkipDiceAnimation } from '../src/ui/dice';

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
  });

  it('새 판과 행동 직후에는 다음 상황을 바로 열지 않고 주사위를 기다린다', () => {
    const created = createGame('dice-wait');
    expect(canRevealNextTurn(created)).toBe(true);
    expect(created.turn).toBe(0);

    let state = startTurn(created).state;
    if (state.currentEventId) {
      expect(canRevealNextTurn(state)).toBe(false);
    } else {
      expect(canRevealNextTurn(state)).toBe(false);
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
});
