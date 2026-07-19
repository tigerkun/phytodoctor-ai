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
  STREAK_MULTIPLIERS,
  REWARD_CAPS,
  SEED_MULTIPLIERS,
  type RarityReward
} from '../game/REWARD_CONFIG';

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
      xpAwarded = Math.floor(xpAwarded * streak.streakMultiplier);
      seedsAwarded = Math.floor(seedsAwarded * streak.streakMultiplier);

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

    // Update user profile
    const newSeeds = profile.seeds + seedsAwarded;
    const newXP = levelProgress.totalXP + xpAwarded;
    await db.userProfile.update(userId, { seeds: newSeeds });

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
        throw new Error('No discovery charges available. Resets Monday.');
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

    // Discoveries are burst rewards, bypass daily cap
    const newSeeds = profile.seeds + seedsAwarded;
    await db.userProfile.update(userId, { seeds: newSeeds });

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
    const levelData = LEVEL_TIERS.find(t => t.xpRequired <= newXP);

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
    const nextLevelData = LEVEL_TIERS[newLevel] || LEVEL_TIERS[LEVEL_TIERS.length - 1];
    const nextNextLevelData = LEVEL_TIERS[newLevel + 1];
    const xpForCurrentLevel = nextLevelData.xpRequired;
    const xpForNextLevel = nextNextLevelData?.xpRequired || nextLevelData.xpRequired;
    const xpProgress = Math.floor(
      ((newXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100
    );

    await db.levelProgress.update(userId, {
      totalXP: newXP,
      xpToNextLevel: Math.max(0, xpForNextLevel - newXP),
      xpProgress: Math.min(100, xpProgress)
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

  static async updateStreakOnLogin(userId: string = this.getUserId()): Promise<number> {
    const streak = await this.ensureStreakRecord(userId);
    const today = this.getTodayDateStr();
    const yesterday = this.getYesterdayDateStr();

    if (streak.lastLoginDate === today) {
      // Already logged in today
      return streak.currentStreak;
    }

    if (streak.lastLoginDate === yesterday) {
      // Streak continues
      streak.currentStreak += 1;
    } else {
      // Streak broken (unless using freeze)
      streak.currentStreak = 1;
    }

    // Check for streak milestones
    const multiplierData = STREAK_MULTIPLIERS.find(m => m.day === streak.currentStreak);
    if (multiplierData) {
      streak.streakMultiplier = multiplierData.multiplier;
    }

    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastLoginDate = today;
    streak.nextResetDate = this.getNextMonthDateStr();

    await db.streakRecords.put(streak);
    return streak.currentStreak;
  }

  static async useStreakFreeze(userId: string = this.getUserId()): Promise<boolean> {
    const monthYear = this.getCurrentMonthYearStr();
    let freeze = await db.streakFreezes.get([userId, monthYear]);

    const profile = await db.userProfile.get(userId);
    if (!profile) throw new Error(`User not found: ${userId}`);

    const freezeLimit = REWARD_CAPS.STREAK_FREEZE_LEVELS[profile.tier === 'pro' ? 'pro_base' : 6] || 0;

    if (!freeze) {
      freeze = {
        id: crypto.randomUUID(),
        userId,
        monthYear,
        freezesRemaining: freezeLimit,
        freezesUsed: 0,
        tier: profile.tier,
        lastUsedAt: null
      };
      await db.streakFreezes.add(freeze);
    }

    if (freeze.freezesRemaining > 0) {
      freeze.freezesRemaining -= 1;
      freeze.freezesUsed += 1;
      freeze.lastUsedAt = new Date();
      await db.streakFreezes.put(freeze);
      return true;
    }

    return false;
  }

  static async getStreakMultiplier(streak: number): Promise<number> {
    const multiplierData = STREAK_MULTIPLIERS.find(m => m.day <= streak);
    return multiplierData?.multiplier || 1.0;
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
