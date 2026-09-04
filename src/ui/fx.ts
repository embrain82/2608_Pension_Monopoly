export type NumberKind = 'won' | 'shortWon' | 'percent' | 'signedPercent';

export const NUMBER_TWEEN_MS = 600;

export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

export function interpolate(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function formatByKind(kind: NumberKind, value: number): string {
  switch (kind) {
    case 'won': return `${Math.round(value).toLocaleString('ko-KR')}원`;
    case 'shortWon': return value >= 100_000_000
      ? `${(value / 100_000_000).toFixed(2)}억원`
      : `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
    case 'percent': return `${Math.round(value * 100)}%`;
    case 'signedPercent': return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
  }
}

/** 끝 값을 먼저 그려 두고, 시작 값이 있으면 렌더 뒤 트윈이 이어받는다. */
export function animatedNumber(kind: NumberKind, from: number | null, to: number, className = ''): string {
  const fromAttr = from === null || Math.abs(from - to) < 1e-9 ? '' : ` data-from="${from}"`;
  const cls = className ? ` class="${className}"` : '';
  return `<span${cls} data-anim="${kind}"${fromAttr} data-to="${to}">${formatByKind(kind, to)}</span>`;
}

