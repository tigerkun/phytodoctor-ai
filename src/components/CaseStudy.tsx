import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, History, CornerRightDown, AlertTriangle, CheckCircle2, Microscope, X } from 'lucide-react';

export interface CaseStudyProps {
  onClose?: () => void;
  isDrawer?: boolean;
}

export const CaseStudy: React.FC<CaseStudyProps> = ({ onClose, isDrawer = false }) => {
  const navigate = useNavigate();
  const study = {
    id: 'alocasia-mite-prevention',
    plant: 'Alocasia amazonica',
    threat: 'Spider Mites (Tetranychus urticae)',
    summary: 'Detected pre-symptomatic stress signatures 5 days before visible webbing or leaf damage appeared.',
    timeline: [
      { 
        day: 0, 
        drift: 0.18, 
        status: 'watching', 
        observation: 'Initial baseline established. Subtle texture shift detected via gradient magnitude analysis.',
        action: 'System transition to "Monitoring Enabled"' 
      },
      { 
        day: 3, 
        drift: 0.31, 
        status: 'alert', 
        observation: 'Visual drift crosses 2.5σ threshold. Rule engine identifies low humidity/high temp correlation.',
        action: 'Preventive Alert: Neem oil recommended' 
      },
      { 
        day: 12, 
        drift: 0.08, 
        status: 'stable', 
        observation: 'Specimen signature returned to baseline variance. No visible lesions or colony formation.',
        action: 'Threat mitigated successfully' 
      }
    ],
    outcome: 'prevented',
    methodology: 'The deterministic drift detector identified a decrease in "Texture Energy" (structural surface integrity) while the leaf remained green. This allowed for mitigation before the onset of chlorosis.'
  };

  return (
    <div className={`mx-auto space-y-8 text-emerald-50 font-sans ${isDrawer ? 'bg-[#181512] text-amber-50 rounded-2xl p-2 sm:p-4' : 'max-w-4xl bg-black min-h-screen p-6 md:p-8'}`}>
      <header className="space-y-3 border-b border-emerald-900/60 pb-6 relative">
        {!isDrawer && (
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400/80 mb-3">
            <button
              type="button"
              onClick={() => navigate('/clinic')}
              className="hover:text-emerald-300 transition-colors"
            >
              ← Dispensary Triage
            </button>
            <span>/</span>
            <span className="text-white/60">Historical Archive</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Microscope className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-widest">Sanatorium Case Study #001</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close Case Study Drawer"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-white">Phenotype Drift Mitigation</h1>
        <p className="text-emerald-300/80 max-w-2xl text-sm leading-relaxed">{study.summary}</p>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-zinc-900/50 p-6 border border-zinc-800 rounded-xl">
          <div className="text-zinc-500 text-xs uppercase mb-1">Subject</div>
          <div className="font-medium text-lg">{study.plant}</div>
        </div>
        <div className="bg-zinc-900/50 p-6 border border-zinc-800 rounded-xl">
          <div className="text-zinc-500 text-xs uppercase mb-1">Identified Stressor</div>
          <div className="font-medium text-lg">{study.threat}</div>
        </div>
        <div className="bg-emerald-950/20 p-6 border border-emerald-500/20 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-emerald-500/60 text-xs uppercase mb-1">Status</div>
            <div className="font-bold text-emerald-400 uppercase tracking-tighter">SUCCESSFULLY PREVENTED</div>
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="text-xl font-medium flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-400" />
          Analysis Timeline
        </h2>
        
        <div className="relative space-y-4 before:absolute before:left-[11px] before:top-4 before:bottom-4 before:w-px before:bg-zinc-800">
          {study.timeline.map((step, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative pl-10"
            >
              <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                step.status === 'alert' ? 'bg-orange-500 border-orange-200' : 
                step.status === 'stable' ? 'bg-emerald-500 border-emerald-200' : 'bg-zinc-800 border-zinc-700'
              }`}>
                {step.status === 'stable' ? <CheckCircle2 className="w-3 h-3 text-white" /> : 
                 step.status === 'alert' ? <AlertTriangle className="w-3 h-3 text-white" /> : 
                 <div className="w-2 h-2 rounded-full bg-zinc-500" />}
              </div>
              
              <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-zinc-500 text-sm font-mono">DAY {step.day}</div>
                  <div className={`text-xs px-2 py-0.5 rounded uppercase font-mono ${
                    step.status === 'alert' ? 'bg-orange-500/10 text-orange-400' : 
                    step.status === 'stable' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    Drift: {step.drift.toFixed(2)}
                  </div>
                </div>
                <p className="text-white/90 mb-2 leading-relaxed">{step.observation}</p>
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <CornerRightDown className="w-4 h-4 shrink-0" />
                  {step.action}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-emerald-950/20 p-8 rounded-2xl border border-emerald-500/10">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          < Microscope className="w-5 h-5 text-emerald-400" />
          Technical Methodology
        </h3>
        <p className="text-emerald-50/70 leading-relaxed max-w-3xl">
          {study.methodology}
        </p>
      </section>

      <footer className="pt-8 flex flex-wrap items-center justify-center gap-4">
        {onClose ? (
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 transition-colors text-xs font-mono uppercase tracking-widest min-h-[44px]"
          >
            Close Case Study Drawer
          </button>
        ) : (
          <>
            <button 
              type="button"
              onClick={() => navigate('/clinic')}
              className="px-5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors text-xs font-mono uppercase tracking-widest min-h-[44px]"
            >
              ← Return to Clinical Triage
            </button>
            <button 
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors text-xs font-mono uppercase tracking-widest min-h-[44px]"
            >
              Command Center
            </button>
          </>
        )}
      </footer>
    </div>
  );
};
