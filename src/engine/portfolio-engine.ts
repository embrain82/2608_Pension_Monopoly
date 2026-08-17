import { balanceConfig, policyRules, products } from '../data/content';
import type { ActionResult, GameState, Holding, PendingOrder, ProductId } from '../types';
import { canBuyForProfile, canBuyRiskAsset, maxBuyWithinRiskLimit, riskAssetRatio } from './policy-engine';

export function portfolioValue(state: Pick<GameState, 'holdings' | 'irpCash'> & Partial<Pick<GameState, 'pendingOrders'>>): number {
  const pendingValue = state.pendingOrders?.reduce((sum, order) => sum + order.amount, 0) ?? 0;
  return state.irpCash + pendingValue + state.holdings.reduce((sum, holding) => sum + holding.amount, 0);
}

function holdingFor(state: GameState, productId: ProductId): Holding {
  return state.holdings.find((holding) => holding.productId === productId) ?? {
    productId,
    amount: 0,
    principal: 0,
    depositTurnsHeld: 0
  };
}

function upsertHolding(state: GameState, holding: Holding): Holding[] {
  const existing = state.holdings.some((item) => item.productId === holding.productId);
  return existing
    ? state.holdings.map((item) => (item.productId === holding.productId ? holding : item))
    : [...state.holdings, holding];
}

export function buyProduct(state: GameState, productId: ProductId, requestedAmount = balanceConfig.tradeAmount): ActionResult {
  const product = products.find((item) => item.id === productId);
  if (!product) return { ok: false, message: '상품을 찾을 수 없습니다.', state };
  const amount = Math.min(requestedAmount, state.irpCash);
  if (amount < 100000) return { ok: false, message: 'IRP 대기자금이 부족합니다.', state };
  const suitability = canBuyForProfile(state.profileId, productId);
  if (!suitability.ok) {
    const unlocked = state.unlockedCards.includes('profile') ? state.unlockedCards : [...state.unlockedCards, 'profile'];
    return { ok: false, message: suitability.reason, state: { ...state, unlockedCards: unlocked } };
  }
  const check = canBuyRiskAsset(state, productId, amount);
  if (!check.ok) return { ok: false, message: check.reason, state, expectedRiskRatio: check.ratio };

  if (product.kind === 'fund') {
    const order: PendingOrder = {
      id: `${state.turn}-buy-${productId}-${state.pendingOrders.length}`,
      side: 'buy', productId, amount, submittedTurn: state.turn, settlesTurn: state.turn + 1, stage: 'received'
    };
    return {
      ok: true,
      message: `${product.shortName} 매수 주문 접수 → 다음 턴 기준가 확정·잔고 반영`,
      expectedRiskRatio: check.ratio,
      state: { ...state, irpCash: state.irpCash - amount, pendingOrders: [...state.pendingOrders, order], riskBuyCount: state.riskBuyCount + (product.risk_asset_ratio > 0 ? 1 : 0) }
    };
  }

  const current = holdingFor(state, productId);
  const nextHolding = { ...current, amount: current.amount + amount, principal: current.principal + amount, depositTurnsHeld: product.kind === 'deposit' ? 0 : current.depositTurnsHeld };
  return {
    ok: true,
    message: product.kind === 'etf' ? `${product.shortName}가 표시가격으로 즉시 체결되었습니다.` : `${product.shortName}에 가입했습니다. 만기 전 해지 시 불이익이 있습니다.`,
    expectedRiskRatio: check.ratio,
    state: { ...state, irpCash: state.irpCash - amount, holdings: upsertHolding(state, nextHolding), riskBuyCount: state.riskBuyCount + (product.risk_asset_ratio > 0 ? 1 : 0) }
  };
}

