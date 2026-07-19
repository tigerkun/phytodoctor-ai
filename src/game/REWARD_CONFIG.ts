/**
 * REWARD & LEVEL SYSTEM CONFIGURATION
 * Comprehensive tables for XP/Seed earnings, level unlocks, and economy rules
 */

export interface RewardAction {
  id: string;
  name: string;
  xp: number;
  seeds: number;
  capsCategory: 'active' | 'burst'; // active = subject to 150/day cap, burst = bypasses cap
  maxPerDay?: number;
  cooldownHours?: number;
  description: string;
}

export interface LevelTier {
  level: number;
  title: string;
  xpRequired: number;
  unlocks: {
    plantSlots?: number;
    features?: string[];
    multipliers?: { seedEarn?: number; xpEarn?: number };
    badges?: string[];
    prestige?: boolean;
  };
  prestige?: boolean;
}

export interface StreakMultiplier {
  day: number;
  multiplier: number;
  milestoneBonus?: { xp: number; seeds: number };
  badgeUnlock?: string;
}

export interface RarityReward {
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  xp: number;
  seeds: number;
  chargeRequired: boolean; // Discovery Charge needed
  description: string;
}

// ============ A. SEED & XP EARN TABLE ============

export const DAILY_RITUALS: RewardAction[] = [
  {
    id: 'daily_login',
    name: 'Daily Login',
    xp: 10,
    seeds: 10,
    capsCategory: 'active',
    description: 'Open the app to start your day'
  },
  {
    id: 'water_reminder_compliance',
    name: 'Watering Reminder Compliance',
    xp: 5,
    seeds: 5,
    capsCategory: 'active',
    maxPerDay: 1,
    cooldownHours: 24,
    description: 'Log a check-in within 1 hour of push notification'
  },
  {
    id: 'care_task_complete',
    name: 'Care Task Complete',
    xp: 10,
    seeds: 8,
    capsCategory: 'active',
    maxPerDay: 5,
    description: 'Mark an AI-prescribed care task as done'
  }
];

export const BASE_DIAGNOSIS_REWARDS: RewardAction[] = [
  {
    id: 'diagnosis_upload',
    name: 'Plant Diagnosis',
    xp: 25,
    seeds: 20,
    capsCategory: 'active',
    maxPerDay: 3,
    cooldownHours: 48,
    description: 'AI confirms living plant, provides assessment'
  },
  {
    id: 'disease_stress_detected',
    name: 'Disease/Stress Detection',
    xp: 10,
    seeds: 10,
    capsCategory: 'active',
    description: 'Diagnosis includes disease or stress identification'
  },
  {
    id: 'treatment_plan_generated',
    name: 'Treatment Plan Generated',
    xp: 10,
    seeds: 10,
    capsCategory: 'active',
    description: 'AI outputs actionable treatment steps'
  },
  {
    id: 'health_score_assigned',
    name: 'Health Score Assignment',
    xp: 5,
    seeds: 5,
    capsCategory: 'active',
    description: 'Finishes the diagnostic loop with health assessment'
  }
];

export const HEALTH_BONUS_REWARDS: RewardAction[] = [
  {
    id: 'health_thriving',
    name: 'Thriving Plant Bonus',
    xp: 25,
    seeds: 20,
    capsCategory: 'active',
    description: 'Plant health score 90-100 (Excellent care)'
  },
  {
    id: 'health_healthy',
    name: 'Healthy Plant Bonus',
    xp: 15,
    seeds: 10,
    capsCategory: 'active',
    description: 'Plant health score 70-89 (Good maintenance)'
  },
  {
    id: 'health_stressed',
    name: 'Stressed Plant Care',
    xp: 5,
    seeds: 5,
    capsCategory: 'active',
    description: 'Plant health score 50-69 (Encouragement to intervene)'
  },
  {
    id: 'health_critical',
    name: 'Critical Care Compassion',
    xp: 2,
    seeds: 2,
    capsCategory: 'active',
    description: 'Plant health score 0-49 (Never zero reward)'
  }
];

