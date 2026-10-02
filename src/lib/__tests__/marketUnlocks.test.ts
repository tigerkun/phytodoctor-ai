import { describe, it, expect } from 'vitest';
import { marketPrivilegesFor, nextMarketUnlock, seedPriceFor, voucherCostFor } from '../marketUnlocks';
import { LEVEL_TIERS, VOUCHERS } from '../../game/REWARD_CONFIG';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The shop's side of the level ladder.
 *
 * LEVEL_TIERS has always promised marketplace privileges in its `features`
 * prose — "Marketplace unlock" at 5, "Early Market access" at 8, a permanent
 * discount at 20 — and for as long as that prose was the only encoding,
 * RewardService collected the strings into levelProgress and the market page
 * ignored them. A player could earn every tier and still pay full price.
 *
 * The `unlocks.market` field is the machine-readable half of the same promise.
 * These tests fail if the two halves drift apart, which is exactly how the
 * prose-only version died.
 */

describe('marketPrivilegesFor', () => {
  it('keeps the stalls shut below the marketplace tier', () => {
    const locked = marketPrivilegesFor(1);
    expect(locked.shopUnlocked).toBe(false);
    expect(locked.vouchersUnlocked).toBe(false);
    expect(locked.discountPct).toBe(0);
    expect(locked.earlyAccessHours).toBe(0);
  });

  it('opens the shop and the vouchers at the tiers that promise them', () => {
    expect(marketPrivilegesFor(4).shopUnlocked).toBe(false);
    expect(marketPrivilegesFor(5).shopUnlocked).toBe(true);
    expect(marketPrivilegesFor(5).vouchersUnlocked).toBe(true);
  });

  it('grants early access in hours, not as a boolean', () => {
    expect(marketPrivilegesFor(7).earlyAccessHours).toBe(0);
    expect(marketPrivilegesFor(8).earlyAccessHours).toBe(12);
  });

  it('folds every tier cumulatively', () => {
    // A level-20 keeper has everything granted from 5 upward, matching how
    // getUnlockedFeatures and the multipliers fold.
    const p = marketPrivilegesFor(20);
    expect(p).toMatchObject({
      shopUnlocked: true,
      vouchersUnlocked: true,
      earlyAccessHours: 12,
      freeShippingVouchers: true,
      voucherExchangeBonusPct: 10,
      legendaryDrops: true,
      discountPct: 5,
    });
  });
});

