import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Star, PackageOpen, Sparkles, Zap, Shield, TrendingUp, RefreshCw, Activity } from 'lucide-react';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import PhytoCardComponent from '../components/game/PhytoCard';
import PageWrapper from '../components/home/PageWrapper';
import { useToast } from '../components/Toast';

const SUPPLIES = [
  {
    id: 'meter',
    name: 'Precision Moisture Meter',
    cost: 250,
    desc: 'Reveals exact hydration levels during check-ins.',
    icon: <RefreshCw size={24} />,
    bonus: '+5% Accuracy'
  },
  {
    id: 'light',
    name: 'Solar-Full Grow Light',
    cost: 600,
    desc: 'Passively increases card XP gain by 15%.',
    icon: <Zap size={24} />,
    bonus: '+15% XP Gain'
  },
  {
    id: 'fert',
    name: 'Mycorrhizal Fertilizer',
    cost: 400,
    desc: 'Gives root systems 10% more Defense in battles.',
    icon: <Shield size={24} />,
    bonus: '+10% DEF'
  }
];

export default function Shop() {
  const userId = GameService.getUserId();
  const profile = useLiveQuery(() => GameService.getProfile(userId), [userId]);
  const plants = useLiveQuery(() => db.plants.where('userId').equals(userId).toArray(), [userId]) || [];

  const { success } = useToast();

  const buySupply = (id: string, cost: number) => {
     if (!profile || profile.seeds < cost) return;
     GameService.addSeeds(-cost, 'spend', `Purchased ${id}`);
     success('Item acquired! Benefits applied to your garden network.');
  };

  if (!profile) return null;

  return (
    <PageWrapper className="max-w-7xl mx-auto px-6 py-12 pb-32">
      <header className="mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-garden-earth text-white rounded-xl flex items-center justify-center">
                    <PackageOpen size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-garden-earth/40">Resource Dispensary</span>
                </div>
                <h1 className="font-serif text-5xl md:text-6xl font-bold text-garden-earth mb-4">Botanical <span className="italic text-garden-sage">Exchange</span></h1>
                <p className="text-xl text-garden-slate max-w-2xl">Reinvest your hard-earned seeds into genetic upgrades and high-performance care equipment.</p>
            </div>
            <div className="bg-white px-8 py-6 rounded-[2.5rem] shadow-xl border border-garden-olive/10 flex items-center gap-4 group">
                <div className="w-12 h-12 bg-garden-sage rounded-full flex items-center justify-center text-2xl group-hover:rotate-12 transition-transform">🌱</div>
                <div>
                   <span className="text-[8px] font-black uppercase tracking-widest text-garden-earth/30">Available Balance</span>
                   <p className="text-3xl font-black text-garden-earth leading-none">{profile.seeds.toLocaleString()}</p>
                </div>
            </div>
        </div>
      </header>

      {/* Care Supplies Section */}
      <div className="space-y-12">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {SUPPLIES.map(item => (
              <div key={item.id} className="bg-white p-8 rounded-[3rem] border border-garden-olive/10 shadow-xl flex flex-col justify-between group h-full">
                 <div>
                    <div className="w-14 h-14 bg-garden-sage/10 rounded-2xl flex items-center justify-center text-garden-sage mb-6 group-hover:scale-110 transition-transform">
                       {item.icon}
                    </div>
                    <h3 className="text-xl font-bold text-garden-earth mb-2">{item.name}</h3>
                    <p className="text-xs text-garden-earth/50 mb-6 leading-relaxed italic">{item.desc}</p>
                    <div className="text-[10px] font-black text-garden-sage uppercase tracking-widest mb-8 flex items-center gap-2">
                       <TrendingUp size={12} /> {item.bonus}
                    </div>
                 </div>
                 <button 
                   onClick={() => buySupply(item.id, item.cost)}
                   disabled={profile.seeds < item.cost}
                   className="w-full py-4 bg-garden-beige/50 text-garden-earth rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-garden-earth hover:text-white transition-all disabled:opacity-30 border border-garden-olive/10"
                 >
                   Buy for 🌱 {item.cost}
                 </button>
              </div>
           ))}
         </div>

         {/* Recommended Section: Dynamic based on garden state */}
           {plants.length > 0 && (
              <section className="bg-garden-earth p-12 rounded-[4rem] text-white relative overflow-hidden shadow-2xl">
                 <div className="absolute top-0 right-0 p-12 opacity-10 -rotate-12 pointer-events-none">
                    <Sparkles size={200} />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                       <div className="w-8 h-8 bg-garden-sage text-white rounded-lg flex items-center justify-center">
                          <Activity size={16} />
                       </div>
                       <h2 className="text-3xl font-serif font-bold italic tracking-tight">Phyto-Doctor Recommendations</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       {/* Alert-based recommendation */}
                       {plants.find(p => p.status === 'Alert' || p.status === 'Watching') ? (
                          <div className="bg-white/10 p-10 rounded-[3rem] border border-white/10 backdrop-blur-md">
                             <div className="flex items-start gap-6">
                                <div className="shrink-0">
                                   <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-400 mb-4 animate-pulse">
                                      <Shield size={32} />
                                   </div>
                                </div>
                                <div>
                                   <h3 className="text-xl font-bold mb-2">Emergency Recovery Protocol</h3>
                                   <p className="text-sm text-white/60 mb-6 leading-relaxed">System has detected stress in <span className="text-white font-bold">{plants.find(p => p.status === 'Alert' || p.status === 'Watching')?.name}</span>. Specimen requires immediate Bio-Chelated Mineral boost to prevent root decay.</p>
                                   <button 
                                      onClick={() => buySupply('mineral-boost', 450)}
                                      className="px-8 py-3 bg-white text-garden-earth rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-garden-sage hover:text-white transition-all shadow-lg"
                                   >
                                      Equip Recovery Serum (🌱 450)
                                   </button>
                                </div>
                             </div>
                          </div>
                       ) : (
                          <div className="bg-white/10 p-10 rounded-[3rem] border border-white/10 backdrop-blur-md">
                             <div className="flex items-start gap-6">
                                <div className="shrink-0">
                                   <div className="w-16 h-16 bg-garden-sage/20 rounded-2xl flex items-center justify-center text-garden-sage mb-4">
                                      <TrendingUp size={32} />
                                   </div>
                                </div>
                                <div>
                                   <h3 className="text-xl font-bold mb-2">Strategic Growth Inversion</h3>
                                   <p className="text-sm text-white/60 mb-6 leading-relaxed">Your collection is stable. Optimize photosynthetic efficiency for <span className="text-white font-bold">{plants[0].name}</span> by deploying Nano-Foliar Mist.</p>
                                   <button 
                                      onClick={() => buySupply('foliar-mist', 300)}
                                      className="px-8 py-3 bg-garden-sage text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-lg"
                                   >
                                      Purchase Optimization (🌱 300)
                                   </button>
                                </div>
                             </div>
                          </div>
                       )}

                       {/* Genetic Analysis (Replaced Genetic Pack Ref) */}
                       <div className="bg-garden-cream/10 p-10 rounded-[3rem] border border-white/5 flex flex-col justify-between">
                          <div>
                             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40 block mb-4">Genetic Forecast</span>
                             <p className="text-lg leading-relaxed mb-8 italic">"Analyzing your {plants.length} specimens... Ensure you check-in during peak sunlight hours to maximize the genetic stability of your cards in the Vault."</p>
                          </div>
                          <div className="flex items-center gap-4 text-white/40 text-[10px] font-black uppercase tracking-widest">
                             <Star size={14} className="text-yellow-400" /> Collection Rank: {plants.length > 5 ? 'Elite' : 'Novice'}
                          </div>
                       </div>
                    </div>
                 </div>
              </section>
           )}
        </div>

      <AnimatePresence>
      </AnimatePresence>
    </PageWrapper>
  );
}