export function sellProduct(state: GameState, productId: ProductId, requestedAmount = balanceConfig.tradeAmount): ActionResult {
  const product = products.find((item) => item.id === productId);
  const current = holdingFor(state, productId);
  const amount = Math.min(requestedAmount, current.amount);
  if (!product || amount < 100000) return { ok: false, message: '매도할 잔고가 부족합니다.', state };

  if (product.kind === 'fund') {
    const order: PendingOrder = {
      id: `${state.turn}-sell-${productId}-${state.pendingOrders.length}`,
      side: 'sell', productId, amount, submittedTurn: state.turn, settlesTurn: state.turn + 1, stage: 'received'
    };
    return { ok: true, message: `${product.shortName} 환매 주문 접수 → 다음 턴 대금 반영`, state: { ...state, holdings: upsertHolding(state, { ...current, amount: current.amount - amount }), pendingOrders: [...state.pendingOrders, order] } };
  }

  const penalty = product.kind === 'deposit' && current.depositTurnsHeld < balanceConfig.depositMaturityTurns ? amount * policyRules.earlyDepositPenaltyRate : 0;
  return {
    ok: true,
    message: penalty > 0 ? `예금을 만기 전에 해지해 ${Math.round(penalty).toLocaleString('ko-KR')}원의 이자 불이익이 반영되었습니다.` : `${product.shortName} 매도가 즉시 체결되었습니다.`,
    state: { ...state, irpCash: state.irpCash + amount - penalty, holdings: upsertHolding(state, { ...current, amount: current.amount - amount }), understandingPoints: state.understandingPoints + 1 }
  };
}

function buyAfterSwitch(afterSell: GameState, fromName: string, toId: ProductId, requested: number): ActionResult {
  const to = products.find((item) => item.id === toId);
  const toName = to?.shortName ?? '새 상품';
  const affordable = Math.min(requested, afterSell.irpCash);
  const buyAmount = maxBuyWithinRiskLimit(afterSell, toId, affordable);
  if (buyAmount < 100000) {
    return {
      ok: true,
      state: afterSell,
      message: `${fromName} 매도는 완료했지만 ${toName} 매수는 위험한도 때문에 지금 할 수 없습니다. 매도 대금은 대기자금으로 남았습니다.`
    };
  }
  const bought = buyProduct(afterSell, toId, buyAmount);
  if (!bought.ok) {
    return {
      ok: true,
      state: afterSell,
      message: `매도는 완료했지만 새 매수는 제한되었습니다. 매도 대금은 대기자금으로 남았습니다. ${bought.message}`
    };
  }
  if (buyAmount < affordable) {
    return {
      ...bought,
      message: `${fromName} → ${toName} 교체: 위험한도까지 ${Math.round(buyAmount).toLocaleString('ko-KR')}원만 사고, 나머지는 대기자금으로 남겼습니다.`
    };
  }
  return { ...bought, message: `${fromName} 매도 후 ${toName} 매수를 반영했습니다. ${bought.message}` };
}

export function switchProduct(state: GameState, fromId: ProductId, toId: ProductId, amount = balanceConfig.tradeAmount): ActionResult {
  if (fromId === toId) return { ok: false, message: '서로 다른 상품을 선택하세요.', state };
  const suitability = canBuyForProfile(state.profileId, toId);
  if (!suitability.ok) {
    const unlocked = state.unlockedCards.includes('profile') ? state.unlockedCards : [...state.unlockedCards, 'profile'];
    return { ok: false, message: suitability.reason, state: { ...state, unlockedCards: unlocked } };
  }
  const from = products.find((item) => item.id === fromId);
  const current = holdingFor(state, fromId);
  const sellAmount = Math.min(amount, current.amount);
  if (!from || sellAmount < 100000) return { ok: false, message: '교체할 기존 상품 잔고가 부족합니다.', state };
  if (from.kind === 'fund') {
    const order: PendingOrder = { id: `${state.turn}-switch-${fromId}-${toId}`, side: 'sell', productId: fromId, targetProductId: toId, amount: sellAmount, submittedTurn: state.turn, settlesTurn: state.turn + 1, stage: 'received' };
    return { ok: true, message: '환매대금이 들어온 다음 새 상품 매수가 이어집니다. 대기자금 구간을 체험합니다.', state: { ...state, holdings: upsertHolding(state, { ...current, amount: current.amount - sellAmount }), pendingOrders: [...state.pendingOrders, order] } };
  }
  const sold = sellProduct(state, fromId, sellAmount);
  if (!sold.ok) return sold;
  return buyAfterSwitch(sold.state, from.shortName, toId, sellAmount);
}

