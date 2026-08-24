import { describe, expect, it } from 'vitest';
import { rebalanceTargetRisk } from '../src/engine/portfolio-engine';
import { diversificationNeeded } from '../src/engine/scoring-engine';

describe('별 사다리 헬퍼', () => {
  it('위험중립형 리밸런싱 목표 위험은 약 21.7%이다', () => {
    expect(rebalanceTargetRisk('balanced')).toBeCloseTo(0.2167, 3);
  });

  it('안정형은 허용 상품이 2개라 분산 하한이 2이다', () => {
    expect(diversificationNeeded('stable')).toBe(2);
    expect(diversificationNeeded('balanced')).toBe(3);
  });
});
