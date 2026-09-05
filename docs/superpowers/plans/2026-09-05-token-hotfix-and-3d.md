# 말(토큰) 되돌아감 버그 수정 + 3D 말 구현 플랜

> 상태: **A 진행 중(2026-09-05 운영자 결정: A 먼저, B는 A 배포 뒤 결정)**. A는 프로덕션 회귀 버그라 3D 결정과 무관하게 먼저 배포한다.

## A. 버그 — 도착 직후 말이 출발 칸으로 잠깐 되돌아감

### 증상

주사위 → 말 이동 → 마지막 칸에 도착 → **약 0.17초 동안 말이 주사위를 던진 칸(출발 칸)에 보임** → 속보 카드가 뜨면서 도착 칸으로 돌아옴. 캡처(TURN 04, 8칸 이동, 24 리밸런싱 도착) 직전에 보인 현상.

### 원인 (PR #6에서 생긴 회귀)

`src/ui/app.ts`의 이동 틱과 보드 뷰 두 곳의 조합이다.

```400:407:src/ui/app.ts
        const last = index + 1 >= path.length;
        if (last) {
          this.tokenHopping = false;
          this.landed = true;
        }
        this.sound.play(last ? 'arrive' : 'hop');
        this.render();
        if (last) this.tokenHopping = true;
```

```567:575:src/ui/app.ts
  private renderBoard(state: GameState, waiting: boolean): string {
    return renderBoardMarkup(state, waiting, {
      focusIndex: this.tokenHopping ? this.tokenFocus : state.position,
      hopping: this.tokenHopping,
```

- 마지막 틱에서 도착 이펙트(`landed`)를 `hopping` 클래스 없이 그리려고 `tokenHopping`을 잠깐 `false`로 내렸다.
- 그런데 보드 뷰는 `tokenHopping`이 `false`면 `state.position`을 쓴다. 이 시점에는 아직 `startTurn`이 실행되지 않아 `state.position`이 **출발 칸**이다.
- 그래서 마지막 틱 렌더 1회(`TOKEN_STEP_MS` = 170ms)만 말이 출발 칸에 찍히고, `reveal()`에서 `startTurn`이 위치를 갱신하면 도착 칸으로 돌아온다.
- PR #5까지는 마지막 틱에서도 `tokenHopping`이 `true`였으므로 이 현상이 없었다.

### 수정

1. 틱에서 `tokenHopping`을 건드리지 않는다. `landed`만 켠다.
2. 보드 뷰 결정을 `boardViewFor`로 옮긴다. `focusIndex`는 이동 중이면 계속 `tokenFocus`(= 도착 칸), `hopping`은 그대로 `true`라 중앙 문구가 「N번 이동 중」을 유지한다. 마크업에서 `landed`가 `hopping` 강조(tile-focus)를 대신한다. (첫 시도에서 `hopping`을 `false`로 내렸더니 중앙 문구가 170ms 동안 「대기」로 바뀌는 다른 깜빡임이 녹화에 잡혀, 이렇게 고쳤다.)
3. `reveal()`은 지금처럼 `tokenHopping = false`, `tokenFocus = position`, 렌더 뒤 `landed = false`.

변경 폭: `app.ts` 6줄. 엔진·데이터 변화 없음.

### 재발 방지 테스트

`focusIndex`/`hopping` 결정을 `src/ui/board.ts`의 순수 함수 `boardViewFor(state, { tokenHopping, tokenFocus, landed })`로 뽑아 `app.ts`가 그것만 쓰게 하고, `tests/board.test.ts`에 다음을 추가한다.

- 이동 중 마지막 틱(`tokenHopping: true, landed: true, tokenFocus: 도착`) → `focusIndex === 도착`, 마크업의 `active` 칸이 도착 칸, `landed` 클래스만 붙고 `hopping` 클래스 없음, 중앙은 「N번 이동 중」(「주사위를 굴려」 아님).
- 이동 중 중간 틱 → `focusIndex === tokenFocus`, `hopping === true`, `landed` 없음.
- 이동 아님 → `focusIndex === state.position`.

