import { balanceConfig, boardTiles, investorProfiles, learningCards, marketScenario, policyRules, products } from '../data/content';
import { createGame, performAction, resolveLifeEvent, rollAndMove } from '../engine/game-engine';
import { getLifeEvent, getLearningCard } from '../engine/content-engine';
import { portfolioValue } from '../engine/portfolio-engine';
import { expectedRiskAfterBuy, riskAssetRatio } from '../engine/policy-engine';
import { randomSeed } from '../engine/random-engine';
import { calculateScore } from '../engine/scoring-engine';
import type { GameState, ProfileId, ProductId, SaveData } from '../types';
import { loadSave, saveData } from './ui-state';

type Screen = 'title' | 'diagnosis' | 'goal' | 'tutorial' | 'game' | 'result';
type Modal = 'tile' | 'action' | 'portfolio' | 'market' | 'cards' | 'settings' | null;

const questions = [
  { text: '노후자금까지 남은 투자기간은?', options: [['10년 미만', 1], ['10~20년', 2], ['20년 이상', 4]] },
  { text: '평가액이 일시적으로 하락한다면 감내 가능한 범위는?', options: [['5% 안팎', 1], ['10% 안팎', 2], ['20% 이상도 가능', 4]] },
  { text: '비상생활자금은 어느 정도 확보되어 있나요?', options: [['거의 없음', 1], ['3개월 정도', 2], ['6개월 이상', 4]] },
  { text: '투자상품이 10% 하락하면 어떻게 할 것 같나요?', options: [['대부분 매도', 1], ['상황을 점검하고 일부 조정', 2], ['장기계획에 따라 유지·분할매수', 4]] },
  { text: '노후자금 운용에서 더 중요한 것은?', options: [['원금 변동 최소화', 1], ['안정과 성장의 균형', 2], ['큰 변동을 감수한 성장', 4]] }
] as const;

const tileIcons: Record<string, string> = {
  start: '↻', product: '◆', market: '↗', life: '♥', trade: '⇄', rebalance: '◎', policy: '§', profile: '◐', outlook: '⌂'
};

