# 시장 국면 엔진 · 충격 6종 · 사전 신호 · 밸런스 게이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 제안서 `docs/2026-09-04-game-drama-and-volatility-proposal.md` 묶음 1(A1~A4)의 구현 플랜이다. 결정: 금리 **퍼센트** 표시, 충격 **2~3회 가변**. 캐릭터·효과음은 이 플랜 밖이다.

**Goal:** 12턴 동안 금리가 실제로 움직이고(이동 턴 ≥ 50%, 빅스텝 판당 ≥ 1), 충격이 6종·2~3회로 다양해지고, 충격 전 턴에 신호가 오며, ETF는 기대수익이 양수이되 크게 흔들린다. 그러면서 분산·납입·리밸런싱 전략이 관망·집중보다 2·3별을 더 얻는다는 사실을 테스트로 고정한다.

**Architecture:** `market-engine.ts`의 `generateMarketPath`를 세 층으로 나눈다. `regime-engine.ts`(국면 상태기계 → 턴별 금리·물가·주가 연속값), `return-model.ts`(연속값 → 상품 수익률), `market-engine.ts`(충격 배치·신호·헤드라인을 합쳐 `MarketStep[]`). 충격 카탈로그는 `src/data/market-shocks.json`, 조정 상수는 `balance-config.json`의 `market` 섹션. UI는 `market-view.ts`의 막대와 보드 중앙만 바뀐다.

**Tech Stack:** TypeScript, Vite, Vitest. 새 의존성 없음.

## Global Constraints

- 원본 기획안 MD/HTML은 수정하지 않는다.
- 승패 = 월 연금 목표. 12턴. 24칸은 시각용, 주사위는 연출. 생활사건 시드당 3회. 바꾸지 않는다.
- 같은 시드 = 같은 경로. `hashSeed`/`nextRandom` 체인만 쓴다.
- 기존 `MarketStep.rate/inflation/stocks`(1~5)와 `shock?: boolean`은 파생값으로 유지해 UI·테스트 호환을 지킨다.
- 시작 IRP·생활자금·목표 범위·성향 게이트·리밸런싱 표는 바꾸지 않는다.
- 화면 문구는 쉬운 말. 금리 옆에 "교육용 가상 금리"를 표기한다.
- 테스트 먼저(RED) → 최소 구현(GREEN) → 커밋. 검증 `npm run lint && npm run typecheck && npm test`.
- 브랜치 `cursor/market-regime-engine-5ed6`. 롤백 기준 태그 `prod-2026-09-04`.

---

## Locked design

### 금리·물가·주가 (연속값)

| 값 | 시작 | 범위 | 스텝 | 1~5 레벨 파생 |
|---|---|---|---|---|
| `ratePct` | 2.5 | 0.5 ~ 6.0 | 0.25 | `1 + round((pct − 0.5) / 5.5 × 4)` |
| `inflationPct` | 2.0 | 0.0 ~ 6.0 | 연속 | 같은 식(0~6) |
| `stockIndex` | 100 | 자유 | — | `<85→1, <95→2, <105→3, <115→4, else 5` |

### 국면 상태기계 (`balance-config.market.regimes`)

| 국면 | phase 문구 | 금리 이동 확률·방향 | 스텝 가중(1칸,2칸) | 주가 드리프트 | 물가 드리프트 | 전이 |
|---|---|---|---|---|---|---|
| easing | 저금리·경기회복 | 60% ↓ | 0.7 / 0.3 | +1.5% | −0.2 | hold 0.30 |
| hold | 혼조·관망 | 35% ± | 1.0 / 0 | +0.5% | 0 | tightening 0.25 · easing 0.20 |
| tightening | 물가상승·긴축 | 70% ↑ | 0.65 / 0.35 | −1.0% | +0.3 | pivot 0.25 |
| pivot | 경기둔화·전환 기대 | 50% ↓ | 0.6 / 0.4 | +1.0% | −0.3 | easing 0.40 · hold 0.30 |

