import { describe, expect, it } from 'vitest';
import { boardTiles } from '../src/data/content';
import { createGame, startTurn } from '../src/engine/game-engine';
import { boardPosition, renderBoardMarkup, tokenTileIndex } from '../src/ui/board';

describe('24칸 보드', () => {
  it('24칸이 사각형 루프의 서로 다른 좌표에 놓인다', () => {
    const spots = Array.from({ length: 24 }, (_, index) => boardPosition(index));
    expect(new Set(spots.map((spot) => `${spot.x},${spot.y}`)).size).toBe(24);
    expect(boardPosition(0)).toEqual({ x: 0, y: 0 });
    expect(boardPosition(6)).toEqual({ x: 600, y: 0 });
    expect(boardPosition(12)).toEqual({ x: 600, y: 600 });
    expect(boardPosition(18)).toEqual({ x: 0, y: 600 });
  });

  it('말은 출발 칸에서 시작해 턴이 열리면 보드 칸으로 이동한다', () => {
    expect(tokenTileIndex(0)).toBe(0);
    expect(tokenTileIndex(1)).toBe(1);
    expect(tokenTileIndex(12)).toBe(12);
    const created = createGame('board-token');
    expect(tokenTileIndex(created.position)).toBe(0);
    const started = startTurn(created).state;
    expect(tokenTileIndex(started.position)).toBe(started.turn);
  });

  it('보드 마크업은 24칸과 말 위치를 포함한다', () => {
    const started = startTurn(createGame('board-markup')).state;
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
    expect(markup).not.toContain(created.lastMarket.signal);
  });
});
