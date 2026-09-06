# 묶음 A(P0) 구현 플랜 — 턴 순서 · 칸 효과 · 고스트

> 리뷰 `docs/2026-09-06-playtest-review-10-improvements.md`의 P0 세 개(3.2 → 3.1 → 3.3)를 한 묶음으로 구현한다. 기준 `main` `9624cb0`(태그 `prod-2026-09-06-manual-diagrams`). 시장 엔진·연출 코어·카툰·사운드·2.5D 말은 바꾸지 않는다.

## 목표

- **뉴스는 이미 가격에 반영**(3.2). 턴 시작에 시장이 먼저 보유분에 반영되고, 그 뒤 행동한다. 지금 산 ETF는 다음 턴 수익률을 받는다. "뉴스 보고 갈아타기"가 최적해가 아니게 된다.
- **칸이 규칙이 된다**(3.1). 도착 칸(그리고 통과한 연말정산 칸)마다 작고 명확한 효과 1개. 연말정산 통과 시 그 판 누적 납입분의 세액공제가 **환급 장면**으로 돌아온다.
- **고스트 "그대로 둔 나"**(3.3). 같은 시드·같은 주사위·무행동 경로를 정산과 결과에 나란히 놓아 판단의 값어치를 숫자로 보인다.

## 고정 사항

| 항목 | 값 |
|---|---|
| 턴 순서 | `startTurn`: 턴+1 → 위치 → **`applyMarketStep`(보유분·낙폭·한도 초과) → `settleOrders`(지난 턴 펀드 주문 체결)** → 급여 → 칸 효과 → 생활사건/운용 대기. `performAction`: 행동 → (행동 남으면 유지) → `finalizeTurn`(12턴 잔여 주문 강제 체결 · 잔여 환급 · `irpHistory` push · 상태 마감) |
| 장부 | `GameState.turnOpenIrp`(시장 반영 전) · `turnMarketIrp`(시장 반영 직후). `TurnSummary.irpOpen`·`irpAfterMarket`·`marketDelta`·`actionDelta` 추가. 기존 `irpBefore`(행동 직전)·`irpAfter`(행동 뒤)는 유지 |
| 정산 장면 | 막대 3개(턴 시작 → 시장 반영 → 내 행동 후) + "시장 +N · 내 행동 +M" 한 줄. "상품별 이번 턴"은 **시장이 한 일**, 행동·비중·이동은 **내가 한 일**, 칸 효과 블록, 고스트 비교 줄 |
| 속보 카드 | 화살표 아래 "내 IRP에 반영 +N원(+x%)" 줄. 도착 효과 스트립(아이콘 + 한 줄, 최대 2개: 연말정산 통과 + 도착 칸). 1턴 코치 말풍선: "뉴스를 본 순간 가격은 이미 움직였어요…" |
| 칸 효과 | 아래 표. `TileEffect { kind, title, detail, amount?, productId?, alert?, range?, understanding? }`. `GameState.tileEffects: TileEffect[]`(이번 턴, 0~2개), `finalizeTurn`에서 비움 |
| 연말정산 | `contribute()`는 생활자금에 즉시 더하지 않고 `pendingTaxCredit`에 누적. 출발 칸 **통과 또는 도착**(`position + steps ≥ 24` 또는 도착 0번) 시 `cash += pendingTaxCredit`, `taxCreditRefunded += …`, 효과 `tax-refund`. 12턴 `finalizeTurn`에서 잔여분 일괄 환급(손해 없음). 납입이 없어도 통과 장면은 뜬다("환급 0원 · 납입하면 13.2%") |
| 행동 2회 | 운용지시 칸 `actionsLeft = 2`. 첫 행동이 성공하면 `awaitingAction` 유지·요약 없음·`turnActionLines`에 누적. `hold`는 남은 행동을 모두 소비. 두 번째 행동 뒤 `finalizeTurn`, 요약 `actionLine`은 두 줄을 " · "로 이음 |
| 상품 거리 | `spotlightProductId`. 그 상품 매수·교체 매수 시 이해 +1. 펀드면 **오늘 기준가로 즉시 체결**(주문 대기 없음). 예금 거리면 이번 턴 예금 해지 불이익 면제. 스트립 문구에 등급·민감도·체결 방식 |
| 시장 뉴스·금리 전망길 | `signal-preview`: `path[turn]`(다음 턴 스텝)의 `alert`를 한 턴 먼저 보인다. 없으면 "다음 턴에도 특별한 신호 없음". 강·약·거짓 그대로 |
| 생활 사건 칸 | 이번 턴 시드 일정 사건이 없고 `extraLifeEvents < 1`이고 2~11턴이면 `hashSeed(seed:tile-life:turn)`로 사건 1개 추가. `extraLifeEvents += 1`, `eventHistory`에 기록 |
| 제도 안내 | 이번 판에 아직 안 열린 '제도' 카드 1장 해금(없으면 아무 카드도 열지 않음) + 이해 +1. 묶음 B에서 퀴즈로 교체 |
| 리밸런싱 칸 | 스트립에 "지금 → 목표" 비중 차이. 이번 턴 리밸런싱하면 이해 +2 추가(`rebalanceBonusTurn`) |
| 은퇴 전망대 | `outlookRange(state)`: `generateMarketPath(seed:fork:k)` k=0..19로 남은 턴 보유분만 굴려 월 연금 하위(p10)·중위·상위(p90). 결정적. 실제 경로는 쓰지 않는다 |
| 성향 점검 | `behaviorProfile` vs 진단 성향. 위험비중이 목표와 10%p 이내면 이해 +1. 스트립에 두 성향 이름과 비중, "성향 다시 진단" 버튼(기존 설정 동선) |
| 분산 광장 | 5% 이상 보유 상품 3종 이상이면 이해 +1, 아니면 분산 카드 해금과 힌트 |
| 고스트 | `createGame(..., { ghost: true })`가 `autoplay(seed, 'passive', profile, { ghost: false })`를 돌려 `ghost: { irpHistory: number[]; finalCash: number }` 저장. 같은 주사위·같은 사건·같은 칸 효과, 행동은 항상 `hold`. 정산 비교 줄 "그대로 뒀다면 X · 내 판단 Y (±Z)", 결과 스파크라인 2줄(점선·라벨), "판단의 값어치: 월 연금 ±N원 · 총자산 기준 ±M원", 이기면 "고스트 격파" 배지, 지면 가장 벌어진 턴 한 줄. HUD 목표 게이지 아래 얇은 고스트 마커 |
| 설정 | `settings.ghost`(기본 true). `SaveData.version: 4`. v1~v3 저장은 `ghost: true`로 승격 |
| 자동 전략 | `newsChaser` 추가(ETF +1% 넘으면 예금→ETF, −1% 밑이면 ETF→예금, 그 외 납입). `AUTO_STRATEGIES` 9종. `autoplay`는 `awaitingAction`이 풀릴 때까지 같은 턴에 행동을 반복(행동 2회 칸 대응) |
| 시뮬 옵션 | `createGame`·`autoplay` 옵션 `{ tileEffects?: boolean; ghost?: boolean }`. 게이트 측정용으로 칸 효과를 끌 수 있다. 기본 켬 |
| 문구 | 행동 메뉴 "시장은 이미 움직여 보유분에 반영됐습니다. 지금 고르는 행동은 다음 턴 흐름에 거는 것입니다." 유지 뷰 "구성을 그대로 두고 이번 턴을 마칩니다." 하우투 2단계 "시장이 먼저 움직여 잔고에 반영됩니다." 학습 카드 `etf-order` 본문 갱신 |

