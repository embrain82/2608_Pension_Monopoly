import { describe, expect, it } from 'vitest';
import { boardTiles } from '../src/data/content';
import { createGame, startTurn } from '../src/engine/game-engine';
import { renderBoardMarkup } from '../src/ui/board';
import { renderTokenLayer, tokenClasses, tokenPercent, tokenTranslate } from '../src/ui/token3d';

describe('2.5D 말 오버레이', () => {
  it('24칸 모두 칸 중심 퍼센트가 0~100 안이고 네 모서리가 맞는다', () => {
    for (const tile of boardTiles) {
      const { x, y } = tokenPercent(tile.index);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(100);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(100);
    }
    expect(tokenPercent(0)).toEqual({ x: 7.14, y: 7.14 });
    expect(tokenPercent(6)).toEqual({ x: 92.86, y: 7.14 });
    expect(tokenPercent(12)).toEqual({ x: 92.86, y: 92.86 });
    expect(tokenPercent(18)).toEqual({ x: 7.14, y: 92.86 });
    expect(tokenPercent(24)).toEqual(tokenPercent(0));
    expect(tokenTranslate(3)).toBe('translate(50%, 7.14%)');
  });

  it('마크업은 aria-hidden이고 캐릭터 켬이면 아바타, 끔이면 「나」 퍽이다', () => {
    const state = createGame('token3d');
    const on = renderTokenLayer(state, { index: 5, hopping: false, landed: false, characters: true, mood: 'calm' });
    expect(on).toContain('class="token-layer" aria-hidden="true"');
    expect(on).toContain('data-index="5"');
    expect(on).toContain('data-animal="여우"');
    expect(on).toContain('transform:translate(78.57%, 7.14%)');
    expect(on).toContain('<svg viewBox="0 0 100 100"');
    expect(on).not.toContain('plain');
    const off = renderTokenLayer(state, { index: 5, hopping: false, landed: false, characters: false, mood: 'calm' });
    expect(off).toContain('token3d plain');
    expect(off).toContain('<b>나</b>');
    expect(off).not.toContain('<svg');
  });

  it('이동 중은 hop, 도착 렌더는 land 클래스만 붙는다', () => {
    expect(tokenClasses({ hopping: true, landed: false, characters: true })).toBe('token3d hop');
    expect(tokenClasses({ hopping: true, landed: true, characters: true })).toBe('token3d land');
    expect(tokenClasses({ hopping: false, landed: false, characters: false })).toBe('token3d plain');
  });

  it('오버레이를 쓰면 SVG에는 말을 그리지 않되 위치 aria-label은 남는다', () => {
    const started = startTurn(createGame('token3d-svg'), 4).state;
    const markup = renderBoardMarkup(started, false, { characters: true, tokenInSvg: false, landed: true });
    expect(markup).not.toContain('player-avatar');
    expect(markup).not.toContain('player-mark');
    expect(markup).toContain(`현재 말은 ${started.position + 1}번 칸`);
    expect(markup).toContain('tile-fx');
    const legacy = renderBoardMarkup(started, false, { characters: true });
    expect(legacy).toContain('player-avatar');
  });
});
