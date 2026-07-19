import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimeOfDay, type TimePeriod } from '@/hooks/useTimeOfDay';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useEcoMode } from '@/hooks/useEcoMode';
import { useParallax } from '@/hooks/useScrollBehavior';
import { triggerHaptic, playAudio } from '@/utils/hapticAudio';
import { db } from '@/db/database';

interface HeroSectionProps {
  plantId?: string;
  plantName: string;
  plantSpecies: string;
  healthScore: number;
  lastAnalyzed: string;
  photoUrl: string;
  profile: any;
  totalPlants: number;
  onAddPlant: () => void;
  currentTimePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
}

export function HeroSection({
  plantId,
  plantName,
  plantSpecies,
  healthScore,
  lastAnalyzed,
  photoUrl,
  profile,
  totalPlants,
  onAddPlant,
  currentTimePeriod,
  onTimePeriodChange
}: HeroSectionProps) {
  const { greeting } = useTimeOfDay();
  const { theme } = useDayNightTheme();
  const { shouldDisableAnimations } = useEcoMode();
  const parallaxRef = useParallax(0.3);

  // States for visual effects
  const [activeEffect, setActiveEffect] = useState<'water' | 'prune' | 'nourish' | null>(null);

  // States for editing nickname
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(plantName);

  useEffect(() => {
    setEditedName(plantName);
  }, [plantName]);

  const handleTriggerAction = (action: 'water' | 'prune' | 'nourish') => {
    triggerHaptic('medium');
    
    if (action === 'water') {
      playAudio('water-drop');
    } else if (action === 'prune') {
      playAudio('leaf-rustle');
    } else {
      playAudio('chime');
    }

    setActiveEffect(action);
    setTimeout(() => {
      setActiveEffect(null);
    }, 2000);
  };

  const handleSaveNickname = async () => {
    if (!editedName.trim() || !plantId) return;
    try {
      await db.plants.update(plantId, { name: editedName.trim() });
      triggerHaptic('medium');
      playAudio('success');
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to update nickname:', err);
    }
  };

  const healthLabel = healthScore >= 90 ? 'Thriving' : healthScore >= 70 ? 'Healthy' : healthScore >= 50 ? 'Needs Attention' : 'Critical';
  const healthColor = healthScore >= 90 ? 'var(--health-thriving)'
    : healthScore >= 70 ? 'var(--health-healthy)'
    : healthScore >= 50 ? 'var(--health-stressed)'
    : 'var(--health-critical)';

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.8 }}
      className="relative pt-12 pb-20 px-4"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel - Plant of the Day */}
        <motion.div
          ref={parallaxRef}
          className="lg:col-span-2"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div
            className="relative rounded-3xl overflow-hidden backdrop-blur-2xl border border-border-light bg-bg-secondary transition-all duration-300 hover:shadow-2xl"
          >
            {/* Vine border animation */}
            {!shouldDisableAnimations && (
              <motion.svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 400 600"
                initial={{ strokeDashoffset: 1000 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 3, delay: 0.5 }}
              >
                <motion.path
                  d="M 10 10 Q 20 200 10 400 L 10 590"
                  stroke={healthColor}
                  strokeWidth="2"
                  fill="none"
                  opacity="0.3"
                  strokeDasharray="1000"
                />
              </motion.svg>
            )}

            {/* Plant Photo */}
            <div className="relative h-96 bg-bg-tertiary overflow-hidden">
              <motion.img
                src={photoUrl}
                alt={plantName}
                className="w-full h-full object-cover"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                whileHover={!shouldDisableAnimations ? { scale: 1.05 } : {}}
              />

              {/* Active Care Visual Effects Overlays */}
              <AnimatePresence>
                {activeEffect === 'water' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 pointer-events-none z-20 bg-blue-500/10 flex flex-col justify-between overflow-hidden"
                  >
                    <div className="absolute inset-0 grid grid-cols-5 gap-2 p-4">
                      {Array.from({ length: 15 }).map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ y: -50, opacity: 0, scale: 0.5 }}
                          animate={{ 
                            y: [0, 400], 
                            opacity: [0, 1, 1, 0],
                            scale: [0.5, 1, 1, 0.5]
                          }}
                          transition={{ 
                            duration: 1.2, 
                            delay: (i * 0.15) % 0.8,
                            repeat: 0,
                            ease: "easeIn"
                          }}
                          className="text-2xl text-center"
                        >
                          💧
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeEffect === 'prune' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 pointer-events-none z-20 bg-emerald-500/10 flex flex-col justify-between overflow-hidden"
                  >
                    <div className="absolute inset-0 grid grid-cols-5 gap-2 p-4">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ y: 50, opacity: 0, rotate: 0 }}
                          animate={{ 
                            y: [50, 350], 
                            x: [0, (i % 2 === 0 ? 30 : -30)],
                            rotate: [0, 360],
                            opacity: [0, 0.7, 0.7, 0]
                          }}
                          transition={{ 
                            duration: 1.5, 
                            delay: (i * 0.2) % 0.8,
                            ease: "easeOut"
                          }}
                          className="text-xl text-center"
                        >
                          🍃
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeEffect === 'nourish' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 pointer-events-none z-20 bg-amber-500/10 flex flex-col justify-between overflow-hidden"
                  >
                    <div className="absolute inset-0 grid grid-cols-6 gap-2 p-4">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ y: 350, opacity: 0, scale: 0.2 }}
                          animate={{ 
                            y: [350, 50], 
                            opacity: [0, 1, 1, 0],
                            scale: [0.2, 1.2, 0.2]
                          }}
                          transition={{ 
                            duration: 1.6, 
                            delay: (i * 0.1) % 0.8,
                            ease: "easeOut"
                          }}
                          className="text-xl text-center"
                        >
                          ✨
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Health Score Ring */}
              <motion.div
                className="absolute bottom-6 right-6 w-24 h-24 rounded-full border-4 flex items-center justify-center backdrop-blur-sm"
                style={{
                  borderColor: healthColor,
                  background: `radial-gradient(circle, ${healthColor}15, transparent)`
                }}
                animate={!shouldDisableAnimations ? {
                  boxShadow: [
                    `0 0 0px ${healthColor}40`,
                    `0 0 24px ${healthColor}70`,
                    `0 0 0px ${healthColor}40`
                  ]
                } : {}}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: healthColor }}>
                    {healthScore}%
                  </div>
                  <div className="text-xs" style={{ color: healthColor }}>
                    {healthLabel}
                  </div>
                </div>
              </motion.div>

              {/* Analyzed Badge */}
              <motion.div
                className="absolute top-6 right-6 px-4 py-2 rounded-full backdrop-blur-md border border-border-light bg-bg-secondary/80"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <span className="text-xs font-medium text-text-bark">✨ {lastAnalyzed}</span>
              </motion.div>
            </div>

            {/* Plant Info */}
            <div className="p-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2
                    className="text-3xl font-serif font-bold text-text-bark"
                  >
                    {plantName}
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      triggerHaptic('light');
                      setIsEditModalOpen(true);
                    }}
                    aria-label={`Edit ${plantName} profile`}
                    className="text-xl cursor-pointer p-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-1"
                  >
                    ✏️
                  </motion.button>
                </div>
                <p
                  className="text-sm mb-4 text-moss"
                >
                  {plantSpecies}
                </p>

                {/* Quick Care Actions Tray */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTriggerAction('water')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-600 hover:bg-blue-500 hover:text-white transition-all text-xs font-bold focus:outline-none"
                  >
                    💧 Water
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTriggerAction('prune')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all text-xs font-bold focus:outline-none"
                  >
                    ✂️ Prune
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTriggerAction('nourish')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-600 hover:bg-amber-500 hover:text-white transition-all text-xs font-bold focus:outline-none"
                  >
                    🧪 Nourish
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Right Panel - Garden Pulse */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex flex-col gap-6"
        >
          {/* Greeting */}
          <div
            className="rounded-2xl backdrop-blur-md border border-border-light bg-bg-secondary p-6"
          >
            <motion.h3
              className="text-lg font-serif font-bold mb-3 text-text-bark"
              animate={!shouldDisableAnimations ? { opacity: [0.8, 1, 0.8] } : {}}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {greeting}
            </motion.h3>

            {/* Atmosphere (Aether) Preset Selector */}
            <div className="mb-5 pb-4 border-b border-border-light">
              <span className="text-[10px] uppercase font-bold tracking-wider text-text-stone block mb-2">
                🌌 Ambient Override
              </span>
              <div className="flex items-center justify-between gap-1.5 bg-bg-tertiary/40 p-1.5 rounded-xl border border-border-light">
                {([
                  { id: 'dawn', icon: '🌅', label: 'Dawn' },
                  { id: 'morning', icon: '☀️', label: 'Noon' },
                  { id: 'dusk', icon: '🌇', label: 'Dusk' },
                  { id: 'night', icon: '🌌', label: 'Night' }
                ] as const).map((period) => (
                  <motion.button
                    key={period.id}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      triggerHaptic('light');
                      onTimePeriodChange(period.id);
                    }}
                    title={period.label}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg text-lg transition-all focus:outline-none ${currentTimePeriod === period.id ? 'bg-moss text-white shadow-md' : 'hover:bg-bg-tertiary text-text-bark/70'}`}
                  >
                    {period.icon}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Mini Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🌡️', label: 'Temp', value: '28°C' },
                { icon: '💧', label: 'Humidity', value: '62%' },
                { icon: '🌱', label: 'Plants', value: totalPlants.toString() },
                { icon: '🔥', label: 'Streak', value: `${profile?.currentStreak || 0}d` }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  className="p-3 rounded-lg bg-bg-tertiary border border-border-light"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1, duration: 0.4 }}
                >
                  <div className="text-xl mb-1">{stat.icon}</div>
                  <div
                    className="text-xs text-text-stone"
                  >
                    {stat.label}
                  </div>
                  <div
                    className="text-sm font-bold text-text-bark"
                  >
                    {stat.value}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Add Plant Button */}
          <motion.button
            onClick={onAddPlant}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Add a new plant to your garden"
            className="w-full py-4 rounded-[var(--radius-lg)] font-bold text-white transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terracotta)] focus-visible:ring-offset-2 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--terracotta) 0%, var(--gold) 100%)',
              boxShadow: '0 10px 30px var(--glow)'
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <span className="text-2xl">🌱</span>
            <span>Add a Plant</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Glassmorphic Nickname Edit Modal (Ensures Layout Stability) */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm rounded-[2rem] border border-border-light bg-bg-secondary p-8 shadow-2xl backdrop-blur-2xl text-center"
            >
              <h3 className="text-2xl font-serif font-bold text-text-bark mb-2">Rename Specimen</h3>
              <p className="text-xs text-text-stone mb-6">Choose a new designation for {plantSpecies}</p>
              
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Enter nickname..."
                className="w-full px-4 py-3 rounded-xl border border-border-light bg-bg-tertiary text-text-bark text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-moss mb-6"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNickname();
                }}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 rounded-full text-xs font-bold border border-border-light hover:bg-bg-tertiary text-text-stone transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNickname}
                  className="flex-1 py-3 rounded-full text-xs font-bold text-white bg-moss hover:bg-moss-dark transition-all shadow-lg shadow-moss/20"
                >
                  Save designation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
