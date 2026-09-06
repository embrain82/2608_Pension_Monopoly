# 묶음 C(P2) 구현 플랜 — 턴 리듬 다이어트 · 업적 · 컬렉션 · 주간 시드

> 리뷰 `docs/2026-09-06-playtest-review-10-improvements.md`의 P2 두 개(3.9 → 3.10)를 한 묶음으로 구현한다. 기준 `main` `7b5e9eb`(태그 `prod-2026-09-06-bundle-b`). 엔진의 시장·턴 순서·칸 효과·사건·퀴즈·수령·점수는 바꾸지 않는다. 바꾸는 것은 **한 턴에 드는 클릭과 시간**, 그리고 **다시 할 이유**다.

## 목표

- **리듬**(3.9). 「그대로」턴 7~8클릭 → 5클릭. 정산 창은 스크롤 없이 첫 화면에서 넘어간다. 애니메이션 속도 1×/2×, 7턴 뒤 속보·정산 연출 절반 길이(충격·이정표 턴은 정속), 정산 자동 진행(선택, 기본 끔). 생활사건 뒤 운용 시트에 「사건 해결됨 · 이제 운용」 머리글. 턴 트랙에 남은 예정 사건 수.
- **재플레이**(3.10). 업적 12개(판 11 + 누적 1), 성향별 캐릭터 컬렉션(5종 × 최고 별), 주간 시드(`weekly-YYYY-Www`, 모두 같은 시장), 결과 텍스트 복사(공유). 결과 화면에 「새 업적」 스태거 연출.

## 고정 사항

