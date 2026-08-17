import { balanceConfig, policyRules, products } from '../data/content';
import type { GameState, MarketStep, ProductId } from '../types';
import { hashSeed, nextRandom } from './random-engine';
import { portfolioValue } from './portfolio-engine';
import { riskAssetRatio } from './policy-engine';

type ShockKind = 'rate-hike' | 'equity-drop';

const ZERO_RETURNS: Record<ProductId, number> = {
  deposit: 0,
  shortBond: 0,
  longBond: 0,
  balanced: 0,
  equityEtf: 0,
  tdf: 0
};

const SHOCK_TURNS = [3, 4, 5, 6, 7, 8, 9, 10];

export function emptyMarketStep(): MarketStep {
  return {
    turn: 0,
    phase: '시작 전',
    headline: '아직 시장이 공개되지 않았습니다',
    signal: '주사위 대기',
    reason: '주사위를 굴리면 이번 판의 시장 경로가 한 턴씩 공개됩니다.',
    rate: 0,
    inflation: 0,
    stocks: 0,
    returns: { ...ZERO_RETURNS }
  };
}

export function rateShockReturn(productId: ProductId, rateStepChange: number): number {
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error(`알 수 없는 상품: ${productId}`);
  return -0.01 * product.duration * rateStepChange;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampLevel(value: number): number {
  return Math.round(clamp(value, 1, 5));
}

function clampReturn(value: number): number {
  return clamp(value, -0.15, 0.15);
}

function pickShockPlan(rngState: number): { rngState: number; kinds: Map<number, ShockKind> } {
  const chosen: number[] = [];
  let state = rngState;
  while (chosen.length < 2) {
    const roll = nextRandom(state);
    state = roll.state;
    const turn = SHOCK_TURNS[Math.floor(roll.value * SHOCK_TURNS.length)];
    if (!chosen.includes(turn)) chosen.push(turn);
  }
  chosen.sort((left, right) => left - right);
  const flip = nextRandom(state);
  const kinds = new Map<number, ShockKind>(
    flip.value < 0.5
      ? [[chosen[0], 'rate-hike'], [chosen[1], 'equity-drop']]
      : [[chosen[0], 'equity-drop'], [chosen[1], 'rate-hike']]
  );
  return { rngState: flip.state, kinds };
}

function briefingFor(
  kind: ShockKind | undefined,
  rateChange: number,
  stockChange: number
): Pick<MarketStep, 'phase' | 'headline' | 'signal' | 'reason'> {
  if (kind === 'rate-hike' || (rateChange > 0 && Math.abs(rateChange) >= Math.abs(stockChange))) {
    return {
      phase: kind ? '기준금리 인상' : '물가상승',
      headline: kind ? '기준금리 인상이 한 번에 크게 반영됩니다' : '물가와 금리 상승 압력이 커집니다',
      signal: '신규 예금 ↗ · 장기채 ↘',
      reason: '금리가 오르면 새로 드는 예금 조건은 나아지지만, 만기가 긴 채권 가격은 더 크게 떨어질 수 있습니다.'
    };
  }
  if (kind === 'equity-drop' || stockChange < 0) {
    return {
      phase: kind ? '기준금리 인상' : '경기둔화·전환 기대',
      headline: kind ? '긴축과 변동성이 위험자산을 흔듭니다' : '위험자산이 숨을 고릅니다',
      signal: '금리 → · 주식 ↘',
      reason: '높은 금리와 불확실성이 겹치면 주식형 자산이 채권보다 크게 흔들릴 수 있습니다.'
    };
  }
  if (rateChange < 0) {
    return {
      phase: '경기둔화·전환 기대',
      headline: '금리 인하 기대가 채권을 받칩니다',
      signal: '금리 ↘ · 장기채 ↗',
      reason: '앞으로 금리가 낮아질 것이라는 기대는 만기 긴 채권 가격에 더 크게 반영됩니다.'
    };
  }
  if (stockChange > 0) {
    return {
      phase: '저금리·경기회복',
      headline: '위험자산이 회복 기대를 반영합니다',
      signal: '주식 ↗ · 금리 →',
      reason: '낮은 조달비용과 회복 기대가 주식형 자산에 힘을 보탭니다.'
    };
  }
  return {
    phase: '경기둔화·전환 기대',
    headline: '방향이 뚜렷하지 않아 분산을 점검할 때입니다',
    signal: '금리 → · 주식 →',
    reason: '한 방향을 예측하기보다 목표 위험비중을 점검할 시점입니다.'
  };
}

export function generateMarketPath(seed: string): MarketStep[] {
  let rngState = hashSeed(`${seed}:market`);
  const plan = pickShockPlan(rngState);
  rngState = plan.rngState;
  let rate = 2;
  let inflation = 2;
  let stocks = 3;
  const path: MarketStep[] = [];

  for (let turn = 1; turn <= balanceConfig.maxTurns; turn += 1) {
    const kind = plan.kinds.get(turn);
    const prevRate = rate;
    const prevStocks = stocks;
    if (kind === 'rate-hike') {
      rate = clampLevel(rate + 1);
      inflation = clampLevel(inflation + 1);
      stocks = clampLevel(stocks - 1);
    } else if (kind === 'equity-drop') {
      stocks = clampLevel(stocks - 2);
      inflation = clampLevel(inflation);
    } else {
      const rateRoll = nextRandom(rngState);
      const infRoll = nextRandom(rateRoll.state);
      const stockRoll = nextRandom(infRoll.state);
      rngState = stockRoll.state;
      rate = clampLevel(rate + (rateRoll.value - 0.48) * 1.1);
      inflation = clampLevel(inflation + (infRoll.value - 0.5) * 0.9);
      stocks = clampLevel(stocks + (stockRoll.value - 0.5) * 1.2);
    }
    const rateChange = rate - prevRate;
    const stockChange = stocks - prevStocks;
    const noise = (): number => {
      const roll = nextRandom(rngState);
      rngState = roll.state;
      return (roll.value - 0.5) * 0.006;
    };
    let deposit = 0.003 + rate * 0.002 + noise();
    let shortBond = rateShockReturn('shortBond', rateChange) + 0.004 + noise();
    let longBond = rateShockReturn('longBond', rateChange) + 0.006 + noise();
    let equityEtf = 0.012 * stockChange + (stocks - 3) * 0.01 + noise();
    if (kind === 'rate-hike') {
      longBond = Math.min(longBond, -0.08);
      shortBond = Math.min(shortBond, -0.012);
      deposit = Math.max(deposit, 0.01);
    } else if (kind === 'equity-drop') {
      equityEtf = Math.min(equityEtf, -0.07);
    }
    deposit = clampReturn(deposit);
    shortBond = clampReturn(shortBond);
    longBond = clampReturn(longBond);
    equityEtf = clampReturn(equityEtf);
    const balanced = clampReturn(0.25 * shortBond + 0.25 * longBond + 0.5 * equityEtf);
    const tdf = clampReturn(0.2 * shortBond + 0.2 * longBond + 0.45 * equityEtf + 0.15 * deposit);
    const briefing = briefingFor(kind, rateChange, stockChange);
    path.push({
      turn,
      ...briefing,
      rate,
      inflation,
      stocks,
      returns: { deposit, shortBond, longBond, balanced, equityEtf, tdf },
      ...(kind ? { shock: true } : {})
    });
  }
  return path;
}

export function marketPathOf(state: Pick<GameState, 'seed' | 'marketPath'>): MarketStep[] {
  return state.marketPath?.length === balanceConfig.maxTurns ? state.marketPath : generateMarketPath(state.seed);
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
