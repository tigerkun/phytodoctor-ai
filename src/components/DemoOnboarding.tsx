import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Leaf, Sparkles, User, ArrowRight, History } from 'lucide-react';
import { seedDemoGarden, DEMO_PROFILES } from '../demo/seedDemoGarden';

interface DemoOnboardingProps {
  onComplete: () => void;
}

export default function DemoOnboarding({ onComplete }: DemoOnboardingProps) {
  const handleSelectDemo = async (key: keyof typeof DEMO_PROFILES) => {
    await seedDemoGarden(key);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-garden-earth/95 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl bg-white/5 border border-white/10 rounded-[3rem] p-8 md:p-12 overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Leaf size={120} className="text-garden-sage rotate-12" />
        </div>

        <div className="relative z-10 text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Welcome to Botanical Guardian</h2>
          <p className="text-white/60 text-sm md:text-base max-w-lg mx-auto">
            Experience the platform with curated demo gardens, or start fresh with your own sanctuary.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {Object.entries(DEMO_PROFILES).map(([key, profile], idx) => (
            <motion.button
              key={key}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => handleSelectDemo(key as any)}
              className="group relative p-6 bg-white/5 border border-white/5 hover:border-garden-sage/40 rounded-3xl text-left transition-all hover:bg-white/10"
            >
              <div className="w-10 h-10 rounded-full bg-garden-sage/20 flex items-center justify-center mb-4 text-garden-sage group-hover:scale-110 transition-transform">
                <User size={20} />
              </div>
              <h4 className="text-white font-bold mb-1">{profile.username}</h4>
              <p className="text-[10px] text-white/40 mb-3 uppercase tracking-widest">{key === 'arjun' ? 'Consistent' : key === 'priya' ? 'Expert' : 'Beginner'}</p>
              <p className="text-[11px] text-white/60 italic leading-snug">
                {key === 'arjun' ? '4 plants · 45-day streak. Experience a healthy, consistent garden.' : 
                 key === 'priya' ? 'Rare collection. Deep humidity tracking and high XP cards.' : 
                 'Comeback child. See how a wilted garden recovers with data.'}
              </p>
              
              <div className="absolute bottom-4 right-4 text-garden-sage opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight size={16} />
              </div>
            </motion.button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={onComplete}
            className="px-10 py-4 bg-white text-garden-earth rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-3"
          >
            <Sparkles size={18} />
            Start My Own Garden
          </button>
          <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
            <History size={12} />
            Demo data can be removed in settings at any time
          </p>
        </div>
      </motion.div>
    </div>
  );
}