| 항목 | 값 |
|---|---|
| 저장 | `SaveData.version 6`. `settings`에 `speed: 1 \| 2`(기본 1), `autoSettle: boolean`(기본 false), `settleExpanded: boolean`(정산 「자세히」 펼침 기억, 기본 false). 새 필드 `achievements: AchievementId[]`, `collection: Record<ProfileId, { plays: number; bestStars: 0\|1\|2\|3 }>`. v1~v5 → 기본값(업적 빈 배열, 컬렉션 0) |
| 속도 | `speedScale(speed) = speed === 2 ? 0.5 : 1`. JS 타이머(주사위 굴림·정지 유지, 말 한 칸, 마지막 착지, 숫자 트윈, 별 소리 간격, 환급 소리 지연)에 곱한다. CSS는 `html[data-speed="2"] { --fx: .5 }`로 속보·정산·결과의 주요 `animation-duration`·`animation-delay`에 `calc(var(--fx, 1) * …)`를 곱한다. 동작 줄이기가 켜져 있으면 속도 설정은 의미 없음(즉시 표시) |
| 후반 가속 | `scenePace(turn, shock, milestones) = turn >= 7 && !shock && milestones === 0 ? 'fast' : 'normal'`. 속보 카드는 이정표를 모르니 `(turn, shock)`만 본다. `fast`면 카드 루트에 `.fast` → `--pace: .5`(속보 헤드라인 타이핑·다이얼·화살표 지연, 정산 막대·상품별 지연). 속도 2×와 곱해진다 |
| 「그대로」 | 행동 목록의 「이번엔 그대로」 버튼이 바로 `do-hold`. 확인 화면(“이번엔 그대로 둘까요?”) 삭제. 버튼 문구는 디폴트옵션이 실제로 사면 「디폴트옵션으로 운용하고 마감」, 아니면 「그대로 두고 마감」. 매수 한도 확인(70%)은 그대로 둔다(되돌릴 수 없는 결정) |
| 사건 → 운용 | 사건을 해결한 뒤 열리는 행동 목록 상단에 `.life-resolved-strip`: 「사건 해결됨 · {사건} → {선택} · 이제 운용」. `state.lifeResolution`이 있고 이번 턴 행동이 아직 없을 때만 |
| 정산 접기 | `renderSettlementModal(summary, { …, expanded, autoSettleMs })`. 첫 화면: 이정표 배너 · 막대 3개(+사건 줄) · 고스트 줄 · 사건 블록 · 다음 턴 신호 · 한 줄 정리 · **다음 턴 버튼**. `<details class="settle-more">`(요약 「자세히 · 상품별 수익률 · 내가 한 일 · 칸 효과 · 다음 판단」)에 상품별 막대·내가 한 일·칸 효과·다음 판단을 접는다. 펼침 상태는 `settleExpanded`에 기억. 12턴(마지막)은 「남은 일」을 접지 않는다 |
| 자동 진행 | `settings.autoSettle`이 켜져 있고 **마지막 턴·충격 턴·이정표 턴·생활사건 턴이 아니면** 정산 창이 뜬 2.5초 뒤 `afterSettlement()`. 버튼 아래 진행 막대(동작 줄이기면 막대 없이 타이머만). 정산 창 안 아무 곳이나 누르거나 「자세히」를 펼치면 취소. 기본 끔(시간 제한은 접근성 문제라 사용자가 켠다) |
| 턴 트랙 | `renderTurnTrack` 끝에 `.track-note`: 남은 예정 사건 수(`lifeEventSchedule.turn > state.turn`) — 「사건 N회 남음」 / 0이면 「예정 사건 없음」. 어느 턴인지는 계속 숨긴다(스포일러 규칙 유지). 칸 도착 추가 사건은 예정에 없으니 세지 않는다 |
| 판 기록 | `GameState.record: PlayRecord = { rebalanceTurns: number[]; diversifiedTurns: number; defaultOptionRuns: number; lifeChoices: Array<{ eventId; choice }> }`. `performAction`(리밸런싱 성공 턴, 디폴트옵션 실제 매수), `finalizeTurn`(마감 시 5% 이상 보유 3종 이상이면 +1), `life-engine.resolveLifeChoice`(선택)에서 채운다. 시뮬·고스트에도 같이 쌓이지만 점수에는 안 들어간다 |
| 업적 12개 | `src/engine/achievements.ts`(순수). 판(끝난 판만): `goal-reached`(목표 도착) · `three-stars`(별 셋) · `calm-seas`(최대 낙폭 5% 이내) · `diversified-12`(12턴 모두 3종 이상 분산) · `pre-shock-rebalance`(충격 바로 전 턴 리밸런싱) · `tax-credit-max`(공제 대상 900만 채움) · `quiz-perfect`(3문항 이상 전부 정답) · `ghost-crusher`(고스트보다 월 연금 +5만 이상) · `annuity-choice`(연금 수령 선택) · `default-option-run`(디폴트옵션 자동 매수 2회 이상) · `severance-to-irp`(퇴직급여 IRP 이전). 누적: `all-profiles`(컬렉션 5성향 모두 완주 1회 이상). `evaluateGame(state)`, `evaluateMeta(save)`, `newlyUnlocked(save, state)` |
| 컬렉션 | 결과 화면에 들어설 때(`recordResult(countPlay=true)`) `collection[profileId].plays += 1`, `bestStars = max`. 도감 모달(학습 카드 도감과 같은 자리)에 「캐릭터 컬렉션」 탭: 동물 5종, 판 수, 별 |
| 주간 시드 | `weeklySeed(date = new Date()) = 'weekly-' + ISO 주(YYYY-Www)`. 타이틀 「이번 주 시드로 도전 · 2026-W36」. 같은 시드 = 같은 시장·주사위·사건. 결과 화면 시드 줄에 「주간 시드」 배지 |
| 공유 | `resultShareText(state, score, achievements)` 순수 함수 → 결과 화면 「결과 복사」(navigator.clipboard, 실패하면 텍스트를 alert 대신 피드백 줄에). 주간 시드면 시드 포함 |
| 새 업적 연출 | 결과 화면 별 아래 「새 업적」 카드 스태거(별 연출 재사용, `--i`), 효과음 `milestone` 재사용. 이미 가진 업적은 도감에서만 |

## 밸런스·품질 게이트

