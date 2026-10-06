import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Leaf, Shield, Swords, Bell, Camera, Upload, ArrowRight, CheckCircle2, AlertTriangle, Sparkles, Lock, ShieldCheck, HeartHandshake, RefreshCw } from 'lucide-react';
import { prepareScanImage } from '../../utils/imagePipeline';
import { identifyPlant, type IdentifyResult } from '../../services/geminiService';
import { rememberAuthReturn, stashPendingScan } from '../../lib/guestHandoff';
import { useEcoMode } from '../../hooks/useEcoMode';
import NonPlantReport from '../scan/NonPlantReport';

export const FEATURES = [
  {
    icon: Leaf,
    title: 'AI Plant Doctor',
    desc: 'Snap a photo and get a diagnosis in about half a minute, powered by Gemini AI — species ID, disease detection, and tailored care plans.',
    color: '#3D5A3D',
    to: '/lab',
  },
  {
    icon: Shield,
    title: 'PhytoCards',
    desc: 'Every plant earns a collectible card that levels up as you care for it. Track rarity, stats, and growth stages.',
    color: '#B0552F',
    to: '/collection',
  },
  {
    icon: Swords,
    title: 'Care-Off Arena',
    desc: 'Your care record becomes a score — specimen health, streaks, check-ins and species found. Climb a ladder of rival Keepers and win seeds.',
    color: '#9C7A28',
    to: '/arena',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    desc: 'Weather-aware watering reminders, drift detection, and predictive health forecasts — so no plant gets forgotten.',
    color: '#466B46',
  },
];

interface LandingProps {
  /** Every conversion path lands on /auth — a signed-out visitor never gets
      dropped into the Keeper dashboard, which is where the old funnel went
      wrong. */
  onSignIn: () => void;
}

