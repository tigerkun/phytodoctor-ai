import React from 'react';
import { Thermometer, Droplets, Sprout, Flame, AlertCircle, ShoppingBag, CloudSun, Lightbulb, Plus, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface SuggestionsCarouselProps {
  suggestions: {
    treatments: Array<{ step: string; done: boolean }>;
    marketProducts: Array<{ name: string; seedPrice: number; cashPrice: number; image: string }>;
    climate: { temp: number; humidity: number; city: string; tip: string; schedule: string[] };
    fact: { text: string; expanded: boolean };
  };
}

export const SuggestionsCarousel = ({ suggestions }: SuggestionsCarouselProps) => {
  return (
    <section className="max-w-6xl mx-auto px-6 pb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-xl text-[var(--text-bark)]">Garden Coach</h3>
        <span className="text-xs text-[var(--text-muted)]">Powered by Gemini</span>
      </div>
      
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
        
        {/* Treatment Card */}
        <div className="flex-shrink-0 w-80 snap-center rounded-3xl p-5 bg-white/80 border border-[var(--border)] backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[var(--health-warn)]/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-[var(--health-warn)]" />
            </div>
            <span className="text-xs font-semibold text-[var(--health-warn)] uppercase tracking-wider">Needs Attention</span>
          </div>
          <h4 className="font-medium text-[var(--text-bark)] mb-1">Low humidity stress</h4>
          <p className="text-sm text-[var(--text-stone)] mb-3">Monty's leaf edges are curling. Confidence: 87%</p>
          <div className="space-y-2">
            {suggestions.treatments.map((step, i) => (
              <label key={i} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/50 cursor-pointer">
                <div className="w-4 h-4 rounded border-2 border-[var(--moss)]" />
                <span className="text-sm text-[var(--text-stone)]">{step.step}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Market Card */}
        <div className="flex-shrink-0 w-80 snap-center rounded-3xl p-5 bg-white/80 border border-[var(--border)] backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[var(--gold)]/10 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-[var(--gold)]" />
            </div>
            <span className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider">For Monty</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white/60 border border-[var(--border)]">
              <div className="w-12 h-12 rounded-lg bg-[var(--bg-warm)]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-bark)]">Ceramic Humidity Tray</p>
                <p className="text-xs text-[var(--moss)] font-mono">🌱 2,400 or ₹299</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white/60 border border-[var(--border)]">
              <div className="w-12 h-12 rounded-lg bg-[var(--bg-warm)]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-bark)]">Neem Oil Spray</p>
                <p className="text-xs text-[var(--moss)] font-mono">🌱 1,800 or ₹199</p>
              </div>
            </div>
          </div>
          <button className="w-full mt-3 py-2 rounded-xl bg-[var(--moss)]/10 text-[var(--moss)] text-sm font-medium hover:bg-[var(--moss)]/20 transition-colors">
            View Full Drop →
          </button>
        </div>
        
        {/* Climate Card */}
        <div className="flex-shrink-0 w-80 snap-center rounded-3xl p-5 bg-white/80 border border-[var(--border)] backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[var(--moss)]/10 flex items-center justify-center">
              <CloudSun className="w-4 h-4 text-[var(--moss)]" />
            </div>
            <span className="text-xs font-semibold text-[var(--moss)] uppercase tracking-wider">Delhi Today</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-3xl font-mono font-bold text-[var(--text-bark)]">{suggestions.climate.temp}°</span>
            <span className="text-sm text-[var(--text-muted)]">C • {suggestions.climate.humidity}% humidity</span>
          </div>
          <p className="text-sm text-[var(--text-stone)] mb-3">{suggestions.climate.tip}</p>
          <div className="flex gap-2">
            {['Thu', 'Fri', 'Sat'].map((day, i) => (
              <div key={day} className="flex-1 text-center p-2 rounded-lg bg-white/60">
                <p className="text-[10px] text-[var(--text-muted)] uppercase">{day}</p>
                <Droplets className={`w-4 h-4 mx-auto my-1 ${i === 1 ? 'text-[var(--terracotta)]' : 'text-[var(--text-muted)]'}`} />
                <p className="text-[10px] text-[var(--text-stone)]">{i === 1 ? 'Water' : 'Skip'}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Fact Card */}
        <div className="flex-shrink-0 w-80 snap-center rounded-3xl p-5 bg-gradient-to-br from-[var(--gold)]/5 to-[var(--moss)]/5 border border-[var(--border)] backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[var(--gold)]/10 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-[var(--gold)]" />
            </div>
            <span className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider">Did You Know?</span>
          </div>
          <p className="text-sm text-[var(--text-stone)] leading-relaxed">
            {suggestions.fact.text}
          </p>
          <button className="mt-3 text-xs text-[var(--moss)] font-medium hover:underline">Learn more →</button>
        </div>
        
      </div>
    </section>
  );
};