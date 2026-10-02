import { LEVEL_TIERS, type TierMarketUnlock } from '../game/REWARD_CONFIG';

/**
 * The shop's side of the level ladder.
 *
 * LEVEL_TIERS has promised marketplace privileges since the tiers were
 * written — "Marketplace unlock" at 5, "Early Market access" at 8, a
 * permanent discount at 20 — and RewardService has always collected those
 * strings into `levelProgress.unlockedFeatures`. Nothing on the market page
 * ever read them, so the progression system computed rewards the shop
 * ignored, and a player could reach the discount tier and still pay full
 * price for everything.
 *
 * These helpers read the same tiers, so a rebalance of LEVEL_TIERS is the
 * only place a privilege can change. There is deliberately no second copy of
 * the thresholds here to fall out of sync with the rulebook.
 */

export interface MarketPrivileges {
  /** L5 — spending on the physical stalls is open at all. */
  shopUnlocked: boolean;
  /** L5 — seed-purchased vouchers can be punched. */
  vouchersUnlocked: boolean;
  /** L8 — hours before midnight at which tomorrow's stall becomes visible. */
  earlyAccessHours: number;
  /** L10 — vouchers carrying a free-shipping claim can be punched. */
  freeShippingVouchers: boolean;
  /** L17 — percent off the seed cost of punching a voucher. */
  voucherExchangeBonusPct: number;
  /** L18 — legendary-tagged crates can be bought. */
  legendaryDrops: boolean;
  /** L20 — percent off every seed price in the shop. */
  discountPct: number;
}

const PRIVILEGES_BY_LEVEL: MarketPrivileges = {
  shopUnlocked: false,
  vouchersUnlocked: false,
  earlyAccessHours: 0,
  freeShippingVouchers: false,
  voucherExchangeBonusPct: 0,
  legendaryDrops: false,
  discountPct: 0,
};

/** Fold every tier at or below `level` into one privilege set. Tiers grant
 *  cumulatively, matching how `getUnlockedFeatures` and the multipliers fold. */
export function marketPrivilegesFor(level: number): MarketPrivileges {
  const out: MarketPrivileges = { ...PRIVILEGES_BY_LEVEL };
  for (const tier of LEVEL_TIERS) {
    if (tier.level > level) break;
    const market: TierMarketUnlock | undefined = tier.unlocks.market;
    if (!market) continue;
    if (market.shop) out.shopUnlocked = true;
    if (market.vouchers) out.vouchersUnlocked = true;
    if (market.earlyAccessHours) out.earlyAccessHours = market.earlyAccessHours;
    if (market.freeShippingVouchers) out.freeShippingVouchers = true;
    if (market.voucherExchangeBonusPct) out.voucherExchangeBonusPct = market.voucherExchangeBonusPct;
    if (market.legendaryDrops) out.legendaryDrops = true;
    if (market.discountPct) out.discountPct = market.discountPct;
  }
  return out;
}

/** The next tier that would change a market privilege, or null at 25.
 *
 *  The lock panel needs to say what the player is working towards — "2 more
 *  levels" reads far better than a bare padlock — and it needs to read it
 *  from the same data the lock came from. */
export function nextMarketUnlock(level: number): { level: number; feature: string } | null {
  for (const tier of LEVEL_TIERS) {
    if (tier.level <= level) continue;
    if (tier.unlocks.market) {
      return { level: tier.level, feature: tier.unlocks.features?.[0] ?? tier.title };
    }
  }
  return null;
}

/** The seed price a player actually pays, after the L20 standing discount.
 *
 *  Cash prices are deliberately untouched: the rupee side belongs to Amazon,
 *  and a level discount on someone else's checkout would be a lie. */
export function seedPriceFor(baseSeedPrice: number, level: number): number {
  const { discountPct } = marketPrivilegesFor(level);
  if (discountPct <= 0) return baseSeedPrice;
  return Math.round(baseSeedPrice * (1 - discountPct / 100));
}

/** The seed cost of punching a voucher, after the L17 exchange bonus. */
export function voucherCostFor(baseSeedCost: number, level: number): number {
  const { voucherExchangeBonusPct } = marketPrivilegesFor(level);
  if (voucherExchangeBonusPct <= 0) return baseSeedCost;
  return Math.round(baseSeedCost * (1 - voucherExchangeBonusPct / 100));
}
