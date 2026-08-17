import { balanceConfig, marketScenario, policyRules, products } from '../data/content';
import type { GameState, MarketStep, ProductId } from '../types';
import { hashSeed, nextRandom } from './random-engine';
import { portfolioValue } from './portfolio-engine';
import { riskAssetRatio } from './policy-engine';

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

function arrow(delta: number): string {
  if (delta > 0) return '↗';
  if (delta < 0) return '↘';
  return '→';
}

function classifyPhase(rate: number, inflation: number, stocks: number): string {
  if (rate <= 2 && stocks >= 3) return '저금리·경기회복';
  if (rate >= 4 && stocks <= 3) return '기준금리 인상';
  if (inflation >= 4 || (rate >= 3 && inflation >= 3)) return '물가상승';
  return '경기둔화·전환 기대';
}

function pickShockTurns(rngState: number): { rngState: number; turns: number[] } {
  const chosen: number[] = [];
  let state = rngState;
  while (chosen.length < 2) {
    const roll = nextRandom(state);
    state = roll.state;
    const turn = SHOCK_TURNS[Math.floor(roll.value * SHOCK_TURNS.length)];
    if (!chosen.includes(turn)) chosen.push(turn);
  }
  chosen.sort((left, right) => left - right);
  return { rngState: state, turns: chosen };
}

function pickTemplate(rngState: number, phase: string, shock: boolean): { rngState: number; template: MarketStep } {
  const matched = marketScenario.filter((step) => step.phase === phase && Boolean(step.shock) === shock);
  const fallback = marketScenario.filter((step) => Boolean(step.shock) === shock);
  const pool = matched.length ? matched : fallback;
  const roll = nextRandom(rngState);
  return { rngState: roll.state, template: pool[Math.floor(roll.value * pool.length)] };
}

export function generateMarketPath(seed: string): MarketStep[] {
  let rngState = hashSeed(`${seed}:market`);
  const picked = pickShockTurns(rngState);
  rngState = picked.rngState;
  const shockSet = new Set(picked.turns);
  let rate = 2;
  let inflation = 2;
  let stocks = 3;
  const path: MarketStep[] = [];

  for (let turn = 1; turn <= balanceConfig.maxTurns; turn += 1) {
    const shock = shockSet.has(turn);
    const prevRate = rate;
    const prevStocks = stocks;
    const rateRoll = nextRandom(rngState);
    const infRoll = nextRandom(rateRoll.state);
    const stockRoll = nextRandom(infRoll.state);
    rngState = stockRoll.state;
    rate = clampLevel(rate + (rateRoll.value - 0.45) * (shock ? 2.2 : 1.1));
    inflation = clampLevel(inflation + (infRoll.value - 0.48) * (shock ? 1.6 : 0.9));
    stocks = clampLevel(stocks + (stockRoll.value - 0.5) * (shock ? 2.4 : 1.2));
    const rateChange = rate - prevRate;
    const stockChange = stocks - prevStocks;
    const noise = (): number => {
      const roll = nextRandom(rngState);
      rngState = roll.state;
      return (roll.value - 0.5) * 0.008;
    };
    let deposit = 0.003 + rate * 0.002 + noise();
    let shortBond = rateShockReturn('shortBond', rateChange) + 0.004 + noise();
    let longBond = rateShockReturn('longBond', rateChange) + 0.006 + noise();
    let equityEtf = 0.01 * stockChange + (stocks - 3) * 0.012 + noise();
    if (shock) {
      if (rateChange > 0) {
        longBond -= 0.04;
        shortBond -= 0.01;
      } else if (rateChange < 0) {
        longBond += 0.04;
        shortBond += 0.01;
      }
      if (stockChange < 0) equityEtf -= 0.05;
      else if (stockChange > 0) equityEtf += 0.04;
      else equityEtf -= 0.03;
    }
    deposit = clampReturn(deposit);
    shortBond = clampReturn(shortBond);
    longBond = clampReturn(longBond);
    equityEtf = clampReturn(equityEtf);
    const balanced = clampReturn(0.25 * shortBond + 0.25 * longBond + 0.5 * equityEtf);
    const tdf = clampReturn(0.2 * shortBond + 0.2 * longBond + 0.45 * equityEtf + 0.15 * deposit);
    const phase = classifyPhase(rate, inflation, stocks);
    const template = pickTemplate(rngState, phase, shock);
    rngState = template.rngState;
    path.push({
      turn,
      phase,
      headline: template.template.headline,
      signal: `금리 ${arrow(rateChange)} · 주식 ${arrow(stockChange)}`,
      reason: template.template.reason,
      rate,
      inflation,
      stocks,
      returns: { deposit, shortBond, longBond, balanced, equityEtf, tdf },
      ...(shock ? { shock: true } : {})
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
