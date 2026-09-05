import { describe, expect, it } from 'vitest';
import { autoplay } from '../src/engine/game-engine';
import { CHART_HEIGHT, CHART_WIDTH, renderIrpSparkline, sparklinePoints, worstTurn, worstTurnLine } from '../src/ui/result-chart';

describe('결과 스파크라인', () => {
  it('점 개수는 이력 길이와 같고 화면 안에 놓인다', () => {
    const points = sparklinePoints([100, 120, 90, 130]);
    expect(points).toHaveLength(4);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(CHART_WIDTH);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(CHART_HEIGHT);
    }
    expect(points[3].y).toBeLessThan(points[2].y);
    expect(sparklinePoints([])).toEqual([]);
  });

  it('가장 아슬아슬했던 턴은 직전 최고점 대비 최대 낙폭 턴이다', () => {
    const worst = worstTurn([100, 110, 99, 120, 108])!;
    expect(worst.turn).toBe(2);
    expect(worst.drawdown).toBeCloseTo(0.1, 10);
    expect(worstTurn([100, 101, 102])).toBeNull();
    expect(worstTurnLine([100, 110, 99])).toContain('2턴 낙폭 −10.0%');
    expect(worstTurnLine([100, 101])).toContain('밑돈 적이 없습니다');
  });

  it('마크업에 선·면·충격 마커·아슬아슬 턴 표시가 있고, 점이 2개 미만이면 비어 있다', () => {
    const html = renderIrpSparkline([100, 110, 99, 120], [2]);
    expect(html).toContain('chart-line');
    expect(html).toContain('chart-area');
    expect(html).toContain('chart-shock');
    expect(html).toContain('chart-worst');
    expect(html).toContain('role="img"');
    expect(renderIrpSparkline([100], [])).toBe('');
    expect(renderIrpSparkline([100, 110, 120], [])).toContain('irp-chart up');
    expect(renderIrpSparkline([100, 90, 80], [])).toContain('irp-chart down');
  });

  it('실제 12턴 이력을 그리면 충격 턴 마커 수가 충격 수와 같다', () => {
    const state = autoplay('chart');
    const shocks = state.marketPath.filter((step) => step.shock).map((step) => step.turn);
    const html = renderIrpSparkline(state.irpHistory, shocks);
    expect(html.match(/chart-shock/g)?.length).toBe(shocks.length);
  });
});
