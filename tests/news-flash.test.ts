import { describe, expect, it } from 'vitest';
import { balanceConfig, boardTiles, marketShocks } from '../src/data/content';
import { createGame, startTurn } from '../src/engine/game-engine';
import { emptyMarketStep } from '../src/engine/market-engine';
import type { TileEffect } from '../src/types';
import { COACH_MARKET_FIRST, dialAngle, renderNewsFlash } from '../src/ui/news-flash';

const market = balanceConfig.market;

describe('속보 카드', () => {
  it('금리 다이얼 각도는 범위 양끝이 ±120도, 중앙이 0도다', () => {
    expect(dialAngle(market.rateMinPct, market.rateMinPct, market.rateMaxPct)).toBe(-120);
    expect(dialAngle(market.rateMaxPct, market.rateMinPct, market.rateMaxPct)).toBe(120);
    expect(dialAngle(3.25, 0.5, 6.0)).toBe(0);
    expect(dialAngle(-5, 0.5, 6.0)).toBe(-120);
  });

  it('헤드라인·상품 화살표 6개·도착 칸·버튼 두 개를 담는다', () => {
    const game = createGame('news-basic');
    const step = game.marketPath[0];
    const tile = boardTiles[5];
    const html = renderNewsFlash(step, emptyMarketStep(), tile);
    expect(html).toContain('속보');
    expect(html).toContain('TURN 01');
    expect(html).toContain(step.headline);
    expect(html).toContain(step.reason);
    expect(html.match(/class="news-arrow /g)?.length).toBe(6);
    expect(html).toContain(`${step.ratePct.toFixed(2)}%`);
    expect(html).toContain(tile.label);
    expect(html).toContain('data-action="dismiss-news"');
    expect(html).toContain('data-action="open-tile"');
    expect(html).toContain(`--from:${dialAngle(market.rateStartPct, market.rateMinPct, market.rateMaxPct)}deg`);
    expect(html).toContain(`--to:${dialAngle(step.ratePct, market.rateMinPct, market.rateMaxPct)}deg`);
  });

  it('충격 턴은 shock 클래스와 국면 이름을, 긍정 충격은 positive를 붙인다', () => {
    const game = createGame('news-shock');
    const shockStep = game.marketPath.find((step) => step.shock)!;
    const prev = game.marketPath[shockStep.turn - 2];
    const html = renderNewsFlash(shockStep, prev, boardTiles[0]);
    expect(html).toContain('news-flash shock');
    expect(html).toContain(shockStep.phase);
    const shock = marketShocks.find((item) => item.id === shockStep.shockId)!;
    expect(html.includes('positive')).toBe(shock.positive);
    const quiet = game.marketPath.find((step) => !step.shock)!;
    expect(renderNewsFlash(quiet, emptyMarketStep(), boardTiles[0])).not.toContain('news-flash shock');
  });

  it('신호가 있으면 신호 상자를 넣는다', () => {
    const game = createGame('news-alert');
    const alerted = game.marketPath.find((step) => step.alert)!;
    const html = renderNewsFlash(alerted, emptyMarketStep(), boardTiles[0]);
    expect(html).toContain('market-alert');
    expect(html).toContain(alerted.alert!.text);
  });

  it('앵커 말풍선에 원인을 담고, 캐릭터 끔이면 아바타 없이 같은 문구를 보인다', () => {
    const game = createGame('news-anchor');
    const step = game.marketPath[0];
    const on = renderNewsFlash(step, emptyMarketStep(), boardTiles[5]);
    const off = renderNewsFlash(step, emptyMarketStep(), boardTiles[5], { characters: false });
    expect(on).toContain('앵커 부엉이');
    expect(off).not.toContain('앵커 부엉이');
    expect(off).toContain(step.reason);
    const marketTile = boardTiles.find((tile) => tile.kind === 'market')!;
    expect(renderNewsFlash(step, emptyMarketStep(), marketTile)).toContain('현장 연결');
    expect(on).not.toContain('현장 연결');
  });

  it('장부를 주면 "내 IRP에 반영" 줄을 금액·비율·부호 톤으로 그린다', () => {
    const game = createGame('news-irp');
    const step = game.marketPath[0];
    const up = renderNewsFlash(step, emptyMarketStep(), boardTiles[3], { characters: true, ledger: { open: 100_000_000, afterMarket: 101_500_000 } });
    expect(up).toContain('news-irp pos');
    expect(up).toContain('내 IRP에 반영');
    expect(up).toContain('+1,500,000원');
    expect(up).toContain('+1.5%');
    expect(up).toContain('다음 턴에 걸립니다');
    const down = renderNewsFlash(step, emptyMarketStep(), boardTiles[3], { characters: true, ledger: { open: 100_000_000, afterMarket: 98_000_000 } });
    expect(down).toContain('news-irp neg');
    expect(down).toContain('-2,000,000원');
    expect(renderNewsFlash(step, emptyMarketStep(), boardTiles[3])).not.toContain('news-irp');
  });

  it('도착 효과 스트립은 최대 2개를 그리고, 환급이 있으면 강조·금액을 붙인다', () => {
    const game = createGame('news-effects');
    const step = game.marketPath[0];
    const effects: TileEffect[] = [
      { kind: 'tax-refund', tileIndex: 0, title: '연말정산 통과', detail: '환급!', amount: 132_000 },
      { kind: 'spotlight', tileIndex: 1, title: '예금 거리 스포트라이트', detail: '오늘 사면 이해 +1', productId: 'deposit' },
      { kind: 'outlook', tileIndex: 12, title: '세 번째는 잘린다', detail: '…' }
    ];
    const html = renderNewsFlash(step, emptyMarketStep(), boardTiles[1], { characters: true, tileEffects: effects });
    expect(html.match(/class="tile-effect /g)?.length).toBe(2);
    expect(html).toContain('fx-tax-refund hot');
    expect(html).toContain('+132,000원');
    expect(html).toContain('예금 거리 스포트라이트');
    expect(html).not.toContain('세 번째는 잘린다');
    const zero = renderNewsFlash(step, emptyMarketStep(), boardTiles[1], {
      characters: true,
      tileEffects: [{ kind: 'tax-refund', tileIndex: 0, title: '연말정산 통과', detail: '환급 0원', amount: 0 }]
    });
    expect(zero).toContain('tile-effect fx-tax-refund"');
    expect(zero).not.toContain('hot');
  });

  it('1턴 코치 말풍선은 coach 옵션에서만 나오고 캐릭터 끔이면 문구만 남는다', () => {
    const game = createGame('news-coach');
    const step = game.marketPath[0];
    const on = renderNewsFlash(step, emptyMarketStep(), boardTiles[2], { characters: true, coach: true });
    expect(on).toContain(COACH_MARKET_FIRST);
    expect(on).toContain('코치 펭귄');
    const off = renderNewsFlash(step, emptyMarketStep(), boardTiles[2], { characters: false, coach: true });
    expect(off).toContain(COACH_MARKET_FIRST);
    expect(off).not.toContain('코치 펭귄');
    expect(renderNewsFlash(step, emptyMarketStep(), boardTiles[2], { characters: true })).not.toContain(COACH_MARKET_FIRST);
  });

  it('실제 턴 시작 상태로 그리면 장부·칸 효과가 그대로 들어간다', () => {
    const state = startTurn(createGame('news-real'), 5).state;
    const html = renderNewsFlash(state.lastMarket, emptyMarketStep(), boardTiles[state.position], {
      characters: true,
      ledger: { open: state.ledger.open, afterMarket: state.ledger.afterMarket },
      tileEffects: state.tileEffects,
      coach: state.turn === 1
    });
    expect(html).toContain('news-irp');
    expect(state.tileEffects.length).toBeGreaterThan(0);
    expect(html).toContain(state.tileEffects[0].title);
    expect(html).toContain(COACH_MARKET_FIRST);
  });
});
