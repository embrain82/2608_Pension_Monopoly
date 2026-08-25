# 목표 저장 · 첫 판 안내 · 충격 국면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 이 문서는 **서로 독립인 세 작업**이다. 운영자가 2·3·4 중 일부만 골라도 된다. 고른 항목의 Task만 실행한다. 항목 사이 공통 코드는 없다.

**Goal:** (2) 월 연금 목표가 성향처럼 지금 판과 새로고침 후에도 남게 한다. (3) 첫 판에서 「먼저 납입」과 ETF 제한을 하우투·매수 화면에서 바로 보게 한다. (4) 주가 충격 턴의 국면 이름을 수익률과 맞춘다.

**Architecture:** 목표는 `SaveData.goalMonthly` + `applyGoalToGame`으로 성향과 같은 경로를 탄다. 첫 판 안내는 `renderHowToModal` 문구와 매수 기본 상품·납입 CTA만 바꾼다. 충격 국면은 `briefingFor('equity-drop')`의 `phase` 한 줄을 고친다.

**Tech Stack:** TypeScript, Vite, Vitest, LocalStorage. 새 의존성 없음.

## Global Constraints

- 원본 기획안 `퇴직연금_브루마블형_HTML5_게임_기획안.md` / `_v2.md` / `.html`은 수정하지 않는다.
- 진행 중 판 중간 저장(포트폴리오 스냅샷)을 넣지 않는다. 목표 숫자만 저장한다.
- 24칸 보드를 턴 엔진으로 되돌리지 않는다.
- 성향별 매수 등급 게이트와 리밸런싱 목표표는 바꾸지 않는다.
- 시작 IRP·생활자금·기본 목표 50만 원 밸런스 숫자는 바꾸지 않는다.
- 화면 문구는 쉬운 말. 법령 문장 복사 금지.
- 테스트 먼저(RED) → 최소 구현(GREEN) → 커밋.
- 검증 명령: `npm run lint && npm run typecheck && npm test`
- 작업 브랜치: `cursor/p0-market-first-loop-5ed6` (기존 PR #2).

---

## 항목별로 고를 수 있는 이유

| 번호 | 만지는 핵심 파일 | 다른 항목과 겹침 |
|---|---|---|
| 2 목표 저장 | `ui-state.ts`, `types.ts`, `game-engine.ts`, `app.ts` 목표 버튼 | 없음 |
| 3 첫 판 안내 | `howto.ts`, `app.ts` 매수 기본값·CTA | 없음 |
| 4 충격 국면 | `market-engine.ts` | 없음 |

매뉴얼(`user-manual.html`, `operator-manual.html`, `tests/manuals.test.ts`)만 고른 항목의 문구를 같이 고친다.

---

## 2. 목표 저장

### 지금

- `App.goalMonthly`는 메모리 기본 50만 원이다. `SaveData`에 필드가 없다.
- `goal-next`는 「다음 판에 적용」만 말하고 `this.game.goalMonthly`를 안 바꾼다.
- 새로고침하면 50만 원으로 돌아간다. 성향(`profileId`)만 저장·지금 판 반영이다.
- 사용자 매뉴얼 C13이 이 의도를 적어 두었다.

### 접근

**A. 성향과 똑같이 (추천)**  
저장하고, 진행 중이면 지금 판 HUD·별 계산에도 즉시 넣는다.

**B. 저장만, 반영은 다음 판**  
새로고침은 고쳐지지만 「저장했는데 달성률이 그대로」는 남는다.

**C. 지금 판만, 저장 없음**  
한 판 안에서는 맞지만 새로고침하면 다시 50만 원이다.

**잠금: A.** 버튼 문구 「이 목표 저장」과 맞다.

### Locked rules (2)

- `SaveData.goalMonthly: number`. 키는 그대로 `pension-road-save-v1`, 버전은 2.
- 없거나 잘못된 값은 `balanceConfig.defaultGoal`(500000). 범위는 `minGoal`~`maxGoal`.
- `applyGoalToGame(game, goalMonthly)`는 `createGame`과 같은 클램프로 `game.goalMonthly`만 바꾼다.
- `goal-next`: `save.goalMonthly` 저장 → 게임이 있으면 `applyGoalToGame` → 안내 `월 연금 목표 N원이 지금 판에 반영되었습니다.`
- 앱 시작 시 `this.goalMonthly = clampGoalMonthly(this.save.goalMonthly)`.
- 새 판 `createGame(seed, profileId, this.goalMonthly)`는 이미 저장된 값을 쓴다.
- C13을 「지금 판 + 이 브라우저에 저장」으로 고친다. 포트폴리오 중간 저장은 여전히 없다.

---

## 3. 첫 판 안내

### 지금

- 하우투 3단계: 주사위 → 시장 → 운용. 「먼저 납입」, 정산 요약, ETF 제한이 없다.
- 시작 `irpCash === 0`. 매수 기본 상품은 `shortBond`(펀드, 다음 턴). 첫 매수는 「IRP 대기자금이 부족합니다」로 비활성.
- 기본 성향 위험중립형은 ETF를 살 수 없다(게이트 유지).

### 접근

**A. 안내 + 기본값 + 납입 버튼 (추천)**  
하우투를 4단계로 늘리고, 매수 기본을 예금으로, 대기자금 부족 시 「먼저 납입하기」를 둔다. 게이트·시작 잔고는 그대로.

**B. 하우투 문구만**  
화면은 그대로라 첫 매수에서 또 막힌다.

**C. 시작 대기자금을 넣어 바로 매수**  
밸런스·별 사다리가 흔들린다. 하지 않는다.

**잠금: A.** ETF 하드 게이트는 유지하고, 왜 막히는지만 알려 준다.

### Locked rules (3)

하우투 4단계 문장(테스트에 고정):

1. `주사위 굴리기` — `나온 숫자만큼 말이 이동합니다.`
2. `시장 확인` — `이번 턴 수익률을 봅니다. 아직 잔고에는 안 들어갑니다.`
3. `먼저 납입, 그다음 매수` — `시작할 때 대기자금은 0원입니다. 사려면 먼저 납입하세요. 주식 ETF는 적극투자형·공격투자형 진단 뒤에만 살 수 있습니다.`
4. `정산 한 번` — `행동을 고르면 정산 요약이 열립니다. 한 턴에 운용은 한 번입니다.`

- `selectedBuy` 초기값과 `startGame` 리셋은 `'deposit'`.
- 매수 화면에서 `game.irpCash < 100000`이면 미리보기 아래 `먼저 납입하기` 버튼(`data-action="action-view" data-view="contribute"`). 매수 실행은 기존처럼 비활성.
- 성향 게이트·상품 목록 「성향 밖」은 그대로.

---

## 4. 충격 국면 이름

### 지금

`briefingFor`의 `equity-drop` 분기가 `phase: kind ? '기준금리 인상' : ...`이다. 주가 충격도 국면 이름이 금리 인상이다. 헤드라인(「긴축과 변동성」)과 ETF −7%는 맞는데, 턴 트랙·카드의 `phase`만 틀린다.

기존 테스트 `충격 턴은 큰 움직임과 같은 방향의 문구를 갖는다`는 headline/reason/signal만 보고 `phase`는 안 본다.

### 접근

**A. equity-drop의 phase만 고친다 (추천)**  
`위험자산 충격`. 헤드라인·신호·수익률 식은 그대로.

**B. 충격 카피 전체를 다시 쓴다**  
필요 이상이다.

**C. 국면 이름을 UI에서 뺀다**  
교육 게임이 숫자와 이름을 같이 보여 주는 편이 낫다.

**잠금: A.**

### Locked rules (4)

| kind | phase (고정 문자열) |
|---|---|
| `rate-hike` | `기준금리 인상` |
| `equity-drop` | `위험자산 충격` |
| 비충격, 금리↑ 우세 | `물가상승` (기존) |
| 그 외 비충격 | 기존 분기 유지 |

- `equity-drop` 턴은 `returns.equityEtf <= -0.07`이고 `phase === '위험자산 충격'`.
- `rate-hike` 턴은 `phase === '기준금리 인상'`을 유지.
- 수익률 공식·충격 턴 개수(2회, 3–10턴)는 그대로.

---

## File map

| 파일 | 2 | 3 | 4 |
|---|---|---|---|
| `src/types.ts` | `SaveData.goalMonthly` | | |
| `src/ui/ui-state.ts` | 저장·복구 | | |
| `src/engine/game-engine.ts` | `clampGoalMonthly`, `applyGoalToGame` | | |
| `src/ui/app.ts` | `goal-next`, 초기값 | `selectedBuy`, 납입 CTA | |
| `src/ui/howto.ts` | | 4단계 | |
| `src/engine/market-engine.ts` | | | `briefingFor` |
| `tests/engine.test.ts` | 저장 복구 | | `phase` 단언 |
| `tests/market-view.test.ts` | | 하우투 문구 | |
| `public/user-manual.html` | §1, C13 | 따라하기·하우투 | C18 |
| `public/operator-manual.html` | 저장 표, Q22 | Q23 | |
| `tests/manuals.test.ts` | 새 문구 | 새 문구 | 새 문구 |

---

### Task 1 (항목 2): 목표 클램프와 현재 판 반영

**Files:**
- Modify: `src/engine/game-engine.ts` (`createGame` 위)
- Test: `tests/engine.test.ts` (`점수와 저장 복구` describe)

**Interfaces:**
- Consumes: `balanceConfig.minGoal`, `maxGoal`, `defaultGoal`
- Produces: `clampGoalMonthly(value: number): number`, `applyGoalToGame(game: GameState, goalMonthly: number): GameState`

- [ ] **Step 1: Write the failing test**

```ts
import { applyGoalToGame, clampGoalMonthly, createGame } from '../src/engine/game-engine';

it('월 연금 목표는 지금 판에 바로 들어가고 범위를 벗어나지 않는다', () => {
  expect(clampGoalMonthly(370_000)).toBe(350_000);
  expect(clampGoalMonthly(800_000)).toBe(700_000);
  const game = createGame('goal-now', 'balanced', 500_000);
  const next = applyGoalToGame(game, 600_000);
  expect(next.goalMonthly).toBe(600_000);
  expect(game.goalMonthly).toBe(500_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine.test.ts -t "월 연금 목표"`
Expected: FAIL (export 없음)

- [ ] **Step 3: Write minimal implementation**

```ts
export function clampGoalMonthly(value: number): number {
  if (!Number.isFinite(value)) return balanceConfig.defaultGoal;
  return Math.min(balanceConfig.maxGoal, Math.max(balanceConfig.minGoal, Math.round(value)));
}

export function applyGoalToGame(game: GameState, goalMonthly: number): GameState {
  const next = clampGoalMonthly(goalMonthly);
  return game.goalMonthly === next ? game : { ...game, goalMonthly: next };
}
```

`createGame`의 기존 클램프를 `clampGoalMonthly(goalMonthly)`로 바꾼다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine.test.ts -t "월 연금 목표"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/game-engine.ts tests/engine.test.ts
git commit -m "Apply a clamped monthly goal to the current game."
```

---

### Task 2 (항목 2): SaveData에 목표 저장

**Files:**
- Modify: `src/types.ts` `SaveData`
- Modify: `src/ui/ui-state.ts`
- Modify: `tests/engine.test.ts` (기존 v1 복구 + 성향 복구 근처)

**Interfaces:**
- Consumes: Task 1 `clampGoalMonthly`
- Produces: `SaveData.goalMonthly`, `defaultSave.goalMonthly === 500000`

- [ ] **Step 1: Write the failing test**

```ts
it('저장 데이터의 월 연금 목표를 복구한다', () => {
  const stored = {
    getItem: (key: string) => key === STORAGE_KEY
      ? JSON.stringify({ ...defaultSave, goalMonthly: 600_000 })
      : null
  };
  expect(loadSave(stored).goalMonthly).toBe(600_000);
});

it('목표 없는 옛 저장은 기본 50만 원이다', () => {
  const legacy = {
    getItem: (key: string) => key === STORAGE_KEY
      ? JSON.stringify({ version: 1, settings: { reducedMotion: true, sound: false }, unlockedCards: ['rate-bond'], bestScore: 88, lastSeed: 'abc' })
      : null
  };
  expect(loadSave(legacy).goalMonthly).toBe(500_000);
});
```

기존 `v1 저장 데이터를 v2 기본값으로 복구한다`에 `expect(loaded.goalMonthly).toBe(500_000)`를 넣어도 된다. 중복이면 위 두 개만 쓴다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine.test.ts -t "월 연금 목표를 복구"`
Expected: FAIL (`goalMonthly` undefined)

- [ ] **Step 3: Write minimal implementation**

`SaveData`에 `goalMonthly: number`.

`defaultSave.goalMonthly = 500000` (또는 `balanceConfig.defaultGoal` — ui-state가 content를 안 쓰면 숫자 500000을 박는다).

`migrateSave`에서:

```ts
goalMonthly: clampGoalMonthly(finiteNumber(data.goalMonthly) ? data.goalMonthly : 500_000)
```

순환 import를 피하려면 `clampGoalMonthly`를 `src/engine/goal.ts`로 빼도 된다. 순환이 없으면 `game-engine`에서 import.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/engine.test.ts`
Expected: PASS. `defaultSave`를 비교하는 테스트가 있으면 새 필드를 기대값에 넣는다.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/ui/ui-state.ts tests/engine.test.ts src/engine/game-engine.ts src/engine/goal.ts
git commit -m "Persist the monthly pension goal in save data."
```

(`goal.ts`를 안 만들었으면 그 경로는 add 하지 않는다.)

---

### Task 3 (항목 2): 설정 버튼이 지금 판과 저장을 같이 한다

**Files:**
- Modify: `src/ui/app.ts` (`goalMonthly` 초기화, `goal-next`)

**Interfaces:**
- Consumes: `applyGoalToGame`, `this.save.goalMonthly`
- Produces: 안내 문장 `월 연금 목표 ${formatWon(this.goalMonthly)}이 지금 판에 반영되었습니다.`

앱 클래스 단위 테스트가 없으면, 저장 경로 테스트(Task 2)와 매뉴얼 문구(Task 7)로 잠근다. 구현은 아래를 그대로 쓴다.

```ts
private goalMonthly = clampGoalMonthly(this.save.goalMonthly);

} else if (action === 'goal-next') {
  this.save.goalMonthly = clampGoalMonthly(this.goalMonthly);
  this.goalMonthly = this.save.goalMonthly;
  if (this.game) this.game = applyGoalToGame(this.game, this.goalMonthly);
  this.persist();
  this.screen = this.setupReturn === 'game' && this.game ? 'game' : 'title';
  this.announce(`월 연금 목표 ${formatWon(this.goalMonthly)}이 지금 판에 반영되었습니다.`);
}
```

슬라이더 `onChange`는 메모리만 바꾸고, 저장은 버튼에서만 한다(성향 설문과 같음: 마쳐야 저장).

- [ ] **Step 1–4:** 위 코드 적용 후 `npm test` PASS
- [ ] **Step 5: Commit**

```bash
git add src/ui/app.ts
git commit -m "Save the goal and apply it to the current game."
```

---

### Task 4 (항목 3): 하우투 4단계

**Files:**
- Modify: `src/ui/howto.ts`
- Modify: `tests/market-view.test.ts` (`게임 방법 팝업`)

**Interfaces:**
- Consumes: 없음
- Produces: `renderHowToModal()` 4단계. 기존 「주사위」「시장」「운용」 단어는 유지해 옛 테스트가 깨지지 않게 한다.

- [ ] **Step 1: Write the failing assertions** (기존 it에 추가하거나 새 it)

```ts
it('첫 판에 납입·ETF 제한·정산을 알려 준다', () => {
  const markup = renderHowToModal();
  expect(markup).toContain('대기자금은 0원');
  expect(markup).toContain('먼저 납입');
  expect(markup).toContain('주식 ETF');
  expect(markup).toContain('정산 요약');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/market-view.test.ts -t "납입"`
Expected: FAIL

- [ ] **Step 3: Replace `renderHowToModal` body**

```ts
export function renderHowToModal(): string {
  return `<p class="eyebrow">처음 한 번만 보여 줍니다</p>
    <h2>한 턴은 이렇게 진행됩니다</h2>
    <ol class="howto-steps">
      <li><b>1</b><div><strong>주사위 굴리기</strong><p>나온 숫자만큼 말이 이동합니다.</p></div></li>
      <li><b>2</b><div><strong>시장 확인</strong><p>이번 턴 수익률을 봅니다. 아직 잔고에는 안 들어갑니다.</p></div></li>
      <li><b>3</b><div><strong>먼저 납입, 그다음 매수</strong><p>시작할 때 대기자금은 0원입니다. 사려면 먼저 납입하세요. 주식 ETF는 적극투자형·공격투자형 진단 뒤에만 살 수 있습니다.</p></div></li>
      <li><b>4</b><div><strong>정산 한 번</strong><p>행동을 고르면 정산 요약이 열립니다. 한 턴에 운용은 한 번입니다.</p></div></li>
    </ol>
    <p>12턴 동안 목표 월 연금에 도전합니다. 오른쪽 위 성향 이름을 확인하고, 성향보다 높은 등급 상품은 살 수 없습니다. 이 안내는 설정에서 다시 볼 수 있습니다.</p>
    <button class="primary jumbo" data-action="dismiss-howto">알겠어요</button>`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/market-view.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/howto.ts tests/market-view.test.ts
git commit -m "Teach first-play deposit and ETF limits in the how-to."
```

---

### Task 5 (항목 3): 매수 기본 예금과 납입 CTA

**Files:**
- Modify: `src/ui/app.ts` (`selectedBuy` 두 곳, 매수 뷰)

**Interfaces:**
- Produces: 대기자금 부족 시 버튼 라벨 `먼저 납입하기`

순수 함수로 CTA를 빼 테스트한다.

```ts
// src/ui/howto.ts 또는 app 근처 작은 export
export function buyNeedsContribution(irpCash: number): boolean {
  return irpCash < 100000;
}
```

- [ ] **Step 1: Failing test** in `tests/market-view.test.ts`

```ts
import { buyNeedsContribution } from '../src/ui/howto';

it('대기자금이 없으면 매수 전에 납입이 필요하다', () => {
  expect(buyNeedsContribution(0)).toBe(true);
  expect(buyNeedsContribution(100000)).toBe(false);
});
```

- [ ] **Step 2:** FAIL → **Step 3:** 함수 + 앱 연결

`selectedBuy` 선언과 `startGame` 리셋을 `'deposit'`으로.

매수 뷰 `actions`가 일반 매수 버튼일 때:

```ts
const contributeCta = buyNeedsContribution(game.irpCash)
  ? `<button class="secondary" data-action="action-view" data-view="contribute">먼저 납입하기</button>`
  : '';
```

`button-stack`으로 매수(disabled)와 나란히 둔다.

- [ ] **Step 4:** `npx vitest run tests/market-view.test.ts` PASS
- [ ] **Step 5: Commit**

```bash
git add src/ui/app.ts src/ui/howto.ts tests/market-view.test.ts
git commit -m "Default buy to deposit and send empty cash to contribute."
```

---

### Task 6 (항목 4): equity-drop 국면 이름

**Files:**
- Modify: `src/engine/market-engine.ts` (`briefingFor`)
- Modify: `tests/engine.test.ts` (`충격 턴은 큰 움직임과 같은 방향의 문구를 갖는다`)

**Interfaces:**
- Produces: phase 문자열 `위험자산 충격`

- [ ] **Step 1: Extend the existing shock-copy test**

```ts
        if (rateShock) {
          expect(step.returns.longBond).toBeLessThan(step.returns.shortBond);
          expect(text).toMatch(/장기채|금리/);
          expect(step.phase).toBe('기준금리 인상');
        }
        if (equityShock && !rateShock) {
          expect(step.returns.equityEtf).toBeLessThan(0);
          expect(text).toMatch(/주식|변동/);
          expect(step.phase).toBe('위험자산 충격');
        }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine.test.ts -t "같은 방향의 문구"`
Expected: FAIL (`expected '기준금리 인상' to be '위험자산 충격'`)

- [ ] **Step 3: Minimal fix**

`briefingFor` equity-drop 분기:

```ts
  if (kind === 'equity-drop' || stockChange < 0) {
    return {
      phase: kind ? '위험자산 충격' : '경기둔화·전환 기대',
      headline: kind ? '긴축과 변동성이 위험자산을 흔듭니다' : '위험자산이 숨을 고릅니다',
      signal: '금리 → · 주식 ↘',
      reason: '높은 금리와 불확실성이 겹치면 주식형 자산이 채권보다 크게 흔들릴 수 있습니다.'
    };
  }
```

- [ ] **Step 4:** 같은 테스트 PASS
- [ ] **Step 5: Commit**

```bash
git add src/engine/market-engine.ts tests/engine.test.ts
git commit -m "Name equity-drop turns as a risk-asset shock."
```

---

### Task 7: 고른 항목의 매뉴얼만

실행한 항목에 해당하는 줄만 넣는다.

**Files:** `public/user-manual.html`, `public/operator-manual.html`, `tests/manuals.test.ts`

- [ ] **Step 1: Failing string tests** (고른 것만)

항목 2:

```ts
expect(user).toContain('지금 판에 반영');
expect(user).toContain('이 브라우저에 저장');
expect(operator).toContain('goalMonthly');
expect(operator).toContain('Q22');
```

C13 본문: `지금은 저장하면 지금 판 달성률과 별 기준이 바로 바뀌고, 이 브라우저를 다시 열어도 목표가 남습니다. 진행 중인 포트폴리오는 여전히 저장하지 않습니다.`

§1 불릿에서 「다음 판을 시작할 때」를 같은 뜻으로 교체. 기존 `tests/manuals.test.ts`의 `다음 판을 시작할 때`는 목표 문장이 아니면 유지하고, 목표 문장이면 새 문구로 바꾼다.

Q22: `게임 중 목표를 60만 원으로 저장` → `HUD 달성률·결과 목표 금액이 60만. 새로고침 후 바로 시작해도 60만.`

항목 3:

```ts
expect(user).toContain('대기자금은 0원');
expect(user).toContain('먼저 납입하기');
expect(operator).toContain('Q23');
```

따라하기에 「대기자금 0 → 납입 후 매수」한 줄. Q23: `바로 시작 후 매수 탭` → `기본 상품 예금. 납입 전 「먼저 납입하기」. ETF는 성향 밖.`

항목 4:

```ts
expect(user).toContain('위험자산 충격');
```

C18에 `주가 충격 턴의 국면 이름은 위험자산 충격입니다. 기준금리 인상이라고 쓰지 않습니다.`

- [ ] **Step 2:** FAIL → **Step 3:** 카피 → **Step 4:** `npx vitest run tests/manuals.test.ts` PASS
- [ ] **Step 5: Commit**

```bash
git add public/user-manual.html public/operator-manual.html tests/manuals.test.ts
git commit -m "Document goal persist, first-play how-to, and shock phases."
```

(고른 항목만 넣었으면 커밋 메시지를 그에 맞게 줄인다.)

---

### Task 8: 전체 검증

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test`
Expected: 전부 통과. 테스트 개수는 고른 항목만큼 증가.

- [ ] **Step 2:** 커밋할 잔여 없음 확인 후 푸시.

---

## Self-review

1. **Coverage:** 2=즉시 반영+persist, 3=하우투4+예금 기본+납입 CTA, 4=equity-drop phase. 중간 저장·게이트 완화·밸런스 변경은 제외.
2. **Placeholder scan:** TBD 없음. 테스트 문장·phase 문자열을 본문에 적음.
3. **Independence:** Task 1–3은 항목 2, Task 4–5는 항목 3, Task 6은 항목 4, Task 7은 고른 항목만.

---

## 수정 여부

코드를 아직 바꾸지 않았다. 아래 번호로 고를 수 있다.

- **2만** — 목표 저장 A
- **3만** — 첫 판 안내 A
- **4만** — 충격 국면 A
- **2+3+4** — 세 항목 모두
- **지금은 수정하지 않는다**
