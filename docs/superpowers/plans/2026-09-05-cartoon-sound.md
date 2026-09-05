# 묶음 3 구현 플랜 — 카툰·사운드

> 제안서 `docs/2026-09-04-game-drama-and-volatility-proposal.md`(브랜치 `cursor/p0-market-first-loop-5ed6`) 묶음 3(B3·B4·B5·B7·C4)의 구현 플랜이다. 시장 엔진(묶음 1)과 연출 코어(묶음 2, `main` `6367038`, 태그 `prod-2026-09-05-drama-core`)는 바꾸지 않는다.

## 목표

- 화면에 **캐릭터**가 생긴다: 성향별 동물 아바타 5종(표정 3종), 앵커 1명, 코치 1명. 기존 `reason`·`reaction`·`nextHints`·`improvement` 문구를 **말풍선**에 담는다(문구는 그대로).
- **효과음** 8종을 WebAudio로 합성한다. 파일 없음, 기본 **끔**, HUD 스피커 토글.
- **결과 화면**이 장면이 된다: 별 순차 등장, 12턴 IRP 스파크라인, 가장 아슬아슬했던 턴, 아바타 표정.
- **보드**가 반응한다: 도착 칸 bounce·파티클, 칸 설명은 첫 문장만 보이고 나머지는 접기.
- 캐릭터 끔·소리 끔이면 **현 디자인과 동등**. 동작 줄이기에서 모든 연출 즉시 완료.

## 고정 사항

| 항목 | 값 |
|---|---|
| 아바타 | 안정형 거북이, 안정추구형 코알라, 위험중립형 여우, 적극투자형 사슴, 공격투자형 치타. 같은 크기·같은 명도(성향은 서열이 아님) |
| 표정 | `calm`(기본) · `tense`(충격 턴 또는 이번 턴 낙폭 5% 이상) · `happy`(목표 달성) |
| 앵커·코치 | 앵커 = 부엉이(속보 카드), 코치 = 펭귄(정산 한 줄 정리·다음 판단, 하우투, 결과 "다음에 바꿀 한 가지") |
| 그림 | 인라인 SVG, 굵은 외곽선, 팔레트 `--green`·`--orange`·`--lime`·크림. 각 1KB 안팎 |
| 설정 | `settings.characters`(기본 true), `settings.sound`(기본 false 유지). `SaveData.version: 3`. v1·v2 저장은 `characters: true`로 승격 |
| 효과음 | `dice`(노이즈 버스트) · `hop`(클릭) · `arrive`(팅) · `news`(2음 징글) · `shock`(저음 붐) · `up`(상승 아르페지오) · `down`(하강 2음) · `star`(3음 상승). 모두 0.6초 이내. 첫 클릭에서 `AudioContext` 생성·resume |
| 결과 | `GameState.irpHistory: number[]` — `createGame`에서 `[startingIrp]`, `finalizeTurn`마다 정산 후 IRP push(12턴 끝나면 길이 13). 스파크라인은 SVG polyline, 충격 턴 번개 마커, 최대 낙폭 턴 표시 |
| 보드 | 도착 칸 `landed` 클래스 → `tile-bounce` 키프레임 + 종류별 파티클(`::after` 없음 — SVG `<g class="tile-fx">` 원 3개). 칸 설명 본문은 첫 문장(≤80자 근사)만 노출, 나머지 `<details>` |

## 모듈

- `src/ui/avatars.ts` — `avatarMood(state, score)`, `renderAvatar(profileId, mood, size)`, `renderAnchor(size)`, `renderCoach(size)`. 순수 문자열.
- `src/ui/speech.ts` — `renderSpeech(speaker: 'anchor' | 'coach' | 'player', body, opts)`. 캐릭터 끔이면 아바타 없이 같은 상자.
- `src/ui/sound.ts` — `toneScript(name)`(순수, 테스트 대상) + `SoundPlayer`(DOM/WebAudio, 테스트 제외).
- `src/ui/result-chart.ts` — `sparklinePoints(history, w, h)`, `worstTurn(history)`, `renderIrpSparkline(history, shockTurns)`.
- `src/ui/board.ts` — 말 = 아바타(nested `<svg>`), `landed` 이펙트.
- `src/ui/tile-briefing.ts` — `briefingLead(body)`.
- `src/ui/app.ts` — 설정 토글 2개, HUD 스피커 버튼, 사운드 이벤트 7곳, 결과 화면 확장, 말풍선 적용.

## 작업

- [x] 1. 플랜 문서
- [ ] 2. 설정 v3 마이그레이션 + `irpHistory` (types, ui-state, game-engine, 테스트)
- [ ] 3. `avatars.ts`·`speech.ts` + 테스트 → 보드 말, HUD, 속보 앵커, 정산·하우투·결과 코치
- [ ] 4. `sound.ts` + 테스트 → HUD 토글, 설정 토글, 이벤트 지점
- [ ] 5. `result-chart.ts` + 테스트 → 결과 화면(별 순차, 스파크라인, 아슬아슬 턴)
- [ ] 6. 보드 `landed` 이펙트, 칸 설명 축약 표시 + 테스트
- [ ] 7. CSS(동작 줄이기 준수), 매뉴얼(사용자·운영자), `npm run typecheck && npm test && npm run build`, 번들 증가 확인(≤ 60KB)

## 범위 밖(묶음 4로)

- `tile-briefings.json` 120편 본문 재작성(80자 이내 + `icon` 필드). 이번 묶음은 표시 단계에서 첫 문장만 보여 주는 것으로 대신한다.
- 12턴 트랙을 보드 안쪽 링으로 이동(레이아웃 변경 폭이 커서 별도 판단).
