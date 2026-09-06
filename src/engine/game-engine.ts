import { balanceConfig, learningCards, lifeEvents, marketScenario, marketShocks, policyRules, products } from '../data/content';
import type { ActionKind, ActionResult, GameState, GhostTrack, PayoutChoice, ProfileId, ProductId } from '../types';
import { ALERT_CARD_ID, applyMarketStep, emptyMarketStep, generateMarketPath, marketPathOf } from './market-engine';
import { pickTileBriefing } from './tile-briefing';
import { buyProduct, liquidateForLivingCost, portfolioValue, rebalancePortfolio, sellProduct, settleOrders, switchProduct } from './portfolio-engine';
import { contributionCredit, riskAssetRatio } from './policy-engine';
import { holdingsMap, summarizeTurn } from './settlement-engine';
import { diceStepsForTurn, hashSeed, nextRandom } from './random-engine';
import { applyGoalToGame, clampGoalMonthly } from './goal';
import { REBALANCE_TILE_BONUS, applyTileArrival } from './tile-effects';
import { payoutPlan } from './scoring-engine';

export { applyGoalToGame, clampGoalMonthly };

export interface GameAction {
  kind: ActionKind;
  productId?: ProductId;
  fromProductId?: ProductId;
  toProductId?: ProductId;
  amount?: number;
}

export type AmountPreset = 'default' | 'half' | 'max';

export interface GameOptions {
  /** 칸 효과 켬/끔. 게이트 측정용. 기본 켬 */
  tileEffects?: boolean;
  /** 고스트("그대로 둔 나") 경로를 함께 계산. 시뮬·고스트 자신은 끔. 기본 켬 */
  ghost?: boolean;
}

function initialHoldings() {
  return products
    .filter((product) => balanceConfig.defaultAllocation[product.id] > 0)
    .map((product) => ({
      productId: product.id,
      amount: balanceConfig.startingIrp * balanceConfig.defaultAllocation[product.id],
      principal: balanceConfig.startingIrp * balanceConfig.defaultAllocation[product.id],
      depositTurnsHeld: product.id === 'deposit' ? 0 : 0
    }));
}

function scheduleLifeEvents(rngState: number): { rngState: number; schedule: Array<{ turn: number; eventId: string }> } {
  const pool = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const chosen: number[] = [];
  let state = rngState;
  while (chosen.length < 3) {
    const roll = nextRandom(state);
    state = roll.state;
    const turn = pool[Math.floor(roll.value * pool.length)];
    if (!chosen.includes(turn)) chosen.push(turn);
  }
  chosen.sort((a, b) => a - b);
  const schedule = chosen.map((turn) => {
    const roll = nextRandom(state);
    state = roll.state;
    const event = lifeEvents[Math.floor(roll.value * lifeEvents.length)];
    return { turn, eventId: event.id };
  });
  return { rngState: state, schedule };
}

function cardForTurn(turn: number, path: GameState['marketPath']): string {
  const shockTurns = path.filter((step) => step.shock).map((step) => step.turn);
  const laterShock = shockTurns.at(-1);
  if (laterShock === turn) return 'etf-order';
  if (turn <= 4) return 'rate-bond';
  if (turn <= 8) return 'duration';
  return 'rebalance';
}

/** 같은 시드·같은 주사위·행동은 늘 "그대로"인 경로. 결과 화면과 정산의 비교 기준. */
export function ghostTrackFor(seed: string, profileId: ProfileId, goalMonthly: number, tileEffects: boolean): GhostTrack {
  const ghost = autoplay(seed, 'passive', profileId, { ghost: false, tileEffects, goalMonthly });
  return { irpHistory: ghost.irpHistory, finalCash: ghost.cash };
}

