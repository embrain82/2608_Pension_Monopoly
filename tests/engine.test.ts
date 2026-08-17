import { describe, expect, it } from 'vitest';
import { balanceConfig, lifeEvents, marketScenario, policyRules } from '../src/data/content';
import { autoplay, createGame, performAction, resolveActionAmount, resolveLifeEvent, startTurn } from '../src/engine/game-engine';
import { applyMarketStep, generateMarketPath, rateShockReturn } from '../src/engine/market-engine';
import { buyProduct, portfolioValue, rebalancePortfolio, sellProduct } from '../src/engine/portfolio-engine';
import { canBuyRiskAsset, contributionCredit, effectiveRiskRatio, riskAssetRatio } from '../src/engine/policy-engine';
import { calculateScore, monthlyPension } from '../src/engine/scoring-engine';
import { defaultSave, loadSave, STORAGE_KEY } from '../src/ui/ui-state';

describe('재현 가능한 게임', () => {
  it('동일 시드는 동일한 결과를 만든다', () => {
    const a = autoplay('same-seed');
    const b = autoplay('same-seed');
    expect(a.lifeEventSchedule).toEqual(b.lifeEventSchedule);
    expect(a.eventHistory).toEqual(b.eventHistory);
    expect(portfolioValue(a)).toBeCloseTo(portfolioValue(b), 6);
  });

  it('12턴 후 반드시 종료한다', () => {
    const state = autoplay('finish');
    expect(state.turn).toBe(12);
    expect(state.status).toBe('finished');
  });
});

describe('시장 우선 턴 루프', () => {
  it('주사위 없이 턴을 시작하고 이번 턴 수익률을 미리 보여 준다', () => {
    const started = startTurn(createGame('loop'));
    expect(started.ok).toBe(true);
    expect(started.state.turn).toBe(1);
    expect(started.state.awaitingAction || Boolean(started.state.currentEventId)).toBe(true);
    expect(started.state.lastMarket.turn).toBe(1);
    expect(started.state.lastMarket.returns.equityEtf).toBeDefined();
  });

  it('말은 주사위 칸 수만큼 이동하고 턴 번호와 분리된다', () => {
    const started = startTurn(createGame('token-steps'), 7);
    expect(started.state.turn).toBe(1);
    expect(started.state.position).toBe(7);
    const second = startTurn(
      { ...started.state, awaitingAction: false, currentEventId: null },
      6
    );
    if (second.ok) expect(second.state.position).toBe(13);
  });

  it('한 판에 생활사건을 시드당 3회만 넣는다', () => {
    const created = createGame('life-three');
    expect(created.lifeEventSchedule).toHaveLength(3);
    const turns = created.lifeEventSchedule.map((item) => item.turn);
    expect(new Set(turns).size).toBe(3);
    expect(turns.every((turn) => turn >= 2 && turn <= 11)).toBe(true);

    let state = created;
    let events = 0;
    while (state.status === 'playing') {
      state = startTurn(state).state;
      if (state.currentEventId) {
        events += 1;
        state = resolveLifeEvent(state, 'cash').state;
      }
      const acted = performAction(state, { kind: 'hold' });
      state = acted.ok ? acted.state : performAction(state, { kind: 'hold' }).state;
    }
    expect(events).toBe(3);
  });

  it('학습 카드는 턴을 막지 않고 해금만 한다', () => {
    const started = startTurn(createGame('cards'));
    expect(started.state.unlockedCards.length).toBeGreaterThan(0);
    if (!started.state.currentEventId) {
      expect(started.state.awaitingAction).toBe(true);
      expect(performAction(started.state, { kind: 'hold' }).ok).toBe(true);
    }
  });

  it('금액 프리셋은 기본·절반·가능액을 계산한다', () => {
    const state = { ...createGame('amount'), irpCash: 8_000_000 };
    expect(resolveActionAmount(state, 'buy', 'default')).toBe(balanceConfig.tradeAmount);
    expect(resolveActionAmount(state, 'buy', 'half')).toBe(4_000_000);
    expect(resolveActionAmount(state, 'buy', 'max')).toBe(8_000_000);
  });
});

