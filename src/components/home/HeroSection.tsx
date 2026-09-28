import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimeOfDay } from '@/hooks/useTimeOfDay';
import { useEcoMode } from '@/hooks/useEcoMode';
import { useParallax } from '@/hooks/useScrollBehavior';
import { triggerHaptic, playAudio } from '@/utils/hapticAudio';
import { PlantService } from '@/services/plantService';

interface HeroSectionProps {
  plantId?: string;
  plantName: string;
  plantSpecies: string;
  healthScore: number;
  lastAnalyzed: string;
  photoUrl: string;
  profile: any;
  totalPlants: number;
  plantIndex?: number;
  weather?: any;
  onAddPlant: () => void;
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
  plantIndex = 0,
  weather,
  onAddPlant
}: HeroSectionProps) {
  const { greeting } = useTimeOfDay();
  const { shouldDisableAnimations } = useEcoMode();

  // States for visual effects
  const [activeEffect, setActiveEffect] = useState<'water' | 'prune' | 'nourish' | null>(null);

  // States for editing nickname
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(plantName);

  useEffect(() => {
    setEditedName(plantName);
  }, [plantName]);

  const handleTriggerAction = async (action: 'water' | 'prune' | 'nourish') => {
    triggerHaptic('medium');
    
    if (action === 'water') {
      playAudio('water-drop');
      if (plantId) {
        try {
          await PlantService.updatePlant(plantId, { updatedAt: new Date() });
        } catch (err) {
          console.error('Failed to update plant hydration date:', err);
        }
      }
    } else if (action === 'prune') {
      playAudio('leaf-rustle');
    } else {
      playAudio('chime');
    }

    setActiveEffect(action);
    setTimeout(() => {
      setActiveEffect(null);
    }, 550);
  };

  const handleSaveNickname = async () => {
    if (!editedName.trim() || !plantId) return;
    try {
      await PlantService.updatePlant(plantId, { name: editedName.trim() });
      triggerHaptic('medium');
      playAudio('success');
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to update nickname:', err);
    }
  };

  const handleDeletePlant = async () => {
    if (!plantId) return;
    if (window.confirm(`Are you sure you wish to delete "${plantName || 'this specimen'}" from your sanctuary cloud database?`)) {
      try {
        await PlantService.deletePlant(plantId);
        triggerHaptic('heavy');
        setIsEditModalOpen(false);
      } catch (err) {
        console.error('Failed to delete plant:', err);
      }
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
        {/* Left Panel - Plant of the Day OR Empty Sanctuary State */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {totalPlants === 0 ? (
            <div className="relative rounded-3xl p-10 oiled-teak-frame text-center flex flex-col items-center justify-center min-h-[420px] shadow-lg">
              <div className="w-20 h-20 rounded-full bg-moss/10 flex items-center justify-center text-4xl mb-6 shadow-inner border border-moss/20">
                🪴
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm -rotate-1 zinc-stake font-serif tracking-widest text-[10px] uppercase font-bold mb-4">
                🏷️ VACANT POTTING BENCH
              </div>
              <h2 className="text-3xl font-serif font-bold text-text-bark mb-3">
                No Specimens in Sanctuary
              </h2>
              <p className="text-sm text-text-stone max-w-md mb-8 leading-relaxed font-medium">
                The conservatory potting benches are ready. Catalog your first botanical specimen in the Lab to record its vitality and mount it on the teak bench.
              </p>
              <motion.button
                onClick={onAddPlant}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-full font-bold text-white shadow-lg flex items-center gap-2 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, var(--moss) 0%, var(--moss-light) 100%)',
                  boxShadow: '0 10px 25px rgba(90, 125, 90, 0.3)'
                }}
              >
                🌱 Induct First Specimen
              </motion.button>
            </div>
          ) : (
            <div
              className="relative rounded-3xl overflow-hidden oiled-teak-frame transition-all duration-300 hover:shadow-2xl"
            >
            {/* Oiled Teak Top Slat Molding Accent */}
            <div className="h-2 w-full bg-gradient-to-r from-[#4d321d] via-[#785333] to-[#4d321d] opacity-90 shadow-inner" />

            {/* Vine border animation */}
            {!shouldDisableAnimations && (
              <motion.svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
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

            {/* Plant Photo Container */}
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
                            duration: 0.5, 
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
                            duration: 0.55, 
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
                            duration: 0.55, 
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

              {/* Engraved Brass Barometer / Score Ring */}
              <motion.div
                className="absolute bottom-5 right-5 w-26 h-26 rounded-full brass-bezel flex flex-col items-center justify-center backdrop-blur-md text-center cursor-default z-20 p-1"
                animate={!shouldDisableAnimations ? {
                  boxShadow: [
                    '0 4px 14px rgba(184,149,82,0.3), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(90,65,25,0.45)',
                    '0 6px 22px rgba(184,149,82,0.55), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(90,65,25,0.45)',
                    '0 4px 14px rgba(184,149,82,0.3), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(90,65,25,0.45)'
                  ]
                } : {}}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <div className="text-[7px] font-black uppercase tracking-[0.22em] text-[#7a602f] dark:text-[#d4af37]/90 leading-tight">
                  BAROMETER
                </div>
                <div className="text-2xl font-serif font-black text-[#2c1d08] dark:text-[#f7edd6] leading-none my-0.5">
                  {healthScore}%
                </div>
                <div className="text-[8px] font-bold uppercase tracking-wider text-[#3d5a3d] dark:text-[#8fb58f]">
                  {healthLabel}
                </div>
                <div className="text-[6px] font-mono tracking-widest text-[#7a602f]/70 dark:text-[#d4af37]/60 mt-0.5">
                  VITALITY GAUGE
                </div>
              </motion.div>

              {/* Analyzed Zinc Badge */}
              <motion.div
                className="absolute top-5 right-5 px-3 py-1.5 rounded-sm zinc-stake text-[11px] font-serif tracking-wider shadow-sm flex items-center gap-1.5"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <span>✨</span>
                <span>{lastAnalyzed}</span>
              </motion.div>
            </div>

            {/* Plant Info & Oiled Teak Potting Bench Actions */}
            <div className="p-8 bg-gradient-to-b from-transparent to-black/[0.02] dark:to-white/[0.02]">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm -rotate-1 zinc-stake font-serif tracking-widest text-[10px] uppercase font-bold shadow-xs">
                      🏷️ SPECIMEN NO. 0{plantIndex + 1}
                    </span>
                    <h2
                      className="text-3xl font-serif font-bold text-text-bark"
                    >
                      {plantName}
                    </h2>
                  </div>
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
                  className="text-xs font-serif italic mb-5 text-moss tracking-wide"
                >
                  Botanical Classification: {plantSpecies}
                </p>

                {/* Potting Bench Care Tools Tray */}
                <div className="pt-4 border-t border-border-light/60 flex flex-wrap items-center gap-3">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-text-stone/70 mr-1">
                    Bench Tools:
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTriggerAction('water')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold font-serif focus:outline-none cursor-pointer"
                  >
                    💧 Hydrate Specimen
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTriggerAction('prune')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold font-serif focus:outline-none cursor-pointer"
                  >
                    ✂️ Prune Foliage
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTriggerAction('nourish')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white transition-all text-xs font-bold font-serif focus:outline-none cursor-pointer"
                  >
                    🧪 Botanical Tonic
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>
          )}
        </motion.div>


        {/* Right Panel - Garden Pulse */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex flex-col gap-6"
        >
          <section className="rounded-[var(--radius-md)] border border-border-light bg-bg-secondary p-6 shadow-[var(--shadow-sm)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Garden status</p>
            <h3 className="mt-2 text-xl font-serif font-semibold text-text-bark">{greeting}</h3>
            <dl className="mt-6 grid grid-cols-2 border-t border-border-light">
              {[
                { label: 'Temperature', value: weather?.temp != null ? `${Math.round(weather.temp)}°C` : '28°C' },
                { label: 'Humidity', value: weather?.humidity != null ? `${Math.round(weather.humidity)}%` : '62%' },
                { label: 'Plants', value: totalPlants.toString() },
                { label: 'Current streak', value: `${profile?.currentStreak || 0}d` }
              ].map((stat) => (
                <div key={stat.label} className="border-b border-border-light py-4 odd:pr-4 even:pl-4 even:border-l">
                  <dt className="text-xs text-text-stone">{stat.label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-text-bark">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Add Plant Button */}
          <motion.button
            onClick={onAddPlant}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Add a new plant to your garden"
            className="w-full min-h-11 py-3 rounded-[var(--radius-sm)] font-semibold text-white transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 active:scale-[0.99]"
            style={{
              background: 'var(--moss)',
              boxShadow: 'var(--shadow-sm)'
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
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

              <div className="flex flex-col gap-3">
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

                <button
                  type="button"
                  onClick={handleDeletePlant}
                  className="w-full py-2.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
                >
                  Delete Specimen from Cloud
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
