import { db, type PhytoCard, type CardStats, type Plant, type CheckIn, type UserGameProfile, type RarityTier, type GrowthStage, type SeedTransaction, type UserSubscription, type UserCosmetic } from '../db/database';
import { SPECIES_DIFFICULTY, MYTHIC_SPECIES } from '../game/RARITY_DATA';
import { SPECIES_PROFILES } from '../forecasting/speciesProfiles';
import { ECONOMY_CONFIG, SEED_MULTIPLIERS, MARKETPLACE_ITEMS } from '../game/ECONOMY_DATA';
import { RewardService } from './rewardService';

export class GameService {
  static getUserId(): string {
    return localStorage.getItem('botanical_guardian_userId') || 'local_user';
  }

  static async getProfile(userId: string = this.getUserId()): Promise<UserGameProfile | undefined> {
    return await db.userProfile.get(userId);
  }

  static async ensureProfile(userId: string = this.getUserId()): Promise<UserGameProfile> {
    let profile = await db.userProfile.get(userId);
    if (!profile) {
      profile = {
        userId,
        username: 'Guardian',
        avatarUrl: '',
        equippedTitle: null,
        seeds: 500,
        currentStreak: 0,
        longestStreak: 0,
        collectionSize: 0,
        totalXP: 0,
        tier: 'free',
        discoveredSpecies: []
      };
      await db.userProfile.put(profile);
    }
    return profile;
  }

  static async getSubscription(userId: string = this.getUserId()): Promise<UserSubscription | null> {
    return await db.subscriptions.get(userId) || null;
  }

  static async upgradeToPro(userId: string = this.getUserId()) {
    const startedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const sub: UserSubscription = {
      userId,
      tier: 'pro',
      startedAt,
      expiresAt,
      cancelAtPeriodEnd: false
    };

    await db.subscriptions.put(sub);
    await db.userProfile.update(userId, { tier: 'pro' });
    
    // Welcome bonus seeds
    await this.addSeeds(1000, 'bonus', 'Pro Welcome Bonus', userId);
  }

  static async addSeeds(
    amount: number, 
    source: SeedTransaction['source'], 
    description: string, 
    userId: string = this.getUserId()
  ) {
    const profile = await this.ensureProfile(userId);
    const multiplier = SEED_MULTIPLIERS[profile.tier || 'free'];
    const finalAmount = Math.floor(amount * multiplier);

    // Update profile
    await db.userProfile.update(userId, { seeds: Math.max(0, profile.seeds + finalAmount) });

    // Record transaction
    const transaction: SeedTransaction = {
      id: crypto.randomUUID(),
      userId,
      amount: finalAmount,
      source,
      description,
      createdAt: new Date()
    };
    await db.seedTransactions.add(transaction);
  }

  static async purchaseItem(itemId: string, userId: string = this.getUserId()) {
    const item = MARKETPLACE_ITEMS.find(i => i.id === itemId);
    if (!item) throw new Error('Item not found');

    const profile = await this.ensureProfile(userId);
    if (item.isProOnly && profile.tier !== 'pro') {
      throw new Error('This item requires a Pro subscription');
    }

    if (profile.seeds < item.price) {
      throw new Error(`Insufficient seeds. You need ${item.price - profile.seeds} more.`);
    }

    // Deduct seeds
    await this.addSeeds(-item.price, 'spend', `Purchased ${item.name}`, userId);

    // Add cosmetic
    const cosmetic: UserCosmetic = {
      userId,
      itemId,
      itemType: item.type,
      equipped: false,
      purchasedAt: new Date()
    };
    await db.cosmetics.put(cosmetic);

    return cosmetic;
  }

  static async equipItem(itemId: string, userId: string = this.getUserId()) {
    const item = await db.cosmetics.get([userId, itemId]);
    if (!item) throw new Error('Item not owned');

    // If it's a frame, we might want to apply it to a specific card, 
    // but the task is general. Let's assume global theme/flair first.
    // For frames, we'll auto-apply to the featured card for simplicity.
    if (item.itemType === 'frame') {
       const featuredCard = await db.cards.filter(c => !!c.isFeatured).first();
       if (featuredCard) {
          await db.cards.update(featuredCard.id, { frameSkin: itemId });
       }
    }

    // Unequip others of the same type
    await db.cosmetics.where('userId').equals(userId).and(c => c.itemType === item.itemType).modify({ equipped: false });
    // Equip new one
    await db.cosmetics.update([userId, itemId], { equipped: true });

    if (item.itemType === 'flair') {
       const marketplaceItem = MARKETPLACE_ITEMS.find(i => i.id === itemId);
       await db.userProfile.update(userId, { equippedTitle: marketplaceItem?.name || null });
    }
  }

