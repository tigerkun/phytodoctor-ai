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

function WelcomeLanding({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <PageWrapper className="min-h-screen w-full relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10" style={{
        background: 'linear-gradient(160deg, #f0f7ef 0%, #e8f0e0 30%, #fdf8f0 60%, #f5efe5 100%)'
      }} />

      {/* Floating decorative circles */}
      <motion.div
        className="absolute top-20 -right-20 w-96 h-96 rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, #5A7A5A, transparent 70%)' }}
        animate={{ y: [0, -30, 0], x: [0, 15, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-10 -left-20 w-80 h-80 rounded-full opacity-[0.06]"
        style={{ background: 'radial-gradient(circle, #C17F59, transparent 70%)' }}
        animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Hero */}
      <motion.section
        className="relative z-10 max-w-5xl mx-auto px-6 pt-16 md:pt-28 pb-12 text-center"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="inline-block text-6xl md:text-7xl mb-6"
          animate={{ rotate: [0, 6, -4, 0], scale: [1, 1.08, 0.97, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          🌿
        </motion.div>

        <h1 className="font-serif text-5xl md:text-7xl font-bold leading-tight mb-6" style={{ color: '#3D405B' }}>
          Your plants deserve a
          <span className="block" style={{ color: '#5A7A5A' }}>guardian.</span>
        </h1>

        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: '#7A7D8D' }}>
          Botanical Guardian combines AI-powered diagnostics, collectible plant cards,
          and competitive care challenges — turning everyday plant care into an adventure.
        </p>

        <motion.button
          onClick={onGetStarted}
          whileHover={{ scale: 1.05, boxShadow: '0 20px 50px rgba(90,122,90,0.3)' }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-3 px-10 py-5 rounded-full text-white font-bold text-lg shadow-xl transition-all"
          style={{
            background: 'linear-gradient(135deg, #5A7A5A 0%, #7FA87F 100%)',
            boxShadow: '0 12px 35px rgba(90,122,90,0.25)'
          }}
        >
          🌱 Start Your Garden
          <ArrowRight size={20} />
        </motion.button>

        <p className="mt-4 text-xs" style={{ color: '#A0A3B1' }}>
          Free forever · No account needed · Works offline
        </p>
      </motion.section>

      {/* Feature Cards */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="rounded-3xl p-7 border backdrop-blur-sm cursor-default"
              style={{
                background: 'rgba(255,255,255,0.65)',
                borderColor: 'rgba(255,255,255,0.4)',
                boxShadow: '0 8px 30px rgba(61,64,91,0.06)'
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: `${f.color}15`, color: f.color }}
              >
                <f.icon size={22} />
              </div>
              <h3 className="font-serif text-xl font-bold mb-2" style={{ color: '#3D405B' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#7A7D8D' }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <motion.section
        className="relative z-10 max-w-3xl mx-auto px-6 py-16 text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="rounded-3xl p-10 border" style={{
          background: 'rgba(255,255,255,0.5)',
          borderColor: 'rgba(255,255,255,0.3)',
          boxShadow: '0 8px 40px rgba(61,64,91,0.06)'
        }}>
          <p className="font-serif text-2xl md:text-3xl italic leading-relaxed mb-6" style={{ color: '#3D405B' }}>
            "I used to forget to water my plants every week. Now I'm on a 47-day streak and my Monstera just hit Level 20."
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5A7A5A] to-[#7FA87F] flex items-center justify-center text-white font-bold text-sm">P</div>
            <div className="text-left">
              <p className="font-bold text-sm" style={{ color: '#3D405B' }}>Priya S.</p>
              <p className="text-xs" style={{ color: '#A0A3B1' }}>Guardian Level 12 · 23 PhytoCards</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Bottom CTA */}
      <section className="relative z-10 text-center pb-20 flex flex-col items-center">
        <motion.button
          onClick={onGetStarted}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-white font-bold shadow-lg mb-6"
          style={{ background: 'linear-gradient(135deg, #5A7A5A, #7FA87F)' }}
        >
          🌱 Get Started — It's Free
          <ArrowRight size={18} />
        </motion.button>
        <p className="text-sm font-medium" style={{ color: '#7A7D8D' }}>
          Already a guardian?{' '}
          <a href="/auth" className="font-bold hover:underline" style={{ color: '#5A7A5A' }}>
            Sign In
          </a>
        </p>
      </section>
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
  const profile = useLiveQuery(() => GameService.getProfile(userId), [userId]);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const forceRefreshProfile = () => setProfileRefreshKey(prev => prev + 1);


  // Map database plants — useMemo prevents recalculation on every render
  const mappedPlants = useMemo(() =>
    (dbPlants || []).map(p => ({
      id: p.id,
      nickname: p.name,
      species: p.species,
      healthScore: p.guardianScore || 50,
      lastWatered: p.createdAt ? new Date(p.createdAt) : new Date(),
      image: getPlantPhoto(p.photoUrl, p.species),
      lastPhoto: p.checkInTime ? `Analyzed ${p.checkInTime}` : 'Never analyzed',
    })),
  [dbPlants]);

  const [selectedPlant, setSelectedPlant] = useState<any>(mappedPlants[0] ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Keep selected plant updated — only update when ID changes to prevent re-render loop
  useEffect(() => {
    if (!mappedPlants.length) return;
    const exists = mappedPlants.find(p => p.id === selectedPlant?.id);
    const next = exists ?? mappedPlants[0];
    if (next.id !== selectedPlant?.id) {
      setSelectedPlant(next);
    } else if (exists && (exists.nickname !== selectedPlant?.nickname)) {
      // Nickname updated in database: update selectedPlant nickname immediately
      setSelectedPlant(exists);
    }
  }, [dbPlants]);

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

  // Gate: show welcome landing for first-time visitors
  if (!onboarded) {
    return <WelcomeLanding onGetStarted={handleGetStarted} />;
  }

  return (
    <PageWrapper
      className={`min-h-screen w-full relative ${textColorClass} transition-colors duration-1000`}
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
