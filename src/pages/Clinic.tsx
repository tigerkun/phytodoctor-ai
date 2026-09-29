import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Camera, 
  Info, 
  Leaf, 
  MessageCircle, 
  Sprout, 
  X, 
  AlertTriangle, 
  ShieldCheck, 
  Microscope, 
  Database, 
  Check, 
  ExternalLink, 
  RefreshCw 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { identifyPlant, type PlantCare, type DiagnosticPossibility } from '../services/geminiService';
import { NotificationContainer, type RewardToast } from '../components/game/RewardNotification';
import { COMMON_REWARDS } from '../game/rewardUtils';
import PageWrapper from '../components/home/PageWrapper';
import { useToast } from '../components/Toast';
import { GameService } from '../services/gameService';
import { CaseStudy } from '../components/CaseStudy';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Antique Brass Balance Scale Gauge
 * Stylizes diagnostic certainty as an authentic mechanical balance scale.
 */
function AntiqueBrassScale({ confidencePct }: { confidencePct: number }) {
  const pct = clamp(confidencePct, 10, 100);
  // Pointer angle: 50% is center (0 deg), 10% is -24 deg, 100% is +24 deg
  const needleAngle = ((pct - 50) / 50) * 24;
  // Beam tilt: physical equilibrium balancing towards certainty
  const beamTilt = clamp(((pct - 50) / 50) * 5, -5, 5);

  return (
    <div 
      className="brass-scale-gauge rounded-2xl p-3 flex flex-col items-center justify-between shadow-md min-w-[210px] w-full sm:w-auto"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Diagnostic Certainty Balance Scale: ${pct}%`}
    >
      <div className="flex items-center justify-between w-full text-[9px] font-black uppercase tracking-wider text-[#785a1a] dark:text-[#caa651] px-1">
        <span>Certainty Scale</span>
        <span className="font-mono text-[11px] font-bold text-[#2d2214] dark:text-[#f4edd9]">{pct}%</span>
      </div>

      {/* Antique Brass Balance SVG */}
      <div className="relative w-full h-[58px] my-1 flex items-center justify-center">
        <svg viewBox="0 0 160 56" className="w-full h-full" aria-hidden="true">
          {/* Calibrated dial arc positioned above fulcrum */}
          <path
            d="M 38 18 Q 80 8 122 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[#b89542]/50"
          />
          {/* Calibration ticks aligned with needle sweep */}
          <line x1="42" y1="16" x2="45" y2="20" stroke="currentColor" strokeWidth="1" className="text-[#b89542]/70" />
          <line x1="60" y1="13" x2="62" y2="17" stroke="currentColor" strokeWidth="1" className="text-[#b89542]/60" />
          <line x1="80" y1="8" x2="80" y2="13" stroke="currentColor" strokeWidth="1.5" className="text-[#b89542]" />
          <line x1="100" y1="13" x2="98" y2="17" stroke="currentColor" strokeWidth="1" className="text-[#b89542]/60" />
          <line x1="118" y1="16" x2="115" y2="20" stroke="currentColor" strokeWidth="1" className="text-[#b89542]/70" />

          {/* Central Pillar / Stand */}
          <rect x="78" y="24" width="4" height="24" rx="1" fill="url(#brassBeamGrad)" />
          <ellipse cx="80" cy="48" rx="16" ry="3.5" fill="url(#brassBeamGrad)" stroke="#634b0f" strokeWidth="0.8" />
          
          {/* Tilting Crossbeam & Suspended Pans */}
          <g transform={`rotate(${beamTilt} 80 24)`} style={{ transition: 'transform 0.8s ease-out' }}>
            <line x1="26" y1="24" x2="134" y2="24" stroke="url(#brassBeamGrad)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="30" cy="24" r="1.5" fill="#634b0f" />
            <circle cx="130" cy="24" r="1.5" fill="#634b0f" />

            {/* Left suspension strings & pan */}
            <line x1="30" y1="24" x2="21" y2="39" stroke="#8a6c33" strokeWidth="0.8" />
            <line x1="30" y1="24" x2="39" y2="39" stroke="#8a6c33" strokeWidth="0.8" />
            <path d="M 19 39 Q 30 45 41 39 Z" fill="url(#brassPanGrad)" stroke="#634b0f" strokeWidth="0.8" />

            {/* Right suspension strings & pan */}
            <line x1="130" y1="24" x2="121" y2="39" stroke="#8a6c33" strokeWidth="0.8" />
            <line x1="130" y1="24" x2="139" y2="39" stroke="#8a6c33" strokeWidth="0.8" />
            <path d="M 119 39 Q 130 45 141 39 Z" fill="url(#brassPanGrad)" stroke="#634b0f" strokeWidth="0.8" />
          </g>

          {/* Central Pivot Hub */}
          <circle cx="80" cy="24" r="3.5" fill="#634b0f" stroke="#caa651" strokeWidth="1" />

          {/* Pointer needle pivoting from fulcrum upwards to calibrated arc */}
          <g transform={`rotate(${needleAngle} 80 24)`} style={{ transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <line x1="80" y1="24" x2="80" y2="9" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="80" cy="8.5" r="1.5" fill="#ef4444" />
          </g>

          {/* Pure SVG gradients */}
          <defs>
            <linearGradient id="brassBeamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f7e1a0" />
              <stop offset="50%" stopColor="#b89542" />
              <stop offset="100%" stopColor="#634b0f" />
            </linearGradient>
            <linearGradient id="brassPanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#eed794" />
              <stop offset="100%" stopColor="#9a7726" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <span className="text-[8px] font-black uppercase tracking-wider text-[#5f7161] dark:text-[#9caf88]">
        {pct >= 85 ? 'Empirical Equilibrium' : pct >= 65 ? 'Probable Alignment' : 'Inconclusive Balance'}
      </span>
    </div>
  );
}

export default function Clinic() {
  const { info, success, error: toastError } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [identification, setIdentification] = useState<PlantCare | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'timeline' | 'differential'>('diagnosis');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPlantId, setSavedPlantId] = useState<string | null>(null);
  const [showBotanistChat, setShowBotanistChat] = useState(false);
  const [showCaseStudyDrawer, setShowCaseStudyDrawer] = useState(false);
  const [notifications, setNotifications] = useState<RewardToast[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const LOADING_PHRASES = useMemo(
    () => [
      'Consulting dispensary herbals...',
      'Calibrating brass certainty scales...',
      'Reading moisture & cellular signatures...',
      'Compounding restorative botanical regimen...',
    ],
    []
  );

  useEffect(() => {
    let interval: number | undefined;
    if (loading) {
      interval = window.setInterval(() => {
        setLoadingPhase((prev) => (prev + 1) % LOADING_PHRASES.length);
      }, 2000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [loading, LOADING_PHRASES.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDisclaimer(false);
        setShowCaseStudyDrawer(false);
        setShowBotanistChat(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-uploading the same file works
    e.target.value = '';

    const reader = new FileReader();
    reader.onerror = () => {
      setError('Unable to read selected leaf specimen file. Please select another.');
    };
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImages((prev) => [...prev, base64].slice(-3));
      setIdentification(null);
      setSavedPlantId(null);
      identify(base64);
    };
    reader.readAsDataURL(file);
  };

  const identify = async (base64Image: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await identifyPlant(base64Image);
      setIdentification(result);
      
      // Award diagnosis reward
      try {
        const rewardResult = await COMMON_REWARDS.diagnose('clinic-session');
        const rewardId = crypto.randomUUID();
        setNotifications(prev => [...prev, {
          id: rewardId,
          xp: rewardResult.xpAwarded,
          seeds: rewardResult.seedsAwarded,
          actionName: 'Dispensary Triage Complete',
          capExceeded: rewardResult.capExceeded
        }]);
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== rewardId));
        }, 4000);
      } catch (rewardErr) {
        console.error('Reward error:', rewardErr);
      }
    } catch (err: any) {
      setError(err?.message || 'Please try again with a clearer leaf photo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!identification || savedPlantId || saving) return;
    setSaving(true);
    try {
      const photoUrl = images[0] || '';
      const species = identification.speciesName || identification.scientificName || identification.commonName || 'Unknown Specimen';
      const saved = await GameService.indexScannedPlant({
        photoUrl,
        species,
        commonName: identification.commonName || species,
        healthStatus: identification.healthStatus,
        severity: identification.severity,
        diagnosis: identification.diagnosis,
        watering: identification.watering,
        light: identification.light,
        temperature: identification.temperature,
      });
      setSavedPlantId(saved.id);
      success(`Specimen admitted to Herbarium records: ${saved.name}`);
    } catch (err: any) {
      console.error('Dexie persistence error:', err);
      toastError('Could not record specimen in dispensary ledger. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setImages([]);
    setIdentification(null);
    setError(null);
    setSavedPlantId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowBotanistChat(false);
    setActiveTab('diagnosis');
  };

  const ConfidencePct = useMemo(() => {
    if (!identification) return 0;
    const anyId = identification as any;
    if (typeof anyId.confidence === 'number') return clamp(anyId.confidence, 0, 100);
    const topDiff = identification.differentialDiagnosis?.[0];
    if (topDiff && typeof topDiff.confidence === 'number') {
      return clamp(topDiff.confidence, 0, 100);
    }
    return 88;
  }, [identification]);

  const severityLevel = useMemo(() => {
    if (!identification) return 1;
    const s = (identification as any).severity;
    if (typeof s === 'number') return s;
    const hs = ((identification as any).healthStatus || '').toLowerCase();
    if (hs.includes('infest') || hs.includes('diseas')) return 4;
    if (hs.includes('stress')) return 3;
    return 1;
  }, [identification]);

  const isQuarantineRequired = severityLevel >= 3;

  const HealthPill = () => {
    const healthStatus = (identification as any)?.healthStatus as string | undefined;
    const label = healthStatus || 'Vigorous';
    const isHealthy = label.toLowerCase().includes('healthy');
    const isSevere = label.toLowerCase().includes('infest') || label.toLowerCase().includes('diseas');
    
    const tone = isSevere 
      ? 'bg-[#dc2626] text-white' 
      : isHealthy 
        ? 'bg-[#5f7161] text-white' 
        : 'bg-[#e07a5f] text-white';

    return (
      <span className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs ${tone}`}>
        {label}
      </span>
    );
  };

  const TabButton = ({
    id,
    label,
  }: {
    id: 'diagnosis' | 'timeline' | 'differential';
    label: string;
  }) => {
    const active = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        className={
          'flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all min-h-[44px] ' +
          (active
            ? 'bg-white dark:bg-[#2b2118] text-[var(--text-bark)] shadow-sm border border-[#b89542]/35'
            : 'text-[var(--text-stone)]/70 hover:text-[var(--text-bark)]')
        }
      >
        {label}
      </button>
    );
  };

  const differentialItems = (identification as any)?.differentialDiagnosis as DiagnosticPossibility[] | undefined;

  return (
    <PageWrapper className="skin-clinic">
      <NotificationContainer 
        notifications={notifications} 
        onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} 
      />

      <div className="min-h-screen text-[var(--text-bark)] relative z-[10] px-3 sm:px-6 py-6 max-w-7xl mx-auto">
        {/* Dispensary Masthead */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-light)] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-mono text-[var(--text-stone)]">
              <Link to="/" className="hover:text-[var(--text-bark)] transition-colors">Command Center</Link>
              <span>/</span>
              <Link to="/lab" className="hover:text-[var(--text-bark)] transition-colors">Botanical Lab</Link>
              <span>/</span>
              <span className="text-[#5f7161] dark:text-[#9caf88] font-bold">Dispensary</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#5f7161]/15 text-[#5f7161] dark:text-[#9caf88] border border-[#5f7161]/25 text-[9px] font-black uppercase tracking-widest font-mono">
                <Leaf size={11} /> Botanical Sanatorium & Herbal Dispensary
              </span>
              <span className="text-[10px] font-mono uppercase text-[var(--text-stone)]">
                Form Rx-Triage
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[var(--text-bark)] mt-1 tracking-tight">
              Clinical Plant Dispensary
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Historical Case Drawer Link */}
            <button
              type="button"
              onClick={() => setShowCaseStudyDrawer(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-[#785a1a] dark:text-[#caa651] text-[10px] font-black uppercase tracking-wider border border-[#b89542]/30 transition-all min-h-[44px]"
            >
              <Microscope size={14} className="text-[#b89542]" />
              <span>Case Drawer #001</span>
            </button>

            <Link
              to="/clinic/case-study"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-glass)] hover:bg-white text-[var(--text-stone)] hover:text-[var(--text-bark)] text-[10px] font-black uppercase tracking-wider border border-[var(--border-light)] transition-all min-h-[44px]"
              title="Open full-page case study archive"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Archive</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowDisclaimer(true)}
              className="p-2.5 rounded-xl border border-[var(--border-light)] bg-[var(--bg-glass)] hover:bg-white text-[var(--text-stone)] hover:text-[var(--text-bark)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Clinical Notice"
              title="Dispensary Protocol Notice"
            >
              <Info size={16} />
            </button>
          </div>
        </header>

        {/* Clinical Notice Modal */}
        <AnimatePresence>
          {showDisclaimer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] bg-[var(--text-bark)]/60 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.98, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-[480px] bg-[var(--bg-glass)] rounded-3xl border border-[var(--border-light)] shadow-2xl p-6 relative"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-3 mb-4">
                  <div className="flex items-center gap-2 text-[#785a1a] dark:text-[#caa651]">
                    <ShieldCheck size={20} />
                    <h3 className="font-serif text-xl font-bold">Dispensary Care Notice</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDisclaimer(false)}
                    className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-[var(--text-stone)] leading-relaxed font-sans">
                  The Botanical Sanatorium provides physiological triage, hydration balances, and dispensary regimens. Guidance complements professional arboricultural practice. Always isolate quarantined specimens promptly.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDisclaimer(false)}
                  className="mt-6 w-full py-3 bg-[var(--text-bark)] hover:bg-[var(--moss)] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px]"
                >
                  Acknowledge & Enter Dispensary
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="pb-20">
          {/* INTAKE / UPLOAD STATE: Mounted on the Masonite Triage Clipboard */}
          {images.length === 0 && (
            <div className="w-full max-w-5xl mx-auto my-4">
              {/* Tactile Riveted Steel Binder Clip */}
              <div className="tactile-clipboard-clip" aria-hidden="true">
                <div className="w-16 h-1.5 bg-slate-300/50 rounded-full mx-auto" />
              </div>

              {/* Masonite Clipboard backing */}
              <section 
                className="masonite-clipboard rounded-3xl p-4 sm:p-8 pt-9 transition-all"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = reader.result as string;
                      setImages([base64]);
                      setIdentification(null);
                      setSavedPlantId(null);
                      identify(base64);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              >
                <div className="bg-[#fdfbf7] dark:bg-[#1f1b16] rounded-2xl border border-[#b89542]/30 shadow-inner p-6 sm:p-10">
                  <div className="max-w-2xl mx-auto text-center flex flex-col items-center">
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#5f7161]/10 border border-[#5f7161]/25 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-[#5f7161] dark:text-[#9caf88] font-mono">
                      Form RX-INTAKE • Living Specimen Registry
                    </span>

                    <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[var(--text-bark)] mt-4">
                      Botanical Clinical Triage
                    </h2>

                    <p className="mt-3 text-sm text-[var(--text-stone)] leading-relaxed font-sans max-w-xl">
                      Mount your leaf specimen upon the triage clipboard. Computer vision telemetry examines pigment variations, stomatal turgor, and cellular stress markers to prescribe targeted herbal regimens.
                    </p>

                    <div className="mt-8 w-full max-w-md">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 px-6 bg-[var(--text-bark)] hover:bg-[#5f7161] text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5f7161]"
                      >
                        <Camera size={16} />
                        Mount & Diagnose Specimen
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[var(--text-stone)] font-mono">
                        <Sprout size={13} className="text-[#5f7161]" />
                        <span>Awarded: +150 Botanical Growth Points</span>
                      </div>
                    </div>

                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full border-t border-[#b89542]/20 pt-6 text-left">
                      <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-light)]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#785a1a] dark:text-[#caa651] block font-mono">
                          I. Chlorosis Scan
                        </span>
                        <p className="text-xs text-[var(--text-stone)] mt-1">Leaf tone & photosynthetic vigor</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-light)]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#785a1a] dark:text-[#caa651] block font-mono">
                          II. Turgor Pressure
                        </span>
                        <p className="text-xs text-[var(--text-stone)] mt-1">Cellular hydration & transpiration</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-light)]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#785a1a] dark:text-[#caa651] block font-mono">
                          III. Hazard Triage
                        </span>
                        <p className="text-xs text-[var(--text-stone)] mt-1">Automatic quarantine routing</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          )}

          {/* DIAGNOSIS STATE */}
          <AnimatePresence mode="wait">
            {images.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="w-full"
              >
                {/* Masonite Clipboard Mount for Diagnosis */}
                <div className="tactile-clipboard-clip" aria-hidden="true">
                  <div className="w-16 h-1.5 bg-slate-300/50 rounded-full mx-auto" />
                </div>

                <div className="masonite-clipboard rounded-3xl p-3 sm:p-6 pt-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                    {/* LEFT COLUMN: Specimen Mount on Clipboard */}
                    <div className="lg:col-span-5 flex flex-col space-y-4">
                      <div className={`relative rounded-2xl overflow-hidden shadow-xl border-2 transition-all ${
                        identification && isQuarantineRequired 
                          ? 'border-red-600/80 shadow-red-950/30 ring-2 ring-red-500/20' 
                          : 'border-[#b89542]/40'
                      } bg-white dark:bg-zinc-900`}>
                        <img 
                          src={images[images.length - 1]} 
                          alt="Patient leaf specimen" 
                          className="w-full aspect-4/3 object-cover" 
                        />

                        {/* Top Telemetry badge */}
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/75 text-white backdrop-blur-xs font-mono">
                          Specimen Lens • In Focus
                        </div>

                        {/* Reset button */}
                        <button
                          type="button"
                          onClick={reset}
                          className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl transition-all shadow-sm active:scale-95 min-h-[40px] min-w-[40px] flex items-center justify-center z-10"
                          title="Clear specimen & reset"
                          aria-label="Clear specimen"
                        >
                          <X size={16} />
                        </button>

                        {/* Diagonal Hazard Quarantine Ribbon overlaid on specimen card */}
                        {identification && isQuarantineRequired && (
                          <div 
                            className="quarantine-ribbon absolute bottom-4 -left-6 -right-6 py-2 px-6 shadow-2xl flex items-center justify-center gap-2 z-20 pointer-events-none"
                            role="alert"
                          >
                            <AlertTriangle size={14} className="text-white shrink-0 animate-pulse" />
                            <span className="text-[10px] sm:text-xs font-mono font-black tracking-widest text-white drop-shadow-md">
                              BIO-HAZARD QUARANTINE • SEVERITY {severityLevel}
                            </span>
                          </div>
                        )}

                        {/* Loading overlay */}
                        {loading && (
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-6 text-center text-white">
                            <motion.div 
                              animate={{ rotate: 360 }} 
                              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                              className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent mb-3"
                            />
                            <p className="font-serif text-base font-medium text-amber-100">
                              {LOADING_PHRASES[loadingPhase]}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Quarantine Directive Alert Box */}
                      {identification && isQuarantineRequired && (
                        <div 
                          className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs font-sans space-y-1"
                          role="alert"
                        >
                          <div className="flex items-center gap-2 font-mono font-bold text-red-400 uppercase text-[11px]">
                            <AlertTriangle size={14} className="text-red-400 shrink-0" />
                            <span>Isolation Protocol Active (Severity {severityLevel}/5)</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-red-300/90 font-mono">
                            Mandatory bio-containment: isolate specimen from adjacent plants, sterilize dispensary implements, and withhold foliar spraying.
                          </p>
                        </div>
                      )}

                      {/* Healthy Clearance Badge when severity < 3 */}
                      {identification && !isQuarantineRequired && (
                        <div className="p-2.5 rounded-xl bg-[#5f7161]/15 border border-[#5f7161]/30 flex items-center justify-center gap-2 text-[#5f7161] dark:text-[#9caf88]">
                          <ShieldCheck size={16} />
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                            Clearance Granted • No Bio-Quarantine Required
                          </span>
                        </div>
                      )}

                      {/* Angle thumbnails */}
                      <div className="flex gap-2 items-center overflow-x-auto pb-1">
                        {images.map((img, i) => (
                          <div
                            key={i}
                            className="w-14 h-14 rounded-xl border-2 border-[#b89542]/40 overflow-hidden shadow-xs bg-white shrink-0"
                          >
                            <img src={img} alt={`Specimen angle ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}

                        {images.length < 3 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-14 h-14 rounded-xl border border-dashed border-[#b89542]/50 hover:bg-white/20 transition-all flex flex-col items-center justify-center text-[var(--text-stone)] hover:text-[#5f7161] gap-1 shrink-0 min-h-[44px] min-w-[44px]"
                            title="Add additional leaf angle"
                          >
                            <Camera size={14} />
                            <span className="text-[8px] font-mono font-bold uppercase">+Angle</span>
                          </button>
                        )}
                      </div>

                      {/* Actions on specimen card: Admit to Vault / Persist to Dexie */}
                      {identification && (
                        <div className="pt-2 border-t border-[#b89542]/20 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={handleSaveToVault}
                            disabled={saving || !!savedPlantId}
                            className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                              savedPlantId 
                                ? 'bg-[#5f7161] text-white cursor-default' 
                                : 'bg-[var(--text-bark)] hover:bg-[#5f7161] text-white shadow-md active:scale-[0.98]'
                            }`}
                          >
                            {saving ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Admitting Specimen to Dexie...</span>
                              </>
                            ) : savedPlantId ? (
                              <>
                                <Check size={14} />
                                <span>Admitted to Herbarium Register</span>
                              </>
                            ) : (
                              <>
                                <Database size={14} />
                                <span>Save Specimen to Vault Register</span>
                              </>
                            )}
                          </button>

                          {savedPlantId && (
                            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-stone)] px-1">
                              <span>Accession ID: #{savedPlantId.slice(0, 8)}</span>
                              <Link to={`/plant/${savedPlantId}`} className="text-[#785a1a] dark:text-[#caa651] hover:underline flex items-center gap-1 font-bold">
                                <span>View Specimen</span>
                                <ExternalLink size={12} />
                              </Link>
                            </div>
                          )}
                        </div>
                      )}

                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>

                    {/* RIGHT COLUMN: Clinical Dispensary Chart */}
                    <div className="lg:col-span-7 flex flex-col">
                      <div className="bg-[#fdfbf7] dark:bg-[#1e1a15] rounded-2xl border border-[#b89542]/30 p-5 sm:p-7 shadow-sm">
                        {/* Specimen Header & Brass Balance Scale */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#b89542]/20 pb-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 bg-[#b89542]/10 border border-[#b89542]/25 rounded-full text-[9px] font-black uppercase tracking-wider text-[#785a1a] dark:text-[#caa651] font-mono">
                                Patient Record • Rx-{severityLevel}
                              </span>
                              <HealthPill />
                            </div>

                            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[var(--text-bark)] mt-1.5 tracking-tight">
                              {(identification as any)?.commonName || 'Plant Under Triage'}
                            </h2>
                            <p className="text-xs italic font-serif text-[#5f7161] dark:text-[#9caf88] mt-0.5">
                              {(identification as any)?.scientificName || (identification as any)?.scientific || 'Botanical classification pending...'}
                            </p>
                          </div>

                          {/* Antique Brass Balance Scale */}
                          <div className="shrink-0">
                            <AntiqueBrassScale confidencePct={ConfidencePct} />
                          </div>
                        </div>

                        {/* Triage Tabs */}
                        <div className="mt-5 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--border-light)] p-1">
                          <div className="grid grid-cols-3 gap-1">
                            <TabButton id="diagnosis" label="Prescription" />
                            <TabButton id="timeline" label="Timeline (℞)" />
                            <TabButton id="differential" label="Differential" />
                          </div>
                        </div>

                        {/* TAB PANELS */}
                        <div className="mt-5">
                          {/* TAB 1: Prescription & Diagnostic Summary */}
                          {activeTab === 'diagnosis' && (
                            <div className="space-y-4">
                              {/* Apothecary Rx Slip */}
                              <div className="apothecary-rx-slip rounded-2xl p-5 sm:p-6">
                                <div className="flex items-center justify-between border-b border-[#b89542]/20 pb-2 mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-serif font-bold text-xl text-[#785a1a] dark:text-[#caa651]">℞</span>
                                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#785a1a] dark:text-[#caa651]">
                                      Diagnostic Finding
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-mono text-[var(--text-stone)]">
                                    Dispensed at Triage Desk
                                  </span>
                                </div>

                                <p className="font-serif text-lg sm:text-xl font-semibold italic text-[var(--text-bark)] leading-relaxed">
                                  “{(identification as any)?.diagnosis || 'A gentle botanical wellness story is unfolding.'}”
                                </p>

                                <div className="mt-4 pt-3 border-t border-dashed border-[#b89542]/20 text-xs text-[var(--text-stone)] font-sans leading-relaxed">
                                  <span className="font-bold text-[#785a1a] dark:text-[#caa651] font-mono uppercase text-[10px] block mb-1">
                                    Vulnerability & Environmental Notes:
                                  </span>
                                  {(identification as any)?.vulnerabilityNotes || 'Observe leaf margin transpiration and maintain steady ambient illumination.'}
                                </div>
                              </div>

                              {/* Dispensary Viticultural Measurements */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {[
                                  { label: 'Hydration ʒ', val: (identification as any)?.watering || 'Moist' },
                                  { label: 'Light Lux', val: (identification as any)?.light || 'Indirect' },
                                  { label: 'Substrate', val: (identification as any)?.soil || 'Loamy' },
                                  { label: 'Temp °C', val: (identification as any)?.temperature || '21°C' },
                                ].map((item) => (
                                  <div key={item.label} className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-[#b89542]/20">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-[#785a1a] dark:text-[#caa651] block font-bold">
                                      {item.label}
                                    </span>
                                    <span className="text-xs font-semibold text-[var(--text-bark)] block mt-0.5 truncate">
                                      {item.val}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Dispensary Compounding Instructions Slip */}
                              {(((identification as any)?.treatmentInstructions && (identification as any).treatmentInstructions.length > 0) || 
                                ((identification as any)?.careTips && (identification as any).careTips.length > 0)) && (
                                <div className="apothecary-rx-slip rounded-2xl p-5 sm:p-6 space-y-3">
                                  <div className="flex items-center justify-between border-b border-[#b89542]/20 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-serif font-bold text-lg text-[#785a1a] dark:text-[#caa651]">℞</span>
                                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#785a1a] dark:text-[#caa651]">
                                        Dispensary Compounding Instructions
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-mono text-[var(--text-stone)]">
                                      Signa: Usus Botanicus
                                    </span>
                                  </div>

                                  <ul className="space-y-2 text-xs text-[var(--text-stone)] font-sans">
                                    {(((identification as any)?.treatmentInstructions && (identification as any).treatmentInstructions.length > 0)
                                      ? (identification as any).treatmentInstructions
                                      : (identification as any).careTips
                                    ).map((instr: string, i: number) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="font-mono text-[10px] font-bold text-[#785a1a] dark:text-[#caa651] mt-0.5 shrink-0">
                                          {i + 1}.
                                        </span>
                                        <span className="leading-relaxed">{instr}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {error && (
                                <div className="p-4 rounded-xl border border-red-300 bg-red-500/10 text-red-600 text-xs font-sans">
                                  {error}
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 2: Treatment Timeline styled as Perforated Tear-off Rx Slips */}
                          {activeTab === 'timeline' && (
                            <div className="space-y-3">
                              {((identification as any)?.treatmentTimeline || []).map((step: any, idx: number) => (
                                <div key={idx} className="apothecary-rx-slip rounded-xl p-4 sm:p-5">
                                  <div className="flex items-center justify-between border-b border-[#b89542]/20 pb-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-serif font-bold text-base text-[#785a1a] dark:text-[#caa651]">℞</span>
                                      <span className="px-2.5 py-0.5 rounded-full bg-[var(--text-bark)] text-white text-[9px] font-mono font-bold uppercase tracking-wider">
                                        Day {step.day} Dispensary Order
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-[#785a1a] dark:text-[#caa651]">
                                      Phase #{idx + 1}
                                    </span>
                                  </div>

                                  <h4 className="font-serif text-base font-bold text-[var(--text-bark)]">
                                    {step.action}
                                  </h4>
                                  <p className="text-xs text-[var(--text-stone)] font-sans mt-1">
                                    <span className="font-semibold text-[#5f7161] dark:text-[#9caf88]">Expected Prognosis:</span> {step.expectedOutcome}
                                  </p>

                                  <div className="mt-3 pt-2 border-t border-dashed border-[#b89542]/20 flex items-center justify-between text-[9px] font-mono text-[#785a1a] dark:text-[#caa651]">
                                    <span>Prescribed Dosage: q.s. ℈ iv</span>
                                    <span>Sanatorium Register</span>
                                  </div>
                                </div>
                              ))}

                              {(!((identification as any)?.treatmentTimeline) || (identification as any).treatmentTimeline.length === 0) && (
                                <div className="p-6 text-center text-xs text-[var(--text-stone)] font-mono">
                                  No timeline required. Specimen displays vital equilibrium.
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 3: Differential Diagnoses styled as Perforated Tear-off Rx Slips */}
                          {activeTab === 'differential' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {(differentialItems || []).map((item, idx) => (
                                <div key={idx} className="apothecary-rx-slip rounded-xl p-4 sm:p-5 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between border-b border-[#b89542]/20 pb-2 mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-serif font-bold text-base text-[#785a1a] dark:text-[#caa651]">℞</span>
                                        <h4 className="font-serif text-sm font-bold text-[var(--text-bark)] truncate">
                                          {item.name}
                                        </h4>
                                      </div>
                                      <span className="px-2 py-0.5 rounded-full bg-[#5f7161]/15 text-[#5f7161] dark:text-[#9caf88] text-[9px] font-mono font-bold uppercase shrink-0">
                                        Match {item.confidence}%
                                      </span>
                                    </div>

                                    <p className="text-xs text-[var(--text-stone)] font-sans leading-relaxed">
                                      {item.description}
                                    </p>
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-dashed border-[#b89542]/20 flex items-center justify-between text-[9px] font-mono text-[#785a1a] dark:text-[#caa651]">
                                    <span>Formula: ʒ ii Sol. Herbaria</span>
                                    <span>Score: {item.confidence}/100</span>
                                  </div>
                                </div>
                              ))}

                              {(!differentialItems || differentialItems.length === 0) && (
                                <div className="col-span-2 p-6 text-center text-xs text-[var(--text-stone)] font-mono">
                                  No differential conflicts noted. Specimen matches primary signature.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* HISTORICAL CASE STUDY DRAWER */}
        <AnimatePresence>
          {showCaseStudyDrawer && (
            <div 
              className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs"
              onClick={() => setShowCaseStudyDrawer(false)}
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="w-full max-w-2xl h-full bg-[#181512] shadow-2xl overflow-y-auto p-4 sm:p-6 border-l border-amber-900/40"
                onClick={(e) => e.stopPropagation()}
              >
                <CaseStudy isDrawer={true} onClose={() => setShowCaseStudyDrawer(false)} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Botanist consultation assistant */}
        <div className="fixed bottom-6 right-4 z-[50]">
          <button
            type="button"
            aria-label="Ask the Botanist"
            onClick={() => setShowBotanistChat((v) => !v)}
            className="w-13 h-13 rounded-full flex items-center justify-center bg-[#5f7161] hover:bg-[#4d5c4e] text-white shadow-xl transition-all active:scale-95"
            title="Ask the Sanatorium Botanist"
          >
            <MessageCircle size={20} />
          </button>
        </div>

        <AnimatePresence>
          {showBotanistChat && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="fixed bottom-22 right-4 z-[55] w-[320px] max-w-[92vw] rounded-2xl border border-[#b89542]/30 shadow-2xl bg-[#fdfbf7] dark:bg-[#1e1a15] p-4 text-[var(--text-bark)]"
            >
              <div className="flex items-start justify-between gap-3 mb-3 border-b border-[var(--border-light)] pb-2">
                <div>
                  <h3 className="font-serif text-lg font-bold">Dispensary Botanist</h3>
                  <p className="text-[11px] text-[var(--text-stone)] font-sans">
                    Herbal remedies & immediate care guidance
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBotanistChat(false)}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-2">
                {[
                  'What is the optimal watering frequency for this species?',
                  'How to treat early leaf chlorosis naturally?',
                  'What light exposure produces best vigor?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => info(`Botanist: "${prompt}" — Recommended dispensary action: adjust moisture and place in bright filtered light.`)}
                    className="w-full text-left px-3 py-2 rounded-xl border border-[var(--border-light)] bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors text-xs font-sans"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