  static async getInventory(userId: string = this.getUserId()): Promise<UserCosmetic[]> {
    return await db.cosmetics.where('userId').equals(userId).toArray();
  }

  static calculateRarity(
    species: string,
    streakAtUnlock: number,
    totalStreak: number
  ): RarityTier {
    const baseDifficulty = SPECIES_DIFFICULTY[species] || 2;
    
    const streakBonus = streakAtUnlock >= 30 ? 3 :
                        streakAtUnlock >= 14 ? 2 :
                        streakAtUnlock >= 7 ? 1 : 0;
    
    const totalScore = baseDifficulty + streakBonus;
    
    if (totalScore >= 8 || totalStreak >= 100 || MYTHIC_SPECIES.includes(species)) return 'mythic';
    if (totalScore >= 6) return 'legendary';
    if (totalScore >= 5) return 'epic';
    if (totalScore >= 4) return 'rare';
    if (totalScore >= 3) return 'uncommon';
    return 'common';
  }

  static calculateCardStats(
    plant: Plant,
    checkIns: CheckIn[],
    rarity: RarityTier
  ): CardStats {
    const daysAlive = Math.floor((Date.now() - new Date(plant.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const recentCheckIns = checkIns.slice(-14);
    
    const healthyCount = recentCheckIns.filter(c => c.guardianScore >= 80).length;
    const avgDrift = recentCheckIns.length > 0 
      ? recentCheckIns.reduce((sum, c) => sum + (c.driftScore || 0), 0) / recentCheckIns.length 
      : 0;
    
    // Stats distribution
    const attack = Math.min(100, (healthyCount * 5) + ((1 - avgDrift) * 30) + (daysAlive * 0.2));
    const defense = Math.min(100, (checkIns.filter(c => c.driftStatus === 'stable').length * 2) + 20);
    const health = plant.guardianScore || 50;
    const speed = Math.min(100, healthyCount * 7);
    const longevity = Math.min(100, (daysAlive / (5 * 365)) * 100);
    
    return { attack, defense, health, speed, longevity };
  }

  static async generateCardForPlant(plantId: string, userId: string = this.getUserId()) {
    const plant = await db.plants.get(plantId);
    if (!plant) return;

    const existingCard = await db.cards.where('plantId').equals(plantId).first();
    if (existingCard) return;

    const profile = await this.ensureProfile(userId);
    const checkIns = await db.checkins.where('plantId').equals(plantId).toArray();
    
    const currentStreak = profile.currentStreak;
    const totalStreak = profile.longestStreak;
    
    const rarity = this.calculateRarity(plant.species, currentStreak, totalStreak);
    const stats = this.calculateCardStats(plant, checkIns, rarity);

    const card: PhytoCard = {
      id: crypto.randomUUID(),
      userId,
      plantId,
      species: plant.species,
      commonName: plant.name || plant.species.split(' ')[0],
      rarity,
      growthStage: 'sprout',
      stats,
      level: 1,
      xp: 0,
      xpToNext: 10,
      abilityUnlocked: false,
      acquiredAt: new Date(),
      daysAlive: 0,
      checkInsTotal: checkIns.length,
      checkInsHealthy: checkIns.filter(c => c.guardianScore >= 80).length,
      alertsSurvived: 0,
      currentStreak,
      longestStreak: totalStreak,
      isFavorite: false,
      isFeatured: false,
      admirations: 0,
      battleScars: [],
      frameSkin: null,
      altArt: null
    };

    await db.cards.add(card);
    
    // Auto-feature if first or legendary+
    const cardCount = await db.cards.where('userId').equals(userId).count();
    if (cardCount === 1 || ['legendary', 'mythic'].includes(rarity)) {
      await this.setFeaturedCard(card.id, userId);
    }

    // Award seeds for new collection item only if species never discovered before
    const previouslyDiscovered = profile.discoveredSpecies?.includes(plant.species);
    
    if (!previouslyDiscovered) {
      await this.addSeeds(ECONOMY_CONFIG.EARNING_BASE.new_plant, 'bonus', `Discovered ${plant.species}`, userId);
      await db.userProfile.update(userId, {
        discoveredSpecies: [...(profile.discoveredSpecies || []), plant.species]
      });
    }
    
    return card;
  }

  static async setFeaturedCard(cardId: string, userId: string = this.getUserId()) {
    // Unset all others
    await db.cards.where('userId').equals(userId).modify({ isFeatured: false });
    // Set new one
    await db.cards.update(cardId, { isFeatured: true });
  }

  static async updateCardFromCheckIn(plantId: string, checkIn: CheckIn) {
    let card = await db.cards.where('plantId').equals(plantId).first();
    if (!card) {
      // Lazy generate if missing
      card = await this.generateCardForPlant(plantId);
    }
    if (!card) return;

    const plant = await db.plants.get(plantId);
    if (!plant) return;

    const todayDate = new Date();
    const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    
    // Check if XP already granted for this plant today
    const alreadyGainedXP = await db.xpLog
      .where('[plantId+date]')
      .equals([plantId, today])
      .count();


    if (alreadyGainedXP > 0) {
      // Still log the check-in stats but don't grant XP orSeeds
      await db.cards.update(card.id, {
        checkInsTotal: card.checkInsTotal + 1,
        checkInsHealthy: checkIn.guardianScore >= 80 ? card.checkInsHealthy + 1 : card.checkInsHealthy
      });
      return;
    }

    // XP gain logic from brief: base 5, excellence +5, stable +3, streak +5
    let xpGain = 5;
    if (checkIn.guardianScore >= 90) xpGain += 5;
    if (checkIn.driftStatus === 'stable') xpGain += 3;
    
    const checkIns = await db.checkins.where('plantId').equals(plantId).toArray();
    // Use card's streak or plant status
    const currentStreak = card.currentStreak || (plant.status === 'Stable' ? 7 : 0);
    if (currentStreak >= 7) xpGain += 5;

    let newLevel = card.level;
    let newXp = card.xp + xpGain;
    let newXpToNext = card.xpToNext;
    let newStage = card.growthStage;

    while (newXp >= newXpToNext && newLevel < 50) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = Math.floor(newXpToNext * 1.2) + 5;
      
      // Stage evolution
      if (newLevel === 10) newStage = 'seedling';
      if (newLevel === 20) newStage = 'juvenile';
      if (newLevel === 30) newStage = 'mature';
      if (newLevel === 45) newStage = 'ancient';
    }

    const newStats = this.calculateCardStats(plant, checkIns, card.rarity);

    await db.cards.update(card.id, {
      level: newLevel,
      xp: newXp,
      xpToNext: newXpToNext,
      growthStage: newStage,
      abilityUnlocked: newLevel >= 25,
      stats: newStats,
      checkInsTotal: card.checkInsTotal + 1,
      checkInsHealthy: checkIn.guardianScore >= 80 ? card.checkInsHealthy + 1 : card.checkInsHealthy,
      daysAlive: Math.floor((Date.now() - new Date(plant.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    });

    // Record XP gain
    await db.xpLog.add({
      plantId,
      date: today,
      xp: xpGain,
      checkInId: checkIn.id
    });

    // Seeds for check-in
    await this.addSeeds(ECONOMY_CONFIG.EARNING_BASE.checkin, 'checkin', `Check-in: ${plant.name}`, card.userId);
    if (checkIn.guardianScore >= 95 && checkIn.photoBlob) { // Require photo for precision bonus
      await this.addSeeds(ECONOMY_CONFIG.EARNING_BASE.perfect_checkin, 'checkin', `Perfect Check-in Bonus`, card.userId);
    }
  }

  // Care-Off Challenges
  static async getCareOffsThisWeek(userId: string = this.getUserId()): Promise<number> {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    
    return await db.careOffs
      .where('userId').equals(userId)
      .filter(co => co.createdAt >= startOfWeek)
      .count();
  }

  static async canStartCareOff(userId: string = this.getUserId()): Promise<boolean> {
    const profile = await this.ensureProfile(userId);
    if (profile.tier === 'pro') return true;

    const count = await this.getCareOffsThisWeek(userId);
    return count < 3;
  }

  static async recordCareOff(score: number, result: 'win' | 'loss' | 'draw', userId: string = this.getUserId()) {
    const careOff = {
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date(),
      opponentId: 'bot',
      score,
      result
    };
    await db.careOffs.add(careOff);

    if (result === 'win') {
      await this.addSeeds(ECONOMY_CONFIG.EARNING_BASE.arena_win, 'bonus', 'Care-Off Victory', userId);
    }
  }

  // Propagation
  static async getPropagationsThisMonth(userId: string = this.getUserId()): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return await db.propagations
      .where('userId').equals(userId)
      .filter(p => p.createdAt >= startOfMonth)
      .count();
  }

  static async canPropagate(userId: string = this.getUserId()): Promise<boolean> {
    const profile = await this.ensureProfile(userId);
    const count = await this.getPropagationsThisMonth(userId);
    
    const limit = profile.tier === 'pro' ? 5 : 1;
    return count < limit;
  }

  static async propagate(parentCardId: string, isHybrid: boolean = false, hybridParents: [string, string] | null = null, userId: string = this.getUserId()) {
    const canDo = await this.canPropagate(userId);
    if (!canDo) throw new Error('Monthly propagation limit reached');

    const profile = await this.ensureProfile(userId);
    if (isHybrid && profile.tier !== 'pro') {
      throw new Error('Hybrid propagation requires Pro subscription');
    }

    // Spend seeds for propagation
    await this.addSeeds(-ECONOMY_CONFIG.CONVENIENCE_COSTS.propagation_basic, 'spend', 'Propagation Attempt', userId);

    const success = Math.random() > (isHybrid ? 0.7 : 0.4);
    
    const propagation = {
      id: crypto.randomUUID(),
      parentCardId,
      babyCardId: success ? crypto.randomUUID() : '',
      userId,
      isHybrid,
      hybridParents,
      success,
      createdAt: new Date()
    };

    await db.propagations.add(propagation);
    return propagation;
  }

  // ============ REWARD SYSTEM INTEGRATION ============
  // These methods bridge the new RewardService with existing GameService

  static async updateStreakOnLogin(userId: string = this.getUserId()): Promise<void> {
    const streak = await RewardService.updateStreakOnLogin(userId);
    // Update legacy profile fields for compatibility
    const profile = await this.ensureProfile(userId);
    await db.userProfile.update(userId, {
      currentStreak: streak,
      longestStreak: Math.max(profile.longestStreak, streak)
    });
  }

  static async awardRewardForAction(
    actionId: string,
    context?: any,
    userId: string = this.getUserId()
  ): Promise<{ xpAwarded: number; seedsAwarded: number; capExceeded?: boolean }> {
    const result = await RewardService.awardReward(actionId, context, userId);
    
    // Keep legacy totalXP in sync for compatibility
    const levelProgress = await RewardService.ensureLevelProgress(userId);
    await db.userProfile.update(userId, {
      totalXP: levelProgress.totalXP
    });

    return result;
  }

  static async awardDiscoveryReward(
    species: string,
    rarity: RarityTier,
    userId: string = this.getUserId()
  ): Promise<{ xpAwarded: number; seedsAwarded: number }> {
    const result = await RewardService.awardDiscovery(species, rarity, userId);
    
    // Add to discovered species list
    const profile = await this.ensureProfile(userId);
    if (!profile.discoveredSpecies?.includes(species)) {
      await db.userProfile.update(userId, {
        discoveredSpecies: [...(profile.discoveredSpecies || []), species]
      });
    }

    return result;
  }

  static async getLevelProgress(userId: string = this.getUserId()) {
    return await RewardService.ensureLevelProgress(userId);
  }

  static async getStreakRecord(userId: string = this.getUserId()) {
    return await RewardService.ensureStreakRecord(userId);
  }
}
