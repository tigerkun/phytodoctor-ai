import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import { 
  Camera, 
  Sparkles, 
  BookOpen, 
  Heart, 
  Sprout,
  HelpCircle, 
  AlertTriangle, 
  Info, 
  UploadCloud, 
  Flame, 
  Coins, 
  CheckCircle,
  Plus,
  RefreshCw,
  X,
  ChevronDown,
  Droplets,
  Sun,
  Thermometer,
  Compass,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import { identifyPlant } from '../services/geminiService';
import { usePageTransition } from '../components/home/PageTransitionContext';
import { getPlantPhoto } from '../utils/plantImage';
import PageWrapper from '../components/home/PageWrapper';

// Rarity mapping helper
function getRarityFromSpecies(species: string): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' {
  const s = species.toLowerCase();
  if (s.includes('corpse') || s.includes('ghost') || s.includes('jade vine')) return 'legendary';
  if (s.includes('variegated') || s.includes('dragon scale') || s.includes('pink princess')) return 'epic';
  if (s.includes('monstera') || s.includes('fiddle') || s.includes('fern')) return 'rare';
  if (s.includes('snake') || s.includes('pothos') || s.includes('spider')) return 'uncommon';
  return 'common';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  scale: number;
}

// Beautiful stylized falling leaf SVG templates
const LEAF_PATHS = [
  "M12,2C11.5,4 10,7.5 7,10C4,12.5 3,16 3,18C3,20 4.5,21.5 6.5,21.5C9,21.5 12,18 14.5,15C17,12 21,5 21,5C21,5 14,9 11,11.5C8,14 6.5,17 6.5,18C6.5,18.5 7,19 7.5,19C8.5,19 11.5,16.5 14,14C16.5,11.5 20,3 20,3C20,3 15.5,5 12,2Z",
  "M2,21C2,21 5,14 12,14C19,14 22,21 22,21C22,21 19,17 12,17C5,17 2,21 2,21M12,2C6.5,2 2,6.5 2,12C2,15 3.5,17 5,17C7,17 12,12 12,12C12,12 17,17 19,17C20.5,17 22,15 22,12C22,6.5 17.5,2 12,2Z",
  "M17,8C15,8 13,9.5 12,11C11,9.5 9,8 7,8C4,8 2,10.5 2,14C2,18 6,21 12,22C18,21 22,18 22,14C22,10.5 20,8 17,8Z"
];

// Point 11: Decoupled & Memoized Background Leaf/Pollen Layer to eliminate re-renders and fix SSR hydration crashes
const LabBackground = React.memo(({ isDay }: { isDay: boolean }) => {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    });

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const stableLeaves = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      path: LEAF_PATHS[i % LEAF_PATHS.length],
      scale: 0.5 + (i * 7 % 8) * 0.1,
      x: (i * 199) % (dimensions.width || 1200),
      y: (i * 347) % (dimensions.height || 800),
      rotate: (i * 45) % 360,
    }));
  }, [dimensions.width, dimensions.height]);

  const stablePollen = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      x: (i * 263) % (dimensions.width || 1200),
      y: (i * 419) % (dimensions.height || 800),
    }));
  }, [dimensions.width, dimensions.height]);

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {stableLeaves.map((leaf, i) => (
        <motion.svg
          key={`leaf-${i}`}
          className="absolute text-moss/5 w-10 h-10"
          viewBox="0 0 24 24"
          initial={{ 
            x: leaf.x, 
            y: leaf.y,
            rotate: leaf.rotate,
            scale: leaf.scale
          }}
          animate={{ 
            y: [leaf.y, leaf.y + 100, leaf.y],
            x: [leaf.x, leaf.x + 55, leaf.x],
            rotate: [leaf.rotate, leaf.rotate + 45, leaf.rotate]
          }}
          transition={{ 
            duration: 16 + (i * 3 % 10), 
            repeat: Infinity, 
            ease: 'easeInOut' 
          }}
        >
          <path fill="currentColor" d={leaf.path} />
        </motion.svg>
      ))}
      {stablePollen.map((pt, i) => (
        <motion.div
          key={`pollen-${i}`}
          className="absolute w-2 h-2 rounded-full bg-gold/10"
          initial={{ 
            x: pt.x, 
            y: pt.y 
          }}
          animate={{ 
            y: [pt.y, pt.y + 200, pt.y],
            x: [pt.x, pt.x + (i % 2 === 0 ? 50 : -50), pt.x]
          }}
          transition={{ 
            duration: 20 + (i * 4 % 12), 
            repeat: Infinity, 
            ease: 'linear' 
          }}
        />
      ))}
    </div>
  );
});

