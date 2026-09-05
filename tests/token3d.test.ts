import { describe, expect, it } from 'vitest';
import { boardTiles } from '../src/data/content';
import { createGame, startTurn } from '../src/engine/game-engine';
import { renderBoardMarkup } from '../src/ui/board';
import { HOP_KEYFRAMES, HOP_SHADOW_KEYFRAMES, LAND_KEYFRAMES, LAND_MS, TOKEN_BASE, renderTokenLayer, tokenClasses, tokenPercent, tokenTranslate } from '../src/ui/token3d';

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
    const on = renderTokenLayer(state, { index: 5, characters: true, mood: 'calm' });
    expect(on).toContain('class="token-layer" aria-hidden="true"');
    expect(on).toContain('data-index="5"');
    expect(on).toContain('data-animal="여우"');
    expect(on).toContain('transform:translate(78.57%, 7.14%)');
    expect(on).toContain('<svg viewBox="0 0 100 100"');
    expect(on).not.toContain('plain');
    const off = renderTokenLayer(state, { index: 5, characters: false, mood: 'calm' });
    expect(off).toContain('token3d plain');
    expect(off).toContain('<b>나</b>');
    expect(off).not.toContain('<svg');
  });

  it('마크업은 정지 자세만 그리고(hop/land 클래스 없음), 애니메이션은 키프레임 상수가 맡는다', () => {
    expect(tokenClasses({ characters: true })).toBe('token3d');
    expect(tokenClasses({ characters: false })).toBe('token3d plain');
    const state = createGame('token3d-still');
    const markup = renderTokenLayer(state, { index: 2, characters: true, mood: 'happy' });
    expect(markup).not.toMatch(/\b(hop|land)\b/);
  });

  it('hop·그림자·착지 키프레임은 모두 기본 자세에서 출발해 기본 자세로 돌아온다', () => {
    for (const frames of [HOP_KEYFRAMES, LAND_KEYFRAMES]) {
      expect(frames[frames.length - 1].transform).toBe(TOKEN_BASE);
      expect(frames.length).toBeGreaterThanOrEqual(3);
      for (const f of frames) expect(f.transform?.startsWith(TOKEN_BASE)).toBe(true);
    }
    expect(HOP_KEYFRAMES[0].transform).toBe(TOKEN_BASE);
    expect(HOP_KEYFRAMES[1].transform).toContain('translateY(-');
    expect(LAND_KEYFRAMES[0].transform).toContain('scale(1.16, 0.82)');
    expect(HOP_SHADOW_KEYFRAMES[0].opacity).toBe(1);
    expect(HOP_SHADOW_KEYFRAMES[HOP_SHADOW_KEYFRAMES.length - 1].opacity).toBe(1);
    expect(HOP_SHADOW_KEYFRAMES[1].opacity).toBeLessThan(1);
    expect(LAND_MS).toBeGreaterThan(0);
    expect(LAND_MS).toBeLessThan(600);
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
