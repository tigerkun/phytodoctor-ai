import Dexie, { type Table } from 'dexie';
import { 
  Plant, 
  CheckIn, 
  Prediction, 
  Alert, 
  PhytoCard, 
  UserGameProfile,
  UserSubscription,
  SeedTransaction,
  UserCosmetic,
  CareOff,
  Propagation,
  PlantNote,
  RarityTier,
  GrowthStage,
  CardStats,
  DailyRewardCap,
  LevelProgress,
  StreakRecord,
  RewardHistory,
  DiscoveryRecord,
  StreakFreeze,
  SanctuaryStock
} from '../types';

export type { 
  Plant, 
  CheckIn, 
  Prediction, 
  Alert, 
  PhytoCard, 
  UserGameProfile,
  UserSubscription,
  SeedTransaction,
  UserCosmetic,
  CareOff,
  Propagation,
  PlantNote,
  RarityTier,
  GrowthStage,
  CardStats,
  DailyRewardCap,
  LevelProgress,
  StreakRecord,
  RewardHistory,
  DiscoveryRecord,
  StreakFreeze
};

export interface SensorReading {
  id: string;
  plantId: string;
  timestamp: Date;
  sensorType: 'ambient_light' | 'geolocation' | 'device_motion';
  value: number | any;
  unit: string;
  source: 'hardware' | 'user_input' | 'simulated';
}

export interface Metric {
  id?: number;
  type: 'rule_hit' | 'gemini_hit' | 'latency' | 'drift_event' | 'error';
  value: number | string;
  timestamp: Date;
  context?: string;
}

export interface XPLogEntry {
  id?: number;
  plantId: string;
  date: string;
  xp: number;
  checkInId: string;
}

class BotanicalDB extends Dexie {
  plants!: Table<Plant>;
  checkins!: Table<CheckIn>;
  predictions!: Table<Prediction>;
  sensorReadings!: Table<SensorReading>;
  alerts!: Table<Alert>;
  photos!: Table<{ id: string; blob: Blob; createdAt: Date }>;
  metrics!: Table<Metric>;
  cards!: Table<PhytoCard>;
  userProfile!: Table<UserGameProfile>;
  xpLog!: Table<XPLogEntry>;
  subscriptions!: Table<UserSubscription>;
  seedTransactions!: Table<SeedTransaction>;
  cosmetics!: Table<UserCosmetic>;
  careOffs!: Table<CareOff>;
  propagations!: Table<Propagation>;
  notes!: Table<PlantNote>;
  dailyRewardCaps!: Table<DailyRewardCap>;
  levelProgress!: Table<LevelProgress>;
  streakRecords!: Table<StreakRecord>;
  rewardHistory!: Table<RewardHistory>;
  discoveryRecords!: Table<DiscoveryRecord>;
  streakFreezes!: Table<StreakFreeze>;
  sanctuaryStock!: Table<SanctuaryStock>;
  seedSyncOutbox!: Table<{
    id: string;
    userId: string;
    amount: number;
    source: string;
    description: string;
    createdAt: number;
    attempts: number;
    lastError?: string;
    status: 'pending' | 'dead';
  }>;