describe('정책과 주문', () => {
  it('위험자산 한도 초과 매수를 차단한다', () => {
    const state = { ...createGame('risk'), irpCash: 200_000_000 };
    const result = canBuyRiskAsset(state, 'equityEtf', 200_000_000);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('한도');
  });

  it('시장 상승의 사후 한도 초과는 즉시 규칙 위반이 아니다', () => {
    const base = createGame('market-limit');
    const state = { ...base, holdings: [
      { productId: 'deposit' as const, amount: 30_000_000, principal: 30_000_000, depositTurnsHeld: 0 },
      { productId: 'equityEtf' as const, amount: 70_000_000, principal: 70_000_000, depositTurnsHeld: 0 }
    ] };
    const market = { ...state.lastMarket, returns: { ...state.lastMarket.returns, deposit: 0, equityEtf: 0.5 } };
    const moved = applyMarketStep(state, market);
    expect(moved.marketLimitExceeded).toBe(true);
    expect(moved.ruleBreaches).toBe(0);
    expect(canBuyRiskAsset(moved, 'equityEtf', 1_000_000).ok).toBe(false);
  });

  it('TDF 예외 속성을 유효 위험비율에 반영한다', () => {
    expect(effectiveRiskRatio('tdf')).toBe(policyRules.tdfAdjustedRiskRatio);
    expect(effectiveRiskRatio('tdf')).toBeLessThan(0.8);
  });

  it('납입 한도와 세액공제 대상 한도를 분리한다', () => {
    expect(policyRules.annualContributionLimit).toBeGreaterThan(policyRules.annualTaxCreditLimit);
    const result = contributionCredit(policyRules.annualTaxCreditLimit, 1_000_000);
    expect(result.eligible).toBe(0);
    expect(result.benefit).toBe(0);
  });

  it('펀드는 주문 대기, ETF는 즉시 체결한다', () => {
    const state = { ...createGame('orders'), irpCash: 20_000_000 };
    const fund = buyProduct(state, 'longBond', 5_000_000);
    const etf = buyProduct(state, 'equityEtf', 5_000_000);
    expect(fund.state.pendingOrders).toHaveLength(1);
    expect(fund.state.holdings.some((item) => item.productId === 'longBond')).toBe(false);
    expect(etf.state.pendingOrders).toHaveLength(0);
    expect(etf.state.holdings.find((item) => item.productId === 'equityEtf')?.amount).toBe(5_000_000);
    expect(portfolioValue(fund.state)).toBeCloseTo(portfolioValue(state), 2);
  });

  it('예금 중도해지 불이익을 반영한다', () => {
    const state = createGame('deposit');
    const sold = sellProduct(state, 'deposit', 8_000_000);
    expect(sold.ok).toBe(true);
    expect(sold.state.irpCash).toBeLessThan(8_000_000);
    expect(sold.message).toContain('불이익');
  });
});

describe('시장, 리밸런싱, 생활사건', () => {
  it('금리 상승 시 장기채가 단기채보다 민감하다', () => {
    expect(rateShockReturn('longBond', 1)).toBeLessThan(rateShockReturn('shortBond', 1));
  });

  it('리밸런싱 후 목표 위험비중에 접근한다', () => {
    const result = rebalancePortfolio(createGame('rebalance'));
    const targetRisk = 0.25 * 0.5 + 0.1 + 0.1 * policyRules.tdfAdjustedRiskRatio;
    expect(riskAssetRatio(result.state)).toBeCloseTo(targetRisk, 5);
  });

  it('중도인출 가능·불가능 사건을 구분한다', () => {
    const allowed = lifeEvents.find((event) => event.eligibleWithdrawal)!;
    const blocked = lifeEvents.find((event) => !event.eligibleWithdrawal && event.cost > 0)!;
    const a = resolveLifeEvent({ ...createGame('a'), turn: 1, currentEventId: allowed.id }, 'withdraw');
    const b = resolveLifeEvent({ ...createGame('b'), turn: 1, currentEventId: blocked.id }, 'withdraw');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
  });
});

describe('점수와 저장 복구', () => {
  it('월 연금과 별 등급을 정확히 계산한다', () => {
    expect(monthlyPension(120_000_000)).toBe(500_000);
    const base = autoplay('stars');
    const strong = { ...base, cash: 10_000_000, maxDrawdown: 0.05, ruleBreaches: 0, profileId: 'balanced' as const,
      holdings: [
        { productId: 'deposit' as const, amount: 50_000_000, principal: 50_000_000, depositTurnsHeld: 4 },
        { productId: 'shortBond' as const, amount: 30_000_000, principal: 30_000_000, depositTurnsHeld: 0 },
        { productId: 'equityEtf' as const, amount: 50_000_000, principal: 50_000_000, depositTurnsHeld: 0 }
      ], irpCash: 0, goalMonthly: 500_000 };
    expect(calculateScore(strong).stars).toBe(3);
  });

  it('점수는 유효 범위이고 NaN이 아니다', () => {
    for (let i = 0; i < 50; i += 1) {
      const score = calculateScore(autoplay(`score-${i}`));
      expect(Number.isFinite(score.totalScore)).toBe(true);
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(100);
    }
  });

  it('LocalStorage 데이터가 없거나 손상되어도 복구한다', () => {
    const missing = { getItem: () => null };
    const broken = { getItem: (key: string) => key === STORAGE_KEY ? '{oops' : null };
    expect(loadSave(missing)).toEqual(defaultSave);
    expect(loadSave(broken)).toEqual(defaultSave);
  });

  it('모든 기본 행동이 실제 상태를 바꾼다', () => {
    let state = startTurn(createGame('actions')).state;
    if (state.currentEventId) state = resolveLifeEvent(state, 'cash').state;
    const result = performAction(state, { kind: 'contribute', amount: balanceConfig.contributionAmount });
    expect(result.ok).toBe(true);
    expect(result.state.turn).toBe(1);
    expect(result.state.contributionTotal).toBeGreaterThan(0);
  });

  it('시작 대비 수익률과 납입 제외 운용수익률을 구분한다', () => {
    const score = calculateScore(autoplay('returns'));
    expect(Number.isFinite(score.returnRate)).toBe(true);
    expect(Number.isFinite(score.investmentReturnRate)).toBe(true);
    expect(score.returnRate).toBeGreaterThan(score.investmentReturnRate - 1e-9);
  });

  it('v1 저장 데이터를 v2 기본값으로 복구한다', () => {
    const legacy = {
      getItem: (key: string) => key === STORAGE_KEY
        ? JSON.stringify({ version: 1, settings: { reducedMotion: true, sound: false }, unlockedCards: ['rate-bond'], bestScore: 88, lastSeed: 'abc' })
        : null
    };
    const loaded = loadSave(legacy);
    expect(loaded.version).toBe(2);
    expect(loaded.settings.reducedMotion).toBe(true);
    expect(loaded.disclaimerAccepted).toBe(false);
    expect(loaded.bestScore).toBe(88);
    expect(loaded.unlockedCards).toEqual(['rate-bond']);
    expect(loaded.playCount).toBe(0);
  });
});

