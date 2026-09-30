import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../db/database';

/**
 * The Sanctuary is the only place seeds go anywhere, so the things worth
 * pinning are the ones that would quietly cost a Keeper their seeds:
 *
 *  1. A purchase that grants nothing (spend succeeds, effect throws).
 *  2. A purchase that grants something for free (grant succeeds, spend never
 *     ran because the Keeper was short).
 *  3. A cap that silently truncates instead of refusing.
 *
 * Plus the two effects that decide whether the shelf is worth anything at all:
 * a Long Season that doubles exactly as many payouts as it was bought for, and
 * a Rare Bloom Charm that is not wasted on a card that already clears Epic.
 */

const USER = 'sb_test-user';

/** Kept in step with SANCTUARY_DATA's boost perUnit, which is what grants it. */
const BOOST_PAYOUTS = 5;

let stock: any[] = [];
let spent: { amount: number; description: string }[] = [];
let seeds = 10_000;
let realLocalStorage: any;

beforeEach(() => {
  stock = [];
  spent = [];
  seeds = 10_000;
  realLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k: string) => (k === 'botanical_guardian_userId' ? USER : null),
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  } as any;

  vi.spyOn(db.sanctuaryStock, 'get').mockImplementation((async (key: [string, string]) =>
    stock.find(r => r.userId === key[0] && r.itemId === key[1])) as any);
  vi.spyOn(db.sanctuaryStock, 'put').mockImplementation((async (row: any) => {
    const i = stock.findIndex(r => r.userId === row.userId && r.itemId === row.itemId);
    if (i >= 0) stock[i] = { ...row }; else stock.push({ ...row });
    return `${row.userId}|${row.itemId}`;
  }) as any);
  vi.spyOn(db.sanctuaryStock, 'delete').mockImplementation((async (key: [string, string]) => {
    stock = stock.filter(r => !(r.userId === key[0] && r.itemId === key[1]));
    return 1;
  }) as any);
  vi.spyOn(db.sanctuaryStock, 'where').mockImplementation((() => ({
    equals: (userId: string) => ({
      toArray: async () => stock.filter(r => r.userId === userId),
    }),
  })) as any);

  // The profile row is not what this file is about; earnSeeds reads it for the
  // tier multiplier only.
  vi.spyOn(db.userProfile, 'get').mockImplementation((async () =>
    ({ userId: USER, seeds, tier: 'free' }) as any) as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage = realLocalStorage;
});

async function svc() {
  return (await import('../sanctuaryService')).SanctuaryService;
}

describe('Sanctuary: stock', () => {
  it('starts every item at zero', async () => {
    const SanctuaryService = await svc();
    const held = await SanctuaryService.getStock(USER);
    expect(Object.values(held).every(n => n === 0)).toBe(true);
  });

  it('grants, reads back and consumes', async () => {
    const SanctuaryService = await svc();
    await SanctuaryService.grant('freeze', USER, 2);
    expect(await SanctuaryService.getCount('freeze', USER)).toBe(2);
    expect(await SanctuaryService.consume('freeze', USER)).toBe(true);
    expect(await SanctuaryService.getCount('freeze', USER)).toBe(1);
  });

  it('reports empty rather than throwing when consumed at zero', async () => {
    const SanctuaryService = await svc();
    expect(await SanctuaryService.consume('boost', USER)).toBe(false);
  });

  it('refuses to go negative', async () => {
    const SanctuaryService = await svc();
    await SanctuaryService.grant('assess', USER, 1);
    await SanctuaryService.consume('assess', USER);
    expect(await SanctuaryService.consume('assess', USER)).toBe(false);
    expect(await SanctuaryService.getCount('assess', USER)).toBe(0);
  });
});

describe('Sanctuary: caps', () => {
  it('refuses a grant past the cap instead of truncating it', async () => {
    const SanctuaryService = await svc();
    // restore is maxHeld 1
    await SanctuaryService.grant('restore', USER, 1);
    await expect(SanctuaryService.grant('restore', USER, 1)).rejects.toThrow(/most/);
    // The refused grant must not have half-applied.
    expect(await SanctuaryService.getCount('restore', USER)).toBe(1);
  });

  it('leaves unlimited items unlimited', async () => {
    const SanctuaryService = await svc();
    // boost is maxHeld 0, so it stacks without a ceiling.
    for (let i = 0; i < 4; i++) await SanctuaryService.grant('boost', USER, 1);
    expect(await SanctuaryService.getCount('boost', USER)).toBe(4 * BOOST_PAYOUTS);
  });
});

