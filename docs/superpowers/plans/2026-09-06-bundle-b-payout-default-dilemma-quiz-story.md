# 묶음 B(P1) 구현 플랜 — 수령 방식 · 디폴트옵션 · 생활사건 3지선다 · 퀴즈 · 결과 서사

> 리뷰 `docs/2026-09-06-playtest-review-10-improvements.md`의 P1 다섯 개(3.6 → 3.7 → 3.5 → 3.4 → 3.8)를 한 묶음으로 구현한다. 기준 `main` `9ca61d0`(태그 `prod-2026-09-06-sell-switch-fix`). 시장 엔진·턴 순서·칸 효과·고스트·연출은 바꾸지 않는다. 배움 지도의 빈칸 두 개(**받기**, **안 하기**)를 채우고, 사건·카드·결과가 "결정"이 되게 한다.

## 목표

- **받기**(3.6). 12턴 뒤 결과 화면 앞에 최종 결정 1회: 연금(20년)으로 받을지 일시금으로 받을지. 세율 차이(교육용 5.5% vs 16.5%)를 숫자로 체감한다.
- **안 하기**(3.7). 게임 시작에 디폴트옵션 1개를 지정한다. 「이번엔 그대로」를 고르면 IRP 대기자금이 디폴트옵션 상품으로 자동 운용된다. 납입만 하고 매수를 잊는 실수를 제도가 어떻게 막는지 배운다.
- **지키기**(3.5). 생활사건이 3지선다 딜레마가 된다: 생활자금 · 예금 중도해지 · IRP 중도인출(허용 사유만). 보너스는 전액 납입 · 절반 납입 · 생활자금 유지. 정산에 「사건」 블록과 "다른 선택이었다면" 한 줄.
- **확인**(3.4). 학습 카드마다 3지선다 퀴즈 1문항. 제도 안내 칸·시장 뉴스 칸(1/2)·결과 직전 최종 3문항. 지식 점수가 "내가 맞힌 것"으로 읽힌다.
- **서사**(3.8). 별이 잠긴 이유 한 줄, 부족분을 계산한 처방, 목표 50/75/90/100% 마일스톤과 낙폭 12% 경고.

## 고정 사항

