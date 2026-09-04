import { describe, expect, it } from 'vitest';
import { balanceConfig, policyRules } from '../src/data/content';
import { createGame } from '../src/engine/game-engine';
import { calculateScore } from '../src/engine/scoring-engine';
import { goalStatusLine, renderGoalMeter, renderRiskMeter } from '../src/ui/hud';

function stateWithPension(monthly: number, cash: number, turn = 4) {
  const base = createGame('hud', 'balanced', 500_000);
  const irp = monthly * policyRules.receivingMonths;
  return {
    ...base,
    turn,
    cash,
    irpCash: irp,
    holdings: []
  };
}

describe('목표 상태 한 줄', () => {
  it('95% 아래면 남은 금액과 남은 턴을 말한다', () => {
    const state = stateWithPension(450_000, 12_000_000, 4);
    const line = goalStatusLine(state, calculateScore(state));
    expect(line).toContain('목표까지');
    expect(line).toContain('5만');
    expect(line).toContain('남은 턴 8');
  });

  it('95~100%면 1별 확보를 알린다', () => {
    const state = stateWithPension(480_000, 12_000_000);
    expect(goalStatusLine(state, calculateScore(state))).toContain('1별 확보');
  });

  it('목표를 넘었는데 생활자금이 모자라면 2별 조건을 말한다', () => {
    const state = stateWithPension(520_000, 4_000_000);
    const line = goalStatusLine(state, calculateScore(state));
    expect(line).toContain('목표 달성');
    expect(line).toContain('생활자금');
    expect(line).toContain('200만');
  });

  it('목표와 생활자금을 모두 채우면 3별 조건을 안내한다', () => {
    const state = stateWithPension(520_000, 8_000_000);
    expect(goalStatusLine(state, calculateScore(state))).toContain('3별');
  });
});

describe('게이지', () => {
  it('목표 게이지는 95% 눈금과 상태 클래스를 갖는다', () => {
    const near = stateWithPension(470_000, 12_000_000);
    const nearHtml = renderGoalMeter(near, calculateScore(near));
    expect(nearHtml).toContain('class="tick"');
    expect(nearHtml).toContain('goal-meter near');
    const met = stateWithPension(520_000, 12_000_000);
    expect(renderGoalMeter(met, calculateScore(met))).toContain('goal-meter met');
    const far = stateWithPension(400_000, 12_000_000);
    const farHtml = renderGoalMeter(far, calculateScore(far));
    expect(farHtml).not.toContain('near');
    expect(farHtml).toContain('남은 턴');
  });

  it('위험 게이지는 한도선을 그리고 초과면 over를 붙인다', () => {
    const limit = policyRules.riskAssetLimit;
    expect(renderRiskMeter(0.3, limit)).toContain(`left:${Math.round(limit * 100)}%`);
    expect(renderRiskMeter(0.3, limit)).not.toContain('over');
    expect(renderRiskMeter(0.75, limit)).toContain('risk-meter over');
    expect(balanceConfig.maxDrawdownThreshold).toBe(0.12);
  });
});