describe('tier prose and machine unlocks agree', () => {
  // The exact `market` shape each prose phrase must be paired with. Reading
  // the phrase, not just the tier, so a rebalance that rewrites the copy has
  // to come here and decide what it means for the shop.
  const PROMISES: { phrase: RegExp; satisfied: (m: { shop?: boolean; voucherExchangeBonusPct?: number; legendaryDrops?: boolean; discountPct?: number } | undefined) => boolean }[] = [
    { phrase: /Marketplace unlock/i, satisfied: (m) => m?.shop === true },
    { phrase: /Seed-to-Voucher exchange/i, satisfied: (m) => Number(m?.voucherExchangeBonusPct ?? 0) > 0 },
    { phrase: /Legendary market drop access/i, satisfied: (m) => m?.legendaryDrops === true },
    { phrase: /permanent marketplace discount/i, satisfied: (m) => Number(m?.discountPct ?? 0) > 0 },
  ];

  it('every marketplace promise in the prose is encoded in `market`', () => {
    for (const tier of LEVEL_TIERS) {
      for (const feature of tier.unlocks.features ?? []) {
        for (const { phrase, satisfied } of PROMISES) {
          if (phrase.test(feature)) {
            expect(
              satisfied(tier.unlocks.market),
              `"${feature}" at level ${tier.level} has no matching unlocks.market encoding`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('no market encoding exists without its prose', () => {
    // The reverse direction: a `market` flag with no rulebook copy is a
    // privilege players hold but can never discover.
    for (const tier of LEVEL_TIERS) {
      const m = tier.unlocks.market;
      if (!m) continue;
      const prose = (tier.unlocks.features ?? []).join(' ');
      if (m.shop) expect(prose, `level ${tier.level}`).toMatch(/Marketplace unlock/i);
      if (m.earlyAccessHours) expect(prose, `level ${tier.level}`).toMatch(/Early Market access/i);
      if (m.legendaryDrops) expect(prose, `level ${tier.level}`).toMatch(/Legendary market drop access/i);
      if (m.discountPct) expect(prose, `level ${tier.level}`).toMatch(/marketplace discount/i);
      if (m.voucherExchangeBonusPct) expect(prose, `level ${tier.level}`).toMatch(/Voucher exchange/i);
    }
  });
});

describe('nextMarketUnlock', () => {
  it('points at the next tier that changes the shop', () => {
    expect(nextMarketUnlock(3)).toMatchObject({ level: 5 });
    expect(nextMarketUnlock(5)).toMatchObject({ level: 8 });
    expect(nextMarketUnlock(8)).toMatchObject({ level: 10 });
  });

  it('is null once the ladder is finished', () => {
    expect(nextMarketUnlock(25)).toBeNull();
  });
});

describe('seedPriceFor and voucherCostFor', () => {
  it('leave prices alone until the discount tiers', () => {
    expect(seedPriceFor(2694, 19)).toBe(2694);
    expect(voucherCostFor(500, 16)).toBe(500);
  });

  it('apply the standing discount exactly', () => {
    // The L20 promise is "+5% permanent marketplace discount" on seed prices.
    expect(seedPriceFor(2694, 20)).toBe(2559);
    // The L17 promise is "+10% Seed-to-Voucher exchange" — the same voucher
    // for 10% fewer seeds.
    expect(voucherCostFor(500, 17)).toBe(450);
  });

  it('never round a discounted price upward past the base', () => {
    for (const base of [774, 1674, 2694, 5394, 15000]) {
      expect(seedPriceFor(base, 20)).toBeLessThanOrEqual(base);
      expect(voucherCostFor(base, 17)).toBeLessThanOrEqual(base);
    }
  });
});

describe('the vouchers are a single source of truth', () => {
  const market = readFileSync(join(process.cwd(), 'src/pages/Market.tsx'), 'utf8');

  it('the market imports VOUCHERS rather than keeping its own copy', () => {
    expect(market).toContain("from '../game/REWARD_CONFIG'");
    expect(market).toMatch(/import\s*\{[^}]*VOUCHERS[^}]*\}\s*from\s*'\.\.\/game\/REWARD_CONFIG'/);
  });

  it('no rival price table exists in the market page', () => {
    // The drift that made this test exist: the market's private copy quoted
    // 300 seeds for a ticket the rulebook priced at 500, and 900 for one
    // priced at 1500 — one voucher, two prices, depending on the screen.
    expect(market).not.toMatch(/MOCK_VOUCHERS/);
    expect(market).not.toMatch(/seedCost:\s*(300|900)\b/);
  });

  it('the rulebook and the shop render the same array', () => {
    const rulebook = readFileSync(join(process.cwd(), 'src/components/game/RuleBook.tsx'), 'utf8');
    expect(rulebook).toMatch(/VOUCHERS\.map/);
    expect(market).toMatch(/TICKETS_FOR_SALE/);
  });

  it('every voucher has the display fields the ticket tab needs', () => {
    for (const v of VOUCHERS) {
      expect(v.title, `${v.id} has no ticket title`).toBeTruthy();
      expect(v.expiryDays, `${v.id} has no expiry`).toBeGreaterThan(0);
      expect(v.seedCost, `${v.id} has no seed cost`).toBeGreaterThan(0);
      expect(v.realValue, `${v.id} has no rupee value`).toBeGreaterThan(0);
    }
  });

  it('free-shipping vouchers are gated at the free-shipping tier', () => {
    // "Free shipping vouchers" is the level-10 unlock; a shipping voucher
    // priced below that tier would promise the ladder backwards.
    for (const v of VOUCHERS.filter(x => x.freeShipping)) {
      expect(v.requiredLevel, `${v.title} ships free but has no level gate`).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('the market page acts on the privileges', () => {
  function stripJsComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }
  const market = stripJsComments(readFileSync(join(process.cwd(), 'src/pages/Market.tsx'), 'utf8'));
  const checkout = stripJsComments(readFileSync(join(process.cwd(), 'src/components/market/CheckoutSummary.tsx'), 'utf8'));

  it('gates the stalls on the resolver, not a hardcoded level', () => {
    expect(market).toContain('marketPrivilegesFor(level)');
    expect(market).toMatch(/privileges\.shopUnlocked/);
  });

  it('drives the daily rotation from the early-access day number', () => {
    // The rotation was memoized with `[]` deps — a page left open across
    // midnight kept selling yesterday's floor, and there was no early access
    // at all. Both ride on `stallDay` now.
    expect(market).toMatch(/stallDay/);
    expect(market).toMatch(/\[pricedProducts,\s*stallDay\]/);
  });

  it('charges seed prices through the tier discount', () => {
    expect(market).toContain('seedPriceFor(p.seedPrice, level)');
  });

  it('computes cart totals with the shared helpers on both sides', () => {
    // The basket sidebar and the checkout handler each had their own total;
    // the handler's refund was still the pre-rebalance seeds÷200 rate, paying
    // about a quarter of what every single-item claim paid.
    expect(market).toContain('lineSeedCost(item.seedPrice, item.qty)');
    expect(market).toContain('lineRefundRupees(item.cashPrice, item.qty)');
    expect(checkout).toContain('lineSeedCost(item.seedCost, item.quantity)');
    expect(checkout).toContain('lineRefundRupees(item.price, item.quantity)');
    const staleFormula = /\)\s*\/\s*200\b/;
    expect(market.match(staleFormula), 'stale seeds÷200 refund in Market.tsx').toBeNull();
    expect(checkout.match(staleFormula), 'stale seeds÷200 refund in CheckoutSummary').toBeNull();
  });

  it('shows the ladder where the spending happens', () => {
    expect(market).toContain('<TierLadderStrip');
    expect(market).toContain('<MarketPulse');
    expect(market).toContain('<StallLock');
  });
});
