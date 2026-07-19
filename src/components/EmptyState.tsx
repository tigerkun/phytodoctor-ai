import React from 'react';
import { motion } from 'framer-motion';
import { Sprout, Camera, Search, Trophy, Star, Zap } from 'lucide-react';

export default function EmptyState() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-16 text-center">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
        {/* Animated seedling illustration */}
        <div className="w-32 h-32 mx-auto mb-6 relative">
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0 flex items-center justify-center">
            <Sprout className="w-20 h-20 text-[var(--moss)]" />
          </motion.div>
          {/* Soil particles */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} className="absolute w-2 h-2 rounded-full bg-[var(--terracotta)]" 
                        style={{ bottom: '20%', left: `${20 + i * 12}%` }}
                        animate={{ y: [0, -4, 0], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }} />
          ))}
        </div>
        
        <h2 className="font-serif text-3xl text-[var(--text-bark)] mb-3">Your collection is waiting</h2>
        <p className="text-[var(--text-stone)] mb-2 max-w-md mx-auto">
          Every great garden starts with a single seed. Add your first plant and begin your journey from Sprout to Eternal Bloom.
        </p>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          You'll earn <span className="text-[var(--gold)] font-medium">+50 seeds</span> for your first discovery
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className="px-6 py-3.5 rounded-2xl bg-[var(--moss)] text-white font-medium flex items-center justify-center gap-2 hover:bg-[var(--moss)]/90 transition-colors shadow-lg shadow-[var(--moss)]/20">
            <Camera className="w-4 h-4" />
            Scan a Plant
          </button>
          <button className="px-6 py-3.5 rounded-2xl border border-[var(--border)] text-[var(--text-stone)] font-medium flex items-center justify-center gap-2 hover:bg-white/50 transition-colors">
            <Search className="w-4 h-4" />
            Browse Species Library
          </button>
        </div>
        
        {/* Quick preview of what they'll unlock */}
        <div className="mt-12 grid grid-cols-3 gap-4 max-w-lg mx-auto opacity-50">
          {[
            { icon: Trophy, label: 'Rarity Tiers', sub: '5 levels' },
            { icon: Star, label: 'Collection Score', sub: 'Earn points' },
            { icon: Zap, label: 'Seed Rewards', sub: 'Per discovery' },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-white/40 border border-[var(--border)]">
              <item.icon className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-xs font-medium text-[var(--text-bark)]">{item.label}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{item.sub}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}