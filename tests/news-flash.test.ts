import { describe, expect, it } from 'vitest';
import { balanceConfig, boardTiles, marketShocks } from '../src/data/content';
import { createGame } from '../src/engine/game-engine';
import { emptyMarketStep } from '../src/engine/market-engine';
import { dialAngle, renderNewsFlash } from '../src/ui/news-flash';

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
});
