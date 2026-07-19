/**
 * STREAK WIDGET COMPONENT
 * Displays current streak, multiplier, and freeze info
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Shield } from 'lucide-react';
import { RewardService } from '../../services/rewardService';
import { type StreakRecord } from '../../types';

interface StreakWidgetProps {
  userId?: string;
  compact?: boolean;
}

export const StreakWidget: React.FC<StreakWidgetProps> = ({ userId, compact = false }) => {
  const [streak, setStreak] = useState<StreakRecord | null>(null);

  useEffect(() => {
    const loadStreak = async () => {
      const streakData = await RewardService.ensureStreakRecord(userId);
      setStreak(streakData);
    };
    loadStreak();
  }, [userId]);

  if (!streak) return null;

  const fireEmojis = Math.min(streak.currentStreak / 7 + 1, 5);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Flame size={16} className="text-accent-terracotta animate-pulse" />
        <span className="text-sm font-mono font-bold text-cream">{streak.currentStreak} day</span>
        <span className="text-xs text-sage">{streak.streakMultiplier}x</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl bg-gradient-to-br from-terracotta/10 to-gold/10 border border-terracotta/30 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame size={24} className="text-accent-terracotta animate-pulse" />
          <div>
            <p className="text-2xl font-bold text-cream">{streak.currentStreak}</p>
            <p className="text-xs text-sage">Day Streak</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-accent-gold">{streak.streakMultiplier}x</p>
          <p className="text-xs text-sage">Multiplier</p>
        </div>
      </div>

      {/* Fire indicator */}
      <div className="text-2xl mb-3" title="Streak intensity">
        {'🔥'.repeat(Math.min(Math.ceil(streak.currentStreak / 10), 5))}
      </div>

      {/* Freeze info */}
      {streak.freezesAvailableThisMonth > 0 && (
        <div className="flex items-center gap-2 bg-moss/20 rounded px-3 py-2 text-xs text-accent-moss">
          <Shield size={14} />
          <span>{streak.freezesAvailableThisMonth} freeze{streak.freezesAvailableThisMonth > 1 ? 's' : ''} left this month</span>
        </div>
      )}

      {/* Longest streak */}
      <p className="text-xs text-sage mt-3">Personal best: <span className="font-mono font-semibold">{streak.longestStreak} days</span></p>
    </motion.div>
  );
};

export default StreakWidget;
