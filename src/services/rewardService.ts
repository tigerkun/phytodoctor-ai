/**
 * REWARD SERVICE
 * Handles XP/Seed calculations, daily cap enforcement, streak tracking, and level progression
 */

import { db, type DailyRewardCap, type LevelProgress, type StreakRecord, type RewardHistory, type StreakFreeze } from '../db/database';
import {
  DAILY_RITUALS,
  BASE_DIAGNOSIS_REWARDS,
  HEALTH_BONUS_REWARDS,
  DISCOVERY_REWARDS,
  SOCIAL_REWARDS,
  REFERRAL_REWARDS,
  LEVEL_TIERS,
  REWARD_CAPS,
  SEED_MULTIPLIERS,
  type RarityReward
} from '../game/REWARD_CONFIG';
import { getStreakMultiplier } from './profileUtils';
import { applySeedDelta } from './seedLedger';

export class RewardService {
  static getUserId(): string {
    return localStorage.getItem('botanical_guardian_userId') || 'local_user';
  }

  // ============ INITIALIZATION ============

  static async ensureLevelProgress(userId: string = this.getUserId()): Promise<LevelProgress> {
    let progress = await db.levelProgress.get(userId);
    if (!progress) {
      progress = {
        userId,
        currentLevel: 1,
        totalXP: 0,
        xpToNextLevel: LEVEL_TIERS[1].xpRequired,
        xpProgress: 0,
        lastLevelUpAt: null,
        unlockedFeatures: [],
        permanentMultipliers: {}
      };
      await db.levelProgress.put(progress);
    }
    return progress;
  }

