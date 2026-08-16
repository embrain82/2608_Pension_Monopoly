import { balanceConfig, investorProfiles, learningCards, marketScenario, policyRules, products } from '../data/content';
import { createGame, performAction, resolveActionAmount, resolveLifeEvent, startTurn, type AmountPreset, type GameAction } from '../engine/game-engine';
import { getLifeEvent, getLearningCard } from '../engine/content-engine';
import { portfolioValue } from '../engine/portfolio-engine';
import { expectedRiskAfterBuy, riskAssetRatio } from '../engine/policy-engine';
import { randomSeed } from '../engine/random-engine';
import { calculateScore } from '../engine/scoring-engine';
import type { ActionKind, GameState, ProfileId, ProductId, SaveData } from '../types';
import { loadSave, saveData } from './ui-state';

type Screen = 'title' | 'diagnosis' | 'goal' | 'game' | 'result';
type Modal = 'life' | 'action' | 'portfolio' | 'market' | 'cards' | 'settings' | null;
type ActionView = 'menu' | ActionKind;

const questions = [
  { text: '노후자금까지 남은 투자기간은?', options: [['10년 미만', 1], ['10~20년', 2], ['20년 이상', 4]] },
  { text: '평가액이 일시적으로 하락한다면 감내 가능한 범위는?', options: [['5% 안팎', 1], ['10% 안팎', 2], ['20% 이상도 가능', 4]] },
  { text: '비상생활자금은 어느 정도 확보되어 있나요?', options: [['거의 없음', 1], ['3개월 정도', 2], ['6개월 이상', 4]] },
  { text: '투자상품이 10% 하락하면 어떻게 할 것 같나요?', options: [['대부분 매도', 1], ['상황을 점검하고 일부 조정', 2], ['장기계획에 따라 유지·분할매수', 4]] },
  { text: '노후자금 운용에서 더 중요한 것은?', options: [['원금 변동 최소화', 1], ['안정과 성장의 균형', 2], ['큰 변동을 감수한 성장', 4]] }
] as const;

const formatWon = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const formatShortWon = (value: number) => value >= 100_000_000
  ? `${(value / 100_000_000).toFixed(2)}억원`
  : `${Math.round(value / 10_000).toLocaleString('ko-KR')}만원`;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;

function profileFromScore(score: number): ProfileId {
  return investorProfiles.find((profile) => score >= profile.minScore && score <= profile.maxScore)?.id ?? 'balanced';
}

export class PensionRoadApp {
  private screen: Screen = 'title';
  private modal: Modal = null;
  private game: GameState | null = null;
  private save: SaveData = loadSave();
  private disclaimerChecked = this.save.disclaimerAccepted;
  private questionIndex = 0;
  private diagnosisScore = 0;
  private profileId: ProfileId = 'balanced';
  private goalMonthly = balanceConfig.defaultGoal;
  private selectedBuy: ProductId = 'shortBond';
  private selectedSell: ProductId = 'deposit';
  private switchFrom: ProductId = 'balanced';
  private switchTo: ProductId = 'shortBond';
  private amountPreset: AmountPreset = 'default';
  private actionView: ActionView = 'menu';
  private setupReturn: Screen = 'title';
  private coachDismissed = false;
  private tipDismissed = false;
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
      if (this.game.status === 'finished') {
        const score = calculateScore(this.game);
        this.save.bestScore = Math.max(this.save.bestScore, score.totalScore);
        this.save.bestReturnRate = Math.max(this.save.bestReturnRate, score.returnRate);
        this.save.bestGoalRate = Math.max(this.save.bestGoalRate, score.goalRate);
        this.save.playCount += 1;
      }
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