export function createGame(seed: string, profileId: ProfileId = 'balanced', goalMonthly = balanceConfig.defaultGoal, options: GameOptions = {}): GameState {
  const scheduled = scheduleLifeEvents(hashSeed(seed));
  const marketPath = generateMarketPath(seed);
  const market = emptyMarketStep();
  const tileEffectsEnabled = options.tileEffects !== false;
  const goal = clampGoalMonthly(goalMonthly);
  return {
    seed,
    rngState: scheduled.rngState,
    status: 'playing',
    turn: 0,
    position: 0,
    phase: market.phase,
    goalMonthly: goal,
    profileId,
    cash: balanceConfig.startingCash,
    irpCash: 0,
    holdings: initialHoldings(),
    pendingOrders: [],
    contributionTotal: 0,
    taxCreditEligible: 0,
    taxCreditBenefit: 0,
    maxIrpValue: balanceConfig.startingIrp,
    maxDrawdown: 0,
    irpHistory: [balanceConfig.startingIrp],
    cashShortages: 0,
    ruleBreaches: 0,
    marketLimitExceeded: false,
    understandingPoints: 0,
    rebalanceCount: 0,
    riskBuyCount: 0,
    safeActionCount: 0,
    unlockedCards: ['rate-bond'],
    eventHistory: [],
    logs: [{ turn: 0, type: 'start', message: '원리금보장형 60%, 혼합형 40%로 출발했습니다.' }],
    lastMarket: market,
    marketPath,
    awaitingAction: false,
    currentEventId: null,
    lifeEventSchedule: scheduled.schedule,
    ledger: { open: balanceConfig.startingIrp, afterMarket: balanceConfig.startingIrp, beforeAction: null },
    tileEffects: [],
    actionsLeft: 0,
    turnActionLines: [],
    pendingTaxCredit: 0,
    taxCreditRefunded: 0,
    spotlightProductId: null,
    rebalanceBonusTurn: null,
    extraLifeEvents: 0,
    tileEffectsEnabled,
    ghost: options.ghost === false ? null : ghostTrackFor(seed, profileId, goal, tileEffectsEnabled),
    payoutChoice: null
  };
}

/**
 * 12턴 뒤 최종 결정: 연금(20년 분할)으로 받을지 일시금으로 받을지. 점수의 목표 판정에 반영되고
 * 연금소득세·수령 요건 카드가 열린다. 끝난 판에서만 가능하다.
 */
export function choosePayout(state: GameState, choice: PayoutChoice): ActionResult {
  if (state.status !== 'finished') return { ok: false, message: '12턴을 마친 뒤에 수령 방식을 정할 수 있습니다.', state };
  const irp = portfolioValue(state);
  const plan = payoutPlan(irp, choice);
  const label = choice === 'lumpSum' ? '일시금' : '연금(20년)';
  const message = choice === 'lumpSum'
    ? `일시금 수령 · 교육용 기타소득세 ${Math.round(policyRules.lumpSumTaxRate * 1000) / 10}% ${Math.round(plan.tax).toLocaleString('ko-KR')}원을 뺀 ${Math.round(plan.net).toLocaleString('ko-KR')}원.`
    : `연금 수령 · 교육용 연금소득세 ${Math.round(policyRules.pensionTaxRate * 1000) / 10}%를 뺀 월 ${Math.round(plan.monthlyNet).toLocaleString('ko-KR')}원을 240개월.`;
  let next: GameState = {
    ...state,
    payoutChoice: choice,
    logs: [...state.logs.filter((log) => log.type !== 'payout'), { turn: state.turn, type: 'payout', message: `${label} 선택 · ${message}` }]
  };
  next = unlock(unlock(next, 'pension-tax'), 'payout-choice');
  return { ok: true, message, state: next };
}

function unlock(state: GameState, cardId: string): GameState {
  return state.unlockedCards.includes(cardId) ? state : { ...state, unlockedCards: [...state.unlockedCards, cardId] };
}

/**
 * 턴 시작. 시장이 **먼저** 움직여 보유분에 반영되고(펀드 대기 주문도 이때 체결), 그 뒤 급여·칸 효과·
 * 생활사건 순서로 열린다. 속보 카드가 보여 주는 수익률은 이미 일어난 일이고, 이번 턴 행동은 다음 턴
 * 시장에 노출된다. 지난 턴의 칸 효과·행동 기록은 여기서 비운다.
 */
