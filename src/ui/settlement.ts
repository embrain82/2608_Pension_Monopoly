import type { TurnSummary } from '../types';
import { percent } from './market-view';

const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const signedWon = (value: number) => `${value > 0 ? '+' : ''}${formatWon(value)}`;

export function renderSettlementModal(summary: TurnSummary): string {
  const moves = summary.productDeltas.length
    ? `<ul class="settle-moves">${summary.productDeltas.map((item) => `<li>${item.name} <strong class="${item.delta < 0 ? 'neg' : ''}">${signedWon(item.delta)}</strong></li>`).join('')}</ul>`
    : '<p>보유 구성은 크게 변하지 않았습니다.</p>';
  const shock = summary.shock ? '<span class="settle-shock">충격</span>' : '';
  const alert = summary.alert
    ? `<div class="preview-box settle-alert level-${summary.alert.level}"><strong>다음 턴 신호</strong><p>${summary.alert.text}</p></div>`
    : '';
  return `<p class="eyebrow">${summary.turn}턴 정산${shock}</p>
    <h2>무엇이 바뀌었나요?</h2>
    <div class="preview-box"><strong>내가 한 일</strong><p>${summary.actionLine}</p></div>
    <div class="preview-box"><strong>정산 요약</strong>
      <p>${summary.marketHeadline}</p>
      <p>IRP ${formatWon(summary.irpBefore)} → ${formatWon(summary.irpAfter)}</p>
      <p>위험비중 ${percent(summary.riskBefore)} → ${percent(summary.riskAfter)}</p>
      ${moves}
    </div>
    ${alert}
    <div class="preview-box"><strong>다음 판단</strong><ul class="settle-hints">${summary.nextHints.map((hint) => `<li>${hint}</li>`).join('')}</ul></div>
    <button class="primary jumbo" data-action="dismiss-settle">다음 턴 준비</button>`;
}
