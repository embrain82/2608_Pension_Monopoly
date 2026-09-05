import { products } from '../data/content';
import type { TurnSummary } from '../types';
import { percent, signedPercent } from './market-view';
import { renderSpeech } from './speech';

export interface SettlementOptions {
  characters: boolean;
}

const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const signedWon = (value: number) => `${value > 0 ? '+' : ''}${formatWon(value)}`;
const RETURN_BAR_CAP = 0.15;

function irpBars(summary: TurnSummary): string {
  const max = Math.max(summary.irpBefore, summary.irpAfter, 1);
  const delta = summary.irpAfter - summary.irpBefore;
  const rate = summary.irpBefore > 0 ? delta / summary.irpBefore : 0;
  const tone = delta < 0 ? 'neg' : delta > 0 ? 'pos' : '';
  return `<div class="settle-bars">
      <strong>정산 요약</strong>
      <div class="settle-bar"><span>정산 전</span><i style="--w:${((summary.irpBefore / max) * 100).toFixed(1)}%"></i><b>${formatWon(summary.irpBefore)}</b></div>
      <div class="settle-bar after ${tone}"><span>정산 후</span><i style="--w:${((summary.irpAfter / max) * 100).toFixed(1)}%"></i><b>${formatWon(summary.irpAfter)}</b></div>
      <p class="settle-delta ${tone}">${signedWon(delta)} <small>(${signedPercent(rate)})</small></p>
    </div>`;
}

function returnBars(summary: TurnSummary): string {
  const rows = products.map((product, index) => {
    const value = summary.productReturns[product.id] ?? 0;
    const width = (Math.min(Math.abs(value), RETURN_BAR_CAP) / RETURN_BAR_CAP) * 50;
    const side = value < 0 ? 'down' : value > 0 ? 'up' : 'flat';
    const held = (summary.holdingShares[product.id] ?? 0) > 0;
    const classes = ['settle-return', side, held ? 'held' : '', summary.biggestMover === product.id ? 'mover' : ''].filter(Boolean).join(' ');
    return `<li class="${classes}" style="--i:${index}"><span>${product.shortName}</span><div class="track"><i style="--w:${width.toFixed(1)}%"></i></div><b>${signedPercent(value)}</b><small>${held ? percent(summary.holdingShares[product.id]) : '—'}</small></li>`;
  }).join('');
  return `<ul class="settle-returns">${rows}</ul>`;
}

export function renderSettlementModal(summary: TurnSummary, options: SettlementOptions = { characters: true }): string {
  const moves = summary.productDeltas.length
    ? `<ul class="settle-moves">${summary.productDeltas.map((item) => `<li>${item.name} <strong class="${item.delta < 0 ? 'neg' : ''}">${signedWon(item.delta)}</strong></li>`).join('')}</ul>`
    : '<p>보유 구성은 크게 변하지 않았습니다.</p>';
  const shock = summary.shock ? '<span class="settle-shock">충격</span>' : '';
  const alert = summary.alert
    ? `<div class="preview-box settle-alert level-${summary.alert.level}"><strong>다음 턴 신호</strong><p>${summary.alert.text}</p></div>`
    : '';
  return `<p class="eyebrow">${summary.turn}턴 정산${shock}</p>
    <h2>무엇이 바뀌었나요?</h2>
    <p class="settle-headline">${summary.marketHeadline}</p>
    ${irpBars(summary)}
    <div class="settle-reaction">${renderSpeech('coach', `<p>${summary.reaction}</p>`, { characters: options.characters, title: '한 줄 정리', tone: summary.shock ? 'shock' : 'default' })}</div>
    <div class="preview-box"><strong>상품별 이번 턴</strong>${returnBars(summary)}</div>
    <div class="preview-box"><strong>내가 한 일</strong><p>${summary.actionLine}</p>
      <p>위험비중 ${percent(summary.riskBefore)} → ${percent(summary.riskAfter)}</p>
      ${moves}
    </div>
    ${alert}
    ${renderSpeech('coach', `<ul class="settle-hints">${summary.nextHints.map((hint) => `<li>${hint}</li>`).join('')}</ul>`, { characters: options.characters, title: '다음 판단' })}
    <button class="primary jumbo" data-action="dismiss-settle">다음 턴 준비</button>`;
}
