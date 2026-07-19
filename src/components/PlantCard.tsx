import React from 'react';
import { motion } from 'framer-motion';
import { Droplets } from 'lucide-react';

interface PlantCardProps {
  id: string;
  photoUrl: string;
  nickname: string;
  healthScore: number;
  daysSinceWater: number;
  speciesName: string;
}

export const PlantCard = ({ id, photoUrl, nickname, healthScore, daysSinceWater, speciesName }: PlantCardProps) => {
  // Determine health dot color
  let healthDotColor: string;
  if (healthScore >= 90) {
    healthDotColor = 'bg-[var(--health-good)]';
  } else if (healthScore >= 70) {
    healthDotColor = 'bg-[var(--health-warn)]';
  } else {
    healthDotColor = 'bg-[var(--health-bad)]';
  }

  return (
    <motion.div
      key={id}
      whileHover={{ y: -4 }}
      className="group rounded-2xl overflow-hidden bg-white/70 border border-[var(--border)] backdrop-blur-sm shadow-sm hover:shadow-md transition-all cursor-pointer"
    >
      <div className="aspect-square overflow-hidden relative">
        <img src={photoUrl} alt={nickname} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className={`absolute top-3 right-3 w-3 h-3 rounded-full border-2 border-white shadow-sm ${healthDotColor}`} />
      </div>
      <div className="p-3">
        <p className="font-serif text-sm text-[var(--text-bark)]">{nickname}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-[var(--text-muted)]">{speciesName}</p>
          <div className="flex items-center gap-1 text-[var(--text-muted)]">
            <Droplets className="w-3 h-3" />
            <span className="text-[10px]">{daysSinceWater}d</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};