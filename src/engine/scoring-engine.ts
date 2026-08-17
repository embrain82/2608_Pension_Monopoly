import { balanceConfig, investorProfiles, policyRules } from '../data/content';
import type { GameState, ProfileId, ScoreResult } from '../types';
import { portfolioValue } from './portfolio-engine';
import { riskAssetRatio } from './policy-engine';

export function monthlyPension(irpValue: number): number {
  return irpValue / policyRules.receivingMonths;
}

export function diversificationCount(state: GameState): number {
  const total = portfolioValue(state);
  if (total <= 0) return 0;
  return state.holdings.filter((holding) => holding.amount / total >= 0.05).length;
}

export function behaviorProfile(state: GameState): ProfileId {
  const ratio = riskAssetRatio(state);
  let closest = investorProfiles[0];
  for (const profile of investorProfiles) {
    if (Math.abs(profile.expectedRiskRatio - ratio) < Math.abs(closest.expectedRiskRatio - ratio)) closest = profile;
  }
  return closest.id;
}

export function calculateScore(state: GameState): ScoreResult {
  const irpValue = portfolioValue(state);
  const pension = monthlyPension(irpValue);
  const goalRate = state.goalMonthly <= 0 ? 0 : pension / state.goalMonthly;
  const goalMet = goalRate >= 1;
  const riskRatio = riskAssetRatio(state);
  const diversification = diversificationCount(state);
  const actualProfile = behaviorProfile(state);
  const diagnosedIndex = investorProfiles.findIndex((profile) => profile.id === state.profileId);
  const actualIndex = investorProfiles.findIndex((profile) => profile.id === actualProfile);
  const profileAligned = Math.abs(diagnosedIndex - actualIndex) <= 1;
  const safeCash = state.cash >= balanceConfig.safeCashThreshold;
  const obeyedRules = state.ruleBreaches === 0;
  const drawdownOk = state.maxDrawdown <= balanceConfig.maxDrawdownThreshold;
  const diversified = diversification >= balanceConfig.diversificationMin;

  let stars: 0 | 1 | 2 | 3 = 0;
  if (goalMet) stars = 1;
  if (goalMet && safeCash && obeyedRules) stars = 2;
  if (stars === 2 && drawdownOk && diversified && profileAligned) stars = 3;

  const incomeScore = Math.min(50, Math.max(0, goalRate * 50));
  const stabilityScore = Math.min(30, Math.max(0,
    (safeCash ? 9 : Math.max(0, 9 * state.cash / balanceConfig.safeCashThreshold)) +
    (drawdownOk ? 9 : Math.max(0, 9 * (1 - state.maxDrawdown))) +
    Math.min(7, diversification * 2.4) +
    Math.max(0, 5 - state.cashShortages * 2)
  ));
  const knowledgeScore = Math.min(20, Math.max(0, 8 + state.understandingPoints + state.rebalanceCount * 2 - state.ruleBreaches * 5));
  const totalScore = Math.round(Math.min(100, Math.max(0, incomeScore + stabilityScore + knowledgeScore)));
  const returnRate = balanceConfig.startingIrp <= 0 ? 0 : (irpValue - balanceConfig.startingIrp) / balanceConfig.startingIrp;
  const investmentReturnRate = balanceConfig.startingIrp <= 0 ? 0 : (irpValue - balanceConfig.startingIrp - state.contributionTotal) / balanceConfig.startingIrp;

  const bestDecision = state.rebalanceCount > 0
    ? '시장 변화 뒤 목표비중을 다시 맞춰 위험을 관리한 결정'
    : state.contributionTotal > 0
      ? '생활자금과 IRP를 나누면서 추가납입한 결정'
      : '급한 판단을 피하고 시장 흐름을 끝까지 확인한 결정';
  const improvement = !safeCash
    ? 'IRP 납입 전 비상생활자금 기준을 먼저 확보해보세요.'
    : !diversified
      ? '서로 다르게 움직이는 자산 3종 이상으로 분산해보세요.'
      : state.rebalanceCount === 0
        ? '시장 국면이 바뀐 뒤 리밸런싱으로 목표 위험비중을 회복해보세요.'
        : !profileAligned
          ? '진단 성향과 실제 위험비중의 차이를 줄여보세요.'
          : '목표 월 연금을 지키면서 시장에 맞게 매매 타이밍을 실험해보세요.';

  return {
    monthlyPension: pension, goalRate, goalMet, irpValue, cash: state.cash, riskRatio,
    diversification, maxDrawdown: state.maxDrawdown, stars, totalScore,
    incomeScore: Math.round(incomeScore), stabilityScore: Math.round(stabilityScore), knowledgeScore: Math.round(knowledgeScore),
    behaviorProfile: actualProfile, profileAligned, bestDecision, improvement,
    relatedCardIds: ['pension-assumption', !safeCash ? 'emergency-cash' : !diversified ? 'diversification' : 'rebalance'],
    returnRate, investmentReturnRate
  };
}
