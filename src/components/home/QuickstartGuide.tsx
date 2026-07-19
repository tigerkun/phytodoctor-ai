import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Camera, Activity, Sprout, MessageCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { GameService } from '@/services/gameService';
import { useToast } from '@/components/Toast';

interface QuickstartGuideProps {
  onAddPlant: () => void;
  onRefreshProfile: () => void;
}

export function QuickstartGuide({ onAddPlant, onRefreshProfile }: QuickstartGuideProps) {
  const { showToast } = useToast();
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
      showToast('🎁 Welcome Bonus claimed! +500 Seeds added to wallet!', 'success');
      onRefreshProfile();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section className="py-12 px-4 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-8 backdrop-blur-xl border border-border-light bg-bg-secondary shadow-xl relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 pb-6 border-b border-border-light">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-moss/10 text-moss border border-moss/20">
                📘 Interactive Usage Manual
              </span>
            </div>
            <h2 className="text-3xl font-serif font-bold text-text-bark">
              Quickstart Guide for New Guardians
            </h2>
            <p className="text-sm text-text-stone mt-1">
              Follow these 4 simple steps to master PhytoDoctor AI and build your thriving sanctuary.
            </p>
          </div>

          {/* Bonus Claim Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
              claimedBonus 
                ? 'bg-moss/10 border-moss/30 text-moss' 
                : 'bg-gradient-to-r from-amber-500/10 to-amber-600/20 border-amber-500/30'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center text-xl">
              🎁
            </div>
            <div>
              <div className="text-xs font-bold text-text-bark">Starter Welcome Bonus</div>
              <div className="text-sm font-black text-gold">+500 Seeds</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleClaimBonus}
              disabled={claimedBonus}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                claimedBonus 
                  ? 'bg-moss text-white cursor-default'
                  : 'bg-gold hover:bg-gold-light text-text-bark cursor-pointer'
              }`}
            >
              {claimedBonus ? '✓ Claimed' : 'Claim 500 Seeds'}
            </motion.button>
          </motion.div>
        </div>

        {/* Step Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = activeTab === idx;
            return (
              <motion.button
                key={s.num}
                whileHover={{ y: -4 }}
                onClick={() => setActiveTab(idx)}
                className={`p-5 rounded-2xl border text-left transition-all ${
                  isActive
                    ? 'bg-bg-tertiary border-moss shadow-md ring-2 ring-moss/20'
                    : 'bg-bg-primary/50 border-border-light hover:bg-bg-tertiary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs" style={{ background: `${s.color}20`, color: s.color }}>
                    0{s.num}
                  </div>
                  <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md" style={{ background: `${s.color}15`, color: s.color }}>
                    {s.badge}
                  </span>
                </div>
                <div className="font-bold text-sm text-text-bark flex items-center gap-2">
                  <Icon size={16} style={{ color: s.color }} />
                  {s.title}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Active Step Feature Box */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="p-6 rounded-2xl bg-bg-tertiary/60 border border-border-light flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${steps[activeTab].color}25` }}>
                {activeTab === 0 ? '📸' : activeTab === 1 ? '📊' : activeTab === 2 ? '🌱' : '💬'}
              </div>
              <div>
                <h4 className="text-xl font-bold text-text-bark mb-1">
                  Step {steps[activeTab].num}: {steps[activeTab].title}
                </h4>
                <p className="text-sm text-text-stone leading-relaxed max-w-2xl">
                  {steps[activeTab].desc}
                </p>
              </div>
            </div>

            <motion.button
              onClick={onAddPlant}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 rounded-xl font-bold text-white text-xs whitespace-nowrap shadow-md flex items-center gap-2"
              style={{ background: steps[activeTab].color }}
            >
              Start Step {steps[activeTab].num}
              <ChevronRight size={16} />
            </motion.button>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
