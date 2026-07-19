import React from 'react';
import { PlantCard } from './PlantCard';
import { motion } from 'framer-motion';

interface PlantCollectionProps {
  plants: Array<{
    id: string;
    photoUrl: string;
    nickname: string;
    healthScore: number;
    daysSinceWater: number;
    speciesName: string;
  }>;
}

export const PlantCollection = ({ plants }: PlantCollectionProps) => {
  return (
    <div className="relative mb-16">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-[var(--text-bark)]">
        My Living Collection
      </h2>
      
      {/* Masonry grid simulation using flex wrap - in production use a proper masonry library */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plants.map(plant => (
          <motion.div 
            key={plant.id} 
            whileHover={{ y: -4 }}
            className="group"
          >
            <PlantCard 
              {...plant} 
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};