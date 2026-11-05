import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTimeOfDay, type TimePeriod } from '@/hooks/useTimeOfDay';
import { fetchWeather } from '@/utils/weatherIntegration';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { GameService } from '@/services/gameService';

import { HeroSection } from '@/components/home/HeroSection';
import { LocationBar } from '@/components/home/LocationBar';
import SanctuaryHub from '@/components/home/SanctuaryHub';
import { GardenCoach } from '@/components/home/GardenCoach';
import { PlantGallery } from '@/components/home/PlantGallery';
import { PlantProfileDrawer } from '@/components/home/PlantProfileDrawer';
import { QuickstartGuide } from '@/components/home/QuickstartGuide';
import GardenDashboard from '@/components/home/GardenDashboard';
import SeasonalCareCard from '@/components/home/SeasonalCareCard';
import AddPlantModal from '@/components/home/AddPlantModal';
import { useEcoMode } from '@/hooks/useEcoMode';
import PageWrapper from '@/components/home/PageWrapper';
import { useGeolocation } from '@/hooks/useGeolocation';
import { resolveWeatherPlace } from '@/utils/geocode';
import { getPlantPhoto } from '@/utils/plantImage';
import { supabase } from '@/lib/supabase';
import { postgresToPlant, onPlantsChange, PlantService } from '@/services/plantService';
import { StorageService } from '@/services/storageService';
import type { Plant, SoilType } from '@/types';

import { usePageTransition } from '@/components/home/PageTransitionContext';
import Landing from '@/components/home/Landing';
import BentoGrid01 from '@/components/ui/bento-grid-01';


// ─── Welcome Landing (first-time visitors) ───────────────────────────
const ONBOARD_KEY = 'botanical_guardian_onboarded';