export const DISCOVERY_REWARDS: RarityReward[] = [
  {
    rarity: 'common',
    xp: 10,
    seeds: 8,
    chargeRequired: false,
    description: 'Mint, Basil, Aloe, Money Plant'
  },
  {
    rarity: 'uncommon',
    xp: 25,
    seeds: 20,
    chargeRequired: false,
    description: 'Snake Plant, Pothos, Spider Plant'
  },
  {
    rarity: 'rare',
    xp: 75,
    seeds: 60,
    chargeRequired: true,
    description: 'Monstera, Fiddle Leaf Fig (Uses 1 Discovery Charge)'
  },
  {
    rarity: 'epic',
    xp: 200,
    seeds: 150,
    chargeRequired: true,
    description: 'Pink Princess, Dragon Scale (Uses 1 Discovery Charge)'
  },
  {
    rarity: 'legendary',
    xp: 500,
    seeds: 400,
    chargeRequired: true,
    description: 'Corpse Flower, Ghost Orchid (Uses 1 Discovery Charge)'
  },
  {
    rarity: 'mythic',
    xp: 1000,
    seeds: 800,
    chargeRequired: true,
    description: 'Extremely rare ancient discovery (Uses 1 Discovery Charge)'
  }
];

export const SOCIAL_REWARDS: RewardAction[] = [
  {
    id: 'community_post',
    name: 'Community Post',
    xp: 15,
    seeds: 10,
    capsCategory: 'active',
    maxPerDay: 1,
    description: 'Share plant photo to community (verified non-blurry, non-duplicate)'
  },
  {
    id: 'post_ten_likes',
    name: 'Post Engagement',
    xp: 10,
    seeds: 10,
    capsCategory: 'active',
    description: 'Your post receives 10 likes'
  },
  {
    id: 'helpful_comment',
    name: 'Helpful Comment',
    xp: 5,
    seeds: 3,
    capsCategory: 'active',
    maxPerDay: 5,
    description: 'Comment gets upvoted by community'
  }
];

export const REFERRAL_REWARDS: RewardAction[] = [
  {
    id: 'referral_signup',
    name: 'Friend Sign-up',
    xp: 50,
    seeds: 30,
    capsCategory: 'burst',
    description: 'Friend signs up via your referral (unique device + IP)'
  },
  {
    id: 'referral_first_diagnosis',
    name: 'Friend First Diagnosis',
    xp: 100,
    seeds: 75,
    capsCategory: 'burst',
    description: 'Referred friend completes their first diagnosis'
  },
  {
    id: 'referral_level_5',
    name: 'Friend Reaches Level 5',
    xp: 200,
    seeds: 150,
    capsCategory: 'burst',
    description: 'Referred friend reaches Level 5'
  }
];

// ============ B. LEVEL SYSTEM (25 TIERS) ============

