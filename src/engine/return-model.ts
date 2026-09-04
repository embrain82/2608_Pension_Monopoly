import { balanceConfig, products } from '../data/content';
import type { MarketConfig, MarketShock, ProductId } from '../types';
import { clamp, triangular, type Rng } from './regime-engine';

export function rateShockReturn(productId: ProductId, rateDeltaPct: number, config: MarketConfig = balanceConfig.market): number {
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error(`알 수 없는 상품: ${productId}`);
  return -config.bondSensitivityPerPct * product.duration * rateDeltaPct;
}

export interface ReturnInputs {
  ratePct: number;
  rateDeltaPct: number;
  stockReturn: number;
  shock?: MarketShock;
}

export function productReturns(rng: Rng, input: ReturnInputs, config: MarketConfig = balanceConfig.market): Record<ProductId, number> {
  const bound = (value: number) => clamp(value, -config.returnClamp, config.returnClamp);
  let deposit = config.depositBase + input.ratePct * config.depositPerRatePct + triangular(rng, config.depositNoise);
  let shortBond = input.ratePct * config.bondCarryPerRatePct + rateShockReturn('shortBond', input.rateDeltaPct, config) + triangular(rng, config.bondNoise);
  let longBond = input.ratePct * config.bondCarryPerRatePct + rateShockReturn('longBond', input.rateDeltaPct, config) + triangular(rng, config.bondNoise * 2);
  let equityEtf = config.equityPremium + input.stockReturn + triangular(rng, config.equityNoise);

  const raw: Record<ProductId, number> = { deposit, shortBond, longBond, equityEtf, balanced: 0, tdf: 0 };
  if (input.shock) {
    for (const [productId, cap] of Object.entries(input.shock.forceMax ?? {})) raw[productId as ProductId] = Math.min(raw[productId as ProductId], cap as number);
    for (const [productId, floor] of Object.entries(input.shock.forceMin ?? {})) raw[productId as ProductId] = Math.max(raw[productId as ProductId], floor as number);
  }
  deposit = bound(raw.deposit);
  shortBond = bound(raw.shortBond);
  longBond = bound(raw.longBond);
  equityEtf = bound(raw.equityEtf);
  const balanced = bound(0.25 * shortBond + 0.25 * longBond + 0.5 * equityEtf);
  const tdf = bound(0.2 * shortBond + 0.2 * longBond + 0.45 * equityEtf + 0.15 * deposit);
  return { deposit, shortBond, longBond, balanced, equityEtf, tdf };
}
