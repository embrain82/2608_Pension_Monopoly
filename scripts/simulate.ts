import { AUTO_STRATEGIES, autoplay, type AutoStrategy } from '../src/engine/game-engine';
import { calculateScore } from '../src/engine/scoring-engine';
import { diceStepsForTurn } from '../src/engine/random-engine';
import { balanceConfig } from '../src/data/content';

const runsArg = process.argv.find((arg) => arg.startsWith('--runs='));
const runs = Math.max(1, Number(runsArg?.split('=')[1] ?? 1000));
if (!Number.isInteger(runs)) throw new Error('--runs에는 양의 정수를 입력하세요.');
const asJson = process.argv.includes('--json');

interface StrategyStats {
  runs: number;
  goalMet: number;
  stars: number[];
  returns: number[];
  drawdowns: number[];
  cashShortages: number;
  drawdownFails: number;
}

const emptyStats = (): StrategyStats => ({ runs: 0, goalMet: 0, stars: [0, 0, 0, 0], returns: [], drawdowns: [], cashShortages: 0, drawdownFails: 0 });
const perStrategy = new Map<AutoStrategy, StrategyStats>(AUTO_STRATEGIES.map((strategy) => [strategy, emptyStats()]));

let returnTotal = 0;
let assetTotal = 0;
let goalMet = 0;
let drawdownTotal = 0;
const stars = [0, 0, 0, 0];
let errors = 0;
let invalidBalances = 0;
let unfinished = 0;
const diceSums: number[] = [];
const totalScores: number[] = [];

for (let index = 0; index < runs; index += 1) {
  const strategy = AUTO_STRATEGIES[index % AUTO_STRATEGIES.length];
  const seed = `simulation-${index}`;
  try {
    const state = autoplay(seed, strategy);
    const score = calculateScore(state);
    const values = [state.cash, state.irpCash, score.irpValue, ...state.holdings.map((holding) => holding.amount)];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) invalidBalances += 1;
    if (state.status !== 'finished' || state.turn !== 12) unfinished += 1;
    assetTotal += score.irpValue;
    returnTotal += score.returnRate;
    goalMet += score.goalMet ? 1 : 0;
    drawdownTotal += score.maxDrawdown;
    stars[score.stars] += 1;
    const stat = perStrategy.get(strategy)!;
    stat.runs += 1;
    stat.goalMet += score.goalMet ? 1 : 0;
    stat.stars[score.stars] += 1;
    stat.returns.push(score.returnRate);
    stat.drawdowns.push(score.maxDrawdown);
    stat.cashShortages += state.cashShortages;
    if (score.maxDrawdown > balanceConfig.maxDrawdownThreshold) stat.drawdownFails += 1;
    let diceSum = 0;
    for (let turn = 0; turn < balanceConfig.maxTurns; turn += 1) diceSum += diceStepsForTurn(seed, turn);
    diceSums.push(diceSum);
    totalScores.push(score.totalScore);
  } catch (error) {
    errors += 1;
    console.error(`시드 ${seed} 오류`, error);
  }
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const quantile = (values: number[], q: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
};
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
function correlation(a: number[], b: number[]): number {
  if (a.length < 2 || a.length !== b.length) return 0;
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < a.length; i += 1) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : 0;
}

const diceCorrelation = correlation(diceSums, totalScores);
const strategyRows = [...perStrategy.entries()].map(([strategy, stat]) => ({
  strategy,
  runs: stat.runs,
  goalRate: stat.runs ? stat.goalMet / stat.runs : 0,
  stars: stat.stars,
  twoPlusRate: stat.runs ? (stat.stars[2] + stat.stars[3]) / stat.runs : 0,
  meanReturn: mean(stat.returns),
  p10Return: quantile(stat.returns, 0.1),
  p90Return: quantile(stat.returns, 0.9),
  meanDrawdown: mean(stat.drawdowns),
  maxDrawdown: stat.drawdowns.length ? Math.max(...stat.drawdowns) : 0,
  drawdownFailRate: stat.runs ? stat.drawdownFails / stat.runs : 0,
  cashShortages: stat.cashShortages
}));

if (asJson) {
  console.log(JSON.stringify({
    runs, errors, invalidBalances, unfinished,
    meanIrp: assetTotal / runs, meanReturn: returnTotal / runs, goalRate: goalMet / runs, stars, meanDrawdown: drawdownTotal / runs,
    diceCorrelation, strategies: strategyRows
  }, null, 2));
} else {
  console.log(`연금로드 자동 시뮬레이션 (${runs.toLocaleString('ko-KR')}회)`);
  console.log(`런타임 오류: ${errors}건`);
  console.log(`NaN/음수 비정상 잔액: ${invalidBalances}건`);
  console.log(`미종료 경기: ${unfinished}건`);
  console.log(`평균 최종 IRP: ${Math.round(assetTotal / runs).toLocaleString('ko-KR')}원`);
  console.log(`평균 시작 대비 수익률: ${pct(returnTotal / runs, 2)}`);
  console.log(`목표 달성률: ${pct(goalMet / runs)}`);
  console.log(`별 등급 분포: 0별 ${stars[0]}, 1별 ${stars[1]}, 2별 ${stars[2]}, 3별 ${stars[3]}`);
  console.log(`평균 최대 낙폭: ${pct(drawdownTotal / runs, 2)}`);
  console.log(`주사위 합–총점 상관: ${diceCorrelation.toFixed(3)}`);
  console.log('');
  console.log('전략별 (달성률 · 별0/1/2/3 · 2별+ · 평균/p10/p90 수익률 · 평균/최대 낙폭 · 낙폭12%초과 · 생활자금 부족)');
  for (const row of strategyRows) {
    console.log(
      `${row.strategy.padEnd(12)} ${pct(row.goalRate).padStart(6)} · ${row.stars.join('/').padEnd(14)} · ${pct(row.twoPlusRate).padStart(6)} · `
      + `${pct(row.meanReturn)} / ${pct(row.p10Return)} / ${pct(row.p90Return)} · ${pct(row.meanDrawdown, 2)} / ${pct(row.maxDrawdown, 2)} · ${pct(row.drawdownFailRate)} · ${row.cashShortages}`
    );
  }
}

if (errors || invalidBalances || unfinished) process.exitCode = 1;
