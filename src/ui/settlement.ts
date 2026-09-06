import { products } from '../data/content';
import type { TurnSummary } from '../types';
import { renderGhostSettleLine } from './ghost';
import { percent, signedPercent } from './market-view';
import { renderSpeech } from './speech';
import { renderTileEffects } from './tile-effects-view';

export interface SettlementOptions {
  characters: boolean;
  /** 설정 "그대로 둔 나" 비교. 끄면 고스트 줄을 숨긴다 */
  ghost?: boolean;
}

const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const signedWon = (value: number) => `${value > 0 ? '+' : ''}${formatWon(value)}`;
const RETURN_BAR_CAP = 0.15;

const tone = (delta: number) => (delta < 0 ? 'neg' : delta > 0 ? 'pos' : '');

/**
 * 막대 3개: 턴 시작 → 시장 반영 → 내 행동 후. 시장이 한 일과 내가 한 일을 금액으로 나눠 보인다.
 * 생활사건이 IRP를 건드렸으면(중도인출·매도 충당) 그 줄도 덧붙인다.
 */
function irpBars(summary: TurnSummary): string {
  const max = Math.max(summary.irpOpen, summary.irpAfterMarket, summary.irpAfter, 1);
  const width = (value: number) => ((value / max) * 100).toFixed(1);
  const total = summary.irpAfter - summary.irpOpen;
  const rate = summary.irpOpen > 0 ? total / summary.irpOpen : 0;
  const life = Math.abs(summary.lifeDelta) >= 1
    ? ` · <span class="life ${tone(summary.lifeDelta)}">생활사건 ${signedWon(summary.lifeDelta)}</span>`
    : '';
  return `<div class="settle-bars three">
      <strong>정산 요약</strong>
      <div class="settle-bar open"><span>턴 시작</span><i style="--w:${width(summary.irpOpen)}%"></i><b>${formatWon(summary.irpOpen)}</b></div>
      <div class="settle-bar market ${tone(summary.marketDelta)}"><span>시장 반영</span><i style="--w:${width(summary.irpAfterMarket)}%"></i><b>${formatWon(summary.irpAfterMarket)}</b></div>
      <div class="settle-bar after ${tone(total)}"><span>내 행동 후</span><i style="--w:${width(summary.irpAfter)}%"></i><b>${formatWon(summary.irpAfter)}</b></div>
      <p class="settle-delta ${tone(total)}">${signedWon(total)} <small>(${signedPercent(rate)})</small></p>
      <p class="settle-split"><span class="market ${tone(summary.marketDelta)}">시장 ${signedWon(summary.marketDelta)}</span> · <span class="action ${tone(summary.actionDelta)}">내 행동 ${signedWon(summary.actionDelta)}</span>${life}</p>
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

function actionBlock(summary: TurnSummary): string {
  const lines = summary.actionLines.length > 1
    ? `<ol class="settle-actions">${summary.actionLines.map((line) => `<li>${line}</li>`).join('')}</ol>`
    : `<p>${summary.actionLine}</p>`;
  const moves = summary.productDeltas.length
    ? `<ul class="settle-moves">${summary.productDeltas.map((item) => `<li>${item.name} <strong class="${item.delta < 0 ? 'neg' : ''}">${signedWon(item.delta)}</strong></li>`).join('')}</ul>`
    : '<p>보유 구성은 크게 변하지 않았습니다.</p>';
  return `<div class="preview-box settle-mine"><strong>내가 한 일${summary.actionLines.length > 1 ? ` · 행동 ${summary.actionLines.length}회` : ''}</strong>${lines}
      <p>위험비중 ${percent(summary.riskBefore)} → ${percent(summary.riskAfter)}</p>
      ${moves}
    </div>`;
}

export function renderSettlementModal(summary: TurnSummary, options: SettlementOptions = { characters: true }): string {
  const shock = summary.shock ? '<span class="settle-shock">충격</span>' : '';
  const alert = summary.alert
    ? `<div class="preview-box settle-alert level-${summary.alert.level}"><strong>다음 턴 신호</strong><p>${summary.alert.text}</p></div>`
    : '';
  const ghost = options.ghost === false ? '' : renderGhostSettleLine(summary);
  return `<p class="eyebrow">${summary.turn}턴 정산${shock}</p>
    <h2>무엇이 바뀌었나요?</h2>
    <p class="settle-headline">${summary.marketHeadline}</p>
    ${irpBars(summary)}
    ${ghost}
    <div class="settle-reaction">${renderSpeech('coach', `<p>${summary.reaction}</p>`, { characters: options.characters, title: '한 줄 정리', tone: summary.shock ? 'shock' : 'default' })}</div>
    <div class="preview-box settle-market"><strong>시장이 한 일 · 상품별 이번 턴</strong><p class="settle-note">턴 시작에 이미 보유분에 반영된 수익률입니다.</p>${returnBars(summary)}</div>
    ${actionBlock(summary)}
    ${renderTileEffects(summary.tileEffects, { heading: '칸 효과' })}
    ${alert}
    ${renderSpeech('coach', `<ul class="settle-hints">${summary.nextHints.map((hint) => `<li>${hint}</li>`).join('')}</ul>`, { characters: options.characters, title: '다음 판단' })}
    <button class="primary jumbo" data-action="dismiss-settle">다음 턴 준비</button>`;
}