export const LEVEL_TIERS: LevelTier[] = [
  {
    level: 1,
    title: 'Sprout',
    xpRequired: 0,
    unlocks: {
      plantSlots: 3,
      features: [],
      badges: ['sprout']
    }
  },
  {
    level: 2,
    title: 'Germinator',
    xpRequired: 100,
    unlocks: {
      plantSlots: 4,
      features: []
    }
  },
  {
    level: 3,
    title: 'Seedling',
    xpRequired: 250,
    unlocks: {
      plantSlots: 5,
      features: ['Community read access']
    }
  },
  {
    level: 4,
    title: 'Root-Bound',
    xpRequired: 450,
    unlocks: {
      features: ['Community post access']
    }
  },
  {
    level: 5,
    title: 'Leaf-Bearer',
    xpRequired: 700,
    unlocks: {
      features: ['Marketplace unlock', 'Voucher tier 1']
    }
  },
  {
    level: 6,
    title: 'Pruner',
    xpRequired: 1000,
    unlocks: {
      features: ['Streak Freeze x1/month']
    }
  },
  {
    level: 7,
    title: 'Gardener',
    xpRequired: 1400,
    unlocks: {
      features: ['Custom plant nicknames']
    }
  },
  {
    level: 8,
    title: 'Cultivator',
    xpRequired: 1900,
    unlocks: {
      features: ['Early Market access (12h early)']
    }
  },
  {
    level: 9,
    title: 'Pollinator',
    xpRequired: 2500,
    unlocks: {
      features: ['Seed gifting (100/week)']
    }
  },
  {
    level: 10,
    title: 'Botanist',
    xpRequired: 3200,
    unlocks: {
      features: ['Free shipping vouchers', 'Botanist badge']
    }
  },
  {
    level: 11,
    title: 'Herbalist',
    xpRequired: 4000,
    unlocks: {
      features: ['Growth analytics charts']
    }
  },
  {
    level: 12,
    title: 'Horticulturist',
    xpRequired: 5000,
    unlocks: {
      features: ['Pro trial (3 days)']
    }
  },
  {
    level: 13,
    title: 'Arborist',
    xpRequired: 6200,
    unlocks: {
      multipliers: { seedEarn: 1.05 },
      features: ['+5% Permanent Seed Earn']
    }
  },
  {
    level: 14,
    title: 'Master Grower',
    xpRequired: 7600,
    unlocks: {
      features: ['Streak Freeze x2/month']
    }
  },
  {
    level: 15,
    title: 'Plant Whisperer',
    xpRequired: 9200,
    unlocks: {
      features: ['Free custom theme', 'Whisperer frame']
    }
  },
  {
    level: 16,
    title: 'Greenhouse Keeper',
    xpRequired: 11000,
    unlocks: {
      features: ['Priority AI Processing Queue']
    }
  },
  {
    level: 17,
    title: 'Seed Keeper',
    xpRequired: 13000,
    unlocks: {
      multipliers: { seedEarn: 1.1 },
      features: ['+10% Seed-to-Voucher exchange']
    }
  },
  {
    level: 18,
    title: 'Flora Sage',
    xpRequired: 15200,
    unlocks: {
      features: ['Legendary market drop access']
    }
  },
  {
    level: 19,
    title: 'Earth Shaper',
    xpRequired: 17700,
    unlocks: {
      features: ['Shaper title in global chat']
    }
  },
  {
    level: 20,
    title: 'Botanical Guardian',
    xpRequired: 20500,
    unlocks: {
      multipliers: { seedEarn: 1.15 },
      features: ['+5% permanent marketplace discount', 'Guardian badge']
    }
  },
  {
    level: 21,
    title: 'Verdant Lord',
    xpRequired: 24000,
    unlocks: {
      prestige: true,
      features: ['Prestige: Golden leaf trail on avatar']
    }
  },
  {
    level: 22,
    title: 'Canopy Sovereign',
    xpRequired: 28000,
    unlocks: {
      prestige: true,
      features: ['Prestige: Animated profile border']
    }
  },
  {
    level: 23,
    title: 'Mycorrhizal Master',
    xpRequired: 32500,
    unlocks: {
      prestige: true,
      features: ['Prestige: Root Network community channel']
    }
  },
  {
    level: 24,
    title: 'Photosynthesis Prime',
    xpRequired: 37500,
    unlocks: {
      prestige: true,
      features: ['Prestige: Nameplate glow effect']
    }
  },
  {
    level: 25,
    title: 'Eternal Bloom',
    xpRequired: 43000,
    unlocks: {
      prestige: true,
      features: ['Prestige: Hall of Fame induction', 'Lifetime 50% Pro discount']
    }
  }
];

// ============ C. STREAK SYSTEM ============

