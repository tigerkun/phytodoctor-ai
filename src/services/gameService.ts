import { db, type PhytoCard, type CardStats, type Plant, type CheckIn, type UserGameProfile, type RarityTier, type GrowthStage, type SeedTransaction, type UserSubscription, type UserCosmetic, type CareOff } from '../db/database';
import { SPECIES_DIFFICULTY, MYTHIC_SPECIES } from '../game/RARITY_DATA';
import { SPECIES_PROFILES } from '../forecasting/speciesProfiles';
import { ECONOMY_CONFIG, SEED_MULTIPLIERS, MARKETPLACE_ITEMS } from '../game/ECONOMY_DATA';
import { RewardService } from './rewardService';
import { applySeedDelta, flushSeedSyncOutbox, hasPendingSeedSyncs } from './seedLedger';
import { guardianScoreFromScan, normalizeHealthStatus, type PlantScanReport } from '../lib/scanReport';

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

  /**
   * Low-level tier switch. Prefer purchaseProUpgrade() which enforces the
   * seed cost. Pro's real benefit: no daily cap on Vault clinical assessments
   * (free tier: ASSESSMENTS_PER_DAY), the 1.5x seed multiplier, and existing
   * pro-only cosmetics.
   */
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
  }

  static readonly PRO_UPGRADE_COST = 1000;

  static async purchaseProUpgrade(userId: string = this.getUserId()) {
    // Cloud-synced users buy through the server (verifies balance, grants
    // tier service-side). Local-only accounts keep the Dexie path.
    if (userId.startsWith('sb_')) {
      const viaServer = await this.purchaseProUpgradeWithServer(userId);
      if (viaServer) return;
    }
    const profile = await this.ensureProfile(userId);
    if (profile.tier === 'pro') throw new Error('You are already a Pro member.');
    if (profile.seeds < GameService.PRO_UPGRADE_COST) {
      throw new Error(`Insufficient seeds. You need ${(GameService.PRO_UPGRADE_COST - profile.seeds).toLocaleString()} more.`);
    }
    await this.spendSeeds(GameService.PRO_UPGRADE_COST, 'spend', 'Upgraded to Pro Commission', userId);
    try {
      await this.upgradeToPro(userId);
    } catch (err) {
      // Return exactly what was taken. earnSeeds is the wrong tool here: it
      // applies the Pro tier multiplier and spends a Long Season boost, so a
      // Pro member whose upgrade failed was refunded MORE than 1000 seeds and
      // lost a boost they had paid for. A refund is not a reward.
      await applySeedDelta({
        userId,
        amount: GameService.PRO_UPGRADE_COST,
        source: 'bonus',
        description: 'Pro upgrade refund',
        transactionId: crypto.randomUUID()
      });
      throw err;
    }
  }

  /** Pro status with honest expiry handling: lapsed commissions downgrade. */
  static async isPro(userId: string = this.getUserId()): Promise<boolean> {
    const profile = await this.ensureProfile(userId);
    if (profile.tier !== 'pro') return false;
    const sub = await db.subscriptions.get(userId);
    if (sub?.expiresAt && sub.expiresAt.getTime() < Date.now()) {
      await db.userProfile.update(userId, { tier: 'free' });
      return false;
    }
    return true;
  }

  /**
   * Server is the source of truth for seeds/tier whenever the user is signed
   * in through Supabase ('sb_' ids). Pulls the authoritative profile and
   * mirrors it into the local Dexie cache the UI reads.
   */
  static async pullServerProfile(userId: string = this.getUserId()) {
    if (!userId.startsWith('sb_')) return null;
    try {
      const token = localStorage.getItem('botanical_guardian_auth_token');
      if (!token) return null;
      // While deltas are still queued the server balance lags the local one;
      // overwriting now would wipe locally-earned seeds before they sync.
      if (await hasPendingSeedSyncs(userId)) return null;
      const res = await fetch('/api/economy/profile', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const p = await res.json();
      const lapsed = p.pro_expires_at && new Date(p.pro_expires_at) <= new Date();
      await db.userProfile.update(userId, {
        seeds: p.seeds ?? 500,
        tier: p.tier === 'pro' && !lapsed ? 'pro' : 'free',
      } as any);
      return p;
    } catch {
      return null;
    }
  }

  static async flushSeedSyncOutbox(userId: string = this.getUserId()) {
    await flushSeedSyncOutbox(userId);
  }

  static async purchaseProUpgradeWithServer(userId: string = this.getUserId()) {
    const token = localStorage.getItem('botanical_guardian_auth_token');
    if (!userId.startsWith('sb_') || !token) return false; // caller falls back to local path
    const res = await fetch('/api/billing/purchase-with-seeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Purchase failed.');
    await GameService.pullServerProfile(userId);
    return true;
  }

  static async earnSeeds(
    amount: number,
    source: SeedTransaction['source'],
    description: string,
    userId: string = this.getUserId(),
    transactionId: string = crypto.randomUUID()
  ) {
    if (amount < 0) throw new Error('earnSeeds amount must be non-negative');
    const profile = await this.ensureProfile(userId);
    const multiplier = SEED_MULTIPLIERS[profile.tier || 'free'];

    // A Long Season doubles this payout and spends itself doing so. Imported
    // lazily because SanctuaryService reaches back into GameService for
    // spendSeeds, and a static import here would close that cycle at module
    // load. Payouts already routed through awardReward/awardDiscovery carry
    // their own level and streak multipliers, so boosting those as well would
    // compound; this is the one path that has neither.
    const { SanctuaryService } = await import('./sanctuaryService');
    const boost = await SanctuaryService.takeBoost(userId);

    const finalAmount = Math.floor(amount * multiplier * boost);
    await applySeedDelta({
      userId,
      amount: finalAmount,
      source,
      description: boost > 1 ? `${description} (long season x${boost})` : description,
      transactionId
    });
  }

  // BUG-03 evidence: -- select count(*) from profiles; -- result pending user run
  static async spendSeeds(
    amount: number,
    source: SeedTransaction['source'],
    description: string,
    userId: string = this.getUserId(),
    transactionId: string = crypto.randomUUID()
  ) {
    if (amount < 0) throw new Error('spendSeeds amount must be non-negative');
    const profile = await this.ensureProfile(userId);
    const finalAmount = Math.floor(amount); // No multiplier on spend

    // Refuse before mutating anything. Clamping to zero would let a purchase
    // settle for free and would desync the client balance from the server RPC,
    // which raises 'insufficient seeds'. applySeedDelta re-checks inside the
    // transaction so a concurrent spend cannot overdraw between the two.
    if (finalAmount > profile.seeds) {
      throw new Error(`Insufficient seeds. You need ${(finalAmount - profile.seeds).toLocaleString()} more.`);
    }
    await applySeedDelta({ userId, amount: -finalAmount, source, description, transactionId });
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
    await this.spendSeeds(item.price, 'spend', `Purchased ${item.name}`, userId);

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
    
    const naturalRarity = this.calculateRarity(plant.species, currentStreak, totalStreak);

    // A Rare Bloom Charm lifts this one card to Epic if it would have rolled
    // below. Deliberately not applied when the roll already clears the bar, so
    // a Keeper is never told to save one for a card that did not need it.
    let rarity = naturalRarity;
    const { SanctuaryService } = await import('./sanctuaryService');
    if (await SanctuaryService.useRarityBlessing(naturalRarity, userId)) {
      rarity = 'epic';
    }

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

    // Insert inside a transaction that re-checks. `plantId` is not a unique
    // index, so the existence check above is not a lock: two concurrent callers
    // (the lab's lazy generate, CheckInFlow, and the generate inside
    // updateCardFromCheckIn) could both pass it and both add, putting the same
    // specimen into the collection twice. A Dexie rw transaction serialises
    // them, and the re-check is what makes the loser back out.
    const added = await db.transaction('rw', db.cards, async () => {
      if (await db.cards.where('plantId').equals(plantId).first()) return null;
      await db.cards.add(card);
      return card;
    });
    if (!added) return;

    // Auto-feature if first or legendary+
    const cardCount = await db.cards.where('userId').equals(userId).count();
    if (cardCount === 1 || ['legendary', 'mythic'].includes(rarity)) {
      await this.setFeaturedCard(card.id, userId);
    }

    // Award seeds for new collection item only if species never discovered
    // before. Decided inside the transaction this time. Both concurrent callers
    // previously read discoveredSpecies before either wrote it, so both took
    // this branch: the new_plant bonus was paid twice and the array update lost
    // one of the two species. Recording the species is what makes the decision,
    // so it has to be the read-modify-write that is atomic. The credit follows
    // outside — if it throws, the species stays marked and the bonus is lost
    // once, which is the right direction to fail compared with paying twice.
    const isNewSpecies = await db.transaction('rw', db.userProfile, async () => {
      const fresh = await db.userProfile.get(userId);
      if (!fresh || fresh.discoveredSpecies?.includes(plant.species)) return false;
      await db.userProfile.update(userId, {
        discoveredSpecies: [...(fresh.discoveredSpecies || []), plant.species]
      });
      return true;
    });
    if (isNewSpecies) {
      await this.earnSeeds(ECONOMY_CONFIG.EARNING_BASE.new_plant, 'bonus', `Discovered ${plant.species}`, userId);
    }

    return added;
  }

  static async setFeaturedCard(cardId: string, userId: string = this.getUserId()) {
    // Unset all others
    await db.cards.where('userId').equals(userId).modify({ isFeatured: false });
    // Set new one
    await db.cards.update(cardId, { isFeatured: true });
  }

  static async updateCardFromCheckIn(plantId: string, checkIn: CheckIn): Promise<{
    leveledUp: boolean;
    stageChanged: boolean;
    newLevel: number;
    newStage: GrowthStage;
  } | null> {
    let card = await db.cards.where('plantId').equals(plantId).first();
    if (!card) {
      // Lazy generate if missing
      card = await this.generateCardForPlant(plantId);
    }
    if (!card) return null;

    const plant = await db.plants.get(plantId);
    if (!plant) return null;

    // Battle scar: earned by recovering from critical/watching drift to stable.
    const allCheckIns = await db.checkins.where('plantId').equals(plantId).toArray();
    const currentTime = new Date(checkIn.timestamp).getTime();
    const previousCheckIn = allCheckIns
      .filter(existing => existing.id !== checkIn.id && new Date(existing.timestamp).getTime() < currentTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    const recovered = ['watching', 'alert'].includes(previousCheckIn?.driftStatus || '')
      && checkIn.driftStatus === 'stable';
    const battleScars = recovered
      ? [...(card.battleScars || []), {
          symptom: `Recovered from plant stress - ${new Date(checkIn.timestamp).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`,
          recoveredAt: new Date().toISOString()
        }].slice(-6)
      : (card.battleScars || []);

    const todayDate = new Date();
    const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

    // Check if XP already granted for this plant today
    const alreadyGainedXP = await db.xpLog
      .where('[plantId+date]')
      .equals([plantId, today])
      .count();

    if (alreadyGainedXP > 0) {
      // Still log the check-in stats (and any earned scar) but no XP or Seeds
      await db.cards.update(card.id, {
        checkInsTotal: card.checkInsTotal + 1,
        checkInsHealthy: checkIn.guardianScore >= 80 ? card.checkInsHealthy + 1 : card.checkInsHealthy,
        battleScars
      });
      return { leveledUp: false, stageChanged: false, newLevel: card.level, newStage: card.growthStage };
    }

    // XP gain logic from brief: base 5, excellence +5, stable +3, streak +5
    let xpGain = 5;
    if (checkIn.guardianScore >= 90) xpGain += 5;
    if (checkIn.driftStatus === 'stable') xpGain += 3;

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

    const newStats = this.calculateCardStats(plant, allCheckIns, card.rarity);

    await db.cards.update(card.id, {
      level: newLevel,
      xp: newXp,
      xpToNext: newXpToNext,
      growthStage: newStage,
      abilityUnlocked: newLevel >= 25,
      stats: newStats,
      battleScars,
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

    // One transaction per check-in keeps retries idempotent server-side.
    const perfectBonus = checkIn.guardianScore >= 95 && checkIn.photoBlob
      ? ECONOMY_CONFIG.EARNING_BASE.perfect_checkin
      : 0;
    await this.earnSeeds(
      ECONOMY_CONFIG.EARNING_BASE.checkin + perfectBonus,
      'checkin',
      perfectBonus ? `Check-in: ${plant.name} (precision bonus)` : `Check-in: ${plant.name}`,
      card.userId,
      checkIn.id
    );

    return {
      leveledUp: newLevel > card.level,
      stageChanged: newStage !== card.growthStage,
      newLevel,
      newStage
    };
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

  static async recordCareOff(
    score: number,
    result: 'win' | 'loss' | 'draw',
    userId: string = this.getUserId(),
    // Which rival was faced. Defaults to the original 'bot' sentinel so any
    // existing caller — and every already-stored row — stays valid; the Arena
    // passes the real rung id so the duel history can name the opponent.
    opponentId: string = 'bot'
  ) {
    const careOff = {
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date(),
      opponentId,
      score,
      result
    };
    await db.careOffs.add(careOff);

    if (result === 'win') {
      await this.earnSeeds(ECONOMY_CONFIG.EARNING_BASE.arena_win, 'bonus', 'Care-Off Victory', userId);
    }
  }

  /** The player's arena record, newest first. */
  static async getCareOffHistory(userId: string = this.getUserId()): Promise<CareOff[]> {
    return db.careOffs.where('userId').equals(userId).reverse().sortBy('createdAt');
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

    const propagationCost = ECONOMY_CONFIG.CONVENIENCE_COSTS.propagation_basic;
    if (profile.seeds < propagationCost) {
      throw new Error(`Insufficient seeds. You need ${(propagationCost - profile.seeds).toLocaleString()} more.`);
    }

    // Spend seeds for propagation
    await this.spendSeeds(propagationCost, 'spend', 'Propagation Attempt', userId);

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

  static async updateStreakOnUpload(userId: string = this.getUserId()): Promise<{ currentStreak: number, continuedToday: boolean }> {
    const streakResult = await RewardService.updateStreakOnUpload(userId);
    // Update legacy profile fields for compatibility
    const profile = await this.ensureProfile(userId);
    await db.userProfile.update(userId, {
      currentStreak: streakResult.currentStreak,
      longestStreak: Math.max(profile.longestStreak, streakResult.currentStreak)
    });
    return streakResult;
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

  /**
   * Delegates to the lib policy — the score lives in src/lib/scanReport now,
   * and this wrapper exists for the clinicService.check self-verification.
   */
  static scoreFromScan(healthStatus?: string, severity?: number): number {
    return guardianScoreFromScan(
      normalizeHealthStatus(healthStatus),
      typeof severity === 'number' ? severity : null,
    );
  }

  static async indexScannedPlant(report: PlantScanReport, photoUrl: string | null, userId: string = this.getUserId()): Promise<Plant> {
    const species = (report.scientificName || report.displayName).trim() || 'Unknown';
    // The score and its status label are the server's policy now — the client
    // no longer re-derives them from status strings.
    const score = report.vitals.guardianScore;
    const status: Plant['status'] = report.vitals.statusLabel;
    const now = new Date();
    const owned = await db.plants.where('userId').equals(userId).toArray();
    const key = species.toLowerCase();
    let plant = owned.find(p => !p.isDemo && (p.species || '').toLowerCase() === key);

    const light = report.careParsed.lightLevel;
    const soilMoisture = report.careParsed.soilMoisture;
    const weather = report.weather ?? report.location?.weather;
    const weatherTemp = weather?.temp ?? report.careParsed.temperatureC;
    const weatherHumidity = weather?.humidity ?? null;
    const weatherDescription = weather?.condition ?? report.healthStatus ?? null;

    let finalPhotoUrl = photoUrl;
    if (finalPhotoUrl && finalPhotoUrl.startsWith('data:')) {
      const { StorageService } = await import('./storageService');
      const cloudUrl = await StorageService.uploadPlantPhotoFromDataUrl(finalPhotoUrl, userId);
      if (!cloudUrl) {
        // Offline-first: the cloud copy is a mirror, never a gate. Throwing
        // here used to abort before the Dexie save and lose the diagnosis
        // entirely — the photo stays local and the record still lands.
        console.warn('[gameService] Photo upload unavailable — indexing with the local image.');
      } else {
        finalPhotoUrl = cloudUrl;
      }
    }

    const wateringInterval = report.wateringIntervalDays || 7;
    const nextWater = new Date(now.getTime() + wateringInterval * 86_400_000);

    if (plant) {
      const { PlantService } = await import('./plantService');
      // A photo-less re-index (archive restore) must not blank the photo the
      // plant already has — only write photoUrl when there is one.
      await PlantService.updatePlant(plant.id, {
        ...(finalPhotoUrl ? { photoUrl: finalPhotoUrl } : {}),
        guardianScore: score,
        status,
        checkInTime: 'just now',
        updatedAt: now,
        wateringIntervalDays: plant.wateringIntervalDays ?? wateringInterval,
        nextWaterDue: plant.nextWaterDue ?? nextWater,
        // plant.location is the physical room; the diagnosis already lives
        // in the check-in. Never clobber the room with pathology text.
        location: plant.location,
        recoveryRoadmap: report.timeline?.length ? {
          diagnosis: report.diagnosis,
          timeline: report.timeline,
        } : plant.recoveryRoadmap ?? null,
      });
      plant = {
        ...plant,
        photoUrl: finalPhotoUrl,
        guardianScore: score,
        status,
        updatedAt: now,
        recoveryRoadmap: report.timeline?.length ? {
          diagnosis: report.diagnosis,
          timeline: report.timeline,
        } : plant.recoveryRoadmap ?? null,
      };
    } else {
      const { PlantService } = await import('./plantService');
      plant = await PlantService.addPlant({
        id: crypto.randomUUID(),
        userId,
        name: report.displayName !== 'Botanical Specimen' ? report.displayName : species.split(' ')[0],
        species,
        acquiredAt: now,
        soilType: 'well-draining',
        soilPh: null,
        potSize: '',
        potMaterial: 'plastic',
        location: '',
        latitude: null,
        longitude: null,
        hardinessZone: null,
        checkInTime: 'just now',
        baselineSignature: null,
        guardianScore: score,
        status,
        photoUrl: finalPhotoUrl,
        wateringIntervalDays: wateringInterval,
        nextWaterDue: nextWater,
        lastWateredAt: now,
        createdAt: now,
        updatedAt: now,
        recoveryRoadmap: report.timeline?.length ? {
          diagnosis: report.diagnosis,
          timeline: report.timeline,
        } : null,
      });
    }

    if (report.timeline && report.timeline.length > 0) {
      await db.notes.add({
        id: crypto.randomUUID(),
        userId,
        plantId: plant.id,
        category: 'action',
        content: `Prescribed Clinical Regimen: ${report.diagnosis}\nTimeline:\n${report.timeline.map(t => `• ${t.day}: ${t.action} → ${t.expectedOutcome}`).join('\n')}`,
        tags: ['rx', 'triage', 'regimen'],
        createdAt: now,
      });
    }



    await db.checkins.add({
      id: crypto.randomUUID(),
      plantId: plant.id,
      timestamp: now,
      soilMoisture,
      lightLevel: light,
      changes: report.diagnosis ? [report.diagnosis] : ['Indexed from scan'],
      photoBlob: null,
      photoUrl: finalPhotoUrl,
      signature: null,
      guardianScore: score,
      driftScore: null,
      driftStatus: score >= 80 ? 'stable' : score >= 55 ? 'watching' : 'alert',
      weatherTemp,
      weatherHumidity,
      weatherDescription,
      synced: 0,
    });

    return plant;
  }

  static async getLevelProgress(userId: string = this.getUserId()) {
    return await RewardService.ensureLevelProgress(userId);
  }

  static async getStreakRecord(userId: string = this.getUserId()) {
    return await RewardService.ensureStreakRecord(userId);
  }
}
