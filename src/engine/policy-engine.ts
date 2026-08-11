import { policyRules, products } from '../data/content';
import type { GameState, LifeEvent, ProductId } from '../types';
import { portfolioValue } from './portfolio-engine';

export function effectiveRiskRatio(productId: ProductId): number {
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error(`알 수 없는 상품: ${productId}`);
  return product.tdf_exception_eligible
    ? Math.min(product.risk_asset_ratio, policyRules.tdfAdjustedRiskRatio)
    : product.risk_asset_ratio;
}

export function riskAssetValue(state: GameState): number {
  const holdingRisk = state.holdings.reduce((sum, holding) => sum + holding.amount * effectiveRiskRatio(holding.productId), 0);
  const pendingBuyRisk = state.pendingOrders
    .filter((order) => order.side === 'buy')
    .reduce((sum, order) => sum + order.amount * effectiveRiskRatio(order.productId), 0);
  return holdingRisk + pendingBuyRisk;
}

export function riskAssetRatio(state: GameState): number {
  const total = portfolioValue(state);
  return total <= 0 ? 0 : riskAssetValue(state) / total;
}

export function expectedRiskAfterBuy(state: GameState, productId: ProductId, amount: number): number {
  const total = portfolioValue(state);
  if (total <= 0) return 0;
  return (riskAssetValue(state) + amount * effectiveRiskRatio(productId)) / total;
}

export function canBuyRiskAsset(state: GameState, productId: ProductId, amount: number): { ok: boolean; ratio: number; reason: string } {
  const current = riskAssetRatio(state);
  const addedRisk = effectiveRiskRatio(productId);
  const ratio = expectedRiskAfterBuy(state, productId, amount);
  if (addedRisk > 0 && current > policyRules.riskAssetLimit) {
    return { ok: false, ratio, reason: '시장 상승으로 현재 위험비중이 한도를 넘었습니다. 안전자산 매수나 리밸런싱이 먼저 필요합니다.' };
  }
  if (ratio > policyRules.riskAssetLimit + 0.00001) {
    return { ok: false, ratio, reason: `예상 위험자산 비중이 ${(ratio * 100).toFixed(1)}%로 교육용 한도 ${(policyRules.riskAssetLimit * 100).toFixed(0)}%를 넘습니다.` };
  }
  return { ok: true, ratio, reason: `매수 후 예상 위험자산 비중 ${(ratio * 100).toFixed(1)}%` };
}

export function contributionCredit(currentContribution: number, amount: number): { eligible: number; benefit: number } {
  const availableContribution = Math.max(0, policyRules.annualContributionLimit - currentContribution);
  const accepted = Math.min(amount, availableContribution);
  const alreadyEligible = Math.min(currentContribution, policyRules.annualTaxCreditLimit);
  const eligible = Math.min(accepted, Math.max(0, policyRules.annualTaxCreditLimit - alreadyEligible));
  return { eligible, benefit: eligible * policyRules.taxCreditRate };
}

export function canWithdrawForEvent(event: LifeEvent): boolean {
  return event.eligibleWithdrawal;
}