export function startTurn(state: GameState, steps = 0): ActionResult {
  if (state.status === 'finished' || state.turn >= balanceConfig.maxTurns) {
    return { ok: false, message: '이미 종료된 경기입니다.', state };
  }
  if (state.awaitingAction || state.currentEventId) {
    return { ok: false, message: '이번 턴의 생활사건과 운용 행동을 먼저 완료하세요.', state };
  }
  const turn = state.turn + 1;
  const path = marketPathOf(state);
  const market = path[turn - 1] ?? emptyMarketStep();
  const scheduled = state.lifeEventSchedule.find((item) => item.turn === turn);
  const boardSize = balanceConfig.boardSize;
  const moved = Math.max(0, steps);
  const position = ((state.position + moved) % boardSize + boardSize) % boardSize;
  const crossedStart = moved > 0 && state.position + moved >= boardSize;
  const open = portfolioValue(state);
  let next: GameState = applyMarketStep({
    ...state,
    turn,
    position,
    phase: market.phase,
    marketPath: path,
    cash: state.cash + balanceConfig.salarySurplusPerTurn,
    logs: [...state.logs, { turn, type: 'market', message: `${market.headline} · ${market.signal}` }],
    tileEffects: [],
    actionsLeft: 1,
    turnActionLines: [],
    spotlightProductId: null,
    rebalanceBonusTurn: null
  }, market);
  next = settleOrders(next);
  next = {
    ...next,
    ledger: { open, afterMarket: portfolioValue(next), beforeAction: null },
    awaitingAction: !scheduled,
    currentEventId: scheduled?.eventId ?? null
  };
  next = unlock(next, cardForTurn(turn, path));
  next = unlock(next, pickTileBriefing(state.seed, turn, position).cardId);
  if (market.alert) next = unlock(next, ALERT_CARD_ID);
  if (market.shockId) {
    const shock = marketShocks.find((item) => item.id === market.shockId);
    if (shock) next = unlock(next, shock.cardId);
  }
  if (next.tileEffectsEnabled) {
    next = applyTileArrival(next, { position, crossedStart, scheduledEvent: Boolean(scheduled) });
  }
  if (scheduled) {
    next = { ...next, eventHistory: [...next.eventHistory, scheduled.eventId] };
    return { ok: true, message: '생활사건이 발생했습니다.', state: next };
  }
  if (next.currentEventId) {
    return { ok: true, message: '생활 사건 칸에서 사건이 하나 더 왔습니다.', state: next };
  }
  return { ok: true, message: `${turn}턴 시장이 반영되었습니다. 이제 운용을 정하세요.`, state: next };
}

export function resolveActionAmount(state: GameState, kind: ActionKind, preset: AmountPreset, productId?: ProductId): number {
  const holdingAmount = productId
    ? state.holdings.find((holding) => holding.productId === productId)?.amount ?? 0
    : 0;
  const available = kind === 'contribute' ? state.cash
    : kind === 'buy' ? state.irpCash
      : kind === 'sell' || kind === 'switch' ? holdingAmount
        : 0;
  const base = kind === 'contribute' ? balanceConfig.contributionAmount : balanceConfig.tradeAmount;
  if (preset === 'max') return Math.floor(available);
  if (preset === 'half') return Math.floor(Math.min(base, available) / 2);
  return Math.min(base, available);
}

function reduceIrpProportionally(state: GameState, amount: number): GameState {
  const total = portfolioValue(state);
  if (total <= 0) return state;
  const requested = Math.min(total, amount);
  const fromCash = Math.min(state.irpCash, requested);
  const remaining = requested - fromCash;
  const holdingsTotal = state.holdings.reduce((sum, holding) => sum + holding.amount, 0);
  const factor = holdingsTotal <= 0 ? 1 : Math.max(0, (holdingsTotal - remaining) / holdingsTotal);
  return { ...state, irpCash: state.irpCash - fromCash, holdings: state.holdings.map((holding) => ({ ...holding, amount: holding.amount * factor })) };
}

