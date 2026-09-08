import React from 'react';
import { motion } from 'framer-motion';
import { Archive, MessageSquare, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { usePageTransition } from './PageTransitionContext';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { GameService } from '@/services/gameService';

export default function SanctuaryHub() {
  const { transitionTo } = usePageTransition();
  const { theme } = useDayNightTheme();

  const cards = useLiveQuery(() => db.cards.toArray()) || [];
  const profile = useLiveQuery(() => GameService.getProfile());

  return (
    <div className="max-w-7xl mx-auto px-4 mb-16">
      <div className="flex flex-col md:flex-row gap-8 items-stretch">
        
        {/* Asymmetrical Column 1: Sim Lab (60% width on large screens) */}
        <motion.div
          whileHover={{ y: -6, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex-grow md:w-[58%] rounded-[2rem] oiled-teak-frame p-8 flex flex-col justify-between relative overflow-hidden group cursor-pointer shadow-xs hover:shadow-lg transition-shadow duration-300"
          onClick={() => transitionTo('/collection', 'Sim Lab')}
        >
          {/* Top Teak Molding Slat */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#4d321d] via-[#785333] to-[#4d321d] opacity-80 absolute top-0 left-0" />

          {/* Subtle background graphics */}
          <div className="absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 opacity-[0.03] text-moss pointer-events-none group-hover:scale-110 transition-transform duration-1000">
            <Archive size={300} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-8 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-moss text-white rounded-xl border border-white/20 shadow-xs">
                  <ShieldCheck size={18} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-text-stone">Conservatory Archives & Ledger</span>
              </div>
              <span className="px-3 py-1 bg-moss/10 text-moss text-[10px] font-black uppercase tracking-widest border border-moss/20 rounded-md">
                {cards.length} specimens registered
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl font-serif font-bold text-text-bark mb-4 leading-tight">
              The Botanical <span className="italic text-moss">Sim Lab</span>
            </h2>
            <p className="text-sm text-text-stone max-w-lg mb-8 leading-relaxed font-medium">
              Inspect the heirloom genetic database of your estate collection. Track growth stages, verify rarity tiers, and calculate cumulative seed yields.
            </p>
          </div>

          <div className="flex items-end justify-between border-t border-border-light pt-6 mt-auto">
            <div className="flex gap-6">
              <div>
                <span className="text-[9px] font-black uppercase text-text-stone tracking-wider block mb-1">Estate Yield</span>
                <span className="text-lg font-mono font-bold text-text-bark">🌱 {profile?.seeds != null ? profile.seeds.toLocaleString() : '0'}</span>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-text-stone tracking-wider block mb-1">Sanctuary Vault</span>
                <span className="text-lg font-bold text-moss font-serif italic">Operational</span>
              </div>
            </div>

            <motion.div
              whileHover={{ x: 6 }}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-moss group-hover:underline"
            >
              Enter Sim Lab <ArrowRight size={14} />
            </motion.div>
          </div>
        </motion.div>

        {/* Asymmetrical Column 2: The Chat (42% width on large screens) */}
        <motion.div
          whileHover={{ y: -6, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex-grow md:w-[42%] rounded-[2rem] oiled-teak-frame p-8 flex flex-col justify-between relative overflow-hidden group cursor-pointer shadow-xs hover:shadow-lg transition-shadow duration-300"
          onClick={() => transitionTo('/assistant', 'AI Assistant')}
        >
          {/* Top Teak Molding Slat */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#4d321d] via-[#785333] to-[#4d321d] opacity-80 absolute top-0 left-0" />

          {/* Subtle background graphics */}
          <div className="absolute right-0 bottom-0 translate-y-1/4 translate-x-1/4 opacity-[0.03] text-moss pointer-events-none group-hover:scale-110 transition-transform duration-1000">
            <MessageSquare size={250} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-8 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-moss text-white rounded-xl border border-white/20 shadow-xs">
                  <Sparkles size={18} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-text-stone">Estate Apothecary Desk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono font-bold uppercase text-moss">Live</span>
              </div>
            </div>

            <h2 className="text-3xl font-serif font-bold text-text-bark mb-4 leading-tight">
              Head Botanist <span className="italic text-moss">Consultant</span>
            </h2>
            <p className="text-sm text-text-stone mb-8 leading-relaxed font-medium">
              Consult the Gemini LLM engine. Diagnose plant pathologies instantly, formulate custom potting recipes, or study rare plant biology.
            </p>
          </div>

          <div className="flex items-end justify-between border-t border-border-light pt-6 mt-auto">
            <div>
              <span className="text-[9px] font-black uppercase text-text-stone tracking-wider block mb-1">Intelligence Core</span>
              <span className="text-xs font-bold text-text-bark font-mono">Gemini Pro 1.5</span>
            </div>

            <motion.div
              whileHover={{ x: 6 }}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-moss group-hover:underline"
            >
              Consult Botanist <ArrowRight size={14} />
            </motion.div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
