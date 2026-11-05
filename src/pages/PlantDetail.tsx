import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Calendar, ShieldCheck, Activity, AlertCircle, Droplets, Sun, TrendingUp, TrendingDown, Minus, Box, Camera, Clock, Sprout, Crown, Zap, Plus, Loader2, Book, Send, Share2, Microscope, AlertTriangle, PawPrint } from 'lucide-react';
import { lookupToxicity, aspcaLookupUrl } from '../data/toxicity';
import { db, type PlantNote } from '../db/database';
import { useAppBack } from '../hooks/useAppBack';
import { useLiveQuery } from 'dexie-react-hooks';
import GuardianScoreRing from '../components/GuardianScoreRing';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { GameService } from '../services/gameService';
import { PlantService, onPlantsChange } from '../services/plantService';
import { RECOVERY_MILESTONES, type RecoveryMilestoneKind } from '../services/rewardService';
import { ExternalLink, BookOpen, Video, Users, Leaf, Bug } from 'lucide-react';
import type { Plant } from '../types';
import { getPlantPhoto } from '../utils/plantImage';
import PageWrapper from '../components/home/PageWrapper';
import { usePageTransition } from '../components/home/PageTransitionContext';
import { useToast } from '../components/Toast';
import PlantVoiceBubble from '../components/PlantVoiceBubble';
import { generatePlantVoice, type PlantVoice } from '../services/plantVoiceService';
import GrowthForecastCard from '../components/GrowthForecastCard';
import { forecastGrowth, type GrowthForecast } from '../services/growthForecastService';
import NotificationOptIn from '../components/NotificationOptIn';
import CheckInFlow from '../components/CheckInFlow';
import { renderShareCard, shareCaption } from '../lib/cardShareImage';
import { shareCard } from '../lib/share';
import { deriveToleranceProfile, inferLightFromWeather, simulateMicroclimate, vitalityAfterWatering } from '../lib/environmentalSimulation';
import { getCachedWeather, type WeatherData } from '../services/weatherService';
import { useGeolocation } from '../hooks/useGeolocation';
import RecoveryRoadmapWidget from '../components/scan/RecoveryRoadmapWidget';


const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as any }
  }
};

