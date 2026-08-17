# 연금로드: 12턴의 은퇴설계

금리와 퇴직연금 운용 원리를 12번의 선택으로 체험하는 서버리스 HTML5 교육 게임입니다. 생활자금과 IRP를 분리하고, 시장 변화에 따라 납입·매매·리밸런싱하면서 목표 월 연금에 도전합니다.

> 이 프로젝트는 투자 권유나 금융상품 추천이 아닙니다. 모든 상품과 수치는 교육용으로 단순화했으며 수익, 원금, 세제 혜택을 보장하지 않습니다. 실존 금융회사·상품명·종목코드를 사용하지 않습니다.

## 설치와 실행

Node.js 22 이상을 권장합니다.

```bash
npm install
npm run dev
```

개발 서버가 출력한 로컬 주소를 브라우저에서 여세요. 서버·로그인·데이터베이스는 필요하지 않으며 앱 데이터는 브라우저 LocalStorage에만 저장됩니다.

## 품질 검증

```bash
npm run lint
npm run typecheck
npm run test
npm run simulate -- --runs=1000
npm run build
```

`simulate`는 균형·관망·납입 중심·성장 중심의 네 자동전략을 번갈아 실행하고, 런타임 오류, 비정상 잔액, 미종료 경기, 평균 최종자산, 목표 달성률, 별 등급 분포와 평균 최대 낙폭을 출력합니다.

## 프로젝트 구조

```text
src/
  data/                 정책·상품·시장·사건·학습·성향·밸런스 JSON
  engine/
    game-engine.ts      12턴 시장 우선 루프, 생활사건, 행동 정산
    market-engine.ts    시장 수익률, 금리 민감도, 최대 낙폭
    portfolio-engine.ts 보유자산, 즉시/대기 주문, 교체, 리밸런싱
    policy-engine.ts    납입·세액공제·위험자산·중도인출 규칙
    scoring-engine.ts   월 연금, 별 등급, 100점 점수와 피드백
    content-engine.ts   타입 보장 콘텐츠 조회
    random-engine.ts    시드 기반 재현 가능한 난수
  ui/
    app.ts              전체 DOM 화면과 접근 가능한 상호작용
    ui-state.ts         안전한 LocalStorage 로드·복구
  styles/main.css       모바일 우선 반응형 시각 체계
scripts/simulate.ts     헤드리스 대량 시뮬레이터
tests/engine.test.ts    핵심 규칙 단위·통합 테스트
```

## 구현된 MVP 범위

- “금리의 두 얼굴” 1개 시나리오, 12턴, 1인용. 매 턴 시장 브리핑과 상품별 수익률을 본 뒤 운용 1회
- 바로 시작이 기본. 5문항 성향 진단과 월 연금 목표는 설정에서 선택
- 24칸 주사위 보드 대신 12턴 진행 트랙. 생활사건은 시드당 3회 삽입
- 원리금보장형 예금, 단기채권형, 장기채권형, 혼합형, 국내주식형 ETF, TDF의 6개 교육용 상품
- 추가납입, 매수, 매도, 교체매매, 리밸런싱, 행동하지 않기
- 위험자산 한도 사전 검사와 시장 상승에 의한 사후 초과 구분
- 적격 TDF 예외 속성, 납입한도와 세액공제 한도 분리
- 펀드/TDF의 주문 접수→기준가 확정→잔고 반영, ETF 즉시 체결
- 예금 만기 전 해지 불이익, IRP 중도인출 가능·불가능 생활사건
- 최종 자산·월 연금·목표 달성·시작 대비 수익률·위험·분산·점수·별 등급 리포트
- 36개 시장·생활·학습 콘텐츠 항목과 학습 카드 도감
- 설정·도감·최고기록·마지막 시드 LocalStorage 저장
- 모바일/데스크톱 반응형, 키보드 완주, 포커스 트랩, aria-live, 동작 줄이기

## 제외 범위