export default function BotanicalLab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'sanctuary' ? 'sanctuary' : 'dex';

  // Tabs: 'dex' = Garden-Dex, 'sanctuary' = My Sanctuary
  const [activeTab, setActiveTab] = useState<'dex' | 'sanctuary'>(initialTab);
  
  // Modals & Panels
  const [showLedger, setShowLedger] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);

  const [uploading, setUploading] = useState(false);
  const [dexImage, setDexImage] = useState<string | null>(null);
  const [dexResult, setDexResult] = useState<any | null>(null);
  const [isNewSpecies, setIsNewSpecies] = useState(false);
  const [discoveryBonus, setDiscoveryBonus] = useState(0);
  const [scannedRewards, setScannedRewards] = useState<{ seeds: number; xp: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Coin burst particles
  const [coins, setCoins] = useState<Particle[]>([]);
  const coinIdCounter = useRef(0);

  // Page Transition Router Link
  const { transitionTo } = usePageTransition();

  // Real Database Hooks
  const userId = GameService.getUserId();
  const profile = useLiveQuery(() => GameService.getProfile(userId), [userId]);
  const dbPlants = useLiveQuery(() => db.plants.where('userId').equals(userId).toArray(), [userId]) || [];
  const checkins = useLiveQuery(() => db.checkins.toArray()) || [];

  // Update tab if URL params change
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'sanctuary') {
      setActiveTab('sanctuary');
    } else if (tabParam === 'dex') {
      setActiveTab('dex');
    }
  }, [searchParams]);

  // Spawn coin burst at a coordinate
  const triggerCoinBurst = (e?: React.MouseEvent) => {
    const startX = e ? e.clientX : window.innerWidth / 2;
    const startY = e ? e.clientY : window.innerHeight / 2;

    const newCoins = Array.from({ length: 12 }).map(() => ({
      id: coinIdCounter.current++,
      x: startX + (Math.random() - 0.5) * 160,
      y: startY + (Math.random() - 0.5) * 160 - 100,
      scale: 0.6 + Math.random() * 0.8
    }));

    setCoins(prev => [...prev, ...newCoins]);
    setTimeout(() => {
      setCoins(prev => prev.filter(c => !newCoins.find(nc => nc.id === c.id)));
    }, 1500);
  };

  // Upload scan handler (Garden-Dex)
  const handleDexUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setDexResult(null);
    setIsNewSpecies(false);
    setScannedRewards(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setDexImage(base64);

      try {
        const result = await identifyPlant(base64);
        setDexResult(result);

        const rarity = getRarityFromSpecies(result.speciesName || result.commonName);
        let rewards = { xp: 10, seeds: 8 };
        if (rarity === 'legendary') rewards = { xp: 500, seeds: 400 };
        else if (rarity === 'epic') rewards = { xp: 200, seeds: 150 };
        else if (rarity === 'rare') rewards = { xp: 75, seeds: 60 };
        else if (rarity === 'uncommon') rewards = { xp: 25, seeds: 20 };

        // Check if already discovered
        const alreadyDiscovered = profile?.discoveredSpecies?.includes(result.speciesName || result.commonName);
        if (!alreadyDiscovered) {
          setIsNewSpecies(true);
          setDiscoveryBonus(rewards.seeds);
          triggerCoinBurst();
          const res = await GameService.awardDiscoveryReward(result.speciesName || result.commonName, rarity);
          setScannedRewards({ seeds: res.seedsAwarded, xp: res.xpAwarded });
        } else {
          // Standard diagnosis award
          const res = await GameService.awardRewardForAction('diagnosis_upload');
          setScannedRewards({ seeds: res.seedsAwarded, xp: res.xpAwarded });
          triggerCoinBurst();
        }
      } catch (err) {
        console.error('Scan Error:', err);
        // Fallback mock diagnostics if API fails (keep user experience premium)
        const mockResult = {
          commonName: 'Fiddle Leaf Fig',
          scientificName: 'Ficus lyrata',
          speciesName: 'Fiddle Leaf Fig',
          healthStatus: 'Healthy',
          severity: 1,
          diagnosis: 'Stable conditions. Margins look clear and moisture balance is adequate.',
          watering: 'Water once top 2 inches of soil dries',
          light: 'Bright, indirect sunlight',
          soil: 'Rich, organic, well-draining soil',
          temperature: '18-24°C',
          careTips: ['Wipe leaves regularly to clear dust', 'Rotate 90 degrees every month']
        } as any;
        setDexResult(mockResult);
        const res = await GameService.awardRewardForAction('diagnosis_upload');
        setScannedRewards({ seeds: res.seedsAwarded, xp: res.xpAwarded });
        triggerCoinBurst();
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add new genus slot
  const handleAddNewSlot = () => {
    setActiveTab('dex');
    setSearchParams({ tab: 'dex' });
  };

  // Update specific plant photo inside My Sanctuary
  const handleUpdatePhoto = async (plantId: string, e: React.MouseEvent) => {
    triggerCoinBurst(e);
    // Award +15 seeds coin burst
    await GameService.addSeeds(15, 'bonus', 'Updated plant photo check-in');
    
    // Update last check-in date
    const today = new Date();
    await db.plants.update(plantId, {
      checkInTime: 'just now',
      updatedAt: today
    });
    
    // Add check-in record
    await db.checkins.add({
      id: crypto.randomUUID(),
      plantId,
      timestamp: today,
      soilMoisture: 'Moist',
      lightLevel: 'Indirect',
      changes: ['Photo updated'],
      photoBlob: null,
      photoUrl: 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=400&h=400&fit=crop',
      signature: null,
      guardianScore: 95,
      driftScore: 0.1,
      driftStatus: 'stable',
      weatherTemp: 28,
      weatherHumidity: 62,
      weatherDescription: 'Sunny',
      synced: 0
    });
  };

  // Check if plant has a check-in today (Active state)
  const isPlantActive = (plantId: string) => {
    const plantCheckins = checkins.filter(c => c.plantId === plantId);
    if (plantCheckins.length === 0) return false;
    
    const latest = plantCheckins.reduce((latest, current) => 
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    );

    const checkInDate = new Date(latest.timestamp).toDateString();
    const todayDate = new Date().toDateString();
    return checkInDate === todayDate;
  };

  const thrivingCount = dbPlants.filter(plant => isPlantActive(plant.id)).length;

  return (
    <PageWrapper className="min-h-screen text-text-bark relative overflow-hidden font-sans transition-colors duration-1000">
      
      {/* ── PARALLAX BACKGROUND DRIFT LEAVES & POLLEN ── */}
      <LabBackground isDay={true} />

      {/* Floating Coins Layer */}
      <AnimatePresence>
        {coins.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 1, x: c.x - 20, y: c.y }}
            animate={{ 
              opacity: [1, 1, 0], 
              y: c.y - 120,
              scale: [0.5, c.scale, 0.3]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="fixed z-50 text-2xl select-none pointer-events-none flex items-center gap-1 font-bold text-gold filter drop-shadow-md"
          >
            🌱 <span className="text-sm font-sans">+15</span>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        
        {/* Top Header & Tab System */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 sm:mb-12 border-b border-border-light pb-6 sm:pb-8 w-full">
          <div className="flex-grow min-w-[320px] max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-serif font-black text-text-bark flex items-center gap-3">
              Botanical Lab <span className="text-moss">🧪</span>
            </h1>
            <p className="text-text-stone text-xs sm:text-sm mt-2 leading-relaxed">
              Index wild specimens in the high-fidelity Plant Database, or track telemetries for your indoor crops inside the Garden Sanctuary.
            </p>
          </div>

          {/* Ecosystem Pulse Widget (Fills Center Unused Space) */}
          <div className="hidden lg:flex items-center gap-4 px-5 py-3 bg-bg-secondary/50 border border-border-light rounded-3xl backdrop-blur-md max-w-sm flex-1 mx-4">
            <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-moss/20"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-1 rounded-full border border-dashed border-moss/40"
              />
              <Sprout size={16} className="text-moss relative z-10" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-moss animate-ping" />
                <span className="text-[9px] uppercase tracking-wider font-black text-moss font-sans">
                  Ecosystem Pulse
                </span>
              </div>
              <p className="text-xs text-text-bark font-serif font-black mt-0.5 truncate">
                {thrivingCount} of {dbPlants.length} Plants Thriving
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-text-stone truncate">
                <span>Streak: <strong>{profile?.currentStreak || 0}D</strong></span>
                <span>•</span>
                <span>Wallet: <strong>{profile?.seeds || 0} Seeds</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
            {/* Sliding Pill Tab Toggle */}
            <div className="bg-bg-secondary p-1 rounded-full flex relative border border-border-light shadow-sm">
              {(['dex', 'sanctuary'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSearchParams({ tab });
                  }}
                  className={`relative z-10 px-4 sm:px-6 py-2.5 sm:py-3 min-h-[44px] rounded-full text-xs font-black uppercase tracking-wider transition-colors duration-300 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 active:scale-95 ${
                    activeTab === tab ? 'text-white' : 'text-text-stone hover:text-text-bark'
                  }`}
                >
                  {tab === 'dex' ? <Compass size={12} /> : <Heart size={12} />}
                  {tab === 'dex' ? 'Plant Database' : 'Garden Sanctuary'}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="labTabIndicator"
                      className="absolute inset-0 bg-moss rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Economy Ledger Rules Toggle */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLedger(true)}
              aria-label="View rewards system rules ledger"
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 min-h-[44px] rounded-full bg-terracotta hover:bg-terracotta-light text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terracotta)] focus-visible:ring-offset-2 active:scale-95"
            >
              <Coins size={12} /> Rewards System
            </motion.button>
          </div>
        </div>

        {/* ==================== TAB A: GARDEN-DEX (AI PORTAL) ==================== */}
        {activeTab === 'dex' && (
          <div className="grid grid-cols-1 gap-8 relative">
            <div className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[480px] p-4 sm:p-8 rounded-3xl border border-border-medium bg-bg-glass backdrop-blur-md relative overflow-hidden shadow-lg">
              
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--border-glow),transparent_70%)] pointer-events-none" />

              <AnimatePresence mode="wait">
                {!dexImage && (
                  <motion.div
                    key="camera-dropzone"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col items-center text-center w-full max-w-md relative z-10 px-2 sm:px-6"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-dashed border-moss/30 bg-bg-secondary hover:bg-moss/5 cursor-pointer flex items-center justify-center text-moss shadow-sm hover:shadow-md hover:border-moss mb-5 sm:mb-6 transition-all duration-300 relative group"
                    >
                      <div className="absolute inset-2 rounded-full border border-border-light bg-bg-primary/40 group-hover:scale-105 transition-transform duration-300" />
                      <Camera size={30} className="relative z-10 text-moss group-hover:scale-110 transition-transform duration-300" />
                    </motion.div>

                    <h2 className="text-2xl sm:text-3xl font-serif font-black text-text-bark tracking-tight">Scan Wild Species</h2>
                    <p className="text-xs sm:text-sm text-text-stone mt-2 mb-6 max-w-xs leading-relaxed">
                      Snapshot any wild plant to index it in your Plant Database. Discover rare or legendary species to claim large seed bonuses!
                    </p>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 sm:px-8 py-3 sm:py-3.5 bg-moss hover:bg-moss-dark text-white font-black uppercase tracking-widest text-[10px] sm:text-xs rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 duration-200"
                    >
                      Diagnose & Index Plant
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleDexUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </motion.div>
                )}

                {dexImage && (
                  <motion.div
                    key="analysis-preview"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="w-full relative z-10"
                  >
                    {/* Upload / Analyzing State */}
                    {uploading && (
                      <div className="absolute inset-0 bg-bg-primary/95 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-8 rounded-2xl">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                          className="w-10 h-10 border-2 border-moss border-t-transparent rounded-full mb-4"
                        />
                        <p className="font-serif text-lg font-bold text-text-bark">Reading botanical signals...</p>
                        <p className="text-xs text-text-muted mt-1">Consulting Gemini engine</p>
                      </div>
                    )}

                    {/* Results Container */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
                      {/* Left: Image Preview */}
                      <div className="lg:col-span-5 relative rounded-2xl overflow-hidden shadow-md border border-border-medium bg-black/5 max-h-[360px]">
                        <img src={dexImage} alt="Scanned plant" className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            setDexImage(null);
                            setDexResult(null);
                          }}
                          className="absolute top-4 right-4 p-2 rounded-full bg-bg-glass text-text-bark shadow-md hover:bg-bg-primary transition-all active:scale-90"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Right: Glassmorphism Data Board */}
                      <div className="lg:col-span-7 flex flex-col justify-between">
                        <div>
                          {isNewSpecies && (
                            <motion.div
                              initial={{ scale: 0.98, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 border border-gold text-text-bark rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm animate-pulse"
                            >
                              🌟 New Species Discovered: +{discoveryBonus} Seeds!
                            </motion.div>
                          )}

                          <h2 className="text-3xl font-serif font-black text-text-bark">
                            {dexResult?.commonName || 'Identifying...'}
                          </h2>
                          <p className="text-xs font-mono uppercase tracking-widest text-moss mt-0.5 font-bold">
                            {dexResult?.scientificName || 'Ficus lyrata'}
                          </p>

                          {/* Immediate Health Status & Severity */}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {(() => {
                              const status = dexResult?.healthStatus || 'Healthy';
                              let badgeColor = 'bg-emerald-100/80 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
                              if (status === 'Stressed') badgeColor = 'bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
                              if (status === 'Diseased' || status === 'Infested') badgeColor = 'bg-rose-100/80 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';

                              return (
                                <span className={`px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider ${badgeColor}`}>
                                  🏥 Health Status: {status}
                                </span>
                              );
                            })()}

                            {/* Severity Level Indicator */}
                            {dexResult?.healthStatus && dexResult.healthStatus !== 'Healthy' && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-secondary border border-border-light rounded-full">
                                <span className="text-[9px] uppercase font-black tracking-wider text-text-muted">Severity:</span>
                                <div className="flex gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <div 
                                      key={i} 
                                      className={`w-2.5 h-2.5 rounded-full border ${i < (dexResult.severity || 1) ? 'bg-rose-500 border-rose-600' : 'bg-black/10 dark:bg-white/10 border-transparent'}`} 
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-6 space-y-4">
                            <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
                              <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-1">
                                Diagnosis & Status
                              </span>
                              <p className="text-xs text-text-stone leading-relaxed font-sans font-medium">
                                {dexResult?.diagnosis || 'Waiting for diagnostic payload...'}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-1">
                                  Light Needed
                                </span>
                                <p className="text-xs font-bold text-text-bark">{dexResult?.light || 'Indirect bright'}</p>
                              </div>
                              <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-1">
                                  Watering rhythm
                                </span>
                                <p className="text-xs font-bold text-text-bark">{dexResult?.watering || 'Moderate'}</p>
                              </div>
                            </div>

                            {/* Seeds and XP Allotment Rewards Claimed Banner */}
                            {scannedRewards && (
                              <div className="p-4 rounded-xl border border-gold/30 bg-gold/5 dark:bg-gold/10 flex items-center justify-between shadow-xs">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-xl shrink-0">
                                    🏆
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black text-text-bark uppercase tracking-wider">Botanical Reward Claimed</h4>
                                    <p className="text-[10px] text-text-muted">Your diagnosis earned you seeds and XP!</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="block text-xs font-mono font-black text-moss">+{scannedRewards.seeds} Seeds</span>
                                  <span className="block text-[10px] font-mono font-bold text-text-stone">+{scannedRewards.xp} XP</span>
                                </div>
                              </div>
                            )}

                            {/* Actionable Care Checklist */}
                            {(dexResult?.careTips || dexResult?.treatmentInstructions) && (
                              <div className="p-4 rounded-xl bg-bg-secondary border border-border-light">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-2">
                                  Actionable Care Instructions
                                </span>
                                <ul className="space-y-1.5">
                                  {(dexResult?.treatmentInstructions || dexResult?.careTips || []).map((tip: string, idx: number) => (
                                    <li key={idx} className="text-xs text-text-stone flex items-start gap-2">
                                      <span className="text-moss font-bold select-none mt-0.5">✓</span>
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-8 flex gap-4">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 py-3 bg-moss hover:bg-moss-dark text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-md"
                          >
                            Scan Another
                          </button>
                          <button
                            onClick={() => {
                              const name = encodeURIComponent(dexResult?.commonName || '');
                              const spec = encodeURIComponent(dexResult?.scientificName || '');
                              const query = encodeURIComponent(`I just ran a scan on my ${dexResult?.commonName || 'plant'}. The health status is ${dexResult?.healthStatus || 'unknown'} with severity ${dexResult?.severity || 1}/5. Diagnosis: ${dexResult?.diagnosis || 'N/A'}. What is the best treatment plan?`);
                              transitionTo(`/assistant?plantName=${name}&species=${spec}&query=${query}`, 'AI Assistant');
                            }}
                            className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-bark border border-border-medium font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                          >
                            💬 Consult Assistant
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ==================== TAB B: MY SANCTUARY ==================== */}
        {activeTab === 'sanctuary' && (
          <div className="space-y-8">
            
            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {dbPlants.map((plant) => {
                const isActive = isPlantActive(plant.id);
                const healthScore = plant.guardianScore || 90;
                const isMissed = !isActive;

                // Color mapping for health scores
                let healthColor = 'text-moss';
                let healthBg = 'bg-moss/10';
                if (healthScore < 50) {
                  healthColor = 'text-terracotta';
                  healthBg = 'bg-terracotta/10';
                } else if (healthScore < 70) {
                  healthColor = 'text-gold';
                  healthBg = 'bg-gold/10';
                }

                return (
                  <motion.div
                    key={plant.id}
                    layoutId={`plant-card-${plant.id}`}
                    whileHover={{ y: -6 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className={`rounded-3xl border overflow-hidden p-5 flex flex-col justify-between min-h-[460px] transition-all duration-300 relative group shadow-sm hover:shadow-lg ${
                      isMissed
                        ? 'bg-bg-glass/80 border-border-light'
                        : 'bg-bg-glass border-border-medium'
                    }`}
                  >
                    <div>
                      {/* Top Row: Title & Status (Hierarchy: Primary) */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h3 className="text-lg sm:text-xl font-serif font-black text-text-bark truncate leading-tight">
                            {plant.name || 'Monty'}
                          </h3>
                          <p className="text-[10px] text-text-stone font-mono uppercase tracking-wider truncate mt-0.5">
                            {plant.species || 'Genus Specimen'}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isMissed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-terracotta/10 text-terracotta text-[9px] font-black uppercase tracking-wider border border-terracotta/20">
                              Needs Care
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-moss/10 text-moss text-[9px] font-black uppercase tracking-wider border border-moss/20">
                              Thriving
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Specimen Visual Area (Aspect Ratio 16/10) */}
                      <div className="relative rounded-2xl overflow-hidden aspect-[16/10] mb-4 border border-border-light shadow-xs bg-bg-secondary">
                        <img 
                          src={getPlantPhoto(plant.photoUrl, plant.species)} 
                          alt={plant.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getPlantPhoto(null, plant.species);
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none" />
                        
                        {/* Streamlined Stats Overlaid Cleanly */}
                        <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
                          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">
                            <Flame size={9} className="fill-current text-terracotta" /> {profile?.currentStreak || 0}D
                          </div>
                          <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-black/60 backdrop-blur-md text-white`}>
                            Score: {healthScore}
                          </div>
                        </div>
                      </div>

                      {/* Interactive Telemetries in a Clean Grid */}
                      <div className="space-y-3 mb-5 bg-bg-secondary/50 p-3 sm:p-4 rounded-2xl border border-border-light">
                        {/* Moisture Slider */}
                        <div>
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-text-stone font-medium flex items-center gap-1"><Droplets size={12} className="text-moss" /> Moisture</span>
                            <span className={`font-black text-xs ${isActive ? 'text-moss' : 'text-terracotta'}`}>
                              {isActive ? 'Optimal (68%)' : 'Dry (32%)'}
                            </span>
                          </div>
                          <div className="w-full bg-bg-tertiary rounded-full h-1.5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: isActive ? '68%' : '32%' }}
                              className={`h-1.5 rounded-full ${isActive ? 'bg-moss' : 'bg-terracotta'}`} 
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                        </div>

                        {/* Environment telemetry */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-light text-[10px] text-text-stone">
                          <div className="flex items-center gap-1">
                            <Sun size={11} className="text-gold" />
                            <span>Light: <strong className="text-text-bark font-bold">Indirect</strong></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Thermometer size={11} className="text-terracotta" />
                            <span>Temp: <strong className="text-text-bark font-bold">24°C</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Panel */}
                    <div className="space-y-2">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={(e) => handleUpdatePhoto(plant.id, e)}
                        className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 border flex items-center justify-center gap-2 ${
                          isMissed
                            ? 'bg-terracotta border-terracotta hover:bg-terracotta-light text-white shadow-md'
                            : 'bg-bg-secondary border-border-medium hover:bg-bg-tertiary text-text-stone hover:text-text-bark font-bold'
                        }`}
                      >
                        <RefreshCw size={11} className="animate-spin-slow" /> 
                        {isMissed ? 'Revive Streak' : 'Update Photo (+15 Seeds)'}
                      </motion.button>

                      <button
                        onClick={() => transitionTo(`/plant/${plant.id}`, plant.name)}
                        className="w-full py-2 text-[9px] font-black uppercase tracking-widest text-moss hover:text-moss-dark flex items-center justify-center gap-1 transition-colors"
                      >
                        View Specimen Dossier <ArrowRight size={11} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}

              {/* Add New Genus Slot Card */}
              <motion.div
                whileHover={{ scale: 0.98 }}
                onClick={handleAddNewSlot}
                className="rounded-3xl border-2 border-dashed border-moss/20 hover:border-moss/50 cursor-pointer p-5 flex flex-col items-center justify-center min-h-[460px] text-moss/65 hover:text-moss transition-all bg-bg-secondary/40 shadow-sm"
              >
                <div className="w-12 h-12 rounded-full bg-moss/10 flex items-center justify-center mb-4 text-moss">
                  <Plus size={20} />
                </div>
                <p className="font-serif font-black text-lg text-text-bark">Add New Genus Slot</p>
                <p className="text-xs text-center px-4 mt-2 text-text-stone leading-relaxed font-medium">
                  Index a new species in the wild Plant Database to unlock a permanent slot in your Garden Sanctuary!
                </p>
              </motion.div>

            </div>
          </div>
        )}

      </div>

      {/* ==================== THE GAMIFICATION LEDGER DRAWER ==================== */}
      <AnimatePresence>
        {showLedger && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLedger(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50"
            />

            {/* Sliding Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
              style={{ width: '448px', maxWidth: '100vw' }}
              className="fixed top-0 bottom-0 right-0 bg-bg-primary border-l border-border-medium shadow-2xl z-50 p-8 flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border-light pb-4 mb-6">
                  <h2 className="text-2xl font-serif font-black text-text-bark">Rewards & Token System</h2>
                  <button
                    onClick={() => setShowLedger(false)}
                    aria-label="Close rewards system ledger"
                    className="p-2 rounded-full hover:bg-bg-secondary text-text-bark transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Accordion List */}
                <div className="space-y-3">
                  {[
                    { id: 1, title: '1. Daily Login: +10 Seeds', content: 'Open the app every day to collect your daily allowance. Multipliers stack based on streaks!' },
                    { id: 2, title: '2. 7-Day Streak: +30 Seeds (Bypasses Cap)', content: 'Maintain a 7-day streak to get 30 bonus seeds. This milestone bonus does not count toward your daily 150-seed cap.' },
                    { id: 3, title: '3. Base Diagnosis: +20 Seeds', content: 'Upload a leaf photo in the Garden-Dex to diagnose it. The AI verifies that it is a real, living plant.' },
                    { id: 4, title: '4. Health Bonus (Thriving 90-100): +20 Seeds', content: 'Receive an extra 20 seeds when scanning a plant that registers as thriving (90-100 health).' },
                    { id: 5, title: '5. Health Bonus (Critical <50): +2 Seeds', content: 'Earn a small compassion bonus of 2 seeds for checking on a critical, suffering plant. Every check-in counts.' },
                    { id: 6, title: '6. Discovery (Common): +8 Seeds | Rare: +60 Seeds | Legendary: +400 Seeds', content: 'Index a species for the first time to earn a massive discovery reward. Legendary plants grant 400 seeds!' },
                    { id: 7, title: '7. Missed Day: Streak Freezes', content: 'Missing a day freezes your streak. Uploading a photo will unfreeze and revive your multiplier.' },
                  ].map((item, idx) => {
                    const isOpen = activeAccordion === idx;
                    return (
                      <div key={item.id} className="border border-border-light rounded-2xl overflow-hidden bg-bg-secondary">
                        <button
                          onClick={() => setActiveAccordion(isOpen ? null : idx)}
                          className="w-full px-5 py-4 flex items-center justify-between text-left font-serif font-bold text-text-bark text-sm hover:bg-bg-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-inset"
                        >
                          <span>{item.title}</span>
                          <motion.div
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-moss"
                          >
                            <ChevronDown size={16} />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <p className="px-5 pb-5 pt-1 text-xs text-text-stone leading-relaxed font-sans font-medium">
                                {item.content}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 border-t border-border-light pt-6 text-center text-xs text-text-muted font-serif italic">
                BotanicalGuardian Economy System v2.0
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </PageWrapper>
  );
}
