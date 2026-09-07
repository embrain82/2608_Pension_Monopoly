# 퀴즈를 퇴직연금 상식으로 교체 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학습 카드 퀴즈 20장 중 보드(턴·속보·게임 계산식)를 묻는 문항을 퇴직연금 상식·상품 차이·시장 대처로 바꾸고, 출제 엔진·점수·해금 id는 그대로 둔다.

**Architecture:** 퀴즈 본문은 `src/data/learning-cards.json`의 `quiz.{q,options,answer,why}`와 카드 `title`/`key`에만 있다. `quiz-engine.ts`는 카드 id와 `answer` 인덱스만 본다. 카드 id 20개는 유지해 기존 해금·도감·업적 진행을 깨지 않는다. `validateContent()`와 새 내용 게이트 테스트가 “질문·선택지에 보드 규칙 단어가 없다”를 잠근다.

**Tech Stack:** TypeScript, Vitest, `learning-cards.json`, 사용자/운영자 HTML 매뉴얼, `tests/manuals.test.ts`

## Global Constraints

- 카드 **id 20개 불변**. 새 카드 추가·삭제 없음.
- `quiz.options.length === 3`, 선택지 중복 없음, `answer`는 0|1|2. 정답 위치 분포는 기존과 같게 유지(0번 6 · 1번 7 · 2번 7, `Math.min(counts) >= 5`).
- 이번에 고치는 5장의 `answer` 인덱스는 **바꾸지 않는다**(etf-order 0, fund-order 1, pension-assumption 2, pension-tax 0, signal-vs-forecast 2).
- 질문·선택지에는 `턴`, `속보`, `게임`, `주사위`, `칸`, `마무리 퀴즈`를 쓰지 않는다. 해설(`why`)·카드 `detail`에는 교육용 단순화 한 줄을 둘 수 있다.
- 엔진 규칙(펀드 다음 턴 체결, 속보 본 뒤 매수는 이번 턴 수익률 없음, 월 연금 = IRP÷240)은 **그대로**. 그 설명은 사용자 매뉴얼 운용 장·정산 UI에 남기고 퀴즈에서 걷는다.
- 오답 벌점 없음, 지식 +2, 카드당 판 1회, 출제 위치(제도 안내·시장 뉴스 절반·마무리 ≤3) 불변.
- PR에 사용자/운영자 매뉴얼과 `tests/manuals.test.ts` 현행화를 넣는다(필수 절차). 다이어그램은 출제 흐름이 같아서 손대지 않는다.
- 쉬운 말. 법령 문장 복사 금지. `reviewed_at`을 고친 카드는 `2026-09-06`으로 둔다.

---

## 검토 결과 (구현 전에 고정)

첨부 문항은 카드 `etf-order`다. 모달 눈썹의 「운용: ETF는 즉시 체결, 수익률은 다음 턴부터」는 카드 `title`이고, 본문은 속보·이번 턴 수익률을 묻는다. 퇴직연금 상식이 아니라 **이 보드의 시장-먼저 루프**를 확인하는 문제다.

20장을 같은 기준으로 나눴다. **질문만** 본다(`detail`에 “게임은 …”이 있어도 질문이 제도·상품·시장이면 유지).

### A. 보드 규칙 — 반드시 교체 (3)

| id | 지금 질문 | 왜 보드인가 | 바꿀 배움 |
|---|---|---|---|
| `etf-order` | 속보에 ETF +4%가 떴습니다. 지금 ETF를 사면? | 속보·이번 턴 수익률 | 이미 난 하루 수익률은 지금 사는 사람 것이 아니다 |
| `fund-order` | 잔고에 반영되는 시점은? …(게임에서는 다음 턴) | 선택지가 턴 단위 | 펀드는 기준가(NAV)가 나온 뒤에야 확정 |
| `pension-assumption` | **게임이** 월 연금을 계산하는 방법은? | 게임 공식 암기 | 연금월액은 적립금÷수령 개월에서 출발 |

### B. 질문은 보드 말투 — 같이 교체 (2)

