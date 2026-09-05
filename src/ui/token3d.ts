import type { GameState } from '../types';
import { AVATAR_ANIMALS, avatarBody, type Mood } from './avatars';
import { boardPosition, tokenTileIndex } from './board';

/** 보드 SVG viewBox 한 변. 칸 중심을 이 값으로 나눠 퍼센트 좌표를 만든다. */
export const BOARD_UNITS = 700;

export interface TokenView {
  index: number;
  characters: boolean;
  mood: Mood;
}

/** 퍽의 기본 자세. 모든 키프레임은 여기서 출발해 여기로 돌아온다. */
export const TOKEN_BASE = 'translate(-50%, -64%)';
/** 마지막 칸 착지(찌그러짐) 길이. 마지막 hop이 끝난 뒤 이 시간만큼 지나서 속보 카드가 뜬다. */
export const LAND_MS = 320;

/** DOM `Keyframe`에 그대로 넘길 수 있는 형태. 순수 모듈이라 DOM 타입에는 의존하지 않는다. */
export interface TokenKeyframe {
  [property: string]: string | number | null | undefined;
  transform?: string;
  opacity?: number;
  offset?: number;
  easing?: string;
}

/**
 * 한 칸 hop. 몇 칸을 가든, 마지막 칸이든 같은 포물선을 쓴다(일관성).
 * 가로 이동은 `.token-pos`가, 포물선은 `.token3d`가, 그림자 축소는 `.token-shadow`가 각각 같은 길이로 맡는다.
 */
export const HOP_KEYFRAMES: TokenKeyframe[] = [
  { transform: TOKEN_BASE, easing: 'ease-out' },
  { transform: `${TOKEN_BASE} translateY(-58%) rotateX(-14deg) scale(1.06)`, offset: 0.5, easing: 'ease-in' },
  { transform: TOKEN_BASE }
];

export const HOP_SHADOW_KEYFRAMES: TokenKeyframe[] = [
  { transform: 'none', opacity: 1, easing: 'ease-out' },
  { transform: 'scale(.6)', opacity: 0.5, offset: 0.5, easing: 'ease-in' },
  { transform: 'none', opacity: 1 }
];

/** 마지막 칸 착지: 눌렸다가 복원. 마지막 hop이 끝난 다음에 이어서 재생한다. */
export const LAND_KEYFRAMES: TokenKeyframe[] = [
  { transform: `${TOKEN_BASE} scale(1.16, 0.82)`, easing: 'ease-out' },
  { transform: `${TOKEN_BASE} scale(0.95, 1.05)`, offset: 0.55, easing: 'ease-in-out' },
  { transform: TOKEN_BASE }
];

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

export function tokenClasses(view: Pick<TokenView, 'characters'>): string {
  return view.characters ? 'token3d' : 'token3d plain';
}

/**
 * 2.5D 말(퍽) 오버레이. 위치 정보는 보드 SVG의 aria-label이 전달하므로 이 레이어는 aria-hidden.
 * 이동·hop·착지 애니메이션은 매 렌더 새 노드가 만들어져도 동작하도록 app.ts의 animateToken이
 * 위 키프레임을 Web Animations API로 붙인다. 마크업 자체는 정지 자세만 그린다.
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
