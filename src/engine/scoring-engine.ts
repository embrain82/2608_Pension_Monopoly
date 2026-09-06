import { balanceConfig, investorProfiles, policyRules, products } from '../data/content';
import type { GameState, PayoutChoice, PayoutPlan, ProfileId, ScoreResult } from '../types';
import { portfolioValue, rebalanceTargetRisk } from './portfolio-engine';
import { canBuyForProfile, riskAssetRatio } from './policy-engine';

/**
 * 목표 판정 계수. 게임의 월 연금 단위는 "연금으로 받을 때 세전 IRP÷240"이다. 일시금은 세금이 더 붙으므로
 * 세후 총액을 연금 세후 기준으로 되돌린 만큼만 인정한다: (1−일시금세율)/(1−연금세율).
 */
export function payoutFactor(choice: PayoutChoice): number {
  if (choice === 'lumpSum') return (1 - policyRules.lumpSumTaxRate) / (1 - policyRules.pensionTaxRate);
  return 1;
}

export function payoutPlan(irpValue: number, choice: PayoutChoice): PayoutPlan {
  const taxRate = choice === 'lumpSum' ? policyRules.lumpSumTaxRate : policyRules.pensionTaxRate;
  const tax = irpValue * taxRate;
  const net = irpValue - tax;
  return {
    choice,
    taxRate,
    tax,
    net,
    monthlyNet: net / policyRules.receivingMonths,
    monthlyBasis: (irpValue * payoutFactor(choice)) / policyRules.receivingMonths
  };
}

export function monthlyPension(irpValue: number, choice: PayoutChoice = 'annuity20'): number {
  return (irpValue * payoutFactor(choice)) / policyRules.receivingMonths;
}

export function diversificationCount(state: GameState): number {
  const total = portfolioValue(state);
  if (total <= 0) return 0;
  return state.holdings.filter((holding) => holding.amount / total >= 0.05).length;
}

export function diversificationNeeded(profileId: ProfileId): number {
  const allowed = products.filter((product) => canBuyForProfile(profileId, product.id).ok).length;
  return Math.min(balanceConfig.diversificationMin, Math.max(1, allowed));
}

export function behaviorProfile(state: GameState): ProfileId {
  const ratio = riskAssetRatio(state);
  let closest = investorProfiles[0];
  for (const profile of investorProfiles) {
    if (Math.abs(profile.expectedRiskRatio - ratio) < Math.abs(closest.expectedRiskRatio - ratio)) closest = profile;
  }
  return closest.id;
}

/** 지식 점수 항목별 상한. 기본 4 + 퀴즈 8 + 이해 6 + 리밸런싱 4(합 22) − 규칙 위반 5/회, 0~20으로 자른다 */
export const KNOWLEDGE_CAPS = { base: 4, quiz: 8, understanding: 6, rebalance: 4, breachPenalty: 5 } as const;

export interface KnowledgeBreakdown {
  quizCorrect: number;
  quiz: number;
  understanding: number;
  rebalance: number;
  penalty: number;
  total: number;
}

/** 지식 점수(0~20)의 항목 분해. 퀴즈 정답 ×2(최대 8), 이해 포인트(최대 6), 리밸런싱 ×2(최대 4) */
export function knowledgeBreakdown(state: GameState): KnowledgeBreakdown {
  const quizCorrect = state.quizLog.filter((record) => record.correct).length;
  const quiz = Math.min(KNOWLEDGE_CAPS.quiz, quizCorrect * 2);
  const understanding = Math.min(KNOWLEDGE_CAPS.understanding, Math.max(0, state.understandingPoints));
  const rebalance = Math.min(KNOWLEDGE_CAPS.rebalance, state.rebalanceCount * 2);
  const penalty = state.ruleBreaches * KNOWLEDGE_CAPS.breachPenalty;
  const total = Math.min(20, Math.max(0, KNOWLEDGE_CAPS.base + quiz + understanding + rebalance - penalty));
  return { quizCorrect, quiz, understanding, rebalance, penalty, total };
}

