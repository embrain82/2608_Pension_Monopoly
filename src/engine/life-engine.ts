import { balanceConfig, lifeEvents, policyRules, products } from '../data/content';
import type { ActionResult, GameState, LifeChoice, LifeChoiceOption, LifeEvent, LifeResolution } from '../types';
import { liquidateForLivingCost, portfolioValue } from './portfolio-engine';
import { contributionCredit } from './policy-engine';

const won = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

export const LIFE_CHOICE_LABELS: Record<LifeChoice, string> = {
  cash: '생활자금으로 해결',
  deposit: '예금 중도해지로 해결',
  withdraw: 'IRP 중도인출',
  'contribute-all': '전액 IRP 납입',
  'contribute-half': '절반 납입 · 절반 생활자금',
  'transfer-irp': 'IRP로 이전'
};

/** 사건 종류별 `cash` 선택지 이름. 뜻은 늘 "IRP는 그대로, 생활자금 쪽으로" */
export const CASH_CHOICE_LABELS: Record<LifeEvent['kind'], string> = {
  cost: '생활자금으로 해결',
  bonus: '생활자금으로 두기',
  transfer: '지금 받기(일시 수령)'
};

function depositHolding(state: GameState) {
  return state.holdings.find((holding) => holding.productId === 'deposit');
}

function depositEarly(state: GameState): boolean {
  const holding = depositHolding(state);
  return Boolean(holding) && holding!.depositTurnsHeld < balanceConfig.depositMaturityTurns;
}

/** 예금으로 비용을 낼 때 깨야 하는 총액과 불이익. 잔고가 모자라면 잔고 전부 */
function depositBreakPlan(state: GameState, need: number): { gross: number; penalty: number; covered: number } {
  const holding = depositHolding(state);
  if (!holding || holding.amount < 100_000) return { gross: 0, penalty: 0, covered: 0 };
  const netRate = depositEarly(state) ? 1 - policyRules.earlyDepositPenaltyRate : 1;
  const gross = Math.min(holding.amount, Math.ceil(need / netRate));
  const penalty = depositEarly(state) ? gross * policyRules.earlyDepositPenaltyRate : 0;
  return { gross, penalty, covered: Math.min(need, gross - penalty) };
}

function contributionRoom(state: GameState): number {
  return Math.max(0, policyRules.annualContributionLimit - state.contributionTotal);
}

