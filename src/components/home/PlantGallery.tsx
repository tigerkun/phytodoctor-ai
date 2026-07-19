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
          My Living Collection
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-lg mb-12"
          style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }}
        >
          {plants.length} plants thriving in your care
        </motion.p>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {plants.map((plant) => {
            const healthColor = getHealthColor(plant.healthScore);
            const daysSince = getDaysSinceWater(plant.lastWatered);

            return (
              <motion.div
                key={plant.id}
                variants={cardVariants}
                whileHover={!shouldDisableAnimations ? { y: -8 } : {}}
                onClick={() => onSelectPlant(plant)}
                className="cursor-pointer group"
              >
                <div
                  className="rounded-2xl overflow-hidden backdrop-blur-md border transition-all duration-300 hover:shadow-xl h-full flex flex-col"
                  style={{
                    background: theme === 'day'
                      ? 'rgba(255, 248, 240, 0.7)'
                      : 'rgba(30, 28, 26, 0.6)',
                    borderColor: theme === 'day'
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  {/* Image Container */}
                  <div className="relative h-48 bg-gradient-to-b from-gray-300 to-gray-400 overflow-hidden">
                    <motion.img
                      src={plant.image}
                      alt={plant.nickname}
                      className="w-full h-full object-cover"
                      initial={{ scale: 1 }}
                      whileHover={!shouldDisableAnimations ? { scale: 1.1 } : {}}
                      transition={{ duration: 0.4 }}
                    />

                    {/* Health Pulse */}
                    <motion.div
                      className="absolute top-3 right-3 w-3 h-3 rounded-full"
                      style={{
                        background: healthColor,
                        boxShadow: `0 0 10px ${healthColor}`
                      }}
                      animate={!shouldDisableAnimations ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    />

                    {/* Watering Indicator */}
                    <div
                      className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm"
                      style={{
                        background: `${healthColor}33`,
                        color: healthColor,
                        border: `1px solid ${healthColor}66`
                      }}
                    >
                      💧 {daysSince}d ago
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4">
                    <h3
                      className="text-lg font-serif font-bold mb-1 truncate"
                      style={{ color: theme === 'day' ? '#3D405B' : '#E8DCC8' }}
                    >
                      {plant.nickname}
                    </h3>
                    <p
                      className="text-xs mb-3 truncate"
                      style={{ color: theme === 'day' ? '#5F7161' : '#A8B5A0' }}
                    >
                      {plant.species}
                    </p>

                    {/* Health Score Bar */}
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: theme === 'day' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
                      <motion.div
                        className="h-full rounded-full transition-all"
                        style={{ background: healthColor, width: `${plant.healthScore}%` }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${plant.healthScore}%` }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                      />
                    </div>
                    <p
                      className="text-xs mt-2 font-mono"
                      style={{ color: healthColor }}
                    >
                      {plant.healthScore}% healthy
                    </p>
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
