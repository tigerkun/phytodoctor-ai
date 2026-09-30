/**
 * SANCTUARY SERVICE
 *
 * The seed sink. Every item here maps to a system that already exists, so a
 * purchase has a real effect somewhere else in the app rather than sitting in
 * an inventory. The grant is deliberately two-step -- `purchase` spends the
 * seeds, then `grant` applies the effect -- because a spend that succeeds and
 * an effect that throws must not leave seeds gone and nothing delivered.
 *
 * Stock lives in its own Dexie table rather than on `userProfile`, because
 * `pullServerProfile` overwrites `userProfile` wholesale from the server on
 * every sync and would silently zero a Keeper's holdings. The seeds still go
 * through the server-authoritative ledger, so the balance is always right even
 * though the stock of a bonus does not travel between devices.
 */

import { db } from '../db/database';
import { GameService } from './gameService';
import { RewardService } from './rewardService';
import { SANCTUARY_BY_ID, SANCTUARY_ITEMS, type SanctuaryItem, type SanctuaryItemId } from '../game/SANCTUARY_DATA';

/** How many payments a Long Season doubles. */
export const BOOST_PAYOUTS = 5;

export class SanctuaryService {
  static getUserId(): string {
    return localStorage.getItem('botanical_guardian_userId') || 'local_user';
  }

  static catalogue(): SanctuaryItem[] {
    return SANCTUARY_ITEMS;
  }

  // ============ STOCK ============

  static async getStock(userId: string = this.getUserId()): Promise<Record<SanctuaryItemId, number>> {
    const rows = await db.sanctuaryStock.where('userId').equals(userId).toArray();
    const stock = {} as Record<SanctuaryItemId, number>;
    for (const item of SANCTUARY_ITEMS) stock[item.id] = 0;
    for (const row of rows) {
      if (row.itemId in stock) stock[row.itemId as SanctuaryItemId] = Math.max(0, row.count);
    }
    return stock;
  }

  static async getCount(itemId: SanctuaryItemId, userId: string = this.getUserId()): Promise<number> {
    const row = await db.sanctuaryStock.get([userId, itemId]);
    return Math.max(0, row?.count ?? 0);
  }

  private static async setCount(itemId: SanctuaryItemId, count: number, userId: string): Promise<void> {
    const clamped = Math.max(0, Math.floor(count));
    if (clamped === 0) {
      await db.sanctuaryStock.delete([userId, itemId]);
      return;
    }
    await db.sanctuaryStock.put({ userId, itemId, count: clamped, updatedAt: Date.now() });
  }

  /**
   * Adds one and returns the new count. This is the only way stock increases,
   * so a cap is enforced in exactly one place.
   *
   * `count` is in item units, not in whatever the stock row counts. A Long
   * Season is one purchase that grants five boosted payouts, so it is stored
   * as 5 and the cap on it is expressed in payouts.
   */
  static async grant(itemId: SanctuaryItemId, userId: string = this.getUserId(), count = 1): Promise<number> {
    const item = SANCTUARY_BY_ID[itemId];
    if (!item) throw new Error(`Unknown sanctuary item: ${itemId}`);
    const perUnit = item.perUnit ?? 1;
    const next = (await this.getCount(itemId, userId)) + count * perUnit;
    if (item.maxHeld > 0 && next > item.maxHeld) {
      throw new Error(`You are already holding the most of ${item.name} you can carry.`);
    }
    await this.setCount(itemId, next, userId);
    return next;
  }

  /**
   * Spends one. Returns false rather than throwing when the Keeper is empty,
   * because every caller is a "do I have one of these" branch.
   */
  static async consume(itemId: SanctuaryItemId, userId: string = this.getUserId()): Promise<boolean> {
    const current = await this.getCount(itemId, userId);
    if (current <= 0) return false;
    await this.setCount(itemId, current - 1, userId);
    return true;
  }

  /** Spends one only if the callback says the Keeper is allowed to use it. */
  static async consumeIf(itemId: SanctuaryItemId, shouldUse: () => boolean, userId: string = this.getUserId()): Promise<boolean> {
    if (!shouldUse()) return false;
    return this.consume(itemId, userId);
  }

  // ============ PURCHASING ============

  /**
   * Spends seeds for a sanctuary item and applies its effect.
   *
   * The seeds go first: `spendSeeds` refuses if the balance is short, so a
   * Keeper who cannot afford this is told exactly how many more they need and
   * nothing is granted. If the effect then throws, the error is propagated
   * rather than swallowed -- a loud failure is better than a silent charge.
   */
  static async purchase(itemId: SanctuaryItemId, userId: string = this.getUserId()): Promise<void> {
    const item = SANCTUARY_BY_ID[itemId];
    if (!item) throw new Error(`Unknown sanctuary item: ${itemId}`);

    const held = await this.getCount(itemId, userId);
    if (item.maxHeld > 0 && held >= item.maxHeld) {
      throw new Error(`You are already holding the most of ${item.name} you can carry.`);
    }

    await GameService.spendSeeds(item.seedPrice, 'spend', `Sanctuary: ${item.name}`, userId);
    await this.grant(itemId, userId, 1);
  }

  // ============ EFFECTS ============

  /**
   * The Long Season multiplier for one payout, and the decrement that goes with
   * it. Call this *instead of* multiplying by 1: the consumption has to happen
   * on exactly the same condition as the bonus, or a Keeper is charged a season
   * they never got the benefit of.
   *
   * Falls back to 1 if the stock cannot be read. This sits on `earnSeeds`,
   * which every reward in the app funnels through, so a bonus lookup that
   * throws must cost the Keeper their payout rather than the other way round.
   */
  static async takeBoost(userId: string = this.getUserId()): Promise<number> {
    try {
      if (await this.consume('boost', userId)) return 2;
      return 1;
    } catch (err) {
      console.warn('[Sanctuary] could not read Long Season stock:', err);
      return 1;
    }
  }

  /** Buys out one missed assessment, or reports that none was needed. */
  static async useAssessmentPass(userId: string = this.getUserId()): Promise<boolean> {
    return this.consume('assess', userId);
  }

  /**
   * Spends a Rare Bloom Charm when the next card would roll below Epic.
   *
   * Like `takeBoost`, a stock read that throws is treated as "no charm held"
   * rather than failing the card -- a Keeper should still get the card their
   * species earned them.
   */
  static async useRarityBlessing(naturalRarity: string, userId: string = this.getUserId()): Promise<boolean> {
    const ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    if (ORDER.indexOf(naturalRarity) >= ORDER.indexOf('epic')) return false;
    try {
      return await this.consume('blessing', userId);
    } catch (err) {
      console.warn('[Sanctuary] could not read Rare Bloom Charm stock:', err);
      return false;
    }
  }

  /** True while the Keeper is holding at least one Field Expedition. */
  static async hasExpedition(userId: string = this.getUserId()): Promise<boolean> {
    return (await this.getCount('discovery', userId)) > 0;
  }
}

export { SANCTUARY_BY_ID, SANCTUARY_ITEMS };
export type { SanctuaryItem, SanctuaryItemId };
