import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { GameService } from '@/services/gameService';
import { ArrowRight, Leaf, Shield, Swords, Bell, Camera } from 'lucide-react';

import { HeroSection } from '@/components/home/HeroSection';
import { LocationBar } from '@/components/home/LocationBar';
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
import { resolveWeatherPlace } from '@/utils/geocode';
import { getPlantPhoto } from '@/utils/plantImage';
import { supabase } from '@/lib/supabase';
import { postgresToPlant, onPlantsChange, PlantService } from '@/services/plantService';
import { StorageService } from '@/services/storageService';
import type { Plant, SoilType } from '@/types';

import { useNavigate, Link } from 'react-router-dom';
import { usePageTransition } from '@/components/home/PageTransitionContext';
import Landing from '@/components/home/Landing';


// ─── Welcome Landing (first-time visitors) ───────────────────────────
const ONBOARD_KEY = 'botanical_guardian_onboarded';


// ─── Main Dashboard ────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { transitionTo } = usePageTransition();
  const { timeOfDay } = useTimeOfDay();
  const { theme } = useDayNightTheme();
  const { ecoModeActive } = useEcoMode();
  const { location, city, error: locationError, locating, updateCity, requestLocation } = useGeolocation();
  const [weather, setWeather] = useState<any>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Onboarding gate. The flag flips on account creation (Auth.tsx) or Supabase
  // session hydration (Layout.tsx) — never from the landing, whose every CTA
  // now leads to /auth. A signed-out visitor should not be able to walk into
  // the Keeper dashboard.
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARD_KEY) === '1');

  // Local override state for ambient time selection
  const [timePeriodOverride, setTimePeriodOverride] = useState<TimePeriod | null>(null);
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
          onAddPlant={() => setIsAddModalOpen(true)}
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

function AddPlantModal({
  isOpen,
  onClose,
  onScanRedirect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScanRedirect: () => void;
}) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [soilType, setSoilType] = useState<SoilType>('well-draining');
  const [potSize, setPotSize] = useState('10 inch');
  const [location, setLocation] = useState('Conservatory');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [existingPlants, setExistingPlants] = useState<Plant[]>([]);
  const [parentPlantId, setParentPlantId] = useState('');
  const [propagationMethod, setPropagationMethod] = useState<Plant['propagationMethod']>(null);

  useEffect(() => {
    if (isOpen) PlantService.fetchPlants().then(setExistingPlants);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !species.trim()) {
      setFormError('Please enter both specimen name and species.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    let uploadedPhotoUrl = '';

    try {
      if (photoFile) {
        setUploadingPhoto(true);
        const { data: { session } } = (await supabase?.auth?.getSession()) || { data: { session: null } };
        const activeUserId = session?.user?.id || GameService.getUserId();
        const cloudUrl = await StorageService.uploadPlantPhoto(photoFile, activeUserId);
        if (cloudUrl) {
          uploadedPhotoUrl = cloudUrl;
        }
      }
    } catch (err: any) {
      console.warn('Storage upload error:', err);
    } finally {
      setUploadingPhoto(false);
    }

    try {
      await PlantService.addPlant({
        name: name.trim(),
        species: species.trim(),
        soilType,
        potSize: potSize.trim(),
        location: location.trim(),
        guardianScore: 92,
        status: 'Stable',
        photoUrl: uploadedPhotoUrl,
        parentPlantId: parentPlantId || null,
        propagationMethod: parentPlantId ? propagationMethod : null,
      });
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to inscribe specimen to Supabase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-md rounded-2xl border border-[#c5a059]/40 bg-[#faf6ee] dark:bg-[#1a140e] p-6 shadow-2xl text-left z-10"
      >
        <div className="flex items-center justify-between mb-4 border-b border-[#dcd2c0] dark:border-[#3d2e20] pb-3">
          <div>
            <h3 className="font-serif font-black text-xl text-[#2b2118] dark:text-[#f4eee1]">
              Inscribe New Specimen
            </h3>
            <p className="text-xs text-[#725e4c] dark:text-[#b8a695] font-serif italic">
              Persisted directly to Supabase Postgres with RLS
            </p>
          </div>

          {existingPlants.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695]">
                Propagated from
                <select value={parentPlantId} onChange={e => setParentPlantId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#dcd2c0] bg-white px-2 py-2 text-xs dark:bg-[#251d16]">
                  <option value="">New root specimen</option>
                  {existingPlants.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695]">
                Method
                <select value={propagationMethod || ''} onChange={e => setPropagationMethod((e.target.value || null) as Plant['propagationMethod'])} disabled={!parentPlantId} className="mt-1 w-full rounded-lg border border-[#dcd2c0] bg-white px-2 py-2 text-xs disabled:opacity-50 dark:bg-[#251d16]">
                  <option value="">Choose method</option>
                  <option value="cutting">Cutting</option>
                  <option value="division">Division</option>
                  <option value="seed">Seed</option>
                  <option value="offset">Offset</option>
                </select>
              </label>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-xs font-mono font-bold text-[#8c6e38] hover:text-[#2b2118] dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-mono">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="specimen-designation-nickname" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
              Specimen Designation / Nickname
            </label>
            <input id="specimen-designation-nickname"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Empress Monstera"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
            />
          </div>

          <div>
            <label htmlFor="botanical-species" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
              Botanical Species
            </label>
            <input id="botanical-species"
              type="text"
              required
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. Monstera deliciosa"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
            />
          </div>

          <div>
            <label htmlFor="specimen-photograph-cloud-storage" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
              Specimen Photograph (Cloud Storage)
            </label>
            <input id="specimen-photograph-cloud-storage"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhotoFile(f);
                  setPhotoPreview(URL.createObjectURL(f));
                }
              }}
              className="w-full text-xs text-[#725e4c] dark:text-[#b8a695] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#2e4a34] file:text-[#f4eee1] hover:file:bg-[#395c41] cursor-pointer"
            />
            {photoPreview && (
              <div className="mt-2 relative w-14 h-14 rounded-lg overflow-hidden border border-[#c5a059]/40">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="substrate-type" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
                Substrate Type
              </label>
              <select id="substrate-type"
                value={soilType || ''}
                onChange={(e) => setSoilType(e.target.value as SoilType)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
              >
                <option value="well-draining">Well Draining</option>
                <option value="loamy">Loamy</option>
                <option value="peaty">Peaty</option>
                <option value="sandy">Sandy</option>
                <option value="clay">Clay</option>
              </select>
            </div>

            <div>
              <label htmlFor="pot-vessel" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
                Pot Vessel
              </label>
              <input id="pot-vessel"
                type="text"
                value={potSize}
                onChange={(e) => setPotSize(e.target.value)}
                placeholder="10 inch terracotta"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sanctuary-station-room" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
              Sanctuary Station / Room
            </label>
            <input id="sanctuary-station-room"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Living Room Solarium"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl font-serif font-bold text-xs uppercase tracking-wider bg-[#2e4a34] hover:bg-[#395c41] text-[#f4eee1] transition-all disabled:opacity-50"
            >
              {uploadingPhoto ? 'Uplinking photo to vault...' : submitting ? 'Inscribing to Supabase...' : 'Save Specimen to Cloud'}
            </button>

            <button
              type="button"
              onClick={onScanRedirect}
              className="w-full py-2 text-[11px] font-mono font-semibold text-[#8c6e38] hover:underline text-center"
            >
              Or capture & diagnose via Wet Lab Camera →
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
