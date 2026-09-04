import { balanceConfig } from '../data/content';
import type { GameState, ScoreResult } from '../types';

const formatMan = (value: number) => `${Math.max(1, Math.round(value / 10_000)).toLocaleString('ko-KR')}만 원`;
const formatShortWon = (value: number) => value >= 100_000_000
  ? `${(value / 100_000_000).toFixed(2)}억`
  : `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;

export function turnsLeft(state: GameState): number {
  return Math.max(0, balanceConfig.maxTurns - state.turn);
}

export function goalStatusLine(state: GameState, score: ScoreResult): string {
  const remaining = Math.max(0, state.goalMonthly - score.monthlyPension);
  const cashGap = Math.max(0, balanceConfig.safeCashThreshold - state.cash);
  if (score.goalRate < balanceConfig.nearGoalRate) {
    return `목표까지 ${formatMan(remaining)} · 남은 턴 ${turnsLeft(state)}`;
  }
  if (!score.goalMet) {
    return `1별 확보 · 목표까지 ${formatMan(remaining)}`;
  }
  if (cashGap > 0) {
    return `목표 달성 · 2별까지 생활자금 ${formatMan(cashGap)} 더`;
  }
  return '2별 조건 충족 · 낙폭·분산·정렬을 지키면 3별';
}

export function renderGoalMeter(state: GameState, score: ScoreResult): string {
  const pct = Math.min(100, score.goalRate * 100);
  const status = score.goalMet ? 'met' : score.goalRate >= 0.9 ? 'near' : '';
  const meterClass = ['goal-meter', status].filter(Boolean).join(' ');
  const statusClass = ['goal-status', status].filter(Boolean).join(' ');
  return `<div class="${meterClass}"><span style="width:${pct.toFixed(1)}%"></span><i class="tick" style="left:${Math.round(balanceConfig.nearGoalRate * 100)}%" aria-hidden="true"></i></div>
    <div class="goal-caption"><span>목표 ${formatShortWon(state.goalMonthly)}</span><strong>${Math.round(score.goalRate * 100)}%</strong><span>남은 턴 ${turnsLeft(state)}</span></div>
    <p class="${statusClass}">${goalStatusLine(state, score)}</p>`;
}

export function renderRiskMeter(ratio: number, limit: number): string {
  const over = ratio > limit + 0.00001;
  return `<div class="risk-meter${over ? ' over' : ''}" role="img" aria-label="위험자산 비중 ${(ratio * 100).toFixed(1)}%, 한도 ${Math.round(limit * 100)}%"><span style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></span><i class="limit" style="left:${Math.round(limit * 100)}%"></i></div>`;
}
