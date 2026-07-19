import { motion } from 'framer-motion';
import { Leaf, Sun, User } from 'lucide-react';

export default function Navigation() {
  return (
    <nav className="sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between backdrop-blur-xl border-b border-[var(--border)] bg-[var(--bg-cream)]/80">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <motion.div animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
          <Leaf className="w-6 h-6 text-[var(--moss)]" />
        </motion.div>
        <span className="font-serif text-lg text-[var(--text-bark)] tracking-tight">BotanicalGuardian</span>
      </div>
      
      {/* Center Pills */}
      <div className="hidden md:flex items-center gap-1 bg-white/60 rounded-full p-1 border border-[var(--border)]">
        {['Home', 'My Garden', 'Diagnose', 'Market', 'Lab'].map((item) => (
          <button key={item} className="px-4 py-1.5 rounded-full text-sm font-medium transition-all hover:bg-[var(--moss)]/10 text-[var(--text-stone)] hover:text-[var(--text-bark)] data-[active=true]:bg-[var(--moss)]/15 data-[active=true]:text-[var(--moss)]">
            {item}
          </button>
        ))}
      </div>
      
      {/* Right: Weather + Seeds + Profile */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-stone)]">
          <Sun className="w-3.5 h-3.5 text-[var(--gold)]" />
          <span>34°C Delhi</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--moss)]/10 border border-[var(--moss)]/20">
          <Leaf className="w-3.5 h-3.5 text-[var(--moss)]" />
          <span className="text-sm font-mono font-semibold text-[var(--text-bark)]">4,250</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-[var(--terracotta)]/20 border border-[var(--terracotta)]/30 flex items-center justify-center">
          <User className="w-4 h-4 text-[var(--terracotta)]" />
        </div>
      </div>
    </nav>
  );
}