describe('Sanctuary: purchasing', () => {
  it('spends the seeds and grants the item', async () => {
    const SanctuaryService = await svc();
    const { GameService } = await import('../gameService');
    vi.spyOn(GameService, 'spendSeeds').mockImplementation(async (amount: number, _s: any, description: string) => {
      spent.push({ amount, description });
    });

    await SanctuaryService.purchase('freeze', USER);

    expect(spent).toHaveLength(1);
    expect(spent[0].amount).toBe(400);
    expect(await SanctuaryService.getCount('freeze', USER)).toBe(1);
  });

  it('grants nothing when the Keeper cannot afford it', async () => {
    const SanctuaryService = await svc();
    const { GameService } = await import('../gameService');
    vi.spyOn(GameService, 'spendSeeds').mockRejectedValue(new Error('Insufficient seeds. You need 350 more.'));

    await expect(SanctuaryService.purchase('blessing', USER)).rejects.toThrow(/Insufficient/);
    // The important half: no item conjured out of a failed purchase.
    expect(await SanctuaryService.getCount('blessing', USER)).toBe(0);
  });

  it('refuses a purchase at the cap without spending anything', async () => {
    const SanctuaryService = await svc();
    const { GameService } = await import('../gameService');
    const spy = vi.spyOn(GameService, 'spendSeeds').mockResolvedValue(undefined as any);

    await SanctuaryService.grant('restore', USER, 1);
    await expect(SanctuaryService.purchase('restore', USER)).rejects.toThrow(/most/);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Sanctuary: effects', () => {
  it('a Long Season doubles exactly as many payouts as it was bought for', async () => {
    const SanctuaryService = await svc();
    await SanctuaryService.grant('boost', USER, 1);

    for (let i = 0; i < BOOST_PAYOUTS; i++) {
      expect(await SanctuaryService.takeBoost(USER)).toBe(2);
    }
    // Exhausted: the next payout is back to normal, and nothing throws.
    expect(await SanctuaryService.takeBoost(USER)).toBe(1);
    expect(await SanctuaryService.takeBoost(USER)).toBe(1);
  });

  it('pays out normally for a Keeper holding no season', async () => {
    const SanctuaryService = await svc();
    expect(await SanctuaryService.takeBoost(USER)).toBe(1);
  });

  it('a Rare Bloom Charm lifts a card that rolled below Epic', async () => {
    const SanctuaryService = await svc();
    await SanctuaryService.grant('blessing', USER, 1);
    expect(await SanctuaryService.useRarityBlessing('common', USER)).toBe(true);
    expect(await SanctuaryService.getCount('blessing', USER)).toBe(0);
  });

  it('does not waste a charm on a card that already clears Epic', async () => {
    const SanctuaryService = await svc();
    await SanctuaryService.grant('blessing', USER, 1);
    for (const rarity of ['epic', 'legendary', 'mythic']) {
      expect(await SanctuaryService.useRarityBlessing(rarity, USER)).toBe(false);
    }
    // Still held for the card that actually needs it.
    expect(await SanctuaryService.getCount('blessing', USER)).toBe(1);
    expect(await SanctuaryService.useRarityBlessing('uncommon', USER)).toBe(true);
  });

  it('reports an expedition only while one is held', async () => {
    const SanctuaryService = await svc();
    expect(await SanctuaryService.hasExpedition(USER)).toBe(false);
    await SanctuaryService.grant('discovery', USER, 1);
    expect(await SanctuaryService.hasExpedition(USER)).toBe(true);
    await SanctuaryService.consume('discovery', USER);
    expect(await SanctuaryService.hasExpedition(USER)).toBe(false);
  });
});

describe('Sanctuary: pricing', () => {
  it('keeps the cheapest ritual inside a first week of ordinary play', async () => {
    const { SANCTUARY_ITEMS } = await import('../../game/SANCTUARY_DATA');
    // A daily cap of 150 active seeds means ~7 days tops out near 1,050.
    const cheapest = Math.min(...SANCTUARY_ITEMS.map(i => i.seedPrice));
    expect(cheapest).toBeLessThanOrEqual(1_000);
  });

  it('prices every ritual as a distinct, non-zero amount', async () => {
    const { SANCTUARY_ITEMS } = await import('../../game/SANCTUARY_DATA');
    const prices = SANCTUARY_ITEMS.map(i => i.seedPrice);
    expect(new Set(prices).size).toBe(prices.length);
    expect(prices.every(p => p > 0)).toBe(true);
  });
});
