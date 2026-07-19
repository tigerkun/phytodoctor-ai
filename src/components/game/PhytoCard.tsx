import React from 'react';
import { Shield, Sword, Heart, Zap, History, Star, Lock, Crown, ZapOff, Sun } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { RARITY_CONFIGS, type RarityTier } from '../../game/RARITY_DATA';
import type { PhytoCard as CardType, GrowthStage } from '../../db/database';
import { getPlantPhoto } from '../../utils/plantImage';

interface Props {
  card: CardType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  showStats?: boolean;
  animate?: 'idle' | 'reveal' | 'levelup' | 'none';
  onClick?: () => void;
}

const GROWTH_ICONS: Record<GrowthStage, string> = {
  sprout: '🌱',
  seedling: '🌿',
  juvenile: '🪴',
  mature: '🌳',
  ancient: '✨'
};

const PhytoCard: React.FC<Props> = ({ card, size = 'md', interactive = true, showStats = true, animate = 'idle', onClick }) => {
  const config = RARITY_CONFIGS[card.rarity];
  const plant = useLiveQuery(() => db.plants.get(card.plantId), [card.plantId]);

  const sizeClasses = {
    sm: 'w-32 h-44 text-[10px]',
    md: 'w-48 h-64 text-xs',
    lg: 'w-64 h-80 text-sm',
    xl: 'w-80 h-[30rem] text-base'
  };

  const frameStyles: Record<string, string> = {
    common: 'bg-gradient-to-br from-[#f5f0e8] to-[#e8e0d0] border-[#8B7355] border-4',
    uncommon: 'bg-gradient-to-br from-[#f0f0f0] to-[#d8d8d8] border-[#A8A8A8] border-4 shadow-silver',
    rare: 'bg-gradient-to-br from-[#fff8e7] to-[#f0e6c8] border-[#D4AF37] border-4 shadow-gold',
    epic: 'bg-[#1a0a2e] border-4 border-transparent bg-clip-padding before:absolute before:-inset-1 before:bg-gradient-to-r before:from-pink-500 before:via-purple-500 before:to-blue-500 before:animate-holographic before:-z-10 before:rounded-[inherit]',
    legendary: 'bg-black border-4 border-transparent bg-clip-padding overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-yellow-400/20 before:to-transparent before:animate-liquid-metal',
    mythic: 'bg-black border-2 border-[#FFD700] shadow-[0_0_40px_rgba(255,215,0,0.2)]',
    
    // Marketplace Frames
    'frame-sage-glow': 'bg-garden-beige border-garden-sage border-4 shadow-[0_0_20px_rgba(147,162,147,0.3)]',
    'frame-shimmer-gold': 'bg-black border-4 border-transparent bg-clip-padding before:absolute before:-inset-2 before:bg-[conic-gradient(from_0deg,#D4AF37,#fff8e7,#D4AF37)] before:animate-[spin_4s_linear_infinite] before:-z-10 before:rounded-[inherit]',
    'frame-holographic': 'bg-white/10 border-4 border-white/20 backdrop-blur-md before:absolute before:-inset-1 before:bg-gradient-to-br before:from-cyan-400 before:via-fuchsia-500 before:to-yellow-400 before:animate-pulse before:-z-10 before:rounded-[inherit]'
  };

  const themeStyles: Record<string, string> = {
    'theme-misty-jungle': 'bg-[#1a2e1a] border-[#2d4a2d]',
    'theme-lunar-garden': 'bg-[#0f172a] border-[#1e293b]',
    'theme-cyberpunk-neon': 'bg-[#120129] border-[#240b36]'
  };

  // Get active theme from cosmetics
  const activeTheme = useLiveQuery(() => 
    db.cosmetics.where({ userId: card.userId, itemType: 'theme', equipped: 1 }).first()
  );

  const activeFlair = useLiveQuery(() => 
    db.cosmetics.where({ userId: card.userId, itemType: 'flair', equipped: 1 }).first()
  );

  const appliedFrameStyle = (card.frameSkin && frameStyles[card.frameSkin]) || frameStyles[card.rarity];
  const appliedThemeStyle = (activeTheme && themeStyles[activeTheme.itemId]) || '';

  // Style mappings based on rarity or card state
  const artStyles = {
    common: 'grayscale-[0.05] contrast-[1.1] saturate-[1.1] brightness-[1.05]',
    uncommon: 'contrast-[1.2] saturate-[1.3] brightness-[1.1] hue-rotate-[5deg]',
    rare: 'contrast-[1.4] saturate-[1.6] brightness-[1.2] sepia-[0.1]',
    epic: 'contrast-[1.6] saturate-[1.8] brightness-[1.1] hue-rotate-[15deg] blur-[0.2px]',
    legendary: 'contrast-[1.8] saturate-[2] brightness-[1.2] invert-[0.02]',
    mythic: 'contrast-[2] saturate-[2.5] brightness-[1.3] hue-rotate-[-10deg]'
  };

  const getStyleFilter = (rarity: string) => {
    switch(rarity) {
      case 'mythic': return 'url(#painted) url(#foil)';
      case 'legendary': return 'url(#painted)';
      case 'epic': return 'url(#halftone)';
      case 'rare': return 'url(#posterize)';
      default: return 'none';
    }
  };

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`relative rounded-2xl flex flex-col p-3 text-garden-earth select-none shadow-2xl ${interactive ? 'card-interactive cursor-pointer' : ''} ${sizeClasses[size]} ${appliedFrameStyle} ${appliedThemeStyle}`}
      style={{ perspective: '1000px' }}
    >
      {/* Rarity Effects */}
      {card.isDemo && (
        <div className="absolute top-2 left-2 z-[40] bg-garden-coral text-white text-[7px] font-black uppercase px-2 py-0.5 rounded shadow-lg pointer-events-none tracking-widest">
           DEMO
        </div>
      )}
      {card.rarity === 'rare' && (
        <div className="absolute -top-2 -right-2 text-[#D4AF37] z-30 animate-pulse-glow">
          <Star size={24} fill="currentColor" />
        </div>
      )}

      {/* Header */}
      <div className={`flex justify-between items-start mb-2 z-10 ${['epic', 'legendary', 'mythic'].includes(card.rarity) ? 'text-white' : 'text-garden-earth'}`}>
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="font-black uppercase tracking-tighter leading-none text-[8px] opacity-70">{card.rarity}</span>
            {activeFlair && (
              <span className="text-[7px] font-black uppercase text-garden-sage whitespace-nowrap">| {activeFlair.itemId.replace('flair-', '').replace('-', ' ')}</span>
            )}
          </div>
          <h3 className="font-bold tracking-tight truncate leading-tight mt-0.5 max-w-[120px]">{card.commonName}</h3>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-black bg-garden-earth text-white px-1.5 py-0.5 rounded text-[8px]">LV.{card.level}</span>
          <span className="mt-1 text-lg">{GROWTH_ICONS[card.growthStage]}</span>
        </div>
      </div>

      {/* Card Art: Stylized AI Re-imagining */}
      <div className="flex-grow aspect-[4/5] rounded-xl bg-garden-earth/10 overflow-hidden relative mb-2 flex items-center justify-center border-2 border-white/20 group shadow-inner">
         {/* Base Photo Layer with AI-Style Filters */}
         {(plant?.photoUrl || getPlantImageUrl(card.species)) ? (
            <div className="absolute inset-0 z-0">
               <img 
                 src={card.altArt || plant?.photoUrl || getPlantImageUrl(card.species)} 
                 alt={card.commonName}
                 className={`w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 ${artStyles[card.rarity]}`}
                 style={{ 
                   filter: `${getStyleFilter(card.rarity)} ${artStyles[card.rarity]}`,
                   maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)'
                 }}
               />
               
               {/* Aesthetic Overlays */}
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-white/10 mix-blend-overlay" />
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cardboard.png')] opacity-20 pointer-events-none" />
               
               {/* Scanlines for Technical look */}
               <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-20" />

               {/* Mythic/Legendary Particles */}
               {['legendary', 'mythic'].includes(card.rarity) && (
                 <div className="absolute inset-0 pointer-events-none">
                    {[...Array(6)].map((_, i) => (
                      <div 
                         key={i}
                         className="absolute bottom-0 w-1 h-1 bg-yellow-400 rounded-full blur-[1px] opacity-0 animate-[float_3s_infinite]"
                         style={{ 
                           left: `${15 + i * 15}%`, 
                           animationDelay: `${i * 0.5}s`,
                           animationDuration: `${2 + i * 0.5}s`
                         }}
                      />
                    ))}
                 </div>
               )}
            </div>
         ) : (
            <div className="text-7xl filter drop-shadow-2xl z-10 animate-pulse">
               {GROWTH_ICONS[card.growthStage]}
            </div>
         )}
         
         {/* Character Name Plate (Bottom of Art) */}
         <div className="absolute bottom-2 left-2 right-2 z-20">
            <div className={`px-3 py-1.5 rounded-lg border border-white/20 flex justify-between items-center shadow-xl ${['epic', 'legendary', 'mythic'].includes(card.rarity) ? 'bg-white/10 backdrop-blur-xl text-white' : 'bg-black/60 backdrop-blur-lg text-white'}`}>
               <span className="text-[7px] font-black uppercase tracking-widest truncate max-w-[70%]">{card.species}</span>
               <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${card.rarity === 'mythic' ? 'bg-yellow-400' : 'bg-green-400'}`} />
                  <span className="text-[6px] font-black uppercase tracking-tighter tabular-nums text-white/60">ID://{card.id.slice(0, 6)}</span>
               </div>
            </div>
         </div>

         {/* Energy Marker (Top Corner of Art) */}
         <div className="absolute top-2 left-2 z-20">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg overflow-hidden relative">
               <div className="absolute inset-0 opacity-20">
                 <Sun size={40} className="text-yellow-400 animate-[spin_15s_linear_infinite]" />
               </div>
               <Zap size={16} className={`relative z-10 transition-transform ${card.rarity === 'mythic' ? 'text-yellow-400' : 'text-white'}`} />
            </div>
         </div>

         {/* SVG Filters for Stylization */}
         <svg className="absolute w-0 h-0">
            <filter id="posterize">
              <feComponentTransfer>
                <feFuncR type="discrete" tableValues="0 0.33 0.66 1" />
                <feFuncG type="discrete" tableValues="0 0.33 0.66 1" />
                <feFuncB type="discrete" tableValues="0 0.33 0.66 1" />
              </feComponentTransfer>
            </filter>
            <filter id="halftone" x="0" y="0" width="100%" height="100%">
               <feColorMatrix type="saturate" values="2" />
               <feComponentTransfer>
                  <feFuncR type="linear" slope="2" intercept="-0.5" />
                  <feFuncG type="linear" slope="2" intercept="-0.5" />
                  <feFuncB type="linear" slope="2" intercept="-0.5" />
               </feComponentTransfer>
            </filter>
            <filter id="painted">
               <feMorphology operator="dilate" radius="2" in="SourceGraphic" result="morphed" />
               <feGaussianBlur stdDeviation="1" in="morphed" result="blurred" />
               <feComposite operator="in" in="SourceGraphic" in2="blurred" />
            </filter>
            <filter id="foil">
               <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise" />
               <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
               <feColorMatrix type="hueRotate" values="0">
                  <animate attributeName="values" from="0" to="360" dur="5s" repeatCount="indefinity" />
               </feColorMatrix>
            </filter>
         </svg>
      </div>

      {/* Stats Quick View (Bottom) */}
      {showStats && (
        <div className="mt-auto z-10 bg-black/40 p-3 rounded-xl backdrop-blur-md border border-white/10 overflow-hidden text-white">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <StatMini icon={<Sword size={10} />} value={card.stats.attack} color="bg-red-400" />
            <StatMini icon={<Shield size={10} />} value={card.stats.defense} color="bg-blue-400" />
            <StatMini icon={<Heart size={10} />} value={card.stats.health} color="bg-green-400" />
            <StatMini icon={<Zap size={10} />} value={card.stats.speed} color="bg-yellow-400" />
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center text-[7px] font-black uppercase tracking-widest opacity-60">
             <span>Power Potential</span>
             <span>{(card.stats.attack + card.stats.defense + card.stats.health / 2).toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Ability Lock */}
      {!card.abilityUnlocked && (
        <div className="absolute inset-0 bg-black/10 rounded-[inherit] flex items-center justify-center backdrop-blur-[1px] pointer-events-none z-20">
          <div className="flex flex-col items-center opacity-40">
             <Lock size={16} className="text-white" />
             <span className="text-[8px] font-black uppercase mt-1 text-white">Unlock at Lv.25</span>
          </div>
        </div>
      )}

      {/* Pedigree Icons */}
      <div className="absolute bottom-2 left-2 flex gap-1 z-30">
        {card.longestStreak >= 30 && <Crown size={14} className="text-yellow-500 fill-current" />}
        {card.alertsSurvived >= 3 && <ZapOff size={14} className="text-orange-500" />}
      </div>

      {/* Visual Texture */}
      {card.rarity === 'mythic' && (
        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay z-0" style={{ backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
      )}
    </div>
  );
};

export default PhytoCard;

function StatMini({ icon, value, color }: { icon: React.ReactNode, value: number, color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-white/60">{icon}</span>
      <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
