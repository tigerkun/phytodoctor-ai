import React from 'react';
import { PhytoCard as PhytoCardType } from '../types';
import { Shield, Zap, Heart, Wind, Star } from 'lucide-react';

interface Props {
  card: PhytoCardType;
  onClick?: () => void;
  className?: string;
}

/**
 * PhytoCard Component
 * Visual representation of a collectible specimen card.
 * Uses CSS transitions for "liquid metal" and holographic effects.
 */
export default function PhytoCard({ card, onClick, className = '' }: Props) {
  const rarityColors = {
    common: 'border-garden-olive/20 bg-white text-garden-earth',
    uncommon: 'border-blue-400/30 bg-blue-50 text-blue-900',
    rare: 'border-purple-400/30 bg-purple-50 text-purple-900',
    epic: 'border-orange-400/30 bg-orange-50 text-orange-900',
    legendary: 'border-yellow-400/40 bg-yellow-50 text-garden-earth',
    mythic: 'border-garden-earth bg-garden-earth text-white'
  };

  return (
    <div 
      onClick={onClick}
      className={`card-interactive relative w-full aspect-[2/3] rounded-[2.5rem] border shadow-2xl p-6 flex flex-col justify-between overflow-hidden cursor-pointer ${rarityColors[card.rarity]} ${className}`}
      id={`phytocard-${card.id}`}
    >
      {/* Holographic Overlay for high rarity */}
      {['legendary', 'mythic'].includes(card.rarity) && (
        <div className="absolute inset-0 animate-holographic opacity-20 pointer-events-none mix-blend-overlay bg-gradient-to-tr from-cyan-400 via-purple-500 to-yellow-400" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start z-10">
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest opacity-60">
            Lv. {card.level} Specimen
          </span>
          <h3 className="font-serif text-2xl font-bold leading-tight">{card.commonName}</h3>
          <p className="text-[10px] italic opacity-70">{card.species}</p>
        </div>
        <div className="w-8 h-8 rounded-full border border-current/20 flex items-center justify-center">
          <Star size={12} fill={card.isFavorite ? 'currentColor' : 'none'} />
        </div>
      </div>

      {/* Specimen Art */}
      <div className="flex-grow flex items-center justify-center py-4 z-10 relative group-hover:scale-110 transition-transform duration-700">
         <div className="absolute inset-0 m-4 rounded-full overflow-hidden border-2 border-white/20 shadow-xl opacity-90 group-hover:opacity-100 transition-opacity">
            <img 
               src={getPlantImageUrl(card.species)} 
               alt={card.commonName}
               className="w-full h-full object-cover object-center"
               loading="lazy"
            />
         </div>
      </div>

      {/* Footer / Stats */}
      <div className="space-y-4 z-10">
        <div className="grid grid-cols-2 gap-2 text-[8px] font-black uppercase tracking-widest">
          <Stat icon={<Heart size={8} />} label="Health" value={card.stats.health} />
          <Stat icon={<Shield size={8} />} label="Defense" value={card.stats.defense} />
          <Stat icon={<Zap size={8} />} label="Attack" value={card.stats.attack} />
          <Stat icon={<Wind size={8} />} label="Speed" value={card.stats.speed} />
        </div>

        {/* Rarity Bar */}
        <div className={`text-center py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-current/10 ${card.rarity === 'mythic' ? 'bg-white/10' : 'bg-current/5'}`}>
          {card.rarity} Tier
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 bg-current/5 p-2 rounded-xl">
      <span className="opacity-60">{icon}</span>
      <div className="flex flex-col">
        <span className="opacity-40">{label}</span>
        <span className="text-[10px] leading-tight">{Math.round(value)}</span>
      </div>
    </div>
  );
}