  constructor() {
    super('BotanicalGuardian');
    this.version(16).stores({
      plants: 'id, userId, species, isDemo, createdAt',
      checkins: 'id, plantId, timestamp, synced, isDemo, [plantId+timestamp]',
      predictions: 'id, plantId, predictedAt, outcome, triggeredAlert, [plantId+predictedAt]',
      sensorReadings: 'id, plantId, timestamp, sensorType, [plantId+sensorType+timestamp]',
      alerts: 'id, predictionId, plantId, sentAt, readAt, [plantId+sentAt]',
      photos: 'id, createdAt',
      metrics: '++id, type, timestamp',
      cards: 'id, plantId, userId, species, rarity, level, isFeatured, isDemo',
      userProfile: 'userId, isDemo',
      xpLog: '++id, plantId, date, [plantId+date]',
      subscriptions: 'userId, tier',
      seedTransactions: 'id, userId, source, createdAt',
      cosmetics: '[userId+itemId], userId, itemType, equipped',
      careOffs: 'id, userId, createdAt, result',
      propagations: 'id, userId, parentCardId, createdAt, success',
      notes: 'id, plantId, createdAt, *tags',
      dailyRewardCaps: '[userId+date], userId, lastUpdated',
      levelProgress: 'userId, currentLevel, lastLevelUpAt',
      streakRecords: 'userId, lastLoginDate',
      rewardHistory: 'id, userId, actionId, createdAt, [userId+createdAt]',
      discoveryRecords: '[userId+species], userId, rarity, discoveredAt',
      streakFreezes: '[userId+monthYear], userId, monthYear, lastUsedAt'
    });
    // v17: adds passwordHash column to userProfile for client-side auth security
    this.version(17).stores({
      plants: 'id, userId, species, isDemo, createdAt',
      checkins: 'id, plantId, timestamp, synced, isDemo, [plantId+timestamp]',
      predictions: 'id, plantId, predictedAt, outcome, triggeredAlert, [plantId+predictedAt]',
      sensorReadings: 'id, plantId, timestamp, sensorType, [plantId+sensorType+timestamp]',
      alerts: 'id, predictionId, plantId, sentAt, readAt, [plantId+sentAt]',
      photos: 'id, createdAt',
      metrics: '++id, type, timestamp',
      cards: 'id, plantId, userId, species, rarity, level, isFeatured, isDemo',
      userProfile: 'userId, isDemo, passwordHash',
      xpLog: '++id, plantId, date, [plantId+date]',
      subscriptions: 'userId, tier',
      seedTransactions: 'id, userId, source, createdAt',
      cosmetics: '[userId+itemId], userId, itemType, equipped',
      careOffs: 'id, userId, createdAt, result',
      propagations: 'id, userId, parentCardId, createdAt, success',
      notes: 'id, plantId, createdAt, *tags',
      dailyRewardCaps: '[userId+date], userId, lastUpdated',
      levelProgress: 'userId, currentLevel, lastLevelUpAt',
      streakRecords: 'userId, lastLoginDate',
      rewardHistory: 'id, userId, actionId, createdAt, [userId+createdAt]',
      discoveryRecords: '[userId+species], userId, rarity, discoveredAt',
      streakFreezes: '[userId+monthYear], userId, monthYear, lastUsedAt'
    });
    // v18: adds seedSyncOutbox for resilient seed syncing
    this.version(18).stores({
      plants: 'id, userId, species, isDemo, createdAt',
      checkins: 'id, plantId, timestamp, synced, isDemo, [plantId+timestamp]',
      predictions: 'id, plantId, predictedAt, outcome, triggeredAlert, [plantId+predictedAt]',
      sensorReadings: 'id, plantId, timestamp, sensorType, [plantId+sensorType+timestamp]',
      alerts: 'id, predictionId, plantId, sentAt, readAt, [plantId+sentAt]',
      photos: 'id, createdAt',
      metrics: '++id, type, timestamp',
      cards: 'id, plantId, userId, species, rarity, level, isFeatured, isDemo',
      userProfile: 'userId, isDemo, passwordHash',
      xpLog: '++id, plantId, date, [plantId+date]',
      subscriptions: 'userId, tier',
      seedTransactions: 'id, userId, source, createdAt',
      cosmetics: '[userId+itemId], userId, itemType, equipped',
      careOffs: 'id, userId, createdAt, result',
      propagations: 'id, userId, parentCardId, createdAt, success',
      notes: 'id, plantId, createdAt, *tags',
      dailyRewardCaps: '[userId+date], userId, lastUpdated',
      levelProgress: 'userId, currentLevel, lastLevelUpAt',
      streakRecords: 'userId, lastLoginDate',
      rewardHistory: 'id, userId, actionId, createdAt, [userId+createdAt]',
      discoveryRecords: '[userId+species], userId, rarity, discoveredAt',
      streakFreezes: '[userId+monthYear], userId, monthYear, lastUsedAt',
      seedSyncOutbox: 'id, userId'
    });
    // v19: normalise battleScars from string[] → { symptom, recoveredAt }[]
    // Any card written before this version has plain strings; wrap them so
    // PlantDetail renders correctly. recoveredAt is null for migrated entries.
    this.version(19).stores({
      plants: 'id, userId, species, isDemo, createdAt',
      checkins: 'id, plantId, timestamp, synced, isDemo, [plantId+timestamp]',
      predictions: 'id, plantId, predictedAt, outcome, triggeredAlert, [plantId+predictedAt]',
      sensorReadings: 'id, plantId, timestamp, sensorType, [plantId+sensorType+timestamp]',
      alerts: 'id, predictionId, plantId, sentAt, readAt, [plantId+sentAt]',
      photos: 'id, createdAt',
      metrics: '++id, type, timestamp',
      cards: 'id, plantId, userId, species, rarity, level, isFeatured, isDemo',
      userProfile: 'userId, isDemo, passwordHash',
      xpLog: '++id, plantId, date, [plantId+date]',
      subscriptions: 'userId, tier',
      seedTransactions: 'id, userId, source, createdAt',
      cosmetics: '[userId+itemId], userId, itemType, equipped',
      careOffs: 'id, userId, createdAt, result',
      propagations: 'id, userId, parentCardId, createdAt, success',
      notes: 'id, plantId, createdAt, *tags',
      dailyRewardCaps: '[userId+date], userId, lastUpdated',
      levelProgress: 'userId, currentLevel, lastLevelUpAt',
      streakRecords: 'userId, lastLoginDate',
      rewardHistory: 'id, userId, actionId, createdAt, [userId+createdAt]',
      discoveryRecords: '[userId+species], userId, rarity, discoveredAt',
      streakFreezes: '[userId+monthYear], userId, monthYear, lastUsedAt',
      seedSyncOutbox: 'id, userId'
    }).upgrade(tx => tx.table('cards').toCollection().modify(card => {
      if (!Array.isArray(card.battleScars)) return;
      card.battleScars = card.battleScars.map((s: unknown) =>
        typeof s === 'string' ? { symptom: s, recoveredAt: null } : s
      );
    }));
    // v20: outbox rows gain delivery bookkeeping. createdAt restores FIFO
    // ordering (the primary key is a random UUID), attempts/status implement
    // a dead-letter ceiling so a persistently failing sync cannot retry
    // forever. Queued deltas from v19 are preserved as pending.
    this.version(20).stores({
      seedSyncOutbox: 'id, userId, status, [userId+status]'
    }).upgrade(tx => tx.table('seedSyncOutbox').toCollection().modify(row => {
      if (row.status === undefined) {
        row.status = 'pending';
        row.attempts = row.attempts ?? 0;
        row.createdAt = row.createdAt ?? Date.now();
      }
    }));
    // v21: consumables bought with seeds from the Sanctuary shelf. Count-based,
    // so a Keeper holding three of something has one row reading 3.
    this.version(21).stores({
      sanctuaryStock: '[userId+itemId], userId, itemId'
    });
  }
}

export const db = new BotanicalDB();
