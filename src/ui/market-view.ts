import { balanceConfig, products } from '../data/content';
import { formatRateDelta } from '../engine/market-engine';
import { portfolioValue } from '../engine/portfolio-engine';
import type { GameState, MarketStep } from '../types';
import { isCompletedTurn, isRevealedTurn, isUpcomingSpoiler } from './dice';

export function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function signedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

export function renderProductReturns(state: GameState): string {
  const total = portfolioValue(state);
  const rows = products.map((product) => {
    const amount = state.holdings.find((holding) => holding.productId === product.id)?.amount ?? 0;
    const ret = state.lastMarket.returns[product.id] ?? 0;
    return `<li class="${ret < 0 ? 'down' : ret > 0 ? 'up' : ''}"><span>${product.shortName}</span><b>${signedPercent(ret)}</b><small>${total ? percent(amount / total) : '0%'}</small></li>`;
  }).join('');
  return `<ul class="product-returns">${rows}</ul>`;
}

function deltaClass(value: number): string {
  return value > 1e-9 ? 'up' : value < -1e-9 ? 'down' : 'flat';
}

function marketBars(step: MarketStep, muted = false): string {
  if (muted) {
    return `<div class="market-bars muted"><span>금리 <i></i>—</span><span>물가 <i></i>—</span><span>주가 <i></i>—</span></div>`;
  }
  return `<div class="market-bars">
      <span>금리 <i style="--level:${step.rate}"></i><b>${step.ratePct.toFixed(2)}%</b><em class="${deltaClass(step.rateDeltaPct)}">${formatRateDelta(step.rateDeltaPct)}</em></span>
      <span>물가 <i style="--level:${step.inflation}"></i><b>${step.inflationPct.toFixed(1)}%</b></span>
      <span>주가 <i style="--level:${step.stocks}"></i><b>${step.stockIndex.toFixed(1)}</b><em class="${deltaClass(step.stockReturn)}">${signedPercent(step.stockReturn)}</em></span>
    </div>
    <p class="market-note">교육용 가상 금리 · 실제 금리 전망이 아닙니다</p>`;
}

export function renderMarketAlert(step: MarketStep): string {
  if (!step.alert) return '';
  return `<div class="market-alert level-${step.alert.level}" role="status"><strong>다음 턴 신호</strong><span>${step.alert.text}</span><small>${step.alert.hint}</small></div>`;
}

export function renderMarketCard(state: GameState, pending: boolean): string {
  if (pending && state.turn === 0) {
    return `<article class="market-card pending">
            <div class="card-label">TURN 01 · 시장 대기</div>
            <h2>주사위를 굴려 시장을 확인하세요</h2>
            <p class="signal">주사위 눈의 합만큼 말이 이동한 뒤 브리핑이 공개됩니다.</p>
            <p>시장 국면은 이번 판 시드마다 달라지고, 말은 나온 숫자만큼 보드를 돕니다.</p>
            ${marketBars(state.lastMarket, true)}
            ${renderProductReturns(state)}
          </article>`;
  }
  if (pending) {
    const nextTurn = Math.min(state.turn + 1, balanceConfig.maxTurns);
    return `<article class="market-card">
            <div class="card-label">TURN ${String(state.turn).padStart(2, '0')} · 정산 완료</div>
            <h2>${state.lastMarket.headline}</h2>
            <p class="signal">${state.lastMarket.signal}</p>
            <p>${state.lastMarket.reason}</p>
            <p>주사위를 굴려 다음 턴(${nextTurn}턴) 시장을 확인하세요. 시장 국면은 이번 판 시드마다 달라집니다.</p>
            ${renderMarketAlert(state.lastMarket)}
            ${marketBars(state.lastMarket)}
            ${renderProductReturns(state)}
          </article>`;
  }
  return `<article class="market-card${state.lastMarket.shock ? ' shock' : ''}">
            <div class="card-label">TURN ${String(state.turn).padStart(2, '0')} · 시장 브리핑${state.lastMarket.shock ? ' · 충격' : ''}</div>
            <h2>${state.lastMarket.headline}</h2>
            <p class="signal">${state.lastMarket.signal}</p>
            <p>${state.lastMarket.reason}</p>
            ${renderMarketAlert(state.lastMarket)}
            ${marketBars(state.lastMarket)}
            ${renderProductReturns(state)}
            <p class="market-note applied-note">이 수익률은 턴 시작에 이미 보유분에 반영됐습니다 · 지금 행동은 다음 턴에 걸립니다</p>
          </article>`;
}