| id | 지금 질문 | 바꿀 배움 |
|---|---|---|
| `pension-tax` | **게임의 교육용 세율로**, 연금 vs 일시금은? | 나눠 받는 쪽이 세율에서 유리할 수 있다(숫자는 해설) |
| `signal-vs-forecast` | **충격 전 신호**가 떴습니다. 가장 알맞은 태도는? | 전망·경고는 틀릴 수 있으니 분산·비상자금을 본다 |

### C. 유지 (15)

`rate-bond` · `duration` · `deposit-rate` · `risk-limit` · `tdf-exception` · `contribution-limit` · `tax-credit` · `irp-withdrawal` · `emergency-cash` · `diversification` · `rebalance` · `profile` · `liquidity` · `payout-choice` · `default-option`

이 15장은 금리-채권, 장기채 민감도, 예금 약정금리, IRP 위험자산 한도, 적격 TDF, 납입/공제 한도, 세액공제와 유동성, 중도인출, 비상자금, 분산, 리밸런싱, 성향, 유동성, 연금 수령 요건, 디폴트옵션이다. `why`에 “게임은 …”이 있어도 질문은 상식이라 본문은 건드리지 않는다.

---

## File map

| 파일 | 역할 |
|---|---|
| `src/data/learning-cards.json` | 5장 `title`/`key`/`quiz`/`why`/`reviewed_at` 교체 |
| `src/data/content.ts` | `validateContent()`에 보드 단어 금지 검사 추가 |
| `tests/quiz.test.ts` | 금지 단어 게이트 + 교체 5장의 질문/정답 고정 |
| `public/user-manual.html` | 11장: 퀴즈는 제도·상품·시장 상식, 보드 규칙은 운용 장 |
| `public/operator-manual.html` | 퀴즈 데이터 행에 내용 게이트 한 줄 |
| `tests/manuals.test.ts` | 위 문구 존재 검사 |

엔진(`quiz-engine.ts`, `game-engine.ts`, `achievements.ts`)과 뷰(`quiz-view.ts`)는 문구를 JSON에서 읽기만 하므로 수정하지 않는다.

---

### Task 1: 내용 게이트 테스트 (실패하는 테스트 먼저)

**Files:**
- Modify: `src/data/content.ts`
- Modify: `tests/quiz.test.ts`
- Modify: `src/data/learning-cards.json`

**Interfaces:**
- Consumes: 기존 `validateContent(): void`, `learningCards`
- Produces: `validateContent`가 카드 `quiz.q`·`quiz.options[]`에 보드 단어를 보면 throw. 테스트가 교체 5장의 새 질문 문자열을 고정

- [ ] **Step 1: 금지 단어 상수와 검사를 `content.ts`에 추가**

`src/data/content.ts`의 `validateContent` 퀴즈 형식 검사 바로 아래에 붙인다.

```ts
const QUIZ_BOARD_WORDS = /턴|속보|게임|주사위|칸|마무리 퀴즈/;
if (learningCards.some((card) => QUIZ_BOARD_WORDS.test(card.quiz.q) || card.quiz.options.some((option) => QUIZ_BOARD_WORDS.test(option)))) {
  throw new Error('퀴즈 질문·선택지는 보드 규칙(턴·속보·게임 등)이 아니라 제도·상품·시장 상식이어야 합니다.');
}
```

- [ ] **Step 2: `tests/quiz.test.ts`의 「퀴즈 데이터(3.4)」 describe에 게이트·교체 문항 테스트를 추가**

기존 `카드 20장마다 3지선다…` 테스트는 그대로 두고, 같은 describe 안에 아래를 추가한다.