export function knowledgeScoreOf(state: GameState): number {
  return knowledgeBreakdown(state).total;
}

export function starTitle(stars: 0 | 1 | 2 | 3): string {
  return ['연금 설계 입문자', '목표에 가까워진 적립가', '균형 잡힌 적립가', '지속 가능한 연금 설계자'][stars];
}

export function starChecklist(state: GameState, score: ScoreResult): { label: string; passed: boolean }[] {
  const need = diversificationNeeded(state.profileId);
  return [
    { label: `월 연금이 목표의 ${Math.round(balanceConfig.nearGoalRate * 100)}%에 닿음`, passed: score.goalRate >= balanceConfig.nearGoalRate },
    { label: `생활자금 ${(balanceConfig.safeCashThreshold / 10000).toFixed(0)}만 원`, passed: state.cash >= balanceConfig.safeCashThreshold },
    { label: `낙폭 ${Math.round(balanceConfig.maxDrawdownThreshold * 100)}% 이하`, passed: state.maxDrawdown <= balanceConfig.maxDrawdownThreshold },
    { label: `분산 ${need}종 이상`, passed: score.diversification >= need },
    { label: `성향 목표 위험비중과 ${Math.round(balanceConfig.profileAlignBand * 100)}%p 이내`, passed: score.profileAligned }
  ];
}

export function calculateScore(state: GameState): ScoreResult {
  const irpValue = portfolioValue(state);
  const choice: PayoutChoice = state.payoutChoice ?? 'annuity20';
  const payout = payoutPlan(irpValue, choice);
  const pension = payout.monthlyBasis;
  const goalRate = state.goalMonthly <= 0 ? 0 : pension / state.goalMonthly;
  const goalMet = goalRate >= 1;
  const riskRatio = riskAssetRatio(state);
  const diversification = diversificationCount(state);
  const actualProfile = behaviorProfile(state);
  const profileAligned = Math.abs(riskRatio - rebalanceTargetRisk(state.profileId)) <= balanceConfig.profileAlignBand;
  const safeCash = state.cash >= balanceConfig.safeCashThreshold;
  const drawdownOk = state.maxDrawdown <= balanceConfig.maxDrawdownThreshold;
  const diversified = diversification >= diversificationNeeded(state.profileId);
  const nearGoal = goalRate >= balanceConfig.nearGoalRate;

  let stars: 0 | 1 | 2 | 3 = 0;
  if (nearGoal && !goalMet) stars = 1;
  if (goalMet && !safeCash) stars = 1;
  if (goalMet && safeCash) stars = 2;
  if (stars === 2 && drawdownOk && diversified && profileAligned) stars = 3;

  const incomeScore = Math.min(50, Math.max(0, goalRate * 50));
  const stabilityScore = Math.min(30, Math.max(0,
    (safeCash ? 9 : Math.max(0, 9 * state.cash / balanceConfig.safeCashThreshold)) +
    (drawdownOk ? 9 : Math.max(0, 9 * (1 - state.maxDrawdown))) +
    Math.min(7, diversification * 2.4) +
    Math.max(0, 5 - state.cashShortages * 2)
  ));
  const knowledgeScore = knowledgeScoreOf(state);
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
          ? '공식 리밸런싱 목표 위험비중에 더 가깝게 맞춰보세요.'
          : '목표 월 연금을 지키면서 시장에 맞게 매매 타이밍을 실험해보세요.';

  return {
    monthlyPension: pension, goalRate, goalMet, irpValue, cash: state.cash, riskRatio,
    diversification, maxDrawdown: state.maxDrawdown, stars, starTitle: starTitle(stars), totalScore,
    incomeScore: Math.round(incomeScore), stabilityScore: Math.round(stabilityScore), knowledgeScore: Math.round(knowledgeScore),
    behaviorProfile: actualProfile, profileAligned, bestDecision, improvement,
    relatedCardIds: ['pension-assumption', !safeCash ? 'emergency-cash' : !diversified ? 'diversification' : 'rebalance'],
    returnRate, investmentReturnRate,
    payout
  };
}
