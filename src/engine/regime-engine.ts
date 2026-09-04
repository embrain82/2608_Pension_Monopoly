import type { MarketConfig, Regime, RegimeConfig } from '../types';
import { nextRandom } from './random-engine';

export interface MacroState {
  regime: Regime;
  ratePct: number;
  inflationPct: number;
  stockIndex: number;
}

export interface Rng {
  state: number;
  next(): number;
}

export function createRng(state: number): Rng {
  return {
    state,
    next() {
      const roll = nextRandom(this.state);
      this.state = roll.state;
      return roll.value;
    }
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function levelFromPct(pct: number, min: number, max: number): number {
  if (max <= min) return 1;
  return Math.round(clamp(1 + Math.round(((pct - min) / (max - min)) * 4), 1, 5));
}

export function levelFromIndex(index: number): number {
  if (index < 85) return 1;
  if (index < 95) return 2;
  if (index < 105) return 3;
  if (index < 115) return 4;
  return 5;
}

/** 두 균등 난수의 합: 중앙이 두껍고 꼬리가 얇은 삼각분포, 범위 ±amplitude. */
export function triangular(rng: Rng, amplitude: number): number {
  return (rng.next() + rng.next() - 1) * amplitude;
}

export function pickWeighted<T extends string>(rng: Rng, weights: Partial<Record<T, number>>, fallback: T): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  let roll = rng.next();
  for (const [key, weight] of entries) {
    if (roll < weight) return key;
    roll -= weight;
  }
  return fallback;
}

const START_REGIME_WEIGHTS: Partial<Record<Regime, number>> = { easing: 0.4, tightening: 0.4 };

export function initialMacro(config: MarketConfig, rng?: Rng): MacroState {
  return {
    regime: rng ? pickWeighted(rng, START_REGIME_WEIGHTS, 'hold') : 'hold',
    ratePct: config.rateStartPct,
    inflationPct: config.inflationStartPct,
    stockIndex: config.stockStartIndex
  };
}

export interface RegimeMove {
  rateDeltaPct: number;
  inflationDeltaPct: number;
  stockDrift: number;
}

/** 이번 턴 국면이 만드는 기본 움직임. 충격은 여기 위에 더해진다. */
export function regimeMove(rng: Rng, regime: RegimeConfig, config: MarketConfig): RegimeMove {
  let rateDeltaPct = 0;
  if (rng.next() < regime.moveChance) {
    const steps = rng.next() < regime.stepWeights[0] ? 1 : 2;
    const direction = regime.direction === 0 ? (rng.next() < 0.5 ? -1 : 1) : regime.direction;
    rateDeltaPct = direction * steps * config.rateStepPct;
  }
  return {
    rateDeltaPct,
    inflationDeltaPct: regime.inflationDrift + triangular(rng, 0.3),
    stockDrift: regime.stockDrift
  };
}

export function applyMacroMove(state: MacroState, move: { rateDeltaPct: number; inflationDeltaPct: number; stockReturn: number }, config: MarketConfig): MacroState {
  const ratePct = roundToStep(clamp(state.ratePct + move.rateDeltaPct, config.rateMinPct, config.rateMaxPct), config.rateStepPct);
  return {
    ...state,
    ratePct,
    inflationPct: clamp(state.inflationPct + move.inflationDeltaPct, config.inflationMinPct, config.inflationMaxPct),
    stockIndex: Math.max(20, state.stockIndex * (1 + move.stockReturn))
  };
}

export function nextRegime(rng: Rng, current: Regime, config: MarketConfig): Regime {
  return pickWeighted(rng, config.regimes[current].transitions, current);
}