```ts
  it('질문·선택지에 보드 규칙 단어가 없고, 교체 5장은 연금·상품·시장 상식을 묻는다', () => {
    const banned = /턴|속보|게임|주사위|칸|마무리 퀴즈/;
    for (const item of learningCards) {
      expect(banned.test(item.quiz.q), item.id).toBe(false);
      for (const option of item.quiz.options) expect(banned.test(option), `${item.id}:${option}`).toBe(false);
    }
    const etf = card('etf-order');
    expect(etf.quiz.q).toContain('이미 난');
    expect(etf.quiz.answer).toBe(0);
    expect(etf.title).not.toContain('다음 턴');
    const fund = card('fund-order');
    expect(fund.quiz.q).toContain('기준가');
    expect(fund.quiz.answer).toBe(1);
    expect(fund.quiz.options[1]).not.toContain('다음 턴');
    const pension = card('pension-assumption');
    expect(pension.quiz.q).not.toContain('게임이');
    expect(pension.quiz.answer).toBe(2);
    const tax = card('pension-tax');
    expect(tax.quiz.q).not.toContain('교육용 세율');
    expect(tax.quiz.answer).toBe(0);
    const signal = card('signal-vs-forecast');
    expect(signal.quiz.q).not.toContain('충격 전 신호');
    expect(signal.quiz.answer).toBe(2);
  });
```

- [ ] **Step 3: 테스트를 돌려 지금 JSON이 실패하는지 확인**

```bash
npx vitest run tests/quiz.test.ts tests/content.test.ts
```

Expected: FAIL. `etf-order` 질문이 `속보`를 포함하고, `validateContent`가 새 Error를 던진다.

- [ ] **Step 4: `learning-cards.json` 5장을 아래 문구로 교체**

카드 객체 나머지 필드(`id`, `category`, `source_url`, `simplified`, `detail`의 제도 설명)는 유지한다. 고치는 키만 적는다.

**`etf-order`** (`answer` 0 유지)

- `title`: `이미 난 수익률은 사지 못해요`
- `key`: `뉴스에 나온 하루 수익률은 이미 지난 가격입니다. 지금 사는 사람은 그 상승분을 받지 못해요.`
- `quiz.q`: `오늘 뉴스에 주식형 ETF가 하루 +4% 올랐다고 나왔습니다. 지금 그 ETF를 사면?`
- `quiz.options`: `["이미 오른 가격으로 사는 것이라, 오늘의 +4%는 받지 못한다", "오늘의 +4%를 그대로 받는다", "수수료가 없어 두 배로 받는다"]`
- `quiz.why`: `공시·뉴스의 수익률은 이미 끝난 가격 움직임입니다. 지금 사는 가격에는 그 움직임이 들어가 있어, 오늘의 상승분은 기존 보유자에게 돌아갑니다. 실제 시장에는 호가·괴리율·거래비용이 있습니다.`
- `reviewed_at`: `2026-09-06`

**`fund-order`** (`answer` 1 유지)

- `title`: `펀드는 기준가가 나와야 확정돼요` (기존 「펀드 주문은 기다림」도 가능. 새 title을 쓴다)
- `key`: `펀드 매수는 주문 순간 화면 가격이 아니라, 그날의 기준가가 정해진 뒤에 수량과 금액이 확정돼요.`
- `quiz.q`: `펀드 매수 주문을 넣은 뒤 잔고 수량·금액이 확정되는 때는?`
- `quiz.options`: `["주문 순간 화면의 가격으로 즉시", "그날(또는 다음 영업일) 기준가가 확정된 뒤", "한 달 뒤 자동으로"]`
- `quiz.why`: `펀드는 하루의 기준가(NAV)가 나온 뒤에야 몇 좌를 얼마에 샀는지가 확정됩니다. 거래소에서 호가로 즉시 체결되는 ETF와 다릅니다.`
- `reviewed_at`: `2026-09-06`

**`pension-assumption`** (`answer` 2 유지)

- `title`: `연금월액은 적립금에서 출발해요`
- `key`: `나눠 받는 월 연금액은 쌓아 둔 평가액을 수령 개월 수로 나눈 값에서 출발해요.`
- `quiz.q`: `IRP 적립금을 20년 동안 연금으로 나눠 받을 때, 월 수령액의 출발점은?`
- `quiz.options`: `["매달 그날의 시장 수익률", "그해 납입액 ÷ 12", "적립금(평가액)을 수령 개월 수로 나눈 금액"]`
- `quiz.why`: `연금월액은 모아 둔 돈과 받을 기간에서 출발합니다. 실제 수령액은 운용 수익·수수료·세금·물가에 따라 달라집니다.`
- `reviewed_at`: `2026-09-06`

