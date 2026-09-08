import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useEcoMode } from '@/hooks/useEcoMode';

interface Plant {
  id: string;
  nickname: string;
  species: string;
  healthScore: number;
  lastWatered: Date;
  image: string;
  lastPhoto: string;
}

interface PlantGalleryProps {
  plants: Plant[];
  onSelectPlant: (plant: Plant) => void;
}

export function PlantGallery({ plants, onSelectPlant }: PlantGalleryProps) {
  const { theme } = useDayNightTheme();
  const { shouldDisableAnimations } = useEcoMode();

  const getHealthColor = (score: number) => {
    if (score >= 90) return '#5a7a5a';
    if (score >= 70) return '#7a9e7a';
    if (score >= 50) return '#d4af37';
    return '#d4755a';
  };

  const getDaysSinceWater = (date: Date) => {
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.4
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 30 }
  };

  return (
    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-4xl font-serif font-bold mb-4"
          style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}
        >
          The Living Conservatory Collection
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-lg mb-12"
          style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }}
        >
          {plants.length === 0 ? 'No specimens currently cataloged in sanctuary' : `${plants.length} botanical specimen${plants.length === 1 ? '' : 's'} flourishing under your stewardship`}
        </motion.p>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {plants.map((plant, index) => {
            const healthColor = getHealthColor(plant.healthScore);
            const daysSince = getDaysSinceWater(plant.lastWatered);
            // Alternate subtle rotation angles for authentic handmade botanical stake feel
            const rotationClass = index % 2 === 0 ? '-rotate-2' : 'rotate-1';

            return (
              <motion.div
                key={plant.id}
                variants={cardVariants}
                whileHover={!shouldDisableAnimations ? { y: -8 } : {}}
                onClick={() => onSelectPlant(plant)}
                className="cursor-pointer group"
              >
                <div
                  className="rounded-2xl overflow-hidden oiled-teak-frame transition-all duration-300 hover:shadow-xl h-full flex flex-col relative"
                >
                  {/* Top Teak Molding Slat */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-[#4d321d] via-[#785333] to-[#4d321d] opacity-80" />

                  {/* Image Container */}
                  <div className="relative h-48 bg-gradient-to-b from-gray-300 to-gray-400 overflow-hidden">
                    <motion.img
                      src={plant.image}
                      alt={plant.nickname}
                      className="w-full h-full object-cover"
                      initial={{ scale: 1 }}
                      whileHover={!shouldDisableAnimations ? { scale: 1.08 } : {}}
                      transition={{ duration: 0.4 }}
                    />

                    {/* Rotated Zinc / Slate Seedling Stake Tag */}
                    <div
                      className={`absolute top-3 left-3 ${rotationClass} zinc-stake px-2.5 py-1 rounded-xs text-[10px] font-serif font-bold tracking-widest uppercase flex items-center gap-1.5 z-10`}
                    >
                      <span className="opacity-80">№ 0{index + 1}</span>
                      <span className="w-1 h-1 rounded-full bg-white/60" />
                      <span className="truncate max-w-[110px]">{plant.nickname}</span>
                    </div>

                    {/* Health Indicator Mini Barometer Pip */}
                    <div
                      className="absolute top-3 right-3 px-2 py-0.5 rounded-full brass-bezel text-[9px] font-serif font-black text-[#2c1d08] dark:text-[#f7edd6] shadow-xs"
                      title={`${plant.healthScore}% health`}
                    >
                      {plant.healthScore}%
                    </div>

                    {/* Stamped Slate Watering Indicator */}
                    <div
                      className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-xs text-[10px] font-mono tracking-wider font-semibold backdrop-blur-md bg-black/50 text-white/90 border border-white/20"
                    >
                      💧 {daysSince}d ago
                    </div>
                  </div>

                  {/* Content & Botanical Specimen Plate */}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <h3
                        className="text-lg font-serif font-bold mb-1 truncate text-text-bark"
                      >
                        {plant.nickname}
                      </h3>
                      <p
                        className="text-xs font-serif italic mb-3 truncate text-moss"
                      >
                        {plant.species}
                      </p>
                    </div>

                    {/* Health Score Bar */}
                    <div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
                        <motion.div
                          className="h-full rounded-full transition-all"
                          style={{ background: healthColor, width: `${plant.healthScore}%` }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${plant.healthScore}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono mt-1.5 text-text-stone">
                        <span>Vitality</span>
                        <span style={{ color: healthColor }} className="font-bold">{plant.healthScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
