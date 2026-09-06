import type { TileEffect, TileEffectKind } from '../types';

/** 칸 효과 종류별 글리프. 이모지 대신 어느 글꼴에서나 나오는 기호만 쓴다. */
export const TILE_EFFECT_GLYPHS: Record<TileEffectKind, string> = {
  'tax-refund': '₩',
  spotlight: '☆',
  'signal-preview': '◎',
  'extra-life': '♥',
  'double-action': '×2',
  'policy-brief': '§',
  'rebalance-bonus': '⇄',
  outlook: '▲',
  'profile-check': '◐',
  'diversify-check': '✦'
};

/** 속보 카드 스트립·정산 블록에서 강조할 효과. 환급은 실제로 돈이 들어왔을 때만. */
export function isHighlightedEffect(effect: TileEffect): boolean {
  if (effect.kind === 'tax-refund') return (effect.amount ?? 0) > 0;
  return effect.kind === 'extra-life' ? Boolean(effect.eventId) : effect.kind === 'double-action';
}

const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;

export function tileEffectItem(effect: TileEffect, index: number): string {
  const classes = ['tile-effect', `fx-${effect.kind}`, isHighlightedEffect(effect) ? 'hot' : ''].filter(Boolean).join(' ');
  const amount = effect.kind === 'tax-refund' && (effect.amount ?? 0) > 0
    ? `<b class="tile-effect-amount">+${formatWon(effect.amount!)}</b>`
    : '';
  return `<li class="${classes}" style="--i:${index}"><i aria-hidden="true">${TILE_EFFECT_GLYPHS[effect.kind]}</i><div><strong>${effect.title}</strong>${amount}<p>${effect.detail}</p></div></li>`;
}

/**
 * 도착·통과 칸 효과 목록. 최대 2개(연말정산 통과 + 도착 칸). 효과가 없으면 빈 문자열이라 호출 쪽에서
 * 조건 없이 끼워 넣을 수 있다.
 */
export function renderTileEffects(effects: TileEffect[], options: { heading?: string; compact?: boolean } = {}): string {
  if (!effects.length) return '';
  const heading = options.heading ? `<strong class="tile-effects-heading">${options.heading}</strong>` : '';
  const classes = ['tile-effects', options.compact ? 'compact' : ''].filter(Boolean).join(' ');
  return `<div class="${classes}">${heading}<ul>${effects.slice(0, 2).map(tileEffectItem).join('')}</ul></div>`;
}