**`pension-tax`** (`answer` 0 유지)

- `title` 유지: `연금으로 받으면 세금이 다르다`
- `key`: `같은 적립금이라도 연금으로 나눠 받으면 세율이 일시금보다 낮을 수 있어요.`
- `quiz.q`: `같은 IRP 적립금을 받을 때, 세금 면에서 보통 더 유리한 쪽은?`
- `quiz.options`: `["요건을 갖춰 연금으로 나눠 받는 쪽", "일시금으로 한 번에 받는 쪽", "둘 다 세금이 없다"]`
- `quiz.why`: `연금 수령은 연금소득세(낮은 세율), 연금 외 수령(일시금 등)은 기타소득세(높은 세율)가 적용될 수 있습니다. 실제 세율은 나이·기간·개인 상황에 따라 다릅니다.`
- `reviewed_at`: `2026-09-06`

**`signal-vs-forecast`** (`answer` 2 유지)

- `title` 유지: `신호는 예측이 아니에요`
- `key`: `시장 전망이나 경고는 맞을 때도 빗나갈 때도 있어요. 예측하지 말고 대비하세요.`
- `quiz.q`: `뉴스가 ‘앞으로 시장이 크게 흔들릴 수 있다’고 할 때 알맞은 태도는?`
- `quiz.options`: `["전망대로 될 게 확실하니 위험자산을 전부 판다", "전망은 늘 가짜라 무시한다", "전망은 빗나갈 수 있으니 분산과 비상자금을 점검한다"]`
- `quiz.why`: `전망은 예측이 아니라 대비할 이유입니다. 맞아도 틀려도 손해가 아닌 준비(분산·비상자금)가 정답입니다.`
- `reviewed_at`: `2026-09-06`

`etf-order.detail`의 첫 문장 「뉴스를 본 순간 가격은 이미 움직였다는 뜻입니다.」는 유지한다. 「턴 시작」이 남아 있으면 그 문장만 지운다.

- [ ] **Step 5: 테스트·콘텐츠 검증이 통과하는지 확인**

```bash
npx vitest run tests/quiz.test.ts tests/content.test.ts tests/bundle-b-views.test.ts
```

Expected: PASS. `validateContent()` 무throw. 정답 위치 min ≥ 5.

- [ ] **Step 6: Commit**

```bash
git add src/data/learning-cards.json src/data/content.ts tests/quiz.test.ts
git commit -m "fix(content): 퀴즈 5장을 보드 규칙에서 퇴직연금·상품·시장 상식으로 교체(etf-order·fund-order·pension-assumption·pension-tax·signal-vs-forecast) · 질문·선택지 보드 단어 금지"
```

---

### Task 2: 매뉴얼 현행화

**Files:**
- Modify: `public/user-manual.html`
- Modify: `public/operator-manual.html`
- Modify: `tests/manuals.test.ts`

**Interfaces:**
- Consumes: Task 1의 새 퀴즈 취지(보드 규칙은 운용 장, 퀴즈는 상식)
- Produces: 11장·운영자 데이터 행·manuals.test 묶음 문장

- [ ] **Step 1: 사용자 매뉴얼 11장 첫 문단 뒤에 한 줄 추가**

`public/user-manual.html`의 `<h2>11. 퀴즈와 배운 것</h2>` 다음 `<p>학습 카드 <strong>20장</strong>마다…` 뒤에 삽입한다.

```html
      <p>퀴즈는 <strong>퇴직연금 제도, 운용 상품, 시장이 흔들릴 때의 태도</strong>를 묻습니다. 「이번 턴 수익률」「게임이 월 연금을 나누는 공식」처럼 보드 진행 규칙은 묻지 않습니다. 펀드 체결 시점·이미 반영된 시장은 <a href="#actions">8. 운용 행동</a>과 정산 화면에 있습니다.</p>
```