export function settleOrders(state: GameState): GameState {
  let next = { ...state, holdings: state.holdings.map((holding) => ({ ...holding })), pendingOrders: [] as PendingOrder[] };
  for (const order of state.pendingOrders) {
    if (order.settlesTurn > state.turn) {
      next.pendingOrders.push({ ...order, stage: 'priced' });
      continue;
    }
    if (order.side === 'buy') {
      const current = holdingFor(next, order.productId);
      next.holdings = upsertHolding(next, { ...current, amount: current.amount + order.amount, principal: current.principal + order.amount });
    } else {
      next.irpCash += order.amount;
      if (order.targetProductId) {
        const targetName = products.find((item) => item.id === order.targetProductId)?.shortName ?? '새 상품';
        const suitability = canBuyForProfile(next.profileId, order.targetProductId);
        if (!suitability.ok) {
          next = {
            ...next,
            logs: [...next.logs, { turn: state.turn, type: 'settle', message: `${targetName} 매수는 성향 적합성 때문에 보류했습니다. 환매 대금은 대기자금으로 남았습니다.` }]
          };
          continue;
        }
        const affordable = Math.min(order.amount, next.irpCash);
        const buyAmount = maxBuyWithinRiskLimit(next, order.targetProductId, affordable);
        if (buyAmount >= 100000) {
          next = buyProduct(next, order.targetProductId, buyAmount).state;
        }
        if (buyAmount < affordable) {
          next = {
            ...next,
            logs: [...next.logs, {
              turn: state.turn,
              type: 'settle',
              message: `${targetName} 매수는 위험한도까지 ${Math.round(buyAmount).toLocaleString('ko-KR')}원만 반영하고, 나머지는 대기자금으로 남겼습니다.`
            }]
          };
        }
      }
    }
  }
  return next;
}

export function rebalancePortfolio(state: GameState): ActionResult {
  const total = portfolioValue(state);
  if (total <= 0) return { ok: false, message: '리밸런싱할 자산이 없습니다.', state };
  const weights = Object.fromEntries(products.map((product) => [
    product.id,
    canBuyForProfile(state.profileId, product.id).ok ? balanceConfig.rebalanceAllocation[product.id] : 0
  ])) as Record<ProductId, number>;
  const weightSum = products.reduce((sum, product) => sum + weights[product.id], 0);
  if (weightSum <= 0) return { ok: false, message: '성향에 맞는 리밸런싱 대상 상품이 없습니다.', state };
  const skipped = products.filter((product) => balanceConfig.rebalanceAllocation[product.id] > 0 && weights[product.id] <= 0);
  const holdings = products.map((product) => {
    const share = weights[product.id] / weightSum;
    return {
      productId: product.id,
      amount: total * share,
      principal: total * share,
      depositTurnsHeld: product.id === 'deposit' ? 0 : holdingFor(state, product.id).depositTurnsHeld
    };
  });
  const rebalanced = { ...state, irpCash: 0, holdings, pendingOrders: [], rebalanceCount: state.rebalanceCount + 1, understandingPoints: state.understandingPoints + 3 };
  const skipNote = skipped.length
    ? ` ${skipped.map((item) => item.shortName).join('·')}은 성향보다 등급이 높아 제외했습니다.`
    : '';
  return { ok: true, message: `목표비중으로 리밸런싱했습니다. 위험자산 비중 ${(riskAssetRatio(rebalanced) * 100).toFixed(1)}%.${skipNote}`, state: rebalanced };
}
