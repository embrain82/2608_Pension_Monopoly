import { balanceConfig, learningCards, lifeEvents, marketScenario, policyRules, products } from '../data/content';
import type { ActionKind, ActionResult, GameState, ProfileId, ProductId } from '../types';
import { applyMarketStep, emptyMarketStep, generateMarketPath, marketPathOf } from './market-engine';
import { pickTileBriefing } from './tile-briefing';
import { buyProduct, portfolioValue, rebalancePortfolio, sellProduct, settleOrders, switchProduct } from './portfolio-engine';
import { contributionCredit } from './policy-engine';
import { diceStepsForTurn, hashSeed, nextRandom } from './random-engine';

export interface GameAction {
  kind: ActionKind;
  productId?: ProductId;
  fromProductId?: ProductId;
  toProductId?: ProductId;
  amount?: number;
}

export type AmountPreset = 'default' | 'half' | 'max';

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

export function createGame(seed: string, profileId: ProfileId = 'balanced', goalMonthly = balanceConfig.defaultGoal): GameState {
  const scheduled = scheduleLifeEvents(hashSeed(seed));
  const marketPath = generateMarketPath(seed);
  const market = emptyMarketStep();
  return {
    seed,
    rngState: scheduled.rngState,
    status: 'playing',
    turn: 0,
    position: 0,
    phase: market.phase,
    goalMonthly: Math.min(balanceConfig.maxGoal, Math.max(balanceConfig.minGoal, goalMonthly)),
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
    lifeEventSchedule: scheduled.schedule
  };
}

function unlock(state: GameState, cardId: string): GameState {
  return state.unlockedCards.includes(cardId) ? state : { ...state, unlockedCards: [...state.unlockedCards, cardId] };
}

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
  const position = ((state.position + Math.max(0, steps)) % boardSize + boardSize) % boardSize;
  let next: GameState = {
    ...state,
    turn,
    position,
    phase: market.phase,
    lastMarket: market,
    marketPath: path,
    cash: state.cash + balanceConfig.salarySurplusPerTurn,
    logs: [...state.logs, { turn, type: 'market', message: `${market.headline} · ${market.signal}` }],
    awaitingAction: !scheduled,
    currentEventId: scheduled?.eventId ?? null
  };
  next = unlock(next, cardForTurn(turn, path));
  next = unlock(next, pickTileBriefing(state.seed, turn, position).cardId);
  if (scheduled) {
    next = { ...next, eventHistory: [...next.eventHistory, scheduled.eventId] };
    return { ok: true, message: '생활사건이 발생했습니다.', state: next };
  }
  return { ok: true, message: `${turn}턴 시장을 확인하세요.`, state: next };
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
    const shortage = state.cash < event.cost;
    next = { ...state, cash: Math.max(0, state.cash - event.cost), cashShortages: state.cashShortages + (shortage ? 1 : 0), safeActionCount: state.safeActionCount + (shortage ? 0 : 1) };
    message = shortage ? '생활자금이 부족해 비용과 안정성 점수에 영향이 생겼습니다.' : '생활자금으로 해결해 IRP를 지켰습니다.';
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
    cash: state.cash - accepted + credit.benefit,
    irpCash: state.irpCash + accepted,
    contributionTotal: state.contributionTotal + accepted,
    taxCreditEligible: state.taxCreditEligible + credit.eligible,
    taxCreditBenefit: state.taxCreditBenefit + credit.benefit,
    understandingPoints: state.understandingPoints + 1
  }, 'contribution-limit');
  return { ok: true, message: `${accepted.toLocaleString('ko-KR')}원 추가납입, 세액공제 효과 ${Math.round(credit.benefit).toLocaleString('ko-KR')}원(교육용)을 생활자금에 반영했습니다.`, state: next };
}

export function performAction(state: GameState, action: GameAction): ActionResult {
  if (!state.awaitingAction || state.currentEventId) {
    return { ok: false, message: '먼저 이번 턴 시장을 확인하고 생활사건을 해결하세요.', state };
  }
  let result: ActionResult;
  switch (action.kind) {
    case 'contribute': result = contribute(state, action.amount ?? balanceConfig.contributionAmount); break;
    case 'buy': result = action.productId ? buyProduct(state, action.productId, action.amount) : { ok: false, message: '매수 상품을 선택하세요.', state }; break;
    case 'sell': result = action.productId ? sellProduct(state, action.productId, action.amount) : { ok: false, message: '매도 상품을 선택하세요.', state }; break;
    case 'switch': result = action.fromProductId && action.toProductId ? switchProduct(state, action.fromProductId, action.toProductId, action.amount) : { ok: false, message: '교체할 두 상품을 선택하세요.', state }; break;
    case 'rebalance': result = rebalancePortfolio(state); break;
    case 'hold': result = { ok: true, message: '이번 턴은 행동하지 않고 현재 구성을 유지했습니다.', state: { ...state, safeActionCount: state.safeActionCount + 1 } }; break;
  }
  if (!result.ok) return result;
  return { ...result, state: finalizeTurn({ ...result.state, logs: [...result.state.logs, { turn: state.turn, type: 'action', message: result.message }] }) };
}

export function finalizeTurn(state: GameState): GameState {
  let next = applyMarketStep(state, marketPathOf(state)[state.turn - 1] ?? emptyMarketStep());
  if (state.turn === balanceConfig.maxTurns) {
    next = { ...next, pendingOrders: next.pendingOrders.map((order) => ({ ...order, settlesTurn: state.turn })) };
  }
  next = settleOrders(next);
  return {
    ...next,
    status: state.turn >= balanceConfig.maxTurns ? 'finished' : 'playing',
    awaitingAction: false,
    logs: [...next.logs, { turn: state.turn, type: 'settle', message: `${state.turn}턴 기준가·이자·비용 반영 완료` }]
  };
}

export type AutoStrategy = 'balanced' | 'passive' | 'contributor' | 'growth';

export function autoplay(seed: string, strategy: AutoStrategy = 'balanced'): GameState {
  let state = createGame(seed);
  while (state.status === 'playing') {
    state = startTurn(state, diceStepsForTurn(state.seed, state.turn)).state;
    if (state.currentEventId) state = resolveLifeEvent(state, 'cash').state;
    let action: GameAction;
    if (strategy === 'passive') action = { kind: 'hold' };
    else if (strategy === 'contributor') action = state.cash > balanceConfig.contributionAmount ? { kind: 'contribute' } : { kind: 'hold' };
    else if (strategy === 'growth') action = state.turn % 2 === 1
      ? { kind: 'contribute' }
      : { kind: 'buy', productId: 'equityEtf', amount: balanceConfig.contributionAmount };
    else action = state.turn % 4 === 0 || state.turn >= 11
      ? { kind: 'rebalance' }
      : state.cash > balanceConfig.safeCashThreshold + balanceConfig.contributionAmount
        ? { kind: 'contribute' }
        : { kind: 'hold' };
    const acted = performAction(state, action);
    state = acted.ok ? acted.state : performAction(state, { kind: 'hold' }).state;
  }
  return state;
}

export function contentCount(): number {
  return marketScenario.length + lifeEvents.length + learningCards.length;
}
