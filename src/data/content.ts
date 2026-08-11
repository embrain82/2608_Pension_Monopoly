import productsJson from './products.json';
import marketJson from './market-scenarios.json';
import lifeJson from './life-events.json';
import policyJson from './policy-rules.json';
import learningJson from './learning-cards.json';
import profilesJson from './investor-profiles.json';
import balanceJson from './balance-config.json';
import type { BalanceConfig, BoardTile, InvestorProfile, LearningCard, LifeEvent, MarketStep, PolicyRules, Product } from '../types';

export const products = productsJson as Product[];
export const marketScenario = marketJson as MarketStep[];
export const lifeEvents = lifeJson as LifeEvent[];
export const policyRules = policyJson as PolicyRules;
export const learningCards = learningJson as LearningCard[];
export const investorProfiles = profilesJson as InvestorProfile[];
export const balanceConfig = balanceJson as BalanceConfig;

const tileKinds: Array<Omit<BoardTile, 'index'>> = [
  { kind: 'start', label: '연말정산' },
  { kind: 'product', label: '예금 거리' },
  { kind: 'market', label: '시장 뉴스' },
  { kind: 'product', label: '단기채 거리' },
  { kind: 'life', label: '생활 사건' },
  { kind: 'trade', label: '운용지시' },
  { kind: 'product', label: '장기채 거리' },
  { kind: 'policy', label: '제도 안내' },
  { kind: 'product', label: '혼합형 거리' },
  { kind: 'market', label: '시장 뉴스' },
  { kind: 'rebalance', label: '리밸런싱' },
  { kind: 'product', label: 'ETF 거리' },
  { kind: 'outlook', label: '은퇴 전망대' },
  { kind: 'product', label: 'TDF 거리' },
  { kind: 'market', label: '시장 뉴스' },
  { kind: 'life', label: '생활 사건' },
  { kind: 'trade', label: '운용지시' },
  { kind: 'product', label: '분산 광장' },
  { kind: 'policy', label: '제도 안내' },
  { kind: 'product', label: '금리 전망길' },
  { kind: 'profile', label: '성향 점검' },
  { kind: 'market', label: '시장 뉴스' },
  { kind: 'life', label: '생활 사건' },
  { kind: 'rebalance', label: '리밸런싱' }
];

export const boardTiles: BoardTile[] = tileKinds.map((tile, index) => ({ ...tile, index }));

export function validateContent(): void {
  if (products.length !== 6 || marketScenario.length !== 12 || boardTiles.length !== 24) {
    throw new Error('필수 콘텐츠 수가 올바르지 않습니다.');
  }
  if (marketScenario.length + lifeEvents.length + learningCards.length < 30) {
    throw new Error('콘텐츠 항목은 최소 30개여야 합니다.');
  }
}