export function resolveLifeEvent(state: GameState, choice: 'cash' | 'withdraw'): ActionResult {
  const event = lifeEvents.find((item) => item.id === state.currentEventId);
  if (!event) return { ok: false, message: '해결할 생활사건이 없습니다.', state };
  if (event.cost < 0) {
    const next = unlock({ ...state, cash: state.cash - event.cost, currentEventId: null, awaitingAction: true, logs: [...state.logs, { turn: state.turn, type: 'life', message: `${event.title}: 생활자금이 늘었습니다.`, impact: -event.cost }] }, event.learningCardId);
    return { ok: true, message: '보너스를 생활자금에 반영했습니다.', state: next };
  }
  if (choice === 'withdraw' && !event.eligibleWithdrawal) {
    return { ok: false, message: '이 사건은 교육용 중도인출 허용 사유가 아닙니다. 생활자금으로 해결하세요.', state };
  }
  let next = state;
  let message = '';
  if (choice === 'withdraw') {
    const withdrawal = event.cost * (1 + policyRules.allowedWithdrawalFeeRate);
    next = reduceIrpProportionally(state, withdrawal);
    message = '허용 사유를 가정해 IRP에서 비용과 단순화 수수료를 인출했습니다.';
  } else {
    const fromCash = Math.min(state.cash, event.cost);
    let remaining = event.cost - fromCash;
    next = { ...state, cash: state.cash - fromCash };
    const usedIrpOrHoldings = remaining > 0;
    if (remaining > 0) {
      const covered = liquidateForLivingCost(next, remaining);
      next = covered.state;
      remaining = covered.remaining;
      if (covered.sales.length) {
        const sold = covered.sales.map((sale) => {
          const name = products.find((item) => item.id === sale.productId)?.shortName ?? sale.productId;
          return `${name} ${Math.round(sale.amount).toLocaleString('ko-KR')}원`;
        }).join(', ');
        message = remaining > 0
          ? '보유 상품을 매도해도 생활자금이 부족해 비용과 안정성 점수에 영향이 생겼습니다.'
          : `생활자금이 부족해 ${sold}을 매도해 비용을 지급했습니다.`;
      } else if (covered.usedIrpCash > 0 && remaining <= 0) {
        message = '생활자금이 부족해 IRP 대기자금으로 비용을 지급했습니다.';
      }
    }
    if (!message) {
      message = remaining > 0
        ? '생활자금이 부족해 비용과 안정성 점수에 영향이 생겼습니다.'
        : '생활자금으로 해결해 IRP를 지켰습니다.';
    }
    const shortage = remaining > 0;
    next = {
      ...next,
      cashShortages: next.cashShortages + (shortage ? 1 : 0),
      safeActionCount: next.safeActionCount + (!shortage && !usedIrpOrHoldings ? 1 : 0)
    };
  }
  next = unlock({ ...next, currentEventId: null, awaitingAction: true, logs: [...next.logs, { turn: state.turn, type: 'life', message: `${event.title}: ${message}`, impact: -event.cost }] }, event.learningCardId);
  return { ok: true, message, state: next };
}

function contribute(state: GameState, amount: number): ActionResult {
  const accepted = Math.min(amount, state.cash, Math.max(0, policyRules.annualContributionLimit - state.contributionTotal));
  if (accepted < 100000) return { ok: false, message: '생활자금 또는 교육용 납입 가능 한도가 부족합니다.', state };
  const credit = contributionCredit(state.contributionTotal, accepted);
  const next = unlock({
    ...state,
    cash: state.cash - accepted,
    irpCash: state.irpCash + accepted,
    contributionTotal: state.contributionTotal + accepted,
    taxCreditEligible: state.taxCreditEligible + credit.eligible,
    taxCreditBenefit: state.taxCreditBenefit + credit.benefit,
    // 공제 효과는 바로 주지 않고 연말정산 칸을 지날 때 환급 장면으로 돌아온다.
    pendingTaxCredit: state.pendingTaxCredit + credit.benefit,
    understandingPoints: state.understandingPoints + 1
  }, 'contribution-limit');
  const creditNote = credit.benefit > 0
    ? `세액공제 ${Math.round(credit.benefit).toLocaleString('ko-KR')}원(교육용)은 연말정산 칸을 지날 때 생활자금으로 돌아옵니다.`
    : '공제 한도를 넘어 이번 납입은 세액공제가 없습니다.';
  return { ok: true, message: `${accepted.toLocaleString('ko-KR')}원 추가납입. ${creditNote}`, state: next };
}

