import type { TileBriefing } from '../types';

export const BRIEFING_LEAD_MAX = 80;

/** 본문의 첫 문장(들)만 80자 안에서 잘라 앞세운다. 나머지는 접힌 상태로 둔다. */
export function briefingLead(body: string): { lead: string; rest: string } {
  const sentences = body.match(/[^.!?。]+[.!?。]?\s*/g)?.map((item) => item.trim()).filter(Boolean) ?? [body];
  let lead = '';
  let index = 0;
  while (index < sentences.length) {
    const candidate = lead ? `${lead} ${sentences[index]}` : sentences[index];
    if (lead && candidate.length > BRIEFING_LEAD_MAX) break;
    lead = candidate;
    index += 1;
  }
  return { lead, rest: sentences.slice(index).join(' ') };
}

export function renderTileBriefing(briefing: TileBriefing, tileLabel: string, tileNumber: number): string {
  const { lead, rest } = briefingLead(briefing.body);
  const more = rest
    ? `<details class="tile-briefing-more"><summary>자세히</summary><p>${rest}</p></details>`
    : '';
  return `<p class="eyebrow">${String(tileNumber).padStart(2, '0')} · ${tileLabel}</p>
    <h2>${briefing.title}</h2>
    <p class="tile-briefing-body">${lead}</p>
    ${more}
    <p class="hint">이 칸은 설명만 보여 줍니다. 운용은 시장을 본 뒤 한 번만 고르면 됩니다.</p>
    <button class="primary jumbo" data-action="dismiss-tile">확인</button>`;
}