export function renderSettingsEntry(profileName?: string): string {
  const label = profileName ? `${profileName} · 설정` : '성향 · 설정';
  return `<button class="settings-entry" data-action="open-settings" type="button">${label}</button>`;
}

export function renderTurnTrack(state: GameState, waiting: boolean): string {
  const lifeTurns = new Set(state.lifeEventSchedule.map((item) => item.turn));
  const alertedTurns = new Set(
    state.marketPath
      .filter((step) => step.alert && !isUpcomingSpoiler(step.turn, state.turn))
      .map((step) => step.turn + 1)
  );
  const cells = state.marketPath.map((step) => {
    const current = isRevealedTurn(step.turn, state.turn, waiting);
    const past = isCompletedTurn(step.turn, state.turn, waiting);
    const spoiler = isUpcomingSpoiler(step.turn, state.turn);
    const showShock = Boolean(step.shock) && !spoiler;
    const alerted = spoiler && alertedTurns.has(step.turn);
    const classes = [
      current ? 'current' : '',
      past ? 'past' : '',
      showShock ? 'shock' : '',
      !spoiler && lifeTurns.has(step.turn) ? 'life' : '',
      alerted ? 'alert' : ''
    ].filter(Boolean).join(' ');
    const label = spoiler
      ? `${step.turn}턴${alerted ? ' · 신호' : ''}`
      : `${step.phase}${showShock ? ' · 충격' : ''}`;
    return `<i class="${classes}" title="${label}">${step.turn}</i>`;
  }).join('');
  const aria = waiting
    ? `12턴 중 ${state.turn}턴 정산 후 시장 대기`
    : `12턴 중 ${state.turn}턴, 현재 국면 ${state.phase}`;
  return `<div class="turn-track" role="img" aria-label="${aria}">${cells}</div>`;
}

export function renderMarketTimeline(state: GameState | null, waiting: boolean): string {
  const currentTurn = state?.turn ?? 0;
  const path = state?.marketPath ?? [];
  return `<p class="eyebrow">시장 흐름 · 금리의 두 얼굴</p><h2>12턴 타임라인</h2><div class="timeline">${path.map((step) => {
    const current = isRevealedTurn(step.turn, currentTurn, waiting);
    const past = isCompletedTurn(step.turn, currentTurn, waiting);
    const spoiler = isUpcomingSpoiler(step.turn, currentTurn);
    const showShock = Boolean(step.shock) && !spoiler;
    const body = spoiler
      ? `<p><strong>${step.turn}턴</strong>시장은 주사위가 멈춘 뒤에 공개됩니다.</p>`
      : `<p><strong>${step.phase}${showShock ? ' · 충격' : ''}</strong>${step.headline}<small>${step.signal}</small></p>`;
    return `<div class="${current ? 'current' : past ? 'past' : ''}${showShock ? ' shock' : ''}"><span>${step.turn}</span>${body}</div>`;
  }).join('')}</div><div class="why-box"><strong>교육용 단순화</strong><p>실제 시장은 여러 요인이 동시에 작용합니다. 이 흐름은 전망이나 투자 권유가 아니라 금리·채권 관계를 체험하기 위한 가정입니다. 시장 경로는 게임 시드마다 달라집니다.</p></div>`;
}