/** 스포트라이트 상품을 이번 턴에 샀는가(매수·교체 매수). 이해 +1의 근거. */
function boughtSpotlight(before: GameState, after: GameState, action: GameAction): boolean {
  const productId = before.spotlightProductId;
  if (!productId) return false;
  const target = action.kind === 'buy' ? action.productId : action.kind === 'switch' ? action.toProductId : undefined;
  if (target !== productId) return false;
  const pendingBefore = before.pendingOrders.filter((order) => order.side === 'buy' && order.productId === productId).length;
  const pendingAfter = after.pendingOrders.filter((order) => order.side === 'buy' && order.productId === productId).length;
  return holdingOf(after, productId) > holdingOf(before, productId) + 1 || pendingAfter > pendingBefore;
}

/**
 * 운용 행동 1회. 시장은 턴 시작에 이미 반영됐으므로 여기서는 행동만 처리한다. 행동이 남아 있으면
 * (운용지시 칸) 턴을 열어 둔 채 돌아오고, 마지막 행동 뒤에 `finalizeTurn`과 정산 요약을 붙인다.
 * "그대로"는 남은 행동을 모두 쓴다.
 */
export function performAction(state: GameState, action: GameAction): ActionResult {
  if (!state.awaitingAction || state.currentEventId) {
    return { ok: false, message: '먼저 이번 턴 시장을 확인하고 생활사건을 해결하세요.', state };
  }
  const opened: GameState = state.ledger.beforeAction
    ? state
    : { ...state, ledger: { ...state.ledger, beforeAction: { irp: portfolioValue(state), risk: riskAssetRatio(state), holdings: holdingsMap(state) } } };
  let result: ActionResult;
  switch (action.kind) {
    case 'contribute': result = contribute(opened, action.amount ?? balanceConfig.contributionAmount); break;
    case 'buy': result = action.productId ? buyProduct(opened, action.productId, action.amount) : { ok: false, message: '매수 상품을 선택하세요.', state }; break;
    case 'sell': result = action.productId ? sellProduct(opened, action.productId, action.amount) : { ok: false, message: '매도 상품을 선택하세요.', state }; break;
    case 'switch': result = action.fromProductId && action.toProductId ? switchProduct(opened, action.fromProductId, action.toProductId, action.amount) : { ok: false, message: '교체할 두 상품을 선택하세요.', state }; break;
    case 'rebalance': result = rebalancePortfolio(opened); break;
    case 'hold': result = { ok: true, message: '이번 턴은 행동하지 않고 현재 구성을 유지했습니다.', state: { ...opened, safeActionCount: opened.safeActionCount + 1 } }; break;
  }
  if (!result.ok) return { ...result, state: { ...result.state, ledger: state.ledger } };
  let acted: GameState = result.state;
  let message = result.message;
  if (boughtSpotlight(opened, acted, action)) {
    acted = { ...acted, understandingPoints: acted.understandingPoints + 1 };
    message = `${message} 스포트라이트 상품 · 이해 +1.`;
  }
  if (action.kind === 'rebalance' && opened.rebalanceBonusTurn === opened.turn) {
    acted = { ...acted, understandingPoints: acted.understandingPoints + REBALANCE_TILE_BONUS, rebalanceBonusTurn: null };
    message = `${message} 리밸런싱 칸 보너스 · 이해 +${REBALANCE_TILE_BONUS}.`;
  }
  acted = {
    ...acted,
    turnActionLines: [...acted.turnActionLines, message],
    logs: [...acted.logs, { turn: state.turn, type: 'action', message }]
  };
  const left = action.kind === 'hold' ? 0 : Math.max(0, acted.actionsLeft - 1);
  if (left > 0) {
    return { ...result, message: `${message} 이번 턴 행동 ${left}회 더 할 수 있어요.`, state: { ...acted, actionsLeft: left } };
  }
  const next = finalizeTurn({ ...acted, actionsLeft: 0 });
  return {
    ...result,
    message,
    state: next,
    summary: summarizeTurn(opened, next, acted.turnActionLines.join(' · '))
  };
}

