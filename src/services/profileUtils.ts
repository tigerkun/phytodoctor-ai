import { LEVEL_TIERS, STREAK_MULTIPLIERS } from '../game/REWARD_CONFIG';

export interface ProfileBadgeCriteria {
  currentStreak: number;
  cardCount: number;
  tier: 'free' | 'pro';
  totalXP: number;
  mythicCount: number;
}

export interface ProfileBadgeStatus {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
  category: 'vigil' | 'collection' | 'fellowship' | 'mastery';
}

export function evaluateProfileBadges(criteria: ProfileBadgeCriteria): ProfileBadgeStatus[] {
  const currentStreak = Math.max(0, criteria?.currentStreak || 0);
  const cardCount = Math.max(0, criteria?.cardCount || 0);
  const tier = criteria?.tier || 'free';
  const totalXP = Math.max(0, criteria?.totalXP || 0);
  const mythicCount = Math.max(0, criteria?.mythicCount || 0);

  return [
    {
      id: 'week_one',
      label: 'Week One Vigil',
      description: 'Maintained seven consecutive days of sanctuary surveillance',
      unlocked: currentStreak >= 7,
      category: 'vigil'
    },
    {
      id: 'collector',
      label: 'Herbarium Collector',
      description: 'Indexed at least five distinct botanical specimens in vault',
      unlocked: cardCount >= 5,
      category: 'collection'
    },
    {
      id: 'scholar_pro',
      label: 'Guild Scholar',
      description: 'Holds an active Royal Fellowship Pro commission',
      unlocked: tier === 'pro',
      category: 'fellowship'
    },
    {
      id: 'advancer',
      label: 'Grand Advancer',
      description: 'Accumulated over 1,000 total botanical mastery XP',
      unlocked: totalXP >= 1000,
      category: 'mastery'
    },
    {
      id: 'centurion',
      label: 'Centurion Scout',
      description: 'Attained first century of experience (100+ XP)',
      unlocked: totalXP >= 100,
      category: 'mastery'
    },
    {
      id: 'mythic_patron',
      label: 'Mythic Custodian',
      description: 'Secured at least one legendary or mythic botanical accession',
      unlocked: mythicCount >= 1,
      category: 'collection'
    }
  ];
}

export function calculateLevelProgression(totalXP: number) {
  const safeXP = Number.isFinite(totalXP) ? Math.max(0, Math.floor(totalXP)) : 0;
  const tier = [...LEVEL_TIERS].reverse().find(t => t.xpRequired <= safeXP) || LEVEL_TIERS[0];
  const currentLevel = tier.level;
  const currentTier = LEVEL_TIERS[currentLevel - 1] || LEVEL_TIERS[0];
  const isMaxLevel = currentLevel >= LEVEL_TIERS.length;
  const nextTier = isMaxLevel ? currentTier : (LEVEL_TIERS[currentLevel] || currentTier);

  const xpForCurrent = currentTier.xpRequired;
  const xpForNext = nextTier.xpRequired;
  const span = Math.max(1, xpForNext - xpForCurrent);

  const xpProgress = isMaxLevel ? 100 : Math.min(100, Math.max(0, Math.floor(((safeXP - xpForCurrent) / span) * 100)));
  const xpToNext = isMaxLevel ? 0 : Math.max(0, xpForNext - safeXP);

  return {
    currentLevel,
    title: tier.title,
    totalXP: safeXP,
    xpProgress,
    xpToNext,
    isMaxLevel,
    nextTitle: isMaxLevel ? 'Guild Master Supreme' : nextTier.title,
    nextUnlock: isMaxLevel ? 'Lifetime Guild Master Prestige' : (nextTier.unlocks?.features?.[0] || 'Guild Master Prestige')
  };
}

export function getStreakMultiplier(streakDays: number): number {
  if (!Number.isFinite(streakDays) || streakDays < 1) return 1.0;
  const matching = [...STREAK_MULTIPLIERS]
    .sort((a, b) => b.day - a.day)
    .find(m => streakDays >= m.day);
  return matching ? matching.multiplier : 1.0;
}

export function formatFolioSerial(userId?: string | null): string {
  const safeId = typeof userId === 'string' && userId.length > 0 ? userId : 'local_user';
  const hash = Array.from(safeId).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 10000, 7).toString().padStart(4, '0');
  return `FOLIO-${hash}-GM`;
}

export function parseSettingToggle(stored: string | null | undefined, defaultValue = true): boolean {
  if (stored === null || stored === undefined) return defaultValue;
  return stored === 'true';
}
