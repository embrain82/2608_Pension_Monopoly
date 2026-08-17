import type { TileBriefing } from '../types';

export function renderTileBriefing(briefing: TileBriefing, tileLabel: string, tileNumber: number): string {
  return `<p class="eyebrow">${String(tileNumber).padStart(2, '0')} · ${tileLabel}</p>
    <h2>${briefing.title}</h2>
    <p class="tile-briefing-body">${briefing.body}</p>
    <p class="hint">이 칸은 설명만 보여 줍니다. 운용은 시장을 본 뒤 한 번만 고르면 됩니다.</p>
    <button class="primary jumbo" data-action="dismiss-tile">확인</button>`;
}
