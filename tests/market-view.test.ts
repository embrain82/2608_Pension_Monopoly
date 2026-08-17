import { describe, expect, it } from 'vitest';
import { createGame, performAction, resolveLifeEvent, startTurn } from '../src/engine/game-engine';
import { renderHowToModal, renderSettingsHowToButton, shouldShowHowTo, shouldShowLearningTip } from '../src/ui/howto';
import { renderMarketCard, renderProductReturns, renderSettingsEntry, renderTurnTrack } from '../src/ui/market-view';

function signedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function settleOneTurn(seed: string) {
  let state = startTurn(createGame(seed)).state;
  if (state.currentEventId) state = resolveLifeEvent(state, 'cash').state;
  return performAction(state, { kind: 'hold' }).state;
}

describe('상품 수익률 표시', () => {
  it('정산 후 주사위 대기에도 직전 턴 수익률을 숫자로 보여 준다', () => {
    const state = settleOneTurn('ui-returns');
    const card = renderMarketCard(state, true);
    const rows = renderProductReturns(state);
    expect(card).not.toContain('???');
    expect(rows).not.toContain('???');
    expect(card).toContain(signedPercent(state.lastMarket.returns.equityEtf));
    expect(card).toContain(state.lastMarket.headline);
    expect(card).toContain('다음 턴');
  });

  it('첫 주사위 전에도 물음표 대신 0%를 보여 준다', () => {
    const created = createGame('ui-zero');
    const card = renderMarketCard(created, true);
    expect(card).not.toContain('???');
    expect(card).toContain('0.0%');
    expect(card).not.toContain(created.marketPath[0].headline);
  });
});

describe('투자자성향 진입점', () => {
  it('점 세 개 대신 성향을 바꿀 수 있다는 문구를 보여 준다', () => {
    const markup = renderSettingsEntry();
    expect(markup).toContain('성향');
    expect(markup).toContain('data-action="open-settings"');
    expect(markup).not.toContain('⋮');
  });
});

describe('게임 방법 팝업', () => {
  it('주사위·시장·운용 루프를 한 번에 설명한다', () => {
    const markup = renderHowToModal();
    expect(markup).toContain('주사위');
    expect(markup).toContain('시장');
    expect(markup).toContain('운용');
    expect(markup).toContain('data-action="dismiss-howto"');
  });

  it('이 브라우저에서 이미 본 뒤에는 자동으로 열지 않는다', () => {
    expect(shouldShowHowTo(false)).toBe(true);
    expect(shouldShowHowTo(true)).toBe(false);
  });

  it('설정에서 게임 방법을 다시 볼 수 있다', () => {
    const button = renderSettingsHowToButton();
    expect(button).toContain('게임 방법');
    expect(button).toContain('data-action="open-howto"');
  });

  it('학습 카드 팁은 시장이 열리기 전에는 숨긴다', () => {
    const created = createGame('howto-tip');
    expect(shouldShowLearningTip(created, false, true)).toBe(false);
    const started = startTurn(created).state;
    expect(shouldShowLearningTip(started, false, false)).toBe(true);
    expect(shouldShowLearningTip(started, true, false)).toBe(false);
  });
});

describe('시드 경로 트랙', () => {
  it('턴 트랙은 그 판의 시드 경로를 쓰고 미공개 충격을 숨긴다', () => {
    const created = createGame('track-path');
    const waiting = renderTurnTrack(created, true);
    expect(waiting).not.toContain('shock');
    expect(waiting).not.toContain('충격');

    const shockTurn = created.marketPath.find((step) => step.shock)!.turn;
    let state = created;
    while (state.turn < shockTurn) {
      state = startTurn(state).state;
      if (state.currentEventId) state = resolveLifeEvent(state, 'cash').state;
      if (state.turn < shockTurn) state = performAction(state, { kind: 'hold' }).state;
    }
    const revealed = renderTurnTrack(state, false);
    expect(revealed).toContain('shock');

    const future = created.marketPath.find((step) => step.turn > state.turn);
    if (future) {
      expect(revealed).toContain(`title="${future.turn}턴">${future.turn}</i>`);
    }
  });
});
