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
import StreakPopup from '../components/game/StreakPopup';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import { identifyPlant } from '../services/geminiService';
import { usePageTransition } from '../components/home/PageTransitionContext';
import { getPlantPhoto } from '../utils/plantImage';
import PageWrapper from '../components/home/PageWrapper';
import { useGeolocation } from '../hooks/useGeolocation';
import { fetchWeather } from '../utils/weatherIntegration';
import { updateUploadStreak } from '../game/rewardUtils';

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



export default function BotanicalLab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'sanctuary' ? 'sanctuary' : 'dex';

  // Tabs: 'dex' = Garden-Dex, 'sanctuary' = My Sanctuary
  const [activeTab, setActiveTab] = useState<'dex' | 'sanctuary'>(initialTab);
  
  // Modals & Panels
  const [showLedger, setShowLedger] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);

  const [scanMode, setScanMode] = useState<'consult' | 'index'>('consult');
  const [magnification, setMagnification] = useState<'10x' | '40x' | '100x'>('40x');
  
  const [streakPopupData, setStreakPopupData] = useState<{ streak: number, seeds: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dexImage, setDexImage] = useState<string | null>(null);
  const [dexResult, setDexResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isNewSpecies, setIsNewSpecies] = useState(false);
  const [discoveryBonus, setDiscoveryBonus] = useState(0);
  const [scannedRewards, setScannedRewards] = useState<{ seeds: number; xp: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [coins, setCoins] = useState<Particle[]>([]);
  const coinIdCounter = useRef(0);

  // Update logic state
  const updatePhotoInputRef = useRef<HTMLInputElement>(null);
  const [updatingPlantId, setUpdatingPlantId] = useState<string | null>(null);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);

  const { transitionTo } = usePageTransition();

  const userId = GameService.getUserId();
  const profile = useLiveQuery(() => GameService.getProfile(userId), [userId]);
  const dbPlants = useLiveQuery(() => db.plants.where('userId').equals(userId).toArray(), [userId]) || [];
  const checkins = useLiveQuery(() => db.checkins.toArray()) || [];

  const { location, city } = useGeolocation();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'sanctuary') {
      setActiveTab('sanctuary');
    } else if (tabParam === 'dex') {
      setActiveTab('dex');
    }
  }, [searchParams]);

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

  const resetDexScan = (openPicker = true) => {
    setDexImage(null);
    setDexResult(null);
    setUploading(false);
    setIsNewSpecies(false);
    setScannedRewards(null);
    setScanError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (openPicker) {
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 50);
    }
  };

  const handleIndexSpecimen = async (resultToUse?: any, photoUrl?: string) => {
    const target = resultToUse || dexResult;
    const photo = photoUrl || dexImage;
    if (!target || !photo) return;
    const species = target.speciesName || target.scientificName || target.commonName;
    const rarity = getRarityFromSpecies(species);

    const plant = await GameService.indexScannedPlant({
      photoUrl: photo,
      species,
      commonName: target.commonName || species,
      healthStatus: target.healthStatus,
      severity: target.severity,
      diagnosis: target.diagnosis,
      watering: target.watering,
      light: target.light,
      temperature: target.temperature,
    }, userId);

    const alreadyDiscovered = profile?.discoveredSpecies?.includes(species);
    let resSeeds = 0;
    if (!alreadyDiscovered) {
      setIsNewSpecies(true);
      triggerCoinBurst();
      const res = await GameService.awardDiscoveryReward(species, rarity);
      const streakRes = await updateUploadStreak(userId);
      if (streakRes.continuedToday) {
        setStreakPopupData({ streak: streakRes.currentStreak, seeds: res.seedsAwarded });
      }
      setScannedRewards({ seeds: res.seedsAwarded, xp: res.xpAwarded });
      resSeeds = res.seedsAwarded;
    } else {
      const res = await GameService.awardRewardForAction('diagnosis_upload');
      const streakRes = await updateUploadStreak(userId);
      if (streakRes.continuedToday) {
        setStreakPopupData({ streak: streakRes.currentStreak, seeds: res.seedsAwarded });
      }
      setScannedRewards({ seeds: res.seedsAwarded, xp: res.xpAwarded });
      triggerCoinBurst();
    }

    await GameService.generateCardForPlant(plant.id, userId);
    if (!alreadyDiscovered) setDiscoveryBonus(resSeeds);
  };

  const handleDexUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setDexResult(null);
    setScanError(null);
    setIsNewSpecies(false);
    setScannedRewards(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setDexImage(base64);

      try {
        let locationCtx: any;
        if (location?.latitude && location?.longitude) {
            locationCtx = { city, latitude: location.latitude, longitude: location.longitude };
        } else if (city) {
            locationCtx = { city };
        }

        const result = await identifyPlant(base64, locationCtx);
        setDexResult(result);

        if (scanMode === 'index') {
          await handleIndexSpecimen(result, base64);
        }
      } catch (err: any) {
        console.error('Scan Error:', err);
        setScanError(err.message || 'Failed to identify plant.');
        setDexImage(null);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetPlantId = updatingPlantId;
    if (!file || !targetPlantId) return;

    setIsUpdatingPhoto(true);
    setScanError(null);

    const reader = new FileReader();
    reader.onerror = () => {
      setScanError("Failed to read the selected photo file.");
      setIsUpdatingPhoto(false);
      setUpdatingPlantId(null);
    };

    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const result = await identifyPlant(base64);
        const plant = await db.plants.get(targetPlantId);
        if (!plant) throw new Error("Specimen record not found in Sanctuary.");

        const resultSpecies = result.speciesName || result.commonName;
        const oldGenus = (plant.species || '').split(' ')[0].toLowerCase();
        const newGenus = (resultSpecies || '').split(' ')[0].toLowerCase();
        
        if (oldGenus && newGenus && oldGenus !== newGenus && !resultSpecies.toLowerCase().includes(oldGenus)) {
          setScanError(`Identification mismatch: specimen appears to be ${resultSpecies}, differing from registered ${plant.species}.`);
          return;
        }

        await GameService.addSeeds(15, 'bonus', 'Updated plant photo check-in');
        const streakRes = await updateUploadStreak(userId);
        if (streakRes.continuedToday) {
          setStreakPopupData({ streak: streakRes.currentStreak, seeds: 15 });
        }
        triggerCoinBurst();
        
        const today = new Date();
        await db.plants.update(targetPlantId, {
          checkInTime: 'just now',
          updatedAt: today,
          photoUrl: base64
        });
        
        await db.checkins.add({
          id: crypto.randomUUID(),
          plantId: targetPlantId,
          timestamp: today,
          soilMoisture: 'Moist',
          lightLevel: 'Indirect',
          changes: ['Photo updated via Wet Lab'],
          photoBlob: null,
          photoUrl: base64,
          signature: null,
          guardianScore: 95,
          driftScore: 0.1,
          driftStatus: 'stable',
          weatherTemp: 25,
          weatherHumidity: 50,
          weatherDescription: 'Sunny',
          synced: 0
        });
      } catch (err: any) {
        console.error("Specimen update error:", err);
        setScanError(err.message || "Failed to process specimen update photo.");
      } finally {
        setIsUpdatingPhoto(false);
        setUpdatingPlantId(null);
        if (updatePhotoInputRef.current) {
          updatePhotoInputRef.current.value = '';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdatePhoto = (plantId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingPlantId(plantId);
    updatePhotoInputRef.current?.click();
  };

  const handleAddNewSlot = () => {
    setActiveTab('dex');
    setSearchParams({ tab: 'dex' });
    setScanMode('index');
    resetDexScan();
  };

  const isPlantActive = (plantId: string) => {
    const plantCheckins = checkins.filter(c => c.plantId === plantId);
    if (plantCheckins.length === 0) return false;
    const latest = plantCheckins.reduce((latest, current) => 
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    );
    return new Date(latest.timestamp).toDateString() === new Date().toDateString();
  };

  const sanctuaryPlants = useMemo(() => {
    const byType = new Map<string, (typeof dbPlants)[number]>();
    for (const plant of dbPlants) {
      if (plant.isDemo) continue;
      const key = (plant.species || plant.name || plant.id).toLowerCase();
      const prev = byType.get(key);
      if (!prev || new Date(plant.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
        byType.set(key, plant);
      }
    }
    return [...byType.values()];
  }, [dbPlants]);

  return (
    <PageWrapper className="min-h-screen skin-lab text-text-bark relative overflow-hidden font-sans transition-colors duration-1000">
      <AnimatePresence>
        {coins.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 1, x: c.x - 20, y: c.y }}
            animate={{ opacity: [1, 1, 0], y: c.y - 120, scale: [0.5, c.scale, 0.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="fixed z-50 text-2xl select-none pointer-events-none flex items-center gap-1 font-bold text-gold filter drop-shadow-md"
          >
            🌱 <span className="text-sm font-sans">+15</span>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 sm:mb-12 border-b border-border-light pb-6 sm:pb-8 w-full">
          <div className="flex-grow min-w-[320px] max-w-2xl">
            <p className="lab-kicker mb-2">Expedition Wet Lab · Microscope Bench № 02</p>
            <h1 className="text-3xl sm:text-4xl font-serif font-black text-text-bark flex items-center gap-3">
              Botanical Lab <span className="text-moss">🔬</span>
            </h1>
            <p className="text-text-stone text-xs sm:text-sm mt-2 leading-relaxed">
              Precision optical inspection, clinical disease diagnosis, and specimen slide registry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
            <div className="bg-bg-secondary p-1 rounded-full flex relative border border-border-light shadow-sm">
              {(['dex', 'sanctuary'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setSearchParams({ tab }); }}
                  className={`relative z-10 px-4 sm:px-6 py-2.5 sm:py-3 min-h-[44px] rounded-full text-xs font-black uppercase tracking-wider transition-colors duration-300 flex items-center gap-2 ${
                    activeTab === tab ? 'text-white' : 'text-text-stone hover:text-text-bark'
                  }`}
                >
                  {tab === 'dex' ? <Compass size={12} /> : <Heart size={12} />}
                  {tab === 'dex' ? 'Plant Database' : 'Garden Sanctuary'}
                  {activeTab === tab && <motion.div layoutId="labTabIndicator" className="absolute inset-0 bg-moss rounded-full -z-10" />}
                </button>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLedger(true)}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 min-h-[44px] rounded-full bg-terracotta hover:bg-terracotta-light text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shrink-0"
            >
              <Coins size={12} /> Rewards
            </motion.button>
          </div>
        </div>

        {activeTab === 'dex' && (
          <div className="grid grid-cols-1 gap-8 relative">
            <div className="dissection-board flex flex-col items-center justify-center min-h-[420px] p-4 sm:p-8 rounded-3xl relative overflow-hidden border border-[#3d6b4a]/25 dark:border-[#8fb58f]/20 shadow-md">
              {/* Dissection Bench Calibration Scale Header */}
              <div className="w-full flex items-center justify-between pb-3 mb-6 border-b border-[#3d6b4a]/15 dark:border-[#8fb58f]/15 text-[9px] font-mono uppercase tracking-[0.2em] text-[#3d6b4a] dark:text-[#8fb58f]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#b89552] border border-[#7a602f] shadow-xs" />
                  <span>1mm BOTANICAL COORDINATE GRID · BENCH № 02</span>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <span>OBJECTIVE: {magnification.toUpperCase()}</span>
                  <span>OPTIC AXIS: CALIBRATED</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {!dexImage && !scanError && (
                  <motion.div
                    key="camera-dropzone"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col items-center text-center w-full max-w-md relative z-10 px-2 sm:px-6"
                  >
                    {/* Scan Mode Switcher */}
                    <div className="mb-6 flex p-1 bg-bg-secondary border border-border-light rounded-2xl gap-1.5 shadow-xs w-full max-w-sm">
                      <button
                        type="button"
                        onClick={() => setScanMode('consult')}
                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          scanMode === 'consult'
                            ? 'bg-moss text-white shadow-md'
                            : 'text-text-stone hover:text-text-bark hover:bg-bg-tertiary'
                        }`}
                      >
                        🔬 Scan & Consult AI
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanMode('index')}
                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          scanMode === 'index'
                            ? 'bg-moss text-white shadow-md'
                            : 'text-text-stone hover:text-text-bark hover:bg-bg-tertiary'
                        }`}
                      >
                        📚 Scan & Index
                      </button>
                    </div>

                    {/* Brass Reticle Eyepiece Component */}
                    <div className="flex flex-col items-center mb-6">
                      {/* Magnification Objective Markers (10x, 40x, 100x) */}
                      <div className="inline-flex items-center gap-1 p-1 mb-4 rounded-full bg-[#f4ece1]/90 dark:bg-[#232019]/90 border border-[#b89552]/40 shadow-xs">
                        {(['10x', '40x', '100x'] as const).map((mag) => (
                          <button
                            key={mag}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMagnification(mag);
                            }}
                            className={`px-3 py-1 rounded-full text-[10px] font-mono font-black tracking-widest uppercase transition-all ${
                              magnification === mag
                                ? 'bg-[#b89552] text-white shadow-xs'
                                : 'text-[#7a602f] dark:text-[#d4af37] hover:bg-[#b89552]/15'
                            }`}
                          >
                            {mag === '100x' ? '100× OIL' : `${mag.toUpperCase()} FIELD`}
                          </button>
                        ))}
                      </div>

                      {/* Authentic Brass Microscope Optic Ring */}
                      <motion.div
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-40 h-40 sm:w-48 sm:h-48 rounded-full brass-eyepiece cursor-pointer relative flex items-center justify-center p-2 group transition-shadow duration-300"
                        role="button"
                        tabIndex={0}
                        aria-label="Activate brass microscope eyepiece to upload specimen"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        {/* Concentric Milled Brass Rim Accents */}
                        <div className="absolute inset-1.5 rounded-full border border-[#8a6c33]/40 pointer-events-none" />
                        <div className="absolute inset-2.5 rounded-full border border-dashed border-[#b89552]/40 pointer-events-none" />

                        {/* Etched Millimeter Crosshairs & Concentric Reticle SVG */}
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none text-[#2d4a33] dark:text-[#8fb58f] opacity-65 group-hover:opacity-90 transition-opacity duration-300"
                          viewBox="0 0 160 160"
                        >
                          <motion.g
                            animate={{
                              scale: magnification === '10x' ? 0.88 : magnification === '100x' ? 1.14 : 1,
                            }}
                            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                            style={{ transformOrigin: '80px 80px' }}
                          >
                            {/* Millimeter Hairlines */}
                            <line x1="12" y1="80" x2="148" y2="80" stroke="currentColor" strokeWidth="0.75" />
                            <line x1="80" y1="12" x2="80" y2="148" stroke="currentColor" strokeWidth="0.75" />

                            {/* Horizontal mm Ticks */}
                            {[24, 38, 52, 66, 94, 108, 122, 136].map((x) => (
                              <line
                                key={`tx-${x}`}
                                x1={x}
                                y1={x === 52 || x === 108 ? "74" : "76"}
                                x2={x}
                                y2={x === 52 || x === 108 ? "86" : "84"}
                                stroke="currentColor"
                                strokeWidth="0.75"
                              />
                            ))}

                            {/* Vertical mm Ticks */}
                            {[24, 38, 52, 66, 94, 108, 122, 136].map((y) => (
                              <line
                                key={`ty-${y}`}
                                x1={y === 52 || y === 108 ? "74" : "76"}
                                y1={y}
                                x2={y === 52 || y === 108 ? "86" : "84"}
                                stroke="currentColor"
                                strokeWidth="0.75"
                              />
                            ))}

                            {/* Concentric Reticle Rings */}
                            <circle cx="80" cy="80" r="30" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" />
                            <circle cx="80" cy="80" r="56" fill="none" stroke="currentColor" strokeWidth="0.75" />
                            {magnification === '100x' && (
                              <circle cx="80" cy="80" r="18" fill="none" stroke="#b89552" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
                            )}

                            {/* Calibration Coordinates */}
                            <text x="83" y="24" fontSize="6" fontFamily="monospace" fill="currentColor" fontWeight="bold">0.0mm</text>
                            <text x="124" y="76" fontSize="6" fontFamily="monospace" fill="currentColor" fontWeight="bold">
                              {magnification === '10x' ? '+5mm' : magnification === '100x' ? '+0.5mm' : '+2mm'}
                            </text>
                            <text x="16" y="76" fontSize="6" fontFamily="monospace" fill="currentColor" fontWeight="bold">
                              {magnification === '10x' ? '-5mm' : magnification === '100x' ? '-0.5mm' : '-2mm'}
                            </text>
                          </motion.g>
                        </svg>

                        {/* Center Optical Aperture & Camera Trigger */}
                        <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#f4f7f4]/85 dark:bg-[#18221b]/85 border border-[#3d6b4a]/40 shadow-inner flex flex-col items-center justify-center text-moss group-hover:scale-105 transition-transform duration-300">
                          <Camera size={26} className="text-moss filter drop-shadow-xs group-hover:scale-110 transition-transform duration-300" />
                          <span className="font-mono text-[8px] font-black uppercase tracking-widest text-[#3d6b4a] dark:text-[#8fb58f] mt-1">
                            {magnification === '100x' ? 'OIL 1.25' : magnification === '10x' ? '10× FIELD' : 'APERTURE'}
                          </span>
                        </div>
                      </motion.div>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-serif font-black text-text-bark tracking-tight">
                      {scanMode === 'consult' ? 'Scan & Consult AI' : 'Scan & Index Specimen'}
                    </h2>
                    <p className="text-xs sm:text-sm text-text-stone mt-2 mb-6 max-w-xs leading-relaxed">
                      {scanMode === 'consult'
                        ? 'Snapshot any plant to analyze health & ask AI questions without adding it to your collection.'
                        : 'Snapshot any plant to analyze health and index it directly into your Sanctuary Registry database.'}
                    </p>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 sm:px-8 py-3 sm:py-3.5 bg-moss hover:bg-moss-dark text-white font-black uppercase tracking-widest text-[10px] sm:text-xs rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 duration-200 font-mono flex items-center justify-center gap-2"
                    >
                      {scanMode === 'consult' ? '🔬 Open Optical Aperture' : '📚 Load Specimen Slide'}
                    </button>
                  </motion.div>
                )}

              {/* ── SCAN ERROR ── */}
              {scanError && !dexImage && (
                <motion.div
                  key="scan-error"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="flex flex-col items-center gap-4 text-center w-full max-w-sm relative z-10"
                >
                  <div className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-left">
                    <span className="text-lg shrink-0">🌿</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-rose-400">Scan Failed</p>
                      <p className="text-[11px] text-text-stone truncate">Could not analyse plant — please try again</p>
                    </div>
                  </div>
                  <button
                    onClick={() => resetDexScan(true)}
                    className="px-6 py-2.5 bg-moss hover:bg-moss-dark text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-md transition-all active:scale-95"
                  >
                    🔄 Try Again
                  </button>
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
                      {/* Left: Image Preview (Mounted Specimen Slide) */}
                      <div className="lg:col-span-5 relative rounded-2xl overflow-hidden shadow-md border border-[#3d6b4a]/25 dark:border-[#8fb58f]/25 bg-black/5 max-h-[380px] group">
                        <img src={dexImage} alt="Scanned plant" className="w-full h-full object-cover" />
                        {/* Slide Mount Stamp */}
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-sm bg-black/65 backdrop-blur-xs text-[8px] font-mono uppercase tracking-widest text-[#d4af37] border border-[#b89552]/40 shadow-xs">
                          OPTIC REF: {magnification.toUpperCase()} · SLIDE № 01
                        </div>
                        <button
                          onClick={() => resetDexScan(false)}
                          className="absolute top-3 right-3 p-2 rounded-full bg-bg-glass text-text-bark shadow-md hover:bg-bg-primary transition-all active:scale-90"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Right: Botanical Index Card Board */}
                      <div className="lg:col-span-7 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 bg-moss/10 text-moss border border-moss/20 rounded-md text-[10px] font-black uppercase tracking-wider font-mono">
                              {scanMode === 'consult' ? '🔬 Consultation Mode' : '📚 Sanctuary Index Mode'}
                            </span>

                            {isNewSpecies && (
                              <span className="px-2.5 py-1 bg-gold/10 border border-gold text-text-bark rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm animate-pulse font-mono">
                                🌟 New Species Discovered: +{discoveryBonus} Seeds!
                              </span>
                            )}
                          </div>

                          <h2 className="text-3xl font-serif font-black text-text-bark">
                            {dexResult?.commonName || 'Identifying...'}
                          </h2>
                          <p className="text-xs font-mono uppercase tracking-widest text-moss mt-0.5 font-bold">
                            {dexResult?.scientificName || ''}
                          </p>

                          {/* Immediate Health Status & Severity */}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {(() => {
                              const status = dexResult?.healthStatus || 'Healthy';
                              let badgeColor = 'bg-emerald-100/80 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
                              if (status === 'Stressed') badgeColor = 'bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
                              if (status === 'Diseased' || status === 'Infested') badgeColor = 'bg-rose-100/80 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';

                              return (
                                <span className={`px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider font-mono ${badgeColor}`}>
                                  🏥 Health Status: {status}
                                </span>
                              );
                            })()}

                            {/* Severity Level Indicator */}
                            {dexResult?.healthStatus && dexResult.healthStatus !== 'Healthy' && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-secondary border border-border-light rounded-full">
                                <span className="text-[9px] uppercase font-black tracking-wider text-text-muted font-mono">Severity:</span>
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
                            <div className="botanical-index-card p-4 sm:p-5 rounded-2xl relative border border-[#b4a58c]/35 dark:border-[#8fb58f]/20 shadow-xs">
                              <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-1 font-mono">
                                № 01 · Clinical Diagnosis &amp; Status
                              </span>
                              <p className="text-xs text-text-stone leading-relaxed font-sans font-medium">
                                {dexResult?.diagnosis || 'Waiting for diagnostic payload...'}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="botanical-index-card p-4 rounded-2xl relative border border-[#b4a58c]/35 dark:border-[#8fb58f]/20 shadow-xs">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-1 font-mono">
                                  № 02 · Light Threshold
                                </span>
                                <p className="text-xs font-bold text-text-bark">{dexResult?.light || 'Indirect bright'}</p>
                              </div>
                              <div className="botanical-index-card p-4 rounded-2xl relative border border-[#b4a58c]/35 dark:border-[#8fb58f]/20 shadow-xs">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-1 font-mono">
                                  № 03 · Hydration Cadence
                                </span>
                                <p className="text-xs font-bold text-text-bark">{dexResult?.watering || 'Moderate'}</p>
                              </div>
                            </div>

                            {/* Seeds and XP Allotment Rewards Claimed Banner */}
                            {scannedRewards && (
                              <div className="p-4 rounded-2xl border border-gold/30 bg-gold/5 dark:bg-gold/10 flex items-center justify-between shadow-xs">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-xl shrink-0">
                                    🏆
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black text-text-bark uppercase tracking-wider font-mono">Indexed to Sanctuary</h4>
                                    <p className="text-[10px] text-text-muted">Specimen registered and rewards claimed!</p>
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
                              <div className="botanical-index-card p-4 sm:p-5 rounded-2xl relative border border-[#b4a58c]/35 dark:border-[#8fb58f]/20 shadow-xs">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-2 font-mono">
                                  № 04 · Actionable Treatment Instructions
                                </span>
                                <ul className="space-y-1.5">
                                  {(dexResult?.treatmentInstructions || dexResult?.careTips || []).map((tip: string, idx: number) => (
                                    <li key={idx} className="text-xs text-text-stone flex items-start gap-2">
                                      <span className="text-moss font-bold select-none mt-0.5 font-mono">✓</span>
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* ── LOCATION INTELLIGENCE ── */}
                            {(dexResult?.locationAdvice || dexResult?.seasonalCare || dexResult?.localPestRisks || dexResult?.climateCompatibility) && (
                              <div className="space-y-3">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss flex items-center gap-1.5 font-mono">
                                  <Compass size={10} /> № 05 · Biogeographic Intelligence
                                </span>

                                {dexResult?.climateCompatibility && (
                                  <div className="botanical-index-card p-4 rounded-xl border border-border-light">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-text-stone block mb-1 font-mono">🌍 Climate Compatibility</span>
                                    <p className="text-xs text-text-bark leading-relaxed">{dexResult.climateCompatibility}</p>
                                  </div>
                                )}

                                {dexResult?.locationAdvice && (
                                  <div className="botanical-index-card p-4 rounded-xl border border-border-light">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-text-stone block mb-1 font-mono">📍 Regional Growing Advice</span>
                                    <p className="text-xs text-text-bark leading-relaxed">{dexResult.locationAdvice}</p>
                                  </div>
                                )}

                                {dexResult?.seasonalCare && (
                                  <div className="botanical-index-card p-4 rounded-xl border border-border-light">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-text-stone block mb-1 font-mono">🗓️ Seasonal Care Right Now</span>
                                    <p className="text-xs text-text-bark leading-relaxed">{dexResult.seasonalCare}</p>
                                  </div>
                                )}

                                {dexResult?.localPestRisks && (
                                  <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/15">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 block mb-1 font-mono">⚠️ Local Pest &amp; Disease Risks</span>
                                    <p className="text-xs text-text-bark leading-relaxed">{dexResult.localPestRisks}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-8 flex flex-wrap sm:flex-nowrap gap-3">
                          <button
                            onClick={() => resetDexScan(true)}
                            className="flex-1 py-3 bg-moss hover:bg-moss-dark text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-md active:scale-95"
                          >
                            📷 Scan Another
                          </button>

                          {scannedRewards ? (
                            <button
                              onClick={() => {
                                setActiveTab('sanctuary');
                                setSearchParams({ tab: 'sanctuary' });
                              }}
                              className="flex-1 py-3 bg-moss hover:bg-moss-dark text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 font-mono"
                            >
                              🔬 View Specimen in Sanctuary <ArrowRight size={12} />
                            </button>
                          ) : scanMode === 'consult' ? (
                            <button
                              onClick={() => handleIndexSpecimen()}
                              className="flex-1 py-3 bg-gold/20 hover:bg-gold/30 text-text-bark border border-gold/40 font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 font-mono"
                            >
                              📥 Index to Sanctuary
                            </button>
                          ) : null}

                          <button
                            onClick={() => {
                              const name = encodeURIComponent(dexResult?.commonName || '');
                              const spec = encodeURIComponent(dexResult?.scientificName || '');
                              const query = encodeURIComponent(`I just ran a scan on my ${dexResult?.commonName || 'plant'}. The health status is ${dexResult?.healthStatus || 'unknown'} with severity ${dexResult?.severity || 1}/5. Diagnosis: ${dexResult?.diagnosis || 'N/A'}. What is the best treatment plan?`);
                              transitionTo(`/assistant?plantName=${name}&species=${spec}&query=${query}`, 'AI Assistant');
                            }}
                            className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-bark border border-border-medium font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 font-mono"
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
            {scanError && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={18} className="text-rose-500 shrink-0" />
                  <p className="text-xs font-semibold font-sans">{scanError}</p>
                </div>
                <button
                  onClick={() => setScanError(null)}
                  className="text-[10px] font-mono font-black uppercase tracking-wider text-rose-500 hover:text-rose-700 px-2 py-1 rounded transition-colors"
                >
                  Dismiss [×]
                </button>
              </div>
            )}
            
            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {sanctuaryPlants.map((plant) => {
                const isActive = isPlantActive(plant.id);
                const plantCheckins = checkins.filter(c => c.plantId === plant.id);
                const latest = plantCheckins.length
                  ? plantCheckins.reduce((a, b) => new Date(b.timestamp) > new Date(a.timestamp) ? b : a)
                  : null;
                const healthScore = plant.guardianScore || latest?.guardianScore || 90;
                const isMissed = !isActive;
                const moistureLabel = latest?.soilMoisture || (isActive ? 'Moist' : 'Dry');
                const moisturePct = moistureLabel === 'Wet' ? '88%' : moistureLabel === 'Dry' ? '18%' : '58%';

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
                    className="specimen-glass-slide rounded-3xl overflow-hidden flex flex-col justify-between min-h-[480px] transition-all duration-300 relative group shadow-sm hover:shadow-lg border border-white/70 dark:border-white/10"
                  >
                    <div>
                      {/* Ivory Adhesive Tape Header */}
                      <div className="ivory-tape-header px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#b89552]" />
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] font-bold truncate">
                            SPECIMEN № {plant.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-text-stone font-semibold shrink-0">
                          GLASS MOUNT
                        </span>
                      </div>

                      <div className="p-5">
                        {/* Top Row: Title & Status */}
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-terracotta/10 text-terracotta text-[9px] font-black uppercase tracking-wider border border-terracotta/20 font-mono">
                                Needs Care
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-moss/10 text-moss text-[9px] font-black uppercase tracking-wider border border-moss/20 font-mono">
                                Thriving
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Specimen Visual Area (Mounted Glass Coverslip Frame) */}
                        <div className="relative rounded-2xl overflow-hidden aspect-[16/10] mb-4 border border-border-light shadow-xs bg-bg-secondary group/img">
                          <img 
                            src={getPlantPhoto(plant.photoUrl, plant.species)} 
                            alt={plant.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getPlantPhoto(null, plant.species);
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none" />

                          {/* Brass Specimen Mounting Clips at Corners */}
                          <div className="absolute top-2 left-2 w-2.5 h-1 bg-[#b89552] border border-[#7a602f] rounded-xs shadow-xs" />
                          <div className="absolute top-2 right-2 w-2.5 h-1 bg-[#b89552] border border-[#7a602f] rounded-xs shadow-xs" />
                          
                          {/* Streamlined Stats Overlaid Cleanly */}
                          <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
                            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest font-mono">
                              <Flame size={9} className="fill-current text-terracotta" /> {profile?.currentStreak || 0}D
                            </div>
                            <div className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest font-mono bg-black/60 backdrop-blur-md text-white">
                              Score: {healthScore}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Telemetries in Botanical Index Card */}
                        <div className="space-y-3 mb-5 botanical-index-card p-3.5 sm:p-4 rounded-2xl border border-border-light">
                          {/* Litmus Paper Chemical Moisture Indicator */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-text-stone font-medium flex items-center gap-1.5">
                                <Droplets size={12} className="text-moss" />
                                <span className="font-mono text-[10px] uppercase tracking-wider">Litmus Indicator</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0" 
                                  style={{
                                    backgroundColor: moistureLabel === 'Dry' ? '#d97736' : moistureLabel === 'Wet' ? '#1b4332' : '#5a7d5a'
                                  }}
                                />
                                <span className={`font-mono font-bold text-xs ${moistureLabel === 'Dry' ? 'text-terracotta' : 'text-moss'}`}>
                                  {moistureLabel} ({moisturePct})
                                </span>
                              </div>
                            </div>

                            {/* Litmus Paper Reagent Strip */}
                            <div className="relative pt-1 pb-1">
                              <div className="litmus-paper-track w-full h-2 rounded-full relative overflow-hidden">
                                <motion.div 
                                  initial={{ left: '0%' }}
                                  animate={{ left: moisturePct }}
                                  transition={{ duration: 0.8, ease: 'easeOut' }}
                                  className="absolute top-0 bottom-0 w-2 bg-white border border-black/50 shadow-xs rounded-full -ml-1 flex items-center justify-center"
                                >
                                  <span className="w-1 h-1 rounded-full bg-[#3d6b4a]" />
                                </motion.div>
                              </div>
                              {/* Calibration Graduation Marks */}
                              <div className="flex justify-between items-center text-[8px] font-mono text-text-stone tracking-wider mt-1 px-0.5">
                                <span>01 DRY (AMBER)</span>
                                <span>02 OPTIMAL</span>
                                <span>03 MOIST (MOSS)</span>
                              </div>
                            </div>
                          </div>

                          {/* Environment telemetry */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-light text-[10px] text-text-stone">
                            <div className="flex items-center gap-1">
                              <Sun size={11} className="text-gold" />
                              <span>Light: <strong className="text-text-bark font-bold">{latest?.lightLevel || 'Indirect'}</strong></span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Thermometer size={11} className="text-terracotta" />
                              <span>Temp: <strong className="text-text-bark font-bold">{latest?.weatherTemp != null ? `${latest.weatherTemp}°C` : '—'}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Panel */}
                    <div className="p-5 pt-0 space-y-2">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        disabled={isUpdatingPhoto}
                        onClick={(e) => handleUpdatePhoto(plant.id, e)}
                        className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 border flex items-center justify-center gap-2 font-mono ${
                          isUpdatingPhoto && updatingPlantId === plant.id
                            ? 'bg-moss/20 border-moss/40 text-moss cursor-wait'
                            : isMissed
                            ? 'bg-terracotta border-terracotta hover:bg-terracotta-light text-white shadow-md'
                            : 'bg-bg-secondary border-border-medium hover:bg-bg-tertiary text-text-stone hover:text-text-bark font-bold'
                        }`}
                      >
                        <RefreshCw size={11} className={isUpdatingPhoto && updatingPlantId === plant.id ? 'animate-spin' : ''} /> 
                        {isUpdatingPhoto && updatingPlantId === plant.id
                          ? 'Analyzing Optical Sample...'
                          : isMissed
                          ? 'Revive Streak'
                          : 'Update Photo (+15 Seeds)'}
                      </motion.button>

                      <button
                        onClick={() => transitionTo(`/plant/${plant.id}`, plant.name)}
                        className="w-full py-2 text-[9px] font-black uppercase tracking-widest text-moss hover:text-moss-dark flex items-center justify-center gap-1 transition-colors font-mono"
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
                className="specimen-glass-slide rounded-3xl border-2 border-dashed border-moss/30 hover:border-moss/60 cursor-pointer p-6 flex flex-col items-center justify-center min-h-[480px] text-moss/70 hover:text-moss transition-all shadow-xs"
              >
                <div className="ivory-tape-header px-4 py-1.5 rounded-full border border-[#e5dcba] dark:border-[#8fb58f]/25 text-[9px] font-mono uppercase tracking-widest text-[#7a602f] dark:text-[#d4af37] font-bold mb-6">
                  UNREGISTERED SLIDE SLOT
                </div>
                <div className="w-14 h-14 rounded-full bg-moss/10 border border-moss/20 flex items-center justify-center mb-4 text-moss">
                  <Plus size={24} />
                </div>
                <p className="font-serif font-black text-xl text-text-bark">Add New Genus Slot</p>
                <p className="text-xs text-center px-4 mt-2 text-text-stone leading-relaxed font-medium max-w-xs">
                  Index a new species in the wild Plant Database to unlock a permanent glass slide mount in your Garden Sanctuary!
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
              className="fixed inset-0 bg-black/80 z-50"
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
      {streakPopupData && (
        <StreakPopup
          isOpen={true}
          streak={streakPopupData.streak}
          seedsEarned={streakPopupData.seeds}
          onClose={() => setStreakPopupData(null)}
        />
      )}

      {/* Hidden file inputs for camera snapshots, uploads, and photo updates */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDexUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={updatePhotoInputRef}
        onChange={handleUpdateFileChange}
        accept="image/*"
        className="hidden"
      />
    </PageWrapper>
  );
}