운영자 매뉴얼 QA에 Q35 「이동 마지막 칸에서 말이 출발 칸으로 튀지 않는다(동작 줄이기 끔, 8칸 이동으로 확인)」 추가.

### 배포

핫픽스 브랜치 → PR → `main` 머지 → 태그 `prod-2026-09-05-token-hotfix`. 롤백은 직전 태그 `prod-2026-09-05-cartoon-sound`.

---

## B. 말을 3D로

### 결정할 것 — 구현 방식 4가지

| 방식 | 모양 | 번들 | 위험 | 권고 |
|---|---|---|---|---|
| **B1. CSS 2.5D 오버레이(권고)** | 보드는 그대로 평면. 말만 두께 있는 **원반(퍽)** — 윗면에 동물 아바타, 옆면 두께, 바닥 타원 그림자. 이동 시 위로 튀어오르며 살짝 기울고(rotateX/Y), 그림자가 작아졌다 커진다. 착지 때 찌그러짐(squash) | +3~4KB | 낮음. `transform`·`box-shadow`만 사용, `preserve-3d` 불필요. iOS/은행 앱 웹뷰 안전 | ✔ |
| B2. SVG 안 유사 3D | 지금 SVG 말 위치에 음영·타원 그림자·하이라이트를 그려 입체감. 애니메이션은 지금과 같은 방식 | +1KB | 가장 낮음. 다만 "3D"보다는 "입체 아이콘" 정도 | 절충안 |
| B3. 보드 전체를 기울인 3D 테이블 | `perspective` + `rotateX(55°)`로 보드가 모노폴리 판처럼 눕고, 말은 세워진 카드처럼 서 있음 | +5KB | **높음**. 칸 글자가 기울어 가독성 하락, 375px 폰에서 보드 높이 손실, 접근성 재검증 필요 | 1단계 비권고 |
| B4. WebGL(three.js) 실제 3D 메시 | 진짜 3D 모델 | +150KB(gzip) 이상 | 높음. 웹뷰 GPU 제한, 배터리, 번들 상한(묶음당 60KB) 초과 | 비권고 |

아래는 **B1** 기준 플랜이다. B2를 고르면 3·4·6 항만 남고 반나절 분량으로 줄어든다.

### B1 설계

**레이어 구조**

```
.board-stage (position: relative; aspect-ratio: 1; width: min(100%, 100dvh - 150px))
 ├─ <svg class="board">           ← 24칸·중앙 텍스트·도착 이펙트(파티클·bounce)는 그대로. 말은 그리지 않음
 └─ <div class="token-layer" aria-hidden="true">
      └─ <div class="token3d [plain]" style="--x: 7.14%; --y: 7.14%">
           <div class="token-shadow"></div>
           <div class="token-rim"></div>        ← 옆면(두께). 그라디언트 + 4~6겹 box-shadow로 원기둥 느낌
           <div class="token-face">{아바타 SVG 또는 「나」}</div>
         </div>
```

- 좌표: `boardPosition(index)`의 칸 중심 `(x+50, y+50)`을 700 기준 퍼센트로 변환. `.board-stage`가 정사각형이라 SVG 좌표와 퍼센트가 1:1로 맞는다. 지금 `.board { max-height: calc(100dvh - 150px) }` 때문에 생길 수 있는 레터박스는 stage가 정사각형을 강제해 없앤다.
- 접근성: 위치 정보는 지금처럼 SVG `aria-label`("현재 말은 N번 칸 …")이 전달한다. 오버레이는 `aria-hidden`.
- 캐릭터 끔: 윗면이 주황 원 + 「나」인 퍽(`.plain`). 3D 여부는 캐릭터 설정과 독립.

**이동 애니메이션**

