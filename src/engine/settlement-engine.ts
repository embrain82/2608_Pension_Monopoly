import { products } from '../data/content';
import type { GameState, ProductId, TurnSummary } from '../types';
import { portfolioValue } from './portfolio-engine';
import { riskAssetRatio } from './policy-engine';

export const HINT_OVER_LIMIT = '위험자산 추가 매수는 막힙니다. 예금·채권으로 대기자금을 옮기거나 리밸런싱하세요.';
export const HINT_PENDING_FUND = '펀드 주문은 다음 턴에 잔고에 들어갑니다.';
export const HINT_NEAR_LIMIT = '위험한도에 가깝습니다. 가능액 매수 전에 미리보기를 보세요.';
export const HINT_DEFAULT = '다음 턴 시장을 보고 납입·매매·그대로 중 하나를 고르세요.';

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
  return {
    turn: before.turn,
    actionLine,
    irpBefore: portfolioValue(before),
    irpAfter: portfolioValue(after),
    riskBefore: riskAssetRatio(before),
    riskAfter,
    marketHeadline: after.lastMarket.headline,
    shock: Boolean(after.lastMarket.shock),
    alert: after.lastMarket.alert,
    marketLimitExceeded: after.marketLimitExceeded,
    productDeltas,
    nextHints: nextHints(after, riskAfter)
  };
}
