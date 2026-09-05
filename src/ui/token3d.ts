import type { GameState } from '../types';
import { AVATAR_ANIMALS, avatarBody, type Mood } from './avatars';
import { boardPosition, tokenTileIndex } from './board';

/** 보드 SVG viewBox 한 변. 칸 중심을 이 값으로 나눠 퍼센트 좌표를 만든다. */
export const BOARD_UNITS = 700;

export interface TokenView {
  index: number;
  hopping: boolean;
  landed: boolean;
  characters: boolean;
  mood: Mood;
}

/** 칸 중심의 보드 대비 퍼센트 좌표. 정사각형 `.board-stage` 위에서 SVG 좌표와 1:1로 맞는다. */
export function tokenPercent(index: number): { x: number; y: number } {
  const { x, y } = boardPosition(tokenTileIndex(index));
  return {
    x: Math.round(((x + 50) / BOARD_UNITS) * 10000) / 100,
    y: Math.round(((y + 50) / BOARD_UNITS) * 10000) / 100
  };
}

export function tokenTranslate(index: number): string {
  const { x, y } = tokenPercent(index);
  return `translate(${x}%, ${y}%)`;
}

export function tokenClasses(view: Pick<TokenView, 'hopping' | 'landed' | 'characters'>): string {
  return ['token3d', view.characters ? '' : 'plain', view.landed ? 'land' : view.hopping ? 'hop' : ''].filter(Boolean).join(' ');
}

/**
 * 2.5D 말(퍽) 오버레이. 위치 정보는 보드 SVG의 aria-label이 전달하므로 이 레이어는 aria-hidden.
 * 이동 애니메이션은 매 렌더 새 노드가 만들어져도 동작하도록 app.ts가 Web Animations API로 붙인다.
 */
export function renderTokenLayer(state: GameState, view: TokenView): string {
  const index = tokenTileIndex(view.index);
  const face = view.characters
    ? `<svg viewBox="0 0 100 100" aria-hidden="true">${avatarBody(state.profileId, view.mood)}</svg>`
    : '<b>나</b>';
  return `<div class="token-layer" aria-hidden="true">
      <div class="token-pos" data-index="${index}" data-animal="${view.characters ? AVATAR_ANIMALS[state.profileId] : ''}" style="transform:${tokenTranslate(index)}">
        <div class="${tokenClasses(view)}"><i class="token-shadow"></i><i class="token-rim"></i><div class="token-face">${face}</div></div>
      </div>
    </div>`;
}
