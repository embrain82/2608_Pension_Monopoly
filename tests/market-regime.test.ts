import { describe, expect, it } from 'vitest';
import { balanceConfig, marketShocks, products } from '../src/data/content';
import { generateMarketPath, rateShockReturn } from '../src/engine/market-engine';
import { levelFromIndex, levelFromPct } from '../src/engine/regime-engine';

const market = balanceConfig.market;
const productIds = products.map((product) => product.id);
const paths = Array.from({ length: 200 }, (_, index) => generateMarketPath(`regime-${index}`));

function nearlyMultiple(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

describe('금리 국면 경로', () => {
  it('같은 시드는 같은 경로를 만들고 12턴을 채운다', () => {
    expect(generateMarketPath('same')).toEqual(generateMarketPath('same'));
    expect(paths[0]).toHaveLength(balanceConfig.maxTurns);
    expect(paths[0].map((step) => step.turn)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('금리는 퍼센트 범위와 0.25 스텝을 지키고 레벨 1~5를 파생한다', () => {
    for (const path of paths) {
      let prev = market.rateStartPct;
      for (const step of path) {
        expect(step.ratePct).toBeGreaterThanOrEqual(market.rateMinPct);
        expect(step.ratePct).toBeLessThanOrEqual(market.rateMaxPct);
        expect(nearlyMultiple(step.ratePct, market.rateStepPct)).toBe(true);
        expect(step.rateDeltaPct).toBeCloseTo(step.ratePct - prev, 6);
        prev = step.ratePct;
        expect(step.rate).toBe(levelFromPct(step.ratePct, market.rateMinPct, market.rateMaxPct));
        expect(step.stocks).toBe(levelFromIndex(step.stockIndex));
        for (const level of [step.rate, step.inflation, step.stocks]) {
          expect(level).toBeGreaterThanOrEqual(1);
          expect(level).toBeLessThanOrEqual(5);
        }
        expect(['easing', 'hold', 'tightening', 'pivot']).toContain(step.regime);
      }
    }
  });

  it('금리가 움직이는 턴이 절반 가까이 되고 빅스텝이 판마다 한 번은 온다', () => {
    let moved = 0;
    let total = 0;
    let gamesWithBigStep = 0;
    let rangeSum = 0;
    for (const path of paths) {
      let big = false;
      let min = Infinity;
      let max = -Infinity;
      for (const step of path) {
        total += 1;
        if (Math.abs(step.rateDeltaPct) > 1e-9) moved += 1;
        if (Math.abs(step.rateDeltaPct) >= 0.75 - 1e-9) big = true;
        min = Math.min(min, step.ratePct);
        max = Math.max(max, step.ratePct);
      }
      if (big) gamesWithBigStep += 1;
      rangeSum += max - min;
    }
    expect(moved / total).toBeGreaterThanOrEqual(0.5);
    expect(gamesWithBigStep / paths.length).toBeGreaterThanOrEqual(0.6);
    expect(rangeSum / paths.length).toBeGreaterThanOrEqual(1.6);
  });

  it('충격은 2~3회, 4~11턴, 슬롯 규칙을 따르고 카탈로그와 일치한다', () => {
    const catalog = new Map(marketShocks.map((shock) => [shock.id, shock]));
    let three = 0;
    for (const path of paths) {
      const shocks = path.filter((step) => step.shock);
      expect(shocks.length).toBeGreaterThanOrEqual(2);
      expect(shocks.length).toBeLessThanOrEqual(3);
      if (shocks.length === 3) three += 1;
      expect(shocks[0].turn).toBeGreaterThanOrEqual(4);
      expect(shocks[0].turn).toBeLessThanOrEqual(6);
      expect(shocks[1].turn).toBeGreaterThanOrEqual(7);
      expect(shocks[1].turn).toBeLessThanOrEqual(9);
      if (shocks[2]) {
        expect(shocks[2].turn).toBeGreaterThanOrEqual(10);
        expect(shocks[2].turn).toBeLessThanOrEqual(11);
      }
      expect(path[11].shock).toBeFalsy();
      const families = new Set(shocks.slice(0, 2).map((step) => catalog.get(step.shockId ?? '')?.family));
      expect(families).toEqual(new Set(['rate', 'equity']));
      for (const step of shocks) {
        const shock = catalog.get(step.shockId ?? '');
        expect(shock).toBeDefined();
        expect(step.phase).toBe(shock!.phase);
        for (const [productId, cap] of Object.entries(shock!.forceMax ?? {})) {
          expect(step.returns[productId as never]).toBeLessThanOrEqual(cap! + 1e-9);
        }
        for (const [productId, floor] of Object.entries(shock!.forceMin ?? {})) {
          expect(step.returns[productId as never]).toBeGreaterThanOrEqual(floor! - 1e-9);
        }
      }
    }
    expect(three).toBeGreaterThan(20);
    expect(three).toBeLessThan(100);
  });

  it('충격이 없는 턴은 국면 이름을 쓰고 헤드라인이 비어 있지 않다', () => {
    for (const path of paths) {
      for (const step of path) {
        expect(step.headline.length).toBeGreaterThan(0);
        expect(step.signal.length).toBeGreaterThan(0);
        expect(step.reason.length).toBeGreaterThan(0);
        if (!step.shock) expect(step.phase).toBe(market.regimes[step.regime].phase);
      }
    }
  });

  it('모든 수익률은 유한하고 클램프 안이다', () => {
    for (const path of paths) {
      for (const step of path) {
        for (const productId of productIds) {
          const value = step.returns[productId];
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(-market.returnClamp);
          expect(value).toBeLessThanOrEqual(market.returnClamp);
        }
      }
    }
  });

  it('ETF는 기대수익이 양수이면서 크게 흔들린다', () => {
    const etf: number[] = [];
    const deposit: number[] = [];
    for (let index = 0; index < 500; index += 1) {
      for (const step of generateMarketPath(`etf-stats-${index}`)) {
        etf.push(step.returns.equityEtf);
        deposit.push(step.returns.deposit);
      }
    }
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const etfMean = mean(etf);
    const depositMean = mean(deposit);
    const sd = Math.sqrt(mean(etf.map((value) => (value - etfMean) ** 2)));
    expect(etfMean).toBeGreaterThanOrEqual(0.006);
    expect(etfMean).toBeLessThanOrEqual(0.014);
    expect(etfMean).toBeGreaterThan(depositMean);
    expect(sd).toBeGreaterThanOrEqual(0.035);
  });

  it('충격 직전 턴에 신호가 붙고 12턴에는 신호가 없다', () => {
    const catalog = new Map(marketShocks.map((shock) => [shock.id, shock]));
    let strong = 0;
    let beforeShock = 0;
    let fake = 0;
    let quiet = 0;
    for (const path of paths) {
      expect(path[11].alert).toBeUndefined();
      for (const step of path) {
        const next = path[step.turn];
        if (next?.shock) {
          beforeShock += 1;
          expect(step.alert).toBeDefined();
          expect(step.alert!.hint.length).toBeGreaterThan(0);
          if (step.alert!.level === 2) {
            strong += 1;
            expect(step.alert!.text).toBe(catalog.get(next.shockId ?? '')!.alertStrong);
            expect(step.alert!.hint).toBe(catalog.get(next.shockId ?? '')!.alertHint);
          }
        } else if (step.turn < 12) {
          quiet += 1;
          if (step.alert) {
            fake += 1;
            expect(step.alert.level).toBe(1);
          }
        }
      }
    }
    expect(strong / beforeShock).toBeGreaterThanOrEqual(0.6);
    expect(strong / beforeShock).toBeLessThanOrEqual(0.95);
    expect(fake / quiet).toBeGreaterThanOrEqual(0.05);
    expect(fake / quiet).toBeLessThanOrEqual(0.3);
  });

  it('금리 상승 시 장기채가 단기채보다 크게 내린다', () => {
    expect(rateShockReturn('longBond', 1)).toBeLessThan(rateShockReturn('shortBond', 1));
    expect(rateShockReturn('longBond', 1)).toBeCloseTo(-3 * market.bondSensitivityPerPct, 9);
  });
});