describe('시장 진폭과 충격 턴', () => {
  it('템플릿 JSON의 충격 턴은 6턴과 8턴에 있다', () => {
    const shocks = marketScenario.filter((step) => step.shock).map((step) => step.turn);
    expect(shocks).toEqual([6, 8]);
  });

  it('템플릿 JSON 충격 턴의 대표 자산 움직임이 기존보다 크다', () => {
    const hike = marketScenario.find((step) => step.turn === 6)!;
    const vol = marketScenario.find((step) => step.turn === 8)!;
    expect(hike.returns.longBond).toBeLessThan(-0.08);
    expect(vol.returns.equityEtf).toBeLessThan(-0.07);
  });
});

describe('시드 기반 시장 경로', () => {
  it('같은 시드는 같은 12턴 경로를 만든다', () => {
    const a = generateMarketPath('market-same');
    const b = generateMarketPath('market-same');
    expect(a).toEqual(b);
    expect(a).toHaveLength(12);
    expect(a.map((step) => step.turn)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('다른 시드는 다른 경로를 만들고 고정 JSON과 같지 않다', () => {
    const a = generateMarketPath('market-alpha');
    const b = generateMarketPath('market-beta');
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(marketScenario);
  });

  it('충격 턴을 2회 두고 모든 상품 수익률을 채운다', () => {
    const path = generateMarketPath('market-shocks');
    const shocks = path.filter((step) => step.shock).map((step) => step.turn);
    expect(shocks).toHaveLength(2);
    expect(new Set(shocks).size).toBe(2);
    expect(shocks.every((turn) => turn >= 3 && turn <= 10)).toBe(true);
    for (const step of path) {
      for (const productId of ['deposit', 'shortBond', 'longBond', 'balanced', 'equityEtf', 'tdf'] as const) {
        expect(Number.isFinite(step.returns[productId])).toBe(true);
        expect(step.returns[productId]).toBeGreaterThanOrEqual(-0.15);
        expect(step.returns[productId]).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it('시드가 바뀌면 충격 턴 위치도 달라질 수 있다', () => {
    const pairs = new Set(
      Array.from({ length: 24 }, (_, index) => generateMarketPath(`shock-vary-${index}`)
        .filter((step) => step.shock)
        .map((step) => step.turn)
        .join(','))
    );
    expect(pairs.size).toBeGreaterThan(1);
    expect([...pairs].some((pair) => pair !== '6,8')).toBe(true);
  });

  it('새 게임은 시드 경로를 갖고 시작 전 수익률은 0이다', () => {
    const created = createGame('fresh-market');
    expect(created.marketPath).toEqual(generateMarketPath('fresh-market'));
    expect(created.lastMarket.turn).toBe(0);
    expect(created.lastMarket.returns.equityEtf).toBe(0);
    expect(created.lastMarket.returns.deposit).toBe(0);
  });

  it('턴 시작과 정산은 고정 JSON이 아니라 시드 경로를 읽는다', () => {
    const created = createGame('path-read');
    const started = startTurn(created);
    expect(started.state.lastMarket).toEqual(created.marketPath[0]);
    let state = started.state;
    if (state.currentEventId) state = resolveLifeEvent(state, 'cash').state;
    const held = performAction(state, { kind: 'hold' });
    expect(held.ok).toBe(true);
    expect(held.state.lastMarket.returns).toEqual(created.marketPath[0].returns);
  });
});