export default function PlantDetail() {
  const { id } = useParams();
  const { transitionTo } = usePageTransition();
  // Same resolver the header uses. A shared plant link opened cold has no
  // history to walk, and this is exactly that case -- navigate(-1) would have
  // stranded the reader, while here it lands in the Vault the plant lives in.
  const { target: backTarget, goBack } = useAppBack();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<'timeline' | 'journal' | 'alerts' | 'notebook'>('timeline');
  const [propagating, setPropagating] = useState(false);
  const [useHybrid, setUseHybrid] = useState(false);
  const [propCount, setPropCount] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<PlantNote['category']>('observation');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PlantNote['category'] | 'all'>('all');
  const [voice, setVoice] = useState<PlantVoice | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [forecast, setForecast] = useState<GrowthForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [plant, setPlant] = useState<Plant | undefined>();
  // Field guides (SerpApi, fetched on demand — never on mount). The server
  // shares one fetch per species per week; the client caches its copy for
  // the same window so repeat visits cost nothing at all.
  const [careGuides, setCareGuides] = useState<{ title: string; source: string; url: string; summary: string }[] | null>(null);
  const [careGuideNote, setCareGuideNote] = useState<string | null>(null);
  const [careGuideLoading, setCareGuideLoading] = useState(false);

  const loadCareGuide = async () => {
    if (!plant?.species || careGuideLoading) return;
    const key = `phyto_care_guide_${plant.species.toLowerCase().trim()}`;
    try {
      const cachedRaw = sessionStorage.getItem(key);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { at: number; guides: typeof careGuides; note: string | null };
        if (Date.now() - cached.at < 7 * 86_400_000 && cached.guides) {
          setCareGuides(cached.guides);
          setCareGuideNote(cached.note);
          return;
        }
      }
    } catch { /* private mode — fetch live */ }
    setCareGuideLoading(true);
    try {
      const res = await fetch(`/api/library/care-guide?species=${encodeURIComponent(plant.species)}`);
      const data = await res.json();
      // Same as the video loader: a non-OK response (rate limit, outage)
      // carries an `error` body — surface it rather than a silent empty list.
      setCareGuides(data.guides ?? []);
      setCareGuideNote(data.error ?? data.note ?? null);
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), guides: data.guides ?? [], note: data.error ?? data.note ?? null })); } catch { /* noop */ }
    } catch (err) {
      console.error('[PlantDetail] care guide fetch failed:', err);
      setCareGuideNote('Care-guide lookup failed.');
    } finally {
      setCareGuideLoading(false);
    }
  };

  // Video tutorials (SerpApi youtube engine) — the care-guide pattern with a
  // 30-day window: the server shares one fetch per species per month, the
  // client caches its copy for the same window.
  const [videos, setVideos] = useState<{ title: string; url: string; thumbnail: string | null; channel: string | null; views: string | null; published: string | null; length: string | null }[] | null>(null);
  const [videosNote, setVideosNote] = useState<string | null>(null);
  const [videosLoading, setVideosLoading] = useState(false);

  const loadVideos = async () => {
    if (!plant?.species || videosLoading) return;
    const key = `phyto_species_videos_${plant.species.toLowerCase().trim()}`;
    try {
      const cachedRaw = sessionStorage.getItem(key);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { at: number; videos: typeof videos; note: string | null };
        if (Date.now() - cached.at < 30 * 86_400_000 && cached.videos) {
          setVideos(cached.videos);
          setVideosNote(cached.note);
          return;
        }
      }
    } catch { /* private mode — fetch live */ }
    setVideosLoading(true);
    try {
      const res = await fetch(`/api/library/videos?species=${encodeURIComponent(plant.species)}`);
      const data = await res.json();
      // A non-OK response (rate limit, outage) carries an `error` body, not
      // `videos` — swallowing it into an empty list would render a silent
      // empty section instead of an honest explanation.
      setVideos(data.videos ?? []);
      setVideosNote(data.error ?? data.note ?? null);
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), videos: data.videos ?? [], note: data.error ?? data.note ?? null })); } catch { /* noop */ }
    } catch (err) {
      console.error('[PlantDetail] video lookup failed:', err);
      setVideosNote('Video lookup failed.');
    } finally {
      setVideosLoading(false);
    }
  };

  // Community threads (SerpApi, real Reddit posts — never simulated). The
  // issue phrase comes from the plant's own state: a struggling plant asks
  // about problems, a healthy one about care. 7-day window on both caches.
  const [threads, setThreads] = useState<{ title: string; url: string; snippet: string; subreddit: string | null }[] | null>(null);
  const [threadsNote, setThreadsNote] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const communityIssue = useMemo(
    () => (plant && plant.status !== 'Stable' ? `${plant.species} problem care help` : ''),
    [plant?.species, plant?.status],
  );

  const loadThreads = async () => {
    if (!plant?.species || threadsLoading) return;
    const key = `phyto_community_${plant.species.toLowerCase().trim()}_${communityIssue.toLowerCase().trim()}`;
    try {
      const cachedRaw = sessionStorage.getItem(key);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { at: number; threads: typeof threads; note: string | null };
        if (Date.now() - cached.at < 7 * 86_400_000 && cached.threads) {
          setThreads(cached.threads);
          setThreadsNote(cached.note);
          return;
        }
      }
    } catch { /* private mode — fetch live */ }
    setThreadsLoading(true);
    try {
      const params = new URLSearchParams({ species: plant.species });
      if (communityIssue) params.set('issue', communityIssue);
      const res = await fetch(`/api/library/community?${params.toString()}`);
      const data = await res.json();
      // Same as the other content loaders: a non-OK response (rate limit,
      // outage) carries an `error` body — surface it, never a silent empty.
      setThreads(data.threads ?? []);
      setThreadsNote(data.error ?? data.note ?? null);
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), threads: data.threads ?? [], note: data.error ?? data.note ?? null })); } catch { /* noop */ }
    } catch (err) {
      console.error('[PlantDetail] community lookup failed:', err);
      setThreadsNote('Community lookup failed.');
    } finally {
      setThreadsLoading(false);
    }
  };

  // Conservation status (SerpApi heuristic read — the UI labels it as a
  // hint and links to the source for the authoritative answer). 180-day
  // window: IUCN/CITES classifications barely move.
  const [conservation, setConservation] = useState<{ species: string; status: string | null; protected: boolean; citesListed: boolean; description: string | null; source: string; url: string; lastUpdated: string | null } | null>(null);
  const [conservationNote, setConservationNote] = useState<string | null>(null);
  const [conservationLoading, setConservationLoading] = useState(false);

  const loadConservation = async () => {
    if (!plant?.species || conservationLoading) return;
    const key = `phyto_conservation_${plant.species.toLowerCase().trim()}`;
    try {
      const cachedRaw = sessionStorage.getItem(key);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { at: number; status: typeof conservation; note: string | null };
        if (Date.now() - cached.at < 180 * 86_400_000 && cached.status !== undefined) {
          setConservation(cached.status);
          setConservationNote(cached.note);
          return;
        }
      }
    } catch { /* private mode — fetch live */ }
    setConservationLoading(true);
    try {
      const res = await fetch(`/api/library/conservation?species=${encodeURIComponent(plant.species)}`);
      const data = await res.json();
      setConservation(data.status ?? null);
      setConservationNote(data.error ?? data.note ?? null);
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), status: data.status ?? null, note: data.error ?? data.note ?? null })); } catch { /* noop */ }
    } catch (err) {
      console.error('[PlantDetail] conservation lookup failed:', err);
      setConservationNote('Conservation lookup failed.');
    } finally {
      setConservationLoading(false);
    }
  };

  // Pest-treatment research — gated on a diagnosis: without one there is no
  // pest to research, and a generic "pest treatments" list would be filler.
  const diagnosis = plant?.recoveryRoadmap?.diagnosis?.trim() || null;
  const [treatments, setTreatments] = useState<{ treatment: string; source: string; url: string; summary: string; effectiveness: string | null }[] | null>(null);
  const [treatmentsNote, setTreatmentsNote] = useState<string | null>(null);
  const [treatmentsLoading, setTreatmentsLoading] = useState(false);

  const loadTreatments = async () => {
    if (!plant?.species || !diagnosis || treatmentsLoading) return;
    const key = `phyto_pest_treatments_${diagnosis.toLowerCase().trim()}_${plant.species.toLowerCase().trim()}`;
    try {
      const cachedRaw = sessionStorage.getItem(key);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { at: number; treatments: typeof treatments; note: string | null };
        if (Date.now() - cached.at < 14 * 86_400_000 && cached.treatments) {
          setTreatments(cached.treatments);
          setTreatmentsNote(cached.note);
          return;
        }
      }
    } catch { /* private mode — fetch live */ }
    setTreatmentsLoading(true);
    try {
      const params = new URLSearchParams({ pest: diagnosis, species: plant.species });
      const res = await fetch(`/api/library/pest-treatments?${params.toString()}`);
      const data = await res.json();
      setTreatments(data.treatments ?? []);
      setTreatmentsNote(data.error ?? data.note ?? null);
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), treatments: data.treatments ?? [], note: data.error ?? data.note ?? null })); } catch { /* noop */ }
    } catch (err) {
      console.error('[PlantDetail] treatment research failed:', err);
      setTreatmentsNote('Treatment research failed.');
    } finally {
      setTreatmentsLoading(false);
    }
  };
  const [plantLoading, setPlantLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  // The daily check-in. This flow was fully built (real HSV drift analysis
  // against the plant's baseline, a real check-in row, a real guardian score)
  // but had no entry point anywhere in the app, so the "track it over time"
  // leg of the core loop had no surface: check-ins only ever existed as a
  // side effect of a scan.
  const [checkInOpen, setCheckInOpen] = useState(false);
  // A completed check-in rewrites guardianScore, status and baseline, so the
  // page has to re-read the plant rather than keep showing the pre-check-in
  // numbers. The chart is a live query and updates itself; this is the header.
  const [checkInsTaken, setCheckInsTaken] = useState(0);

  useEffect(() => {
    if (!id) {
      setPlantLoading(false);
      return;
    }
    setPlantLoading(true);
    PlantService.getPlant(id).then(p => setPlant(p || undefined)).finally(() => setPlantLoading(false));
    return onPlantsChange(() => {
      PlantService.getPlant(id).then(p => setPlant(p || undefined));
    });
  }, [id]);

  const history = useLiveQuery(() => id ? db.checkins.where('plantId').equals(id).sortBy('timestamp') : [], [id]);
  const predictions = useLiveQuery(() => id ? db.predictions.where('plantId').equals(id).sortBy('predictedAt') : [], [id]);
  const notes = useLiveQuery(() => id ? db.notes.where('plantId').equals(id).reverse().sortBy('createdAt') : [], [id]);
  const profile = useLiveQuery(() => GameService.getProfile());

  useEffect(() => {
    const loadProps = async () => {
      const count = await GameService.getPropagationsThisMonth();
      setPropCount(count);
    };
    loadProps();
  }, []);

  const card = useLiveQuery(() => id ? db.cards.where('plantId').equals(id).first() : undefined, [id]);
  const lineage = useLiveQuery(() => PlantService.fetchPlants(), []);

  // The history query is live, so the count follows a new check-in without a
  // reload. The plant header does not, hence the explicit re-read on close.
  useEffect(() => {
    if (history) setCheckInsTaken(history.length);
  }, [history]);

  const closeCheckIn = useCallback(() => {
    setCheckInOpen(false);
    if (!id) return;
    PlantService.getPlant(id).then(p => setPlant(p || undefined));
  }, [id]);

  const latestCheckIn = history?.[history.length - 1];
  const driftStatus = latestCheckIn?.driftStatus === 'alert' ? 'critical' : latestCheckIn?.driftStatus === 'watching' ? 'declining' : 'stable';
  // Runs before the `!plant` guard below, so it must tolerate an unresolved plant:
// once `lineage` resolves to an array, `plant.id` would throw on a bad id.
const children = lineage?.filter(candidate => candidate.parentPlantId === plant?.id) || [];
  const generateVoice = async () => {
    if (!latestCheckIn || voiceLoading) return;
    setVoiceLoading(true);
    try {
      setVoice(await generatePlantVoice({
        diagnosis: { primarySymptom: latestCheckIn.changes.join(', ') || 'no visible changes' },
        plantName: plant.name,
        species: plant.species,
        driftStatus,
        previousMessage: voice?.message,
      }));
    } catch (err) {
      error(err instanceof Error ? err.message : 'Could not hear from the plant.');
    } finally {
      setVoiceLoading(false);
    }
  };

  // ── Share loop ──
  // Renders this specimen as a story-sized card and hands it to the native
  // share sheet. This is the app's growth loop: a card posted to a story or
  // group chat is an invitation that carries proof (rarity, streak, score)
  // instead of an ad.
  const shareThisPlant = async () => {
    if (!plant || sharing) return;
    setSharing(true);
    try {
      const daysAlive = card?.daysAlive
        ?? Math.max(1, Math.floor((Date.now() - new Date(plant.acquiredAt).getTime()) / 86_400_000));
      const data = {
        name: plant.name,
        species: plant.species,
        rarity: card?.rarity ?? ('common' as const),
        photoUrl: plant.photoUrl,
        daysAlive,
        checkIns: card?.checkInsTotal ?? history?.length ?? 0,
        guardianScore: plant.guardianScore ?? 0,
        streak: card?.currentStreak ?? profile?.currentStreak ?? 0,
      };
      const blob = await renderShareCard(data);
      const slug = plant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'plant';
      const outcome = await shareCard({
        blob,
        fileName: `phytodoctor-${slug}.png`,
        caption: shareCaption(data),
        url: 'https://phytodoctor-ai.onrender.com',
      });
      if (outcome === 'shared') success('Card sent to your share sheet — post it! 🌿');
      else if (outcome === 'shared-link') success('Share sheet opened.');
      else success('Link copied and card saved — ready to post.');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Could not share this plant.');
    } finally {
      setSharing(false);
    }
  };
  const generateForecast = async () => {
    if (!history || history.length < 3 || forecastLoading) return;
    setForecastLoading(true);
    try {
      setForecast(await forecastGrowth({
        plantId: plant.id,
        species: plant.species,
        checkInHistory: history.slice(-10).map(checkIn => ({
          date: checkIn.timestamp.toISOString(),
          driftScore: checkIn.driftScore,
          driftStatus: checkIn.driftStatus,
          symptoms: checkIn.changes,
        })),
      }));
    } catch (err) {
      error(err instanceof Error ? err.message : 'Could not generate a forecast.');
    } finally {
      setForecastLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;
    
    await db.notes.add({
      id: crypto.randomUUID(),
      plantId: id,
      userId: 'local_user',
      content: newNote,
      category: noteCategory,
      tags: noteTags,
      createdAt: new Date()
    });
    
    setNewNote('');
    setNoteTags([]);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!noteTags.includes(tagInput.trim())) {
        setNoteTags([...noteTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setNoteTags(noteTags.filter(t => t !== tag));
  };

  const toggleSelectedTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const allTags = Array.from(new Set(notes?.flatMap(n => n.tags || []) || []));

  const filteredNotes = notes?.filter(note => {
    const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    const matchesTags = selectedTags.length === 0 || selectedTags.every(t => note.tags?.includes(t));
    return matchesSearch && matchesCategory && matchesTags;
  }) || [];

  const handlePropagate = async () => {
    if (!card) return;
    setPropagating(true);
    try {
      const result = await GameService.propagate(card.id, useHybrid);
      if (result.success) {
        success('Success! A new sprout has been registered in your Vault.');
      } else {
        error('Propagation failed. The genetic lineage was too weak this time.');
      }
      const count = await GameService.getPropagationsThisMonth();
      setPropCount(count);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Propagation failed');
    } finally {
      setPropagating(false);
    }
  };

  const chartData = history?.map(h => ({
    day: h.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: h.guardianScore
  })) || [];

  const propLimit = profile?.tier === 'pro' ? 5 : 1;

  const { location: userGeo } = useGeolocation();
  const [locationWeather, setLocationWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const lat = plant?.latitude ?? userGeo?.latitude;
    const lon = plant?.longitude ?? userGeo?.longitude;
    if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
      getCachedWeather(lat, lon).then(w => setLocationWeather(w)).catch(() => {});
    }
  }, [plant?.latitude, plant?.longitude, userGeo?.latitude, userGeo?.longitude]);

  // Seed baseline from latest check-in weather (first priority) or location weather (fallback)
  const baselineTemp = typeof latestCheckIn?.weatherTemp === 'number' && Number.isFinite(latestCheckIn.weatherTemp)
    ? Math.round(latestCheckIn.weatherTemp)
    : typeof locationWeather?.temperature === 'number' && Number.isFinite(locationWeather.temperature)
      ? Math.round(locationWeather.temperature)
      : 22;

  const baselineHumidity = typeof latestCheckIn?.weatherHumidity === 'number' && Number.isFinite(latestCheckIn.weatherHumidity)
    ? Math.round(latestCheckIn.weatherHumidity)
    : typeof locationWeather?.humidity === 'number' && Number.isFinite(locationWeather.humidity)
      ? Math.round(locationWeather.humidity)
      : (latestCheckIn?.soilMoisture === 'Wet' ? 75 : latestCheckIn?.soilMoisture === 'Dry' ? 35 : 55);

  const baselineLight = (latestCheckIn?.weatherDescription ? inferLightFromWeather(latestCheckIn.weatherDescription) : null)
    ?? (locationWeather?.description ? inferLightFromWeather(locationWeather.description) : null)
    ?? latestCheckIn?.lightLevel
    ?? 'Indirect';

  const hasLiveWeatherSeed = (typeof latestCheckIn?.weatherHumidity === 'number' && Number.isFinite(latestCheckIn.weatherHumidity))
    || (typeof locationWeather?.humidity === 'number' && Number.isFinite(locationWeather.humidity));

  // Real-time microclimate simulation state
  const [simTemp, setSimTemp] = useState<number>(baselineTemp);
  const [simHumidity, setSimHumidity] = useState<number>(baselineHumidity);
  const [simLight, setSimLight] = useState<'Low' | 'Indirect' | 'Direct'>(baselineLight);
  const [userEditedSim, setUserEditedSim] = useState(false);
  const [wateringLogging, setWateringLogging] = useState(false);

  useEffect(() => {
    if (!userEditedSim) {
      setSimTemp(baselineTemp);
      setSimHumidity(baselineHumidity);
      setSimLight(baselineLight);
    }
  }, [baselineTemp, baselineHumidity, baselineLight, userEditedSim]);

  const toleranceProfile = useMemo(
    () => deriveToleranceProfile(plant?.species || 'Plant'),
    [plant?.species]
  );

  // Pet & human toxicity — curated ASPCA-sourced verdict (static; see
  // src/data/toxicity.ts). null = the database has no verdict for this
  // species, and the card renders nothing rather than guessing.
  const toxicity = useMemo(
    () => (plant?.species ? lookupToxicity(plant.species) : null),
    [plant?.species]
  );

  const simResult = useMemo(
    () => simulateMicroclimate({ temperatureC: simTemp, humidityPct: simHumidity, lightLevel: simLight }, toleranceProfile),
    [simTemp, simHumidity, simLight, toleranceProfile]
  );

  const wateringInterval = plant?.wateringIntervalDays || 7;
  const nextWaterDate = plant?.nextWaterDue
    ? new Date(plant.nextWaterDue)
    : new Date(new Date(plant?.acquiredAt || Date.now()).getTime() + wateringInterval * 86_400_000);
  const daysUntilWater = Math.ceil((nextWaterDate.getTime() - Date.now()) / 86_400_000);

  const treatmentTimeline = useMemo(() => {
    if (plant?.recoveryRoadmap?.timeline && plant.recoveryRoadmap.timeline.length > 0) {
      return plant.recoveryRoadmap.timeline;
    }
    return [
      {
        day: 'Day 1-3',
        action: 'Substrate Saturation & Root Hypoxia Audit',
        expectedOutcome: 'Calibrate moisture gradient; prevent rhizosphere fungal stagnation.',
      },
      {
        day: 'Day 7',
        action: 'Foliar Hygiene & Light Exposure Balancing',
        expectedOutcome: 'Optimize transpiration rate and light capture efficiency.',
      },
      {
        day: 'Day 14',
        action: 'Cellular Turgor & Vigor Milestone Review',
        expectedOutcome: 'Ascertain leaf tensile strength and new apical meristem emergence.',
      },
    ];
  }, [plant?.recoveryRoadmap]);

  const handleLogWatering = async () => {
    if (!plant || !id || wateringLogging) return;
    setWateringLogging(true);
    try {
      const now = new Date();
      const newScore = vitalityAfterWatering(plant.guardianScore);
      await PlantService.waterPlant(id, now, wateringInterval, {
        guardianScore: newScore,
        checkInTime: 'just now',
      });
      await db.checkins.add({
        id: crypto.randomUUID(),
        plantId: id,
        timestamp: now,
        soilMoisture: 'Moist',
        lightLevel: latestCheckIn?.lightLevel || 'Indirect',
        changes: ['Scheduled hydration administered'],
        photoBlob: null,
        photoUrl: plant.photoUrl,
        signature: null,
        guardianScore: newScore,
        driftScore: null,
        driftStatus: 'stable',
        weatherTemp: typeof locationWeather?.temperature === 'number' && Number.isFinite(locationWeather.temperature) ? Math.round(locationWeather.temperature) : null,
        weatherHumidity: typeof locationWeather?.humidity === 'number' && Number.isFinite(locationWeather.humidity) ? Math.round(locationWeather.humidity) : null,
        weatherDescription: locationWeather?.description || 'Hydration Logged',
        synced: 0,
      });
      try {
        await GameService.earnSeeds(15, 'checkin', `Hydration logged for ${plant.name}`);
      } catch {
        // cap handled
      }
      success(`Hydration recorded for ${plant.name}. Next due in ${wateringInterval} days.`);
      PlantService.getPlant(id).then(p => setPlant(p || undefined));
    } catch {
      error('Could not log hydration. Please try again.');
    } finally {
      setWateringLogging(false);
    }
  };

  // Safe early exit placed after all hooks have executed unconditionally
  if (!plant) {
    if (plantLoading) {
      return <div className="p-20 text-center font-serif text-2xl">Loading specimen dossier...</div>;
    }
    return (
      <div className="p-20 text-center space-y-4">
        <h1 className="font-serif text-3xl">Specimen not found</h1>
        <p className="text-sm opacity-70 max-w-md mx-auto">
          This dossier is no longer in your conservatory. It may have been removed on
          another device, or the link may belong to a different account.
        </p>
        <a
          href="/"
          className="inline-block font-black text-xs uppercase tracking-[0.16em] px-6 py-3 border border-current rounded-sm"
        >
          Return to the sanctuary
        </a>
      </div>
    );
  }

  return (
    <PageWrapper className="min-h-screen skin-specimen pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Navigation & Accession Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <button
            onClick={goBack}
            aria-label={backTarget.label}
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-[#c4b193] hover:text-white transition-colors group px-3 py-1.5 rounded-lg bg-black/20 border border-[#c4b193]/20"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform text-[#c5a059]" />
            <span>Return to Conservatory Bench</span>
          </button>
          
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-md bg-black/40 border border-[#c5a059]/30 text-[10px] font-mono tracking-widest text-[#d8bc78] shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#52b788] animate-pulse" />
            <span>ACCESSION FILE #{id ? id.slice(0, 8).toUpperCase() : 'UNKNOWN'} // HERBARIUM DOSSIER</span>
          </div>
        </div>

        {/* Outer Manila Field Binder Cover */}
        <div className="dossier-binder-cover rounded-[2rem] md:rounded-[2.5rem] p-6 sm:p-10 md:p-14 relative shadow-2xl">
          {latestCheckIn && (
            <div className="mb-8">
              {voice ? <PlantVoiceBubble voice={voice} plantName={plant.name} /> : (
                <button onClick={generateVoice} disabled={voiceLoading} className="rounded-xl border border-[#c5a059]/30 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[#d8bc78] disabled:opacity-50">
                  {voiceLoading ? 'Listening...' : 'Hear the plant’s voice'}
                </button>
              )}
              {(plant.generation && plant.generation > 1 || children.length > 0) && (
                <div className="mb-8 rounded-2xl border border-[#c5a059]/20 bg-black/15 p-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#d8bc78]">
                    <Sprout size={16} aria-hidden="true" />
                    <span>Generation {plant.generation || 1}</span>
                    {plant.propagationMethod && <span className="text-[#cbbda8]">via {plant.propagationMethod}</span>}
                    {children.length > 0 && <span className="text-[#cbbda8]">{children.length} descendant{children.length === 1 ? '' : 's'}</span>}
                  </div>
                </div>
              )}
              <div className="mb-8 rounded-2xl border border-[#c5a059]/20 bg-black/15 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl text-[#f4eee1]">Growth forecast</h3>
                  <button onClick={generateForecast} disabled={history.length < 3 || forecastLoading} className="rounded-lg border border-[#c5a059]/30 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#d8bc78] disabled:opacity-50">
                    {forecastLoading ? 'Forecasting...' : history.length < 3 ? 'Need 3 check-ins' : 'Generate'}
                  </button>
                </div>
                {forecast && <GrowthForecastCard forecast={forecast} />}
              </div>
              <div className="mb-8"><NotificationOptIn /></div>
            </div>
          )}
          {card?.battleScars.length ? (
            <details className="mb-6 rounded-xl border border-[#c5a059]/30 bg-black/20 p-3 text-[#d8bc78]">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-widest">
                Resilience record · {card.battleScars.length} survived {card.battleScars.length === 1 ? 'crisis' : 'crises'}
              </summary>
              <ul className="mt-3 space-y-1 text-xs text-[#e8d7b0]">
                {card.battleScars.map((scar, index) => <li key={`${scar.recoveredAt ?? index}-${index}`}>{typeof scar === 'string' ? scar : scar.symptom}</li>)}
              </ul>
            </details>
          ) : null}
          {/* Top Brass Fastener Prongs */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-20 pointer-events-none z-20">
            <div className="w-12 h-6 dossier-prong dossier-prong-left" title="Binder Fastener" />
            <div className="w-12 h-6 dossier-prong dossier-prong-right" title="Binder Fastener" />
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-12"
          >
            {/* Specimen Header & Physical Field Plate */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
              {/* Left Column: Framed Archival Specimen Plate */}
              <div className="lg:col-span-5">
                <div className="dossier-specimen-mat rounded-[1.5rem] p-3 md:p-4 relative group">
                  {/* Brass Photo Corner Mounts */}
                  <div className="photo-corner-mount photo-corner-mount-tl" />
                  <div className="photo-corner-mount photo-corner-mount-tr" />
                  <div className="photo-corner-mount photo-corner-mount-bl" />
                  <div className="photo-corner-mount photo-corner-mount-br" />

                  <div className="relative h-[380px] sm:h-[440px] rounded-[1rem] overflow-hidden bg-[#241d16]">
                    <img 
                      src={getPlantPhoto(plant.photoUrl, plant.species)} 
                      alt={plant.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter contrast-[1.02]" 
                      onError={(e) => { (e.target as HTMLImageElement).src = getPlantPhoto(null, plant.species); }} 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a140f]/90 via-transparent to-black/20" />
                    
                    {/* Accession Seal Overlay */}
                    <div className="absolute top-4 left-4">
                      <div className="px-3 py-1.5 bg-[#fbf8f0]/95 backdrop-blur-md rounded-md text-[9px] font-mono uppercase tracking-widest text-[#4a3525] border border-[#c5a059]/50 shadow-md flex items-center gap-1.5">
                        <Calendar size={11} className="text-[#c5a059]" />
                        <span>Acquired: {new Date(plant.acquiredAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Binomial Plate at Bottom */}
                    <div className="absolute bottom-4 left-4 right-4 p-3 bg-[#fdfbf7]/90 backdrop-blur-md rounded-lg border border-[#cbb898] shadow-lg text-center">
                      <p className="text-[11px] font-serif font-black tracking-wide text-[#2e2117] italic">{plant.species}</p>
                      <p className="text-[9px] font-mono uppercase tracking-widest text-[#7c6953]">Living Specimen Herbarium Index</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Specimen Metrics & Workbenches */}
              <div className="lg:col-span-7 space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-[#c5a059]" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#8c7355]">Living Specimen Dossier</span>
                  </div>
                  <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-black text-[#2e2117] tracking-tight mb-2">
                    {plant.name}
                  </h1>
                  <p className="text-xl sm:text-2xl text-[#6b5843] italic font-serif">
                    {plant.species}
                  </p>

                  {/* The growth loop: this card is the invitation. */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={shareThisPlant}
                      disabled={sharing}
                      className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#244b2f] hover:bg-[#2d5c3a] text-[#f4eee1] text-[11px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-60"
                    >
                      {sharing
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Share2 size={14} />}
                      {sharing ? 'Growing your card…' : 'Share this find'}
                    </button>

                    {/* The daily loop: look at the plant again tomorrow. */}
                    <button
                      onClick={() => setCheckInOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#c5a059] hover:bg-[#d4b169] text-[#2e2117] text-[11px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95"
                    >
                      <Camera size={14} />
                      Daily check-in
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-[#7a6855] italic">
                    {checkInsTaken > 0
                      ? `${checkInsTaken} check-in${checkInsTaken === 1 ? '' : 's'} logged. Photograph the plant again to track how it is doing.`
                      : 'No check-ins yet. Photograph the plant again to start its health timeline.'}
                  </p>
                </div>

                {/* Score & Status Plate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#fbf9f4] p-5 rounded-2xl border-2 border-[#d8ccb8] flex items-center gap-5 shadow-sm">
                    <GuardianScoreRing score={plant.guardianScore} size={72} />
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c]">Vigor & Stability</p>
                      <p className="text-lg font-serif font-bold text-[#2e2117]">
                        {plant.guardianScore >= 80 ? 'Optimal Vitality' : plant.guardianScore >= 50 ? 'Stable Condition' : 'Requires Attention'}
                      </p>
                      <p className="text-[10px] text-[#7a6855] italic">Score: {plant.guardianScore}/100</p>
                    </div>
                  </div>

                  <div className="bg-[#2a2017] p-5 rounded-2xl border-2 border-[#5a422e] text-[#f7f0e4] flex flex-col justify-between items-start gap-2 shadow-sm relative overflow-hidden">
                    <div className="w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-[#c4a574]">Clinical Status</span>
                        <ShieldCheck size={16} className="text-[#52b788]" />
                      </div>
                      <div className="mt-1 px-3 py-1 bg-[#52b788]/20 border border-[#52b788]/50 rounded text-[11px] font-mono font-bold uppercase tracking-wider text-[#7ae0aa] inline-block">
                        {plant.status || 'Active Guardian'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => transitionTo(`/lab?tab=pathology&plantId=${encodeURIComponent(plant.id)}`, 'Pathology Workbench')}
                      className="min-h-[44px] w-full px-3 py-2 bg-[#52b788]/15 hover:bg-[#52b788]/25 border border-[#52b788]/40 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider text-[#7ae0aa] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Microscope size={13} />
                      <span>Compare Leaf Pathology</span>
                    </button>
                  </div>
                </div>

                {/* Telemetry Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <DetailStat icon={<Droplets size={16} />} label="Soil Moisture" value={history?.[history.length-1]?.soilMoisture || 'Normal'} />
                  <DetailStat icon={<Sun size={16} />} label="Light Exposure" value={history?.[history.length-1]?.lightLevel || 'Filtered'} />
                  <DetailStat icon={<Clock size={16} />} label="Intake Cycle" value="Daily Review" />
                </div>

                {/* Art Synthesis Station
                    Removed: this station had no image model behind it. It wrote a
                    blurred picsum.photos URL into card.altArt and told the Keeper
                    "Neural Stylization" and "Genetic profile re-mapped into
                    consistent stylized art" -- a random photo, permanently, in the
                    user's own collection, described as generated art. PhytoCard falls
                    back to the plant's real photo when altArt is null, which is the
                    honest default. Reinstate this station only when a real
                    generation call is wired behind it. */}

                {/* Genetic Propagation Bench */}
                <div className="p-6 bg-[#eef4ee] rounded-2xl border border-[#b8d5b8] relative overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-[#1e3f20] flex items-center gap-2">
                      <Sprout size={14} className="text-[#3b7a40]" /> Cutting Cloche & Genetic Propagation
                    </h4>
                    <span className="text-[9px] font-mono text-[#3b7a40] uppercase tracking-wider">
                      Monthly Quota: <strong className={propCount >= propLimit ? 'text-red-600' : ''}>{propCount} / {propLimit}</strong>
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 items-center">
                    <button 
                      onClick={handlePropagate}
                      disabled={propagating || propCount >= propLimit || !card}
                      className="px-5 py-2.5 bg-[#2d5a30] text-white rounded-xl font-mono font-bold uppercase tracking-widest text-[10px] shadow hover:bg-[#1e3f20] transition-all flex items-center gap-2 disabled:opacity-40"
                    >
                      {propagating ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} className="text-yellow-300" />}
                      <span>Propagate Cutting (🌱 500 Seeds)</span>
                    </button>

                    {profile?.tier === 'pro' && (
                      <label className="flex items-center gap-2 cursor-pointer select-none bg-white/70 px-3 py-2 rounded-xl border border-[#b8d5b8]">
                        <input 
                          type="checkbox" 
                          checked={useHybrid} 
                          onChange={(e) => setUseHybrid(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-[#3b7a40] text-[#2d5a30] focus:ring-[#2d5a30]"
                        />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#1e3f20] flex items-center gap-1">
                          <Crown size={11} className="text-amber-500" /> Hybrid Mode Enabled
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Folder Index Tabs (Protruding Manila Dividers) */}
            <motion.div variants={itemVariants} className="pt-6">
              <div className="flex flex-wrap gap-2 border-b-2 border-[#b8a27e] mb-8">
                <button 
                  onClick={() => setActiveTab('timeline')} 
                  className={`dossier-tab-button px-5 py-3 text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === 'timeline' ? 'active' : ''
                  }`}
                >
                  <TrendingUp size={14} className={activeTab === 'timeline' ? 'text-[#c5a059]' : 'opacity-60'} />
                  <span>01 Health Timeline</span>
                </button>

                <button 
                  onClick={() => setActiveTab('journal')} 
                  className={`dossier-tab-button px-5 py-3 text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === 'journal' ? 'active' : ''
                  }`}
                >
                  <Camera size={14} className={activeTab === 'journal' ? 'text-[#c5a059]' : 'opacity-60'} />
                  <span>02 Photo Records</span>
                </button>

                <button 
                  onClick={() => setActiveTab('notebook')} 
                  className={`dossier-tab-button px-5 py-3 text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === 'notebook' ? 'active' : ''
                  }`}
                >
                  <Book size={14} className={activeTab === 'notebook' ? 'text-[#c5a059]' : 'opacity-60'} />
                  <span>03 Field Notebook</span>
                </button>

                <button 
                  onClick={() => setActiveTab('alerts')} 
                  className={`dossier-tab-button px-5 py-3 text-[11px] font-mono uppercase tracking-wider flex items-center gap-2 ${
                    activeTab === 'alerts' ? 'active' : ''
                  }`}
                >
                  <AlertCircle size={14} className={activeTab === 'alerts' ? 'text-[#c5a059]' : 'opacity-60'} />
                  <span>04 Diagnostic Alerts</span>
                </button>
              </div>

              {/* Tab Contents */}
              <AnimatePresence mode="wait">
                {/* 01 Health Timeline */}
                {activeTab === 'timeline' && (
                  <motion.div 
                    key="timeline"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="bg-[#fcfaf5] p-6 sm:p-10 rounded-2xl border-2 border-[#dcd0bd] shadow-md space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4d7c3] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#52b788]" />
                        <h3 className="font-serif font-bold text-lg text-[#2e2117]">Physiological Recovery & Score Telemetry</h3>
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c]">
                        Plot: 30-Day Chronological Check-Ins
                      </span>
                    </div>

                    <div className="h-[320px] sm:h-[380px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#52b788" stopOpacity={0.35}/>
                              <stop offset="95%" stopColor="#52b788" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dcd0bd" />
                          <XAxis 
                            dataKey="day" 
                            axisLine={{ stroke: '#b8a27e' }} 
                            tickLine={{ stroke: '#b8a27e' }} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#7c6953', fontFamily: 'monospace' }} 
                          />
                          <YAxis 
                            domain={[0, 100]} 
                            axisLine={{ stroke: '#b8a27e' }} 
                            tickLine={{ stroke: '#b8a27e' }} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#7c6953', fontFamily: 'monospace' }} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#2e2117', 
                              borderRadius: '8px', 
                              border: '1px solid #c5a059', 
                              color: '#fdfbf7',
                              fontSize: '11px',
                              fontFamily: 'monospace'
                            }} 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#34784d" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorScore)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Recovery milestones — the once-per-plant celebrations
                        the check-in flow recorded, shown against the curve
                        they were earned on. */}
                    {plant?.milestoneLog && plant.milestoneLog.length > 0 && (
                      <div className="mt-4 p-4 rounded-2xl bg-[#f4f9f2] dark:bg-[#22301f] border border-[#d7e4d2] dark:border-[#3a4d36]">
                        <div className="flex items-center justify-between border-b border-[#e4d7c3] dark:border-[#3a4d36] pb-2 mb-3">
                          <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">Recovery Milestones</h4>
                          <span className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c] dark:text-[#b6a087]">
                            Earned once · kept forever
                          </span>
                        </div>
                        <ul className="flex flex-wrap gap-2">
                          {plant.milestoneLog.map((m, i) => {
                            const meta = RECOVERY_MILESTONES[m.kind as RecoveryMilestoneKind];
                            return (
                              <li
                                key={`${m.kind}-${m.at}-${i}`}
                                title={meta ? `Badge: ${meta.badge}` : m.kind}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-[#2b3a28] border border-[#dcd0bd] dark:border-[#4a5d46] text-[10px] font-mono font-bold text-[#2e2117] dark:text-[#e8dcc8]"
                              >
                                <span aria-hidden="true">{meta?.emoji ?? '🏅'}</span>
                                <span>{meta?.badge ?? m.kind}</span>
                                <span className="text-[#8c765c] dark:text-[#b6a087]">
                                  {new Date(m.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Pet & human toxicity — curated, source-linked, static.
                        Prominent placement: a missed warning costs more than
                        a visible one. No verdict = no card, never a guess. */}
                    {toxicity && (
                      <div
                        className={`p-4 rounded-2xl border ${
                          toxicity.toxicTo.length
                            ? 'border-[#c45b4a]/50 bg-[#c45b4a]/10'
                            : 'border-[#52b788]/50 bg-[#52b788]/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {toxicity.toxicTo.length ? (
                            <AlertTriangle size={14} className="text-[#8f2f26] dark:text-[#e07a5f]" aria-hidden="true" />
                          ) : (
                            <PawPrint size={14} className="text-[#2d6a4f] dark:text-[#95d5b2]" aria-hidden="true" />
                          )}
                          <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                            Pet Safety — {toxicity.name}
                          </h4>
                        </div>
                        {toxicity.toxicTo.length ? (
                          <>
                            <p className="text-xs font-bold text-[#8f2f26] dark:text-[#e07a5f]">
                              ⚠️ Toxic to {toxicity.toxicTo.join(', ')}
                              {toxicity.severity === 'severe' && ' — veterinary emergency risk'}
                              {toxicity.severity === 'moderate' && ' — worth a vet call'}
                            </p>
                            <p className="text-[11px] text-text-stone leading-snug mt-1">{toxicity.note}</p>
                          </>
                        ) : (
                          <p className="text-xs font-bold text-[#2d6a4f] dark:text-[#95d5b2]">
                            Pet-friendly — listed non-toxic to cats, dogs and people.
                          </p>
                        )}
                        <a
                          href={aspcaLookupUrl(toxicity.scientific)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] hover:underline inline-flex items-center gap-1 mt-2"
                        >
                          Confirm on the ASPCA's list <ExternalLink size={10} aria-hidden="true" />
                        </a>
                      </div>
                    )}

                    {/* Field guides — real horticulture sources for this
                        species, fetched on demand (one shared SerpApi call
                        per species per week, served from the server cache). */}
                    {plant?.species && (
                      <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#251d16] border border-[#dcd0bd]">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <BookOpen size={14} className="text-[#c5a059]" aria-hidden="true" />
                            <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                              Field Guides — {plant.species}
                            </h4>
                          </div>
                          {!careGuides && (
                            <button
                              type="button"
                              onClick={() => { void loadCareGuide(); }}
                              disabled={careGuideLoading}
                              className="min-h-[36px] px-4 py-1.5 rounded-lg border border-[#c5a059]/50 text-[10px] font-mono font-black uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] hover:bg-[#c5a059]/10 transition-colors disabled:opacity-50"
                            >
                              {careGuideLoading ? 'Consulting the archive…' : 'Load field guides'}
                            </button>
                          )}
                        </div>
                        {careGuideNote && (
                          <p className="text-[10px] font-mono text-[#8c765c] mt-2">{careGuideNote}</p>
                        )}
                        {careGuides && careGuides.length > 0 && (
                          <ul className="mt-3 space-y-2">
                            {careGuides.map((g, i) => (
                              <li key={`${g.url}-${i}`} className="text-xs">
                                <a
                                  href={g.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-[#2d6a4f] dark:text-[#95d5b2] hover:underline inline-flex items-center gap-1"
                                >
                                  {g.title} <ExternalLink size={10} aria-hidden="true" />
                                </a>
                                <span className="text-[10px] font-mono text-[#8c765c] ml-2">{g.source}</span>
                                {g.summary && <p className="text-[11px] text-text-stone leading-snug mt-0.5">{g.summary}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Video tutorials — real keepers demonstrating care for
                        this species, fetched on demand (one shared youtube
                        call per species per MONTH, served from the server
                        cache). View counts and dates appear exactly as the
                        engine printed them, or not at all. */}
                    {plant?.species && (
                      <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#251d16] border border-[#dcd0bd]">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Video size={14} className="text-[#c5a059]" aria-hidden="true" />
                            <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                              Watch &amp; learn — {plant.species}
                            </h4>
                          </div>
                          {!videos && (
                            <button
                              type="button"
                              onClick={() => { void loadVideos(); }}
                              disabled={videosLoading}
                              className="min-h-[36px] px-4 py-1.5 rounded-lg border border-[#c5a059]/50 text-[10px] font-mono font-black uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] hover:bg-[#c5a059]/10 transition-colors disabled:opacity-50"
                            >
                              {videosLoading ? 'Searching the archive…' : 'Find video tutorials'}
                            </button>
                          )}
                        </div>
                        {videosNote && (
                          <p className="text-[10px] font-mono text-[#8c765c] mt-2">{videosNote}</p>
                        )}
                        {videos && videos.length > 0 && (
                          <ul className="mt-3 space-y-3">
                            {videos.map((v, i) => (
                              <li key={`${v.url}-${i}`} className="text-xs">
                                <a
                                  href={v.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-3 group"
                                >
                                  {v.thumbnail && (
                                    <img src={v.thumbnail} alt="" loading="lazy" className="w-24 h-14 object-cover rounded-md shrink-0 border border-[#dcd0bd]" />
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="font-semibold text-[#2d6a4f] dark:text-[#95d5b2] group-hover:underline inline-flex items-center gap-1 line-clamp-2">
                                      {v.title} <ExternalLink size={10} aria-hidden="true" />
                                    </span>
                                    <span className="block text-[10px] font-mono text-[#8c765c] mt-0.5">
                                      {v.channel ?? 'YouTube'}
                                      {v.views ? ` · ${v.views}` : ''}
                                      {v.length ? ` · ${v.length}` : ''}
                                      {v.published ? ` · ${v.published}` : ''}
                                    </span>
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Community threads — REAL Reddit posts from r/houseplants.
                        The app's one answer to "who else had this problem?" is
                        real people, never simulated activity. On-demand like
                        the other content sections; subreddit is derived from
                        the thread URL, and no upvote counts are rendered
                        because the engine doesn't reliably carry them. */}
                    {plant?.species && (
                      <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#251d16] border border-[#dcd0bd]">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-[#c5a059]" aria-hidden="true" />
                            <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                              From the community — {plant.species}
                            </h4>
                          </div>
                          {!threads && (
                            <button
                              type="button"
                              onClick={() => { void loadThreads(); }}
                              disabled={threadsLoading}
                              className="min-h-[36px] px-4 py-1.5 rounded-lg border border-[#c5a059]/50 text-[10px] font-mono font-black uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] hover:bg-[#c5a059]/10 transition-colors disabled:opacity-50"
                            >
                              {threadsLoading ? 'Asking around…' : 'Find community threads'}
                            </button>
                          )}
                        </div>
                        {threadsNote && (
                          <p className="text-[10px] font-mono text-[#8c765c] mt-2">{threadsNote}</p>
                        )}
                        {threads && threads.length > 0 && (
                          <ul className="mt-3 space-y-2">
                            {threads.map((t, i) => (
                              <li key={`${t.url}-${i}`} className="text-xs">
                                <a
                                  href={t.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-[#2d6a4f] dark:text-[#95d5b2] hover:underline inline-flex items-center gap-1"
                                >
                                  {t.title} <ExternalLink size={10} aria-hidden="true" />
                                </a>
                                {t.subreddit && (
                                  <span className="text-[10px] font-mono text-[#8c765c] ml-2">{t.subreddit}</span>
                                )}
                                {t.snippet && <p className="text-[11px] text-text-stone leading-snug mt-0.5">{t.snippet}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Conservation — a heuristic read of search results,
                        labelled as a hint and linked to the source for the
                        authoritative answer. 180-day window. */}
                    {plant?.species && (
                      <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#251d16] border border-[#dcd0bd]">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Leaf size={14} className="text-[#c5a059]" aria-hidden="true" />
                            <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                              Conservation — {plant.species}
                            </h4>
                          </div>
                          {!conservation && (
                            <button
                              type="button"
                              onClick={() => { void loadConservation(); }}
                              disabled={conservationLoading}
                              className="min-h-[36px] px-4 py-1.5 rounded-lg border border-[#c5a059]/50 text-[10px] font-mono font-black uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] hover:bg-[#c5a059]/10 transition-colors disabled:opacity-50"
                            >
                              {conservationLoading ? 'Checking registries…' : 'Check conservation status'}
                            </button>
                          )}
                        </div>
                        {conservationNote && (
                          <p className="text-[10px] font-mono text-[#8c765c] mt-2">{conservationNote}</p>
                        )}
                        {conservation && (
                          conservation.status ? (
                            <div className="mt-2">
                              <p className="text-xs font-bold text-[#2e2117] dark:text-[#faebd7]">
                                {conservation.status}
                                {conservation.protected && <span className="text-[10px] font-mono text-[#8c765c] ml-2">· protected</span>}
                                {conservation.citesListed && <span className="text-[10px] font-mono text-[#8c765c] ml-2">· CITES-listed</span>}
                              </p>
                              {conservation.description && (
                                <p className="text-[11px] text-text-stone leading-snug mt-1">{conservation.description}</p>
                              )}
                              <a
                                href={conservation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-mono uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] hover:underline inline-flex items-center gap-1 mt-2"
                              >
                                {conservation.source || 'Source'} <ExternalLink size={10} aria-hidden="true" />
                              </a>
                              <p className="text-[9px] font-mono text-text-stone mt-1">
                                Heuristic read of search results — confirm the listing on the source page.
                              </p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-text-stone mt-2">
                              No conservation listing surfaced for this species — most houseplant cultivars aren't tracked.
                            </p>
                          )
                        )}
                      </div>
                    )}

                    {/* Treatment research — gated on a diagnosis: the pest is
                        the plant's own recorded one, not a guess. 14-day
                        window. */}
                    {diagnosis && (
                      <div className="p-4 rounded-2xl bg-white/60 dark:bg-[#251d16] border border-[#dcd0bd]">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Bug size={14} className="text-[#c5a059]" aria-hidden="true" />
                            <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
                              Treatment research — {diagnosis}
                            </h4>
                          </div>
                          {!treatments && (
                            <button
                              type="button"
                              onClick={() => { void loadTreatments(); }}
                              disabled={treatmentsLoading}
                              className="min-h-[36px] px-4 py-1.5 rounded-lg border border-[#c5a059]/50 text-[10px] font-mono font-black uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] hover:bg-[#c5a059]/10 transition-colors disabled:opacity-50"
                            >
                              {treatmentsLoading ? 'Researching treatments…' : 'Find what works'}
                            </button>
                          )}
                        </div>
                        {treatmentsNote && (
                          <p className="text-[10px] font-mono text-[#8c765c] mt-2">{treatmentsNote}</p>
                        )}
                        {treatments && treatments.length > 0 && (
                          <ul className="mt-3 space-y-2">
                            {treatments.map((t, i) => (
                              <li key={`${t.url}-${i}`} className="text-xs">
                                <a
                                  href={t.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-[#2d6a4f] dark:text-[#95d5b2] hover:underline inline-flex items-center gap-1"
                                >
                                  {t.treatment} <ExternalLink size={10} aria-hidden="true" />
                                </a>
                                <span className="text-[10px] font-mono text-[#8c765c] ml-2">{t.source}</span>
                                {t.effectiveness && (
                                  <span className="text-[10px] font-mono text-[#2d6a4f] dark:text-[#95d5b2] ml-2">· {t.effectiveness}</span>
                                )}
                                {t.summary && <p className="text-[11px] text-text-stone leading-snug mt-0.5">{t.summary}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Session deltas — the same telemetry as the chart, one                        row per check-in, with the change against the previous
                        reading. Four vitality bands, the same thresholds the
                        care engine uses (80 / 60 / 40). */}
                    {history && history.length > 1 && (
                      <div className="mt-4 p-4 rounded-2xl bg-white/60 border border-[#dcd0bd]">
                        <div className="flex items-center justify-between border-b border-[#e4d7c3] pb-2 mb-3">
                          <h4 className="font-serif font-bold text-sm text-[#2e2117]">Session Deltas</h4>
                          <span className="text-[9px] font-mono uppercase tracking-widest text-[#8c765c]">
                            Newest first · Δ vs previous reading
                          </span>
                        </div>
                        <ol className="space-y-1.5">
                          {history.slice().reverse().slice(0, 8).map((h, idx, arr) => {
                            const prevScore = arr[idx + 1]?.guardianScore;
                            const delta = typeof prevScore === 'number' ? h.guardianScore - prevScore : null;
                            const band = h.guardianScore >= 80
                              ? { label: 'Thriving', cls: 'text-[#3D7651] bg-[#5A9E5A]/10 border-[#5A9E5A]/30' }
                              : h.guardianScore >= 60
                              ? { label: 'Fair', cls: 'text-[#7a602f] bg-[#D4A843]/10 border-[#D4A843]/30' }
                              : h.guardianScore >= 40
                              ? { label: 'Needs Care', cls: 'text-[#8a4520] bg-[#C4704B]/10 border-[#C4704B]/30' }
                              : { label: 'Critical', cls: 'text-[#8f2f26] bg-[#B4473C]/10 border-[#B4473C]/30' };
                            return (
                              <li key={h.id ?? idx} className="flex items-center gap-2.5 text-[11px] font-sans">
                                <span className="w-16 shrink-0 font-mono text-[#7a6855]">
                                  {new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider ${band.cls}`}>
                                  {h.guardianScore} · {band.label}
                                </span>
                                {delta !== null && (
                                  <span className={`ml-auto inline-flex items-center gap-1 font-mono font-bold ${
                                    delta > 0 ? 'text-[#3D7651]' : delta < 0 ? 'text-[#B4473C]' : 'text-[#7a6855]'
                                  }`}>
                                    {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                                    {delta > 0 ? `+${delta}` : delta}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}

                    {/* Scheduled Hydration Cadence & Care Task */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-black/5 border border-[#c5a059]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Droplets size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif font-bold text-sm text-[#2e2117]">Scheduled Hydration Cadence</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                              daysUntilWater < 0
                                ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/40'
                                : daysUntilWater === 0
                                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {daysUntilWater < 0 ? `Overdue by ${Math.abs(daysUntilWater)}d` : daysUntilWater === 0 ? 'Water due today' : `Due in ${daysUntilWater}d`}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#7a6855] font-sans mt-0.5">
                            Target cadence: Every {wateringInterval} days · Last watered: {plant.lastWateredAt ? new Date(plant.lastWateredAt).toLocaleDateString() : 'Initial accession'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleLogWatering}
                        disabled={wateringLogging}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#244b2f] hover:bg-[#2d5c3a] disabled:opacity-50 text-[#f4eee1] text-[10px] font-mono font-bold uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0"
                      >
                        {wateringLogging ? <Loader2 size={13} className="animate-spin" /> : <Droplets size={13} className="text-blue-300" />}
                        <span>Log Hydration (🌱 +15 Seeds)</span>
                      </button>
                    </div>

                    {/* Interactive Real-Time Microclimate Care Simulation Workbench */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-black/5 border border-[#c5a059]/30 space-y-4 mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c5a059]/20 pb-3">
                        <div className="flex items-center gap-2">
                          <Zap size={15} className="text-[#c5a059]" />
                          <h4 className="font-serif font-bold text-base text-[#2e2117]">
                            Microclimate & Care Simulation Workbench
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {userEditedSim && (
                            <button
                              type="button"
                              onClick={() => {
                                setSimTemp(baselineTemp);
                                setSimHumidity(baselineHumidity);
                                setSimLight(baselineLight);
                                setUserEditedSim(false);
                              }}
                              className="min-h-[44px] px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#34784d] hover:underline flex items-center"
                            >
                              Reset Baseline
                            </button>
                          )}
                          <span className="text-[9px] font-mono uppercase tracking-widest text-[#7a6855]">
                            Live Physiological Affinities
                          </span>
                        </div>
                      </div>

                      {/* Sliders for Temp, Humidity, Light */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/60 dark:bg-black/20 p-4 rounded-xl border border-[#dcd0bd]">
                        {/* Temp */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                            <span className="text-[#7a6855]">Temperature</span>
                            <span className="font-bold text-[#2e2117]">{simTemp}°C</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="40"
                            step="1"
                            aria-label="Simulate Temperature in Celsius"
                            value={simTemp}
                            onChange={e => {
                              setSimTemp(Number(e.target.value));
                              setUserEditedSim(true);
                            }}
                            className="w-full accent-[#34784d] cursor-pointer"
                          />
                          <div className="flex justify-between text-[8px] font-mono text-[#7a6855] mt-0.5">
                            <span>5°C</span>
                            <span>Ideal: {toleranceProfile.idealTempMinC}-{toleranceProfile.idealTempMaxC}°C</span>
                            <span>40°C</span>
                          </div>
                        </div>

                        {/* Humidity */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                            <span className="text-[#7a6855]">
                              Relative Humidity {hasLiveWeatherSeed ? (
                                <span title="Seeded from live weather" className="text-[#34784d] font-bold font-mono text-[9px]">(Live)</span>
                              ) : (
                                <span title="Seeded from check-in soil moisture" className="font-mono text-[9px]">≈</span>
                              )}
                            </span>
                            <span className="font-bold text-[#2e2117]">{simHumidity}%</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="95"
                            step="5"
                            aria-label="Simulate Relative Humidity"
                            value={simHumidity}
                            onChange={e => {
                              setSimHumidity(Number(e.target.value));
                              setUserEditedSim(true);
                            }}
                            className="w-full accent-[#34784d] cursor-pointer"
                          />
                          <div className="flex justify-between text-[8px] font-mono text-[#7a6855] mt-0.5">
                            <span>10%</span>
                            <span>Ideal: {toleranceProfile.idealHumidityMinPct}-{toleranceProfile.idealHumidityMaxPct}%</span>
                            <span>95%</span>
                          </div>
                        </div>

                        {/* Light Exposure */}
                        <div>
                          <span className="text-[10px] font-mono text-[#7a6855] block mb-1">Light Exposure</span>
                          <div className="flex gap-1">
                            {(['Low', 'Indirect', 'Direct'] as const).map(l => (
                              <button
                                key={l}
                                type="button"
                                onClick={() => {
                                  setSimLight(l);
                                  setUserEditedSim(true);
                                }}
                                className={`flex-1 min-h-[44px] py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg transition-all ${
                                  simLight === l
                                    ? 'bg-[#2e2117] text-[#f7f0e4] shadow-xs'
                                    : 'bg-white dark:bg-black/30 text-[#7a6855] hover:bg-black/5 border border-[#dcd0bd]'
                                }`}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Real-time Physiological Readout */}
                      <div className="p-4 rounded-xl bg-white/80 dark:bg-black/30 border border-[#dcd0bd] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2e2117]">
                            Simulated Vitality Index: {simResult.score}/100 ({simResult.viability})
                          </span>
                          <div className="flex gap-2 text-[9px] font-mono">
                            <span className="text-[#7a6855]">Thermal Strain: {simResult.thermalStrain}%</span>
                            <span className="text-[#7a6855]">VPD Strain: {simResult.humidityStress}%</span>
                          </div>
                        </div>

                        <p className="text-xs text-[#6b5843] font-sans leading-relaxed">
                          {simResult.statusDescription}
                        </p>

                        {simResult.alerts.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-dashed border-[#dcd0bd]">
                            {simResult.alerts.map((alert, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[10px] font-mono text-amber-800 dark:text-amber-300">
                                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                <span>{alert}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Clinical Rehabilitation Roadmap & Recovery Trajectory */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-black/5 border border-[#c5a059]/30 space-y-4 mt-6">
                      <div className="flex items-center gap-2 border-b border-[#c5a059]/20 pb-3">
                        <Activity size={15} className="text-[#c5a059]" />
                        <h4 className="font-serif font-bold text-base text-[#2e2117]">
                          Clinical Rehabilitation &amp; Roadmap Trajectory
                        </h4>
                      </div>
                      <RecoveryRoadmapWidget
                        timeline={treatmentTimeline}
                        plantId={id}
                        species={plant.species}
                        diagnosis={plant.recoveryRoadmap?.diagnosis || `Rehabilitation Regimen for ${plant.name}`}
                        initialGuardianScore={plant.guardianScore}
                        onActionToggled={(res) => {
                          setPlant(prev => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              guardianScore: res.updatedScore ?? prev.guardianScore,
                              status: (res.updatedStatus as any) || prev.status,
                              recoveryRoadmap: prev.recoveryRoadmap || {
                                diagnosis: `Rehabilitation Regimen for ${prev.name}`,
                                timeline: treatmentTimeline,
                              },
                            };
                          });
                        }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* 02 Photo Records */}
                {activeTab === 'journal' && (
                  <motion.div 
                    key="journal"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6"
                  >
                    {history?.filter(h => h.photoUrl).map((h, i) => (
                      <div key={h.id || i} className="bg-[#fdfbf7] p-3 rounded-xl border-2 border-[#dcd0bd] shadow-sm relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-black/10 relative">
                          <img 
                            src={getPlantPhoto(h.photoUrl, plant.species)} 
                            alt="checkin" 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] font-mono uppercase tracking-widest text-white px-2 py-1 bg-black/60 rounded">
                              Score: {h.guardianScore}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          <span className="text-[10px] font-mono text-[#6b5843] uppercase tracking-wider block">
                            {h.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {(!history || history.filter(h => h.photoUrl).length === 0) && (
                      <div className="col-span-full py-16 text-center bg-[#fcfaf5] rounded-2xl border-2 border-dashed border-[#dcd0bd]">
                        <Camera size={36} className="mx-auto mb-3 text-[#b8a27e] opacity-40" />
                        <p className="text-xs font-mono uppercase tracking-widest text-[#8c765c]">No photographic specimen records on file</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 03 Field Notebook */}
                {activeTab === 'notebook' && (
                  <motion.div 
                    key="notebook"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-8"
                  >
                    {/* Search & Filter Bar */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-[#fbf9f4] p-4 sm:p-6 rounded-2xl border border-[#dcd0bd]">
                      <div className="relative w-full sm:w-80">
                        <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a89578]" size={16} />
                        <input 
                          type="text"
                          aria-label="Search field notes"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search field notes..."
                          className="w-full pl-11 pr-4 py-2.5 bg-white rounded-xl border border-[#dcd0bd] text-[#2e2117] placeholder:text-[#a89578] focus:outline-none focus:ring-2 focus:ring-[#c5a059]/40 text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        <select 
                          aria-label="Filter field notes by archetype"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value as any)}
                          className="px-3 py-2 bg-white rounded-xl border border-[#dcd0bd] text-[#2e2117] text-[10px] font-mono font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#c5a059]/40"
                        >
                          <option value="all">All Archetypes</option>
                          <option value="observation">Observation</option>
                          <option value="action">Action Taken</option>
                          <option value="milestone">Milestone</option>
                        </select>
                        
                        <div className="flex gap-1.5">
                          {allTags.slice(0, 4).map(tag => (
                            <button
                              key={tag}
                              onClick={() => toggleSelectedTag(tag)}
                              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all ${
                                selectedTags.includes(tag) 
                                  ? 'bg-[#2e2117] text-[#f7f0e4]' 
                                  : 'bg-white text-[#6b5843] hover:bg-[#f4ece0] border border-[#dcd0bd]'
                              }`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Add Note Entry Card */}
                    <div className="dossier-notebook-ruled p-6 sm:p-8 rounded-2xl shadow-sm space-y-6">
                      <div className="flex items-center gap-3 border-b border-[#e4d7c3] pb-3">
                        <div className="w-8 h-8 rounded-lg bg-[#c5a059]/20 text-[#8c7234] flex items-center justify-center">
                          <Plus size={18} />
                        </div>
                        <div>
                          <h3 className="font-serif text-xl font-bold text-[#2e2117]">Record Naturalist Observation</h3>
                          <p className="text-[10px] font-mono text-[#7c6953] uppercase tracking-wider">Field Log / Soil & Foliage Telemetry</p>
                        </div>
                      </div>

                      <textarea 
                        aria-label="Observation details"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Log observations, feeding regimens, pruning cuts, or fenestrations..."
                        className="w-full p-4 bg-white/80 rounded-xl border border-[#dcd0bd] text-[#2e2117] placeholder:text-[#a89578] focus:outline-none focus:ring-2 focus:ring-[#c5a059]/40 min-h-[120px] text-sm leading-relaxed"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                          <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#7c6953]">Archetype Stamp</label>
                          <div className="flex gap-2">
                            {(['observation', 'action', 'milestone'] as const).map(cat => (
                              <button 
                                key={cat}
                                onClick={() => setNoteCategory(cat)}
                                className={`archetype-stamp transition-all ${
                                  noteCategory === cat ? `is-${cat} ring-2 ring-current` : 'opacity-50 hover:opacity-100'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#7c6953]">Taxonomic Tags (Enter to add)</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              aria-label="Add a taxonomic tag"
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={handleAddTag}
                              placeholder="e.g. repotted, growth..."
                              className="w-full px-3 py-1.5 bg-white/80 rounded-lg border border-[#dcd0bd] text-xs font-mono focus:outline-none"
                            />
                          </div>
                          {noteTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {noteTags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-[#2e2117]/10 rounded text-[9px] font-mono font-bold flex items-center gap-1 text-[#2e2117]">
                                  #{tag}
                                  <button onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`} className="hover:text-red-500 font-bold focus-visible:ring-2 focus-visible:ring-red-500/50 outline-none rounded-sm">×</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button 
                          onClick={handleAddNote}
                          disabled={!newNote.trim()}
                          className="px-6 py-3 bg-[#2e2117] text-[#f7f0e4] rounded-xl font-mono font-bold uppercase tracking-widest text-[10px] shadow hover:bg-[#4a3825] transition-all flex items-center gap-2 disabled:opacity-40"
                        >
                          <Send size={13} className="text-[#c5a059]" />
                          <span>Affix Entry to Dossier</span>
                        </button>
                      </div>
                    </div>

                    {/* Archived Notes List */}
                    <div className="space-y-4">
                      {filteredNotes.map(note => (
                        <motion.div 
                          key={note.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-[#fdfbf7] p-5 sm:p-6 rounded-2xl border-2 border-[#dcd0bd] shadow-sm flex flex-col gap-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8decb] pb-2">
                            <div className="flex items-center gap-2">
                              <span className={`archetype-stamp is-${note.category}`}>
                                {note.category}
                              </span>
                              <span className="text-[10px] font-mono text-[#8c765c]">
                                {note.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>

                            {note.tags && note.tags.length > 0 && (
                              <div className="flex gap-1.5">
                                {note.tags.map(t => (
                                  <span key={t} className="text-[9px] font-mono text-[#8c765c]">#{t}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          <p className="text-[#2e2117] font-serif text-base sm:text-lg leading-relaxed italic">
                            "{note.content}"
                          </p>
                        </motion.div>
                      ))}

                      {filteredNotes.length === 0 && (
                        <div className="py-16 text-center bg-[#fcfaf5] rounded-2xl border-2 border-dashed border-[#dcd0bd]">
                          <Book size={32} className="mx-auto mb-2 text-[#b8a27e] opacity-40" />
                          <p className="text-xs font-mono uppercase tracking-widest text-[#8c765c]">No matching dossier entries found</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 04 Diagnostic Alerts */}
                {activeTab === 'alerts' && (
                  <motion.div 
                    key="alerts"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-4"
                  >
                    {predictions?.filter(a => a.triggeredAlert).map((alert, i) => (
                      <div key={alert.id || i} className="bg-[#fff9f0] p-6 rounded-2xl border-2 border-[#f0c890] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-500/20 text-amber-800 rounded-xl flex items-center justify-center flex-shrink-0">
                            <AlertCircle size={22} />
                          </div>
                          <div>
                            <h4 className="font-serif text-lg font-bold text-[#3d2a1c]">Clinical Stress Alert: {alert.primaryStressor}</h4>
                            <p className="text-xs text-[#7c6953] italic">Outcome Assessment: {alert.outcome}</p>
                          </div>
                        </div>

                        <div className="px-4 py-1.5 bg-[#f5e6d0] border border-[#e0c098] rounded-md text-[10px] font-mono font-bold uppercase tracking-wider text-[#6a4825]">
                          Risk Factor: {alert.riskScore}%
                        </div>
                      </div>
                    ))}

                    {(!predictions || predictions.filter(a => a.triggeredAlert).length === 0) && (
                      <div className="py-16 text-center bg-[#fcfaf5] rounded-2xl border-2 border-dashed border-[#dcd0bd]">
                        <ShieldCheck size={36} className="mx-auto mb-2 text-[#52b788]" />
                        <p className="text-xs font-mono uppercase tracking-widest text-[#52b788]">Dossier Clear · Zero Active Clinical Alerts</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Field Deed & Dispatch Actions */}
            <motion.div variants={itemVariants} className="bg-[#241a12] p-8 sm:p-12 rounded-[2rem] border-2 border-[#4a3828] text-[#f7f0e4] relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Sprout size={200} />
              </div>

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#e4caa0] text-[9px] font-mono tracking-widest uppercase">
                    <span>Archival Recommendation</span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-snug">
                    Specimen Preservation & <span className="text-[#c5a059] italic">Naturalist Lineage</span>
                  </h2>
                  <p className="text-[#d8cdbd] text-sm sm:text-base leading-relaxed max-w-2xl font-serif">
                    Guardian score of {plant.guardianScore} marks this specimen in the upper percentile of recorded {plant.species} cultivars. Continue daily telemetry logging to maintain vigor.
                  </p>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button 
                      onClick={() => transitionTo(`/assistant?plantName=${encodeURIComponent(plant.name)}&species=${encodeURIComponent(plant.species)}&plantId=${encodeURIComponent(id)}`, 'AI Assistant')}
                      className="px-6 py-3 bg-[#c5a059] text-[#241a12] font-mono font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-[#deb66c] transition-colors flex items-center gap-2 shadow-md"
                    >
                      <span>💬 Consult Chief Botanist</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-black/30 backdrop-blur-sm p-6 rounded-xl border border-white/10 space-y-3 font-mono text-[10px]">
                  <p className="text-[#c5a059] font-bold uppercase tracking-wider">Specimen Telemetry Stamp</p>
                  <div className="space-y-2 text-[#d4c7b5]">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Neural Stability</span>
                      <span className="text-[#52b788] font-bold">OPTIMAL</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Genomic Lineage</span>
                      <span className="text-[#52b788] font-bold">VERIFIED</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Vitality Vector</span>
                      <span className="text-[#52b788] font-bold">ASCENDING</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Archival Deed</span>
                      <span className="text-[#c5a059] font-bold">SEALED</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* The check-in flow, mounted. */}
      <AnimatePresence>
        {checkInOpen && id && (
          <CheckInFlow
            plantName={plant.name}
            plantId={id}
            onComplete={closeCheckIn}
            onClose={closeCheckIn}
          />
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}

function DetailStat({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-[#fbf9f4] p-4 rounded-xl border-2 border-[#dcd0bd] shadow-sm">
      <div className="text-[#8c7234] mb-2">{icon}</div>
      <p className="text-[8px] font-mono uppercase tracking-widest text-[#8c765c] mb-0.5">{label}</p>
      <p className="text-sm sm:text-base font-serif font-bold text-[#2e2117] truncate">{value}</p>
    </div>
  );
}
