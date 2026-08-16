export type ProductId = 'deposit' | 'shortBond' | 'longBond' | 'balanced' | 'equityEtf' | 'tdf';
export type ProductKind = 'deposit' | 'fund' | 'etf';
export type TileKind = 'start' | 'product' | 'market' | 'life' | 'trade' | 'rebalance' | 'policy' | 'profile' | 'outlook';
export type Trend = 'up' | 'down' | 'flat';
export type ProfileId = 'stable' | 'stableGrowth' | 'balanced' | 'growth' | 'aggressive';

export interface Product {
  id: ProductId;
  name: string;
  shortName: string;
  kind: ProductKind;
  description: string;
  legal_classification: string;
  risk_asset_ratio: number;
  principal_guaranteed: boolean;
  tdf_exception_eligible: boolean;
  classification_reviewed_at: string;
  source_url: string;
  duration: number;
  feeRate: number;
  riskLabel: string;
}

export interface MarketStep {
  turn: number;
  phase: string;
  headline: string;
  signal: string;
  reason: string;
  rate: number;
  inflation: number;
  stocks: number;
  returns: Record<ProductId, number>;
  shock?: boolean;
}

export interface LifeEvent {
  id: string;
  title: string;
  body: string;
  cost: number;
  eligibleWithdrawal: boolean;
  learningCardId: string;
}

export interface LearningCard {
  id: string;
  category: '시장' | '상품' | '제도' | '운용';
  title: string;
  key: string;
  detail: string;
  source_url: string;
  reviewed_at: string;
  simplified: boolean;
}

export interface PolicyRules {
  reviewed_at: string;
  source_urls: string[];
  simplified: boolean;
  riskAssetLimit: number;
  tdfAdjustedRiskRatio: number;
  annualContributionLimit: number;
  annualTaxCreditLimit: number;
  taxCreditRate: number;
  earlyDepositPenaltyRate: number;
  allowedWithdrawalFeeRate: number;
  receivingMonths: number;
}

export interface BalanceConfig {
  maxTurns: number;
  boardSize: number;
  startingIrp: number;
  startingCash: number;
  salarySurplusPerTurn: number;
  defaultGoal: number;
  minGoal: number;
  maxGoal: number;
  contributionAmount: number;
  tradeAmount: number;
  safeCashThreshold: number;
  diversificationMin: number;
  maxDrawdownThreshold: number;
  depositMaturityTurns: number;
  defaultAllocation: Record<ProductId, number>;
  rebalanceAllocation: Record<ProductId, number>;
}

export interface InvestorProfile {
  id: ProfileId;
  name: string;
  minScore: number;
  maxScore: number;
  expectedRiskRatio: number;
  maxDrawdown: number;
  description: string;
}

export interface BoardTile {
  index: number;
  kind: TileKind;
  label: string;
}

export interface Holding {
  productId: ProductId;
  amount: number;
  principal: number;
  depositTurnsHeld: number;
}

export interface PendingOrder {
  id: string;
  side: 'buy' | 'sell';
  productId: ProductId;
  amount: number;
  submittedTurn: number;
  settlesTurn: number;
  stage: 'received' | 'priced';
  targetProductId?: ProductId;
}

export type ActionKind = 'contribute' | 'buy' | 'sell' | 'switch' | 'rebalance' | 'hold';

export interface GameLog {
  turn: number;
  type: string;
  message: string;
  impact?: number;
}

export interface GameState {
  seed: string;
  rngState: number;
  status: 'playing' | 'finished';
  turn: number;
  position: number;
  phase: string;
  goalMonthly: number;
  profileId: ProfileId;
  cash: number;
  irpCash: number;
  holdings: Holding[];
  pendingOrders: PendingOrder[];
  contributionTotal: number;
  taxCreditEligible: number;
  taxCreditBenefit: number;
  maxIrpValue: number;
  maxDrawdown: number;
  cashShortages: number;
  ruleBreaches: number;
  marketLimitExceeded: boolean;
  understandingPoints: number;
  rebalanceCount: number;
  riskBuyCount: number;
  safeActionCount: number;
  unlockedCards: string[];
  eventHistory: string[];
  logs: GameLog[];
  lastMarket: MarketStep;
  awaitingAction: boolean;
  currentEventId: string | null;
  lifeEventSchedule: Array<{ turn: number; eventId: string }>;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  state: GameState;
  expectedRiskRatio?: number;
}

export interface ScoreResult {
  monthlyPension: number;
  goalRate: number;
  goalMet: boolean;
  irpValue: number;
  cash: number;
  riskRatio: number;
  diversification: number;
  maxDrawdown: number;
  stars: 0 | 1 | 2 | 3;
  totalScore: number;
  incomeScore: number;
  stabilityScore: number;
  knowledgeScore: number;
  behaviorProfile: ProfileId;
  profileAligned: boolean;
  bestDecision: string;
  improvement: string;
  relatedCardIds: string[];
  returnRate: number;
  investmentReturnRate: number;
}

export interface SaveData {
  version: 2;
  settings: { reducedMotion: boolean; sound: boolean };
  unlockedCards: string[];
  bestScore: number;
  lastSeed: string;
  disclaimerAccepted: boolean;
  bestReturnRate: number;
  bestGoalRate: number;
  playCount: number;
}