/** 선택지와 비용표. 모달이 그대로 그린다. 비활성 선택지도 이유와 함께 돌려준다 */
export function lifeChoicesFor(state: GameState, event: LifeEvent): LifeChoiceOption[] {
  const amount = Math.abs(event.cost);
  const monthly = (value: number) => won(value / policyRules.receivingMonths);
  if (event.kind === 'cost') {
    const cashAfter = state.cash - amount;
    const cashLine = state.cash >= amount
      ? `생활자금 −${won(amount)} → 남는 생활자금 ${won(cashAfter)}`
      : `생활자금 ${won(state.cash)} 전부 + 부족 ${won(amount - state.cash)}는 대기자금·보유 상품에서 자동 충당`;
    const cashLong = cashAfter < balanceConfig.safeCashThreshold
      ? `생활자금이 안정 기준선 ${won(balanceConfig.safeCashThreshold)} 아래로 내려갑니다. IRP는 그대로.`
      : 'IRP는 그대로. 월 연금 변화 없음.';
    const plan = depositBreakPlan(state, amount);
    const depositOk = plan.gross >= 100_000;
    const depositLine = depositOk
      ? `예금 ${won(plan.gross)} 해지${plan.penalty > 0 ? ` · 불이익 ${won(plan.penalty)}(${pct(policyRules.earlyDepositPenaltyRate)})` : ' · 만기 뒤라 불이익 없음'}${plan.covered < amount ? ` · 나머지 ${won(amount - plan.covered)}는 생활자금` : ''}`
      : '해지할 예금이 없습니다.';
    const withdrawal = amount * (1 + policyRules.allowedWithdrawalFeeRate);
    return [
      { id: 'cash', label: LIFE_CHOICE_LABELS.cash, enabled: true, immediate: cashLine, longTerm: cashLong },
      {
        id: 'deposit', label: LIFE_CHOICE_LABELS.deposit, enabled: depositOk, reason: depositOk ? undefined : '예금 보유가 10만원 미만입니다.',
        immediate: depositLine,
        longTerm: `IRP −${won(Math.max(plan.gross, 0))} → 월 연금 −${monthly(plan.gross)}. 예금 만기가 다시 시작됩니다.`
      },
      {
        id: 'withdraw', label: LIFE_CHOICE_LABELS.withdraw, enabled: event.eligibleWithdrawal,
        reason: event.eligibleWithdrawal ? undefined : '이 사건은 법정 중도인출 사유(교육용 2종)가 아닙니다.',
        immediate: `IRP −${won(withdrawal)} (비용 + 단순화 수수료 ${pct(policyRules.allowedWithdrawalFeeRate)})`,
        longTerm: `월 연금 −${monthly(withdrawal)}. 생활자금은 그대로.`
      }
    ];
  }
  if (event.kind === 'bonus') {
    const room = contributionRoom(state);
    const all = Math.min(amount, room);
    const half = Math.min(Math.floor(amount / 2), room);
    const creditAll = contributionCredit(state.contributionTotal, all).benefit;
    const creditHalf = contributionCredit(state.contributionTotal, half).benefit;
    return [
      {
        id: 'contribute-all', label: LIFE_CHOICE_LABELS['contribute-all'], enabled: all >= 100_000, reason: all >= 100_000 ? undefined : '연간 납입 한도가 남지 않았습니다.',
        immediate: `IRP 대기자금 +${won(all)}${all < amount ? ` (한도 밖 ${won(amount - all)}는 생활자금)` : ''} · 세액공제 ${won(creditAll)} 환급 대기`,
        longTerm: `월 연금 +${monthly(all)}. 생활자금은 늘지 않습니다.`
      },
      {
        id: 'contribute-half', label: LIFE_CHOICE_LABELS['contribute-half'], enabled: half >= 100_000, reason: half >= 100_000 ? undefined : '연간 납입 한도가 남지 않았습니다.',
        immediate: `IRP +${won(half)} · 생활자금 +${won(amount - half)} · 세액공제 ${won(creditHalf)} 환급 대기`,
        longTerm: `월 연금 +${monthly(half)}. 비상자금도 조금 늘어납니다.`
      },
      { id: 'cash', label: CASH_CHOICE_LABELS.bonus, enabled: true, immediate: `생활자금 +${won(amount)}`, longTerm: 'IRP·월 연금 변화 없음. 다음 턴에 납입할 수 있습니다.' }
    ];
  }
  const tax = amount * policyRules.lumpSumTaxRate;
  return [
    {
      id: 'transfer-irp', label: LIFE_CHOICE_LABELS['transfer-irp'], enabled: true,
      immediate: `IRP 대기자금 +${won(amount)} · 세금 없음(과세 이연)`,
      longTerm: `월 연금 +${monthly(amount)}. 대기자금은 매수나 디폴트옵션으로 운용됩니다. 납입 한도와 무관.`
    },
    {
      id: 'cash', label: CASH_CHOICE_LABELS.transfer, enabled: true,
      immediate: `교육용 기타소득세 ${pct(policyRules.lumpSumTaxRate)} ${won(tax)} 차감 → 생활자금 +${won(amount - tax)}`,
      longTerm: '연금 재원이 늘지 않습니다. 생활자금이 넉넉해지지만 세금은 돌아오지 않습니다.'
    }
  ];
}

function alternativeLine(options: LifeChoiceOption[], chosen: LifeChoice): string {
  const others = options.filter((option) => option.id !== chosen && option.enabled);
  if (others.length === 0) return '';
  return `다른 선택이었다면: ${others.map((option) => `${option.label} — ${option.immediate}`).join(' / ')}`;
}

function resolutionBase(event: LifeEvent, choice: LifeChoice, options: LifeChoiceOption[]): Pick<LifeResolution, 'eventId' | 'title' | 'kind' | 'choice' | 'choiceLabel' | 'cost' | 'alternative'> {
  return {
    eventId: event.id,
    title: event.title,
    kind: event.kind,
    choice,
    choiceLabel: options.find((option) => option.id === choice)?.label ?? LIFE_CHOICE_LABELS[choice],
    cost: event.cost,
    alternative: alternativeLine(options, choice)
  };
}

function unlockCard(state: GameState, cardId: string): GameState {
  return state.unlockedCards.includes(cardId) ? state : { ...state, unlockedCards: [...state.unlockedCards, cardId] };
}