시작 국면 `hold`. 전이는 턴 끝에 판정.

### 상품 수익률 (턴)

```
deposit   = 0.0025 + ratePct × 0.0020 + noise(±0.001)
shortBond = ratePct × 0.0018 − 1 × ΔratePct × 0.012 + noise(±0.003)
longBond  = ratePct × 0.0018 − 3 × ΔratePct × 0.012 + noise(±0.006)
stockReturn = regimeDrift + shockMove + recoveryDrift + triangular(±0.08)
equityEtf = 0.006 + stockReturn + noise(±0.005)
balanced  = 0.25 shortBond + 0.25 longBond + 0.5 equityEtf
tdf       = 0.2 shortBond + 0.2 longBond + 0.45 equityEtf + 0.15 deposit
clamp     = ±0.20
```

`rateShockReturn(productId, ΔratePct)` = `−0.012 × duration × Δ`. 목표: ETF 턴 평균 +0.6~1.3%(예금보다 높음), 표준편차 ≥ 3.5%p. 숫자는 시뮬로 맞춘다.

### 충격 6종 (`market-shocks.json`)

| id | family | positive | phase | 지표 | 강제치 |
|---|---|---|---|---|---|
| rate-bigstep | rate | no | 기준금리 빅스텝 인상 | 금리 +0.75/+1.00, 물가 +0.5, 주가 −4% | 장기채 ≤ −9%, 단기채 ≤ −2%, 예금 ≥ +1.2% |
| emergency-cut | rate | yes | 긴급 금리 인하 | 금리 −0.75, 주가 +3% | 장기채 ≥ +6% |
| equity-crash | equity | no | 위험자산 충격 | 주가 −12% | ETF ≤ −9%. 이후 2턴 회복 드리프트 +1.5% |
| melt-up | equity | yes | 위험자산 과열 랠리 | 주가 +10% | ETF ≥ +8% |
| inflation-surprise | rate | no | 물가 서프라이즈 | 물가 +1.5, 금리 +0.5, 주가 −3% | 장기채 ≤ −5%, ETF ≤ −3% |
| credit-rally | rate | yes | 채권 강세 | 금리 −0.25, 주가 −2% | 장기채 ≥ +5% |

배치(3막): 횟수 2(70%)·3(30%). 슬롯 1 = 4~6턴 {bigstep .40, crash .35, inflation .25}. 슬롯 2 = 7~9턴, 슬롯 1이 rate면 equity {crash .6, melt-up .4}, equity면 rate {bigstep .45, inflation .25, cut .15, credit .15}. 슬롯 3 = 10~11턴, 70% 긍정 {cut, melt-up, credit 중 미사용}, 30% 부정 {bigstep, crash, inflation 중 미사용}. 1~3턴·12턴 충격 없음. `rate-bigstep` 뒤 국면 60% pivot, `emergency-cut`·`credit-rally` 뒤 easing, `inflation-surprise` 뒤 tightening.

### 사전 신호

`MarketStep.alert?: { level: 1 | 2; text: string; hint: string }`. 충격 턴 t의 **직전 턴 t−1**에 붙는다. 80%는 level 2(충격 카탈로그의 `alertStrong`/`alertHint`), 20%는 level 1(일반 문구). 충격 앞이 아닌 1~11턴에는 15% 확률로 level 1 가짜 신호. 12턴은 신호 없음. 학습 카드 `signal-vs-forecast` 신설, 신호가 보이는 턴에 해금.

### 자동 전략 확장

`autoplay(seed, strategy, profileId?)`. 기본 성향: `growth` → `growth`, `etfOnly`·`stopLoss`·`momentum` → `aggressive`, 그 외 `balanced`.