| 항목 | 값 |
|---|---|
| 수령 방식 | `PayoutChoice = 'annuity20' \| 'lumpSum'`. `policy-rules.json`에 `pensionTaxRate 0.055`, `lumpSumTaxRate 0.165`(교육용 단순화, 기준일 2026-09-06). `payoutPlan(irp, choice)` → `{ taxRate, tax, net, monthlyNet, monthlyBasis }`. **게임의 월 연금 단위(세전 IRP÷240)는 유지**한다. 목표 판정은 연금 수령을 기준으로 재고, 일시금은 세후 총액을 연금 세후 기준으로 환산한다: `payoutFactor(lumpSum) = (1−0.165)/(1−0.055) ≈ 0.8836`. `calculateScore`는 `state.payoutChoice ?? 'annuity20'`을 쓰므로 시뮬·고스트·기존 별 분포는 그대로다 |
| 수령 흐름 | 12턴 정산 닫기 → 최종 퀴즈(최대 3문항) → **수령 방식 모달** → 결과. `choosePayout(state, choice)`가 `payoutChoice`·로그·카드 2장(`pension-tax`, `payout-choice`) 해금. 별 소리는 수령 결정 뒤에 낸다 |
| 디폴트옵션 | `default-options.json` 4종: `principal`(예금) · `lowRisk`(단기채·예금) · `midRisk`(혼합형·TDF) · `highRisk`(TDF·주식 ETF). 성향 허용 등급을 모두 통과해야 고를 수 있다. 성향별 추천: 안정형 principal, 안정추구형 lowRisk, 위험중립형 midRisk, 적극·공격 highRisk. `GameState.defaultOption: DefaultOptionId \| null`. `SaveData.version 5`에 `defaultOption`(마지막 선택, 없으면 null) |
| 디폴트옵션 동작 | `performAction('hold')`: `defaultOption`이 있고 `irpCash ≥ 10만`이면 상품 수로 균등 매수(몫이 10만 미만이면 첫 상품에 전액). 펀드는 기존 규칙대로 다음 턴 체결. 메시지 "디폴트옵션이 대기자금 N원을 A·B로 운용했습니다". `safeActionCount +1`은 유지. 시작 모달에서 지정(설정에서 변경). `passive`·고스트는 디폴트옵션 없음(기준선 유지). 새 전략 `defaultOption`(납입 여력 있으면 납입, 아니면 그대로 + 추천 디폴트옵션) |
| 생활사건 선택 | `LifeChoice = 'cash' \| 'deposit' \| 'withdraw' \| 'contribute-all' \| 'contribute-half' \| 'transfer-irp' \| 'take-cash'`. 비용 사건: `cash`(생활자금, 모자라면 기존 자동 충당) · `deposit`(예금 중도해지로 지급, 보유 10만 이상일 때만, 불이익 1.2%, 모자라면 생활자금) · `withdraw`(허용 사유만, 수수료 3% 유지; 불가 사유는 **비활성 + 이유 표시**). 보너스: `contribute-all` · `contribute-half`(연간 한도 안) · `cash`. 이직 퇴직금: `transfer-irp`(IRP 대기자금으로 전액, 세금 없음) · `take-cash`(일시 수령, 교육용 16.5% 차감) |
| 생활사건 12종 | 기존 8 + `severance`(이직 퇴직금 IRP 이전, kind transfer, 6,000,000) · `yearend-bonus`(연말 성과급, −3,000,000) · `tuition`(자녀 학자금 3,800,000, 불가) · `parents`(부모 부양 2,800,000, 불가). `LifeEvent.kind: 'cost' \| 'bonus' \| 'transfer'` |
| 사건 기록 | `GameState.lifeResolution: LifeResolution \| null`(제목·선택 라벨·즉시 비용·불이익/수수료·매도 내역·"다른 선택이었다면" 한 줄). `startTurn`에서 비운다. `TurnSummary.lifeEvent` → 정산 「사건」 블록 |
| 퀴즈 데이터 | `learning-cards.json` 각 카드 `quiz: { q, options: [3], answer: 0\|1\|2, why }`. 카드 19 → 22(`pension-tax`, `payout-choice`, `default-option` 추가). `validateContent`가 22장 전부 퀴즈 형식 검사 |
| 퀴즈 엔진 | `src/engine/quiz-engine.ts`(순수): `pickQuizCard(state, salt)`(해금됐고 아직 안 푼 카드 중 시드 결정적 1장, 없으면 null), `queueQuiz(state, cardId)`, `answerQuiz(state, cardId, option)` → 정답 이해 +2·`quizStreak`+1(3연속이면 메시지), 오답 벌점 없음·`quizStreak` 0. `GameState.quizLog: { cardId, correct, turn }[]`, `quizStreak`, `pendingQuizCardId` |
| 퀴즈 출제 | 제도 안내 칸: 카드 해금 뒤 그 카드 퀴즈(기존 이해 +1은 유지). 시장 뉴스 칸: `hashSeed(seed:quiz:turn)` 짝수면 출제. 결과 직전: 해금·미출제 카드에서 최대 3문항. 퀴즈 모달은 속보 닫은 뒤(사건·행동 전)에 뜬다 |
| 지식 점수 | `4 + min(8, 정답×2) + min(6, understandingPoints) + min(4, rebalanceCount×2) − ruleBreaches×5`, 0~20. 별 조건에는 들어가지 않는다 |
| 결과 서사 | `starLockReason(state, score)`: 잠긴 첫 조건과 통과한 조건 수를 한 줄로. `shortfallPlan(state, score)`: 부족 월 연금 → 필요 IRP(`÷ payoutFactor × 240`) → 필요 추가납입(연간 한도 안이면 "더 넣었다면 도달", 넘으면 "한도 밖 · 운용 수익이 필요") + 공제한도 안 환급 추정. 목표 달성이면 null |
| 마일스톤 | `finalizeTurn`에서 목표 달성률이 0.5/0.75/0.9/1.0을 **처음** 넘으면 `milestonesHit`에 `goal-50`… 추가, 낙폭 12% 첫 초과는 `drawdown-12`. `TurnSummary.milestones: Milestone[]`. 정산 배너 + 코치 말풍선 + 효과음 `milestone`(10종째, 기본 끔). 100%는 CSS 컨페티(동작 줄이기면 없음). 남은 턴 3 이하·목표 미달이면 턴 트랙 `urgent` |
| 저장 | `SaveData.version 5`: `defaultOption: DefaultOptionId \| null`. v1~v4 → null(첫 시작 모달에서 고름) |
| 자동 전략 | `AUTO_STRATEGIES` 9 → 11: `defaultOption`, `withdrawer`(허용 사유면 항상 중도인출). `AutoplayOptions`에 `defaultOption`, `lifeChoice`, `quiz: 'correct' \| 'wrong' \| 'none'` |

## 밸런스 게이트

