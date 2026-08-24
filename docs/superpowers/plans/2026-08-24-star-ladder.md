# 별 사다리 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기본 12턴 플레이에서 별 0·1·2·3이 각각 다른 교육 의미를 갖게 하고, 납입만 하면 2별·납입+리밸런싱이면 3별이 실제로 나오게 한다.

**Architecture:** 별 공식은 `calculateScore` 한곳에만 둔다. 3별 정렬은 설문 기대비중(위험중립 50%)이 아니라 **그 성향의 공식 리밸런싱이 만드는 위험비중**과 비교한다. 분산 최소 개수는 성향이 살 수 있는 상품 수를 넘지 않는다. 결과 화면은 별 숫자·칭호·조건 체크리스트를 같은 규칙에서 그린다.

**Tech Stack:** TypeScript, Vite, Vitest, 기존 `scripts/simulate.ts`. 새 의존성 없음.

## Global Constraints

- 원본 기획안 `퇴직연금_브루마블형_HTML5_게임_기획안.md` / `_v2.md` / `.html`은 수정하지 않는다.
- 진행 중 판 중간 저장을 넣지 않는다.
- 24칸 보드를 턴 엔진으로 되돌리지 않는다.
- 리밸런싱 목표표(`rebalanceAllocation`)와 성향별 매수 등급 게이트는 이번 범위에서 바꾸지 않는다.
- `ruleBreaches`를 올리기 시작하지 않는다. 별 조건에서만 뺀다.
- 월 연금 목표의 현재 판 반영·저장은 이번 범위 밖이다.
- 화면 문구는 쉬운 말. 법령 문장 복사 금지.
- 테스트 먼저(RED) → 최소 구현(GREEN) → 커밋.
- 검증 명령: `npm run lint && npm run typecheck && npm test`
- 작업 브랜치: `cursor/p0-market-first-loop-5ed6` (기존 PR #2).

---

## 왜 지금 사다리가 무너져 있는가 (근거)

2026-08-24, 현재 엔진으로 400회 `autoplay`(balanced/passive/contributor/growth 순환)를 돌린 결과:

- **현재 별:** 0별 298 · 1별 3 · 2별 99 · 3별 0
- 시작 IRP 1.08억 ÷ 240 = 월 45만 원. 기본 목표 50만 원의 **정확히 90%**.
- 목표 달성(100%) + 생활자금 600만 미만은 400회 중 4회. 지금의 1별 통로는 사실상 닫혀 있다.
- `ruleBreaches`는 `createGame`에서 0으로만 생기고 아무 데서도 올라가지 않는다. 2별의 「규칙 위반 0회」는 항상 참이다.
- 기본 위험중립형 리밸런싱은 ETF를 빼서 위험비중이 **21.7%**가 된다. 시작 포트폴리오도 **20%**. 둘 다 최근접 유형은 「안정형」. 진단(위험중립, 기대 50%)과 두 칸 차이라 3별 정렬이 구조적으로 실패한다.
- 안정형은 살 수 있는 상품이 2개뿐이라, 「3종 분산」을 그대로 두면 3별이 불가능하다.
- `contributor`(납입만)는 100회 중 2별 93. `steward`(납입 후 후반 리밸런싱)는 아래 추천 공식이면 80회 중 3별 61.

`IMPLEMENTATION_NOTES.md`의 옛 분포(0별 505 · 1별 5 · 2별 245 · 3별 245)는 현재 코드와 다르다.

---

## 검토한 접근 3가지

### A. 별 공식만 고친다 (추천)

리밸런싱 표·성향 게이트는 그대로 둔다. 1별은 「목표 95% 근접 또는 달성했지만 생활자금 부족」, 3별 정렬은 「공식 리밸런싱 목표비중 ±10%p」, 분산은 「3종과 허용 상품 수 중 작은 값」.

- 장점: 플레이 규칙이 안 바뀐다. 납입→2별, 납입+리밸런싱→3별이 교육 문장과 맞는다.
- 단점: 안정·안정추구형의 리밸런싱 목표 위험은 여전히 0%다. 표 자체는 후속 과제.

### B. 리밸런싱 표를 성향 기대비중에 맞춘다

별 공식은 거의 두고, 위험중립 리밸런싱이 실제로 ~50%가 되게 가중치를 바꾼다.

- 장점: 「성향 = 기대 위험」 문장이 살아난다.
- 단점: 모든 리밸런싱 결과가 바뀐다. 1별 문제와 안정형 2상품 문제는 그대로라 별 공식은 어차피 손봐야 한다.

### C. 별을 독립 배지로 바꾼다

목표 / 비상자금 / 분산을 따로 준다.

- 장점: 조건이 겹치지 않는다.
- 단점: 결과 UI·매뉴얼·「별 3개」 관용을 갈아엎는다. 초심자에게 더 어렵다.

**이 플랜은 A를 잠근다.** B의 표 수정은 후속. C는 하지 않는다.

---

## Locked rules (Approach A)

별은 누적 사다리다. 위 별을 받으면 아래 별 의미도 포함한 것으로 읽는다.

| 별 | 조건 | 칭호 |
|---|---|---|
| 0 | 월 연금 < 목표의 95% | 연금 설계 입문자 |
| 1 | (목표의 95% 이상 100% 미만) 또는 (목표 달성 + 생활자금 < 600만) | 목표에 가까워진 적립가 |
| 2 | 목표 100% 달성 + 생활자금 ≥ 600만 | 균형 잡힌 적립가 |
| 3 | 2별 + 낙폭 ≤ 12% + 분산 충족 + 성향 목표비중 정렬 | 지속 가능한 연금 설계자 |

상수 (둘 다 `balance-config.json`):

- `nearGoalRate`: `0.95`
- `profileAlignBand`: `0.10`

**95%를 쓰는 이유:** 90%는 시작 값과 같다. 90%를 1별로 두면 거의 전원이 1별이 된다.

**2별에서 `ruleBreaches`를 빼는 이유:** 지금은 늘 0이다. 시도만으로 벌점을 주면 “막힌 버튼을 눌렀더니 감점”이 된다. 필드는 남기고, 지식 점수 감점 식도 그대로 둔다(효과 없음).

**3별 정렬:**

```
|riskAssetRatio(state) - rebalanceTargetRisk(profileId)| <= profileAlignBand
```

`rebalanceTargetRisk`는 `rebalanceShares(profileId)`에 상품별 `effectiveRiskRatio`를 곱한 값이다. 위험중립형은 약 21.7%, 적극/공격은 약 29.5%, 안정/안정추구는 0%.

`behaviorProfile()`(결과 카드의 「실제 행동성향」)은 기존처럼 `expectedRiskRatio` 최근접을 유지한다. 3별 판정과 분리한다.

**분산:**

```
diversificationNeeded(profileId) = min(diversificationMin, 성향이 살 수 있는 상품 수)
```

안정형(2상품)은 2종, 나머지 기본 3종.

**결과 화면 체크리스트** (통과/미통과, 최대 5줄):

1. 월 연금 목표 95% / 100%
2. 생활자금 600만 원
3. 낙폭 12% 이하
4. 분산 n종
5. 성향 목표 위험비중 ±10%p

**자동플레이:** `AutoStrategy`에 `steward`를 추가한다. 목표가 부족하고 생활자금이 안전선+납입액보다 크면 납입, 9턴 이후면 리밸런싱, 아니면 홀드. `simulate.ts`는 다섯 전략을 순환한다.

**분포 가드 (200회, 시드 `ladder-0`…):** 1별 ≥ 10, 2별 ≥ 10. `steward` 40회(`ladder-steward-0`…)는 3별 ≥ 8. 정확한 개수는 잠그지 않는다.

**이번 범위 밖**

- 리밸런싱 가중치 재작성 (안정형 목표 0% 문제)
- `ruleBreaches` 카운트 시작
- 목표 월 연금 persist
- 바꾸기 진행/보류, 하우투, 충격 국면 이름

---

## File map

| 파일 | 역할 |
|---|---|
| `src/data/balance-config.json` | `nearGoalRate`, `profileAlignBand` |
| `src/types.ts` | `BalanceConfig` 필드, `ScoreResult.starTitle` |
| `src/engine/portfolio-engine.ts` | `rebalanceTargetRisk` |
| `src/engine/scoring-engine.ts` | 별 공식, `starTitle`, `diversificationNeeded` |
| `src/engine/game-engine.ts` | `AutoStrategy`에 `steward` |
| `src/ui/app.ts` | 칭호를 `score.starTitle`로, 체크리스트 마크업 |
| `src/styles/main.css` | 체크리스트 간격 |
| `tests/scoring.test.ts` | 별 사다리·칭호·헬퍼 (신규) |
| `tests/engine.test.ts` | 기존 3별 고정 케이스를 새 정렬에 맞게 수정 |
| `scripts/simulate.ts` | 5전략 순환 |
| `tests/star-distribution.test.ts` | 분포 하한 (신규) |
| `public/user-manual.html` | §11, 칭호, C17, C23 |
| `public/operator-manual.html` | 기준표, Q21 |
| `tests/manuals.test.ts` | 새 문구 잠금 |
| `IMPLEMENTATION_NOTES.md` | 별 공식·시뮬 숫자를 현재 규칙으로 |

---

### Task 1: 리밸런싱 목표 위험과 분산 하한 헬퍼

**Files:**
- Modify: `src/engine/portfolio-engine.ts` (파일 끝 `rebalancePortfolio` 근처)
- Modify: `src/engine/scoring-engine.ts` (`diversificationCount` 아래)
- Test: `tests/scoring.test.ts` (신규)

**Interfaces:**
- Consumes: `rebalanceShares(profileId)`, `effectiveRiskRatio`, `canBuyForProfile`, `products`, `balanceConfig.diversificationMin`
- Produces: `rebalanceTargetRisk(profileId: ProfileId): number`, `diversificationNeeded(profileId: ProfileId): number`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL (`rebalanceTargetRisk` / `diversificationNeeded` is not exported)

- [ ] **Step 3: Write minimal implementation**

`portfolio-engine.ts` — `rebalanceShares` 바로 아래:

```ts
export function rebalanceTargetRisk(profileId: GameState['profileId']): number {
  const shares = rebalanceShares(profileId);
  return products.reduce((sum, product) => sum + shares[product.id] * effectiveRiskRatio(product.id), 0);
}
```

`effectiveRiskRatio`는 이 파일에 아직 없으면 `policy-engine`에서 import 한다.

`scoring-engine.ts`:

```ts
export function diversificationNeeded(profileId: ProfileId): number {
  const allowed = products.filter((product) => canBuyForProfile(profileId, product.id).ok).length;
  return Math.min(balanceConfig.diversificationMin, Math.max(1, allowed));
}
```

`products`는 `content`, `canBuyForProfile`는 `policy-engine`에서 import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/portfolio-engine.ts src/engine/scoring-engine.ts tests/scoring.test.ts
git commit -m "Add rebalance target risk and per-profile diversification floor."
```

---

### Task 2: 별 공식과 칭호

**Files:**
- Modify: `src/data/balance-config.json`
- Modify: `src/types.ts` (`BalanceConfig`, `ScoreResult`)
- Modify: `src/engine/scoring-engine.ts` (`calculateScore`)
- Modify: `tests/scoring.test.ts`
- Modify: `tests/engine.test.ts` (`월 연금과 별 등급을 정확히 계산한다`)

**Interfaces:**
- Consumes: Task 1 헬퍼, `balanceConfig.nearGoalRate`, `balanceConfig.profileAlignBand`
- Produces: `starTitle(stars: 0|1|2|3): string`, `ScoreResult.starTitle`, 새 별 규칙. `behaviorProfile` 시그니처 유지.

- [ ] **Step 1: Write the failing tests**

`tests/scoring.test.ts`에 추가. `createGame` + 필드 덮어쓰기로 상태를 만든다.

```ts
import { createGame } from '../src/engine/game-engine';
import { calculateScore, starTitle } from '../src/engine/scoring-engine';
import { rebalancePortfolio } from '../src/engine/portfolio-engine';

function withHoldings(state: ReturnType<typeof createGame>, holdings: typeof state.holdings, extra: Partial<typeof state> = {}) {
  return { ...state, holdings, irpCash: 0, ...extra };
}

it('목표 95% 미만은 0별, 95%대는 1별이다', () => {
  const base = createGame('score-0');
  const low = withHoldings(base, [
    { productId: 'deposit', amount: 108_000_000, principal: 108_000_000, depositTurnsHeld: 4 }
  ], { cash: 10_000_000, goalMonthly: 500_000 });
  expect(calculateScore(low).stars).toBe(0);

  const near = withHoldings(base, [
    { productId: 'deposit', amount: 115_000_000, principal: 115_000_000, depositTurnsHeld: 4 }
  ], { cash: 10_000_000, goalMonthly: 500_000 });
  expect(calculateScore(near).stars).toBe(1);
  expect(calculateScore(near).starTitle).toBe('목표에 가까워진 적립가');
});

it('목표는 됐지만 생활자금이 부족하면 1별이다', () => {
  const state = withHoldings(createGame('score-cash'), [
    { productId: 'deposit', amount: 120_000_000, principal: 120_000_000, depositTurnsHeld: 4 }
  ], { cash: 1_000_000, goalMonthly: 500_000 });
  expect(calculateScore(state).stars).toBe(1);
});

it('목표+생활자금이면 2별이고, 분산이 부족하면 3별이 아니다', () => {
  const state = withHoldings(createGame('score-2'), [
    { productId: 'deposit', amount: 72_000_000, principal: 72_000_000, depositTurnsHeld: 4 },
    { productId: 'balanced', amount: 48_000_000, principal: 48_000_000, depositTurnsHeld: 0 }
  ], { cash: 10_000_000, goalMonthly: 500_000, maxDrawdown: 0.05 });
  const score = calculateScore(state);
  expect(score.stars).toBe(2);
  expect(score.starTitle).toBe('균형 잡힌 적립가');
});

it('납입 후 공식 리밸런싱에 가깝고 분산되면 3별이다', () => {
  const rich = { ...createGame('score-3', 'balanced', 400_000), cash: 10_000_000, maxDrawdown: 0.05 };
  const rebalanced = rebalancePortfolio(rich).state;
  const score = calculateScore({ ...rebalanced, cash: 10_000_000, maxDrawdown: 0.05 });
  expect(score.goalMet).toBe(true);
  expect(score.stars).toBe(3);
  expect(starTitle(3)).toBe('지속 가능한 연금 설계자');
});
```

`tests/engine.test.ts`의 기존 3별 픽스처(ETF 50%라 새 정렬 실패)는 이 테스트가 통과한 뒤 Task 2 Step 3에서 `rebalancePortfolio` 픽스처로 교체한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL (시작 1.08억이 지금 규칙에선 0별이 아니라, 또는 `starTitle` 없음 / 3별 조건 불일치)

- [ ] **Step 3: Write minimal implementation**

`balance-config.json`에 추가:

```json
"nearGoalRate": 0.95,
"profileAlignBand": 0.10
```

`types.ts` `BalanceConfig`에 같은 두 필드. `ScoreResult`에 `starTitle: string`.

`scoring-engine.ts`:

```ts
export function starTitle(stars: 0 | 1 | 2 | 3): string {
  return ['연금 설계 입문자', '목표에 가까워진 적립가', '균형 잡힌 적립가', '지속 가능한 연금 설계자'][stars];
}

export function calculateScore(state: GameState): ScoreResult {
  // ... 기존 irp/pension/goalRate/goalMet/riskRatio/diversification/actualProfile 계산 유지
  const profileAligned = Math.abs(riskRatio - rebalanceTargetRisk(state.profileId)) <= balanceConfig.profileAlignBand;
  const safeCash = state.cash >= balanceConfig.safeCashThreshold;
  const drawdownOk = state.maxDrawdown <= balanceConfig.maxDrawdownThreshold;
  const diversified = diversification >= diversificationNeeded(state.profileId);
  const nearGoal = goalRate >= balanceConfig.nearGoalRate;

  let stars: 0 | 1 | 2 | 3 = 0;
  if (nearGoal && !goalMet) stars = 1;
  if (goalMet && !safeCash) stars = 1;
  if (goalMet && safeCash) stars = 2;
  if (stars === 2 && drawdownOk && diversified && profileAligned) stars = 3;

  return {
    /* 기존 필드 유지 */
    stars,
    starTitle: starTitle(stars),
    profileAligned,
    /* obeyedRules / ruleBreaches는 knowledgeScore에만 사용 */
  };
}
```

`behaviorProfile`과 `knowledgeScore`의 `ruleBreaches` 감점은 그대로 둔다.

`tests/engine.test.ts` 3별 픽스처를 Task 2의 리밸런싱 픽스처와 같게 바꾼다.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/scoring.test.ts tests/engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/balance-config.json src/types.ts src/engine/scoring-engine.ts tests/scoring.test.ts tests/engine.test.ts
git commit -m "Recalculate stars so 1 and 3 are reachable."
```

---

### Task 3: 결과 화면 칭호와 체크리스트

**Files:**
- Modify: `src/ui/app.ts` (`renderResult` 점수 칭호 줄)
- Modify: `src/styles/main.css` (기존 `.score-breakdown` 근처)
- Test: `tests/scoring.test.ts`에 순수 마크업 함수가 없으면, 체크리스트 문자열을 `scoring-engine`의 `starChecklist(score, state)`로 빼서 테스트한다.

**Interfaces:**
- Consumes: `ScoreResult.starTitle`, `goalMet`, `goalRate`, `safeCash`에 해당하는 `cash`, `maxDrawdown`, `diversification`, `profileAligned`
- Produces: `starChecklist(state, score): { label: string; passed: boolean }[]` (최대 5개, 문장은 테스트에 고정)

- [ ] **Step 1: Write the failing test**

```ts
import { starChecklist } from '../src/engine/scoring-engine';

it('체크리스트는 목표·생활자금·낙폭·분산·정렬 다섯 줄이다', () => {
  const state = withHoldings(createGame('list'), [
    { productId: 'deposit', amount: 108_000_000, principal: 108_000_000, depositTurnsHeld: 4 }
  ], { cash: 10_000_000, goalMonthly: 500_000, maxDrawdown: 0 });
  const rows = starChecklist(state, calculateScore(state));
  expect(rows.map((row) => row.label)).toEqual([
    '월 연금이 목표의 95%에 닿음',
    '생활자금 600만 원',
    '낙폭 12% 이하',
    '분산 3종 이상',
    '성향 목표 위험비중과 10%p 이내'
  ]);
  expect(rows[0].passed).toBe(false);
  expect(rows[1].passed).toBe(true);
});
```

안정형 픽스처를 쓸 때는 네 번째 줄이 `분산 2종 이상`이 되어야 한다. 라벨은 `diversificationNeeded`로 만든다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL (`starChecklist` is not exported)

- [ ] **Step 3: Write minimal implementation**

```ts
export function starChecklist(state: GameState, score: ScoreResult): { label: string; passed: boolean }[] {
  const need = diversificationNeeded(state.profileId);
  return [
    { label: `월 연금이 목표의 ${Math.round(balanceConfig.nearGoalRate * 100)}%에 닿음`, passed: score.goalRate >= balanceConfig.nearGoalRate },
    { label: `생활자금 ${(balanceConfig.safeCashThreshold / 10000).toFixed(0)}만 원`, passed: state.cash >= balanceConfig.safeCashThreshold },
    { label: `낙폭 ${Math.round(balanceConfig.maxDrawdownThreshold * 100)}% 이하`, passed: state.maxDrawdown <= balanceConfig.maxDrawdownThreshold },
    { label: `분산 ${need}종 이상`, passed: score.diversification >= need },
    { label: `성향 목표 위험비중과 ${Math.round(balanceConfig.profileAlignBand * 100)}%p 이내`, passed: score.profileAligned }
  ];
}
```

`app.ts` 칭호 삼항을 `${score.starTitle}`로 교체. 별 아이콘 아래에 체크리스트:

```ts
const checks = starChecklist(this.game, score);
// ...
`<ul class="star-checks">${checks.map((row) =>
  `<li class="${row.passed ? 'ok' : 'miss'}">${row.passed ? '됨' : '아직'} · ${row.label}</li>`
).join('')}</ul>`
```

CSS는 기존 결과 카드 톤을 따른다. 새 색 팔레트를 만들지 않는다.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/scoring.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/scoring-engine.ts src/ui/app.ts src/styles/main.css tests/scoring.test.ts
git commit -m "Show a per-star checklist on the result screen."
```

---

### Task 4: steward 자동플레이와 분포 가드

**Files:**
- Modify: `src/engine/game-engine.ts` (`AutoStrategy`, `autoplay`)
- Modify: `scripts/simulate.ts`
- Test: `tests/star-distribution.test.ts` (신규)

**Interfaces:**
- Consumes: `createGame(seed, profileId?)` — steward는 기본 `balanced`
- Produces: `AutoStrategy = 'balanced' | 'passive' | 'contributor' | 'growth' | 'steward'`

- [ ] **Step 1: Write the failing test**

```ts
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
    expect(stars[1]).toBeGreaterThanOrEqual(10);
    expect(stars[2]).toBeGreaterThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/star-distribution.test.ts`
Expected: FAIL (`steward`가 없어 타입/런타임 오류, 또는 3별 0)

- [ ] **Step 3: Write minimal implementation**

`game-engine.ts`:

```ts
export type AutoStrategy = 'balanced' | 'passive' | 'contributor' | 'growth' | 'steward';

// autoplay 루프 안:
else if (strategy === 'steward') {
  const pension = monthlyPension(portfolioValue(state));
  action = pension < state.goalMonthly && state.cash > balanceConfig.safeCashThreshold + balanceConfig.contributionAmount
    ? { kind: 'contribute' }
    : state.turn >= 9
      ? { kind: 'rebalance' }
      : { kind: 'hold' };
}
```

`monthlyPension`은 `scoring-engine`에서 import. 순환 import가 나면 월 연금 식을 여기서 `portfolioValue(state) / policyRules.receivingMonths`로 인라인한다.

`scripts/simulate.ts`의 전략 배열을 다섯 개로 늘린다.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/star-distribution.test.ts tests/engine.test.ts`
Expected: PASS. 분포 테스트는 시드가 고정이라 재현된다. 200회라 몇 초 걸릴 수 있다.

- [ ] **Step 5: Commit**

```bash
git add src/engine/game-engine.ts scripts/simulate.ts tests/star-distribution.test.ts
git commit -m "Guard star distribution with a steward autoplay path."
```

---

### Task 5: 매뉴얼과 구현 기록

**Files:**
- Modify: `public/user-manual.html` §11, C17, 새 C23
- Modify: `public/operator-manual.html` 기준표, Q21
- Modify: `tests/manuals.test.ts`
- Modify: `IMPLEMENTATION_NOTES.md` 별 분포·공식 문장

**Interfaces:**
- Consumes: Task 2–4에서 잠근 문장
- Produces: 매뉴얼 문자열 테스트

- [ ] **Step 1: Write the failing test**

`tests/manuals.test.ts`에 추가:

```ts
expect(user).toContain('목표에 가까워진 적립가');
expect(user).toContain('목표의 95%');
expect(user).toContain('C23');
expect(user).toContain('리밸런싱 목표 위험비중');
expect(operator).toContain('Q21');
expect(operator).toContain('nearGoalRate');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/manuals.test.ts`
Expected: FAIL (문구 없음)

- [ ] **Step 3: Write the copy**

사용자 매뉴얼 §11을 아래로 교체한다:

```html
<li>월 연금 = 최종 IRP ÷ 240. 목표의 95% 이상이면 1별, 100%이고 생활자금 600만 원 이상이면 2별.</li>
<li>낙폭 12% 이하 + 성향이 살 수 있는 범위에서 5% 이상 자산(기본 3종, 안정형은 2종) + 공식 리밸런싱 목표 위험비중과 10%p 이내면 3별.</li>
<li>칭호: 0별 연금 설계 입문자 · 1별 목표에 가까워진 적립가 · 2별 균형 잡힌 적립가 · 3별 지속 가능한 연금 설계자.</li>
<li>규칙 위반 횟수는 별에 넣지 않습니다. 시장이 70%를 넘긴 것도 위반으로 세지 않습니다.</li>
```

C17: 행동성향 카드는 최근접 유형 유지. 3별 정렬은 **리밸런싱 목표 위험비중**과 비교한다고 고친다.

C23 제목: `납입만 했는데 3별이 아니다`

본문: `2별까지는 목표와 생활자금입니다. 3별은 분산과 성향 목표비중이 필요합니다. 후반에 한 번 리밸런싱하면 기본 성향에서도 열립니다.`

운영 매뉴얼 기준표: `1별 근접 95% / 정렬 ±10%p / 안정형 분산 2종`. Q21: 위험중립형으로 납입만 12턴 → 2별, 9턴 이후 리밸런싱 포함 → 3별 가능.

`IMPLEMENTATION_NOTES.md`의 2026-08-12 분포 숫자는 “당시 기록, 현재 공식과 다름”으로 표시하고, 새 공식과 `npm run simulate` 한 줄 요약을 적는다. 시뮬은 Step 3에서 실제로 돌린 숫자를 넣는다.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/manuals.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/user-manual.html public/operator-manual.html tests/manuals.test.ts IMPLEMENTATION_NOTES.md
git commit -m "Document the reachable star ladder in the manuals."
```

---

### Task 6: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: Lint, types, tests**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 전부 통과. 테스트 개수는 기존 79 + scoring/distribution 케이스만큼 증가.

- [ ] **Step 2: 시뮬 한 줄 확인**

Run: `npm run simulate -- --runs=200`
Expected: 오류 0, 미종료 0. 1별·2별이 0이 아니다. `steward`가 섞여 3별도 0이 아니어야 한다.

- [ ] **Step 3: Commit only if notes 숫자를 Step 2 출력에 맞춰 고친 경우**

```bash
git add IMPLEMENTATION_NOTES.md
git commit -m "Record the post-ladder simulation counts."
```

---

## Self-review

1. **Spec coverage:** 1별 95%, 2별에서 ruleBreaches 제거, 3별 리밸런싱 목표 정렬, 성향별 분산, 칭호 4종, 체크리스트, steward, 매뉴얼 C23 — Task 1–5에 대응. 리밸런싱 표·목표 persist는 명시적 제외.
2. **Placeholder scan:** TBD/TODO 없음. 테스트 코드와 교체 문장을 본문에 적음.
3. **Type consistency:** `rebalanceTargetRisk`, `diversificationNeeded`, `starTitle`, `starChecklist`, `AutoStrategy`의 `steward`, `nearGoalRate`, `profileAlignBand`가 Task 사이에 동일하다.

---

## 수정 여부 결정용 한 줄

이 플랜을 실행하면 결과 화면의 별·칭호·체크리스트와 매뉴얼이 바뀐다. 매수/리밸런싱 *동작*은 바뀌지 않는다. 실행 전에 운영자가 Approach A를 받아들일지 고르면 된다.
