import { products } from '../data/content';
import type { GameState, ProductId, TurnSummary } from '../types';
import { portfolioValue } from './portfolio-engine';
import { riskAssetRatio } from './policy-engine';

export const HINT_OVER_LIMIT = '위험자산 추가 매수는 막힙니다. 예금·채권으로 대기자금을 옮기거나 리밸런싱하세요.';
export const HINT_PENDING_FUND = '펀드 주문은 다음 턴에 잔고에 들어갑니다.';
export const HINT_NEAR_LIMIT = '위험한도에 가깝습니다. 가능액 매수 전에 미리보기를 보세요.';
export const HINT_DEFAULT = '다음 턴 시장을 보고 납입·매매·그대로 중 하나를 고르세요.';

export const REACTION_LONG_BOND_DROP = '장기채가 크게 밀렸습니다. 예금·단기채가 방어했는지 보세요.';
export const REACTION_EQUITY_DROP = '주식이 크게 떨어졌습니다. 급락 뒤 회복도 자주 오니 분산을 지키세요.';
export const REACTION_EQUITY_RALLY = '주식이 크게 올랐습니다. 위험비중이 한도에 가까워졌는지 확인하세요.';
export const REACTION_LONG_BOND_RALLY = '금리 인하 기대에 장기채가 뛰었습니다. 채권이 방어 역할을 했습니다.';
export const REACTION_CONTRIBUTE = '납입은 시장과 무관하게 목표에 가장 확실히 다가가는 방법입니다.';
export const REACTION_DRAWDOWN = '이번 턴은 평가액이 줄었습니다. 12턴 전체를 보고 판단하세요.';
export const REACTION_DEFAULT = '큰 변화 없는 턴입니다. 다음 신호를 기다리며 분산을 점검하세요.';

export function reactionLine(before: GameState, after: GameState, actionLine: string): string {
  const returns = after.lastMarket.returns;
  const shock = Boolean(after.lastMarket.shock);
  if (shock && returns.longBond <= -0.05) return REACTION_LONG_BOND_DROP;
  if (shock && returns.equityEtf <= -0.06) return REACTION_EQUITY_DROP;
  if (returns.equityEtf >= 0.05) return REACTION_EQUITY_RALLY;
  if (returns.longBond >= 0.04) return REACTION_LONG_BOND_RALLY;
  if (actionLine.includes('추가납입')) return REACTION_CONTRIBUTE;
  const irpBefore = portfolioValue(before);
  if (irpBefore > 0 && (portfolioValue(after) - irpBefore) / irpBefore <= -0.02) return REACTION_DRAWDOWN;
  return REACTION_DEFAULT;
}

function holdingAmount(state: GameState, productId: ProductId): number {
  return state.holdings.find((holding) => holding.productId === productId)?.amount ?? 0;
}

function nextHints(after: GameState, riskAfter: number): string[] {
  const hints: string[] = [];
  if (after.lastMarket.alert) hints.push(after.lastMarket.alert.hint);
  if (after.marketLimitExceeded) hints.push(HINT_OVER_LIMIT);
  if (after.pendingOrders.length > 0) hints.push(HINT_PENDING_FUND);
  if (riskAfter > 0.62 && !after.marketLimitExceeded) hints.push(HINT_NEAR_LIMIT);
  if (hints.length === 0) hints.push(HINT_DEFAULT);
  return hints.slice(0, 2);
}

export function summarizeTurn(before: GameState, after: GameState, actionLine: string): TurnSummary {
  const productDeltas = products
    .map((product) => ({
      productId: product.id,
      name: product.shortName,
      delta: holdingAmount(after, product.id) - holdingAmount(before, product.id)
    }))
    .filter((item) => Math.abs(item.delta) >= 1000)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
  const riskAfter = riskAssetRatio(after);
  const irpAfter = portfolioValue(after);
  const holdingShares = Object.fromEntries(products.map((product) => [
    product.id,
    irpAfter > 0 ? holdingAmount(after, product.id) / irpAfter : 0
  ])) as Record<ProductId, number>;
  const productReturns = { ...after.lastMarket.returns };
  let biggestMover: ProductId | null = null;
  let biggestImpact = 0;
  for (const product of products) {
    const impact = Math.abs(productReturns[product.id] * holdingShares[product.id]);
    if (holdingShares[product.id] > 0 && impact > biggestImpact) {
      biggestImpact = impact;
      biggestMover = product.id;
    }
  }
  return {
    turn: before.turn,
    actionLine,
    irpBefore: portfolioValue(before),
    irpAfter,
    riskBefore: riskAssetRatio(before),
    riskAfter,
    marketHeadline: after.lastMarket.headline,
    shock: Boolean(after.lastMarket.shock),
    alert: after.lastMarket.alert,
    marketLimitExceeded: after.marketLimitExceeded,
    productDeltas,
    nextHints: nextHints(after, riskAfter),
    productReturns,
    holdingShares,
    biggestMover,
    reaction: reactionLine(before, after, actionLine)
  };
}
