import { describe, expect, it } from 'vitest';
import { createGame, performAction, startTurn } from '../src/engine/game-engine';
import { applyMarketStep } from '../src/engine/market-engine';
import {
  HINT_DEFAULT,
  HINT_NEAR_LIMIT,
  HINT_OVER_LIMIT,
  HINT_PENDING_FUND,
  summarizeTurn
} from '../src/engine/settlement-engine';
import { policyRules } from '../src/data/content';
import { renderSettlementModal } from '../src/ui/settlement';

describe('턴 정산 요약', () => {
  it('행동 전후 IRP·위험비중과 힌트를 만든다', () => {
    const started = startTurn(createGame('settle-hold'), 1);
    let state = started.state;
    if (state.currentEventId) return;
    const before = state;
    const after = performAction(state, { kind: 'hold' }).state;
    const summary = summarizeTurn(before, after, '이번 턴은 행동하지 않고 현재 구성을 유지했습니다.');
    expect(summary.turn).toBe(before.turn);
    expect(summary.actionLine).toContain('유지');
    expect(summary.irpAfter).not.toBeUndefined();
    expect(summary.riskAfter).toBeGreaterThanOrEqual(0);
    expect(summary.marketHeadline.length).toBeGreaterThan(0);
    expect(summary.nextHints.length).toBeGreaterThanOrEqual(1);
    expect(summary.nextHints.length).toBeLessThanOrEqual(2);
  });

  it('사후 한도 초과면 안전자산·리밸런싱 힌트를 준다', () => {
    const base = createGame('settle-over');
    const before = {
      ...base,
      turn: 1,
      awaitingAction: true,
      currentEventId: null,
      holdings: [
        { productId: 'deposit' as const, amount: 30_000_000, principal: 30_000_000, depositTurnsHeld: 4 },
        { productId: 'equityEtf' as const, amount: 70_000_000, principal: 70_000_000, depositTurnsHeld: 0 }
      ]
    };
    const after = {
      ...applyMarketStep(before, {
        ...before.lastMarket,
        headline: '주가 급등',
        shock: true,
        returns: { ...before.lastMarket.returns, deposit: 0, equityEtf: 0.5 }
      }),
      marketLimitExceeded: true,
      pendingOrders: []
    };
    const summary = summarizeTurn(before, after, '그대로 두기');
    expect(summary.marketLimitExceeded).toBe(true);
    expect(summary.shock).toBe(true);
    expect(summary.nextHints[0]).toBe(HINT_OVER_LIMIT);
    expect(summary.productDeltas[0]?.productId).toBe('equityEtf');
    expect(summary.productDeltas[0]?.delta).toBeGreaterThan(0);
  });

  it('펀드 대기 주문이 있으면 시차 힌트를 준다', () => {
    const before = createGame('settle-fund');
    const after = {
      ...before,
      turn: 1,
      pendingOrders: [{
        id: '1',
        side: 'buy' as const,
        productId: 'longBond' as const,
        amount: 5_000_000,
        submittedTurn: 1,
        settlesTurn: 2,
        stage: 'received' as const
      }],
      lastMarket: { ...before.lastMarket, headline: '금리 소폭 하락' }
    };
    const summary = summarizeTurn(before, after, '장기채 매수 주문 접수');
    expect(summary.nextHints).toContain(HINT_PENDING_FUND);
    expect(summary.nextHints.length).toBeLessThanOrEqual(2);
  });

  it('한도 근처이면 미리보기 힌트를 준다', () => {
    const before = createGame('settle-near');
    const after = {
      ...before,
      turn: 1,
      holdings: [
        { productId: 'deposit' as const, amount: 40_000_000, principal: 40_000_000, depositTurnsHeld: 4 },
        { productId: 'equityEtf' as const, amount: 66_000_000, principal: 66_000_000, depositTurnsHeld: 0 }
      ],
      irpCash: 0,
      pendingOrders: [],
      marketLimitExceeded: false,
      lastMarket: { ...before.lastMarket, headline: '보합' }
    };
    const summary = summarizeTurn(before, after, '유지');
    expect(summary.riskAfter).toBeGreaterThan(0.62);
    expect(summary.riskAfter).toBeLessThanOrEqual(policyRules.riskAssetLimit + 0.00001);
    expect(summary.nextHints).toContain(HINT_NEAR_LIMIT);
  });

  it('정산 모달에 전후 숫자와 다음 판단을 그린다', () => {
    const html = renderSettlementModal({
      turn: 3,
      actionLine: '이번 턴은 행동하지 않고 현재 구성을 유지했습니다.',
      irpBefore: 108_000_000,
      irpAfter: 109_200_000,
      riskBefore: 0.2,
      riskAfter: 0.21,
      marketHeadline: '금리는 내리고 주가는 올랐습니다',
      shock: false,
      marketLimitExceeded: false,
      productDeltas: [{ productId: 'equityEtf', name: '주식 ETF', delta: 1_200_000 }],
      nextHints: [HINT_DEFAULT]
    });
    expect(html).toContain('3턴 정산');
    expect(html).toContain('정산 요약');
    expect(html).toContain('다음 판단');
    expect(html).toContain('다음 턴 준비');
    expect(html).toContain('주식 ETF');
    expect(html).toContain(HINT_DEFAULT);
    expect(html).toContain('data-action="dismiss-settle"');
  });
});
