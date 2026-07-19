import { motion } from 'framer-motion';
import { Sparkles, Pencil, Droplets, Thermometer, Sprout, Flame, Plus, AlertCircle, ShoppingBag, CloudSun, Lightbulb } from 'lucide-react';

interface HeroSectionProps {
  today: {
    photoUrl: string;
    nickname: string;
    speciesName: string;
    healthScore: number;
    geminiAnalyzedAt: string;
  };
}

export const HeroSection = ({ today }: HeroSectionProps) => {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-8 pb-10 grid md:grid-cols-[1fr_380px] gap-8">
      
      {/* LEFT: Plant of the Day */}
      <div className="relative">
        <div className="relative rounded-3xl overflow-hidden aspect-[4/3] shadow-lg shadow-[var(--moss)]/10 border border-[var(--border)]">
          <img src={today.photoUrl} alt={today.nickname} className="w-full h-full object-cover" />
          
          {/* Health Ring */}
          <div className="absolute bottom-4 right-4 w-16 h-16">
            <svg className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.4)" strokeWidth="4" fill="none" />
              <circle cx="32" cy="32" r="28" stroke="var(--health-good)" strokeWidth="4" fill="none" 
                      strokeDasharray="175" strokeDashoffset="14" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-white drop-shadow">{today.healthScore}</span>
            </div>
          </div>
          
          {/* Gemini Badge */}
          <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-white/50">
            <Sparkles className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span className="text-xs text-[var(--text-bark)] font-medium">Analyzed just now</span>
          </div>
        </div>
        
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-3xl text-[var(--text-bark)]">{today.nickname}</h2>
              <button className="text-[var(--text-muted)] hover:text-[var(--moss)]"><Pencil className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-[var(--text-stone)] mt-0.5">{today.speciesName}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[var(--health-good)]/10 text-[var(--health-good)] text-xs font-medium">Thriving</span>
        </div>
      </div>
      
      {/* RIGHT: Garden Pulse */}
      <div className="space-y-5">
        <div>
          <p className="text-sm text-[var(--terracotta)] font-medium mb-1">Friday, May 22</p>
          <h1 className="font-serif text-4xl text-[var(--text-bark)] leading-tight">
            Good morning,<br />
            <span className="italic text-[var(--moss)]">Priya</span>
          </h1>
          <p className="text-[var(--text-stone)] mt-3 leading-relaxed">
            {today.nickname} is thriving. Your Snake Plant needs water this afternoon. 3 plants are enjoying the morning sun.
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Droplets, label: 'Water in 2h', sub: 'Snake Plant', color: 'var(--terracotta)' },
            { icon: Thermometer, label: '34°C', sub: '62% humidity', color: 'var(--gold)' },
            { icon: Sprout, label: '8 plants', sub: 'All healthy', color: 'var(--moss)' },
            { icon: Flame, label: '12 days', sub: 'Login streak', color: 'var(--terracotta)' },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-2xl bg-white/70 border border-[var(--border)] backdrop-blur-sm">
              <stat.icon className="w-4 h-4 mb-1.5" style={{ color: stat.color }} />
              <p className="text-sm font-semibold text-[var(--text-bark)]">{stat.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{stat.sub}</p>
            </div>
          ))}
        </div>
        
        <button className="w-full py-3.5 rounded-2xl bg-[var(--terracotta)] text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-[var(--terracotta)]/20">
          <Plus className="w-4 h-4" />
          Add a Plant
        </button>
      </div>
    </section>
  );
};