function reduceIrpProportionally(state: GameState, amount: number): GameState {
  const total = portfolioValue(state);
  if (total <= 0) return state;
  const requested = Math.min(total, amount);
  const fromCash = Math.min(state.irpCash, requested);
  const remaining = requested - fromCash;
  const holdingsTotal = state.holdings.reduce((sum, holding) => sum + holding.amount, 0);
  const factor = holdingsTotal <= 0 ? 1 : Math.max(0, (holdingsTotal - remaining) / holdingsTotal);
  return { ...state, irpCash: state.irpCash - fromCash, holdings: state.holdings.map((holding) => ({ ...holding, amount: holding.amount * factor })) };
}

function finish(state: GameState, event: LifeEvent, resolution: LifeResolution, extraCard?: string): ActionResult {
  let next: GameState = {
    ...state,
    currentEventId: null,
    awaitingAction: true,
    lifeResolution: resolution,
    logs: [...state.logs, { turn: state.turn, type: 'life', message: `${event.title}: ${resolution.message}`, impact: -event.cost }]
  };
  next = unlockCard(next, event.learningCardId);
  if (extraCard) next = unlockCard(next, extraCard);
  return { ok: true, message: resolution.message, state: next };
}

/** 생활사건 선택 실행. 선택지가 사건 종류·상태에 맞지 않으면 거절한다 */
export function resolveLifeChoice(state: GameState, choice: LifeChoice): ActionResult {
  const event = lifeEvents.find((item) => item.id === state.currentEventId);
  if (!event) return { ok: false, message: '해결할 생활사건이 없습니다.', state };
  const options = lifeChoicesFor(state, event);
  const option = options.find((item) => item.id === choice);
  if (!option) return { ok: false, message: '이 사건에서 고를 수 없는 선택입니다.', state };
  if (!option.enabled) return { ok: false, message: option.reason ?? '지금은 고를 수 없는 선택입니다.', state };
  const amount = Math.abs(event.cost);
  const irpBefore = portfolioValue(state);
  const base = resolutionBase(event, choice, options);

  if (event.kind === 'cost') {
    if (choice === 'withdraw') {
      const withdrawal = amount * (1 + policyRules.allowedWithdrawalFeeRate);
      const next = reduceIrpProportionally(state, withdrawal);
      const message = `허용 사유를 가정해 IRP에서 비용과 단순화 수수료 ${won(amount * policyRules.allowedWithdrawalFeeRate)}를 인출했습니다.`;
      return finish(next, event, { ...base, cashDelta: 0, irpDelta: portfolioValue(next) - irpBefore, penalty: 0, fee: amount * policyRules.allowedWithdrawalFeeRate, sales: [], shortage: false, message });
    }
    if (choice === 'deposit') {
      const plan = depositBreakPlan(state, amount);
      const holdings = state.holdings.map((holding) => holding.productId === 'deposit' ? { ...holding, amount: holding.amount - plan.gross } : holding);
      const net = plan.gross - plan.penalty;
      const leftover = Math.max(0, amount - net);
      // ceil로 잡은 해지액이 비용을 1원 미만 넘칠 수 있어 원 단위 아래는 버린다
      const surplus = Math.max(0, Math.floor(net - amount));
      const fromCash = Math.min(state.cash, leftover);
      let next: GameState = { ...state, holdings, cash: state.cash + surplus - fromCash };
      let remaining = leftover - fromCash;
      let sales: LifeResolution['sales'] = [{ productId: 'deposit', amount: plan.gross, penalty: plan.penalty }];
      if (remaining > 0) {
        const covered = liquidateForLivingCost(next, remaining);
        next = covered.state;
        remaining = covered.remaining;
        sales = [...sales, ...covered.sales];
      }
      const shortage = remaining > 0;
      next = { ...next, cashShortages: next.cashShortages + (shortage ? 1 : 0) };
      const message = `${plan.penalty > 0 ? `예금 ${won(plan.gross)}을 만기 전에 해지해 불이익 ${won(plan.penalty)}를 물고` : `만기 지난 예금 ${won(plan.gross)}을 해지해`} 비용을 냈습니다.${fromCash > 0 ? ` 나머지 ${won(fromCash)}는 생활자금.` : ''}${shortage ? ' 그래도 모자라 부족 횟수가 올랐습니다.' : ''}`;
      return finish(next, event, { ...base, cashDelta: next.cash - state.cash, irpDelta: portfolioValue(next) - irpBefore, penalty: plan.penalty, fee: 0, sales, shortage, message }, 'deposit-rate');
    }
    // cash: 예전 규칙 그대로 — 생활자금 → 대기자금 → 보유 상품 자동 충당
    const fromCash = Math.min(state.cash, amount);
    let remaining = amount - fromCash;
    let next: GameState = { ...state, cash: state.cash - fromCash };
    let sales: LifeResolution['sales'] = [];
    let message = '';
    const usedIrpOrHoldings = remaining > 0;
    if (remaining > 0) {
      const covered = liquidateForLivingCost(next, remaining);
      next = covered.state;
      remaining = covered.remaining;
      sales = covered.sales;
      if (covered.sales.length) {
        const sold = covered.sales.map((sale) => `${products.find((item) => item.id === sale.productId)?.shortName ?? sale.productId} ${won(sale.amount)}`).join(', ');
        message = remaining > 0
          ? '보유 상품을 매도해도 생활자금이 부족해 비용과 안정성 점수에 영향이 생겼습니다.'
          : `생활자금이 부족해 ${sold}을 매도해 비용을 지급했습니다.`;
      } else if (covered.usedIrpCash > 0 && remaining <= 0) {
        message = '생활자금이 부족해 IRP 대기자금으로 비용을 지급했습니다.';
      }
    }
    if (!message) message = remaining > 0 ? '생활자금이 부족해 비용과 안정성 점수에 영향이 생겼습니다.' : '생활자금으로 해결해 IRP를 지켰습니다.';
    const shortage = remaining > 0;
    next = { ...next, cashShortages: next.cashShortages + (shortage ? 1 : 0), safeActionCount: next.safeActionCount + (!shortage && !usedIrpOrHoldings ? 1 : 0) };
    return finish(next, event, { ...base, cashDelta: next.cash - state.cash, irpDelta: portfolioValue(next) - irpBefore, penalty: sales.reduce((sum, sale) => sum + sale.penalty, 0), fee: 0, sales, shortage, message });
  }

  if (event.kind === 'bonus') {
    if (choice === 'cash') {
      const next: GameState = { ...state, cash: state.cash + amount };
      return finish(next, event, { ...base, cashDelta: amount, irpDelta: 0, penalty: 0, fee: 0, sales: [], shortage: false, message: '보너스를 생활자금에 반영했습니다.' });
    }
    const room = contributionRoom(state);
    const wanted = choice === 'contribute-all' ? amount : Math.floor(amount / 2);
    const accepted = Math.min(wanted, room);
    const credit = contributionCredit(state.contributionTotal, accepted);
    const next: GameState = {
      ...state,
      cash: state.cash + (amount - accepted),
      irpCash: state.irpCash + accepted,
      contributionTotal: state.contributionTotal + accepted,
      taxCreditEligible: state.taxCreditEligible + credit.eligible,
      taxCreditBenefit: state.taxCreditBenefit + credit.benefit,
      pendingTaxCredit: state.pendingTaxCredit + credit.benefit,
      understandingPoints: state.understandingPoints + 1
    };
    const message = `보너스 ${won(accepted)}을 IRP에 납입했습니다${amount - accepted > 0 ? ` (나머지 ${won(amount - accepted)}는 생활자금)` : ''}. 세액공제 ${won(credit.benefit)}은 연말정산 칸을 지날 때 돌아옵니다.`;
    return finish(next, event, { ...base, cashDelta: amount - accepted, irpDelta: accepted, penalty: 0, fee: 0, sales: [], shortage: false, message }, 'tax-credit');
  }

  // transfer
  if (choice === 'transfer-irp') {
    const next: GameState = { ...state, irpCash: state.irpCash + amount, understandingPoints: state.understandingPoints + 1 };
    return finish(next, event, { ...base, cashDelta: 0, irpDelta: amount, penalty: 0, fee: 0, sales: [], shortage: false, message: `퇴직급여 ${won(amount)}을 IRP 대기자금으로 옮겼습니다. 세금은 수령 때까지 미뤄집니다.` }, 'default-option');
  }
  const tax = amount * policyRules.lumpSumTaxRate;
  const next: GameState = { ...state, cash: state.cash + amount - tax };
  return finish(next, event, { ...base, cashDelta: amount - tax, irpDelta: 0, penalty: 0, fee: tax, sales: [], shortage: false, message: `퇴직급여를 지금 받아 교육용 세금 ${won(tax)}를 뗀 ${won(amount - tax)}이 생활자금이 됐습니다.` });
}
