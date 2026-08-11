import { policyRules, products } from '../data/content';
import type { GameState, MarketStep, ProductId } from '../types';
import { portfolioValue } from './portfolio-engine';
import { riskAssetRatio } from './policy-engine';

export function rateShockReturn(productId: ProductId, rateStepChange: number): number {
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error(`알 수 없는 상품: ${productId}`);
  return -0.01 * product.duration * rateStepChange;
}

export function applyMarketStep(state: GameState, market: MarketStep): GameState {
  const holdings = state.holdings.map((holding) => {
    const product = products.find((item) => item.id === holding.productId);
    if (!product) return holding;
    const gross = holding.amount * (1 + market.returns[holding.productId]);
    const fee = Math.max(0, gross * product.feeRate);
    return {
      ...holding,
      amount: Math.max(0, gross - fee),
      depositTurnsHeld: holding.productId === 'deposit' ? holding.depositTurnsHeld + 1 : holding.depositTurnsHeld
    };
  });
  let next = { ...state, holdings, lastMarket: market };
  const value = portfolioValue(next);
  const maxIrpValue = Math.max(state.maxIrpValue, value);
  const drawdown = maxIrpValue <= 0 ? 0 : Math.max(0, (maxIrpValue - value) / maxIrpValue);
  next = {
    ...next,
    maxIrpValue,
    maxDrawdown: Math.max(state.maxDrawdown, drawdown),
    marketLimitExceeded: riskAssetRatio(next) > policyRules.riskAssetLimit + 0.00001
  };
  return next;
}
