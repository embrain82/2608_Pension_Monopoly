import { describe, expect, it } from 'vitest';
import { boardTiles } from '../src/data/content';
import { createGame, startTurn } from '../src/engine/game-engine';
import { dicePairForTurn, diceSteps } from '../src/ui/dice';
import { boardPosition, movePath, renderBoardMarkup, tokenTileIndex } from '../src/ui/board';

describe('24칸 보드', () => {
  it('24칸이 사각형 루프의 서로 다른 좌표에 놓인다', () => {
    const spots = Array.from({ length: 24 }, (_, index) => boardPosition(index));
    expect(new Set(spots.map((spot) => `${spot.x},${spot.y}`)).size).toBe(24);
    expect(boardPosition(0)).toEqual({ x: 0, y: 0 });
    expect(boardPosition(6)).toEqual({ x: 600, y: 0 });
    expect(boardPosition(12)).toEqual({ x: 600, y: 600 });
    expect(boardPosition(18)).toEqual({ x: 0, y: 600 });
  });

  it('말은 주사위 두 눈의 합만큼 이동하고 24칸에서 순환한다', () => {
    expect(tokenTileIndex(0)).toBe(0);
    expect(tokenTileIndex(24)).toBe(0);
    expect(tokenTileIndex(25)).toBe(1);
    const created = createGame('board-token');
    const faces = dicePairForTurn(created.seed, created.turn);
    const steps = diceSteps(faces);
    expect(steps).toBeGreaterThanOrEqual(2);
    expect(steps).toBeLessThanOrEqual(12);
    const started = startTurn(created, steps).state;
    expect(started.position).toBe(tokenTileIndex(steps));
    expect(started.turn).toBe(1);

    const wrapped = startTurn({ ...createGame('board-wrap'), position: 20 }, 8).state;
    expect(wrapped.position).toBe(4);

    const path = movePath(20, 8);
    expect(path).toEqual([21, 22, 23, 0, 1, 2, 3, 4]);
    expect(path).toHaveLength(8);
    expect(path.at(-1)).toBe(4);
  });

  it('보드 마크업은 24칸과 말 위치를 포함한다', () => {
    const started = startTurn(createGame('board-markup'), 4).state;
    const markup = renderBoardMarkup(started, false);
    expect(markup).toContain('class="board"');
    expect(markup.match(/class="tile /g)?.length).toBe(boardTiles.length);
    expect(markup).toContain('player-mark');
    expect(markup).toContain(started.phase);
  });

  it('주사위 대기 중에는 다음 시장 신호를 보드 중앙에 넣지 않는다', () => {
    const created = createGame('board-wait');
    const markup = renderBoardMarkup(created, true);
    expect(markup).toContain('주사위를 굴려');
    expect(markup).not.toContain(created.marketPath[0].signal);
  });
});