실제 계좌·주문·실시간 시세, 로그인·서버 저장, 다인용, 실제 개인정보, 추천 알고리즘, 관리자 CMS, 경쟁 순위표, 해외자산·환율, 개별 주식·레버리지·인버스·파생상품은 구현하지 않았습니다.

## 게임 규칙의 단순화 가정

- 예상 월 연금은 `최종 IRP 평가액 ÷ 240개월`의 세전 단순 균등분할입니다. 수령 중 수익, 물가, 세금, 비용은 반영하지 않습니다.
- 12턴은 실제 12년이 아닌 압축된 의사결정 시점입니다.
- 시장 수익률은 교육용 시나리오 값이며 전망이 아닙니다.
- 펀드 주문·결제 영업일은 턴 단위로 압축합니다.
- 예금은 3턴을 교육용 만기로 간주하고, 그 전 매도 시 단순화 불이익을 적용합니다.
- 세액공제 효과는 정책 JSON의 한도와 단일 공제율로 단순 계산합니다. 개인별 실제 결과와 다를 수 있습니다.
- 중도인출 사유와 비용은 원리를 체험하기 위한 모형입니다. 실제 가능 여부는 최신 법령과 개인 상황을 확인해야 합니다.
- 리밸런싱은 MVP에서 목표비중으로 일괄 체결되는 교육용 행동입니다.

## 정책 데이터 기준일과 출처

정책·상품 분류 검토 기준일은 **2026-08-10**입니다. 정책 값은 코드가 아니라 [`src/data/policy-rules.json`](./src/data/policy-rules.json)에 있습니다.

- [금융감독원 통합연금포털 — 위험자산별 투자한도](https://www.fss.or.kr/fss/main/contents.do?menuNo=200992)
- [금융감독원 통합연금포털 — 퇴직연금 세제·세액공제](https://www.fss.or.kr/fss/main/contents.do?menuNo=201011)
- [금융감독원 통합연금포털 — 퇴직연금 세제·연금수령](https://www.fss.or.kr/fss/main/contents.do?menuNo=201012)

출시 전에는 시행 중인 법령·감독규정과 공식 최신 공지를 다시 확인하고 전문가 검수를 받아야 합니다.

## 매뉴얼

빌드에 포함되는 HTML입니다.

- 사용자: [`public/user-manual.html`](./public/user-manual.html) → 배포 후 `/user-manual.html`
- 운영자: [`public/operator-manual.html`](./public/operator-manual.html) → 배포 후 `/operator-manual.html`

## 정적 배포

```bash
npm run build
```

생성된 `dist/` 디렉터리를 정적 호스팅에 그대로 배포할 수 있습니다. Vite `base`가 상대경로로 설정되어 하위 경로 정적 호스팅도 지원합니다. 별도 환경변수나 서버 함수는 없습니다.

### Vercel

영구 주소는 GitHub 저장소를 [Vercel Import](https://vercel.com/new)에 연결하는 것이 가장 확실합니다. Framework는 Vite, Output은 `dist`입니다. `vercel.json`이 같은 값을 고정합니다.

```bash
npx vercel login
npx vercel --yes --prod
```

에이전트가 만든 익명 미리보기는 약 60분 뒤 만료될 수 있습니다. PR 본문의 Claim URL(`vercel.com/claim-deployment`)로 소유자 계정에 옮기면 유지됩니다. `.vercel/`은 커밋하지 않습니다.

### GitHub Pages

`.github/workflows/pages.yml`이 `main` 푸시에서 `dist/`를 배포합니다. 저장소 Settings → Pages → Source를 GitHub Actions로 켜면 됩니다.

## 후속 확장 후보

현재 MVP 범위를 검증한 뒤에만 해외자산·환율 시나리오, 추가 시장 시나리오, 연금수령 방식 비교, 실제 사용자 이해도 사전·사후 측정을 고려할 수 있습니다.

구현 검증 기록과 현재 제한사항은 [`IMPLEMENTATION_NOTES.md`](./IMPLEMENTATION_NOTES.md)를 참고하세요.