    if (action === 'begin' && this.canStart()) {
      this.save.disclaimerAccepted = true;
      this.disclaimerChecked = true;
      this.persist();
      this.startGame(randomSeed());
    } else if (action === 'answer') {
      this.diagnosisScore += Number(button.dataset.score ?? 0);
      this.questionIndex += 1;
      if (this.questionIndex >= questions.length) {
        this.profileId = profileFromScore(this.diagnosisScore);
        this.screen = this.setupReturn === 'game' && this.game ? 'game' : 'title';
        this.announce(`성향이 ${investorProfiles.find((item) => item.id === this.profileId)?.name ?? ''}으로 반영됩니다. 다음 판부터 적용됩니다.`);
      }
    } else if (action === 'goal-next') {
      this.screen = this.setupReturn === 'game' && this.game ? 'game' : 'title';
      this.announce(`월 연금 목표 ${formatWon(this.goalMonthly)}이 다음 판에 적용됩니다.`);
    } else if (action === 'open-action' && this.game?.awaitingAction) {
      this.actionView = 'menu';
      this.amountPreset = 'default';
      this.modal = 'action';
    } else if (action === 'action-view') {
      this.actionView = (button.dataset.view as ActionView) || 'menu';
    } else if (action === 'amount-preset') {
      this.amountPreset = (button.dataset.preset as AmountPreset) || 'default';
    } else if (action === 'resolve-cash' || action === 'resolve-withdraw') {
      if (this.game) {
        const result = resolveLifeEvent(this.game, action === 'resolve-cash' ? 'cash' : 'withdraw');
        this.game = result.state;
        this.announce(result.message);
        if (result.ok) this.modal = this.game.awaitingAction ? 'action' : null;
        this.persist(true);
      }
    } else if (action === 'do-contribute') {
      this.runAction({ kind: 'contribute', amount: this.currentAmount('contribute') });
    } else if (action === 'do-buy') {
      this.runAction({ kind: 'buy', productId: this.selectedBuy, amount: this.currentAmount('buy', this.selectedBuy) });
    } else if (action === 'do-sell') {
      this.runAction({ kind: 'sell', productId: this.selectedSell, amount: this.currentAmount('sell', this.selectedSell) });
    } else if (action === 'do-switch') {
      this.runAction({ kind: 'switch', fromProductId: this.switchFrom, toProductId: this.switchTo, amount: this.currentAmount('switch', this.switchFrom) });
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
    } else if (action === 'open-diagnosis') {
      this.setupReturn = this.game ? 'game' : 'title';
      this.questionIndex = 0;
      this.diagnosisScore = 0;
      this.modal = null;
      this.screen = 'diagnosis';
    } else if (action === 'open-goal') {
      this.setupReturn = this.game ? 'game' : 'title';
      this.modal = null;
      this.screen = 'goal';
    } else if (action === 'dismiss-coach') {
      this.coachDismissed = true;
    } else if (action === 'dismiss-tip') {
      this.tipDismissed = true;
    } else if (action === 'close-modal') {
      if (!['life', 'action'].includes(this.modal ?? '')) this.modal = null;
    } else if (action === 'same-seed') {
      this.startGame((this.game?.seed ?? this.save.lastSeed) || randomSeed());
    } else if (action === 'new-seed') {
      this.startGame(randomSeed());
    } else if (action === 'to-title') {
      this.screen = 'title'; this.modal = null; this.game = null; this.coachDismissed = false; this.tipDismissed = false;
    }
    this.render();
  }

  private canStart(): boolean {
    return this.save.disclaimerAccepted || this.disclaimerChecked;
  }

  private currentAmount(kind: ActionKind, productId?: ProductId): number {
    if (!this.game) return 0;
    return resolveActionAmount(this.game, kind, this.amountPreset, productId);
  }

  private runAction(action: GameAction): void {
    if (!this.game) return;
    const result = performAction(this.game, action);
    this.game = result.state;
    this.announce(result.message);
    if (!result.ok) return;
    this.modal = null;
    this.actionView = 'menu';
    this.tipDismissed = false;
    if (this.game.status === 'finished') {
      this.screen = 'result';
      this.persist(true);
      return;
    }
    const next = startTurn(this.game);
    this.game = next.state;
    this.modal = this.game.currentEventId ? 'life' : null;
    this.persist(true);
  }

  private startGame(seed: string): void {
    this.game = startTurn(createGame(seed, this.profileId, this.goalMonthly)).state;
    this.screen = 'game';
    this.actionView = 'menu';
    this.coachDismissed = false;
    this.tipDismissed = false;
    this.modal = this.game.currentEventId ? 'life' : null;
    this.persist(true);
    this.announce(`시드 ${seed} · 시장을 보고 한 가지만 고르세요.`);
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.modal && !['life', 'action'].includes(this.modal)) {
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
          : this.screen === 'game' ? this.renderGame()
            : this.renderResult();
    this.root.innerHTML = `<main id="main" class="app-shell">${screenHtml}</main>${this.renderModal()}`;
    const dialog = this.root.querySelector<HTMLElement>('[role="dialog"]');
    if (dialog) requestAnimationFrame(() => dialog.querySelector<HTMLElement>('button:not([disabled]), select, input:not([disabled]), a[href]')?.focus());
  }

  private renderTitle(): string {
    const needsDisclaimer = !this.save.disclaimerAccepted;
    return `<section class="title-screen">
      <div class="eyebrow">시장을 보고 움직이는 12턴</div>
      <div class="title-mark" aria-hidden="true"><span>12</span><small>TURNS</small></div>
      <h1>연금로드</h1><p class="subtitle">12턴의 은퇴설계</p>
      <p class="lead">가상 퇴직연금으로 시장 국면을 읽고<br>매매·리밸런싱해 목표 월 연금에 도전하세요.</p>
      ${needsDisclaimer ? `<div class="disclaimer-check">
        <input id="disclaimer" type="checkbox" ${this.disclaimerChecked ? 'checked' : ''}>
        <label for="disclaimer"><strong>교육용 단순화에 동의합니다.</strong><br>실제 투자 권유가 아니며 수익·원금을 보장하지 않습니다.</label>
      </div>` : ''}
      <button class="primary jumbo" data-action="begin" ${this.canStart() ? '' : 'disabled'}>바로 시작</button>
      <div class="utility-row">
        <button class="text-button" data-action="open-cards">학습 카드 도감 <span class="badge">${this.save.unlockedCards.length}</span></button>
        <button class="text-button" data-action="open-settings">면책 · 출처 · 설정</button>
      </div>
      <p class="record">최고 달성률 <strong>${Math.round(this.save.bestGoalRate * 100)}%</strong> · 최고 수익률 <strong>${signedPercent(this.save.bestReturnRate)}</strong> · ${this.save.bestScore}점</p>
    </section>`;
  }

  private renderDiagnosis(): string {
    const question = questions[this.questionIndex];
    return `<section class="setup-screen narrow">
      <header class="step-header"><span>투자자성향 진단</span><strong>${this.questionIndex + 1} / 5</strong></header>
      <div class="progress" aria-label="진행률 ${this.questionIndex + 1}/5"><i style="width:${(this.questionIndex + 1) * 20}%"></i></div>
      <p class="eyebrow">정답은 없습니다 · 다음 판부터 적용</p><h1>${question.text}</h1>
      <div class="choice-stack">${question.options.map(([label, score], index) => `<button data-action="answer" data-score="${score}"><span class="choice-index">${String.fromCharCode(65 + index)}</span>${label}<span aria-hidden="true">→</span></button>`).join('')}</div>
      <p class="hint">입력 내용은 브라우저 밖으로 전송되지 않습니다.</p>
    </section>`;
  }

  private renderGoal(): string {
    const profile = investorProfiles.find((item) => item.id === this.profileId)!;
    return `<section class="setup-screen narrow">
      <div class="profile-stamp">${profile.name} · 다음 판부터 적용</div>
      <h1>월 연금 목표를 정하세요</h1>
      <p>${profile.description} 성향은 서열이 아니라 감당 가능한 변동을 확인하는 기준입니다.</p>
      <div class="goal-display"><small>목표 월 연금</small><strong>${formatWon(this.goalMonthly)}</strong></div>
      <label class="sr-only" for="goal-range">월 연금 목표</label>
      <input id="goal-range" type="range" min="${balanceConfig.minGoal}" max="${balanceConfig.maxGoal}" step="50000" value="${this.goalMonthly}">
      <div class="range-labels"><span>${formatWon(balanceConfig.minGoal)}</span><span>${formatWon(balanceConfig.maxGoal)}</span></div>
      <div class="assumption"><strong>게임 계산 가정</strong><span>최종 IRP 평가액 ÷ ${policyRules.receivingMonths}개월</span><span>세전 · 물가/수령 중 수익 미반영</span></div>
      <button class="primary jumbo" data-action="goal-next">이 목표 저장</button>
    </section>`;
  }

  private renderTrack(state: GameState): string {
    const lifeTurns = new Set(state.lifeEventSchedule.map((item) => item.turn));
    const cells = marketScenario.map((step) => {
      const current = step.turn === state.turn;
      const past = step.turn < state.turn;
      const classes = [
        current ? 'current' : '',
        past ? 'past' : '',
        step.shock ? 'shock' : '',
        lifeTurns.has(step.turn) ? 'life' : ''
      ].filter(Boolean).join(' ');
      return `<i class="${classes}" title="${step.phase}${step.shock ? ' · 충격' : ''}">${step.turn}</i>`;
    }).join('');
    return `<div class="turn-track" role="img" aria-label="12턴 중 ${state.turn}턴, 현재 국면 ${state.phase}">${cells}</div>`;
  }

  private renderProductReturns(state: GameState): string {
    const total = portfolioValue(state);
    const rows = products.map((product) => {
      const amount = state.holdings.find((holding) => holding.productId === product.id)?.amount ?? 0;
      const ret = state.lastMarket.returns[product.id];
      return `<li class="${ret < 0 ? 'down' : ret > 0 ? 'up' : ''}"><span>${product.shortName}</span><b>${signedPercent(ret)}</b><small>${total ? percent(amount / total) : '0%'}</small></li>`;
    }).join('');
    return `<ul class="product-returns">${rows}</ul>`;
  }

  private renderGame(): string {
    if (!this.game) return '';
    const state = this.game;
    const score = calculateScore(state);
    const pending = state.pendingOrders.length;
    const latestCard = getLearningCard(state.unlockedCards.at(-1) ?? '');
    const ctaLabel = state.currentEventId ? '생활사건 해결 중' : state.awaitingAction ? '이번 턴 운용하기' : '정산 중';
    return `<section class="game-screen">
      <header class="game-topbar">
        <div class="brand-small"><span>연금로드</span><small>금리의 두 얼굴</small></div>
        <div class="mobile-stats">
          <div><small>턴</small><strong>${state.turn}/12</strong></div>
          <div><small>예상 월 연금</small><strong>${formatShortWon(score.monthlyPension)}</strong></div>
          <div><small>수익률</small><strong class="${score.returnRate < 0 ? 'neg' : ''}">${signedPercent(score.returnRate)}</strong></div>
        </div>
        <button class="icon-button" data-action="open-settings" aria-label="설정과 출처">⋮</button>
      </header>
      <div class="game-layout">
        <div class="board-wrap market-first">
          ${this.renderTrack(state)}
          ${state.lastMarket.shock ? '<p class="shock-banner">충격 턴 · 신호를 보고 비중을 조정하세요</p>' : ''}
          <article class="market-card">
            <div class="card-label">TURN ${String(state.turn).padStart(2, '0')} · 시장 브리핑</div>
            <h2>${state.lastMarket.headline}</h2>
            <p class="signal">${state.lastMarket.signal}</p>
            <p>${state.lastMarket.reason}</p>
            <div class="market-bars"><span>금리 <i style="--level:${state.lastMarket.rate}"></i>${state.lastMarket.rate}/5</span><span>물가 <i style="--level:${state.lastMarket.inflation}"></i>${state.lastMarket.inflation}/5</span><span>주가 <i style="--level:${state.lastMarket.stocks}"></i>${state.lastMarket.stocks}/5</span></div>
            ${this.renderProductReturns(state)}
          </article>
        </div>
        <aside class="dashboard">
          ${!this.coachDismissed && state.turn === 1 ? '<p class="coach-tip">숫자를 보고 한 가지만 고르세요. 선택하면 이번 턴 수익률이 반영됩니다. <button class="text-button" data-action="dismiss-coach">숨기기</button></p>' : ''}
          ${!this.tipDismissed && latestCard ? `<p class="card-tip"><strong>${latestCard.title}</strong>${latestCard.key}<button class="text-button" data-action="dismiss-tip">닫기</button></p>` : ''}
          <article class="asset-card"><div class="card-label">나의 은퇴설계</div>
            <div class="big-number"><span>IRP 평가액</span><strong>${formatShortWon(score.irpValue)}</strong></div>
            <div class="metric-row"><span><abbr title="최종 IRP 평가액을 240개월로 나눈 교육용 값">예상 월 연금</abbr><strong>${formatWon(score.monthlyPension)}</strong></span><span>시작 대비<strong class="${score.returnRate < 0 ? 'neg' : ''}">${signedPercent(score.returnRate)}</strong></span></div>
            <div class="goal-meter"><span style="width:${Math.min(100, score.goalRate * 100)}%"></span></div><div class="goal-caption"><span>목표 ${formatShortWon(state.goalMonthly)}</span><strong>${Math.round(score.goalRate * 100)}%</strong></div>
            <div class="risk-line"><span>위험자산 비중 <b>${percent(score.riskRatio)}</b></span><span>생활자금 ${formatShortWon(state.cash)}</span></div>
            ${state.marketLimitExceeded ? '<p class="warning">시장 상승으로 한도 초과 · 위험매수 제한, 리밸런싱 권장</p>' : ''}
            ${pending ? `<p class="order-note">주문 ${pending}건이 다음 턴 기준가·결제를 기다리는 중</p>` : ''}
          </article>
          <div class="turn-log"><strong>최근 기록</strong><p>${state.logs.at(-1)?.message ?? ''}</p></div>
        </aside>
      </div>
      <nav class="game-actions" aria-label="게임 행동">
        <button data-action="open-portfolio"><span>◫</span>포트폴리오</button>
        <button class="dice-button" data-action="open-action" ${state.awaitingAction ? '' : 'disabled'}><span>↗</span>${ctaLabel}</button>
        <button data-action="open-market"><span>☰</span>타임라인</button>
      </nav>
    </section>`;
  }

  private renderResult(): string {
    if (!this.game) return '';
    const score = calculateScore(this.game);
    const diagnosed = investorProfiles.find((item) => item.id === this.game!.profileId)!;
    const actual = investorProfiles.find((item) => item.id === score.behaviorProfile)!;
    const headline = score.goalMet ? '목표에 도착했습니다' : `목표까지 ${formatWon(Math.max(0, this.game.goalMonthly - score.monthlyPension))}`;
    return `<section class="result-screen">
      <div class="eyebrow">12턴 은퇴설계 리포트</div>
      <h1>${headline}</h1>
      <div class="result-hero dual">
        <div><small>예상 월 연금</small><strong>${formatWon(score.monthlyPension)}</strong><span>목표 ${formatWon(this.game.goalMonthly)} · 달성률 ${Math.round(score.goalRate * 100)}%</span></div>
        <div><small>시작 대비 수익률</small><strong class="${score.returnRate < 0 ? 'neg' : ''}">${signedPercent(score.returnRate)}</strong><span>운용수익률 ${signedPercent(score.investmentReturnRate)} · 낙폭 ${percent(score.maxDrawdown)}</span></div>
      </div>
      <p class="score-title">보조 점수 <strong>${score.totalScore}점</strong> · 별 ${score.stars}개 · ${score.stars === 3 ? '지속 가능한 연금 설계자' : score.stars >= 1 ? '균형 잡힌 적립가' : '연금 설계 입문자'}</p>
      <div class="stars" role="img" aria-label="3개 중 ${score.stars}개 별">${[1, 2, 3].map((n) => `<span aria-hidden="true" class="${n <= score.stars ? 'earned' : ''}">★</span>`).join('')}</div>
      <div class="result-grid">
        <article><span>IRP 최종 평가액</span><strong>${formatWon(score.irpValue)}</strong></article>
        <article><span>추가납입</span><strong>${formatWon(this.game.contributionTotal)}</strong></article>
        <article><span>생활자금</span><strong>${formatWon(score.cash)}</strong></article>
        <article><span>위험자산 비중</span><strong>${percent(score.riskRatio)}</strong></article>
        <article><span>분산도</span><strong>${score.diversification}개 자산</strong></article>
        <article><span>생활자금 부족</span><strong>${this.game.cashShortages}회</strong></article>
      </div>
      <div class="score-breakdown"><span>노후소득 <b>${score.incomeScore}/50</b></span><span>안정성 <b>${score.stabilityScore}/30</b></span><span>제도·운용 이해 <b>${score.knowledgeScore}/20</b></span></div>
      <article class="behavior-card"><div><small>기준 성향</small><strong>${diagnosed.name}</strong></div><span>→</span><div><small>실제 행동성향</small><strong>${actual.name}</strong></div><p>${score.profileAligned ? '기준 성향과 실제 행동이 큰 차이 없이 이어졌습니다.' : '기준 성향과 실제 위험 선택에 차이가 있었습니다. 감내 가능한 손실을 다시 점검해보세요.'}</p></article>
      <div class="decision-grid"><article class="good"><span>✓ 가장 좋았던 결정</span><p>${score.bestDecision}</p></article><article class="improve"><span>↗ 다음에 바꿀 한 가지</span><p>${score.improvement}</p></article></div>
      <details class="assumptions"><summary>수익률·월 연금 계산 가정과 면책</summary><p>시작 대비 수익률은 (최종 IRP − 시작 IRP) ÷ 시작 IRP입니다. 운용수익률은 같은 식에서 추가납입을 빼 시장 효과를 구분합니다. 월 연금은 최종 IRP ÷ ${policyRules.receivingMonths}개월의 단순 균등분할입니다. 세전이며 수령 중 수익률, 세금, 비용, 물가를 반영하지 않습니다. 실제 결과와 다를 수 있고 투자 권유가 아닙니다.</p></details>
      <div class="result-actions"><button class="primary" data-action="same-seed">같은 시드로 다시</button><button class="secondary" data-action="new-seed">새 시드로 도전</button><button class="text-button" data-action="open-cards">관련 학습 카드 보기</button><button class="text-button" data-action="to-title">타이틀로</button></div>
    </section>`;
  }

  private renderModal(): string {
    if (!this.modal) return '';
    const close = !['life', 'action'].includes(this.modal) ? '<button class="modal-close" data-action="close-modal" aria-label="닫기">×</button>' : '';
    let content = '';
    if (this.modal === 'life') content = this.renderLifeModal();
    if (this.modal === 'action') content = this.renderActionModal();
    if (this.modal === 'portfolio') content = this.renderPortfolioModal();
    if (this.modal === 'market') content = this.renderMarketModal();
    if (this.modal === 'cards') content = this.renderCardsModal();
    if (this.modal === 'settings') content = this.renderSettingsModal();
    return `<div class="modal-backdrop"><section class="modal-sheet modal-${this.modal}" role="dialog" aria-modal="true" aria-label="${this.modal === 'action' ? '운용 행동 선택' : this.modal === 'life' ? '생활사건' : '게임 정보'}">${close}${content}<p class="modal-feedback" aria-live="polite">${this.feedback}</p></section></div>`;
  }

  private renderLifeModal(): string {
    if (!this.game?.currentEventId) return '';
    const event = getLifeEvent(this.game.currentEventId);
    if (!event) return '';
    return `<div class="modal-icon life">♥</div><p class="eyebrow">생활 사건 · ${event.eligibleWithdrawal ? '중도인출 가능 사유 가정' : '중도인출 제한 체험'}</p><h2>${event.title}</h2><p class="modal-lead">${event.body}</p><div class="event-cost">필요 금액 <strong>${formatWon(Math.abs(event.cost))}</strong></div>${event.cost < 0 ? '<button class="primary" data-action="resolve-cash">생활자금에 반영</button>' : `<div class="button-stack"><button class="primary" data-action="resolve-cash">생활자금으로 해결</button><button class="secondary" data-action="resolve-withdraw">IRP 중도인출 요청${event.eligibleWithdrawal ? '' : ' (제한 확인)'}</button></div>`}`;
  }

  private productOptions(selected: ProductId, holdingsOnly = false): string {
    if (!this.game) return '';
    return products.filter((product) => !holdingsOnly || (this.game!.holdings.find((holding) => holding.productId === product.id)?.amount ?? 0) >= 100000)
      .map((product) => `<option value="${product.id}" ${selected === product.id ? 'selected' : ''}>${product.name}</option>`).join('');
  }

  private amountButtons(kind: ActionKind, productId?: ProductId): string {
    if (!this.game) return '';
    return `<div class="amount-presets">${(['default', 'half', 'max'] as const).map((preset) => {
      const amount = resolveActionAmount(this.game!, kind, preset, productId);
      const label = preset === 'default' ? '기본' : preset === 'half' ? '절반' : '가능액';
      return `<button type="button" class="${this.amountPreset === preset ? 'active' : ''}" data-action="amount-preset" data-preset="${preset}">${label}<small>${formatShortWon(amount)}</small></button>`;
    }).join('')}</div>`;
  }

  private renderActionModal(): string {
    if (!this.game) return '';
    if (this.actionView === 'menu') {
      return `<p class="eyebrow">TURN ${this.game.turn} · 행동은 한 번</p><h2>무엇을 할까요?</h2><p>이번 턴 상품 수익률을 보고 한 가지만 고르세요. 선택하면 시장이 반영됩니다.</p>
        <div class="action-list">
          <article><div><strong>추가납입</strong><small>생활자금 → IRP 대기자금</small></div><button data-action="action-view" data-view="contribute">선택</button></article>
          <article><div><strong>매수</strong><small>대기자금으로 상품 매수</small></div><button data-action="action-view" data-view="buy">선택</button></article>
          <article><div><strong>매도</strong><small>보유 상품을 줄이기</small></div><button data-action="action-view" data-view="sell">선택</button></article>
          <article><div><strong>바꾸기</strong><small>한 상품을 다른 상품으로</small></div><button data-action="action-view" data-view="switch">선택</button></article>
          <article class="featured"><div><strong>리밸런싱</strong><small>목표비중 6종으로 복원</small></div><button data-action="action-view" data-view="rebalance">선택</button></article>
          <article><div><strong>이번엔 그대로</strong><small>구성 유지 후 시장 반영</small></div><button data-action="action-view" data-view="hold">선택</button></article>
        </div>`;
    }
    if (this.actionView === 'contribute') {
      const amount = this.currentAmount('contribute');
      const nextPension = (portfolioValue(this.game) + amount) / policyRules.receivingMonths;
      return `<button class="text-button" data-action="action-view" data-view="menu">← 행동 목록</button>
        <p class="eyebrow">추가납입</p><h2>IRP에 얼마나 넣을까요?</h2>
        ${this.amountButtons('contribute')}
        <div class="preview-box"><strong>미리보기</strong><p>납입 ${formatWon(amount)} · 세액공제 효과는 교육용으로 생활자금에 반영됩니다. 예상 월 연금 약 ${formatWon(nextPension)}.</p></div>
        <button class="primary jumbo" data-action="do-contribute">납입 실행</button>`;
    }
    if (this.actionView === 'buy') {
      const amount = this.currentAmount('buy', this.selectedBuy);
      const product = products.find((item) => item.id === this.selectedBuy)!;
      const expected = expectedRiskAfterBuy(this.game, this.selectedBuy, amount);
      const pending = product.kind === 'fund' ? '펀드·TDF는 다음 턴에 잔고 반영' : '예금·ETF는 즉시 체결';
      return `<button class="text-button" data-action="action-view" data-view="menu">← 행동 목록</button>
        <p class="eyebrow">매수 · ${pending}</p><h2>무엇을 살까요?</h2>
        <label for="buy-product">상품</label><select id="buy-product">${this.productOptions(this.selectedBuy)}</select>
        ${this.amountButtons('buy', this.selectedBuy)}
        <div class="preview-box"><strong>미리보기</strong><p>${formatWon(amount)} 매수 후 예상 위험비중 ${percent(expected)}. 대기자금이 없으면 먼저 납입하세요.</p></div>
        <button class="primary jumbo" data-action="do-buy">매수 실행</button>`;
    }
    if (this.actionView === 'sell') {
      const amount = this.currentAmount('sell', this.selectedSell);
      return `<button class="text-button" data-action="action-view" data-view="menu">← 행동 목록</button>
        <p class="eyebrow">매도</p><h2>무엇을 줄일까요?</h2>
        <label for="sell-product">상품</label><select id="sell-product">${this.productOptions(this.selectedSell, true)}</select>
        ${this.amountButtons('sell', this.selectedSell)}
        <div class="preview-box"><strong>미리보기</strong><p>${formatWon(amount)} 매도. 예금은 만기 전 해지 불이익, 펀드는 다음 턴 대금.</p></div>
        <button class="primary jumbo" data-action="do-sell">매도 실행</button>`;
    }
    if (this.actionView === 'switch') {
      const amount = this.currentAmount('switch', this.switchFrom);
      return `<button class="text-button" data-action="action-view" data-view="menu">← 행동 목록</button>
        <p class="eyebrow">교체매매</p><h2>무엇을 바꿀까요?</h2>
        <label for="switch-from">기존 상품</label><select id="switch-from">${this.productOptions(this.switchFrom, true)}</select>
        <label for="switch-to">새 상품</label><select id="switch-to">${this.productOptions(this.switchTo)}</select>
        ${this.amountButtons('switch', this.switchFrom)}
        <div class="preview-box"><strong>미리보기</strong><p>${formatWon(amount)} 교체. 펀드 환매대금은 다음 턴에 새 매수로 이어질 수 있습니다.</p></div>
        <button class="primary jumbo" data-action="do-switch">교체 실행</button>`;
    }
    if (this.actionView === 'rebalance') {
      const targets = products.map((product) => `${product.shortName} ${(balanceConfig.rebalanceAllocation[product.id] * 100).toFixed(0)}%`).join(' · ');
      return `<button class="text-button" data-action="action-view" data-view="menu">← 행동 목록</button>
        <p class="eyebrow">리밸런싱</p><h2>목표비중으로 되돌릴까요?</h2>
        <div class="preview-box"><strong>목표비중</strong><p>${targets}</p><p>오른 자산을 줄이고 낮아진 자산을 채워 위험 수준을 맞춥니다.</p></div>
        <button class="primary jumbo" data-action="do-rebalance">리밸런싱 실행</button>`;
    }
    return `<button class="text-button" data-action="action-view" data-view="menu">← 행동 목록</button>
      <p class="eyebrow">유지</p><h2>이번엔 그대로 둘까요?</h2>
      <div class="preview-box"><p>구성을 유지한 채 이번 턴 시장 수익률만 반영합니다.</p></div>
      <button class="primary jumbo" data-action="do-hold">그대로 두고 정산</button>`;
  }

  private renderPortfolioModal(): string {
    if (!this.game) return '';
    const total = portfolioValue(this.game);
    const rows = products.map((product) => {
      const amount = this.game!.holdings.find((holding) => holding.productId === product.id)?.amount ?? 0;
      const ret = this.game!.lastMarket.returns[product.id];
      return `<tr><td><span class="risk-symbol ${product.risk_asset_ratio > 0 ? 'risky' : 'safe'}">${product.risk_asset_ratio > 0 ? '▲' : '●'}</span>${product.shortName}<small>${product.riskLabel}</small></td><td>${formatShortWon(amount)}</td><td>${total ? percent(amount / total) : '0%'}</td><td class="${ret < 0 ? 'neg' : ''}">${signedPercent(ret)}</td></tr>`;
    }).join('');
    const orders = this.game.pendingOrders.length ? this.game.pendingOrders.map((order) => `<li>${order.side === 'buy' ? '매수' : '환매'} · ${products.find((item) => item.id === order.productId)?.shortName} · ${order.stage === 'received' ? '주문 접수' : '기준가 확정'} → ${order.settlesTurn}턴 반영</li>`).join('') : '<li>대기 주문 없음</li>';
    return `<p class="eyebrow">포트폴리오</p><h2>${formatWon(total)}</h2><p>위험자산 ${percent(riskAssetRatio(this.game))} · IRP 대기자금 ${formatWon(this.game.irpCash)}</p><div class="table-wrap"><table><thead><tr><th>상품</th><th>평가액</th><th>비중</th><th>이번 턴</th></tr></thead><tbody>${rows}</tbody></table></div><h3>주문 처리</h3><ul class="order-list">${orders}</ul>`;
  }

  private renderMarketModal(): string {
    const currentTurn = this.game?.turn || 1;
    return `<p class="eyebrow">시장 흐름 · 금리의 두 얼굴</p><h2>12턴 타임라인</h2><div class="timeline">${marketScenario.map((step) => `<div class="${step.turn === currentTurn ? 'current' : step.turn < currentTurn ? 'past' : ''}${step.shock ? ' shock' : ''}"><span>${step.turn}</span><p><strong>${step.phase}${step.shock ? ' · 충격' : ''}</strong>${step.headline}<small>${step.signal}</small></p></div>`).join('')}</div><div class="why-box"><strong>교육용 단순화</strong><p>실제 시장은 여러 요인이 동시에 작용합니다. 이 흐름은 전망이나 투자 권유가 아니라 금리·채권 관계를 체험하기 위한 가정입니다.</p></div>`;
  }

  private renderCardsModal(): string {
    const unlocked = new Set(this.save.unlockedCards);
    return `<p class="eyebrow">학습 카드 도감</p><h2>${unlocked.size} / ${learningCards.length} 발견</h2><div class="card-library">${learningCards.map((card) => unlocked.has(card.id) ? `<article><span>${card.category}</span><h3>${card.title}</h3><p>${card.key}</p><details><summary>쉬운 설명</summary><p>${card.detail}</p></details></article>` : `<article class="locked"><span>미발견</span><h3>?</h3><p>관련 시장 국면과 행동에서 열립니다.</p></article>`).join('')}</div>`;
  }

  private renderSettingsModal(): string {
    return `<p class="eyebrow">설정 · 면책 · 출처</p><h2>교육용 게임 안내</h2>
      <label class="setting-row" for="reduced-motion"><span><strong>동작 줄이기</strong><small>전환 애니메이션을 즉시 표시합니다.</small></span><input id="reduced-motion" type="checkbox" ${this.save.settings.reducedMotion ? 'checked' : ''}></label>
      <div class="button-stack compact">
        <button class="secondary" data-action="open-diagnosis">성향 다시 진단</button>
        <button class="secondary" data-action="open-goal">월 연금 목표 바꾸기</button>
      </div>
      <div class="disclaimer-box"><strong>중요 면책</strong><p>모든 금융 수치는 교육용으로 단순화했습니다. 특정 금융회사·상품을 추천하지 않으며, 수익·원금·세제 혜택을 보장하지 않습니다. 실제 규정과 세무 결과는 개인 상황과 기준일에 따라 달라질 수 있습니다. 은행 계좌·잔고와 연동되지 않는 가상 포트폴리오입니다.</p></div>
      <h3>정책 데이터</h3><p>기준일 ${policyRules.reviewed_at} · 교육용 단순화 ${policyRules.simplified ? '예' : '아니오'}</p>
      <ul class="source-list"><li><a href="${policyRules.source_urls[0]}" target="_blank" rel="noreferrer">금융감독원 · 위험자산별 투자한도</a></li><li><a href="${policyRules.source_urls[1]}" target="_blank" rel="noreferrer">금융감독원 · 퇴직연금 세제—세액공제</a></li><li><a href="${policyRules.source_urls[2]}" target="_blank" rel="noreferrer">금융감독원 · 퇴직연금 세제—연금수령</a></li></ul>
      <p class="version">연금로드 v1.1 · 저장 데이터는 이 브라우저에만 보관됩니다.</p>`;
  }
}
