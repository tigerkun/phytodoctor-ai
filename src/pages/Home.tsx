import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { GameService } from '@/services/gameService';
import { ArrowRight, Leaf, Shield, Swords, Bell } from 'lucide-react';

import { AmbientAnimations } from '@/components/home/AmbientAnimations';
import { HeroSection } from '@/components/home/HeroSection';
import SanctuaryHub from '@/components/home/SanctuaryHub';
import { GardenCoach } from '@/components/home/GardenCoach';
import { PlantGallery } from '@/components/home/PlantGallery';
import { PlantProfileDrawer } from '@/components/home/PlantProfileDrawer';
import { QuickstartGuide } from '@/components/home/QuickstartGuide';
import { useTimeOfDay, getBackgroundGradient, type TimePeriod } from '@/hooks/useTimeOfDay';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useEcoMode } from '@/hooks/useEcoMode';
import PageWrapper from '@/components/home/PageWrapper';
import { useGeolocation } from '@/hooks/useGeolocation';
import { fetchWeather, generateWeatherAdvice, getWateringRecommendation } from '@/utils/weatherIntegration';
import { getPlantPhoto } from '@/utils/plantImage';



import { useNavigate } from 'react-router-dom';
import { usePageTransition } from '@/components/home/PageTransitionContext';

// ─── Welcome Landing (first-time visitors) ───────────────────────────
const ONBOARD_KEY = 'botanical_guardian_onboarded';

const FEATURES = [
  { icon: Leaf, title: 'AI Plant Doctor', desc: 'Snap a photo and get an instant diagnosis powered by Gemini AI — species ID, disease detection, and tailored care plans.', color: '#5A7A5A' },
  { icon: Shield, title: 'PhytoCards', desc: 'Every plant earns a collectible card that levels up as you care for it. Track rarity, stats, and growth stages.', color: '#C17F59' },
  { icon: Swords, title: 'Care-Off Arena', desc: 'Challenge other guardians to head-to-head care battles. Prove your green thumb and climb the leaderboard.', color: '#B8860B' },
  { icon: Bell, title: 'Smart Alerts', desc: 'Weather-aware watering reminders, drift detection, and predictive health forecasts — so no plant gets forgotten.', color: '#6B8E6B' },
];

