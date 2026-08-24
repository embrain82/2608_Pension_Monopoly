# 사후 70% 안전자산 매수 + 턴 정산 요약 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시장이 이미 위험 한도 70%를 넘긴 뒤에도 비중을 더 키우지 않는 예금·채권 매수를 허용하고, 매 턴 정산 직후 「내가 한 일 / 시장이 한 일 / 다음 판단 1~2개」를 한 화면에 보여 준다.

**Architecture:** 한도 예외는 `canBuyRiskAsset` 한곳에서만 바꾼다. 정산 요약은 `src/engine/settlement-engine.ts`의 순수 함수가 before/after `GameState`를 비교해 `TurnSummary`를 만들고, `performAction`이 성공 결과에 붙인다. UI는 `src/ui/settlement.ts`가 마크업만 그리고 `app.ts`는 `settle` 모달을 열고 닫는다.

**Tech Stack:** TypeScript, Vite, Vitest, vanilla DOM. 새 의존성 없음.

## Global Constraints

- 원본 기획안 `퇴직연금_브루마블형_HTML5_게임_기획안.md` / `_v2.md` / `.html`은 수정하지 않는다.
- 진행 중 판 중간 저장을 넣지 않는다.
- 24칸 보드를 턴 엔진으로 되돌리지 않는다.
- 직접 매수의 70% 초과는 전액 거절이 아니라 진행/보류 확인을 유지한다. 이번 작업은 「이미 사후 초과인 상태」만 바꾼다.
- 바꾸기(교체매매) 자동 부분 체결은 이번 범위 밖이다.
- 별 분포·월 연금 목표 즉시 반영은 이번 범위 밖이다.
- 화면 문구는 쉬운 말. 법령 문장 복사 금지.
- 테스트 먼저(RED) → 최소 구현(GREEN) → 커밋.
- 검증 명령: `npm run lint && npm run typecheck && npm test`
- 작업 브랜치: `cursor/p0-market-first-loop-5ed6` (기존 PR #2).

## Locked rules

### 1번 — 사후 초과 때 안전자산 매수

대기자금은 이미 IRP 총액에 들어 있다. 예금·채권을 사면 총액과 위험액이 같아서 **비중은 내려가지 않는다**. 플레이어에게 「예금을 사면 한도가 해결된다」고 약속하지 않는다.

허용 조건: 매수 후 예상 위험비중 `ratio`가 현재 비중 `current`보다 커지지 않으면(`ratio <= current + 0.00001`) 한도를 넘긴 상태여도 매수를 허용한다.

거부 조건(기존 유지):

- 이미 70%를 넘긴 뒤 위험비율이 있는 상품(ETF, 혼합형, TDF)을 사면 거절.
- 아직 70% 아래인데 이번 매수로 70%를 넘기면 기존처럼 거절(또는 매수 화면의 진행/보류).

HUD 문구를 「위험매수 제한, 리밸런싱 권장」에서 「위험자산 추가매수 제한 · 예금·채권 매수 가능」으로 바꾼다.

### 2번 — 정산 요약

`performAction`이 성공해 `finalizeTurn`까지 끝난 뒤에만 요약을 만든다. 실패 매수/성향 거절은 요약을 만들지 않는다.

12턴이 끝나 `status === 'finished'`이면 정산 모달을 건너뛰고 기존 결과 화면으로 간다. 결과 화면에 이미 리포트가 있다.

힌트는 아래 우선순위에서 **최대 2개**. 문장은 테스트에 박아 넣는다.

1. `after.marketLimitExceeded` → `위험자산 추가 매수는 막힙니다. 예금·채권으로 대기자금을 옮기거나 리밸런싱하세요.`
2. `after.pendingOrders.length > 0` → `펀드 주문은 다음 턴에 잔고에 들어갑니다.`
3. `riskAfter > 0.62 && !after.marketLimitExceeded` → `위험한도에 가깝습니다. 가능액 매수 전에 미리보기를 보세요.`
4. 그 외 → `다음 턴 시장을 보고 납입·매매·그대로 중 하나를 고르세요.`

상품 증감은 보유액 차이가 절댓값 1,000원 이상인 항목만, 절댓값 큰 순, 최대 4개.

## File map

| 파일 | 역할 |
|---|---|
| `src/engine/policy-engine.ts` | `canBuyRiskAsset` 예외 |
| `src/types.ts` | `TurnSummary`, `ActionResult.summary` |
| `src/engine/settlement-engine.ts` | `summarizeTurn` (신규) |
| `src/engine/game-engine.ts` | 성공한 `performAction`에 summary 부착 |
| `src/ui/settlement.ts` | 정산 모달 마크업 (신규) |
| `src/ui/app.ts` | `settle` 모달 열기/닫기, HUD 문구 |
| `src/styles/main.css` | 정산 모달 간격 |
| `tests/engine.test.ts` | 한도 예외 + performAction 요약 |
| `tests/settlement.test.ts` | 요약 규칙·마크업 (신규) |
| `public/user-manual.html` | 규칙, C9, C22 |
| `public/operator-manual.html` | 제한, Q20 |
| `tests/manuals.test.ts` | 문구 잠금 |

---

### Task 1: 사후 초과 때 비중을 안 올리는 매수 허용

**Files:**
- Modify: `src/engine/policy-engine.ts` (`canBuyRiskAsset`)
- Test: `tests/engine.test.ts` (`시장 상승의 사후 한도 초과는 즉시 규칙 위반이 아니다` 바로 아래)

**Interfaces:**
- Consumes: 기존 `canBuyRiskAsset(state, productId, amount): { ok, ratio, reason }`, `expectedRiskAfterBuy`, `riskAssetRatio`, `effectiveRiskRatio`
- Produces: 같은 시그니처. `ok: true`일 때 사후 초과+비가중 매수 이유 문구가 `키우지 않습니다`를 포함한다.

- [ ] **Step 1: Write the failing test**

`tests/engine.test.ts`의 기존 사후 초과 테스트 바로 뒤에 추가한다. `applyMarketStep` import는 이미 있다.

```ts
  it('사후 한도 초과 뒤에는 예금·채권 매수는 되고 위험자산 매수는 막는다', () => {
    const base = createGame('safe-after-cap', 'growth');
    const state = {
      ...base,
      awaitingAction: true,
      currentEventId: null,
      irpCash: 5_000_000,
      holdings: [
        { productId: 'deposit' as const, amount: 30_000_000, principal: 30_000_000, depositTurnsHeld: 4 },
        { productId: 'equityEtf' as const, amount: 70_000_000, principal: 70_000_000, depositTurnsHeld: 0 }
      ]
    };
    const moved = applyMarketStep(state, {
      ...state.lastMarket,
      returns: { ...state.lastMarket.returns, deposit: 0, equityEtf: 0.5 }
    });
    expect(moved.marketLimitExceeded).toBe(true);
    expect(canBuyRiskAsset(moved, 'deposit', 1_000_000).ok).toBe(true);
    expect(canBuyRiskAsset(moved, 'shortBond', 1_000_000).ok).toBe(true);
    expect(canBuyRiskAsset(moved, 'equityEtf', 1_000_000).ok).toBe(false);
    expect(canBuyRiskAsset(moved, 'balanced', 1_000_000).ok).toBe(false);

    const bought = buyProduct(moved, 'deposit', 1_000_000);
    expect(bought.ok).toBe(true);
    expect(bought.state.irpCash).toBe(4_000_000);
    expect(riskAssetRatio(bought.state)).toBeLessThanOrEqual(riskAssetRatio(moved) + 0.00001);

    const acted = performAction(moved, { kind: 'buy', productId: 'deposit', amount: 1_000_000 });
    expect(acted.ok).toBe(true);
    expect(acted.state.awaitingAction).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine.test.ts -t "사후 한도 초과 뒤에는 예금"`

Expected: FAIL. `canBuyRiskAsset(moved, 'deposit', 1_000_000).ok`가 `false`.

- [ ] **Step 3: Write minimal implementation**

`src/engine/policy-engine.ts`의 `canBuyRiskAsset` 두 번째 거절 분기를 아래처럼 바꾼다. 첫 번째 분기(이미 초과 + 위험비율 > 0)는 그대로 둔다.

```ts
export function canBuyRiskAsset(state: GameState, productId: ProductId, amount: number): { ok: boolean; ratio: number; reason: string } {
  const current = riskAssetRatio(state);
  const addedRisk = effectiveRiskRatio(productId);
  const ratio = expectedRiskAfterBuy(state, productId, amount);
  if (addedRisk > 0 && current > policyRules.riskAssetLimit) {
    return { ok: false, ratio, reason: '시장 상승으로 현재 위험비중이 한도를 넘었습니다. 예금·채권 매수나 리밸런싱이 먼저 필요합니다.' };
  }
  if (ratio > policyRules.riskAssetLimit + 0.00001) {
    if (ratio <= current + 0.00001) {
      return {
        ok: true,
        ratio,
        reason: `매수 후 예상 위험자산 비중 ${(ratio * 100).toFixed(1)}%. 시장 초과 상태는 유지되지만 비중을 더 키우지 않습니다.`
      };
    }
    return { ok: false, ratio, reason: `예상 위험자산 비중이 ${(ratio * 100).toFixed(1)}%로 교육용 한도 ${(policyRules.riskAssetLimit * 100).toFixed(0)}%를 넘습니다.` };
  }
  return { ok: true, ratio, reason: `매수 후 예상 위험자산 비중 ${(ratio * 100).toFixed(1)}%` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine.test.ts`

Expected: PASS. 기존 「위험자산 한도 초과 매수를 차단한다」와 「이미 한도를 넘긴 매수는 확인 없이 처리한다」의 ETF 거절도 그대로 통과.

- [ ] **Step 5: Commit**

```bash
git add src/engine/policy-engine.ts tests/engine.test.ts
git commit -m "Allow non-increasing buys after a market risk-cap breach."
```

---

### Task 2: 정산 요약 타입과 순수 함수

**Files:**
- Modify: `src/types.ts` (`ActionResult` 아래)
- Create: `src/engine/settlement-engine.ts`
- Create: `tests/settlement.test.ts`

**Interfaces:**
- Consumes: `GameState`, `portfolioValue`, `riskAssetRatio`, `products`
- Produces:

```ts
export interface TurnProductDelta {
  productId: ProductId;
  name: string;
  delta: number;
}

export interface TurnSummary {
  turn: number;
  actionLine: string;
  irpBefore: number;
  irpAfter: number;
  riskBefore: number;
  riskAfter: number;
  marketHeadline: string;
  shock: boolean;
  marketLimitExceeded: boolean;
  productDeltas: TurnProductDelta[];
  nextHints: string[];
}

export function summarizeTurn(before: GameState, after: GameState, actionLine: string): TurnSummary
```

힌트 상수(파일 상단 export, 테스트가 그대로 대조):

```ts
export const HINT_OVER_LIMIT = '위험자산 추가 매수는 막힙니다. 예금·채권으로 대기자금을 옮기거나 리밸런싱하세요.';
export const HINT_PENDING_FUND = '펀드 주문은 다음 턴에 잔고에 들어갑니다.';
export const HINT_NEAR_LIMIT = '위험한도에 가깝습니다. 가능액 매수 전에 미리보기를 보세요.';
export const HINT_DEFAULT = '다음 턴 시장을 보고 납입·매매·그대로 중 하나를 고르세요.';
```

- [ ] **Step 1: Write the failing test**

`tests/settlement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGame, performAction, startTurn } from '../src/engine/game-engine';
import { applyMarketStep } from '../src/engine/market-engine';
import {
  HINT_DEFAULT,
  HINT_NEAR_LIMIT,
  HINT_OVER_LIMIT,
  HINT_PENDING_FUND,
  summarizeTurn
} from '../src/engine/settlement-engine';
import { policyRules } from '../src/data/content';

describe('턴 정산 요약', () => {
  it('행동 전후 IRP·위험비중과 힌트를 만든다', () => {
    let state = startTurn(createGame('settle-hold'), 1).state;
    if (state.currentEventId) return;
    const before = state;
    const after = performAction(state, { kind: 'hold' }).state;
    const summary = summarizeTurn(before, after, '이번 턴은 행동하지 않고 현재 구성을 유지했습니다.');
    expect(summary.turn).toBe(before.turn);
    expect(summary.actionLine).toContain('유지');
    expect(summary.irpAfter).not.toBeUndefined();
    expect(summary.riskAfter).toBeGreaterThanOrEqual(0);
    expect(summary.marketHeadline.length).toBeGreaterThan(0);
    expect(summary.nextHints.length).toBeGreaterThanOrEqual(1);
    expect(summary.nextHints.length).toBeLessThanOrEqual(2);
  });

  it('사후 한도 초과면 안전자산·리밸런싱 힌트를 준다', () => {
    const base = createGame('settle-over');
    const before = {
      ...base,
      turn: 1,
      awaitingAction: true,
      currentEventId: null,
      holdings: [
        { productId: 'deposit' as const, amount: 30_000_000, principal: 30_000_000, depositTurnsHeld: 4 },
        { productId: 'equityEtf' as const, amount: 70_000_000, principal: 70_000_000, depositTurnsHeld: 0 }
      ]
    };
    const after = {
      ...applyMarketStep(before, {
        ...before.lastMarket,
        headline: '주가 급등',
        shock: true,
        returns: { ...before.lastMarket.returns, deposit: 0, equityEtf: 0.5 }
      }),
      marketLimitExceeded: true,
      pendingOrders: []
    };
    const summary = summarizeTurn(before, after, '그대로 두기');
    expect(summary.marketLimitExceeded).toBe(true);
    expect(summary.shock).toBe(true);
    expect(summary.nextHints[0]).toBe(HINT_OVER_LIMIT);
    expect(summary.productDeltas[0]?.productId).toBe('equityEtf');
    expect(summary.productDeltas[0]?.delta).toBeGreaterThan(0);
  });

  it('펀드 대기 주문이 있으면 시차 힌트를 준다', () => {
    const before = createGame('settle-fund');
    const after = {
      ...before,
      turn: 1,
      pendingOrders: [{
        id: '1',
        side: 'buy' as const,
        productId: 'longBond' as const,
        amount: 5_000_000,
        submittedTurn: 1,
        settlesTurn: 2,
        stage: 'received' as const
      }],
      lastMarket: { ...before.lastMarket, headline: '금리 소폭 하락' }
    };
    const summary = summarizeTurn(before, after, '장기채 매수 주문 접수');
    expect(summary.nextHints).toContain(HINT_PENDING_FUND);
    expect(summary.nextHints.length).toBeLessThanOrEqual(2);
  });

  it('한도 근처이면 미리보기 힌트를 준다', () => {
    const before = createGame('settle-near');
    const after = {
      ...before,
      turn: 1,
      holdings: [
        { productId: 'deposit' as const, amount: 40_000_000, principal: 40_000_000, depositTurnsHeld: 4 },
        { productId: 'equityEtf' as const, amount: 65_000_000, principal: 65_000_000, depositTurnsHeld: 0 }
      ],
      irpCash: 0,
      pendingOrders: [],
      marketLimitExceeded: false,
      lastMarket: { ...before.lastMarket, headline: '보합' }
    };
    const summary = summarizeTurn(before, after, '유지');
    expect(summary.riskAfter).toBeGreaterThan(0.62);
    expect(summary.riskAfter).toBeLessThanOrEqual(policyRules.riskAssetLimit + 0.00001);
    expect(summary.nextHints).toContain(HINT_NEAR_LIMIT);
  });
});
```

힌트 상수를 테스트에서 import하므로, 파일이 없으면 collect 단계에서 FAIL이다. `HINT_DEFAULT`는 구현에서 쓰고 이 테스트의 초과/시차/근처 케이스에는 안 나와도 된다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/settlement.test.ts`

Expected: FAIL. `Cannot find module '../src/engine/settlement-engine'` 또는 `summarizeTurn is not a function`.

- [ ] **Step 3: Write minimal implementation**

`src/types.ts`의 `ActionResult`를 확장하고 `TurnSummary`를 같은 파일에 둔다.

```ts
export interface TurnProductDelta {
  productId: ProductId;
  name: string;
  delta: number;
}

export interface TurnSummary {
  turn: number;
  actionLine: string;
  irpBefore: number;
  irpAfter: number;
  riskBefore: number;
  riskAfter: number;
  marketHeadline: string;
  shock: boolean;
  marketLimitExceeded: boolean;
  productDeltas: TurnProductDelta[];
  nextHints: string[];
}

export interface ActionResult {
  ok: boolean;
  message: string;
  state: GameState;
  expectedRiskRatio?: number;
  summary?: TurnSummary;
}
```

`src/engine/settlement-engine.ts`:

```ts
import { products } from '../data/content';
import type { GameState, TurnSummary } from '../types';
import { portfolioValue } from './portfolio-engine';
import { riskAssetRatio } from './policy-engine';

export const HINT_OVER_LIMIT = '위험자산 추가 매수는 막힙니다. 예금·채권으로 대기자금을 옮기거나 리밸런싱하세요.';
export const HINT_PENDING_FUND = '펀드 주문은 다음 턴에 잔고에 들어갑니다.';
export const HINT_NEAR_LIMIT = '위험한도에 가깝습니다. 가능액 매수 전에 미리보기를 보세요.';
export const HINT_DEFAULT = '다음 턴 시장을 보고 납입·매매·그대로 중 하나를 고르세요.';

function holdingAmount(state: GameState, productId: GameState['holdings'][number]['productId']): number {
  return state.holdings.find((holding) => holding.productId === productId)?.amount ?? 0;
}

function nextHints(after: GameState, riskAfter: number): string[] {
  const hints: string[] = [];
  if (after.marketLimitExceeded) hints.push(HINT_OVER_LIMIT);
  if (after.pendingOrders.length > 0) hints.push(HINT_PENDING_FUND);
  if (riskAfter > 0.62 && !after.marketLimitExceeded) hints.push(HINT_NEAR_LIMIT);
  if (hints.length === 0) hints.push(HINT_DEFAULT);
  return hints.slice(0, 2);
}

export function summarizeTurn(before: GameState, after: GameState, actionLine: string): TurnSummary {
  const productDeltas = products
    .map((product) => ({
      productId: product.id,
      name: product.shortName,
      delta: holdingAmount(after, product.id) - holdingAmount(before, product.id)
    }))
    .filter((item) => Math.abs(item.delta) >= 1000)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
  const riskAfter = riskAssetRatio(after);
  return {
    turn: before.turn,
    actionLine,
    irpBefore: portfolioValue(before),
    irpAfter: portfolioValue(after),
    riskBefore: riskAssetRatio(before),
    riskAfter,
    marketHeadline: after.lastMarket.headline,
    shock: Boolean(after.lastMarket.shock),
    marketLimitExceeded: after.marketLimitExceeded,
    productDeltas,
    nextHints: nextHints(after, riskAfter)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/settlement.test.ts tests/engine.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/engine/settlement-engine.ts tests/settlement.test.ts
git commit -m "Add a pure turn-settlement summary."
```

---

### Task 3: performAction에 요약 부착

**Files:**
- Modify: `src/engine/game-engine.ts` (`performAction`)
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: `summarizeTurn(before, after, actionLine)`
- Produces: 성공한 `ActionResult.summary`는 `TurnSummary`. 실패면 `summary` 없음.

- [ ] **Step 1: Write the failing test**

```ts
  it('성공한 운용 뒤에는 정산 요약을 붙인다', () => {
    let state = startTurn(createGame('action-summary'), 1).state;
    if (state.currentEventId) state = resolveLifeEvent(state, 'cash').state;
    const result = performAction(state, { kind: 'hold' });
    expect(result.ok).toBe(true);
    expect(result.summary?.turn).toBe(state.turn);
    expect(result.summary?.actionLine).toBe(result.message);
    expect(result.summary?.nextHints.length).toBeGreaterThan(0);

    const rejected = performAction(state, { kind: 'buy' });
    expect(rejected.ok).toBe(false);
    expect(rejected.summary).toBeUndefined();
  });
```

`buy` without `productId`는 기존처럼 「매수 상품을 선택하세요」로 실패한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine.test.ts -t "성공한 운용 뒤에는 정산 요약"`

Expected: FAIL. `result.summary`가 `undefined`.

- [ ] **Step 3: Write minimal implementation**

`src/engine/game-engine.ts` 상단 import에 추가:

```ts
import { summarizeTurn } from './settlement-engine';
```

`performAction` 성공 반환을 교체:

```ts
  if (!result.ok) return result;
  const next = finalizeTurn({ ...result.state, logs: [...result.state.logs, { turn: state.turn, type: 'action', message: result.message }] });
  return {
    ...result,
    state: next,
    summary: summarizeTurn(state, next, result.message)
  };
```

기존 `return { ...result, state: finalizeTurn(...) }` 한 줄을 위 블록으로 바꾼다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine.test.ts tests/settlement.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/game-engine.ts tests/engine.test.ts
git commit -m "Attach a settlement summary to successful actions."
```

---

### Task 4: 정산 모달 UI

**Files:**
- Create: `src/ui/settlement.ts`
- Modify: `src/ui/app.ts` (`Modal` 타입, `runAction`, `renderModal`, HUD 경고 문구)
- Modify: `src/styles/main.css`
- Test: `tests/settlement.test.ts`에 마크업 테스트 추가

**Interfaces:**
- Consumes: `TurnSummary`, `percent`/`signedPercent` from `src/ui/market-view.ts`
- Produces: `renderSettlementModal(summary: TurnSummary): string` — `정산 요약`, `다음 판단`, `다음 턴 준비`를 포함한다.

표시 규칙:

- 제목: `{turn}턴 정산`
- 행동: `summary.actionLine`
- 시장: `summary.marketHeadline` + (shock면 `충격` 배지)
- 숫자: `IRP {irpBefore} → {irpAfter}`, `위험비중 {riskBefore} → {riskAfter}`
- 상품 줄: `{name} +N원` / `{name} -N원`. 없으면 `보유 구성은 크게 변하지 않았습니다.`
- 힌트: `다음 판단` 아래 `nextHints` 각각 `<li>`
- 버튼: `data-action="dismiss-settle"` 라벨 `다음 턴 준비`
- 닫기(×)와 Escape는 허용. `life`/`action`처럼 잠그지 않는다.
- `status === 'finished'`이면 모달을 열지 않고 기존처럼 결과 화면.

금액 포맷은 `app.ts`와 같이 `Math.round(value).toLocaleString('ko-KR') + '원'`. `settlement.ts` 안에 작은 `formatWon`을 둔다. `app.ts`의 것을 export하지 않는다.

- [ ] **Step 1: Write the failing markup test**

`tests/settlement.test.ts`에 추가:

```ts
import { renderSettlementModal } from '../src/ui/settlement';

  it('정산 모달에 전후 숫자와 다음 판단을 그린다', () => {
    const html = renderSettlementModal({
      turn: 3,
      actionLine: '이번 턴은 행동하지 않고 현재 구성을 유지했습니다.',
      irpBefore: 108_000_000,
      irpAfter: 109_200_000,
      riskBefore: 0.2,
      riskAfter: 0.21,
      marketHeadline: '금리는 내리고 주가는 올랐습니다',
      shock: false,
      marketLimitExceeded: false,
      productDeltas: [{ productId: 'equityEtf', name: '주식 ETF', delta: 1_200_000 }],
      nextHints: [HINT_DEFAULT]
    });
    expect(html).toContain('3턴 정산');
    expect(html).toContain('정산 요약');
    expect(html).toContain('다음 판단');
    expect(html).toContain('다음 턴 준비');
    expect(html).toContain('주식 ETF');
    expect(html).toContain(HINT_DEFAULT);
    expect(html).toContain('data-action="dismiss-settle"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/settlement.test.ts -t "정산 모달"`

Expected: FAIL. `Cannot find module '../src/ui/settlement'`.

- [ ] **Step 3: Write render + wire app**

`src/ui/settlement.ts`:

```ts
import type { TurnSummary } from '../types';
import { percent } from './market-view';

const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const signedWon = (value: number) => `${value > 0 ? '+' : ''}${formatWon(value)}`;

export function renderSettlementModal(summary: TurnSummary): string {
  const moves = summary.productDeltas.length
    ? `<ul class="settle-moves">${summary.productDeltas.map((item) => `<li>${item.name} <strong class="${item.delta < 0 ? 'neg' : ''}">${signedWon(item.delta)}</strong></li>`).join('')}</ul>`
    : '<p>보유 구성은 크게 변하지 않았습니다.</p>';
  const shock = summary.shock ? '<span class="settle-shock">충격</span>' : '';
  return `<p class="eyebrow">${summary.turn}턴 정산${shock}</p>
    <h2>무엇이 바뀌었나요?</h2>
    <div class="preview-box"><strong>내가 한 일</strong><p>${summary.actionLine}</p></div>
    <div class="preview-box"><strong>정산 요약</strong>
      <p>${summary.marketHeadline}</p>
      <p>IRP ${formatWon(summary.irpBefore)} → ${formatWon(summary.irpAfter)}</p>
      <p>위험비중 ${percent(summary.riskBefore)} → ${percent(summary.riskAfter)}</p>
      ${moves}
    </div>
    <div class="preview-box"><strong>다음 판단</strong><ul class="settle-hints">${summary.nextHints.map((hint) => `<li>${hint}</li>`).join('')}</ul></div>
    <button class="primary jumbo" data-action="dismiss-settle">다음 턴 준비</button>`;
}
```

`src/ui/app.ts` 변경:

1. import `renderSettlementModal` from `./settlement`.
2. `type Modal`에 `'settle'` 추가.
3. 필드 `private lastSummary: TurnSummary | null = null;` (`TurnSummary`는 `../types`에서 import).
4. `runAction` 성공 분기:

```ts
    this.announce(result.message);
    if (!result.ok) return;
    this.actionView = 'menu';
    this.tipDismissed = false;
    this.lastSummary = result.summary ?? null;
    if (this.game.status === 'finished') {
      this.modal = null;
      this.screen = 'result';
      this.persist(true);
      return;
    }
    this.modal = result.summary ? 'settle' : null;
    this.persist(true);
```

기존 `this.modal = null` 후 바로 persist 하던 성공 경로를 위로 교체한다. 실패(`!result.ok`)는 모달을 유지하지 말고 지금처럼 return.

5. `onClick`에:

```ts
    } else if (action === 'dismiss-settle') {
      this.modal = null;
```

6. `renderModal`에서 `if (this.modal === 'settle' && this.lastSummary) content = renderSettlementModal(this.lastSummary);`
7. aria-label 삼항에 `this.modal === 'settle' ? '턴 정산 요약'` 추가.
8. HUD 경고를 다음으로 교체:

```ts
${state.marketLimitExceeded ? '<p class="warning">시장 상승으로 한도 초과 · 위험자산 추가매수 제한, 예금·채권 매수나 리밸런싱은 가능</p>' : ''}
```

`src/styles/main.css`에 추가:

```css
.settle-moves, .settle-hints { margin: 8px 0 0; padding-left: 1.1em; }
.settle-moves li, .settle-hints li { margin: 4px 0; font-size: .84rem; line-height: 1.45; }
.settle-shock { margin-left: 8px; padding: 2px 8px; border-radius: 99px; background: #fff0e7; color: #9a471f; font-size: .7rem; font-weight: 800; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/settlement.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/settlement.ts src/ui/app.ts src/styles/main.css tests/settlement.test.ts
git commit -m "Show a settlement sheet after each successful action."
```

---

### Task 5: 매뉴얼과 QA 문구

**Files:**
- Modify: `public/user-manual.html`
- Modify: `public/operator-manual.html`
- Modify: `tests/manuals.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 사용자 매뉴얼에 `C22`, `예금·채권 매수는 됩니다`, `정산 요약`이 있고, 운영자 매뉴얼에 `Q20`이 있다. `모든 매수` 거절 문구는 삭제한다.

- [ ] **Step 1: Write the failing manual assertions**

`tests/manuals.test.ts`에서 아래를 바꾼다.

빼기:

```ts
    expect(user).toContain('모든 매수');
    expect(operator).toContain('안전자산 매수도');
```

넣기:

```ts
    expect(user).toContain('예금·채권 매수는 됩니다');
    expect(user).toContain('정산 요약');
    expect(user).toContain('C22');
    expect(operator).toContain('비중을 더 키우지 않는');
    expect(operator).toContain('Q20');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/manuals.test.ts`

Expected: FAIL. `예금·채권 매수는 됩니다` 없음.

- [ ] **Step 3: Update copy**

`public/user-manual.html` §9 위험자산 70% 문단을 다음으로 교체:

```html
        <li><strong>위험자산 70%</strong> — 매수 전에 예상 비중을 봅니다. 시장이 올라 이미 70%를 넘으면 규칙 위반 횟수는 올리지 않습니다. 이 상태에서는 주식 ETF·혼합형·TDF처럼 위험비중을 키우는 매수만 거절합니다. 예금·채권 매수는 됩니다. 대기자금을 예금으로 옮겨도 총액이 같아서 비중은 거의 그대로입니다. 비중을 낮추려면 위험자산을 팔거나 리밸런싱하거나, 생활자금에서 추가납입해 IRP 총액을 늘리세요. 행동을 실행하면 정산 요약에서 IRP·위험비중 변화와 다음 판단 1~2개를 보여 줍니다.</li>
```

§4 한 턴의 순서 6번 정산 문장 끝에 다음을 붙인다: ` 정산 직후 요약 창이 열립니다. 12턴 마지막은 결과 화면으로 갑니다.`

C9를 다음으로 교체:

```html
      <h3>C9. 위험비중이 70%를 넘었는데 게임이 끝나지 않는다</h3>
      <p>시장이 올라서 넘은 것은 사후 초과입니다. 노란 안내만 켜고 벌점은 없습니다. 주식 ETF 등 위험자산 추가 매수는 막히지만 <strong>예금·채권 매수는 됩니다</strong>. 예금을 사도 대기자금이 이미 총액에 들어 있어 비중은 거의 안 내려갑니다. 비중을 낮추려면 위험자산 매도, 리밸런싱, 또는 추가납입(IRP 총액 증가)을 쓰세요.</p>
```

C20 앞에 C22를 넣는다:

```html
      <h3>C22. 행동을 눌렀더니 정산 창이 또 뜬다</h3>
      <p>정상입니다. 내가 한 일, IRP·위험비중 전후, 시장 한 줄, 다음 판단 1~2개를 보여 줍니다. <code>다음 턴 준비</code>를 누르면 주사위로 다음 턴을 열 수 있습니다. 12턴을 끝낸 뒤에는 이 창 없이 결과 리포트로 갑니다.</p>
```

`public/operator-manual.html` 구현 표 70% 행 메모 끝에 ` · 사후 초과 때 비중 비가중 매수 허용`을 붙인다.

알려진 제한의 「안전자산 매수도 거절」 항목을 다음으로 교체:

```html
        <li>시장이 이미 70%를 넘기면 위험자산 추가매수는 <code>canBuyRiskAsset</code>이 거절합니다. 비중을 더 키우지 않는 예금·채권 매수는 됩니다. 대기자금을 예금으로 옮겨도 비중은 거의 그대로입니다.</li>
```

QA 표 Q19 다음에:

```html
          <tr><td>Q20</td><td>성장 성향, 시장이 올려 70% 초과 후 예금 매수 → 정산 창</td><td>예금 체결. 요약에 IRP·위험비중. 힌트에 위험자산 추가매수 제한. 닫으면 다음 주사위</td></tr>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/manuals.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/user-manual.html public/operator-manual.html tests/manuals.test.ts
git commit -m "Document post-limit safe buys and the settlement sheet."
```

---

### Task 6: 전체 검증

**Files:** 없음 (명령만)

**Interfaces:**
- Consumes: Task 1–5 커밋
- Produces: lint / typecheck / test 초록

- [ ] **Step 1: Run the full gate**

Run: `npm run lint && npm run typecheck && npm test`

Expected: lint 조용함, tsc 성공, Vitest 전 파일 PASS. 테스트 수는 기존 72에서 대략 78 전후(한도 1 + 요약 4 + performAction 1 + 마크업 1, 매뉴얼은 교체).

- [ ] **Step 2: Manual smoke (브라우저 또는 로컬 preview)**

성장 성향으로 시작 → 대기자금을 모아 ETF를 사 한도에 가까이 → 충격 턴 후 노란 안내 → 예금 매수가 되고 ETF 매수는 막힘 → 정산 창에서 전후 숫자와 힌트 확인 → `다음 턴 준비` 후 주사위.

12턴 마지막 행동은 정산 창 없이 결과 화면.

- [ ] **Step 3: Push and update PR #2**

```bash
git push -u origin cursor/p0-market-first-loop-5ed6
```

PR 본문에 Task 1·2 완료 요약을 추가한다. Vercel `whoami`가 유효하면 preview 확인. `--prod`가 `Not authorized`면 preview를 promote한다.

---

## Self-review

1. **Spec coverage:** 1번(사후 초과 안전자산 허용, 위험자산 거절, HUD/C9/제한 문구)은 Task 1+5. 2번(정산 요약 데이터, performAction 부착, 모달, 마지막 턴 스킵, C22/Q20)은 Task 2–5. 바꾸기 확인·별 분포·목표 즉시 반영은 명시적으로 제외.
2. **Placeholder scan:** TBD/TODO/「적절히」 없음. 힌트 문장·함수 시그니처·명령을 그대로 적음.
3. **Type consistency:** `TurnSummary` / `summarizeTurn` / `ActionResult.summary` / `renderSettlementModal` / `dismiss-settle` 이름이 Task 2–4에서 동일하다.
