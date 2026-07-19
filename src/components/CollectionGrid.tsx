import React from 'react';
import { PlantCard } from './PlantCard';
import { motion } from 'framer-motion';
import { ArrowUpDown, Star, Sparkles, Heart, Droplets, Calendar } from 'lucide-react';

interface Plant {
  id: string;
  name: string;
  speciesName: string;
  rarity: string;
  health: number;
  daysSinceWater: number;
  age: number;
  seedsEarned: number;
  discoveredAt: string;
  isFirstDiscovery: boolean;
  image: string;
}

interface CollectionGridProps {
  plants: Plant[];
}

export const CollectionGrid = ({ plants }: CollectionGridProps) => {
  return (
    <section className="max-w-6xl mx-auto px-6 pb-16">
      {/* Filter Bar — ONLY show when collection > 0 */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button className="px-4 py-2 rounded-full bg-[var(--moss)] text-white text-sm font-medium">All</button>
        {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map((tier) => (
          <button key={tier} className="px-4 py-2 rounded-full border border-[var(--border)] text-[var(--text-stone)] text-sm hover:bg-white/50 transition-colors whitespace-nowrap">
            {tier}
          </button>
        ))}
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-bark)]">
          <ArrowUpDown className="w-3.5 h-3.5" />
          Recent First
        </button>
      </div>
      
      {/* Masonry-style Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {plants.map((plant, index) => (
          <motion.div
            key={plant.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="group relative rounded-2xl overflow-hidden bg-white/80 border border-[var(--border)] backdrop-blur-sm shadow-sm hover:shadow-xl transition-all cursor-pointer"
          >
            {/* Rarity Glow Effect */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} 
                 style={{ boxShadow: `inset 0 0 40px ${getRarityColor(plant.rarity)}20` }} />
            
            {/* Image Area */}
            <div className="relative aspect-[3/4] overflow-hidden">
              <img src={plant.image} alt={plant.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              
              {/* Rarity Badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md"
                   style={{ background: `${getRarityColor(plant.rarity)}CC` }}>
                {plant.rarity}
              </div>
              
              {/* First Discovery Star */}
              {plant.isFirstDiscovery && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--gold)] flex items-center justify-center shadow-lg">
                  <Star className="w-4 h-4 text-white fill-white" />
                </motion.div>
              )}
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--text-bark)]/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                <p className="text-white text-sm font-medium">Discovered {plant.discoveredAt}</p>
                <p className="text-white/70 text-xs">+{plant.seedsEarned} seeds earned</p>
              </div>
            </div>
            
            {/* Info Area */}
            <div className="p-3.5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-base text-[var(--text-bark)]">{plant.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] italic">{plant.speciesName}</p>
                </div>
                <div className="flex items-center gap-1 text-[var(--gold)]">
                  <Sparkles className="w-3 h-3" />
                  <span className="text-xs font-mono">{plant.seedsEarned}</span>
                </div>
              </div>
              
              {/* Mini Stats */}
              <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-[var(--border)]">
                <div className="flex items-center gap-1">
                  <Heart className={`w-3 h-3 ${plant.health >= 80 ? 'text-[var(--health-good)]' : 'text-[var(--health-warn)]'}`} />
                  <span className="text-[10px] text-[var(--text-stone)]">{plant.health}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-[var(--sage)]" />
                  <span className="text-[10px] text-[var(--text-stone)]">{plant.daysSinceWater}d</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[var(--sage)]" />
                  <span className="text-[10px] text-[var(--text-stone)]">{plant.age} days old</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

function getRarityColor(rarity: string) {
  const colors: Record<string, string> = {
    common: 'var(--rarity-common)',
    uncommon: 'var(--rarity-uncommon)',
    rare: 'var(--rarity-rare)',
    epic: 'var(--rarity-epic)',
    legendary: 'var(--rarity-legendary)',
  };
  return colors[rarity] || 'var(--text-muted)';
}