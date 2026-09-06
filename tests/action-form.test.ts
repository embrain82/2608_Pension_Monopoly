import { describe, expect, it } from 'vitest';
import { createGame, performAction, resolveActionAmount, startTurn } from '../src/engine/game-engine';
import { MIN_TRADE_AMOUNT, heldProductIds, pickHeldProduct, tradeBlockReason } from '../src/ui/action-form';
import type { GameState } from '../src/types';

const openTurn = (state: GameState): GameState => startTurn(state, 3).state;

describe('action-form: 매도·교체 기존 상품 선택 보정', () => {
  it('시작 포트폴리오에서는 예금과 혼합형이 보유 상품이다', () => {
    const game = createGame('seed-1', 'balanced');
    expect(heldProductIds(game)).toEqual(['deposit', 'balanced']);
    expect(pickHeldProduct(game, 'deposit')).toBe('deposit');
    expect(pickHeldProduct(game, 'balanced')).toBe('balanced');
  });

  it('보유하지 않은 상품을 고르면 첫 보유 상품으로 바꾼다', () => {
    const game = createGame('seed-1', 'balanced');
    expect(pickHeldProduct(game, 'equityEtf')).toBe('deposit');
    expect(pickHeldProduct(game, 'tdf')).toBe('deposit');
  });

  it('예금을 전액 교체한 뒤에는 예금이 선택값에서 빠지고 혼합형이 선택된다(재현 버그)', () => {
    const opened = openTurn(createGame('seed-1', 'balanced'));
    const all = resolveActionAmount(opened, 'switch', 'max', 'deposit');
    const switched = performAction(opened, { kind: 'switch', fromProductId: 'deposit', toProductId: 'balanced', amount: all });
    expect(switched.ok).toBe(true);
    const next = openTurn(switched.state);
    expect(heldProductIds(next)).not.toContain('deposit');
    // 수정 전: 내부 선택값이 'deposit'에 머물러 셀렉트에는 혼합형이 보이는데 금액은 0원으로 계산됐다.
    const picked = pickHeldProduct(next, 'deposit');
    expect(picked).toBe('balanced');
    expect(resolveActionAmount(next, 'switch', 'max', picked)).toBeGreaterThanOrEqual(MIN_TRADE_AMOUNT);
    expect(resolveActionAmount(next, 'sell', 'default', picked)).toBeGreaterThanOrEqual(MIN_TRADE_AMOUNT);
  });

  it('10만원 미만 잔고는 보유 상품으로 치지 않는다(엔진 최소 거래 단위와 같음)', () => {
    const game = createGame('seed-1', 'balanced');
    const tiny: GameState = { ...game, holdings: game.holdings.map((holding) => holding.productId === 'deposit' ? { ...holding, amount: MIN_TRADE_AMOUNT - 1 } : holding) };
    expect(heldProductIds(tiny)).toEqual(['balanced']);
    expect(pickHeldProduct(tiny, 'deposit')).toBe('balanced');
  });

  it('보유 상품이 하나도 없으면 선호값을 그대로 돌려준다', () => {
    const game = createGame('seed-1', 'balanced');
    const empty: GameState = { ...game, holdings: [] };
    expect(heldProductIds(empty)).toEqual([]);
    expect(pickHeldProduct(empty, 'deposit')).toBe('deposit');
  });
});

describe('action-form: 실행 버튼을 막아야 하는 이유', () => {
  it('보유 상품이 없으면 매도·교체 모두 막고 이유를 말한다', () => {
    const game = createGame('seed-1', 'balanced');
    const empty: GameState = { ...game, holdings: [] };
    expect(tradeBlockReason(empty, 'sell', 0)).toContain('보유 상품이 없습니다');
    expect(tradeBlockReason(empty, 'switch', 0)).toContain('보유 상품이 없습니다');
  });

  it('금액이 최소 거래 단위 미만이면 막는다', () => {
    const game = createGame('seed-1', 'balanced');
    expect(tradeBlockReason(game, 'sell', MIN_TRADE_AMOUNT - 1)).toContain('10만원');
    expect(tradeBlockReason(game, 'switch', 0)).toContain('10만원');
  });

  it('보유가 있고 금액이 충분하면 막지 않는다', () => {
    const game = createGame('seed-1', 'balanced');
    expect(tradeBlockReason(game, 'sell', MIN_TRADE_AMOUNT)).toBeNull();
    expect(tradeBlockReason(game, 'switch', 5_000_000)).toBeNull();
  });
});