- [ ] **Step 2: 운영자 매뉴얼 `learning-cards.json` 행에 게이트 한 줄**

`public/operator-manual.html` 데이터 표의 `learning-cards.json` `<td>` 주의 칸 끝에 붙인다.

```html
 퀴즈 질문·선택지에는 턴·속보·게임·주사위·칸을 쓰지 않는다(<code>validateContent</code> · <code>tests/quiz.test.ts</code>). 보드 진행 규칙은 사용자 매뉴얼 운용 장과 HUD/정산에 둔다.
```

- [ ] **Step 3: `tests/manuals.test.ts` 묶음 B 블록(또는 새 it)에 문장 고정**

```ts
  it('퀴즈 문항은 제도·상품·시장 상식이고 보드 규칙을 묻지 않는다고 매뉴얼이 적는다', () => {
    const user = readFileSync('public/user-manual.html', 'utf8');
    const operator = readFileSync('public/operator-manual.html', 'utf8');
    expect(user).toContain('퇴직연금 제도, 운용 상품, 시장이 흔들릴 때의 태도');
    expect(user).not.toContain('게임이 월 연금을 나누는 공식」처럼 보드');
    expect(operator).toContain('퀴즈 질문·선택지에는 턴·속보·게임');
  });
```

`not.toContain` 한 줄은 오탐이면 빼고, `toContain` 두 줄만 남겨도 된다.

- [ ] **Step 4: 매뉴얼 테스트**

```bash
npx vitest run tests/manuals.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/user-manual.html public/operator-manual.html tests/manuals.test.ts
git commit -m "docs(manuals): 퀴즈는 제도·상품·시장 상식, 보드 규칙은 운용 장 — 내용 게이트를 두 매뉴얼에 기록"
```

---

### Task 3: 전체 검증

**Files:** 없음(실행만)

- [ ] **Step 1: typecheck · lint · 전체 테스트 · build**

```bash
npm run typecheck && npm run lint && npx vitest run && npm run build
```

Expected: typecheck/lint 무오류, 테스트 전 파일 통과(기존 359 + 이번 2), build 성공.

- [ ] **Step 2: 교체 5장의 질문·선택지에 금지 단어가 없는지 한 번 더 확인**

```bash
node -e '
const cards=require("./src/data/learning-cards.json");
const ban=/턴|속보|게임|주사위|칸|마무리 퀴즈/;
const ids=["etf-order","fund-order","pension-assumption","pension-tax","signal-vs-forecast"];
for (const id of ids) {
  const c=cards.find(x=>x.id===id);
  console.log(id, "q:", c.quiz.q);
  console.log("  banned?", ban.test(c.quiz.q), c.quiz.options.map(o=>ban.test(o)));
}
'
```

Expected: 다섯 장 모두 `banned? false [false,false,false]`.

- [ ] **Step 3: 푸시·PR** (브랜치 `cursor/quiz-pension-knowledge-5ed6`, base `main`)

PR 제목: `퀴즈 5장 — 보드 규칙 문항을 퇴직연금·상품·시장 상식으로 교체`

본문에 이 플랜의 검토 표 A/B와 “엔진·출제 위치·점수 불변, 카드 id 20개 유지”를 적는다.

---

## Spec coverage

| 요구 | Task |
|---|---|
| 첨부 ETF +4% 문항을 보드가 아닌 상식으로 | Task 1 `etf-order` |
| 같은 종류의 보드 문항 도출 | 검토 표 A 3장 + B 2장 |
| 나머지 상식 문항 유지 | 표 C, JSON 미수정 |
| 엔진/점수/출제 불변 | File map, Global Constraints |
| 매뉴얼 필수 절차 | Task 2 |
| 회귀 잠금 | Task 1 게이트 + Task 3 |

다이어그램 5장은 퀴즈 **출제 위치**만 그리고 문항 내용을 그리지 않으므로 이 플랜 밖이다.