export function Landing({ onSignIn }: LandingProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { shouldDisableAnimations } = useEcoMode();
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<IdentifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // The garden crest recedes as the visitor scrolls into the clinic — scroll-
  // linked, not a one-shot entrance, so the top of the page stays alive.
  const { scrollY } = useScroll();
  const crestY = useTransform(scrollY, [0, 600], [0, -80]);
  const crestOpacity = useTransform(scrollY, [0, 380], [1, 0.1]);

  const handleFile = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setScanError(null);
    setIsQuotaExhausted(false);
    setScanResult(null);

    let base64 = '';
    try {
      const prepared = await prepareScanImage(file);
      base64 = prepared.dataUrl;
      setScanImage(base64);
    } catch {
      setScanError('Unable to process image file. Please choose a JPG, PNG, or WEBP photo.');
      setLoading(false);
      return;
    }

    try {
      const result = await identifyPlant(base64);
      setScanResult(result);
    } catch (err: any) {
      const msg = err?.message || 'Failed to complete leaf analysis.';
      setScanError(msg);
      if (
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('limit') ||
        msg.toLowerCase().includes('used up') ||
        msg.includes('401') ||
        msg.includes('429')
      ) {
        setIsQuotaExhausted(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const isNonPlant = Boolean(
    scanResult && (
      (scanResult.route && scanResult.route !== 'plant') ||
      (scanResult.subject?.kind && scanResult.subject.kind !== 'plant' && scanResult.subject.kind !== 'uncertain') ||
      (scanResult.subject?.subjectKind && scanResult.subject.subjectKind !== 'plant' && scanResult.subject.subjectKind !== 'uncertain') ||
      (scanResult.subjectKind && scanResult.subjectKind !== 'plant' && scanResult.subjectKind !== 'uncertain')
    )
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleHandoffToSignup = () => {
    if (scanImage && scanResult && !isNonPlant) {
      stashPendingScan(scanImage, scanResult);
    }
    rememberAuthReturn('/lab?tab=dex');
    onSignIn();
  };

  const resetScan = () => {
    setScanImage(null);
    setScanResult(null);
    setScanError(null);
    setIsQuotaExhausted(false);
  };

  return (
    /* The ground is translucent (not opaque cream) so the garden ambience
       layer behind it reads through as a faint living texture — it stays
       bright in both themes because the ambience's dark layers sit behind a
       95% cream wash. */
    <div className="min-h-screen w-full bg-[#FAF7F2]/95 text-[#2C2419] font-sans antialiased">
      {/* Brand Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E8E1D5] px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#3D5A3D] text-white flex items-center justify-center font-bold text-sm shadow-xs" aria-hidden="true">
              🌿
            </div>
            <span className="font-serif font-black text-lg tracking-tight text-[#2C2419]">
              PhytoDoctor AI
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSignIn}
              type="button"
              className="min-h-[44px] px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-[#3D5A3D] hover:bg-[#EAE4D9] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5A3D]"
            >
              Sign In
            </button>
            <button
              onClick={onSignIn}
              type="button"
              className="min-h-[44px] px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider bg-[#3D5A3D] hover:bg-[#4E724E] text-white rounded-xl shadow-xs transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5A3D] focus-visible:ring-offset-2"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section — bright morning garden. The band is a fixed light
          gradient (independent of data-theme), the fronds are the same
          silhouettes the ambient layer uses, and everything here is
          decorative and aria-hidden. */}
      <section className="relative px-6 pt-16 md:pt-24 pb-16 text-center lg:text-left max-w-6xl mx-auto overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[#FDF3DC] via-[#F7F3E6] to-transparent"
          aria-hidden="true"
        />
        <svg
          className="absolute -left-10 bottom-0 w-40 md:w-56 opacity-[0.13] text-[#3D5A3D] pointer-events-none"
          viewBox="0 0 220 420"
          preserveAspectRatio="xMinYMax meet"
          aria-hidden="true"
        >
          <g fill="currentColor">
            <path d="M14 420 C10 330 26 250 58 190 C74 158 96 132 124 112 C112 152 96 190 74 224 C46 266 28 330 26 420 Z" />
            <path d="M30 420 C34 348 56 288 92 244 C112 220 136 200 162 188 C146 220 126 250 100 278 C68 314 50 358 46 420 Z" opacity="0.72" />
            <path d="M52 420 C58 366 78 322 108 292 C124 275 142 262 160 254 C146 278 130 300 112 322 C88 352 72 382 68 420 Z" opacity="0.5" />
          </g>
        </svg>
        <svg
          className="absolute -right-10 bottom-0 w-40 md:w-56 opacity-[0.11] text-[#5A7D5A] pointer-events-none"
          viewBox="0 0 220 420"
          preserveAspectRatio="xMaxYMax meet"
          aria-hidden="true"
        >
          <g fill="currentColor">
            <path d="M206 420 C210 336 196 258 166 198 C150 166 130 140 104 120 C116 160 130 196 152 230 C178 270 194 334 194 420 Z" />
            <path d="M190 420 C186 352 166 292 132 248 C112 224 90 204 66 192 C82 224 100 252 126 280 C156 316 172 360 174 420 Z" opacity="0.72" />
            <path d="M168 420 C162 368 144 326 116 296 C100 280 82 266 64 258 C78 282 92 304 110 326 C132 356 148 384 152 420 Z" opacity="0.5" />
          </g>
        </svg>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            {/* Scroll-linked garden crest */}
            <motion.div style={{ y: crestY, opacity: crestOpacity }}>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAE4D9] text-[#3D5A3D] border border-[#DDD5C7] text-xs font-mono font-bold uppercase tracking-widest mb-6">
                <span>🌿 Botanical Care Clinic · Instant Vision Diagnosis</span>
              </div>
            </motion.div>

            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-black text-[#2C2419] tracking-tight leading-tight">
              Snap a leaf. Save a life.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-[#6B5E51] leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Clinical-grade botanical pathology right in your browser. Photograph any sick or mysterious plant, get an accurate diagnosis in thirty seconds, and nurture your living collection.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <a
                href="#free-scan-widget"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#3D5A3D] hover:bg-[#4E724E] text-white font-mono font-bold uppercase tracking-wider text-xs shadow-md transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5A3D] focus-visible:ring-offset-2"
              >
                <Camera size={16} aria-hidden="true" />
                <span>Try Free Instant Scan</span>
              </a>

              <button
                onClick={onSignIn}
                type="button"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white hover:bg-[#F3EFE8] text-[#2C2419] border border-[#D5CDC0] font-mono font-bold uppercase tracking-wider text-xs shadow-xs transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5A3D]"
              >
                <span>Create a Free Account</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs text-[#6B5E51] font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#3D5A3D]" />
                2 Free Scans Daily
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#3D5A3D]" />
                100% On-Device Privacy
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#3D5A3D]" />
                No Credit Card Needed
              </span>
            </div>
          </div>

          {/* Pinterest-tier specimen diagnostic preview card on desktop */}
          <div className="lg:col-span-5 hidden lg:block">
            <div className="relative p-6 rounded-3xl bg-white/95 backdrop-blur-md border border-[#DCD3C5] shadow-lg text-left">
              <div className="flex items-center justify-between pb-4 border-b border-[#E8E1D5]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#EAE4D9] flex items-center justify-center text-xl shadow-xs" aria-hidden="true">
                    🌿
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#2C2419] leading-tight">
                      Monstera Deliciosa
                    </h3>
                    <p className="text-[11px] font-mono text-[#8C7E6D]">Swiss Cheese Plant · Araceae</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#EBF3EB] text-[#2E6B2E] border border-[#C6DFC6] text-[10px] font-mono font-bold uppercase tracking-wider">
                  ✓ 94% Match
                </span>
              </div>

              <div className="mt-4 p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE4D9] space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#8C5E24]">
                  <Sparkles size={14} aria-hidden="true" />
                  <span>Clinical Finding: Early Chlorosis</span>
                </div>
                <p className="text-xs text-[#5C5042] leading-relaxed">
                  Mild nitrogen deficit detected in lower leaf margin. Nitrogen-balanced kelp tonic and filtered indirect sun recommended.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                <div className="p-2.5 rounded-xl bg-white border border-[#E8E1D5]">
                  <span className="block text-[#8C7E6D] text-[9px] uppercase">Vigor</span>
                  <span className="font-bold text-[#3D5A3D]">88% Stable</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#E8E1D5]">
                  <span className="block text-[#8C7E6D] text-[9px] uppercase">Water</span>
                  <span className="font-bold text-[#2C2419]">7-10 Days</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#E8E1D5]">
                  <span className="block text-[#8C7E6D] text-[9px] uppercase">Sunlight</span>
                  <span className="font-bold text-[#2C2419]">Indirect</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E8E1D5] flex items-center justify-between text-[11px] font-mono text-[#8C7E6D]">
                <span>Sample Diagnosis Preview</span>
                <span className="text-[#3D5A3D] font-bold">Instant Vision Engine</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inline Free-Scan Widget */}
      <section id="free-scan-widget" className="px-6 py-12 bg-white/70 border-y border-[#E8E1D5]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-serif text-2xl sm:text-3xl font-black text-[#2C2419]">
              Try the Clinic — 2 Free Scans a Day
            </h2>
            <p className="mt-2 text-sm text-[#6B5E51]">
              No credit card, no sign-in required. Experience the diagnosis engine immediately.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#DCD3C5] shadow-md p-6 sm:p-8">
            {/* Hidden file input */}
            <label htmlFor="landing-scan-file-input" className="sr-only">
              Upload plant photo for free diagnosis
            </label>
            <input
              id="landing-scan-file-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="sr-only"
            />

            {/* Scan State 1: Dropzone Idle. The drag surface is a plain div —
                drag is a pointer-only convenience. The single interactive
                control is the real button below, so there is no synthetic
                role="button" div whose rendered text can fall out of sync
                with its accessible name (Label in Name). */}
            {!scanImage && !loading && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
                  isDragging
                    ? 'border-[#3D5A3D] bg-[#F2F7F2]'
                    : 'border-[#D0C6B8] hover:border-[#3D5A3D] hover:bg-[#FAF7F2]'
                }`}
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-[#FAF7F2] border border-[#E0D8CB] flex items-center justify-center text-[#3D5A3D] mb-4">
                  <Upload size={28} aria-hidden="true" />
                </div>
                <h3 className="font-serif font-bold text-lg text-[#2C2419]">
                  Select or drop a leaf photograph
                </h3>
                <p className="mt-2 text-xs text-[#6B5E51] max-w-sm mx-auto">
                  Take a clear, well-lit photo of affected foliage, stem, or blossom. Prepared in-browser for speed.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 bg-[#3D5A3D] hover:bg-[#4E724E] text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5A3D] focus-visible:ring-offset-2 transition-all active:scale-95"
                  >
                    📷 Choose Photo
                  </button>
                </div>
              </div>
            )}

            {/* Scan State 2: Analyzing Loading */}
            {loading && (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#FAF7F2] border border-[#3D5A3D] border-t-transparent animate-spin flex items-center justify-center text-xl">
                  🌿
                </div>
                <h3 className="font-serif text-xl font-bold text-[#2C2419]">
                  Consulting Botanical Diagnostic Engine...
                </h3>
                <p className="text-xs text-[#6B5E51] max-w-md mx-auto">
                  Reading cellular discoloration, leaf lesions, and stress markers. Complete report arriving in ~20 seconds.
                </p>
              </div>
            )}

            {/* Scan State 3: Error or Quota Exhausted */}
            {scanError && !loading && (
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                  <AlertTriangle size={24} aria-hidden="true" />
                </div>
                <h3 className="font-serif font-bold text-lg text-amber-900">
                  {isQuotaExhausted ? 'Guest Scan Limit Reached' : 'Diagnosis Encountered an Issue'}
                </h3>
                <p className="text-xs text-amber-800/90 max-w-md mx-auto leading-relaxed">
                  {scanError}
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  <button
                    onClick={onSignIn}
                    type="button"
                    className="min-h-[44px] px-6 py-2.5 bg-[#3D5A3D] hover:bg-[#4E724E] text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider shadow-xs"
                  >
                    Create Free Account for 3 Scans/Day
                  </button>
                  <button
                    onClick={resetScan}
                    type="button"
                    className="min-h-[44px] px-5 py-2.5 bg-white border border-[#D5CDC0] text-[#2C2419] hover:bg-[#FAF7F2] rounded-xl text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    Try Another Photo
                  </button>
                </div>
              </div>
            )}

            {/* Scan State 4: Diagnosis Result Card or Non-Plant Report */}
            {scanResult && !loading && (
              isNonPlant ? (
                <NonPlantReport
                  result={scanResult}
                  onScanAgain={resetScan}
                  alwaysBright
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE4D9]">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 mb-1.5">
                        ✓ Diagnosis Ready
                      </span>
                      <h3 className="text-2xl font-serif font-black text-[#2C2419]">
                        {scanResult.commonName || scanResult.speciesName || 'Botanical Specimen'}
                      </h3>
                      <p className="text-xs font-mono italic text-[#6B5E51]">
                        {scanResult.scientificName || 'Taxonomic evaluation complete'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                          scanResult.healthStatus === 'Healthy'
                            ? 'bg-emerald-100 text-emerald-800'
                            : scanResult.healthStatus === 'Stressed'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {scanResult.healthStatus || 'Status assessed'}
                      </span>
                      {scanResult.severity && (
                        <span className="text-xs font-mono text-[#6B5E51] bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E0D8CB]">
                          Severity {scanResult.severity}/5
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Primary Diagnosis */}
                  <div>
                    <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6B6156] mb-1.5">
                      Clinical Pathology
                    </h4>
                    <p className="text-sm text-[#2C2419] leading-relaxed">
                      {scanResult.diagnosis || 'Visible leaf structure shows typical botanical patterns.'}
                    </p>
                  </div>

                  {/* First Treatment Steps */}
                  {Array.isArray(scanResult.treatmentInstructions) && scanResult.treatmentInstructions.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6B6156] mb-2">
                        Immediate Recovery Steps
                      </h4>
                      <ol className="space-y-2 text-xs text-[#2C2419]">
                        {scanResult.treatmentInstructions.slice(0, 3).map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-[#EAE4D9] text-[#3D5A3D] font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Account Conversion Card */}
                  <div className="p-5 rounded-2xl bg-[#F4EFE6] border border-[#DDD4C4] space-y-3">
                    <div className="flex items-center gap-2 text-[#3D5A3D]">
                      <Sparkles size={16} aria-hidden="true" />
                      <h4 className="font-serif font-bold text-sm text-[#2C2419]">
                        Save This Diagnosis to Your Living Sanctuary
                      </h4>
                    </div>
                    <p className="text-xs text-[#6B5E51] leading-relaxed">
                      Create a free account to keep this diagnosis on your dashboard, track recovery drift over time, and unlock 3 free scans every day.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleHandoffToSignup}
                        type="button"
                        className="min-h-[44px] px-6 py-2.5 bg-[#3D5A3D] hover:bg-[#4E724E] text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider shadow-sm transition-all"
                      >
                        Save Diagnosis &amp; Continue Free
                      </button>
                      <button
                        onClick={resetScan}
                        type="button"
                        className="min-h-[44px] px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-[#6B5E51] hover:text-[#2C2419]"
                      >
                        Scan Another Leaf
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#3D5A3D]">
            Simple Three-Step Protocol
          </span>
          <h2 className="font-serif text-3xl font-black text-[#2C2419] mt-2">
            How PhytoDoctor Protects Your Garden
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-7 rounded-2xl border border-[#E8E1D5] shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E0D8CB] flex items-center justify-center text-xl text-[#3D5A3D] font-bold mb-4">
              1
            </div>
            <h3 className="font-serif font-bold text-lg text-[#2C2419] mb-2">
              Photograph Leaf Symptoms
            </h3>
            <p className="text-xs text-[#6B5E51] leading-relaxed">
              Capture leaf spots, wilting margins, or suspicious markings in natural daylight. Images are prepared right on your device.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-[#E8E1D5] shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E0D8CB] flex items-center justify-center text-xl text-[#3D5A3D] font-bold mb-4">
              2
            </div>
            <h3 className="font-serif font-bold text-lg text-[#2C2419] mb-2">
              Instant AI Vision Pathology
            </h3>
            <p className="text-xs text-[#6B5E51] leading-relaxed">
              Gemini vision analyzes chlorosis, fungal spore patterns, pest signs, and abiotic stress with differential confidence scoring.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-[#E8E1D5] shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E0D8CB] flex items-center justify-center text-xl text-[#3D5A3D] font-bold mb-4">
              3
            </div>
            <h3 className="font-serif font-bold text-lg text-[#2C2419] mb-2">
              Execute Recovery Timeline
            </h3>
            <p className="text-xs text-[#6B5E51] leading-relaxed">
              Follow step-by-step watering adjustments, humidity fixes, and organic treatments tailored to your local microclimate.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-16 bg-[#F4EFE6] border-t border-[#E8E1D5]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#3D5A3D]">
              Comprehensive Care Ecosystem
            </span>
            <h2 className="font-serif text-3xl font-black text-[#2C2419] mt-2">
              Horticultural Tools for Every Plant Parent
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={idx}
                  className="bg-white p-7 rounded-2xl border border-[#E0D8CB] shadow-xs flex items-start gap-4"
                  whileHover={!shouldDisableAnimations ? { y: -5 } : undefined}
                  whileTap={feat.to && !shouldDisableAnimations ? { scale: 0.97 } : undefined}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '0px 0px -12% 0px' }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: feat.color }}
                    aria-hidden="true"
                  >
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#2C2419] mb-1.5">
                      {feat.title}
                    </h3>
                    <p className="text-xs text-[#6B5E51] leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="px-6 py-14 max-w-4xl mx-auto text-center border-t border-[#E8E1D5]">
        <h2 className="font-serif text-2xl font-bold text-[#2C2419] mb-6">
          Built on Honest Botanical Engineering
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="p-5 rounded-2xl bg-white border border-[#E8E1D5] shadow-2xs">
            <div className="flex items-center gap-2 text-[#3D5A3D] font-mono font-bold text-xs uppercase mb-2">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Offline-First Store</span>
            </div>
            <p className="text-xs text-[#6B5E51] leading-relaxed">
              Your collection lives directly in your browser&apos;s IndexedDB. The app loads instantly even with zero network connectivity.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#E8E1D5] shadow-2xs">
            <div className="flex items-center gap-2 text-[#3D5A3D] font-mono font-bold text-xs uppercase mb-2">
              <Lock size={16} aria-hidden="true" />
              <span>Private On-Device Health</span>
            </div>
            <p className="text-xs text-[#6B5E51] leading-relaxed">
              Subsequent check-in drift detection computes HSV histograms entirely on an HTML5 canvas. Photos never leave your device for monitoring.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#E8E1D5] shadow-2xs">
            <div className="flex items-center gap-2 text-[#3D5A3D] font-mono font-bold text-xs uppercase mb-2">
              <HeartHandshake size={16} aria-hidden="true" />
              <span>Honest Diagnosis Limits</span>
            </div>
            <p className="text-xs text-[#6B5E51] leading-relaxed">
              Clear quotas, no deceptive marketing, no locked plant care cards. Free users get authentic diagnoses without predatory friction.
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA & Essential Navigation */}
      <footer className="px-6 py-16 bg-[#2C2419] text-[#FAF7F2] text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-black text-white">
            Ready to nurture your living sanctuary?
          </h2>
          <p className="text-xs sm:text-sm text-[#D5CEC2] leading-relaxed">
            Start cataloging your houseplants, tracking seasonal care, and rescuing ailing leaves — your garden, your data, your pace.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <button
              onClick={onSignIn}
              type="button"
              className="min-h-[44px] px-8 py-3.5 bg-[#3D5A3D] hover:bg-[#4E724E] text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider shadow-md transition-all active:scale-95"
            >
              Enter Sanctuary
            </button>
            <button
              onClick={onSignIn}
              type="button"
              className="min-h-[44px] px-6 py-3.5 bg-transparent hover:bg-white/10 text-[#FAF7F2] border border-[#FAF7F2]/30 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors"
            >
              Sign In to Existing Account
            </button>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-wrap justify-center gap-x-6 text-[11px] font-mono text-[#A89F91]">
            <Link to="/lab" className="py-2 hover:text-white transition-colors">Lab Notes</Link>
            <Link to="/library" className="py-2 hover:text-white transition-colors">Library</Link>
            <Link to="/help" className="py-2 hover:text-white transition-colors">Help &amp; FAQ</Link>
            <Link to="/privacy" className="py-2 hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="py-2 hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
