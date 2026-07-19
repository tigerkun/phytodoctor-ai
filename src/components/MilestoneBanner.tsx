import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

interface MilestoneBannerProps {
  current: number;
  target: number;
  tier: string;
}

export const MilestoneBanner = ({ current, target, tier }: MilestoneBannerProps) => {
  const progress = Math.min(current / target, 1);
  
  return (
    <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} 
                className="max-w-6xl mx-auto px-6 mb-4">
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[var(--gold)]/10 to-[var(--moss)]/10 border border-[var(--gold)]/20 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
          <Target className="w-5 h-5 text-[var(--gold)]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text-bark)]">Almost there!</p>
          <p className="text-xs text-[var(--text-stone)]">Discover {target - current} more Rare plants to unlock the <span className="text-[var(--rarity-epic)] font-medium">{tier}</span> badge</p>
        </div>
        <div className="w-24 h-2 bg-white/50 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </motion.div>
  );
};