| 게이트 | 기준 |
|---|---|
| 수령 | `annuity20` 기준 별 분포·월 연금이 묶음 A 측정값과 같다(수식 불변). `lumpSum`은 같은 상태에서 goalRate ×0.8836 |
| 디폴트옵션 | 400시드: `defaultOption` 별 평균이 `passive`보다 높고 `balanced`보다 낮다(안전망이지 최적해가 아니다) |
| 사건 | `balanced`의 `cashShortages` 평균이 묶음 A 대비 ±0.3회. `withdrawer` 별 평균 ≤ `balanced` |
| 퀴즈 | `quiz: 'wrong'`·`'none'` 지식 점수 ≥ 4, `'correct'` ≤ 20. 별 분포 불변 |
| 결정성 | 같은 시드 → 같은 사건·퀴즈 출제·마일스톤 |

## 모듈

- `src/engine/scoring-engine.ts` — `payoutPlan`, `payoutFactor`, `calculateScore(state)`(수령 방식 반영), `starLockReason`, `shortfallPlan`, 지식 점수 식.
- `src/engine/life-engine.ts`(신규, 순수) — `lifeChoicesFor(state, event)`(선택지·가능 여부·비용표), `resolveLifeChoice` 본체, `LifeResolution` 생성. `game-engine.resolveLifeEvent`는 여기로 위임.
- `src/engine/default-option.ts`(신규, 순수) — `allowedDefaultOptions(profileId)`, `suggestDefaultOption(profileId)`, `applyDefaultOption(state)`(hold 시 균등 매수).
- `src/engine/quiz-engine.ts`(신규, 순수).
- `src/engine/game-engine.ts` — `createGame` 옵션 `defaultOption`, `startTurn`(사건 기록·퀴즈 큐 비움, 시장 뉴스 칸 퀴즈), `performAction('hold')`, `finalizeTurn`(마일스톤), `choosePayout`, `autoplay` 전략·옵션.
- `src/engine/tile-effects.ts` — 제도 안내 칸이 퀴즈를 큐에 넣는다.
- `src/ui/app.ts` — 모달 `default-option`·`quiz`·`payout`, 생활사건 3지선다, 결과 화면(수령 블록·별 잠금 이유·처방·배운 것), 설정(디폴트옵션 변경).
- `src/ui/life-view.ts`(신규) — 사건 모달 선택지·비용표 마크업. `src/ui/quiz-view.ts`(신규) — 퀴즈 모달·결과 「배운 것」. `src/ui/payout-view.ts`(신규) — 수령 방식 모달·결과 수령 블록. `src/ui/settlement.ts` — 사건 블록·마일스톤 배너. `src/ui/market-view.ts` — 턴 트랙 `urgent`. `src/ui/sound.ts` — `milestone`.
- 데이터 — `policy-rules.json`, `learning-cards.json`(22장 + 퀴즈), `life-events.json`(12종), `default-options.json`(신규), `content.ts` 검증.
- 테스트 — `tests/payout.test.ts`, `tests/default-option.test.ts`, `tests/life-choices.test.ts`, `tests/quiz.test.ts`, `tests/story.test.ts`, `balance-gate.test.ts` 게이트 추가, `engine.test.ts` 저장 v5.
- 문서 — 두 매뉴얼·`manuals.test.ts`·다이어그램(workflow: 퀴즈·수령 단계, lifecycle: `payout` 상태, sequence: hold → 디폴트옵션, dataflow: 저장 v5).

## 작업 순서

1. [ ] 3.6 수령 방식 — 정책·타입·`payoutPlan`·`calculateScore`·`choosePayout`·카드 2장·테스트
2. [ ] 3.7 디폴트옵션 — 데이터·`default-option.ts`·hold 자동 매수·저장 v5·전략·게이트·카드 1장·테스트
3. [ ] 3.5 생활사건 — 사건 12종·`life-engine.ts`·`LifeResolution`·정산 블록·`withdrawer`·게이트·테스트
4. [ ] 3.4 퀴즈 — 22문항·`quiz-engine.ts`·출제 지점·지식 점수·테스트
5. [ ] 3.8 결과 서사 — `starLockReason`·`shortfallPlan`·마일스톤·효과음·테스트
6. [ ] UI — 모달 3개(디폴트옵션·퀴즈·수령), 사건 3지선다, 정산 사건·마일스톤 블록, 결과 화면, 설정, CSS
7. [ ] 매뉴얼·`manuals.test`·다이어그램 현행화, 게이트 측정값 기록
8. [ ] typecheck·lint·test·build·브라우저 확인(헤드리스 12턴 + 각 모달 스크린샷) → PR

## 범위 밖(묶음 C로)

- 리듬 다이어트(3.9), 업적·컬렉션·주간 시드(3.10).
- 10년 분할 수령(3.6의 선택 항목) — 목표 판정을 왜곡하지 않는 표현을 찾지 못해 카드 본문으로만 다룬다.
- 위험비중 대안 시뮬 처방(3.8) — 남은 턴이 없어 분기 시뮬 근거가 약하다. 납입 기반 처방만 계산한다.
