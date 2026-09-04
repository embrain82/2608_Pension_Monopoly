import { balanceConfig, marketShocks, products } from '../data/content';
import { formatRateDelta } from '../engine/market-engine';
import type { BoardTile, MarketStep } from '../types';
import { renderMarketAlert, signedPercent } from './market-view';

const DIAL_SWEEP_DEG = 120;

export function dialAngle(ratePct: number, minPct: number, maxPct: number): number {
  if (maxPct <= minPct) return 0;
  const ratio = Math.min(1, Math.max(0, (ratePct - minPct) / (maxPct - minPct)));
  return Math.round((ratio * 2 - 1) * DIAL_SWEEP_DEG * 100) / 100;
}

function arrowMagnitude(value: number): number {
  return Math.min(1, Math.abs(value) / 0.1);
}

export function renderNewsFlash(step: MarketStep, prev: MarketStep, tile: BoardTile): string {
  const market = balanceConfig.market;
  const shock = step.shockId ? marketShocks.find((item) => item.id === step.shockId) : undefined;
  const classes = ['news-flash', step.shock ? 'shock' : '', shock?.positive ? 'positive' : ''].filter(Boolean).join(' ');
  const from = dialAngle(prev.turn === 0 ? market.rateStartPct : prev.ratePct, market.rateMinPct, market.rateMaxPct);
  const to = dialAngle(step.ratePct, market.rateMinPct, market.rateMaxPct);
  const arrows = products.map((product, index) => {
    const value = step.returns[product.id];
    const direction = value > 0.0005 ? 'up' : value < -0.0005 ? 'down' : 'flat';
    return `<li class="news-arrow ${direction}" style="--i:${index};--mag:${arrowMagnitude(value).toFixed(2)}"><span>${product.shortName}</span><i aria-hidden="true"></i><b>${signedPercent(value)}</b></li>`;
  }).join('');
  return `<div class="${classes}">
    <div class="news-tape"><span class="news-badge">${step.shock ? '속보 · 충격' : '속보'}</span><span>TURN ${String(step.turn).padStart(2, '0')}</span><span class="news-phase">${step.phase}</span></div>
    <h2 class="news-headline">${step.headline}</h2>
    <div class="news-dial" style="--from:${from}deg;--to:${to}deg" role="img" aria-label="교육용 가상 금리 ${step.ratePct.toFixed(2)}%, 변화 ${formatRateDelta(step.rateDeltaPct)}">
      <svg viewBox="0 0 200 120" aria-hidden="true">
        <path class="dial-track" d="M20 110 A80 80 0 0 1 180 110"></path>
        <g class="dial-needle"><line x1="100" y1="110" x2="100" y2="38"></line><circle cx="100" cy="110" r="6"></circle></g>
      </svg>
      <p><small>교육용 가상 금리</small><b>${step.ratePct.toFixed(2)}%</b><em>${formatRateDelta(step.rateDeltaPct)}</em></p>
    </div>
    <ul class="news-arrows">${arrows}</ul>
    <p class="news-reason">${step.reason}</p>
    ${renderMarketAlert(step)}
    <p class="news-arrival">도착 · ${String(tile.index + 1).padStart(2, '0')} ${tile.label}</p>
    <div class="button-stack compact">
      <button class="primary jumbo" data-action="dismiss-news">계속</button>
      <button class="text-button" data-action="open-tile">칸 설명 보기</button>
    </div>
  </div>`;
}