| 게이트 | 기준 |
|---|---|
| 점수 불변 | 12전략 × 200시드에서 별·월 연금 평균이 묶음 B 측정값과 같다(기록 필드는 점수에 안 들어간다) |
| 업적 달성률 | 400시드 × 전략 11종에서 판 업적 11개 각각 **어느 전략에서든 1% 이상** 달성(불가능한 업적 없음), `passive`는 `goal-reached`·`three-stars`·`calm-seas` 외에는 0%에 가까움(행동 업적은 행동으로만) |
| 접근성 | 동작 줄이기면 속도·후반 가속·자동 진행 막대는 즉시 표시. 자동 진행은 기본 끔. `<details>`는 키보드로 열림 |
| 결정성 | 같은 시드 → 같은 기록·업적 |
| 저장 | v1~v5 → v6 마이그레이션 테스트, 잘못된 값은 기본값 |

## 모듈

- `src/ui/fx.ts` — `speedScale`, `scaleMs`, `scenePace`.
- `src/ui/fx-dom.ts` — `runNumberAnimations(root, skip, durationMs)`.
- `src/ui/dice.ts` — `renderDiceMarkup(faces, rolling, durationMs)`.
- `src/ui/token3d.ts` — `hopPlan(final, scale)`.
- `src/ui/news-flash.ts` — `pace` 옵션 → `.fast`.
- `src/ui/settlement.ts` — 접기·자동 진행 막대·`pace`.
- `src/ui/market-view.ts` — `renderTurnTrack` 남은 사건 수, `remainingLifeEvents(state)`.
- `src/ui/ui-state.ts` — v6, 새 설정·업적·컬렉션 마이그레이션.
- `src/engine/achievements.ts`(신규, 순수) — 정의 12개·평가·`weeklySeed`·`resultShareText`.
- `src/engine/game-engine.ts` — `record` 초기화·갱신. `src/engine/life-engine.ts` — `lifeChoices`.
- `src/ui/achievements-view.ts`(신규) — 도감 탭(업적·컬렉션)·결과 「새 업적」 카드·시드 줄.
- `src/ui/app.ts` — 설정 3개(속도·자동 진행·정산 펼침은 details가 기억), `do-hold` 직결, 사건 머리글, 자동 진행 타이머, 주간 시드 버튼, 결과 복사, 새 업적 기록.
- 테스트 — `tests/rhythm.test.ts`(fx·pace·턴 트랙·정산 접기·주사위 ms), `tests/achievements.test.ts`(12개 각각 성립/불성립·결정성·주간 시드·공유 텍스트·달성률 게이트·점수 불변), `engine.test.ts`·`default-option.test.ts` 저장 v6.
- 문서 — 두 매뉴얼(설정 3개·행동 목록·정산 접기·업적·컬렉션·주간 시드·저장 v6·Q55~)·`manuals.test.ts`·다이어그램(workflow 정산 접기/자동 진행, lifecycle 자동 진행 전이, dataflow 저장 v6·업적, architecture `achievements.ts`).

## 작업 순서

1. [ ] 3.9 순수 계층 — `fx` 속도·pace, 저장 v6(설정 3개), 턴 트랙 남은 사건, 정산 접기 마크업, 주사위 ms 인자, 테스트
2. [ ] 3.9 UI — `do-hold` 직결·확인 화면 삭제, 사건 머리글, 정산 접기/자동 진행 타이머, 속도 설정·CSS `--fx`/`--pace`, 후반 가속
3. [ ] 3.10 엔진 — `PlayRecord`, `achievements.ts`, 컬렉션, 주간 시드, 공유 텍스트, 저장 v6(업적·컬렉션), 테스트·게이트(달성률·점수 불변)
4. [ ] 3.10 UI — 결과 새 업적 연출·시드 줄·결과 복사, 도감 탭(업적·컬렉션), 타이틀 주간 시드 버튼, CSS
5. [ ] 매뉴얼·`manuals.test`·다이어그램 현행화, 게이트 측정값 기록
6. [ ] typecheck·lint·test·build·헤드리스 12턴(속도 2×·자동 진행·업적) → PR

## 범위 밖

- 결과 공유 **이미지**(canvas 렌더) — 텍스트 복사로 대신한다. 정적 호스팅에서 이미지 공유는 파일 저장 UX가 브라우저마다 달라 다음 묶음으로.
- 랭킹·서버. 주간 시드는 같은 시장을 플레이하게만 한다.
- 속도 3× 이상, 애니메이션 완전 끔은 「동작 줄이기」가 이미 한다.
