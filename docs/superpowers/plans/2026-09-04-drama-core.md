# 연출 코어: 속보 카드 · 숫자 애니메이션 · 정산 장면 · 목표 게이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 제안서 `docs/2026-09-04-game-drama-and-volatility-proposal.md` 묶음 2(B1·B2·B6·C3)의 구현 플랜이다. 캐릭터·효과음(묶음 3)은 넣지 않는다. 시장 엔진(묶음 1, `main` `e8b9b99`)은 바꾸지 않는다.

**Goal:** 시장 공개가 "속보 장면"이 되고, 숫자가 튀지 않고 움직이며, 정산이 막대로 보이고, 목표 게이지가 남은 턴과 함께 긴박하게 읽힌다.

**Architecture:** 새 UI 모듈 셋. `src/ui/news-flash.ts`(속보 카드 마크업·다이얼 각도), `src/ui/hud.ts`(목표·위험 게이지, 상태 한 줄), `src/ui/fx.ts`(숫자 트윈). `settlement-engine.ts`는 상품 수익률·보유 비중·가장 큰 변화·반응 한 줄을 `TurnSummary`에 더한다. `app.ts`는 모달 `'news'`를 추가하고 렌더 뒤 숫자 트윈을 호출한다. 애니메이션은 CSS 키프레임과 `requestAnimationFrame`만 쓴다.

**Tech Stack:** TypeScript, Vite, Vitest. 새 의존성 없음.

## Global Constraints

- 원본 기획안 MD/HTML은 수정하지 않는다. 엔진 규칙·밸런스 상수·별 기준은 바꾸지 않는다.
- 모든 연출은 `html[data-reduce-motion="true"]`와 `prefers-reduced-motion`에서 즉시 끝 상태로 보인다. 자동 진행 없음. 모든 정보는 텍스트로도 있다.
- 새 모달은 키보드로 닫히고(Escape·버튼), `role="dialog"` 포커스 트랩을 그대로 탄다.
- 도착 칸 설명은 속보 카드의 「칸 설명 보기」로 연다. 학습 카드 해금은 엔진(`startTurn`)이 이미 하므로 흐름과 무관하다.
- 테스트 먼저(RED) → 최소 구현(GREEN) → 커밋. 검증 `npm run lint && npm run typecheck && npm test && npm run build`.
- 브랜치 `cursor/drama-core-5ed6`. 롤백 기준 태그 `prod-2026-09-04-market-engine`.

---

## Locked design

### B1 속보 카드 (`modal: 'news'`)

주사위·말 이동이 끝난 직후 `'tile'` 대신 `'news'`를 연다.

```
[속보 띠]  속보 · TURN 06 · 기준금리 빅스텝 인상        (충격: 주황, 긍정 충격: 금색)
[헤드라인] 기준금리가 한 번에 크게 오릅니다              (타이핑 등장)
[다이얼]   반원 게이지 0.5~6.0%, 바늘이 직전 금리 → 이번 금리로 회전. 아래 `금리 2.50% ▲0.75`
[화살표]   상품 6개가 순서대로 튀어오름. ↑초록/↓주황, 크기 = |수익률|
[이유]     step.reason
[신호]     step.alert가 있으면 market-alert 상자
[도착]     도착 · 07 장기채 거리
[버튼]     계속(primary) · 칸 설명 보기(text)
```

- 충격 턴: 카드 `shake` 0.5초 + 배경 `flash`. 긍정 충격은 띠 색만 다르고 흔들지 않는다.
- `계속` → `afterNews()`: 생활사건이 있으면 `'life'`, 없으면 모달 닫기. `칸 설명 보기` → `'tile'` → 기존 `afterTileBriefing()`.
- Escape·× 도 `afterNews()`.
- `dialAngle(ratePct, min, max)` = −120° ~ +120° 선형.

### B2 숫자 트윈 (`fx.ts`)

- 마크업에 `data-anim="won|shortWon|percent|signedPercent" data-from="…" data-to="…"`를 붙인다. `render()` 끝에서 `runNumberAnimations(root, skip)`가 600ms 트윈(`easeOutCubic`)으로 `textContent`를 채운다. `skip`이면 즉시 `to`.
- 대상: HUD IRP 평가액, 예상 월 연금(상단·카드), 수익률, 달성률 %. 이전 값은 `App.shown` 객체에 기억하고 첫 렌더는 트윈 없이 그린다.
- 감소는 `.down` 클래스로 주황, 증가는 `.up`으로 초록 400ms 뒤 원래 색.

### C3 목표·위험 게이지 (`hud.ts`)

- `renderGoalMeter(score, state)`: 채움 막대 + 95% 눈금(`<i class="tick">`) + 상태 클래스 `near`(90~99.9%, 펄스) / `met`(≥100%). 캡션 `목표 50만 · 92% · 남은 턴 4`.
- `goalStatusLine(state, score)`:
  - 달성률 < 95%: `목표까지 N만 원 · 남은 턴 k`
  - 95~99.9%: `1별 확보 · 목표까지 N만 원`
  - ≥100% & 생활자금 < 600만: `목표 달성 · 2별까지 생활자금 M만 원 더`
  - ≥100% & 생활자금 ≥ 600만: `2별 조건 충족 · 낙폭·분산·정렬을 지키면 3별`
  - 12턴 종료 후에는 결과 화면이 맡으므로 호출하지 않는다.
- `renderRiskMeter(ratio, limit)`: 채움 막대 + 70% 한도선. 초과면 `over` 클래스(빗금).

### B6 정산 장면

`TurnSummary`에 추가: `productReturns: Record<ProductId, number>`, `holdingShares: Record<ProductId, number>`(정산 후 비중), `biggestMover: ProductId | null`(보유 중 |수익률×비중| 최대), `reaction: string`.

