import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Camera, Activity, Sprout, MessageCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { GameService } from '@/services/gameService';
import { useToast } from '@/components/Toast';
import { usePageTransition } from './PageTransitionContext';

interface QuickstartGuideProps {
  onAddPlant: () => void;
  onRefreshProfile: () => void;
}

export function QuickstartGuide({ onAddPlant, onRefreshProfile }: QuickstartGuideProps) {
  const { success } = useToast();
  const { transitionTo } = usePageTransition();
  const [claimedBonus, setClaimedBonus] = useState(() => localStorage.getItem('claimed_starter_bonus') === 'true');
  const [activeTab, setActiveTab] = useState<number>(0);

  const steps = [
    {
      num: 1,
      title: "Scan & Diagnose Specimen",
      icon: Camera,
      badge: "AI Powered",
      color: "#5A7D5A",
      desc: "Go to Botanical Lab to snap or upload a photo of your plant. Google Gemini AI will identify the species and generate a full clinical health report."
    },
    {
      num: 2,
      title: "Track HSV Stress Drift",
      icon: Activity,
      badge: "Deterministic CV",
      color: "#C4704B",
      desc: "Perform regular check-ins. Our canvas pixel engine tracks subtle Hue & Vibrancy shifts to alert you to root rot or light stress before leaves turn brown."
    },
    {
      num: 3,
      title: "Earn Seeds & Market Rewards",
      icon: Sprout,
      badge: "Economy",
      color: "#D4A843",
      desc: "Every healthy check-in and streak milestone awards Seeds. Spend seeds in the Garden Market for real care products on Amazon India!"
    },
    {
      num: 4,
      title: "Consult Master Botanist AI",
      icon: MessageCircle,
      badge: "Assistant",
      color: "#8FB58F",
      desc: "Ask our Senior Botanist AI assistant anything — from ideal soil pH mixes to organic neem oil pest treatments."
    }
  ];

  const handleClaimBonus = async () => {
    if (claimedBonus) return;
    try {
      await GameService.addSeeds(500, 'bonus', 'Starter Welcome Bonus');
      localStorage.setItem('claimed_starter_bonus', 'true');
      setClaimedBonus(true);
      success('🎁 Welcome Bonus claimed! +500 Seeds added to wallet!');
      onRefreshProfile();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteProtocol = (idx: number) => {
    if (idx === 0) {
      transitionTo('/lab?tab=dex', 'Botanical Lab');
    } else if (idx === 1) {
      transitionTo('/lab?tab=drift', 'Botanical Lab');
    } else if (idx === 2) {
      transitionTo('/market', 'Garden Market');
    } else if (idx === 3) {
      transitionTo('/assistant', 'Head Botanist AI');
    } else {
      onAddPlant();
    }
  };

  return (
    <section className="py-12 px-4 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-8 linen-guide shadow-xl relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 pb-6 border-b border-[#c8bba8]/40 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] bg-moss/10 text-moss border border-moss/25">
                📖 NURSERY COMPENDIUM · PROTOCOLS
              </span>
            </div>
            <h2 className="text-3xl font-serif font-bold text-text-bark">
              Conservatory Guide for Guardians
            </h2>
            <p className="text-sm text-text-stone mt-1 font-medium">
              Four fundamental methods to master botanical diagnostics and build your sanctuary.
            </p>
          </div>

          {/* Seed Allocation Voucher */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
              claimedBonus 
                ? 'bg-moss/10 border-moss/30 text-moss' 
                : 'bg-gradient-to-r from-amber-500/10 to-amber-600/15 border-amber-500/30'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center text-xl border border-gold/30">
              🎁
            </div>
            <div>
              <div className="text-[11px] font-serif font-bold uppercase tracking-wider text-text-bark">Estate Starter Grant</div>
              <div className="text-sm font-black font-mono text-gold">+500 Seeds</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleClaimBonus}
              disabled={claimedBonus}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md font-serif tracking-wider ${
                claimedBonus 
                  ? 'bg-moss text-white cursor-default' 
                  : 'bg-[#b89552] hover:bg-[#c5a059] text-white cursor-pointer'
              }`}
            >
              {claimedBonus ? '✓ Credited' : 'Claim Grant'}
            </motion.button>
          </motion.div>
        </div>

        {/* Numbered Linen Nursery Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = activeTab === idx;
            return (
              <motion.button
                key={s.num}
                whileHover={{ y: -3 }}
                onClick={() => setActiveTab(idx)}
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isActive
                    ? 'bg-white/90 dark:bg-[#25211c] border-[#b89552] shadow-md ring-2 ring-[#b89552]/30'
                    : 'bg-white/40 dark:bg-black/20 border-[#c8bba8]/30 dark:border-white/10 hover:bg-white/60'
                }`}
              >
                {/* Tab Number Flag */}
                <div className="flex items-center justify-between mb-3">
                  <div 
                    className="w-8 h-8 rounded-md flex items-center justify-center font-mono font-bold text-xs border"
                    style={{ 
                      background: `${s.color}15`, 
                      color: s.color,
                      borderColor: `${s.color}35`
                    }}
                  >
                    0{s.num}
                  </div>
                  <span 
                    className="text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-sm" 
                    style={{ background: `${s.color}15`, color: s.color }}
                  >
                    TAB {s.num}
                  </span>
                </div>
                <div className="font-serif font-bold text-sm text-text-bark flex items-center gap-2">
                  <Icon size={16} style={{ color: s.color }} />
                  {s.title}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Active Step Feature Folio */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25 }}
            className="p-6 rounded-2xl bg-white/75 dark:bg-[#1f1b17] border border-[#c8bba8]/40 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border"
                style={{ 
                  background: `${steps[activeTab].color}18`,
                  borderColor: `${steps[activeTab].color}30`
                }}
              >
                {activeTab === 0 ? '📸' : activeTab === 1 ? '📊' : activeTab === 2 ? '🌱' : '💬'}
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-text-stone mb-0.5">
                  Protocol 0{steps[activeTab].num} • {steps[activeTab].badge}
                </div>
                <h4 className="text-xl font-serif font-bold text-text-bark mb-1.5">
                  {steps[activeTab].title}
                </h4>
                <p className="text-sm text-text-stone leading-relaxed max-w-2xl font-medium">
                  {steps[activeTab].desc}
                </p>
              </div>
            </div>

            <motion.button
              onClick={() => handleExecuteProtocol(activeTab)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-serif font-bold text-white text-xs whitespace-nowrap shadow-md flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
              style={{ background: steps[activeTab].color }}
            >
              Execute Protocol 0{steps[activeTab].num}
              <ChevronRight size={16} />
            </motion.button>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
