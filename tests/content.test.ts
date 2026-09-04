import { describe, expect, it } from 'vitest';
import { balanceConfig, marketScenario, marketShocks, products, validateContent } from '../src/data/content';

const productIds = new Set(products.map((product) => product.id));

describe('충격 카탈로그', () => {
  it('6종이고 id가 고유하다', () => {
    expect(marketShocks).toHaveLength(6);
    expect(new Set(marketShocks.map((shock) => shock.id)).size).toBe(6);
  });

  it('금리 계열과 주식 계열이 모두 있고 긍정 충격이 섞여 있다', () => {
    expect(marketShocks.some((shock) => shock.family === 'rate')).toBe(true);
    expect(marketShocks.some((shock) => shock.family === 'equity')).toBe(true);
    expect(marketShocks.filter((shock) => shock.positive).length).toBeGreaterThanOrEqual(2);
    expect(marketShocks.filter((shock) => !shock.positive).length).toBeGreaterThanOrEqual(3);
  });

  it('강제치 키는 상품 id이고 주가 충격 국면 이름은 그대로다', () => {
    for (const shock of marketShocks) {
      for (const key of Object.keys(shock.forceMax ?? {})) expect(productIds.has(key as never)).toBe(true);
      for (const key of Object.keys(shock.forceMin ?? {})) expect(productIds.has(key as never)).toBe(true);
      expect(shock.phase.length).toBeGreaterThan(0);
      expect(shock.alertStrong.length).toBeGreaterThan(0);
      expect(shock.alertHint.length).toBeGreaterThan(0);
    }
    expect(marketShocks.find((shock) => shock.id === 'equity-crash')?.phase).toBe('위험자산 충격');
  });
});

describe('시장 설정', () => {
  it('국면 4개와 전이 확률 합이 1 이하다', () => {
    const regimes = balanceConfig.market.regimes;
    expect(Object.keys(regimes).sort()).toEqual(['easing', 'hold', 'pivot', 'tightening']);
    for (const regime of Object.values(regimes)) {
      const total = Object.values(regime.transitions).reduce((sum, p) => sum + p, 0);
      expect(total).toBeLessThanOrEqual(1);
      expect(regime.moveChance).toBeGreaterThanOrEqual(0);
      expect(regime.moveChance).toBeLessThanOrEqual(1);
    }
  });

  it('금리 범위와 스텝이 퍼센트 단위다', () => {
    const market = balanceConfig.market;
    expect(market.rateMinPct).toBeLessThan(market.rateStartPct);
    expect(market.rateStartPct).toBeLessThan(market.rateMaxPct);
    expect(market.rateStepPct).toBe(0.25);
    expect(market.returnClamp).toBeGreaterThanOrEqual(0.15);
  });
});

describe('시장 템플릿', () => {
  it('12턴 모두 퍼센트 금리와 국면을 갖고 충격 턴은 카탈로그 id를 가리킨다', () => {
    expect(marketScenario).toHaveLength(12);
    const ids = new Set(marketShocks.map((shock) => shock.id));
    for (const step of marketScenario) {
      expect(Number.isFinite(step.ratePct)).toBe(true);
      expect(step.regime).toBeDefined();
      if (step.shock) expect(ids.has(step.shockId ?? '')).toBe(true);
    }
  });

  it('콘텐츠 검증이 통과한다', () => {
    expect(() => validateContent()).not.toThrow();
  });
});