/**
 * 턴 마감. 시장 반영은 `startTurn`으로 옮겨 갔으므로 여기서는 12턴 잔여 주문 강제 체결·잔여 환급·
 * 이력·상태만 정리한다.
 */
export function finalizeTurn(state: GameState): GameState {
  let next = state;
  if (state.turn === balanceConfig.maxTurns) {
    next = settleOrders({ ...next, pendingOrders: next.pendingOrders.map((order) => ({ ...order, settlesTurn: state.turn })) });
    if (next.pendingTaxCredit > 0) {
      const refund = next.pendingTaxCredit;
      next = {
        ...next,
        cash: next.cash + refund,
        pendingTaxCredit: 0,
        taxCreditRefunded: next.taxCreditRefunded + refund,
        logs: [...next.logs, { turn: state.turn, type: 'refund', message: `판 마감 · 미정산 세액공제 ${Math.round(refund).toLocaleString('ko-KR')}원 일괄 환급`, impact: Math.round(refund) }]
      };
    }
  }
  return {
    ...next,
    status: state.turn >= balanceConfig.maxTurns ? 'finished' : 'playing',
    awaitingAction: false,
    actionsLeft: 0,
    spotlightProductId: null,
    rebalanceBonusTurn: null,
    irpHistory: [...next.irpHistory, portfolioValue(next)],
    logs: [...next.logs, { turn: state.turn, type: 'settle', message: `${state.turn}턴 마감` }]
  };
}

export type AutoStrategy = 'balanced' | 'passive' | 'contributor' | 'growth' | 'steward' | 'etfOnly' | 'stopLoss' | 'momentum' | 'newsChaser';

export const AUTO_STRATEGIES: AutoStrategy[] = ['balanced', 'passive', 'contributor', 'growth', 'steward', 'etfOnly', 'stopLoss', 'momentum', 'newsChaser'];

/** 전략이 ETF를 살 수 있도록 성향을 맞춘다. 게이트(성향 밖 매수 거절)는 그대로 둔다. */
export function defaultProfileFor(strategy: AutoStrategy): ProfileId {
  if (strategy === 'growth') return 'growth';
  if (strategy === 'etfOnly' || strategy === 'stopLoss' || strategy === 'momentum' || strategy === 'newsChaser') return 'aggressive';
  return 'balanced';
}

function holdingOf(state: GameState, productId: ProductId): number {
  return state.holdings.find((holding) => holding.productId === productId)?.amount ?? 0;
}

export interface AutoplayOptions extends GameOptions {
  goalMonthly?: number;
}

/**
 * 자동 플레이. 시뮬·게이트·고스트가 쓴다. 기본은 고스트 없이(`ghost: false`) 돈다. 행동 2회 칸이 있어
 * 같은 턴에서 `awaitingAction`이 풀릴 때까지 전략 판단을 반복한다.
 */