## 모듈

- `src/engine/tile-effects.ts`(신규, 순수) — `tileEffectFor(tile)`, `applyTileArrival(state, position, crossedStart)`, `outlookRange(state)`, `pickExtraLifeEvent(seed, turn)`.
- `src/engine/game-engine.ts` — `startTurn` 순서 변경, `contribute` 환급 보류, `performAction` 행동 카운트, `finalizeTurn` 마감 전용, `autoplay` 루프·`newsChaser`, `createGame` 옵션·고스트.
- `src/engine/portfolio-engine.ts` — 스포트라이트 즉시 체결·해지 면제·이해 +1.
- `src/engine/settlement-engine.ts` — 3점 비교, 칸 효과·고스트 필드.
- `src/ui/settlement.ts` — 막대 3개, 블록 재배치, 칸 효과·고스트 줄.
- `src/ui/news-flash.ts` — IRP 반영 줄, 도착 효과 스트립, 1턴 코치.
- `src/ui/result-chart.ts` — 시리즈 2개.
- `src/ui/hud.ts` — 고스트 마커.
- `src/ui/app.ts` — 행동 2회 흐름, 문구, 결과 화면 고스트 블록, 설정 토글.
- `src/ui/ui-state.ts` — v4.
- `src/data/content.ts` — `boardTiles[].effect`, `validateContent`.

## 밸런스 게이트(전략 × 시드 400)

- 3.2: `newsChaser`가 `balanced`를 이기는 시드 ≤ 50%(운 수준). `passive`·`contributor`의 월 연금 평균은 순서 변경 전과 ±1% 이내. `momentum`·`stopLoss` 별 평균이 오르지 않는다.
- 3.1: `passive` 0별 비율 ≥ 35% 유지. `steward`·`balanced` 3별 비율 변동 ±10%p 이내. 칸 효과 켬/끔 월 연금 기대치 차이 ≤ 1.5만 원. 같은 시드 → 같은 칸 효과.
- 3.3: 표시만. 고스트 최종값 = `autoplay(seed, 'passive')` 최종값.
- 기존 `tests/balance-gate.test.ts` 통과. 측정값은 이 문서 끝에 기록한다.

## 작업

- [ ] 1. 플랜 문서(이 파일)
- [ ] 2. 3.2 턴 순서 — 엔진(`startTurn`·`finalizeTurn`·장부)·`summarizeTurn` 3점·`newsChaser`·테스트·게이트 측정
- [ ] 3. 3.2 UI — 정산 막대 3개·블록 재배치, 속보 IRP 줄·코치, 행동 메뉴 문구, 하우투, 학습 카드
- [ ] 4. 3.1 엔진 — `tile-effects.ts`, `boardTiles.effect`, 환급 보류·통과 환급, 행동 2회, 스포트라이트, 추가 사건, 전망대, 성향 점검, 테스트·게이트
- [ ] 5. 3.1 UI — 속보 도착 효과 스트립, 행동 시트 "행동 1/2", 리밸런싱 지금→목표, 정산 칸 효과 블록, 환급 연출·소리
- [ ] 6. 3.3 — 고스트 계산·저장 v4·정산 줄·결과 스파크라인 2줄·값어치·HUD 마커·설정
- [ ] 7. 매뉴얼(사용자·운영자) 현행화 + QA 케이스 + 다이어그램(workflow·sequence) 갱신
- [ ] 8. `npm run typecheck && npm test && npm run build`, 브라우저 확인, 커밋·PR

## 범위 밖(묶음 B·C로)

- 퀴즈(3.4) — 제도 안내 칸은 카드 해금 + 이해 +1로 임시.
- 생활사건 3지선다(3.5), 수령 방식(3.6), 디폴트옵션(3.7), 결과 서사(3.8), 리듬(3.9), 업적(3.10).