// ─── Main Dashboard ────────────────────────────────────────────────────
export default function HomePage() {
  const { transitionTo } = usePageTransition();
  const { timeOfDay } = useTimeOfDay();
  const { ecoModeActive } = useEcoMode();
  const { location, city, error: locationError, locating, updateCity, requestLocation } = useGeolocation();
  const [weather, setWeather] = useState<any>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Onboarding gate. The flag flips on account creation (Auth.tsx) or Supabase
  // session hydration (Layout.tsx) — never from the landing, whose every CTA
  // now leads to /auth. A signed-out visitor should not be able to walk into
  // the Keeper dashboard.
  const [onboarded] = useState(() => localStorage.getItem(ONBOARD_KEY) === '1');

  // Local override state for ambient time selection
  const [timePeriodOverride] = useState<TimePeriod | null>(null);
  const activeTimePeriod = timePeriodOverride || timeOfDay;

  // Real database hooks — Supabase Postgres with RLS + live reactivity
  const userId = GameService.getUserId();
  const [dbPlants, setDbPlants] = useState<Plant[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchPlantsFromSupabase = useCallback(async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('plants')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) {
          const mapped = data.map(postgresToPlant);
          setDbPlants(mapped);
          return;
        }
      } catch (err) {
        console.error('[Home] Failed to fetch plants from Supabase:', err);
      }
    }
    // Fallback if offline / local-only
    const local = await db.plants.where('userId').equals(userId).toArray();
    setDbPlants(local);
  }, [userId]);

  useEffect(() => {
    fetchPlantsFromSupabase();
    // Subscribe to real-time plant changes (inserts, updates, deletes)
    const unsubscribe = onPlantsChange((updatedPlants) => {
      setDbPlants(updatedPlants);
    });
    return () => unsubscribe();
  }, [fetchPlantsFromSupabase]);

  // The refresh key is in the deps on purpose: a care action updates the
  // profile through a service the live query doesn't observe, so bumping the
  // key is what re-reads it. It was previously inert, which made
  // onRefreshProfile a no-op.
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const profile = useLiveQuery(() => GameService.getProfile(userId), [userId, profileRefreshKey]);
  const forceRefreshProfile = () => setProfileRefreshKey(prev => prev + 1);


  // Map database plants — all user non-demo plants form the living collection
  const mappedPlants = useMemo(() => {
    return (dbPlants || [])
      .filter(p => !p.isDemo)
      .map(p => ({
        id: p.id,
        name: p.name,
        nickname: p.name,
        species: p.species,
        healthScore: p.guardianScore || 50,
        lastWatered: p.updatedAt ? new Date(p.updatedAt) : new Date(p.createdAt || Date.now()),
        image: getPlantPhoto(p.photoUrl, p.species),
        lastPhoto: p.checkInTime ? `Analyzed ${p.checkInTime}` : 'Never analyzed',
        milestones: p.milestoneLog,
        // Dashboard fields (gardenDashboardService reads these):
        guardianScore: p.guardianScore || 0,
        status: p.status,
        createdAt: p.createdAt,
        nextWaterDue: p.nextWaterDue,
        // updatedAt is the honest staleness proxy: every care event (check-in,
        // watering, diagnosis) refreshes it, so "no care event in 30 days" is
        // exactly what the queue should surface.
        lastCheckInAt: p.updatedAt,
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


  // Whose weather to show, and what to admit when we cannot get it.
  //
  // The old version had two branches and one of them was a lie: with no device
  // fix it fetched Delhi's coordinates and called the result weather, so every
  // Keeper who had not granted — or had dismissed — the location prompt saw a
  // Delhi forecast next to their own garden. There is no default place. No
  // choice means no weather card, and a city that will not resolve says so
  // rather than quietly becoming someone else's climate.
  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      setWeatherError(null);
      try {
        const place = await resolveWeatherPlace(city, location);
        if (cancelled) return;
        if (!place) {
          setWeather(null);
          return;
        }
        const fetched = await fetchWeather(place.latitude, place.longitude, place.city);
        if (cancelled) return;
        setWeather(fetched);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setWeather(null);
        setWeatherError(err instanceof Error ? err.message : 'Could not load weather for that place.');
      }
    }
    loadWeather();
    return () => { cancelled = true; };
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

  // Gate: show bright landing for first-time visitors
  if (!onboarded) {
    return <Landing onSignIn={() => transitionTo('/auth', 'Sign In')} />;
  }

  return (
    <PageWrapper
      className={`min-h-screen w-full relative skin-conservatory ${textColorClass} transition-colors duration-1000`}
    >
      <p className="text-xs text-[#6B6156] dark:text-[#9A9086] font-mono sr-only">Sanctuary Keeper Portal</p>
      {/* Ambient Animations */}

      {/* Main Content. A div, not a main: Layout owns the page's single
          <main> landmark and this page renders inside it — a second one
          gave every screen reader two mains to guess between. */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        {/* Where the Keeper is — the only entry point for it */}
        <div className="pt-5 pb-2">
        <LocationBar
          city={city}
          error={weatherError || locationError}
          locating={locating}
          onSaveCity={updateCity}
          onUseDeviceLocation={() => { void requestLocation().catch(() => {}); }}
        />
        </div>

        {/* Proactive garden dashboard: health headline, weather that
            threatens THIS collection, today's priority queue. */}
        <div className="pt-4">
          <GardenDashboard
            plants={mappedPlants as any[]}
            weather={weather}
          />
        </div>

        {/* The calendar's ask: season-scoped care notes, climate taken from
            the collection's own hardiness zones when known. */}
        <div className="pt-4">
          <SeasonalCareCard />
        </div>

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
          wateringIntervalDays={dbPlants[selectedPlantIndex]?.wateringIntervalDays}
          milestones={selectedPlant?.milestones}
          onAddPlant={() => setIsAddModalOpen(true)}
        />


        <BentoGrid01 />

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
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -15% 0px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="py-16 px-4 text-center"
        >
          <div className="max-w-4xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -15% 0px' }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-3xl font-serif font-bold mb-4 text-[var(--text-bark)]"
            >
              Ready to expand your garden?
            </motion.h2>
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
              Browse Market
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
        {/* Add Plant Modal Form */}
        <AnimatePresence>
          {isAddModalOpen && (
            <AddPlantModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              onScanRedirect={() => {
                setIsAddModalOpen(false);
                transitionTo('/lab?tab=dex', 'Botanical Lab');
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>

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

