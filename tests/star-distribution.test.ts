import { describe, expect, it } from 'vitest';
import { autoplay } from '../src/engine/game-engine';
import { calculateScore } from '../src/engine/scoring-engine';

describe('별 분포 가드', () => {
  it('납입+후반 리밸런싱 경로는 3별을 연다', () => {
    let three = 0;
    for (let i = 0; i < 40; i += 1) {
      if (calculateScore(autoplay(`ladder-steward-${i}`, 'steward')).stars === 3) three += 1;
    }
    expect(three).toBeGreaterThanOrEqual(8);
  });

  it('혼합 자동플레이에서 1별과 2별이 함께 나온다', () => {
    const strategies = ['balanced', 'passive', 'contributor', 'growth', 'steward'] as const;
    const stars = [0, 0, 0, 0];
    for (let i = 0; i < 200; i += 1) {
      stars[calculateScore(autoplay(`ladder-${i}`, strategies[i % 5])).stars] += 1;
    }
    expect(stars[0]).toBeGreaterThanOrEqual(5);
    expect(stars[1]).toBeGreaterThanOrEqual(10);
    expect(stars[2]).toBeGreaterThanOrEqual(10);
    expect(stars[3]).toBeGreaterThanOrEqual(10);
  });
});