function WelcomeLanding({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  return (
    <PageWrapper className="min-h-screen w-full relative overflow-hidden bg-[#FAF7F2] dark:bg-[#121619]">
      {/* Background architectural glasshouse & estate ambience */}
      <div className="absolute inset-0 -z-10 gatehouse-stone opacity-95" />

      {/* Weathered Stone Gatehouse Arch Container */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-12 md:pt-20 pb-16">
        
        {/* Gatehouse Arch Apex & Crest */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center mb-6 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#b89552]/40 bg-[#f7edd6]/80 dark:bg-[#2b2416]/80 text-[#7a602f] dark:text-[#d4af37] text-[10px] font-black uppercase tracking-[0.25em] shadow-xs">
            🏛️ ESTATE CONSERVATORY · GATEHOUSE № 01
          </div>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-[#b89552]/50 to-transparent mt-3" />
        </motion.div>

        {/* Gatehouse Stone Portico Header */}
        <motion.section
          className="text-center max-w-3xl mx-auto mb-14"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="inline-block text-6xl md:text-7xl mb-4 filter drop-shadow-sm"
            animate={{ rotate: [0, 4, -3, 0], scale: [1, 1.05, 0.98, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            🌿
          </motion.div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4 text-[#2C2419] dark:text-[#F5F0E8]">
            Enter the Grand Estate
            <span className="block italic text-[#5A7D5A] dark:text-[#8FB58F]">Conservatory.</span>
          </h1>

          <p className="text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed text-[#6B5E51] dark:text-[#A8B5A0]">
            Step across the threshold into an intelligent botanical sanctuary. Gemini AI clinical diagnostics,
            heirloom specimen cards, and weather-synchronized care regimens.
          </p>

          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-3 px-9 py-4 rounded-full text-white font-bold text-base shadow-xl transition-all cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #3D5A3D 0%, #5A7D5A 100%)',
              boxShadow: '0 10px 28px rgba(61,90,61,0.28)'
            }}
          >
            🌱 Open Sanctuary Gates
            <ArrowRight size={18} />
          </motion.button>

          <p className="mt-3 text-xs tracking-wider uppercase text-[#9C8E80] dark:text-[#7A756D] font-mono">
            Free forever · Private offline database · No sign-up barrier
          </p>
        </motion.section>

        {/* Feature Cards — Carved Stone Plaque Aesthetic */}
        <section className="mb-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                whileHover={{ y: -5 }}
                className="rounded-2xl p-6 border transition-all cursor-default relative overflow-hidden bg-white/70 dark:bg-[#1E1B17]/70 border-[#D2C7B5]/60 dark:border-[#3D3830] shadow-xs hover:shadow-md"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 border border-black/5 dark:border-white/10"
                  style={{ background: `${f.color}18`, color: f.color }}
                >
                  <f.icon size={20} />
                </div>
                <h3 className="font-serif text-lg font-bold mb-1.5 text-[#2C2419] dark:text-[#F5F0E8]">{f.title}</h3>
                <p className="text-xs leading-relaxed text-[#6B5E51] dark:text-[#A8B5A0]">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Guest Register Endorsement */}
        <motion.section
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="rounded-2xl p-8 border border-[#D2C7B5]/70 dark:border-[#3D3830] bg-[#FAF7F2]/90 dark:bg-[#1A1714]/90 shadow-sm relative">
            <p className="font-serif text-xl italic leading-relaxed mb-4 text-[#2C2419] dark:text-[#F5F0E8]">
              "The diagnostic precision and potting reminders brought my conservatory back to life. A proper heritage tool for any true plant lover."
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#5A7D5A] text-white flex items-center justify-center font-serif font-bold text-xs">
                P
              </div>
              <div className="text-left">
                <p className="font-bold text-xs text-[#2C2419] dark:text-[#F5F0E8]">Priya Sharma</p>
                <p className="text-[10px] uppercase font-mono tracking-wider text-[#9C8E80]">Conservator · 23 PhytoCards</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Secondary Sign-in Anchor */}
        <div className="text-center mt-8">
          <p className="text-xs text-[#6B5E51] dark:text-[#A8B5A0]">
            Already holding estate keys?{' '}
            <button
              onClick={onSignIn}
              className="font-bold underline text-[#5A7D5A] dark:text-[#8FB58F] hover:opacity-80 cursor-pointer bg-transparent border-none p-0 inline"
            >
              Sign In to Sanctuary
            </button>
          </p>
        </div>

      </div>
    </PageWrapper>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { transitionTo } = usePageTransition();
  const { timeOfDay } = useTimeOfDay();
  const { theme } = useDayNightTheme();
  const { ecoModeActive } = useEcoMode();
  const { location, city } = useGeolocation();
  const [weather, setWeather] = useState<any>(null);

  // Onboarding gate
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARD_KEY) === '1');
  const handleGetStarted = useCallback(async () => {
    localStorage.setItem(ONBOARD_KEY, '1');
    await GameService.ensureProfile();
    setOnboarded(true);
  }, []);

  // Local override state for ambient time selection
  const [timePeriodOverride, setTimePeriodOverride] = useState<TimePeriod | null>(null);
  const activeTimePeriod = timePeriodOverride || timeOfDay;

  // Real database hooks — scoped to current user
  const userId = GameService.getUserId();
  const dbPlants = useLiveQuery(() => db.plants.where('userId').equals(userId).toArray(), [userId]);
  const checkins = useLiveQuery(() => db.checkins.toArray()) || [];
  const profile = useLiveQuery(() => GameService.getProfile(userId), [userId]);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const forceRefreshProfile = () => setProfileRefreshKey(prev => prev + 1);

  // Map database plants — all user non-demo plants form the living collection
  const mappedPlants = useMemo(() => {
    return (dbPlants || [])
      .filter(p => !p.isDemo)
      .map(p => ({
        id: p.id,
        nickname: p.name,
        species: p.species,
        healthScore: p.guardianScore || 50,
        lastWatered: p.updatedAt ? new Date(p.updatedAt) : new Date(p.createdAt || Date.now()),
        image: getPlantPhoto(p.photoUrl, p.species),
        lastPhoto: p.checkInTime ? `Analyzed ${p.checkInTime}` : 'Never analyzed',
      }));
  }, [dbPlants]);

  const [selectedPlant, setSelectedPlant] = useState<any>(mappedPlants[0] ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Keep selected plant updated — only update when ID changes to prevent re-render loop
  useEffect(() => {
    if (!mappedPlants.length) {
      if (selectedPlant) setSelectedPlant(null);
      return;
    }
    const exists = mappedPlants.find(p => p.id === selectedPlant?.id);
    const next = exists ?? mappedPlants[0];
    if (next.id !== selectedPlant?.id) {
      setSelectedPlant(next);
    } else if (exists && exists.nickname !== selectedPlant?.nickname) {
      setSelectedPlant(exists);
    }
  }, [mappedPlants]);

  const bgGradient = getBackgroundGradient(activeTimePeriod);

  useEffect(() => {
    async function loadWeather() {
      if (location?.latitude && location?.longitude) {
        try {
          const fetched = await fetchWeather(location.latitude, location.longitude, city);
          setWeather(fetched);
        } catch (err) {
          console.error(err);
        }
      } else {
        try {
          const fetched = await fetchWeather(28.6139, 77.2090, 'Delhi');
          setWeather(fetched);
        } catch (err) {
          console.error(err);
        }
      }
    }
    loadWeather();
  }, [location, city]);

  // Dynamically apply background gradient of active time period to app-shell so AmbientGarden (z-index 1) renders in front of background but behind contents
  useEffect(() => {
    const appShell = document.getElementById('app-shell');
    if (appShell) {
      appShell.style.backgroundImage = `var(--gradient-${activeTimePeriod})`;
      appShell.style.transition = 'background-image 1.2s ease-in-out, background-color 1.2s ease-in-out';
    }
    return () => {
      if (appShell) {
        appShell.style.backgroundImage = '';
      }
    };
  }, [activeTimePeriod]);

  const isDarkText = ['dawn', 'morning', 'afternoon'].includes(activeTimePeriod);
  const textColorClass = isDarkText ? 'text-[#3D405B]' : 'text-[#FAF7F2]';

  const selectedPlantIndex = useMemo(() => {
    if (!selectedPlant) return 0;
    const idx = mappedPlants.findIndex(p => p.id === selectedPlant.id);
    return idx >= 0 ? idx : 0;
  }, [mappedPlants, selectedPlant]);

  // Gate: show welcome landing for first-time visitors
  if (!onboarded) {
    return <WelcomeLanding onGetStarted={handleGetStarted} onSignIn={() => transitionTo('/auth', 'Sign In')} />;
  }

  return (
    <PageWrapper
      className={`min-h-screen w-full relative skin-conservatory ${textColorClass} transition-colors duration-1000`}
    >
      {/* Ambient Animations */}
      <AmbientAnimations overrideTimePeriod={activeTimePeriod} />

      {/* Main Content */}
      <motion.main
        className="relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        {/* Hero Section */}
        <HeroSection
          plantId={selectedPlant?.id}
          plantName={selectedPlant?.nickname || selectedPlant?.name || ''}
          plantSpecies={selectedPlant?.species || ''}
          healthScore={selectedPlant?.healthScore || 0}
          lastAnalyzed={selectedPlant?.lastPhoto || ''}
          photoUrl={getPlantPhoto(selectedPlant?.image || selectedPlant?.photoUrl, selectedPlant?.species)}
          profile={profile}
          totalPlants={mappedPlants.length}
          plantIndex={selectedPlantIndex}
          weather={weather}
          currentTimePeriod={activeTimePeriod}
          onTimePeriodChange={(period) => setTimePeriodOverride(period)}
          onAddPlant={() => {
            transitionTo('/lab?tab=dex', 'Botanical Lab');
          }}
        />

        {/* Quickstart Usage Manual & Top-Up Guide */}
        <QuickstartGuide 
          onAddPlant={() => transitionTo('/lab?tab=dex', 'Botanical Lab')}
          onRefreshProfile={forceRefreshProfile}
        />

        {/* Sanctuary Hub */}
        <SanctuaryHub />

        {/* Garden Coach */}
        <GardenCoach 
          profile={profile}
          selectedPlant={selectedPlant}
          weather={weather}
          onRefreshProfile={forceRefreshProfile}
        />

        {/* Plant Gallery */}
        <PlantGallery
          plants={mappedPlants}
          onSelectPlant={(plant) => {
            setSelectedPlant(plant);
            setDrawerOpen(true);
          }}
        />

        {/* Footer Section */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-16 px-4 text-center"
        >
          <div className="max-w-4xl mx-auto">
            <h2
              className="text-3xl font-serif font-bold mb-4 text-[var(--text-bark)]"
            >
              Ready to expand your garden?
            </h2>
            <motion.button
              onClick={() => transitionTo('/market', 'Garden Market')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Browse the Garden Market"
              className="px-8 py-4 rounded-full font-bold text-white mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--moss) 0%, var(--moss-light) 100%)',
                boxShadow: '0 10px 30px var(--glow)'
              }}
            >
              🌱 Browse Market
            </motion.button>
          </div>
        </motion.section>

        {/* Plant Profile Drawer */}
        <AnimatePresence>
          {selectedPlant && drawerOpen && (
            <PlantProfileDrawer
              key="plant-drawer"
              isOpen={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              plant={selectedPlant}
            />
          )}
        </AnimatePresence>
      </motion.main>

      {/* Eco Mode Notice */}
      {ecoModeActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 md:bottom-6 right-6 px-4 py-3 rounded-[var(--radius-md)] backdrop-blur-md text-sm font-medium z-50"
          style={{
            background: 'var(--bg-glass)',
            color: 'var(--moss)',
            border: '1px solid var(--border-light)'
          }}
        >
          🔋 Eco mode active for better battery
        </motion.div>
      )}
    </PageWrapper>
  );
}