- `--x/--y`에 `transition: transform TOKEN_STEP_MS ease-out`. 한 칸마다 `token-hop` 키프레임(위로 18px, `rotateX(-12deg) rotateY(6deg)`, 그림자 `scale(.7)` + 흐림)을 다시 재생.
- 착지(`landed`): `token-land` 키프레임(찌그러짐 `scale(1.12, .88)` → 복원)과 그림자 원복. 기존 칸 bounce·파티클과 같은 타이밍.
- 렌더 방식이 핵심이다. 지금 `app.ts`는 매 틱 `innerHTML`을 다시 써서 노드가 새로 만들어지고 **CSS transition이 끊긴다**. 주사위 오버레이(`existingOverlay`)와 같은 방법으로 `.token-layer` 노드를 **렌더 사이에 보존**하고 `style` 변수와 클래스만 갱신한다. `render()`에 `this.syncTokenLayer()`를 추가한다.
- 동작 줄이기: transition·키프레임 없음(기존 `html[data-reduce-motion]` 규칙이 이미 덮는다). 위치는 즉시.

**모듈**

- 새 `src/ui/token3d.ts`(순수): `tokenPercent(index): { x, y }`, `renderTokenLayer(state, view): string`, `tokenClasses(view)`.
- `src/ui/board.ts`: `renderBoardMarkup`에 `view.tokenInSvg`(기본 `true`) 옵션 — 3D 켜면 SVG 말을 생략. 도착 이펙트는 유지. `boardViewFor`(A에서 추가)에 통합.
- `src/ui/app.ts`: `.board-stage` 래퍼, `syncTokenLayer()`, 기존 `renderBoard` 호출 교체. 이동 틱 로직은 그대로(A 수정 뒤).
- `src/styles/main.css`: `.board-stage`, `.token-layer`, `.token3d`·`.token-face`·`.token-rim`·`.token-shadow`, `@keyframes token-hop`, `token-land` 약 60줄.
- 설정 항목은 **추가하지 않는다**(3D가 기본). 되돌릴 일이 생기면 `renderBoardMarkup`의 `tokenInSvg`만 켜면 예전 말로 돌아간다.

**테스트**

- `tests/token3d.test.ts`: 24칸 모두 `tokenPercent`가 0~100% 안, 0번 칸 = (7.14%, 7.14%), 6번 = (92.86%, 7.14%); 마크업에 `aria-hidden`, 캐릭터 켬이면 아바타 SVG·끔이면 `plain`+「나」; 이동 중 `hopping`, 도착 `landed` 클래스.
- `tests/board.test.ts`: `tokenInSvg: false`면 SVG에 `player`·`player-avatar` 없음, `aria-label` 위치 문구는 유지.
- 브라우저 수동: 375×812·1280×900에서 8칸 이동, 모서리 넘어가는 이동(6→8, 12→14, 18→20, 22→1), 동작 줄이기 켬, 캐릭터 끔. 화면 회전 뒤 퍽이 칸 중심에 남는지(퍼센트 기반이라 유지돼야 함).

**완료 기준**

- 퍽이 항상 칸 중심에 있고(회전·리사이즈 포함), 이동 중 되돌아감 없음(A 테스트 포함).
- 번들 증가 ≤ 5KB. `npm run typecheck && npm test && npm run build` 통과.
- 캐릭터 끔·동작 줄이기에서 정보 손실 없음. axe 위반 0(오버레이 `aria-hidden`).

**위험과 대응**

- `.board` 크기를 `max-height`로 잡던 로직이 stage로 옮겨가며 데스크톱에서 보드가 몇 px 달라질 수 있다 → 1280×900 스크린샷으로 이전과 비교.
- Safari에서 `box-shadow` 다중 겹침이 스크롤 중 깜빡일 수 있다 → `will-change: transform`, 겹 수 6 이하.
- 노드 보존 방식이 `render()` 전체 교체 구조와 어긋나면 틱마다 transition이 끊겨 "순간이동"처럼 보인다 → 구현 첫 단계에서 이 부분만 먼저 확인.