export function autoplay(seed: string, strategy: AutoStrategy = 'balanced', profileId: ProfileId = defaultProfileFor(strategy), options: AutoplayOptions = {}): GameState {
  let state = createGame(seed, profileId, options.goalMonthly ?? balanceConfig.defaultGoal, { ghost: false, ...options });
  let stoppedOut = false;
  const decide = (): GameAction => {
    const etfReturn = state.lastMarket.returns.equityEtf;
    let action: GameAction;
    if (strategy === 'passive') action = { kind: 'hold' };
    else if (strategy === 'newsChaser') {
      // 속보의 이번 턴 ETF 수익률을 보고 오른 뒤 사고 내린 뒤 판다. 3.2 이전에는 최적해였다.
      if (etfReturn > 0.01) {
        action = holdingOf(state, 'deposit') >= 100000
          ? { kind: 'switch', fromProductId: 'deposit', toProductId: 'equityEtf', amount: holdingOf(state, 'deposit') }
          : state.irpCash >= 100000
            ? { kind: 'buy', productId: 'equityEtf', amount: state.irpCash }
            : state.cash > balanceConfig.contributionAmount ? { kind: 'contribute' } : { kind: 'hold' };
      } else if (etfReturn < -0.01 && holdingOf(state, 'equityEtf') >= 100000) {
        action = { kind: 'switch', fromProductId: 'equityEtf', toProductId: 'deposit', amount: holdingOf(state, 'equityEtf') };
      } else action = state.cash > balanceConfig.contributionAmount ? { kind: 'contribute' } : { kind: 'hold' };
    }
    else if (strategy === 'contributor') action = state.cash > balanceConfig.contributionAmount ? { kind: 'contribute' } : { kind: 'hold' };
    else if (strategy === 'growth') action = state.turn % 2 === 1
      ? { kind: 'contribute' }
      : { kind: 'buy', productId: 'equityEtf', amount: balanceConfig.contributionAmount };
    else if (strategy === 'etfOnly') action = state.turn === 1
      ? { kind: 'switch', fromProductId: 'deposit', toProductId: 'equityEtf', amount: holdingOf(state, 'deposit') }
      : state.turn % 2 === 0 && state.irpCash >= 100000
        ? { kind: 'buy', productId: 'equityEtf', amount: state.irpCash }
        : state.cash > balanceConfig.contributionAmount ? { kind: 'contribute' } : { kind: 'hold' };
    else if (strategy === 'stopLoss') {
      if (state.turn === 1) action = { kind: 'switch', fromProductId: 'deposit', toProductId: 'equityEtf', amount: holdingOf(state, 'deposit') };
      else if (!stoppedOut && etfReturn <= -0.05 && holdingOf(state, 'equityEtf') >= 100000) {
        stoppedOut = true;
        action = { kind: 'sell', productId: 'equityEtf', amount: holdingOf(state, 'equityEtf') };
      } else action = state.cash > balanceConfig.contributionAmount ? { kind: 'contribute' } : { kind: 'hold' };
    } else if (strategy === 'momentum') {
      if (etfReturn >= 0.02) action = state.irpCash >= 100000
        ? { kind: 'buy', productId: 'equityEtf', amount: state.irpCash }
        : { kind: 'contribute' };
      else if (etfReturn <= -0.02 && holdingOf(state, 'equityEtf') >= 200000) action = { kind: 'sell', productId: 'equityEtf', amount: holdingOf(state, 'equityEtf') / 2 };
      else action = { kind: 'hold' };
    } else if (strategy === 'steward') {
      const pension = portfolioValue(state) / policyRules.receivingMonths;
      action = pension < state.goalMonthly && state.cash > balanceConfig.safeCashThreshold + balanceConfig.contributionAmount
        ? { kind: 'contribute' }
        : state.turn >= 9
          ? { kind: 'rebalance' }
          : { kind: 'hold' };
    } else action = state.turn % 4 === 0 || state.turn >= 11
      ? { kind: 'rebalance' }
      : state.cash > balanceConfig.safeCashThreshold + balanceConfig.contributionAmount
        ? { kind: 'contribute' }
        : { kind: 'hold' };
    return action;
  };
  while (state.status === 'playing') {
    state = startTurn(state, diceStepsForTurn(state.seed, state.turn)).state;
    if (state.currentEventId) state = resolveLifeEvent(state, 'cash').state;
    while (state.status === 'playing' && state.awaitingAction) {
      const acted = performAction(state, decide());
      state = acted.ok ? acted.state : performAction(state, { kind: 'hold' }).state;
    }
  }
  return state;
}

export function contentCount(): number {
  return marketScenario.length + lifeEvents.length + learningCards.length;
}
