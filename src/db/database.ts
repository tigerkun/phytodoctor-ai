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
  StreakFreeze
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
  }
}

export const db = new BotanicalDB();