### 작업 순서

- [x] A-1 `boardViewFor` 추출 + 테스트 3건 → 버그 수정 → 매뉴얼 Q35 → PR → 배포·태그 *(3D 결정과 무관하게 선행)*
- [x] B-1 `.board-stage` 래퍼와 정사각형 강제, 스크린샷 비교
- [x] B-2 `token3d.ts` + 테스트, SVG 말 생략 옵션
- [x] B-3 이동·착지 애니메이션, 동작 줄이기 — *노드 보존 대신 WAAPI로 변경(아래 「구현 메모」)*
- [x] B-4 CSS(퍽·그림자·키프레임), 캐릭터 끔 퍽
- [x] B-5 브라우저 테스트(8칸 이동·모서리 회전·420px·동작 줄이기), 매뉴얼(사용자 §5, 운영자 구성·Q36), PR

### 구현 메모 (B 완료 후)

- **노드 보존 → Web Animations API.** 떼어낸 노드를 다시 붙여도 브라우저는 새 요소로 보아 transition 시작값이 없다. 그래서 `render()`가 매번 새 `.token-pos`를 만들되, `app.ts`의 `animateToken()`이 직전 칸(`tokenShown`)→현재 칸을 `element.animate([...], TOKEN_STEP_MS)`로 붙인다. hop 포물선·착지 찌그러짐은 새 노드에 CSS 키프레임(`.hop`/`.land`)으로 시작하므로 그대로 동작한다. 동작 줄이기면 `animate`를 건너뛰고 키프레임은 기존 전역 규칙이 끈다.
- 헤드리스 Chrome 추적(25ms 샘플): 1→9 이동에서 53개 프레임, 칸 사이 중간 위치 35개, 출발 칸 재방문 0, 착지 후 칸 중심 x 오차 0px. `prefers-reduced-motion: reduce`에서는 즉시 도착.
- 크기: 퍽 폭 = 보드의 7.8%(칸의 약 55%). 처음 9.2%는 칸 번호·라벨을 다 덮어 줄였다.
- 번들: JS +1.4KB, CSS +2.0KB(gzip 전). 예산(≤5KB) 안.
- **hop 일관성.** 첫 구현은 가로 이동만 WAAPI, 포물선·착지는 렌더 시 붙는 CSS 클래스(`.hop`/`.land`)였다. 그래서 마지막 칸은 `land` 클래스만 받아 포물선 없이 미끄러지고 착지 찌그러짐이 이동과 겹쳤으며, 출발 칸에선 제자리 점프가 있었다(2칸 이동이면 절반이 "옆으로 미끄러짐"으로 보임). 이제 칸이 바뀐 모든 렌더가 `animateToken`에서 같은 세 애니메이션(가로 이동·`HOP_KEYFRAMES`·`HOP_SHADOW_KEYFRAMES`)을 받고, 마지막 칸만 포물선 `onfinish` 뒤 `LAND_KEYFRAMES`(320ms)를 이어 재생한다. 속보 카드는 `TOKEN_STEP_MS + LAND_MS` 뒤에 뜨고, 도착 칸 bounce·파티클은 0.17s 지연으로 퍽이 내려앉는 순간에 맞췄다. 헤드리스 추적에서 가로 hop 최고점이 모든 칸(마지막 포함) 160~162px로 같았다.
- **칸 강조 제거.** 퍽이 위치를 충분히 보여 주므로 현재 칸의 주황 6px 테두리(`.tile.active rect`)와 칸별 hop 그림자 깜빡임(`.tile.hopping`, `tile-focus`)을 지웠다. 마크업의 `hopping` 클래스도 함께 제거(중앙 문구용 `view.hopping`은 유지). 도착 순간의 칸 bounce·파티클은 남겼다.
