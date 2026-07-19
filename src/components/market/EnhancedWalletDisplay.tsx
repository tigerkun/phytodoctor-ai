import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Leaf, TrendingUp, Award, Zap, Gift } from 'lucide-react';

interface WalletStats {
  seeds: number;
  level: number;
  nextLevelXp: number;
  currentXp: number;
  vouchers: number;
  streak: number;
}

interface EnhancedWalletDisplayProps {
  stats: WalletStats;
  isCompact?: boolean;
}

export default function EnhancedWalletDisplay({ 
  stats, 
  isCompact = false 
}: EnhancedWalletDisplayProps) {
  const [showXpGain, setShowXpGain] = useState(false);
  const xpProgress = (stats.currentXp / stats.nextLevelXp) * 100;

  const handleXpGain = () => {
    setShowXpGain(true);
    setTimeout(() => setShowXpGain(false), 1500);
  };

  if (isCompact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-4 p-2 rounded-lg bg-bg-secondary border border-border-light"
      >
        {/* Level Badge */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="relative w-12 h-12 rounded-full bg-gradient-to-br from-gold to-[#a88a2c] flex items-center justify-center shadow-lg"
        >
          <span className="font-bold text-text-bark text-lg">{stats.level}</span>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border border-gold/20"
          />
        </motion.div>

        {/* Stats */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <Leaf size={14} className="text-moss" />
            <span className="font-mono font-bold text-text-bark">{stats.seeds.toLocaleString()}</span>
          </div>
          <motion.div className="h-1 w-20 bg-bg-tertiary rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-moss to-gold"
            />
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 p-6 rounded-2xl bg-bg-secondary border border-border-medium shadow-md"
    >
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Level & XP */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-3 rounded-xl bg-gradient-to-br from-gold/10 to-transparent border border-gold/30 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} className="text-gold" />
            <span className="text-xs font-bold text-text-stone uppercase tracking-wider">Level</span>
          </div>
          <div className="text-2xl font-bold text-gold">{stats.level}</div>
          <div className="text-[10px] text-text-muted mt-1">
            {stats.currentXp} / {stats.nextLevelXp} XP
          </div>
          <motion.div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden mt-2">
            <motion.div
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-gold to-[#a88a2c]"
            />
          </motion.div>
        </motion.div>

        {/* Seeds */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-3 rounded-xl bg-gradient-to-br from-moss/10 to-transparent border border-moss/30 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <Leaf size={16} className="text-moss" />
            <span className="text-xs font-bold text-text-stone uppercase tracking-wider">Seeds</span>
          </div>
          <div className="text-2xl font-bold text-moss font-mono">{stats.seeds.toLocaleString()}</div>
          <div className="text-[10px] text-text-muted mt-1">≈ ₹{Math.floor(stats.seeds / 200)}</div>
        </motion.div>

        {/* Streak */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-3 rounded-xl bg-gradient-to-br from-terracotta/10 to-transparent border border-terracotta/30"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-terracotta" />
            <span className="text-xs font-bold text-text-stone uppercase tracking-wider">Streak</span>
          </div>
          <div className="text-2xl font-bold text-terracotta">{stats.streak}d</div>
          <div className="text-[10px] text-text-muted mt-1">Keep it going!</div>
        </motion.div>

        {/* Vouchers */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-3 rounded-xl bg-gradient-to-br from-sage/10 to-transparent border border-sage/30"
        >
          <div className="flex items-center gap-2 mb-2">
            <Gift size={16} className="text-sage" />
            <span className="text-xs font-bold text-text-stone uppercase tracking-wider">Vouchers</span>
          </div>
          <div className="text-2xl font-bold text-sage">{stats.vouchers}</div>
          <div className="text-[10px] text-text-muted mt-1">Ready to spend</div>
        </motion.div>
      </div>

      {/* Achievement Badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="pt-3 border-t border-border-light"
      >
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Achievements</p>
        <div className="flex gap-2 flex-wrap">
          {stats.streak >= 7 && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="relative w-8 h-8 rounded-full bg-gradient-to-br from-terracotta to-[#a85a42] flex items-center justify-center cursor-help shadow-lg"
              title="7-day Streak"
            >
              <Zap size={14} className="text-white" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-terracotta/40"
              />
            </motion.div>
          )}

          {stats.level >= 5 && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="relative w-8 h-8 rounded-full bg-gradient-to-br from-gold to-[#a88a2c] flex items-center justify-center cursor-help shadow-lg"
              title="Level 5 Milestone"
            >
              <Award size={14} className="text-white" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-gold/40"
              />
            </motion.div>
          )}

          {stats.seeds >= 5000 && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="relative w-8 h-8 rounded-full bg-gradient-to-br from-moss to-moss-dark flex items-center justify-center cursor-help shadow-lg"
              title="5k Seeds Collector"
            >
              <Leaf size={14} className="text-white" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-moss/40"
              />
            </motion.div>
          )}

          {stats.vouchers >= 3 && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="relative w-8 h-8 rounded-full bg-gradient-to-br from-sage to-[#7a8770] flex items-center justify-center cursor-help shadow-lg"
              title="Voucher Master"
            >
              <Gift size={14} className="text-white" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-sage/40"
              />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleXpGain}
        className="w-full mt-4 py-2 rounded-lg bg-gradient-to-r from-moss to-gold text-white font-bold text-sm uppercase tracking-wider shadow-lg hover:shadow-xl transition-all"
      >
        Earn More Rewards
      </motion.button>

      {/* XP Gain Toast */}
      <AnimatePresence>
        {showXpGain && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-moss px-4 py-2 rounded-full text-white text-sm font-bold"
          >
            +100 XP!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
