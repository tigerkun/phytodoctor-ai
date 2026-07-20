export type SoilType = 'clay' | 'sandy' | 'loamy' | 'silt' | 'peaty' | 'chalky' | 'well-draining' | 'moisture-retentive' | null;
export type PotMaterial = 'terracotta' | 'plastic' | 'ceramic' | 'fabric' | null;
export type MoistureLevel = 'Dry' | 'Moist' | 'Wet';
export type LightLevel = 'Direct' | 'Indirect' | 'Low';
export type StressorType = 'Light' | 'Water' | 'Humidity' | 'Temperature' | 'Nutrition' | 'Unknown';
export type PredictionOutcome = 'pending' | 'prevented' | 'occurred' | 'dismissed' | null;
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type GrowthStage = 'sprout' | 'seedling' | 'juvenile' | 'mature' | 'ancient';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface PlantSignature {
  hsvHistogram: number[];
  leafContours: number;
  meanRgb: [number, number, number];
  textureEnergy: number;
  computedAt: Date;
}

export interface Plant {
  id: string;
  userId?: string;
  name: string;
  species: string;
  acquiredAt: Date;
  soilType: SoilType;
  soilPh: number | null;
  potSize: string;
  potMaterial: PotMaterial;
  location: string;
  latitude: number | null;
  longitude: number | null;
  hardinessZone: string | null;
  checkInTime: string;
  baselineSignature: PlantSignature | null;
  guardianScore: number;
  status: 'Stable' | 'Watching' | 'Alert' | 'Recovering';
  photoUrl: string;
  createdAt: Date;
  updatedAt: Date;
  isDemo?: boolean;
}

export interface CheckIn {
  id: string;
  plantId: string;
  timestamp: Date;
  soilMoisture: MoistureLevel;
  lightLevel: LightLevel;
  changes: string[];
  photoBlob: Blob | null;
  photoUrl: string | null;
  signature: PlantSignature | null;
  guardianScore: number;
  driftScore: number | null;
  driftStatus: 'stable' | 'watching' | 'alert' | null;
  weatherTemp: number | null;
  weatherHumidity: number | null;
  weatherDescription: string | null;
  synced: number;
  isDemo?: boolean;
}

export interface Prediction {
  id: string;
  plantId: string;
  predictedAt: Date;
  riskScore: number;
  primaryStressor: StressorType;
  confidence: number;
  reasoning: string[];
  triggeredAlert: number;
  alertSentAt: Date | null;
  outcome: PredictionOutcome;
  outcomeRecordedAt: Date | null;
  modelVersion: string;
}

export interface UserGameProfile {
  userId: string;
  username: string;
  avatarUrl: string;
  equippedTitle: string | null;
  seeds: number;
  currentStreak: number;
  longestStreak: number;
  collectionSize: number;
  totalXP: number;
  tier: 'free' | 'pro';
  discoveredSpecies: string[];
  gender?: string;
  experienceLevel?: 'novice' | 'intermediate' | 'expert';
  environment?: 'indoor' | 'outdoor' | 'greenhouse' | 'mixed';
  isDemo?: boolean;
}

export interface PhytoCard {
  id: string;
  userId: string;
  plantId: string;
  species: string;
  commonName: string;
  rarity: RarityTier;
  growthStage: GrowthStage;
  stats: {
    attack: number;
    defense: number;
    health: number;
    speed: number;
    longevity: number;
  };
  level: number;
  xp: number;
  xpToNext: number;
  abilityUnlocked: boolean;
  acquiredAt: Date;
  daysAlive: number;
  checkInsTotal: number;
  checkInsHealthy: number;
  alertsSurvived: number;
  currentStreak: number;
  longestStreak: number;
  isFavorite: boolean;
  isFeatured: boolean;
  admirations: number;
  battleScars: string[];
  frameSkin: string | null;
  altArt: string | null;
  isDemo?: boolean;
}

export interface UserSubscription {
  userId: string;
  tier: 'free' | 'pro';
  startedAt: Date;
  expiresAt: Date;
  cancelAtPeriodEnd: boolean;
}

export interface SeedTransaction {
  id: string;
  userId: string;
  amount: number;
  source: 'checkin' | 'bonus' | 'spend' | 'reward';
  description: string;
  createdAt: Date;
}

export interface UserCosmetic {
  userId: string;
  itemId: string;
  itemType: string;
  equipped: boolean;
  purchasedAt: Date;
}

export interface CareOff {
  id: string;
  userId: string;
  createdAt: Date;
  opponentId: string;
  score: number;
  result: 'win' | 'loss' | 'draw';
}

export interface Propagation {
  id: string;
  parentCardId: string;
  babyCardId: string;
  userId: string;
  isHybrid: boolean;
  hybridParents: [string, string] | null;
  success: boolean;
  createdAt: Date;
}

export interface PlantNote {
  id: string;
  plantId: string;
  userId: string;
  content: string;
  category: 'observation' | 'action' | 'milestone';
  tags: string[];
  createdAt: Date;
}

export interface CardStats {
  attack: number;
  defense: number;
  health: number;
  speed: number;
  longevity: number;
}

export interface Alert {
  id: string;
  predictionId: string;
  plantId: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  sentAt: Date;
  readAt: Date | null;
  actedAt?: Date | null;
  dismissedAt?: Date | null;
}

// ============ REWARD & LEVEL SYSTEM TYPES ============

export interface DailyRewardCap {
  userId: string;
  date: string; // YYYY-MM-DD UTC
  seedsEarned: number;
  seedsSpent: number;
  activeSeedsRemaining: number;
  lastUpdated: Date;
}

export interface LevelProgress {
  userId: string;
  currentLevel: number;
  totalXP: number;
  xpToNextLevel: number;
  xpProgress: number; // 0-100 percentage
  lastLevelUpAt: Date | null;
  unlockedFeatures: string[];
  permanentMultipliers: {
    seedEarn?: number;
    xpEarn?: number;
  };
}

export interface StreakRecord {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string; // YYYY-MM-DD UTC
  streakMultiplier: number;
  freezesAvailableThisMonth: number;
  freezesUsedThisMonth: number;
  nextResetDate: string; // YYYY-MM-DD UTC (next month)
}

export interface RewardHistory {
  id: string;
  userId: string;
  actionId: string;
  actionName: string;
  xpEarned: number;
  seedsEarned: number;
  capsCategory: 'active' | 'burst';
  context?: {
    plantId?: string;
    plantSpecies?: string;
    healthScore?: number;
    rarity?: string;
    commentId?: string;
  };
  createdAt: Date;
}

export interface DiscoveryRecord {
  userId: string;
  species: string;
  rarity: RarityTier;
  discoveredAt: Date;
  chargeUsed: boolean;
  xpEarned: number;
  seedsEarned: number;
}

export interface StreakFreeze {
  id: string;
  userId: string;
  monthYear: string; // YYYY-MM format
  freezesRemaining: number;
  freezesUsed: number;
  tier: 'free' | 'pro';
  lastUsedAt: Date | null;
}
