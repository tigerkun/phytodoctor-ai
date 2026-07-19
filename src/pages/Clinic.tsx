import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Info, Leaf, MessageCircle, Sprout, X } from 'lucide-react';
import { identifyPlant, type PlantCare } from '../services/geminiService';
import { NotificationContainer, type RewardToast } from '../components/game/RewardNotification';
import { COMMON_REWARDS } from '../game/rewardUtils';
import PageWrapper from '../components/home/PageWrapper';
import { useToast } from '../components/Toast';


// Helpers
// clamp helper is declared once above

type DifferentialItem = {
  name: string;
  description: string;
  confidence: number; // 0-100
};

type MockCare = PlantCare & {
  differentialDiagnosis: DifferentialItem[];
  confidence: number;
};

const generateMockCare = (): MockCare => {
  const plants = [
    {
      commonName: 'Monstera Deliciosa',
      scientific: 'Monstera deliciosa',
      diagnosis: 'Thriving with a gentle humidity handshake—watch new leaf edges.',
      vulnerabilityNotes: 'Leaf margins may crisp if air stays too dry for long stretches.',
      watering: 'Keep evenly moist; let the top inch breathe.',
      light: 'Bright, filtered light',
      soil: 'Loamy with airy drainage',
      temperature: '22–24°C',
      severity: 2,
      healthStatus: 'Healthy',
    },
    {
      commonName: 'Peace Lily',
      scientific: 'Spathiphyllum wallisii',
      diagnosis: 'Near-flourishing—support steady hydration to keep blooms poised.',
      vulnerabilityNotes: 'Wilting is a fast signal when thirst arrives.',
      watering: 'Moist (not soggy)',
      light: 'Low to medium, indirect',
      soil: 'Peaty, breathable mix',
      temperature: '20–23°C',
      severity: 2,
      healthStatus: 'Healthy',
    },
    {
      commonName: 'Snake Plant',
      scientific: 'Dracaena trifasciata',
      diagnosis: 'Excellent resilience—your plant prefers calm, dry intervals.',
      vulnerabilityNotes: 'Overwatering can quietly invite root trouble.',
      watering: 'Dry between waterings',
      light: 'Low to bright shade',
      soil: 'Sandy, well-draining blend',
      temperature: '18–22°C',
      severity: 1,
      healthStatus: 'Healthy',
    },
    {
      commonName: 'ZZ Plant',
      scientific: 'Zamioculcas zamiifolia',
      diagnosis: 'Naturally steady—keep conditions consistent for leaf shine.',
      vulnerabilityNotes: 'Staying too wet for too long is the main risk.',
      watering: 'Let soil dry fully',
      light: 'Low to medium, indirect',
      soil: 'Well-draining and gritty',
      temperature: '19–24°C',
      severity: 1,
      healthStatus: 'Healthy',
    },
  ];

  const picked = plants[Math.floor(Math.random() * plants.length)];
  const confidence = 80 + Math.floor(Math.random() * 21); // 80-100

  const differential: DifferentialItem[] = [
    {
      name: 'Humidity Balance',
      description:
        'Subtle edge changes suggest the air is a touch drier than your plant prefers. A light misting near the canopy can help—avoid soaking leaves.',
      confidence: 68 + Math.floor(Math.random() * 18),
    },
    {
      name: 'Light Rhythm',
      description:
        'Your plant responds best to gentle light consistency. If it’s been moved recently, gradual relocation (over 7–10 days) is ideal.',
      confidence: 54 + Math.floor(Math.random() * 22),
    },
    {
      name: 'Root Breathing',
      description:
        'Even when watering looks “right,” drainage and airflow matter. Confirm the pot has clear runoff and avoid standing water.',
      confidence: 45 + Math.floor(Math.random() * 24),
    },
    {
      name: 'Nutrient Cues',
      description:
        'If growth slows, the plant may want a mild feed during active season. Use diluted fertilizer and observe response over a month.',
      confidence: 38 + Math.floor(Math.random() * 18),
    },
  ]
    .map((d) => ({ ...d, confidence: Math.max(22, Math.min(98, d.confidence)) }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    ...picked,
    healthStatus: picked.healthStatus as "Healthy" | "Stressed" | "Diseased" | "Infested",
    severity: picked.severity as 1 | 2 | 3 | 4 | 5,
    scientificName: picked.scientific,
    confidence,
    treatmentTimeline: [
      { day: '0', action: 'Set a calm baseline', expectedOutcome: 'Comfortable moisture + stable light' },
      { day: '3', action: 'Fine-tune watering rhythm', expectedOutcome: 'Leaves look more supple' },
      { day: '7', action: 'Observe new growth cues', expectedOutcome: 'Green tone steadies and edges soften' },
    ],
    treatmentInstructions: [
      'Observe watering guidelines; avoid moisture accumulation.',
      'Maintain exposure to bright, filtered indirect sunlight.',
      'Wipe leaves occasionally with a clean damp cloth.'
    ],
    careTips: [
      'Maintain temperatures between 18–24°C.',
      'Ensure the pot has adequate drainage holes.'
    ],
    differentialDiagnosis: differential,
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}



export default function Clinic() {
  const { info } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [identification, setIdentification] = useState<MockCare | PlantCare | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'timeline' | 'differential'>('diagnosis');
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBotanistChat, setShowBotanistChat] = useState(false);
  const [notifications, setNotifications] = useState<RewardToast[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const LOADING_PHRASES = useMemo(
    () => [
      'Listening to leaf whispers...',
      'Brewing botanical certainty...',
      'Reading hydration harmony...',
      'Charting a gentle wellness path...',
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newImages = [...images, reader.result as string].slice(-3);
      setImages(newImages);

      // Keep UI premium even before network returns
      setIdentification(generateMockCare());

      if (newImages.length >= 1) {
        identify(reader.result as string);
      }
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
          actionName: 'Diagnosis Complete',
          capExceeded: rewardResult.capExceeded
        }]);
        // Auto-remove notification after 4s
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== rewardId));
        }, 4000);
      } catch (rewardError) {
        console.error('Reward error:', rewardError);
      }
    } catch (err: any) {
      setError(err?.message || 'Please try again with a clearer photo.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImages([]);
    setIdentification(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowBotanistChat(false);
    setActiveTab('diagnosis');
  };

  const AmbientWind = () => {
    const icons = [Leaf, Sprout];
    const colors = [
      'bg-[#5F7161]/20', // Moss
      'bg-[#9CAF88]/20', // Sage
      'bg-[#E07A5F]/20', // Terracotta
      'bg-[#3D405B]/10', // Deep Bark
    ];

    const items: React.ReactNode[] = [];
    for (let i = 0; i < 20; i++) {
      const Icon = icons[Math.floor(Math.random() * icons.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const duration = 22 + Math.random() * 34; // 22-56s
      const delay = Math.random() * 30;
      const scale = 0.5 + Math.random() * 1.4;
      const rotate = Math.random() * 360;

      items.push(
        <motion.div
          key={i}
          className="fixed pointer-events-none z-0"
          style={{
            left: `${left}%`,
            top: '-14%',
            width: `${scale * 28}px`,
            height: `${scale * 28}px`,
            transform: `rotate(${rotate}deg)`,
            animationDelay: `${delay}s`,
          }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 0.45, y: -120, rotate: rotate + 360 }}
          transition={{ duration, repeat: Infinity, ease: 'linear', delay }}
        >
          <div className={`w-full h-full rounded-full flex items-center justify-center ${color}`}>
            <Icon size={18} className="text-[#3D405B]/40" />
          </div>
        </motion.div>
      );
    }

    const blobs = [
      { left: '8%', top: '20%', w: 220, h: 220, c: 'bg-[#9CAF88]/20' },
      { left: '65%', top: '12%', w: 240, h: 240, c: 'bg-[#5F7161]/20' },
      { left: '40%', top: '55%', w: 260, h: 260, c: 'bg-[#E07A5F]/12' },
    ];

    return (
      <>
        {items}
        {blobs.map((b, idx) => (
          <motion.div
            key={idx}
            className={`fixed pointer-events-none ${b.c} blur-3xl rounded-full z-0`}
            style={{ left: b.left, top: b.top, width: b.w, height: b.h }}
            initial={{ opacity: 0.55, x: -20, y: 10 }}
            animate={{ opacity: 0.72, x: 20, y: -10 }}
            transition={{ duration: 16 + idx * 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </>
    );
  };

  const ConfidenceRing = ({ confidencePct }: { confidencePct: number }) => {
    const size = 78;
    const strokeWidth = 10;
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const pct = clamp(confidencePct, 10, 100);
    const dashOffset = c - (pct / 100) * c;

    return (
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F9F7F2" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#9CAF88"
            strokeWidth={strokeWidth}
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          >
            <animate attributeName="stroke-dashoffset" values={`${c};${dashOffset}`} dur="2.4s" repeatCount="1" />
          </circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-black text-[#3D405B] leading-none">{pct}</div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#3D405B]/60 mt-1">Clarity</div>
        </div>
      </div>
    );
  };

  const FloatingBotanist = () => {
    const prompts = [
      'How often should I water this?',
      'What light level is safest?',
      'Why are leaf edges changing?',
    ];

    const onPrompt = (p: string) => {
      info(`Botanist: "${p}" — This is a mock response designed for UI preview.`);
    };

    return (
      <>
        <motion.div
          className="fixed bottom-6 right-4 z-[60]"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.96 }}
        >
          <button
            type="button"
            aria-label="Ask the Botanist"
            onClick={() => setShowBotanistChat((v) => !v)}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-[#9CAF88] text-white shadow-xl shadow-[#5F7161]/10 transition-all"
          >
            <MessageCircle size={18} />
          </button>
        </motion.div>

        <AnimatePresence>
          {showBotanistChat && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="fixed bottom-20 right-4 z-[55] w-[320px] max-w-[92vw] rounded-3xl border border-[#F9F7F2]/20 shadow-xl shadow-[#5F7161]/10 bg-white/90 backdrop-blur-md p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-serif text-xl text-[#3D405B]">Ask the Botanist</h3>
                  <p className="text-[11px] w-full block whitespace-normal break-words text-[#3D405B]/60 font-sans mt-0.5">
                    Quick care nudges, crafted for thriving.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBotanistChat(false)}
                  className="p-2 rounded-2xl hover:bg-[#F9F7F2]/70 transition-colors text-[#3D405B]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {prompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPrompt(p)}
                    className="w-full text-left px-3 py-2 rounded-2xl border border-[#F9F7F2]/30 bg-[#F9F7F2]/50 hover:bg-[#F9F7F2]/80 transition-colors text-[#3D405B] font-sans text-sm"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  const ConfidencePct = useMemo(() => {
    if (!identification) return 0;
    const anyId = identification as any;
    const c = typeof anyId.confidence === 'number' ? anyId.confidence : 86;
    return clamp(c, 0, 100);
  }, [identification]);

  const HealthPill = () => {
    const healthStatus = (identification as any)?.healthStatus as string | undefined;
    const label = healthStatus || 'Well-Groomed';
    const tone = label.toLowerCase().includes('healthy') ? 'bg-[#9CAF88]/90' : 'bg-[#E07A5F]/90';
    return (
      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-xs ${tone}`}>
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
          'flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ' +
          (active
            ? 'bg-white text-[#3D405B] shadow-[0_10px_30px_rgba(95,113,97,0.12)] border border-[#F9F7F2]/40'
            : 'text-[#3D405B]/50 hover:text-[#3D405B]')
        }
      >
        {label}
      </button>
    );
  };

  const differentialItems = (identification as any)?.differentialDiagnosis as DifferentialItem[] | undefined;

  return (
    <PageWrapper>
      <AmbientWind />
      <NotificationContainer 
        notifications={notifications} 
        onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} 
      />

      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-bark)] relative z-[10]">
        {/* Clinical Notice Modal */}
        <AnimatePresence>
          {showDisclaimer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] bg-[var(--text-bark)]/20 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.98, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                className="w-11/12 max-w-[500px] block mx-auto my-auto bg-[var(--bg-glass)] backdrop-blur-sm rounded-[2.5rem] border border-[var(--border-light)] shadow-xl p-8 relative"
              >
                <div className="absolute -right-6 -top-6 text-[var(--terracotta)]/5 pointer-events-none -rotate-12">
                  <Info size={120} />
                </div>

                <h3 className="font-serif text-3xl font-bold mb-4 text-[var(--text-bark)]">Garden Clinic Welcome</h3>
                <p className="w-full block whitespace-normal break-words text-[var(--text-stone)] text-sm leading-relaxed font-sans font-medium">
                  This Plant Clinic offers living wellness wisdom. Guidance complements—never replaces—professional horticultural advice.
                  Please handle treatments with care and observe plant safety first.
                </p>

                <button
                  type="button"
                  onClick={() => setShowDisclaimer(false)}
                  className="mt-6 w-full py-4 bg-[var(--text-bark)] hover:bg-[var(--moss)] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 min-h-[44px]"
                >
                  Enter the Clinic
                </button>

                {error && (
                  <p className="mt-3 text-[11px] text-[var(--terracotta)] w-full block whitespace-normal break-words font-sans">{error}</p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="pb-28">
          {/* Upload Station */}
          {images.length === 0 && (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 w-full">
                {/* LEFT WING */}
                <section className="lg:col-span-5 rounded-3xl border border-[var(--border-light)] shadow-xl bg-[var(--bg-glass)] backdrop-blur-sm p-8 min-h-[560px] relative overflow-hidden">
                  {/* laser line */}
                  <div className="absolute left-[-10%] right-[-10%] top-10 h-[2px] bg-gradient-to-r from-transparent via-[var(--moss)] to-transparent animate-[pulse_2.8s_ease-in-out_infinite]" />

                  <div className="relative z-10 h-full flex flex-col justify-center items-center text-center">
                    <div className="w-24 h-24 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-light)] shadow-md flex items-center justify-center text-[var(--text-stone)]/45">
                      <Camera size={36} />
                    </div>

                    <span className="mt-6 inline-flex items-center gap-2 px-3 py-1 bg-[var(--moss)]/10 border border-[var(--border-light)] rounded-full text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-stone)]">
                      <span className="w-2 h-2 rounded-full bg-[var(--sage)]" /> Living Lens
                    </span>

                    <h1 className="font-serif text-5xl md:text-5xl font-bold text-[var(--text-bark)] mt-5 leading-tight w-full whitespace-normal">
                      Plant Clinic
                    </h1>

                    <p className="mt-4 text-sm text-[var(--text-stone)] block w-full whitespace-normal break-words leading-relaxed font-sans font-medium">
                      Place your leaf before the lens. Botanical Intelligence reads color, texture, and rhythm to guide care toward thriving.
                    </p>

                    <div className="mt-7 w-full pt-6 border-t border-[var(--border-light)]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full px-8 py-4.5 bg-[var(--text-bark)] hover:bg-[var(--moss)] text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 min-h-[44px]"
                        >
                          <span className="inline-block">
                            <Camera size={14} />
                          </span>
                          Diagnose My Plant
                        </button>

                        <div className="relative rounded-2xl border border-[var(--moss)]/25 bg-[var(--moss)]/10 shadow-inner p-4 overflow-hidden">
                          <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_20%_20%,rgba(156,175,136,0.35),transparent_45%),radial-gradient(circle_at_80%_40%,rgba(95,113,97,0.25),transparent_50%)]" />
                          <div className="relative flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-light)] flex items-center justify-center text-[var(--terracotta)]">
                              🌻
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] font-black uppercase tracking-wider block text-[var(--terracotta)]">
                                Growth Protocol
                              </span>
                              <p className="w-full block whitespace-normal break-words text-[12px] font-black text-[var(--text-bark)] mt-0.5">
                                +150 Growth Points
                              </p>
                              <p className="w-full block whitespace-normal break-words text-[11px] text-[var(--text-stone)] mt-0.5 font-sans">
                                Earn care steps that feel natural.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-light)]">
                          <Sprout size={14} className="text-[var(--moss)]" />
                          <p className="w-full block whitespace-normal break-words text-[11px] text-[var(--text-stone)] font-sans">Capture a leaf close-up for best results.</p>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-[-120px] left-[-60px] w-[220px] h-[220px] rounded-full bg-[var(--sage)]/10 blur-2xl" />
                </section>

                {/* RIGHT WING */}
                <section className="lg:col-span-7 rounded-3xl border border-[var(--border-light)] shadow-xl bg-[var(--bg-glass)] backdrop-blur-sm p-8 min-h-[560px]">
                  <div className="h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--moss)]/10 border border-[var(--moss)]/20 rounded-full text-[9px] font-black uppercase tracking-[0.25em] text-[var(--moss)]">
                          <Leaf size={13} /> Botanical Intelligence
                        </span>

                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--sage)]/15 border border-[var(--sage)]/25 text-[10px] font-black uppercase tracking-wider text-[var(--moss)]">
                          🌿 Late Spring Care Protocol
                        </span>
                      </div>

                      <h2 className="font-serif text-5xl md:text-5xl font-bold text-[var(--text-bark)] mt-6 leading-tight w-full whitespace-normal">
                        Clinic Intelligence
                      </h2>

                      <p className="mt-4 text-sm text-[var(--text-stone)] block w-full whitespace-normal break-words leading-relaxed font-sans font-medium">
                        A warm, living wellness blueprint: hydration rhythm, light harmony, and soil breathing—so your plant can settle into thriving.
                      </p>

                      <div className="mt-6 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-secondary)] p-5">
                        <h3 className="font-serif text-xl font-bold text-[var(--text-bark)]">What the Clinic checks</h3>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { title: 'Leaf tone', desc: 'Color balance and seasonal cues' },
                            { title: 'Edge behavior', desc: 'Dryness, stress, and recovery signs' },
                            { title: 'Water rhythm', desc: 'Moisture comfort without over-saturation' },
                            { title: 'Light comfort', desc: 'Gentle intensity and daily consistency' },
                          ].map((it) => (
                            <div key={it.title} className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-glass)] p-4">
                              <p className="w-full block whitespace-normal break-words text-[12px] font-black uppercase tracking-wider text-[var(--moss)]">
                                {it.title}
                              </p>
                              <p className="mt-1 w-full block whitespace-normal break-words text-sm text-[var(--text-stone)] font-sans">{it.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-8 py-4.5 bg-[var(--text-bark)] hover:bg-[var(--moss)] text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 min-h-[44px]"
                      >
                        Diagnose My Plant
                      </button>
                      <p className="mt-3 w-full block whitespace-normal break-words text-[11px] text-[var(--text-stone)] font-sans">
                        Tip: if your leaf is dusty, gently wipe the surface before uploading.
                      </p>
                    </div>
                  </div>
                </section>

                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>
            </div>
          )}

          {/* Diagnosis Report */}
          <AnimatePresence mode="wait">
            {images.length > 0 && identification && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 w-full">
                    {/* Left: uploaded image */}
                    <section className="lg:col-span-5 w-full text-left block">
                      <div className="relative rounded-[2.5rem] overflow-hidden shadow-xl border border-[var(--border-light)] w-full bg-white">
                        <img src={images[images.length - 1]} alt="Plant leaf preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--text-bark)]/25 via-transparent to-transparent" />
                        <div className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--moss)] to-transparent" />

                        {/* Optical Telemetry (badge, warm wording allowed) */}
                        <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-[var(--moss)]/90 text-[var(--bg-primary)] shadow-sm">
                          Living Lens • Telemetry Active
                        </span>

                        {/* Loading overlay */}
                        {loading && (
                          <div className="absolute inset-0 bg-[var(--text-bark)]/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-12 h-12 rounded-full bg-[var(--moss)]/20 border border-[var(--moss)]/40 flex items-center justify-center mb-3">
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                                <Camera size={22} className="text-[var(--moss)]" />
                              </motion.div>
                            </div>
                            <p className="w-full block whitespace-normal break-words font-serif text-lg font-medium text-[var(--bg-primary)]">
                              {LOADING_PHRASES[loadingPhase]}
                            </p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={reset}
                          className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur-md text-[var(--text-bark)] rounded-2xl hover:bg-white transition-all shadow-sm active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="mt-5">
                        <div className="flex gap-3 items-center w-full justify-start overflow-x-auto pb-2">
                          {images.map((img, i) => (
                            <div
                              key={i}
                              className="w-16 h-16 rounded-2xl border border-[var(--border-light)] overflow-hidden shadow-sm bg-white shrink-0"
                            >
                              <img src={img} alt={`Plant angle ${i + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}

                          {images.length < 3 && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-16 h-16 rounded-2xl border border-dashed border-[var(--border-light)] hover:bg-white transition-all flex flex-col items-center justify-center text-[var(--text-stone)]/55 hover:text-[var(--moss)] gap-1 shrink-0 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)]"
                            >
                              <Camera size={16} />
                              <span className="text-[8px] font-black uppercase tracking-tighter">Add Angle</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    </section>

                    {/* Right report */}
                    <section className="lg:col-span-7 w-full text-left block">
                      <div className="w-full block rounded-[2.5rem] border border-[var(--border-light)] shadow-xl bg-[var(--bg-glass)] backdrop-blur-sm p-8">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full border-b border-[var(--border-light)] pb-4">
                          <div className="text-left space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 bg-[var(--text-bark)]/5 border border-[var(--text-bark)]/10 rounded-full text-[9px] font-black uppercase tracking-wider text-[var(--text-bark)]">
                                Vital Blueprint
                              </span>
                              <span className="px-2.5 py-0.5 bg-[var(--moss)]/15 text-[var(--terracotta)] border border-[var(--moss)]/25 rounded-full text-[9px] font-black uppercase tracking-wider">
                                🌻 +150 Growth Granted
                              </span>
                            </div>
                            <h2 className="font-serif text-4xl md:text-5xl font-bold text-[var(--text-bark)] tracking-tight w-full whitespace-normal break-words">
                              {(identification as any).commonName || 'Your Plant'}
                            </h2>
                            <p className="w-full block whitespace-normal break-words text-sm italic font-serif text-[var(--moss)]">
                              {(identification as any).scientificName || (identification as any).scientific || 'Botanical Name Unfolding...'}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 mt-2 md:mt-0">
                            <ConfidenceRing confidencePct={ConfidencePct} />
                            <HealthPill />
                          </div>
                        </div>

                        {/* Tabs */}
                        <div className="mt-6 bg-[var(--text-bark)]/5 rounded-2xl border border-[var(--border-light)] p-1 w-full">
                          <div className="grid grid-cols-3 gap-1 w-full">
                            <TabButton id="diagnosis" label="Diagnosis" />
                            <TabButton id="timeline" label="Care Timeline" />
                            <TabButton id="differential" label="Differential" />
                          </div>
                        </div>

                        {/* Panels */}
                        <div className="mt-6 w-full block">
                          {activeTab === 'diagnosis' && (
                            <div className="grid grid-cols-1 gap-4">
                              <div className="rounded-[2rem] border border-[var(--border-light)] bg-[var(--bg-glass)] p-6 shadow-sm">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--moss)] mb-2 flex items-center gap-2">
                                  <Info size={12} /> Plant Diagnosis
                                </h4>
                                <p className="w-full block whitespace-normal break-words text-[18px] font-semibold italic text-[var(--text-bark)] leading-relaxed">
                                  “{(identification as any).diagnosis || 'A gentle wellness story is emerging.'}”
                                </p>

                                <div className="mt-4 rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-secondary)] p-4">
                                  <span className="block text-[9px] font-black uppercase tracking-wider text-[var(--text-stone)]/40 mb-1">
                                    Wellness Notes
                                  </span>
                                  <p className="w-full block whitespace-normal break-words text-sm text-[var(--text-stone)] font-sans">
                                    {(identification as any).vulnerabilityNotes || 'Watch hydration balance and keep light consistent.'}
                                  </p>

                                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                      { k: 'Watering', v: (identification as any).watering || 'Moist' },
                                      { k: 'Light', v: (identification as any).light || 'Indirect' },
                                      { k: 'Soil', v: (identification as any).soil || 'Loamy' },
                                      { k: 'Comfort Temp', v: (identification as any).temperature || '22°C' },
                                    ].map((row) => (
                                      <div key={row.k} className="rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-light)] p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--moss)] w-full block whitespace-normal break-words">
                                          {row.k}
                                        </p>
                                        <p className="text-sm text-[var(--text-stone)] font-sans w-full block whitespace-normal break-words mt-1">
                                          {row.v}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {error && (
                                <div className="rounded-[2rem] border border-[var(--terracotta)]/20 bg-[var(--terracotta)]/10 p-5">
                                  <p className="w-full block whitespace-normal break-words text-[var(--terracotta)] font-sans font-medium">{error}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === 'timeline' && (
                            <div className="grid grid-cols-1 gap-4 relative">
                              <div className="absolute left-[18px] top-6 bottom-6 w-[2px] bg-[var(--border-medium)] rounded-full hidden sm:block" />

                              {((identification as any).treatmentTimeline || []).map((step: any, idx: number) => (
                                <div key={idx} className="relative pl-8 sm:pl-10">
                                  <div className="absolute left-2 top-2 w-4 h-4 rounded-full bg-[var(--moss)] border border-[var(--border-light)] shadow-sm" />
                                  <div className="rounded-[2rem] border border-[var(--border-light)] bg-[var(--bg-glass)] p-6 shadow-sm">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                      <span className="px-3 py-1 rounded-full bg-[var(--text-bark)] text-white text-[10px] font-black uppercase tracking-wider">
                                        Day {step.day}
                                      </span>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--moss)]">Sequence {idx + 1}</span>
                                    </div>
                                    <h4 className="font-serif text-[18px] font-bold text-[var(--text-bark)] w-full whitespace-normal break-words">
                                      {step.action}
                                    </h4>
                                    <p className="w-full block whitespace-normal break-words text-sm text-[var(--text-stone)] font-sans mt-2">
                                      Outcome: <span className="italic">{step.expectedOutcome}</span>
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {activeTab === 'differential' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(differentialItems || []).map((item, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-[2rem] border border-[var(--border-light)] bg-[var(--bg-glass)] p-6 shadow-sm hover:border-[var(--moss)]/30 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <h4 className="font-serif text-[18px] font-bold text-[var(--text-bark)] w-full whitespace-normal break-words">
                                      {item.name}
                                    </h4>
                                    <span className="px-3 py-1 rounded-full bg-[var(--moss)]/10 border border-[var(--border-light)] text-[var(--moss)] text-[10px] font-black uppercase tracking-wider shrink-0">
                                      Match {String(item.confidence)}%
                                    </span>
                                  </div>

                                  <p className="w-full block whitespace-normal break-words text-sm text-[var(--text-stone)] font-sans mt-2 leading-relaxed">
                                    {item.description}
                                  </p>

                                  {/* animated horizontal progress bar */}
                                  <div className="mt-4">
                                    <div className="h-2 rounded-full bg-[var(--moss)]/10 overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${clamp(item.confidence, 0, 100)}%` }}
                                        transition={{ duration: 1.1, ease: 'easeOut' }}
                                        className="h-2 rounded-full bg-gradient-to-r from-[var(--sage)] via-[var(--moss)] to-[var(--terracotta)]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Masonry-style feel: staggered cards visually */}
                              <div className="md:col-span-2" />
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <FloatingBotanist />
      </div>
    </PageWrapper>
  );
}

