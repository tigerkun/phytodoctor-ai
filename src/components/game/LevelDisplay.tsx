/**
 * LEVEL DISPLAY COMPONENT
 * Shows current level, XP progress, and next unlock
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Sparkles } from 'lucide-react';
import { RewardService } from '../../services/rewardService';
import { type LevelProgress } from '../../types';

interface LevelDisplayProps {
  userId?: string;
  compact?: boolean;
  showUnlock?: boolean;
}

export const LevelDisplay: React.FC<LevelDisplayProps> = ({
  userId,
  compact = false,
  showUnlock = true
}) => {
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null);
  const [levelInfo, setLevelInfo] = useState<{ title: string; nextUnlock?: string; xpRequired: number } | null>(null);

  useEffect(() => {
    const loadProgress = async () => {
      const progress = await RewardService.ensureLevelProgress(userId);
      setLevelProgress(progress);
      setLevelInfo(RewardService.getLevelTierInfo(progress.currentLevel));
    };
    loadProgress();
  }, [userId]);

  if (!levelProgress) return null;

  const progressVariants = {
    initial: { scaleX: 0 },
    animate: { scaleX: levelProgress.xpProgress / 100 },
    transition: { duration: 0.6, ease: 'easeOut' }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-sage/10 border border-sage/20">
        <TrendingUp size={16} className="text-accent-moss" />
        <span className="text-sm font-mono font-semibold text-cream">
          Lvl {levelProgress.currentLevel} • {levelProgress.totalXP} XP
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 rounded-xl bg-glass-panel p-4 border border-glass-border backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg text-cream flex items-center gap-2">
            <Sparkles size={18} className="text-accent-gold" />
            {levelInfo?.title}
          </h3>
          <p className="text-xs text-sage mt-1">Level {levelProgress.currentLevel}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-accent-moss">{levelProgress.totalXP}</p>
          <p className="text-xs text-sage">Total XP</p>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-sage">
          <span>Progress to Next Level</span>
          <span className="font-mono">{levelProgress.xpProgress}%</span>
        </div>
        <div className="h-2 bg-glass-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent-moss to-accent-gold rounded-full"
            variants={progressVariants}
            initial="initial"
            animate="animate"
          />
        </div>
      </div>

      {/* Next Unlock */}
      {showUnlock && levelInfo?.nextUnlock && (
        <div className="text-xs text-sage-light bg-moss/10 border border-moss/20 rounded-lg p-2">
          <p className="font-semibold text-accent-moss mb-1">🎁 Next Unlock:</p>
          <p>{levelInfo.nextUnlock}</p>
        </div>
      )}
    </motion.div>
  );
};

export default LevelDisplay;
