import { describe, expect, it } from 'vitest';
import { boardTiles, learningCards, tileBriefings, validateContent } from '../src/data/content';
import { createGame, startTurn } from '../src/engine/game-engine';
import { pickTileBriefing } from '../src/engine/tile-briefing';
import { BRIEFING_LEAD_MAX, briefingLead, renderTileBriefing } from '../src/ui/tile-briefing';

describe('도착 칸 설명 풀', () => {
  it('24칸마다 서로 다른 설명 5개를 두고 학습 카드와 연결한다', () => {
    expect(() => validateContent()).not.toThrow();
    expect(tileBriefings).toHaveLength(boardTiles.length);
    const cardIds = new Set(learningCards.map((card) => card.id));
    for (const set of tileBriefings) {
      expect(set.pool).toHaveLength(5);
      const titles = set.pool.map((item) => item.title);
      expect(new Set(titles).size).toBe(5);
      for (const item of set.pool) {
        expect(item.body.length).toBeGreaterThan(80);
        expect(cardIds.has(item.cardId)).toBe(true);
      }
    }
  });

  it('같은 시드·턴·칸은 같은 글을 고르고 다른 시드는 달라질 수 있다', () => {
    const a = pickTileBriefing('brief-same', 1, 7);
    const b = pickTileBriefing('brief-same', 1, 7);
    expect(a).toEqual(b);
    const picks = new Set(
      Array.from({ length: 20 }, (_, index) => pickTileBriefing(`brief-vary-${index}`, 1, 7).title)
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('턴이 시작되면 도착 칸 설명을 고르고 연결 카드를 연다', () => {
    const created = createGame('brief-unlock');
    const started = startTurn(created, 7).state;
    const briefing = pickTileBriefing(started.seed, started.turn, started.position);
    expect(started.position).toBe(7);
    expect(started.unlockedCards).toContain(briefing.cardId);
  });

  it('도착 안내 마크업은 고른 제목과 본문을 넣고 행동을 강제하지 않는다', () => {
    const briefing = pickTileBriefing('brief-ui', 1, 7);
    const markup = renderTileBriefing(briefing, '제도 안내', 8);
    expect(markup).toContain(briefing.title);
    const { lead, rest } = briefingLead(briefing.body);
    expect(markup).toContain(lead);
    if (rest) expect(markup).toContain(rest);
    expect(markup).toContain('제도 안내');
    expect(markup).toContain('data-action="dismiss-tile"');
    expect(markup).toContain('설명만');
  });

  it('칸 설명은 첫 문장을 80자 안에서 앞세우고 나머지는 접는다', () => {
    const third = '세 번째 문장은 메타 설명이라 길게 이어지며 이 칸이 사건이나 수익률을 만들지 않는다는 점을 다시 한 번 짚어 줍니다.';
    const long = `첫 문장입니다. 두 번째 문장은 조금 더 길어서 여기까지 이어집니다. ${third}`;
    const split = briefingLead(long);
    expect(split.lead).toBe('첫 문장입니다. 두 번째 문장은 조금 더 길어서 여기까지 이어집니다.');
    expect(split.rest).toBe(third);
    expect(briefingLead('짧은 한 문장.')).toEqual({ lead: '짧은 한 문장.', rest: '' });
    const html = renderTileBriefing({ title: 't', body: long, cardId: 'rate-bond' } as never, '칸', 1);
    expect(html).toContain('tile-briefing-more');
    expect(html).toContain('세 번째 문장은');
    for (const briefing of tileBriefings.flatMap((set) => set.pool)) {
      const { lead } = briefingLead(briefing.body);
      expect(lead.length).toBeGreaterThan(0);
      expect(lead.length).toBeLessThanOrEqual(Math.max(BRIEFING_LEAD_MAX, briefing.body.split(/[.!?。]/)[0].length + 1));
    }
  });
});