export const STREAK_MULTIPLIERS: StreakMultiplier[] = [
  { day: 7, multiplier: 2.0, milestoneBonus: { xp: 50, seeds: 50 }, badgeUnlock: 'week-warrior' },
  { day: 14, multiplier: 2.5, milestoneBonus: { xp: 100, seeds: 100 }, badgeUnlock: 'diligent' },
  { day: 30, multiplier: 3.0, milestoneBonus: { xp: 200, seeds: 200 }, badgeUnlock: 'seasoned' },
  { day: 60, multiplier: 3.5, milestoneBonus: { xp: 400, seeds: 400 }, badgeUnlock: 'devoted' },
  { day: 100, multiplier: 5.0, milestoneBonus: { xp: 800, seeds: 800 }, badgeUnlock: 'century-bloom' }
];

// ============ D. CAPS & LIMITS ============

export const REWARD_CAPS = {
  ACTIVE_DAILY_SEED_CAP: 150, // Seeds from diagnoses, logins, tasks, posts
  DISCOVERY_CHARGES_PER_WEEK: 1, // Resets Monday 00:00 UTC
  STREAK_FREEZE_LEVELS: {
    6: 1, // 1 freeze per month at level 6+
    14: 2, // 2 freezes per month at level 14+
    pro_base: 1 // Pro users get +1 automatic per month
  },
  MAX_CARE_TASKS_PER_DAY: 5,
  MAX_COMMUNITY_POSTS_PER_DAY: 1,
  MAX_DIAGNOSES_PER_DAY: 3,
  DIAGNOSIS_COOLDOWN_HOURS: 48,
  SEED_GIFTING_WEEKLY_LIMIT: 100
};

// ============ E. ANTI-SPAM GATES ============

export const ANTI_SPAM_CONFIG = {
  PERCEPTUAL_HASH_SIMILARITY_THRESHOLD: 0.85,
  DUPLICATE_CHECK_WINDOW_DAYS: 7,
  INTERACTION_ENTROPY_WINDOW_DAYS: 7,
  REFERRAL_FRAUD_CHECK: 'device_fingerprint + ip_hash + 30day_shadowban',
  DUPLICATE_IMAGE_MESSAGE: 'We already checked this plant recently. Try again in {hours} hours.',
  FAKE_PLANT_MESSAGE: 'We couldn\'t verify a living plant in this image. Try natural lighting and clear leaves.'
};

// ============ F. SEED MULTIPLIERS ============

export const SEED_MULTIPLIERS = {
  free: 1.0,
  pro: 1.5 // Pro users earn 50% more seeds (except for level-based multipliers)
};

// ============ G. VOUCHER ECONOMY ============

export interface Voucher {
  id: string;
  type: 'sprout_saver' | 'garden_pass' | 'bloom_credit' | 'master_perk';
  seedCost: number;
  realValue: number; // in rupees for display
  discount: string;
  description: string;
}

export const VOUCHERS: Voucher[] = [
  {
    id: 'sprout_saver',
    type: 'sprout_saver',
    seedCost: 500,
    realValue: 50,
    discount: '₹50 off any order',
    description: 'Perfect for first purchases'
  },
  {
    id: 'garden_pass',
    type: 'garden_pass',
    seedCost: 1500,
    realValue: 150,
    discount: '₹150 off + Free Shipping',
    description: 'Great value for regular orders'
  },
  {
    id: 'bloom_credit',
    type: 'bloom_credit',
    seedCost: 5000,
    realValue: 500,
    discount: '₹500 flat order credit',
    description: 'Massive savings for big orders'
  },
  {
    id: 'master_perk',
    type: 'master_perk',
    seedCost: 10000,
    realValue: 1200,
    discount: '₹1,200 off + Free Premium Pot',
    description: 'Elite reward for dedicated gardeners'
  }
];

// ============ H. CONVERSION RATES ============

export const SEED_CONVERSION = {
  SEEDS_TO_RUPEE_DISPLAY: 100, // 100 seeds ≈ ₹1 for UI display
  EXCHANGE_RATES: {
    level_0: 1.0,
    level_17: 1.1, // +10% at Seed Keeper
    // Additional multipliers from level system
  }
};