- `etfOnly`: 1턴 예금→ETF 바꾸기(한도까지), 이후 짝수 턴 ETF 매수(가능액), 홀수 턴 납입.
- `stopLoss`: 1턴 예금→ETF, 이후 ETF 수익률 ≤ −5%면 ETF 전량 매도 후 다시 사지 않음.
- `momentum`: ETF 수익률 ≥ +2%면 ETF 가능액 매수(대기자금 없으면 납입), ≤ −2%면 ETF 절반 매도, 그 외 그대로.

### 밸런스 게이트 (`tests/balance-gate.test.ts`, 전략별 100시드)

목표 수치는 시뮬 뒤 확정하되 방향은 고정: steward·contributor·balanced 2·3별 비율 > passive·etfOnly·stopLoss; etfOnly 평균 최대낙폭 6~20%; steward ≤ 8%; ETF 턴 평균 +0.6~1.3%, 표준편차 ≥ 3.5%p; etfOnly p90−p10 수익률 ≥ 10%p; 주사위 합–총점 |r| < 0.1; 3별 낙폭 조건 미달 판 ≥ 10%; 오류·비정상 잔액 0.

---

## Task 1: 타입·설정·충격 카탈로그

**Files:** `src/types.ts`, `src/data/balance-config.json`, `src/data/market-shocks.json`(신규), `src/data/content.ts`, `src/data/market-scenarios.json`, `tests/content.test.ts`(신규)

- [ ] RED: `market-shocks.json`이 6개, id 고유, family ∈ {rate, equity}, forceMax/forceMin 키가 상품 id, phase에 `위험자산 충격` 포함. `balanceConfig.market.regimes` 4개, 전이 확률 합 ≤ 1.
- [ ] `types.ts`: `Regime`, `MarketAlert`, `MarketShock`, `MarketConfig`, `MarketStep` 확장(`ratePct`, `rateDeltaPct`, `inflationPct`, `stockIndex`, `stockReturn`, `regime`, `shockId?`, `alert?`). `BalanceConfig.market`.
- [ ] `balance-config.json` `market` 섹션. `market-shocks.json` 작성. `content.ts`에서 `marketShocks` export, `validateContent`에 충격 카탈로그 검사 추가.
- [ ] `market-scenarios.json` 템플릿 12턴에 새 필드 채움(6턴 `rate-bigstep`, 8턴 `equity-crash`).
- [ ] GREEN → 커밋 `Add market regime config and shock catalog.`

## Task 2: 국면 엔진·수익률 모델·경로 생성

**Files:** `src/engine/regime-engine.ts`(신규), `src/engine/return-model.ts`(신규), `src/engine/market-engine.ts`, `tests/market-regime.test.ts`(신규), `tests/engine.test.ts`

- [ ] RED `market-regime.test.ts`: 같은 시드 재현; 금리 범위·0.25 스텝; 200시드 평균 이동 턴 ≥ 45%; 빅스텝(≥0.75) 판당 ≥ 1 (충격 포함); 충격 2~3회, 턴 4~11, 12턴 없음, 슬롯 규칙(첫 4~6, 둘째 7~9); 충격 턴 `shockId`·`shock: true`·phase 일치; 강제치 준수; 수익률 ±0.20; 파생 레벨 1~5; ETF 500시드 턴 평균 ∈ [0.006, 0.013], 표준편차 ≥ 0.035.
- [ ] `regime-engine.ts`: `stepRegime(rng, state, config)`, `levelFromPct`, `levelFromIndex`.
- [ ] `return-model.ts`: `productReturns(prev, cur, shock, recovery, rng)`, `rateShockReturn`(coef from config).
- [ ] `market-engine.ts`: `planShocks`, `generateMarketPath` 재작성, `briefingFor(regime, shock, deltas, rng)`(국면별 헤드라인 3변형), `emptyMarketStep` 새 필드.
- [ ] `engine.test.ts` 512~608 갱신: 충격 2~3회·4~11턴, 클램프 ±0.20, 충격 phase는 카탈로그 `phase`, rate-family 충격은 `longBond`가 `shortBond`와 다른 방향 크기.
- [ ] GREEN → 커밋 `Generate the market path from rate regimes and a shock catalog.`