const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const formatShortWon = (value: number) => value >= 100_000_000
  ? `${(value / 100_000_000).toFixed(2)}억원`
  : `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function profileFromScore(score: number): ProfileId {
  return investorProfiles.find((profile) => score >= profile.minScore && score <= profile.maxScore)?.id ?? 'balanced';
}

function boardPosition(index: number): { x: number; y: number } {
  if (index <= 6) return { x: index * 100, y: 0 };
  if (index <= 12) return { x: 600, y: (index - 6) * 100 };
  if (index <= 18) return { x: (18 - index) * 100, y: 600 };
  return { x: 0, y: (24 - index) * 100 };
}

export class PensionRoadApp {
  private screen: Screen = 'title';
  private modal: Modal = null;
  private game: GameState | null = null;
  private save: SaveData = loadSave();
  private disclaimerChecked = false;
  private questionIndex = 0;
  private diagnosisScore = 0;
  private profileId: ProfileId = 'balanced';
  private goalMonthly = balanceConfig.defaultGoal;
  private tutorialPage = 0;
  private selectedBuy: ProductId = 'shortBond';
  private selectedSell: ProductId = 'deposit';
  private switchFrom: ProductId = 'balanced';
  private switchTo: ProductId = 'shortBond';
  private feedback = '';

  constructor(private readonly root: HTMLElement) {
    this.root.addEventListener('click', (event) => this.onClick(event));
    this.root.addEventListener('change', (event) => this.onChange(event));
    document.addEventListener('keydown', (event) => this.onKeydown(event));
    this.render();
  }

  private announce(message: string): void {
    this.feedback = message;
    const announcer = document.querySelector<HTMLElement>('#announcer');
    if (announcer) announcer.textContent = message;
  }

  private persist(progress = false): void {
    if (this.game && progress) {
      this.save.unlockedCards = [...new Set([...this.save.unlockedCards, ...this.game.unlockedCards])];
      this.save.lastSeed = this.game.seed;
      if (this.game.status === 'finished') this.save.bestScore = Math.max(this.save.bestScore, calculateScore(this.game).totalScore);
    }
    saveData(this.save);
  }

  private onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.id === 'disclaimer' && target instanceof HTMLInputElement) this.disclaimerChecked = target.checked;
    if (target.id === 'goal-range') this.goalMonthly = Number(target.value);
    if (target.id === 'buy-product') this.selectedBuy = target.value as ProductId;
    if (target.id === 'sell-product') this.selectedSell = target.value as ProductId;
    if (target.id === 'switch-from') this.switchFrom = target.value as ProductId;
    if (target.id === 'switch-to') this.switchTo = target.value as ProductId;
    if (target.id === 'reduced-motion' && target instanceof HTMLInputElement) {
      this.save.settings.reducedMotion = target.checked;
      document.documentElement.dataset.reduceMotion = String(target.checked);
      this.persist();
    }
    this.render();
  }

  private onClick(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (!action) return;

    if (action === 'begin' && this.disclaimerChecked) {
      this.screen = 'diagnosis'; this.questionIndex = 0; this.diagnosisScore = 0;
    } else if (action === 'answer') {
      this.diagnosisScore += Number(button.dataset.score ?? 0);
      this.questionIndex += 1;
      if (this.questionIndex >= questions.length) {
        this.profileId = profileFromScore(this.diagnosisScore);
        this.screen = 'goal';
      }
    } else if (action === 'goal-next') {
      this.screen = 'tutorial'; this.tutorialPage = 0;
    } else if (action === 'tutorial-next') {
      if (this.tutorialPage < 2) this.tutorialPage += 1;
      else this.startGame(randomSeed());
    } else if (action === 'roll' && this.game) {
      const result = rollAndMove(this.game);
      this.game = result.state;
      this.modal = result.ok ? 'tile' : null;
      this.announce(result.message);
      this.persist(true);
    } else if (action === 'resolve-cash' || action === 'resolve-withdraw') {
      if (this.game) {
        const result = resolveLifeEvent(this.game, action === 'resolve-cash' ? 'cash' : 'withdraw');
        this.game = result.state;
        this.announce(result.message);
        if (result.ok) this.modal = 'action';
        this.persist(true);
      }
    } else if (action === 'card-continue') {
      this.modal = 'action';
    } else if (action === 'do-contribute') {
      this.runAction({ kind: 'contribute' });
    } else if (action === 'do-buy') {
      this.runAction({ kind: 'buy', productId: this.selectedBuy });
    } else if (action === 'do-sell') {
      this.runAction({ kind: 'sell', productId: this.selectedSell });
    } else if (action === 'do-switch') {
      this.runAction({ kind: 'switch', fromProductId: this.switchFrom, toProductId: this.switchTo });
    } else if (action === 'do-rebalance') {
      this.runAction({ kind: 'rebalance' });
    } else if (action === 'do-hold') {
      this.runAction({ kind: 'hold' });
    } else if (action === 'open-portfolio') {
      this.modal = 'portfolio';
    } else if (action === 'open-market') {
      this.modal = 'market';
    } else if (action === 'open-cards') {
      this.modal = 'cards';
    } else if (action === 'open-settings') {
      this.modal = 'settings';
    } else if (action === 'close-modal') {
      if (!['tile', 'action'].includes(this.modal ?? '')) this.modal = null;
    } else if (action === 'same-seed') {
      this.startGame((this.game?.seed ?? this.save.lastSeed) || randomSeed());
    } else if (action === 'new-seed') {
      this.startGame(randomSeed());
    } else if (action === 'to-title') {
      this.screen = 'title'; this.modal = null; this.game = null;
    }
    this.render();
  }

  private runAction(action: Parameters<typeof performAction>[1]): void {
    if (!this.game) return;
    const result = performAction(this.game, action);
    this.game = result.state;
    this.announce(result.message);
    if (result.ok) {
      this.modal = null;
      if (this.game.status === 'finished') this.screen = 'result';
      this.persist(true);
    }
  }

  private startGame(seed: string): void {
    this.game = createGame(seed, this.profileId, this.goalMonthly);
    this.screen = 'game';
    this.modal = null;
    this.persist(true);
    this.announce(`시드 ${seed} 경기를 시작합니다.`);
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.modal && !['tile', 'action'].includes(this.modal)) {
      this.modal = null;
      this.render();
      return;
    }
    if (event.key !== 'Tab' || !this.modal) return;
    const dialog = this.root.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), select, input:not([disabled]), a[href]')];
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  private render(): void {
    document.documentElement.dataset.reduceMotion = String(this.save.settings.reducedMotion);
    const screenHtml = this.screen === 'title' ? this.renderTitle()
      : this.screen === 'diagnosis' ? this.renderDiagnosis()
        : this.screen === 'goal' ? this.renderGoal()
          : this.screen === 'tutorial' ? this.renderTutorial()
            : this.screen === 'game' ? this.renderGame()
              : this.renderResult();
    this.root.innerHTML = `<main id="main" class="app-shell">${screenHtml}</main>${this.renderModal()}`;
    const dialog = this.root.querySelector<HTMLElement>('[role="dialog"]');
    if (dialog) requestAnimationFrame(() => dialog.querySelector<HTMLElement>('button:not([disabled]), select, input:not([disabled]), a[href]')?.focus());
  }

  private renderTitle(): string {
    return `<section class="title-screen">
      <div class="eyebrow">금리와 노후소득을 잇는 12번의 선택</div>
      <div class="title-mark" aria-hidden="true"><span>12</span><small>TURNS</small></div>
      <h1>연금로드</h1><p class="subtitle">12턴의 은퇴설계</p>
      <p class="lead">생활자금을 지키고, 금리의 두 얼굴을 읽으며<br>나만의 월 연금 목표에 도착하세요.</p>
      <div class="disclaimer-check">
        <input id="disclaimer" type="checkbox" ${this.disclaimerChecked ? 'checked' : ''}>
        <label for="disclaimer"><strong>교육용 단순화에 동의합니다.</strong><br>실제 투자 권유가 아니며 수익·원금을 보장하지 않습니다.</label>
      </div>
      <button class="primary jumbo" data-action="begin" ${this.disclaimerChecked ? '' : 'disabled'}>새 여정 시작</button>
      <div class="utility-row">
        <button class="text-button" data-action="open-cards">학습 카드 도감 <span class="badge">${this.save.unlockedCards.length}</span></button>
        <button class="text-button" data-action="open-settings">면책 · 출처 · 설정</button>
      </div>
      <p class="record">최고 기록 <strong>${this.save.bestScore}점</strong></p>
    </section>`;
  }

  private renderDiagnosis(): string {
    const question = questions[this.questionIndex];
    return `<section class="setup-screen narrow">
      <header class="step-header"><span>투자자성향 진단</span><strong>${this.questionIndex + 1} / 5</strong></header>
      <div class="progress" aria-label="진행률 ${this.questionIndex + 1}/5"><i style="width:${(this.questionIndex + 1) * 20}%"></i></div>
      <p class="eyebrow">정답은 없습니다</p><h1>${question.text}</h1>
      <div class="choice-stack">${question.options.map(([label, score], index) => `<button data-action="answer" data-score="${score}"><span class="choice-index">${String.fromCharCode(65 + index)}</span>${label}<span aria-hidden="true">→</span></button>`).join('')}</div>
      <p class="hint">입력 내용은 브라우저 밖으로 전송되지 않습니다.</p>
    </section>`;
  }

  private renderGoal(): string {
    const profile = investorProfiles.find((item) => item.id === this.profileId)!;
    return `<section class="setup-screen narrow">
      <div class="profile-stamp">진단 결과 · ${profile.name}</div>
      <h1>월 연금 목표를 정하세요</h1>
      <p>${profile.description} 성향은 서열이 아니라 감당 가능한 변동을 확인하는 기준입니다.</p>
      <div class="goal-display"><small>목표 월 연금</small><strong>${formatWon(this.goalMonthly)}</strong></div>
      <label class="sr-only" for="goal-range">월 연금 목표</label>
      <input id="goal-range" type="range" min="${balanceConfig.minGoal}" max="${balanceConfig.maxGoal}" step="50000" value="${this.goalMonthly}">
      <div class="range-labels"><span>${formatWon(balanceConfig.minGoal)}</span><span>${formatWon(balanceConfig.maxGoal)}</span></div>
      <div class="assumption"><strong>게임 계산 가정</strong><span>최종 IRP 평가액 ÷ ${policyRules.receivingMonths}개월</span><span>세전 · 물가/수령 중 수익 미반영</span></div>
      <button class="primary jumbo" data-action="goal-next">이 목표로 출발</button>
    </section>`;
  }

  private renderTutorial(): string {
    const pages = [
      ['01', '매 턴, 신호부터 읽어요', '시장 브리핑 → 주사위 → 도착 카드 → 운용 행동 → 정산 순서입니다.', '↗'],
      ['02', '두 지갑을 따로 지켜요', '생활자금은 예상 밖 지출에, IRP는 먼 훗날의 월 연금에 사용합니다.', '◫'],
      ['03', '수익보다 균형이 먼저예요', '위험자산 한도를 지키고, 마지막 2턴의 리밸런싱 기회를 활용하세요.', '◎']
    ];
    const page = pages[this.tutorialPage];
    return `<section class="tutorial-screen narrow"><div class="tutorial-visual"><span>${page[3]}</span><i>${page[0]}</i></div><p class="eyebrow">빠른 안내 ${this.tutorialPage + 1}/3</p><h1>${page[1]}</h1><p class="lead">${page[2]}</p><div class="tutorial-dots">${pages.map((_, i) => `<i class="${i === this.tutorialPage ? 'active' : ''}"></i>`).join('')}</div><button class="primary jumbo" data-action="tutorial-next">${this.tutorialPage === 2 ? '12턴 시작' : '다음'}</button></section>`;
  }

  private renderBoard(state: GameState): string {
    const tiles = boardTiles.map((tile) => {
      const { x, y } = boardPosition(tile.index);
      const active = tile.index === state.position;
      return `<g class="tile tile-${tile.kind} ${active ? 'active' : ''}" transform="translate(${x} ${y})">
        <rect x="3" y="3" width="94" height="94" rx="15"></rect>
        <text class="tile-icon" x="14" y="30">${tileIcons[tile.kind]}</text>
        <text class="tile-number" x="84" y="24" text-anchor="end">${String(tile.index + 1).padStart(2, '0')}</text>
        <text class="tile-label" x="50" y="70" text-anchor="middle">${tile.label.length > 7 ? tile.label.slice(0, 7) : tile.label}</text>
        ${active ? '<circle class="player" cx="50" cy="45" r="13"></circle><text class="player-mark" x="50" y="50" text-anchor="middle">나</text>' : ''}
      </g>`;
    }).join('');
    return `<svg class="board" viewBox="0 0 700 700" role="img" aria-label="24칸 순환 보드. 현재 말은 ${state.position + 1}번 칸 ${boardTiles[state.position].label}에 있습니다.">
      <defs><pattern id="risk-pattern" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="currentColor" opacity=".12"></path></pattern></defs>
      <rect class="board-bg" x="0" y="0" width="700" height="700" rx="28"></rect>${tiles}
      <g class="board-center"><text x="350" y="286" text-anchor="middle">현재 시장 국면</text><text class="phase" x="350" y="330" text-anchor="middle">${state.phase}</text><path d="M260 368H440"></path><text x="350" y="406" text-anchor="middle">${state.lastMarket.signal}</text><text class="seed" x="350" y="445" text-anchor="middle">SEED ${state.seed}</text></g>
    </svg>`;
  }

  private renderGame(): string {
    if (!this.game) return '';
    const state = this.game;
    const score = calculateScore(state);
    const remaining = balanceConfig.maxTurns - state.turn;
    const pending = state.pendingOrders.length;
    return `<section class="game-screen">
      <header class="game-topbar">
        <div class="brand-small"><span>연금로드</span><small>금리의 두 얼굴</small></div>
        <div class="mobile-stats">
          <div><small>남은 턴</small><strong>${remaining}</strong></div>
          <div><small>예상 월 연금</small><strong>${formatShortWon(score.monthlyPension)}</strong></div>
          <div><small>목표 달성률</small><strong>${Math.round(score.goalRate * 100)}%</strong></div>
        </div>
        <button class="icon-button" data-action="open-settings" aria-label="설정과 출처">⋮</button>
      </header>
      <div class="game-layout">
        <div class="board-wrap">${this.renderBoard(state)}</div>
        <aside class="dashboard">
          <div class="turn-chip">TURN ${String(state.turn + (state.awaitingAction ? 0 : 1)).padStart(2, '0')} / 12</div>
          <article class="market-card"><div class="card-label">시장 브리핑</div><h2>${state.lastMarket.headline}</h2><p class="signal">${state.lastMarket.signal}</p><p>${state.lastMarket.reason}</p><div class="market-bars"><span>금리 <i style="--level:${state.lastMarket.rate}"></i>${state.lastMarket.rate}/5</span><span>물가 <i style="--level:${state.lastMarket.inflation}"></i>${state.lastMarket.inflation}/5</span><span>주가 <i style="--level:${state.lastMarket.stocks}"></i>${state.lastMarket.stocks}/5</span></div></article>
          <article class="asset-card"><div class="card-label">나의 은퇴설계</div>
            <div class="big-number"><span>IRP 평가액</span><strong>${formatShortWon(score.irpValue)}</strong></div>
            <div class="metric-row"><span><abbr title="최종 IRP 평가액을 240개월로 나눈 교육용 값">예상 월 연금</abbr><strong>${formatWon(score.monthlyPension)}</strong></span><span>생활자금<strong>${formatShortWon(state.cash)}</strong></span></div>
            <div class="goal-meter"><span style="width:${Math.min(100, score.goalRate * 100)}%"></span></div><div class="goal-caption"><span>목표 ${formatShortWon(state.goalMonthly)}</span><strong>${Math.round(score.goalRate * 100)}%</strong></div>
            <div class="risk-line"><span>위험자산 비중 <b>${percent(score.riskRatio)}</b></span><span>교육용 한도 ${percent(policyRules.riskAssetLimit)}</span></div>
            ${state.marketLimitExceeded ? '<p class="warning">⚠ 시장 상승으로 한도 초과 · 위험매수 제한, 리밸런싱 권장</p>' : ''}
            ${pending ? `<p class="order-note">⌛ 주문 ${pending}건이 기준가·결제를 기다리는 중</p>` : ''}
          </article>
          <div class="turn-log"><strong>최근 기록</strong><p>${state.logs.at(-1)?.message ?? ''}</p></div>
        </aside>
      </div>
      <nav class="game-actions" aria-label="게임 행동">
        <button data-action="open-portfolio"><span>◫</span>포트폴리오</button>
        <button class="dice-button" data-action="roll" ${state.awaitingAction || state.currentEventId ? 'disabled' : ''}><span>⚄</span>${state.awaitingAction ? '행동 선택 중' : '주사위 굴리기'}</button>
        <button data-action="open-market"><span>↗</span>시장</button>
      </nav>
    </section>`;
  }

  private renderResult(): string {
    if (!this.game) return '';
    const score = calculateScore(this.game);
    const diagnosed = investorProfiles.find((item) => item.id === this.game!.profileId)!;
    const actual = investorProfiles.find((item) => item.id === score.behaviorProfile)!;
    return `<section class="result-screen">
      <div class="eyebrow">12턴 은퇴설계 리포트</div><h1>${score.goalMet ? '목표에 도착했습니다' : '목표에 가까워진 여정입니다'}</h1>
      <div class="stars" role="img" aria-label="3개 중 ${score.stars}개 별">${[1,2,3].map((n) => `<span aria-hidden="true" class="${n <= score.stars ? 'earned' : ''}">★</span>`).join('')}</div>
      <p class="score-title"><strong>${score.totalScore}점</strong> · ${score.stars === 3 ? '지속 가능한 연금 설계자' : score.stars >= 1 ? '균형 잡힌 적립가' : '연금 설계 입문자'}</p>
      <div class="result-hero"><div><small>예상 월 연금</small><strong>${formatWon(score.monthlyPension)}</strong><span>목표 ${formatWon(this.game.goalMonthly)} · 달성률 ${Math.round(score.goalRate * 100)}%</span></div><div class="score-ring" style="--score:${score.totalScore}">${score.totalScore}</div></div>
      <div class="result-grid">
        <article><span>IRP 최종 평가액</span><strong>${formatWon(score.irpValue)}</strong></article>
        <article><span>생활자금</span><strong>${formatWon(score.cash)}</strong></article>
        <article><span>위험자산 비중</span><strong>${percent(score.riskRatio)}</strong></article>
        <article><span>최대 낙폭</span><strong>${percent(score.maxDrawdown)}</strong></article>
        <article><span>분산도</span><strong>${score.diversification}개 자산</strong></article>
        <article><span>생활자금 부족</span><strong>${this.game.cashShortages}회</strong></article>
      </div>
      <div class="score-breakdown"><span>노후소득 <b>${score.incomeScore}/50</b></span><span>안정성 <b>${score.stabilityScore}/30</b></span><span>제도·운용 이해 <b>${score.knowledgeScore}/20</b></span></div>
      <article class="behavior-card"><div><small>진단 성향</small><strong>${diagnosed.name}</strong></div><span>→</span><div><small>실제 행동성향</small><strong>${actual.name}</strong></div><p>${score.profileAligned ? '진단과 실제 행동이 큰 차이 없이 이어졌습니다.' : '진단과 실제 위험 선택에 차이가 있었습니다. 감내 가능한 손실을 다시 점검해보세요.'}</p></article>
      <div class="decision-grid"><article class="good"><span>✓ 가장 좋았던 결정</span><p>${score.bestDecision}</p></article><article class="improve"><span>↗ 다음에 바꿀 한 가지</span><p>${score.improvement}</p></article></div>
      <details class="assumptions"><summary>월 연금 계산 가정과 면책</summary><p>최종 IRP 평가액 ÷ ${policyRules.receivingMonths}개월의 단순 균등분할입니다. 세전이며 수령 중 수익률, 세금, 비용, 물가를 반영하지 않습니다. 실제 결과와 다를 수 있고 투자 권유가 아닙니다.</p></details>
      <div class="result-actions"><button class="primary" data-action="same-seed">같은 시드로 다시</button><button class="secondary" data-action="new-seed">새 시드로 도전</button><button class="text-button" data-action="open-cards">관련 학습 카드 보기</button><button class="text-button" data-action="to-title">타이틀로</button></div>
    </section>`;
  }

  private renderModal(): string {
    if (!this.modal) return '';
    const close = !['tile', 'action'].includes(this.modal) ? '<button class="modal-close" data-action="close-modal" aria-label="닫기">×</button>' : '';
    let content = '';
    if (this.modal === 'tile') content = this.renderTileModal();
    if (this.modal === 'action') content = this.renderActionModal();
    if (this.modal === 'portfolio') content = this.renderPortfolioModal();
    if (this.modal === 'market') content = this.renderMarketModal();
    if (this.modal === 'cards') content = this.renderCardsModal();
    if (this.modal === 'settings') content = this.renderSettingsModal();
    return `<div class="modal-backdrop"><section class="modal-sheet modal-${this.modal}" role="dialog" aria-modal="true" aria-label="${this.modal === 'action' ? '운용 행동 선택' : '게임 정보'}">${close}${content}<p class="modal-feedback" aria-live="polite">${this.feedback}</p></section></div>`;
  }

  private renderTileModal(): string {
    if (!this.game) return '';
    const tile = boardTiles[this.game.lastTileIndex];
    const event = this.game.currentEventId ? getLifeEvent(this.game.currentEventId) : undefined;
    if (event) return `<div class="modal-icon life">♥</div><p class="eyebrow">생활 사건 · ${event.eligibleWithdrawal ? '중도인출 가능 사유 가정' : '중도인출 제한 체험'}</p><h2>${event.title}</h2><p class="modal-lead">${event.body}</p><div class="event-cost">필요 금액 <strong>${formatWon(Math.abs(event.cost))}</strong></div>${event.cost < 0 ? '<button class="primary" data-action="resolve-cash">생활자금에 반영</button>' : `<div class="button-stack"><button class="primary" data-action="resolve-cash">생활자금으로 해결</button><button class="secondary" data-action="resolve-withdraw">IRP 중도인출 요청${event.eligibleWithdrawal ? '' : ' (제한 확인)'}</button></div>`}`;
    const cardId = tile.kind === 'market' ? (this.game.turn <= 4 ? 'rate-bond' : this.game.turn <= 8 ? 'duration' : 'rebalance') : tile.kind === 'product' ? 'fund-order' : tile.kind === 'trade' ? 'etf-order' : tile.kind === 'policy' ? 'risk-limit' : tile.kind === 'rebalance' ? 'rebalance' : tile.kind === 'profile' ? 'profile' : 'pension-assumption';
    const card = getLearningCard(cardId)!;
    return `<div class="modal-icon ${tile.kind}">${tileIcons[tile.kind]}</div><p class="eyebrow">${tile.label} · ${this.game.position + 1}번 칸</p><h2>${card.title}</h2><p class="modal-lead">${card.key}</p><div class="why-box"><strong>왜 그런가요?</strong><p>${card.detail}</p></div><button class="primary" data-action="card-continue">카드 해결 · 운용 행동 선택</button>`;
  }

  private productOptions(selected: ProductId, holdingsOnly = false): string {
    if (!this.game) return '';
    return products.filter((product) => !holdingsOnly || (this.game!.holdings.find((holding) => holding.productId === product.id)?.amount ?? 0) >= 100000)
      .map((product) => `<option value="${product.id}" ${selected === product.id ? 'selected' : ''}>${product.name}</option>`).join('');
  }

  private renderActionModal(): string {
    if (!this.game) return '';
    const expected = expectedRiskAfterBuy(this.game, this.selectedBuy, Math.min(balanceConfig.tradeAmount, this.game.irpCash));
    return `<p class="eyebrow">TURN ${this.game.turn} · 행동은 한 번</p><h2>이번 턴의 운용 행동</h2><p>선택하면 시장 수익률, 주문, 이자와 비용이 반영되고 다음 턴으로 넘어갑니다.</p>
      <div class="action-list">
        <article><div><strong>추가납입</strong><small>생활자금 → IRP 대기자금 · ${formatWon(balanceConfig.contributionAmount)}</small></div><button data-action="do-contribute">실행</button></article>
        <article><div><strong>매수</strong><label for="buy-product">상품 선택</label><select id="buy-product">${this.productOptions(this.selectedBuy)}</select><small>매수 후 예상 위험비중 ${percent(expected)}</small></div><button data-action="do-buy">실행</button></article>
        <article><div><strong>매도</strong><label for="sell-product">상품 선택</label><select id="sell-product">${this.productOptions(this.selectedSell, true)}</select><small>예금은 만기 전 해지 불이익, 펀드는 주문 대기</small></div><button data-action="do-sell">실행</button></article>
        <article><div><strong>교체매매</strong><label for="switch-from">기존 상품</label><select id="switch-from">${this.productOptions(this.switchFrom, true)}</select><label for="switch-to">새 상품</label><select id="switch-to">${this.productOptions(this.switchTo)}</select><small>펀드 환매대금은 다음 턴에 새 매수로 이어집니다.</small></div><button data-action="do-switch">실행</button></article>
        <article class="featured"><div><strong>리밸런싱</strong><small>분산 목표비중 6종으로 복원 · 마지막 2턴에도 항상 가능</small></div><button data-action="do-rebalance">실행</button></article>
        <article><div><strong>행동하지 않기</strong><small>현재 구성을 유지하고 시장 변화를 반영</small></div><button data-action="do-hold">유지</button></article>
      </div>`;
  }

  private renderPortfolioModal(): string {
    if (!this.game) return '';
    const total = portfolioValue(this.game);
    const rows = products.map((product) => {
      const amount = this.game!.holdings.find((holding) => holding.productId === product.id)?.amount ?? 0;
      return `<tr><td><span class="risk-symbol ${product.risk_asset_ratio > 0 ? 'risky' : 'safe'}">${product.risk_asset_ratio > 0 ? '▲' : '●'}</span>${product.shortName}<small>${product.riskLabel}</small></td><td>${formatShortWon(amount)}</td><td>${total ? percent(amount / total) : '0%'}</td></tr>`;
    }).join('');
    const orders = this.game.pendingOrders.length ? this.game.pendingOrders.map((order) => `<li>${order.side === 'buy' ? '매수' : '환매'} · ${products.find((p) => p.id === order.productId)?.shortName} · ${order.stage === 'received' ? '주문 접수' : '기준가 확정'} → ${order.settlesTurn}턴 반영</li>`).join('') : '<li>대기 주문 없음</li>';
    return `<p class="eyebrow">포트폴리오</p><h2>${formatWon(total)}</h2><p>위험자산 ${percent(riskAssetRatio(this.game))} · IRP 대기자금 ${formatWon(this.game.irpCash)}</p><div class="table-wrap"><table><thead><tr><th>상품</th><th>평가액</th><th>비중</th></tr></thead><tbody>${rows}</tbody></table></div><h3>주문 처리</h3><ul class="order-list">${orders}</ul>`;
  }

  private renderMarketModal(): string {
    const currentTurn = this.game?.turn || 1;
    return `<p class="eyebrow">시장 흐름 · 금리의 두 얼굴</p><h2>인과관계 타임라인</h2><div class="timeline">${marketScenario.map((step) => `<div class="${step.turn === currentTurn ? 'current' : step.turn < currentTurn ? 'past' : ''}"><span>${step.turn}</span><p><strong>${step.phase}</strong>${step.headline}<small>${step.signal}</small></p></div>`).join('')}</div><div class="why-box"><strong>교육용 단순화</strong><p>실제 시장은 여러 요인이 동시에 작용합니다. 이 흐름은 전망이나 투자 권유가 아니라 금리·채권 관계를 체험하기 위한 가정입니다.</p></div>`;
  }

  private renderCardsModal(): string {
    const unlocked = new Set(this.save.unlockedCards);
    return `<p class="eyebrow">학습 카드 도감</p><h2>${unlocked.size} / ${learningCards.length} 발견</h2><div class="card-library">${learningCards.map((card) => unlocked.has(card.id) ? `<article><span>${card.category}</span><h3>${card.title}</h3><p>${card.key}</p><details><summary>쉬운 설명</summary><p>${card.detail}</p></details></article>` : `<article class="locked"><span>미발견</span><h3>?</h3><p>게임의 관련 칸과 행동에서 열립니다.</p></article>`).join('')}</div>`;
  }

  private renderSettingsModal(): string {
    return `<p class="eyebrow">설정 · 면책 · 출처</p><h2>교육용 게임 안내</h2>
      <label class="setting-row" for="reduced-motion"><span><strong>동작 줄이기</strong><small>말 이동과 모달 전환을 즉시 표시합니다.</small></span><input id="reduced-motion" type="checkbox" ${this.save.settings.reducedMotion ? 'checked' : ''}></label>
      <div class="disclaimer-box"><strong>중요 면책</strong><p>모든 금융 수치는 교육용으로 단순화했습니다. 특정 금융회사·상품을 추천하지 않으며, 수익·원금·세제 혜택을 보장하지 않습니다. 실제 규정과 세무 결과는 개인 상황과 기준일에 따라 달라질 수 있습니다.</p></div>
      <h3>정책 데이터</h3><p>기준일 ${policyRules.reviewed_at} · 교육용 단순화 ${policyRules.simplified ? '예' : '아니오'}</p>
      <ul class="source-list"><li><a href="${policyRules.source_urls[0]}" target="_blank" rel="noreferrer">금융감독원 · 위험자산별 투자한도</a></li><li><a href="${policyRules.source_urls[1]}" target="_blank" rel="noreferrer">금융감독원 · 퇴직연금 세제—세액공제</a></li><li><a href="${policyRules.source_urls[2]}" target="_blank" rel="noreferrer">금융감독원 · 퇴직연금 세제—연금수령</a></li></ul>
      <p class="version">연금로드 MVP v1.0 · 저장 데이터는 이 브라우저에만 보관됩니다.</p>`;
  }
}