`reactionLine(before, after, summary)` 규칙(위에서 첫 매치):
1. 충격 & 장기채 ≤ −5%: `장기채가 크게 밀렸습니다. 예금·단기채가 방어했는지 보세요.`
2. 충격 & ETF ≤ −6%: `주식이 크게 떨어졌습니다. 급락 뒤 회복도 자주 오니 분산을 지키세요.`
3. ETF ≥ +5%: `주식이 크게 올랐습니다. 위험비중이 한도에 가까워졌는지 확인하세요.`
4. 장기채 ≥ +4%: `금리 인하 기대에 장기채가 뛰었습니다. 채권이 방어 역할을 했습니다.`
5. 납입 행동: `납입은 시장과 무관하게 목표에 가장 확실히 다가가는 방법입니다.`
6. 평가액 −2% 이상 감소: `이번 턴은 평가액이 줄었습니다. 12턴 전체를 보고 판단하세요.`
7. 기본: `큰 변화 없는 턴입니다. 다음 신호를 기다리며 분산을 점검하세요.`

모달: IRP 전·후 가로 막대 2개(`bar-grow`, 최대값 기준 폭) + 차액 배지(원·%). 상품 6개 수평 막대(중앙 0, 왼쪽 주황·오른쪽 초록, 폭 = min(|r|, 15%)/15% × 50%), 보유 비중 텍스트, `biggestMover`에 `mover` 클래스. 반응 한 줄은 `settle-reaction` 상자. 기존 「내가 한 일」·「다음 판단」·신호 상자는 유지.

### CSS 키프레임(추가)

`breaking-in`, `tape-slide`, `type-in`, `dial-turn`, `arrow-pop`, `flash`, `shake`, `bar-grow`, `goal-pulse`, `count-up`. 기본 상태가 끝 상태가 되도록 `transform`/`width`의 기본값을 끝값으로 두고 애니메이션은 `from`만 정의한다.

---

## Task 1: 속보 카드

**Files:** `src/ui/news-flash.ts`(신규), `src/ui/app.ts`, `src/styles/main.css`, `tests/news-flash.test.ts`(신규)

- [ ] RED: `dialAngle` 경계(0.5→−120, 6.0→120, 3.25→0); `renderNewsFlash(step, prevStep, tile)`에 `속보`, `TURN 06`, 헤드라인, 상품 6개 `news-arrow`, `data-action="dismiss-news"`, `data-action="open-tile"`, 도착 칸 라벨; 충격이면 `shock` 클래스, 긍정 충격이면 `positive`; alert 있으면 `market-alert`; `--from`/`--to` 각도.
- [ ] 구현. `app.ts`: `Modal`에 `'news'`, `reveal()`에서 `'news'`, 핸들러 `dismiss-news`·`open-tile`, `close-modal`·Escape 분기, `renderModal` 라벨 `시장 속보`.
- [ ] CSS: `.news-flash`, `.news-tape`, `.news-dial`, `.news-arrows`, 키프레임.
- [ ] GREEN → 커밋 `Open each turn with a breaking-news market card.`

## Task 2: 숫자 트윈과 목표·위험 게이지

**Files:** `src/ui/fx.ts`(신규), `src/ui/hud.ts`(신규), `src/ui/app.ts`, `src/styles/main.css`, `tests/fx.test.ts`(신규), `tests/hud.test.ts`(신규)

- [ ] RED `fx.test.ts`: `easeOutCubic(0)=0`, `(1)=1`, 단조증가; `formatByKind('won', 1234567)`=`1,234,567원`, `shortWon`, `percent`, `signedPercent`; `animatedNumber(kind, from, to)`가 `data-anim` 속성 마크업을 만든다.
- [ ] RED `hud.test.ts`: `goalStatusLine` 4분기; `renderGoalMeter`에 `tick`·`near`·`met`; `renderRiskMeter(0.75, 0.7)`에 `over`.
- [ ] 구현. `app.ts` HUD 숫자를 `animatedNumber`로, `render()` 끝에 `runNumberAnimations(this.root, skip)`, `shown` 상태 갱신. `.goal-meter`·`.risk-line`을 `hud.ts` 마크업으로 교체.
- [ ] GREEN → 커밋 `Animate HUD numbers and add goal and risk gauges.`

## Task 3: 정산 장면

**Files:** `src/engine/settlement-engine.ts`, `src/types.ts`, `src/ui/settlement.ts`, `src/styles/main.css`, `tests/settlement.test.ts`

- [ ] RED: `summarizeTurn` 결과에 `productReturns`·`holdingShares`·`biggestMover`·`reaction`; `reactionLine` 규칙 1·3·5·7; 모달에 `settle-bars`, `settle-returns`, `mover`, `settle-reaction`, 차액 배지.
- [ ] 구현 + CSS.
- [ ] GREEN → 커밋 `Turn the settlement summary into an animated scene.`

## Task 4: 매뉴얼·검증·PR

**Files:** `public/user-manual.html`, `public/operator-manual.html`, `tests/manuals.test.ts`

- [ ] 사용자 §4 한 턴의 순서(속보 카드, 칸 설명은 선택), §5 화면(게이지·정산 막대·상태 한 줄), C26(속보 카드가 사라지지 않는다=버튼으로 닫음). 운영자 구성표에 `news-flash.ts`·`hud.ts`·`fx.ts`, Q27~Q29.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build`.
- [ ] 브라우저 1280·375: 속보 카드 → 계속 → 운용 → 정산 장면, 동작 줄이기 켠 상태에서 즉시 표시.
- [ ] 푸시, PR(base `main`).
