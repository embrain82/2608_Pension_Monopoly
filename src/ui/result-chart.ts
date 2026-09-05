export interface ChartPoint {
  x: number;
  y: number;
}

export const CHART_WIDTH = 320;
export const CHART_HEIGHT = 96;
const PAD = 8;

export function sparklinePoints(history: number[], width = CHART_WIDTH, height = CHART_HEIGHT): ChartPoint[] {
  if (history.length === 0) return [];
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const stepX = history.length > 1 ? (width - PAD * 2) / (history.length - 1) : 0;
  return history.map((value, index) => ({
    x: Math.round((PAD + index * stepX) * 10) / 10,
    y: Math.round((height - PAD - ((value - min) / span) * (height - PAD * 2)) * 10) / 10
  }));
}

/** 직전 최고점 대비 가장 크게 떨어진 턴. 떨어진 턴이 없으면 null. */
export function worstTurn(history: number[]): { turn: number; drawdown: number } | null {
  let peak = history[0] ?? 0;
  let worst: { turn: number; drawdown: number } | null = null;
  history.forEach((value, index) => {
    if (index === 0) return;
    const drop = peak > 0 ? 1 - value / peak : 0;
    if (drop > 0 && (!worst || drop > worst.drawdown)) worst = { turn: index, drawdown: drop };
    peak = Math.max(peak, value);
  });
  return worst;
}

export function renderIrpSparkline(history: number[], shockTurns: number[]): string {
  const points = sparklinePoints(history);
  if (points.length < 2) return '';
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${points[0].x},${CHART_HEIGHT} ${line} ${points[points.length - 1].x},${CHART_HEIGHT}`;
  const worst = worstTurn(history);
  const shocks = shockTurns
    .filter((turn) => turn > 0 && turn < points.length)
    .map((turn) => `<text class="chart-shock" x="${points[turn].x}" y="${Math.max(12, points[turn].y - 10)}" text-anchor="middle" style="--i:${turn}">⚡</text>`)
    .join('');
  const worstMark = worst
    ? `<circle class="chart-worst" cx="${points[worst.turn].x}" cy="${points[worst.turn].y}" r="5"></circle>`
    : '';
  const end = points[points.length - 1];
  const rising = history[history.length - 1] >= history[0];
  return `<svg class="irp-chart ${rising ? 'up' : 'down'}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-label="12턴 IRP 평가액 흐름. 시작 ${Math.round(history[0]).toLocaleString('ko-KR')}원, 마지막 ${Math.round(history[history.length - 1]).toLocaleString('ko-KR')}원">
      <polygon class="chart-area" points="${area}"></polygon>
      <polyline class="chart-line" points="${line}" pathLength="1"></polyline>
      ${shocks}${worstMark}
      <circle class="chart-end" cx="${end.x}" cy="${end.y}" r="4"></circle>
    </svg>`;
}

export function worstTurnLine(history: number[]): string {
  const worst = worstTurn(history);
  if (!worst || worst.drawdown < 0.005) return '12턴 내내 직전 최고점을 크게 밑돈 적이 없습니다.';
  return `가장 아슬아슬했던 턴: ${worst.turn}턴 낙폭 −${(worst.drawdown * 100).toFixed(1)}%`;
}