  static async ensureStreakRecord(userId: string = this.getUserId()): Promise<StreakRecord> {
    let streak = await db.streakRecords.get(userId);
    if (!streak) {
      streak = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastLoginDate: this.getTodayDateStr(),
        streakMultiplier: 1.0,
        freezesAvailableThisMonth: 0,
        freezesUsedThisMonth: 0,
        nextResetDate: this.getNextMonthDateStr()
      };
      await db.streakRecords.put(streak);
    }
    return streak;
  }

  static async ensureDailyRewardCap(userId: string = this.getUserId()): Promise<DailyRewardCap> {
    const today = this.getTodayDateStr();
    let cap = await db.dailyRewardCaps.get([userId, today]);
    if (!cap) {
      cap = {
        userId,
        date: today,
        seedsEarned: 0,
        seedsSpent: 0,
        activeSeedsRemaining: REWARD_CAPS.ACTIVE_DAILY_SEED_CAP,
        lastUpdated: new Date()
      };
      await db.dailyRewardCaps.put(cap);
    }
    return cap;
  }

  // ============ REWARD EARNING ============

  /**
   * Award seeds and XP from an action, respecting daily caps
   * Burst rewards bypass the active daily cap
   */
  static async awardReward(
    actionId: string,
    context?: any,
    userId: string = this.getUserId()
  ): Promise<{ xpAwarded: number; seedsAwarded: number; totalSeeds: number; capExceeded?: boolean }> {
    const action = [
      ...DAILY_RITUALS,
      ...BASE_DIAGNOSIS_REWARDS,
      ...HEALTH_BONUS_REWARDS,
      ...SOCIAL_REWARDS,
      ...REFERRAL_REWARDS
    ].find(a => a.id === actionId);

    if (!action) throw new Error(`Unknown action: ${actionId}`);

    const profile = await db.userProfile.get(userId);
    if (!profile) throw new Error(`User not found: ${userId}`);

    let seedsAwarded = action.seeds;
    let xpAwarded = action.xp;
    let capExceeded = false;

    // Apply pro tier seed multiplier (but NOT on level-based multipliers)
    if (profile.tier === 'pro') {
      seedsAwarded = Math.floor(seedsAwarded * SEED_MULTIPLIERS.pro);
    }

    // Apply level-based seed multiplier
    const levelProgress = await this.ensureLevelProgress(userId);
    if (levelProgress.permanentMultipliers.seedEarn) {
      seedsAwarded = Math.floor(seedsAwarded * levelProgress.permanentMultipliers.seedEarn);
    }

    // Apply streak multiplier to active rewards
    if (action.capsCategory === 'active') {
      const streak = await this.ensureStreakRecord(userId);
      // BUG-01 Fix: compute multiplier dynamically instead of relying on potentially stale DB field
      const dynamicStreakMultiplier = getStreakMultiplier(streak.currentStreak);
      xpAwarded = Math.floor(xpAwarded * dynamicStreakMultiplier);
      seedsAwarded = Math.floor(seedsAwarded * dynamicStreakMultiplier);

      // Check daily active seed cap
      const dailyCap = await this.ensureDailyRewardCap(userId);
      if (dailyCap.seedsEarned + seedsAwarded > REWARD_CAPS.ACTIVE_DAILY_SEED_CAP) {
        seedsAwarded = Math.max(0, REWARD_CAPS.ACTIVE_DAILY_SEED_CAP - dailyCap.seedsEarned);
        capExceeded = true;
      }

      // Update daily cap
      await db.dailyRewardCaps.update([userId, this.getTodayDateStr()], {
        seedsEarned: dailyCap.seedsEarned + seedsAwarded,
        activeSeedsRemaining: Math.max(0, REWARD_CAPS.ACTIVE_DAILY_SEED_CAP - dailyCap.seedsEarned - seedsAwarded),
        lastUpdated: new Date()
      });
    }

    // Credit through the shared ledger path so the grant reaches the server.
    // This used to write the balance directly, which the next
    // pullServerProfile overwrote with the stale server value, silently
    // erasing the reward for cloud users.
    await applySeedDelta({
      userId,
      amount: seedsAwarded,
      source: 'reward',
      description: `Reward: ${action.name}`,
      transactionId: crypto.randomUUID()
    });
    const credited = await db.userProfile.get(userId);
    // The `??` here used to fabricate a balance for the user: reaching this
    // line with a null read means the write above did not land, and guessing
    // `profile.seeds + seedsAwarded` turns a failed award into an award the
    // server never recorded. Throw instead -- the caller already treats a
    // failure as a failure, and `applySeedDelta` has already thrown if the
    // profile was missing entirely.
    if (!credited) {
      throw new Error('Reward could not be recorded: the balance did not update.');
    }
    const newSeeds = credited.seeds;
    const newXP = levelProgress.totalXP + xpAwarded;

    // Record reward in history
    const reward: RewardHistory = {
      id: crypto.randomUUID(),
      userId,
      actionId,
      actionName: action.name,
      xpEarned: xpAwarded,
      seedsEarned: seedsAwarded,
      capsCategory: action.capsCategory,
      context,
      createdAt: new Date()
    };
    await db.rewardHistory.add(reward);

    // Check for level up
    await this.updateLevel(userId, newXP);

    return {
      xpAwarded,
      seedsAwarded,
      totalSeeds: newSeeds,
      capExceeded
    };
  }

  /**
   * Award discovery reward based on rarity
   * Uses Discovery Charges (1 per week, regenerates Monday)
   */
  static async awardDiscovery(
    species: string,
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic',
    userId: string = this.getUserId()
  ): Promise<{ xpAwarded: number; seedsAwarded: number; chargeUsed: boolean }> {
    const rewardConfig = DISCOVERY_REWARDS.find(d => d.rarity === rarity);
    if (!rewardConfig) throw new Error(`Unknown rarity: ${rarity}`);

    const profile = await db.userProfile.get(userId);
    if (!profile) throw new Error(`User not found: ${userId}`);

    const existingDiscovery = await db.discoveryRecords.get([userId, species]);
    if (existingDiscovery) {
      return { xpAwarded: 0, seedsAwarded: 0, chargeUsed: false };
    }

    let chargeUsed = false;
    if (rewardConfig.chargeRequired) {
      // Check if user has available charge this week
      const chargesUsed = await this.getDiscoveryChargesUsedThisWeek(userId);
      if (chargesUsed >= REWARD_CAPS.DISCOVERY_CHARGES_PER_WEEK) {
        // A Field Expedition is bought past the cap, so a Keeper who runs out
        // of weekly charges is not simply done discovering.
        const { SanctuaryService } = await import('./sanctuaryService');
        if (!(await SanctuaryService.hasExpedition(userId))) {
          throw new Error('No discovery charges available. Resets Monday.');
        }
      }
      chargeUsed = true;
    }

    let seedsAwarded = rewardConfig.seeds;
    let xpAwarded = rewardConfig.xp;

    // Apply multipliers
    if (profile.tier === 'pro') {
      seedsAwarded = Math.floor(seedsAwarded * SEED_MULTIPLIERS.pro);
    }
    const levelProgress = await this.ensureLevelProgress(userId);
    if (levelProgress.permanentMultipliers.seedEarn) {
      seedsAwarded = Math.floor(seedsAwarded * levelProgress.permanentMultipliers.seedEarn);
    }

    // Discoveries are burst rewards, bypass daily cap — but still credited
    // through the shared ledger path so they sync to the server.
    await applySeedDelta({
      userId,
      amount: seedsAwarded,
      source: 'reward',
      description: `Discovery: ${species}`,
      transactionId: crypto.randomUUID()
    });
    const credited = await db.userProfile.get(userId);
    // Same reasoning as awardReward: a null read here means the ledger write
    // did not land, and inventing the balance would record a discovery against
    // a number the server never agreed to.
    if (!credited) {
      throw new Error('Discovery reward could not be recorded: the balance did not update.');
    }
    const newSeeds = credited.seeds;

    // Record discovery
    const discovery = {
      userId,
      species,
      rarity,
      discoveredAt: new Date(),
      chargeUsed,
      xpEarned: xpAwarded,
      seedsEarned: seedsAwarded
    };
    await db.discoveryRecords.add(discovery);

    // Update level
    const newXP = levelProgress.totalXP + xpAwarded;
    await this.updateLevel(userId, newXP);

    return { xpAwarded, seedsAwarded, chargeUsed };
  }

  // ============ LEVEL SYSTEM ============

  static async updateLevel(userId: string, newXP: number): Promise<void> {
    let progress = await this.ensureLevelProgress(userId);
    // Find highest tier where xpRequired <= newXP (LEVEL_TIERS is sorted ascending)
    const levelData = [...LEVEL_TIERS].reverse().find(t => t.xpRequired <= newXP);

    if (!levelData) return;

    const newLevel = levelData.level;
    if (newLevel > progress.currentLevel) {
      // Level up!
      progress.currentLevel = newLevel;
      progress.lastLevelUpAt = new Date();
      progress.unlockedFeatures = this.getUnlockedFeatures(newLevel);
      progress.permanentMultipliers = this.getLevelMultipliers(newLevel);

      await db.levelProgress.update(userId, {
        currentLevel: newLevel,
        lastLevelUpAt: new Date(),
        unlockedFeatures: progress.unlockedFeatures,
        permanentMultipliers: progress.permanentMultipliers
      });
    }

    // Update XP progress
    const currentTier = LEVEL_TIERS[newLevel - 1] || LEVEL_TIERS[0];
    const nextTier = LEVEL_TIERS[newLevel] || currentTier;
    const xpForCurrentLevel = currentTier.xpRequired;
    const xpForNextLevel = nextTier.xpRequired;
    const xpSpan = Math.max(1, xpForNextLevel - xpForCurrentLevel);
    const xpProgress = newLevel >= LEVEL_TIERS.length
      ? 100
      : Math.floor(((newXP - xpForCurrentLevel) / xpSpan) * 100);

    await db.levelProgress.update(userId, {
      totalXP: newXP,
      xpToNextLevel: Math.max(0, xpForNextLevel - newXP),
      xpProgress: Math.min(100, Math.max(0, xpProgress))
    });
  }

  static getUnlockedFeatures(level: number): string[] {
    const features: string[] = [];
    for (let i = 1; i <= level; i++) {
      const tier = LEVEL_TIERS[i - 1];
      if (tier?.unlocks.features) {
        features.push(...tier.unlocks.features);
      }
    }
    return features;
  }

  static getLevelMultipliers(level: number): { seedEarn?: number; xpEarn?: number } {
    const multipliers: { seedEarn?: number; xpEarn?: number } = {};
    for (let i = 1; i <= level; i++) {
      const tier = LEVEL_TIERS[i - 1];
      if (tier?.unlocks.multipliers?.seedEarn) {
        multipliers.seedEarn = tier.unlocks.multipliers.seedEarn;
      }
      if (tier?.unlocks.multipliers?.xpEarn) {
        multipliers.xpEarn = tier.unlocks.multipliers.xpEarn;
      }
    }
    return multipliers;
  }

  // ============ STREAK SYSTEM ============

  static async updateStreakOnUpload(userId: string = this.getUserId()): Promise<{ currentStreak: number, continuedToday: boolean, freezeUsed: boolean }> {
    const streak = await this.ensureStreakRecord(userId);
    const today = this.getTodayDateStr();
    const yesterday = this.getYesterdayDateStr();

    // A freshly created record is stamped with today's date but a streak of 0,
    // so the first-ever upload used to match the "already logged in today" branch
    // and leave a brand-new keeper sitting on a 0-day streak all day.
    const isFirstActivity = streak.currentStreak === 0;

    if (streak.lastLoginDate === today && !isFirstActivity) {
      // Already logged in today
      return { currentStreak: streak.currentStreak, continuedToday: false, freezeUsed: false };
    }

    let continuedToday = false;
    let freezeUsed = false;

    if (streak.lastLoginDate === yesterday) {
      // Streak continues
      streak.currentStreak += 1;
      continuedToday = true;
    } else if (isFirstActivity) {
      streak.currentStreak = 1;
    } else {
      // A gap. This is the only place a freeze can do any work, so it is the
      // only place one is spent: the freeze covers the missed day and the run
      // carries on rather than collapsing back to 1.
      freezeUsed = await this.consumeStreakFreeze(userId);
      streak.currentStreak = freezeUsed ? streak.currentStreak + 1 : 1;
      continuedToday = freezeUsed;
    }

    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastLoginDate = today;
    streak.nextResetDate = this.getNextMonthDateStr();

    // Make sure we write the purely calculated multiplier just in case other things read it
    streak.streakMultiplier = getStreakMultiplier(streak.currentStreak);

    await db.streakRecords.put(streak);
    return { currentStreak: streak.currentStreak, continuedToday, freezeUsed };
  }

  static async useStreakFreeze(userId: string = this.getUserId()): Promise<boolean> {
    const consumed = await this.consumeStreakFreeze(userId);
    if (consumed) {
      const record = await this.ensureStreakRecord(userId);
      record.freezesUsedThisMonth += 1;
      await db.streakRecords.put(record);
    }
    return consumed;
  }

  /**
   * Spends one freeze from this month's allowance. Callers that decide a freeze
   * is *owed* (the streak-break path) use this directly; `useStreakFreeze` is
   * the manual/burn path that also mirrors the count onto the streak record.
   */
  private static async consumeStreakFreeze(userId: string): Promise<boolean> {
    const freeze = await this.ensureFreezeRecord(userId);
    if (!freeze) return false;

    if (freeze.freezesRemaining > 0) {
      freeze.freezesRemaining -= 1;
      freeze.freezesUsed += 1;
      freeze.lastUsedAt = new Date();
      await db.streakFreezes.put(freeze);
      return true;
    }

    return false;
  }

  /** Tier-granted freezes for the current month. Purchased freezes sit on top. */
  static tierFreezeAllowance(tier: string): number {
    if (tier === 'pro') return REWARD_CAPS.STREAK_FREEZE_LEVELS.pro_base || 0;
    if (tier === 'keeper') return REWARD_CAPS.STREAK_FREEZE_LEVELS[14] || 0;
    return REWARD_CAPS.STREAK_FREEZE_LEVELS[6] || 0;
  }

  /**
   * Bumps a run back up to `days`, for the Quiet Grace sanctuary item.
   *
   * Writes both tables the streak lives in. `GameService.updateStreakOnUpload`
   * mirrors the authoritative `streakRecords` row into the legacy `userProfile`
   * columns, and the Botanical Lab header still reads the legacy copy, so
   * writing only the first would leave the number visibly unchanged there.
   *
   * Never lowers an existing run: a Keeper who buys this on a healthy 40-day
   * streak should not be handed a worse one.
   */
  static async restoreStreak(days: number, userId: string = this.getUserId()): Promise<number> {
    const streak = await this.ensureStreakRecord(userId);
    const target = Math.max(streak.currentStreak, Math.floor(days));

    streak.currentStreak = target;
    streak.longestStreak = Math.max(streak.longestStreak, target);
    streak.streakMultiplier = getStreakMultiplier(target);
    await db.streakRecords.put(streak);

    const profile = await db.userProfile.get(userId);
    if (profile) {
      profile.currentStreak = target;
      profile.longestStreak = streak.longestStreak;
      await db.userProfile.put(profile);
    }

    return target;
  }

  /**
   * The current month's freeze row, created and refreshed as needed.
   *
   * The row is written lazily rather than at signup because a keeper's first
   * upload never reaches the gap path, so nothing else would create it and the
   * balance would read 0 to the newest users in the app.
   */
  private static async ensureFreezeRecord(userId: string): Promise<StreakFreeze | null> {
    const monthYear = this.getCurrentMonthYearStr();
    let freeze = await db.streakFreezes.get([userId, monthYear]);

    const profile = await db.userProfile.get(userId);
    if (!profile) return null;

    const freezeLimit = this.tierFreezeAllowance(profile.tier);
    const isNew = !freeze;

    if (isNew) {
      freeze = {
        id: crypto.randomUUID(),
        userId,
        monthYear,
        freezesRemaining: freezeLimit,
        freezesUsed: 0,
        tier: profile.tier,
        lastUsedAt: null
      };
    } else if (freeze!.tier !== profile.tier) {
      // A month can roll over while a keeper still holds yesterday's row, and a
      // tier upgrade should not leave them on the old allowance. Either way,
      // refresh rather than honour a stale exhausted balance.
      freeze!.tier = profile.tier;
      freeze!.freezesRemaining = Math.max(freeze!.freezesRemaining, freezeLimit);
    } else {
      return freeze;
    }

    if (isNew) await db.streakFreezes.add(freeze);
    else await db.streakFreezes.put(freeze);
    return freeze;
  }

  static async getFreezeBalance(userId: string = this.getUserId()): Promise<number> {
    const freeze = await this.ensureFreezeRecord(userId);
    if (!freeze) return 0;
    return Math.max(0, freeze.freezesRemaining);
  }

  /**
   * Adds purchased freezes. These are explicitly allowed to exceed the tier
   * allowance — otherwise buying one would be a no-op for anyone already at cap,
   * which is most established keepers and exactly the people most likely to buy.
   */
  static async grantFreezes(userId: string, count: number): Promise<number> {
    if (count <= 0) return this.getFreezeBalance(userId);
    const freeze = await this.ensureFreezeRecord(userId);
    if (!freeze) throw new Error(`User not found: ${userId}`);
    freeze.freezesRemaining += count;
    await db.streakFreezes.put(freeze);
    return freeze.freezesRemaining;
  }

  // ============ UTILITY HELPERS ============

  private static formatDateLocal(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private static getTodayDateStr(): string {
    return this.formatDateLocal(new Date());
  }

  private static getYesterdayDateStr(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.formatDateLocal(yesterday);
  }

  private static getNextMonthDateStr(): string {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return this.formatDateLocal(nextMonth);
  }

  private static getCurrentMonthYearStr(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private static async getDiscoveryChargesUsedThisWeek(userId: string): Promise<number> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    const records = await db.discoveryRecords
      .where('userId')
      .equals(userId)
      .filter(r => r.chargeUsed && r.discoveredAt >= weekStart)
      .toArray();
    return records.length;
  }

  /**
   * Get level unlock summary for UI display
   */
  static getLevelTierInfo(level: number): { title: string; nextUnlock?: string; xpRequired: number } {
    const tier = LEVEL_TIERS[level - 1];
    const nextTier = LEVEL_TIERS[level];
    return {
      title: tier?.title || 'Unknown',
      nextUnlock: nextTier?.unlocks.features?.[0] || 'Prestige tier',
      xpRequired: tier?.xpRequired || 0
    };
  }
}
