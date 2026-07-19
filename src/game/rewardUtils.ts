/**
 * REWARD INTEGRATION UTILITIES
 * Helper functions for easy integration across all pages
 */

import { GameService } from '../services/gameService';
import { type RarityTier } from '../types';

export interface RewardResult {
  xpAwarded: number;
  seedsAwarded: number;
  capExceeded?: boolean;
  totalSeeds?: number;
}

/**
 * Award reward and return result for toast notification
 * Usage: const result = await awardReward('daily_login', { plantId: '123' });
 */
export async function awardReward(
  actionId: string,
  context?: Record<string, any>,
  userId?: string
): Promise<RewardResult> {
  try {
    const result = await GameService.awardRewardForAction(actionId, context, userId);
    const profile = await GameService.ensureProfile(userId);
    return {
      ...result,
      totalSeeds: profile.seeds
    };
  } catch (error) {
    console.error(`Failed to award ${actionId}:`, error);
    throw error;
  }
}

/**
 * Award discovery reward when player discovers new species
 * Usage: await awardDiscovery('Monstera Deliciosa', 'rare');
 */
export async function awardDiscovery(
  species: string,
  rarity: RarityTier,
  userId?: string
): Promise<RewardResult> {
  try {
    const result = await GameService.awardDiscoveryReward(species, rarity, userId);
    const profile = await GameService.ensureProfile(userId);
    return {
      ...result,
      totalSeeds: profile.seeds
    };
  } catch (error) {
    console.error(`Failed to award discovery for ${species}:`, error);
    throw error;
  }
}

/**
 * Update streak on login (call once per app open)
 * Usage: await updateLoginStreak();
 */
export async function updateLoginStreak(userId?: string): Promise<void> {
  try {
    await GameService.updateStreakOnLogin(userId);
  } catch (error) {
    console.error('Failed to update streak:', error);
    // Don't throw - streak update is non-critical
  }
}

/**
 * Get formatted reward message for notifications
 */
export function getRewardMessage(actionName: string, capExceeded = false): string {
  if (capExceeded) {
    return `${actionName} (Daily cap reached!)`;
  }
  return actionName;
}

/**
 * Get emoji for reward action
 */
export function getActionEmoji(actionId: string): string {
  const emojiMap: Record<string, string> = {
    daily_login: '🌅',
    diagnosis_upload: '🔍',
    disease_stress_detected: '⚠️',
    treatment_plan_generated: '📋',
    health_score_assigned: '💚',
    health_thriving: '🌟',
    health_healthy: '✅',
    health_stressed: '😰',
    health_critical: '🚨',
    community_post: '📱',
    post_ten_likes: '❤️',
    helpful_comment: '💬',
    arena_win: '🏆',
    propagation: '🌱'
  };
  return emojiMap[actionId] || '🎉';
}

/**
 * Format seed amount for display
 */
export function formatSeeds(amount: number): string {
  if (amount === 0) return '0';
  return `${amount > 0 ? '+' : ''}${amount}`;
}

/**
 * Check if user has hit daily cap
 */
export async function checkDailyCapStatus(userId?: string): Promise<{ remaining: number; capReached: boolean }> {
  try {
    const cap = await GameService.getProfile(userId);
    // In a real implementation, query the dailyRewardCaps table
    // For now, this is a placeholder
    return { remaining: 150, capReached: false };
  } catch (error) {
    console.error('Failed to check daily cap:', error);
    return { remaining: 0, capReached: true };
  }
}

/**
 * Get level info for display
 */
export async function getLevelInfo(userId?: string) {
  try {
    return await GameService.getLevelProgress(userId);
  } catch (error) {
    console.error('Failed to get level info:', error);
    return null;
  }
}

/**
 * Get streak info for display
 */
export async function getStreakInfo(userId?: string) {
  try {
    return await GameService.getStreakRecord(userId);
  } catch (error) {
    console.error('Failed to get streak info:', error);
    return null;
  }
}

/**
 * Common reward scenarios (for quick integration)
 */
export const COMMON_REWARDS = {
  async diagnose(plantId: string) {
    return awardReward('diagnosis_upload', { plantId });
  },
  
  async loginDaily() {
    return awardReward('daily_login');
  },
  
  async completeCheckIn(plantId: string) {
    return awardReward('care_task_complete', { plantId });
  },
  
  async postCommunity(postId: string) {
    return awardReward('community_post', { postId });
  },
  
  async winBattle(opponentId: string) {
    return awardReward('arena_win', { opponentId });
  },
  
  async discoverNewSpecies(species: string, rarity: RarityTier) {
    return awardDiscovery(species, rarity);
  },
  
  async propagateCard(parentId: string) {
    return awardReward('propagation', { parentCardId: parentId });
  }
};

export default {
  awardReward,
  awardDiscovery,
  updateLoginStreak,
  getRewardMessage,
  getActionEmoji,
  formatSeeds,
  checkDailyCapStatus,
  getLevelInfo,
  getStreakInfo,
  COMMON_REWARDS
};