## Task 3: 사전 신호·학습 카드·정산 힌트

**Files:** `src/engine/market-engine.ts`, `src/data/learning-cards.json`, `src/engine/game-engine.ts`, `src/engine/settlement-engine.ts`, `tests/market-regime.test.ts`, `tests/settlement.test.ts`

- [ ] RED: 충격 턴 직전 스텝에 `alert` 존재(200시드 중 level 2 비율 0.6~0.95); 12턴 alert 없음; 가짜 신호 비율 0.05~0.30; `startTurn`이 alert 스텝에서 `signal-vs-forecast` 해금; `summarizeTurn`이 `after.lastMarket.alert.hint`를 첫 힌트로.
- [ ] 구현. `learning-cards.json` 카드 추가(category 시장).
- [ ] GREEN → 커밋 `Warn one turn ahead of market shocks.`

## Task 4: 화면 — 퍼센트 금리·신호·보드 중앙

**Files:** `src/ui/market-view.ts`, `src/ui/board.ts`, `src/styles/main.css`, `tests/market-view.test.ts`, `tests/board.test.ts`

- [ ] RED: `renderMarketCard`가 `3.25%`·`▲0.50`·`교육용 가상 금리`를 포함; alert 있으면 `market-alert` 마크업과 hint; 대기 상태는 `—`; `renderTurnTrack`이 공개된 alert 다음 칸에 `alert` 클래스; 보드 중앙에 금리 %.
- [ ] `marketBars` → 금리 `%`+Δ, 물가 `%`, 주가 지수+Δ%. `renderMarketAlert(step)`. `board.ts` 중앙 텍스트에 `금리 n.nn%`. CSS `.market-alert`, `.turn-track .alert`, `@keyframes modal-in` 정의(누락 수정).
- [ ] GREEN → 커밋 `Show percent rates, deltas, and shock alerts.`

## Task 5: 자동 전략·시뮬레이션·밸런스 게이트

**Files:** `src/engine/game-engine.ts`, `scripts/simulate.ts`, `tests/balance-gate.test.ts`(신규), `tests/star-distribution.test.ts`, `IMPLEMENTATION_NOTES.md`

- [ ] `autoplay` 성향 인자·전략 3종. `simulate.ts` 전략별 표(목표 달성, 별, 평균/p10/p90 수익률, 평균/최대 낙폭, 생활자금 부족), 주사위–총점 상관, `--json`.
- [ ] 시뮬 1000회로 상수 조정(`balance-config.market`). 목표: §Locked design 게이트.
- [ ] RED `balance-gate.test.ts` → GREEN. `star-distribution.test.ts` 하한 재기준.
- [ ] `IMPLEMENTATION_NOTES.md`에 「시장 국면 엔진 (2026-09-04)」 기준선.
- [ ] 커밋 `Gate market balance with strategy simulations.`

## Task 6: 매뉴얼·검증·PR

**Files:** `public/user-manual.html`, `public/operator-manual.html`, `tests/manuals.test.ts`

- [ ] 사용자: 시장 절(가상 금리 %, 국면 4종, 충격 6종·2~3회·4~11턴, 신호는 예측이 아님), C18 갱신. 운영자: `market` 상수 표, `market-shocks.json`, 시뮬 옵션, 게이트 지표, 새 테스트 파일.
- [ ] `manuals.test.ts` 문자열 갱신 → GREEN.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build`, `npm run simulate -- --runs=1000`.
- [ ] 브라우저: 375×812·1280×900에서 1판 완주, 금리 % 표시·신호·충격 확인.
- [ ] 푸시, PR(base `main`). 프로덕션 배포는 운영자 결정 뒤.
