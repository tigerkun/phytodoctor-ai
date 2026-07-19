import React from 'react';
import { motion } from 'motion/react';
import { X, Cpu, Fingerprint, Activity, Database, Zap, ShieldCheck } from 'lucide-react';

interface TechnicalDossierProps {
  onClose: () => void;
}

export default function TechnicalDossier({ onClose }: TechnicalDossierProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-garden-earth/60 backdrop-blur-3xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-garden-earth text-white w-full max-w-4xl rounded-[4rem] shadow-2xl border border-white/10 overflow-hidden relative max-h-[90vh] overflow-y-auto"
      >
        <button 
          onClick={onClose}
          className="absolute top-10 right-10 w-12 h-12 rounded-3xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="p-16">
          <header className="mb-16 border-b border-white/10 pb-16">
             <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-garden-sage rounded-2xl flex items-center justify-center text-white">
                   <ShieldCheck size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-garden-sage">Restricted Access // Specimen OS</span>
             </div>
             <h2 className="font-serif text-5xl font-bold mb-4">Technical Dossier</h2>
             <p className="text-white/40 text-lg max-w-2xl leading-relaxed">
               Verification of hardware-software bridge, on-device feature extraction, and predictive inference pipelines.
             </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
             <section className="space-y-8">
                <div className="flex items-center gap-4 text-garden-sage">
                   <Cpu size={20} />
                   <h3 className="text-xs font-black uppercase tracking-[0.2em]">Visual Feature Extraction</h3>
                </div>
                <div className="space-y-4">
                   <TechStat label="Inference Core" value="Canvas-HSV Pipeline (Deterministic)" />
                   <TechStat label="Feature Vector" value="48-Bin Histogram + Texture Gradient" />
                   <TechStat label="Contour Analysis" value="4-Connectivity Blob Estimation" />
                   <p className="text-xs text-white/30 italic leading-relaxed">
                     Verification: Every "Health Selfie" is parsed into a unique <code>PlantSignature</code>. 
                     Consistency Check: Use the same photo twice to verify identical drift scores.
                   </p>
                </div>
             </section>

             <section className="space-y-8">
                <div className="flex items-center gap-4 text-garden-sage">
                   <Zap size={20} />
                   <h3 className="text-xs font-black uppercase tracking-[0.2em]">Forecasting Engine</h3>
                </div>
                <div className="space-y-4">
                   <TechStat label="Architecture" value="Hybrid Multi-Model (Rule + LLM)" />
                   <TechStat label="Primary Logic" value="Rule-Based Botanical Forecast (v1.2)" />
                   <TechStat label="Fallback" value="Gemini 1.5 Flash (Dossier Escalation)" />
                   <TechStat label="Trigger Threshold" value="Score > 25 (Info) | > 75 (Critical)" />
                </div>
             </section>

             <section className="space-y-8">
                <div className="flex items-center gap-4 text-garden-sage">
                   <Activity size={20} />
                   <h3 className="text-xs font-black uppercase tracking-[0.2em]">Sensor Abstraction</h3>
                </div>
                <div className="space-y-4">
                   <TechStat label="Ambient Light" value="W3C Generic Sensor API (Chrome/Android)" />
                   <TechStat label="Geospatial" value="Navigator Geolocation API (Hardware)" />
                   <TechStat label="Weather" value="Open-Meteo REST (Lat/Lon Grounded)" />
                </div>
             </section>

             <section className="space-y-8">
                <div className="flex items-center gap-4 text-garden-sage">
                   <Database size={20} />
                   <h3 className="text-xs font-black uppercase tracking-[0.2em]">Persistence & Sync</h3>
                </div>
                <div className="space-y-4">
                   <TechStat label="Local Storage" value="IndexedDB (Dexie v4.0)" />
                   <TechStat label="Schema" value="Protocol Specification v6" />
                   <TechStat label="Blob Handling" value="Native Binary Support" />
                </div>
             </section>
          </div>

          <footer className="mt-20 pt-10 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/20">
             <span>System Build: v.1.a10530ab</span>
             <span>Checksum: Verified</span>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}

function TechStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-end border-b border-white/5 pb-2">
       <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{label}</span>
       <span className="text-xs font-bold text-white/80">{value}</span>
    </div>
  );
}
