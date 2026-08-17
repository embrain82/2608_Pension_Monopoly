import { autoplay, type AutoStrategy } from '../src/engine/game-engine';
import { calculateScore } from '../src/engine/scoring-engine';

const runsArg = process.argv.find((arg) => arg.startsWith('--runs='));
const runs = Math.max(1, Number(runsArg?.split('=')[1] ?? 1000));
if (!Number.isInteger(runs)) throw new Error('--runs에는 양의 정수를 입력하세요.');

let returnTotal = 0;
let assetTotal = 0;
let goalMet = 0;
let drawdownTotal = 0;
const stars = [0, 0, 0, 0];
let errors = 0;
let invalidBalances = 0;
let unfinished = 0;

for (let index = 0; index < runs; index += 1) {
  try {
    const strategies: AutoStrategy[] = ['balanced', 'passive', 'contributor', 'growth'];
    const state = autoplay(`simulation-${index}`, strategies[index % strategies.length]);
    const score = calculateScore(state);
    const values = [state.cash, state.irpCash, score.irpValue, ...state.holdings.map((holding) => holding.amount)];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) invalidBalances += 1;
    if (state.status !== 'finished' || state.turn !== 12) unfinished += 1;
    assetTotal += score.irpValue;
    returnTotal += score.returnRate;
    goalMet += score.goalMet ? 1 : 0;
    drawdownTotal += score.maxDrawdown;
    stars[score.stars] += 1;
  } catch (error) {
    errors += 1;
    console.error(`시드 simulation-${index} 오류`, error);
  }
}

const won = goalMet / runs;
console.log(`연금로드 자동 시뮬레이션 (${runs.toLocaleString('ko-KR')}회)`);
console.log(`런타임 오류: ${errors}건`);
console.log(`NaN/음수 비정상 잔액: ${invalidBalances}건`);
console.log(`미종료 경기: ${unfinished}건`);
console.log(`평균 최종 IRP: ${Math.round(assetTotal / runs).toLocaleString('ko-KR')}원`);
console.log(`평균 시작 대비 수익률: ${(returnTotal / runs * 100).toFixed(2)}%`);
console.log(`목표 달성률: ${(won * 100).toFixed(1)}%`);
console.log(`별 등급 분포: 0별 ${stars[0]}, 1별 ${stars[1]}, 2별 ${stars[2]}, 3별 ${stars[3]}`);
console.log(`평균 최대 낙폭: ${(drawdownTotal / runs * 100).toFixed(2)}%`);

if (errors || invalidBalances || unfinished) process.exitCode = 1;
