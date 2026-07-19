/**
 * RULEBOOK COMPONENT
 * Educational guide showing how users earn rewards and manage their economy
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Leaf, Zap, TrendingUp, Target, Shield, BookOpen } from 'lucide-react';
import { REWARD_CAPS, DAILY_RITUALS, BASE_DIAGNOSIS_REWARDS, HEALTH_BONUS_REWARDS, STREAK_MULTIPLIERS, LEVEL_TIERS, VOUCHERS } from '../../game/REWARD_CONFIG';

interface RuleBookSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  content: React.ReactNode;
}

export const RuleBook: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string>('earning');

  const sections: RuleBookSection[] = [
    {
      id: 'earning',
      title: 'How to Earn Seeds & XP',
      icon: <Leaf size={20} className="text-accent-moss" />,
      description: 'Complete daily tasks and diagnoses',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-cream mb-2 flex items-center gap-2">
              <Zap size={16} className="text-accent-gold" />
              Daily Rituals
            </h4>
            <div className="space-y-2">
              {DAILY_RITUALS.map(ritual => (
                <div key={ritual.id} className="text-sm text-sage bg-glass-panel p-2 rounded border border-glass-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono font-semibold text-cream">{ritual.name}</p>
                      <p className="text-xs mt-1">{ritual.description}</p>
                    </div>
                    <div className="text-right text-xs font-mono whitespace-nowrap">
                      <p className="text-accent-gold">+{ritual.xp} XP</p>
                      <p className="text-accent-moss">+{ritual.seeds} 🌱</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-cream mb-2 flex items-center gap-2">
              <Target size={16} className="text-accent-terracotta" />
              Plant Diagnosis
            </h4>
            <div className="space-y-2">
              {BASE_DIAGNOSIS_REWARDS.slice(0, 3).map(reward => (
                <div key={reward.id} className="text-sm text-sage bg-glass-panel p-2 rounded border border-glass-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono font-semibold text-cream">{reward.name}</p>
                      <p className="text-xs mt-1">{reward.description}</p>
                    </div>
                    <div className="text-right text-xs font-mono whitespace-nowrap">
                      <p className="text-accent-gold">+{reward.xp} XP</p>
                      <p className="text-accent-moss">+{reward.seeds} 🌱</p>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-sage-light italic mt-2">
                Max 3 diagnoses/day, 48-hour cooldown per plant, up to 50 seeds per diagnosis
              </p>
            </div>
          </div>
        </div>
      )
    },

    {
      id: 'caps',
      title: 'Daily Caps & Burst Rewards',
      icon: <Shield size={20} className="text-accent-gold" />,
      description: 'Understand earning limits',
      content: (
        <div className="space-y-4">
          <div className="bg-terracotta/10 border border-terracotta/30 rounded-lg p-3">
            <p className="font-semibold text-accent-terracotta mb-2">⚠️ Active Daily Cap</p>
            <p className="text-sm text-sage mb-2">
              Regular tasks (logins, diagnoses, posts) are capped at <span className="font-mono font-bold text-cream">{REWARD_CAPS.ACTIVE_DAILY_SEED_CAP} seeds/day</span>
            </p>
            <p className="text-xs text-sage-light">
              This encourages healthy, sustainable play—no burnout grinding.
            </p>
          </div>

          <div className="bg-moss/10 border border-moss/30 rounded-lg p-3">
            <p className="font-semibold text-accent-moss mb-2">✨ Burst Rewards (No Cap)</p>
            <ul className="text-sm text-sage space-y-1">
              <li>• <strong>Level-ups:</strong> Unlock features & extra multipliers</li>
              <li>• <strong>Streak Milestones:</strong> 7, 14, 30, 60, 100 days (massive bonuses)</li>
              <li>• <strong>Referrals:</strong> Friend sign-ups & achievements</li>
              <li>• <strong>Discoveries:</strong> New plant species (rare→legendary)</li>
            </ul>
            <p className="text-xs text-sage-light mt-2">
              These rewards bypass the daily cap, letting dedicated players earn significantly more!
            </p>
          </div>
        </div>
      )
    },

    {
      id: 'streaks',
      title: 'Streak System & Multipliers',
      icon: <TrendingUp size={20} className="text-accent-gold" />,
      description: 'Build your winning streak',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-sage">
            Every day you log in, your streak increases. At milestone days, you earn <strong>massive bonus seeds + XP</strong> and your base earnings get multiplied!
          </p>

          <div className="space-y-2">
            {STREAK_MULTIPLIERS.map(milestone => (
              <div key={milestone.day} className="bg-glass-panel border border-glass-border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono font-bold text-cream">Day {milestone.day} 🔥</span>
                  <span className="text-accent-gold font-bold">{milestone.multiplier}x Multiplier</span>
                </div>
                {milestone.milestoneBonus && (
                  <p className="text-xs text-sage">
                    Milestone Bonus: <span className="font-mono">+{milestone.milestoneBonus.seeds} seeds, +{milestone.milestoneBonus.xp} XP</span>
                  </p>
                )}
                {milestone.badgeUnlock && (
                  <p className="text-xs text-accent-moss mt-1">🏅 Unlock "{milestone.badgeUnlock}" badge</p>
                )}
              </div>
            ))}
          </div>

          <div className="bg-warning/10 border border-warning/30 rounded p-2 text-xs text-sage">
            <p className="font-semibold text-amber-200 mb-1">💡 Streak Freeze</p>
            <p>
              If you miss a day, you can use a streak freeze (earned at level 6+) to keep your multiplier!
              Free users get 1/month, Pro users get 2/month.
            </p>
          </div>
        </div>
      )
    },

    {
      id: 'levels',
      title: 'Level System & Unlocks',
      icon: <TrendingUp size={20} className="text-accent-moss" />,
      description: '25 tiers with progression rewards',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-sage">
            As you earn XP, you level up and unlock new features. Early levels unlock plant slots; later levels unlock marketplace access, custom themes, and permanent seed multipliers.
          </p>

          <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto">
            {LEVEL_TIERS.slice(0, 10).map(tier => (
              <div key={tier.level} className="bg-glass-panel border border-glass-border rounded p-2 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-cream">Lvl {tier.level} • {tier.title}</span>
                  <span className="font-mono text-sage">{tier.xpRequired} XP</span>
                </div>
                <p className="text-sage text-xs">
                  {tier.unlocks.features?.join(', ') || 'Plant slot unlock'}
                </p>
              </div>
            ))}
            <p className="text-xs text-sage text-center mt-2">... and 15 more tiers up to Eternal Bloom!</p>
          </div>
        </div>
      )
    },

    {
      id: 'vouchers',
      title: 'Redeem Seeds for Vouchers',
      icon: <BookOpen size={20} className="text-accent-gold" />,
      description: 'Convert seeds to discounts',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-sage">
            Once you have enough seeds, trade them for vouchers to save money on real purchases! <span className="text-accent-moss">100 seeds ≈ ₹1 discount power</span>
          </p>

          <div className="space-y-2">
            {VOUCHERS.map(voucher => (
              <div key={voucher.id} className="bg-glass-panel border border-glass-border rounded p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-cream">{voucher.type.toUpperCase()}</p>
                    <p className="text-sm text-accent-moss font-mono">{voucher.discount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-sage mb-1">Costs</p>
                    <p className="font-mono font-bold text-cream">{voucher.seedCost}</p>
                    <p className="text-xs text-sage">🌱 seeds</p>
                  </div>
                </div>
                <p className="text-xs text-sage">{voucher.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-moss/10 border border-moss/20 rounded p-2 text-xs text-sage">
            <p className="font-semibold text-accent-moss mb-1">🎯 Pro Tip</p>
            <p>Level 17+ gets a 10% better exchange rate! Seeds become more valuable as you progress.</p>
          </div>
        </div>
      )
    },

    {
      id: 'faq',
      title: 'Frequently Asked Questions',
      icon: <BookOpen size={20} className="text-sage" />,
      description: 'Quick answers',
      content: (
        <div className="space-y-3">
          <div className="border-l-2 border-accent-moss pl-3 py-2">
            <p className="font-semibold text-cream text-sm">Can I buy seeds with real money?</p>
            <p className="text-xs text-sage mt-1">
              ❌ No. Seeds are earned only through gameplay. This keeps the economy fair and prevents pay-to-win mechanics.
            </p>
          </div>

          <div className="border-l-2 border-accent-moss pl-3 py-2">
            <p className="font-semibold text-cream text-sm">What happens if I hit the daily cap?</p>
            <p className="text-xs text-sage mt-1">
              📊 Active rewards stop earning seeds for that day, but XP and burst rewards still work. Come back tomorrow!
            </p>
          </div>

          <div className="border-l-2 border-accent-moss pl-3 py-2">
            <p className="font-semibold text-cream text-sm">Is Pro worth it?</p>
            <p className="text-xs text-sage mt-1">
              ✅ Pro gives 50% more seeds/XP, unlimited plant slots, early market access, and 2 streak freezes/month. No seed multipliers—just better features.
            </p>
          </div>

          <div className="border-l-2 border-accent-moss pl-3 py-2">
            <p className="font-semibold text-cream text-sm">How do I lose seeds?</p>
            <p className="text-xs text-sage mt-1">
              💸 Only when you redeem vouchers or buy cosmetics. Earning never decreases seeds; you choose when to spend.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto rounded-2xl bg-gradient-to-b from-glass-panel to-glass-panel/50 border border-glass-border backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-moss/20 to-terracotta/20 border-b border-glass-border p-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="text-accent-gold" size={28} />
          <h2 className="font-serif text-2xl text-cream">The Gardener's Handbook</h2>
        </div>
        <p className="text-sm text-sage">Learn how to earn, level up, and unlock exclusive rewards</p>
      </div>

      {/* Sections */}
      <div className="divide-y divide-glass-border">
        {sections.map(section => (
          <motion.div key={section.id}>
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? '' : section.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-glass-panel/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {section.icon}
                <div>
                  <p className="font-semibold text-cream">{section.title}</p>
                  <p className="text-xs text-sage">{section.description}</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: expandedSection === section.id ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown size={20} className="text-sage" />
              </motion.div>
            </button>

            <AnimatePresence>
              {expandedSection === section.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 py-4 bg-glass-panel/30 border-t border-glass-border text-sm">
                    {section.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-moss/5 border-t border-glass-border px-6 py-4 text-center text-xs text-sage">
        <p>
          💡 <strong>Fair Play Promise:</strong> No pay-to-win. No seed farms. No grindy bots. Just genuine care rewarded.
        </p>
      </div>
    </motion.div>
  );
};

export default RuleBook;
