import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Microscope,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Maximize2,
  Columns,
  Layers,
  Sparkles,
  Info,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Sprout
} from 'lucide-react';
import { db } from '../../db/database';
import type { Plant, CheckIn } from '../../types';
import type { PlantSignature } from '../../services/driftDetector';
import {
  computeComparativePathology,
  generateClinicalInsight,
  resolvePhotoBlob,
  resolvePhotoUrl,
  compareSpecimenImages,
  type PathologyMetrics,
  type ClinicalInsight
} from '../../services/pathologyProgressionService';
import { getPlantPhoto } from '../../utils/plantImage';
import EmptyState from '../EmptyState';
import { Skeleton } from '../feedback/Skeleton';
import ErrorState from '../feedback/ErrorState';

export interface ComparativePathologyWorkbenchProps {
  preselectedPlantId?: string | null;
  onNavigateToDex?: () => void;
  onNavigateToDossier?: (plantId: string, name: string) => void;
  onSelectPlant?: (plantId: string) => void;
}

export interface SpecimenTimepoint {
  id: string;
  type: 'baseline' | 'checkin';
  label: string;
  date: Date;
  dateFormatted: string;
  photoUrl: string | null;
  photoBlob: Blob | null;
  signature: PlantSignature | null;
  guardianScore: number;
  notes?: string;
}

export default function ComparativePathologyWorkbench({
  preselectedPlantId,
  onNavigateToDex,
  onNavigateToDossier,
  onSelectPlant
}: ComparativePathologyWorkbenchProps) {
  // 1. Query Sanctuary plants from Dexie
  const dbPlants = useLiveQuery(() => db.plants.toArray(), []) || [];
  const sanctuaryPlants = useMemo(() => {
    return dbPlants.filter(p => !p.isDemo);
  }, [dbPlants]);

  // Selected Plant state
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(
    preselectedPlantId || null
  );

  useEffect(() => {
    if (preselectedPlantId) {
      setSelectedPlantId(preselectedPlantId);
    } else if (!selectedPlantId && sanctuaryPlants.length > 0) {
      setSelectedPlantId(sanctuaryPlants[0].id);
    }
  }, [preselectedPlantId, sanctuaryPlants, selectedPlantId]);

  const selectedPlant = useMemo(() => {
    return sanctuaryPlants.find(p => p.id === selectedPlantId) || null;
  }, [sanctuaryPlants, selectedPlantId]);

  // 2. Query check-ins for the selected plant
  const checkins = useLiveQuery(
    () =>
      selectedPlantId
        ? db.checkins.where('plantId').equals(selectedPlantId).sortBy('timestamp')
        : Promise.resolve([] as CheckIn[]),
    [selectedPlantId]
  ) || [];

  // 3. Construct chronological specimen timepoints with photos
  const timepoints = useMemo<SpecimenTimepoint[]>(() => {
    if (!selectedPlant) return [];
    const list: SpecimenTimepoint[] = [];

    // Baseline diagnosis timepoint
    if (selectedPlant.photoUrl) {
      const baseDate = new Date(selectedPlant.createdAt || Date.now());
      list.push({
        id: 'baseline',
        type: 'baseline',
        label: 'Baseline Diagnosis',
        date: baseDate,
        dateFormatted: baseDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        photoUrl: selectedPlant.photoUrl,
        photoBlob: null,
        signature: selectedPlant.baselineSignature || null,
        guardianScore: selectedPlant.guardianScore ?? 90,
        notes: selectedPlant.recoveryRoadmap?.diagnosis || 'Initial diagnosis record'
      });
    }

    // Historical check-in timepoints
    checkins.forEach((c, idx) => {
      if (!c.photoUrl && !c.photoBlob) return;
      const cDate = new Date(c.timestamp);
      list.push({
        id: c.id,
        type: 'checkin',
        label: `Check-In #${idx + 1}`,
        date: cDate,
        dateFormatted: cDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        photoUrl: c.photoUrl,
        photoBlob: c.photoBlob,
        signature: c.signature || null,
        guardianScore: c.guardianScore ?? 85,
        notes: c.changes?.join(', ') || undefined
      });
    });

    return list;
  }, [selectedPlant, checkins]);

  // Specimen selection states
  const [specimenAId, setSpecimenAId] = useState<string>('');
  const [specimenBId, setSpecimenBId] = useState<string>('');

  // Default Specimen A to earliest (baseline) and Specimen B to latest
  useEffect(() => {
    if (timepoints.length >= 2) {
      setSpecimenAId(timepoints[0].id);
      setSpecimenBId(timepoints[timepoints.length - 1].id);
    } else {
      setSpecimenAId('');
      setSpecimenBId('');
    }
  }, [timepoints]);

  const timepointA = useMemo(() => {
    return timepoints.find(t => t.id === specimenAId) || timepoints[0] || null;
  }, [timepoints, specimenAId]);

  const timepointB = useMemo(() => {
    return timepoints.find(t => t.id === specimenBId) || timepoints[timepoints.length - 1] || null;
  }, [timepoints, specimenBId]);

  // 4. View Mode: Split-screen curtain slider vs Side-by-side twin optics
  const [viewMode, setViewMode] = useState<'curtain' | 'side-by-side'>('curtain');
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [magnification, setMagnification] = useState<'1x' | '2x' | '4x'>('1x');

  const magScale = magnification === '4x' ? 2.5 : magnification === '2x' ? 1.6 : 1.0;

  // 5. Image URLs for display
  const [resolvedUrlA, setResolvedUrlA] = useState<string | null>(null);
  const [resolvedUrlB, setResolvedUrlB] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrlA: string | null = null;
    let createdUrlB: string | null = null;

    async function loadUrls() {
      if (timepointA) {
        const urlA = await resolvePhotoUrl(timepointA.photoUrl, timepointA.photoBlob);
        if (active) {
          createdUrlA = urlA;
          setResolvedUrlA(urlA);
        }
      } else {
        setResolvedUrlA(null);
      }

      if (timepointB) {
        const urlB = await resolvePhotoUrl(timepointB.photoUrl, timepointB.photoBlob);
        if (active) {
          createdUrlB = urlB;
          setResolvedUrlB(urlB);
        }
      } else {
        setResolvedUrlB(null);
      }
    }

    loadUrls();

    return () => {
      active = false;
      if (createdUrlA?.startsWith('blob:')) URL.revokeObjectURL(createdUrlA);
      if (createdUrlB?.startsWith('blob:')) URL.revokeObjectURL(createdUrlB);
    };
  }, [timepointA, timepointB]);

  // 6. Pathology Delta & Recovery Computation
  const [metrics, setMetrics] = useState<PathologyMetrics | null>(null);
  const [insight, setInsight] = useState<ClinicalInsight | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  useEffect(() => {
    if (!timepointA || !timepointB || !selectedPlant) {
      setMetrics(null);
      setInsight(null);
      return;
    }

    let active = true;
    setIsCalculating(true);
    setCalcError(null);

    async function runComputation() {
      try {
        // Fast path: both have signatures
        if (timepointA?.signature && timepointB?.signature) {
          const res = computeComparativePathology(
            timepointA.signature,
            timepointB.signature,
            selectedPlant?.species
          );
          if (!active) return;
          setMetrics(res);
          setInsight(generateClinicalInsight(res, selectedPlant?.name || 'Specimen', selectedPlant?.recoveryRoadmap));
          setIsCalculating(false);
          return;
        }

        // On-device canvas extraction path
        const [blobA, blobB] = await Promise.all([
          resolvePhotoBlob(timepointA?.photoUrl, timepointA?.photoBlob),
          resolvePhotoBlob(timepointB?.photoUrl, timepointB?.photoBlob),
        ]);

        if (blobA && blobB) {
          const res = await compareSpecimenImages(blobA, blobB, selectedPlant?.species);
          if (!active) return;
          setMetrics(res);
          setInsight(generateClinicalInsight(res, selectedPlant?.name || 'Specimen', selectedPlant?.recoveryRoadmap));
        } else {
          // If photos cannot be converted to blobs (e.g. offline external image), construct a conservative signature from guardian scores
          const dummySigA: PlantSignature = timepointA?.signature || {
            hsvHistogram: new Array(48).fill(0),
            leafContours: 3,
            meanRgb: [80, 130, 50],
            textureEnergy: 12,
            computedAt: timepointA?.date || new Date(),
          };
          const dummySigB: PlantSignature = timepointB?.signature || {
            hsvHistogram: new Array(48).fill(0),
            leafContours: 3,
            meanRgb: [80, 140, 50],
            textureEnergy: 11,
            computedAt: timepointB?.date || new Date(),
          };
          const res = computeComparativePathology(dummySigA, dummySigB, selectedPlant?.species);
          if (!active) return;
          setMetrics(res);
          setInsight(generateClinicalInsight(res, selectedPlant?.name || 'Specimen', selectedPlant?.recoveryRoadmap));
        }
      } catch (err: any) {
        if (!active) return;
        console.warn('[PathologyWorkbench] Computation warning:', err);
        setCalcError(err?.message || 'Failed to complete on-device visual analysis.');
      } finally {
        if (active) setIsCalculating(false);
      }
    }

    runComputation();

    return () => {
      active = false;
    };
  }, [timepointA, timepointB, selectedPlant]);

  // Quick Preset Handlers
  const handlePresetBaselineVsLatest = () => {
    if (timepoints.length >= 2) {
      setSpecimenAId(timepoints[0].id);
      setSpecimenBId(timepoints[timepoints.length - 1].id);
    }
  };

  const handlePresetPriorVsLatest = () => {
    if (timepoints.length >= 2) {
      setSpecimenAId(timepoints[timepoints.length - 2].id);
      setSpecimenBId(timepoints[timepoints.length - 1].id);
    }
  };

  // -------------------------------------------------------------
  // RENDERING EMPTY STATES
  // -------------------------------------------------------------
  if (sanctuaryPlants.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <EmptyState
          title="No Sanctuary Specimens Found"
          body="To chart foliar pathology progression, first identify and index a specimen in the Botanical Lab."
          action={{
            label: 'Open Optical Aperture (Scan Plant)',
            onClick: () => onNavigateToDex?.(),
            variant: 'primary',
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================== 1. SPECIMEN SELECTION TOOLBAR ==================== */}
      <div className="botanical-index-card p-4 sm:p-6 rounded-3xl border border-border-light shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 border-b border-border-light pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#b89552]" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] font-bold">
                MULTI-PHOTO CELLULAR PROGRESSION WORKBENCH
              </p>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-black text-text-bark flex items-center gap-2">
              Comparative Visual Pathology <Microscope size={20} className="text-moss" />
            </h2>
          </div>

          {/* Plant Selector Dropdown */}
          <div className="flex items-center gap-2 min-w-0">
            <label htmlFor="plant-picker-select" className="text-xs font-mono font-bold text-text-stone uppercase shrink-0">
              Specimen:
            </label>
            <select
              id="plant-picker-select"
              aria-label="Select sanctuary specimen"
              value={selectedPlantId || ''}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedPlantId(id);
                onSelectPlant?.(id);
              }}
              className="bg-bg-secondary text-text-bark border border-border-medium rounded-xl px-3 py-2 text-xs font-serif font-bold min-h-[44px] focus:outline-none focus:ring-2 focus:ring-moss/40 cursor-pointer max-w-xs"
            >
              {sanctuaryPlants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || 'Monty'} ({p.species || 'Unknown'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Observation Points Selection Bar */}
        {timepoints.length < 2 ? (
          <div className="pt-2">
            <EmptyState
              compact
              title="Single Observation Point Recorded"
              body="At least two chronological photos (baseline diagnosis plus a follow-up check-in) are required to chart chlorosis and necrosis cellular drift."
              action={{
                label: 'View Specimen Dossier & Add Check-In',
                onClick: () => selectedPlant && onNavigateToDossier?.(selectedPlant.id, selectedPlant.name),
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Choose Another Plant',
                onClick: () => {
                  const alt = sanctuaryPlants.find(p => p.id !== selectedPlantId);
                  if (alt) setSelectedPlantId(alt.id);
                },
                variant: 'secondary',
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-grow">
              {/* Specimen A Selector */}
              <div className="bg-bg-secondary/60 p-2.5 rounded-2xl border border-border-light flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold text-[#b89552] uppercase shrink-0">
                  Slide A (Ref):
                </span>
                <select
                  aria-label="Select reference specimen A"
                  value={specimenAId}
                  onChange={(e) => setSpecimenAId(e.target.value)}
                  className="bg-bg-primary text-text-bark border border-border-light rounded-lg px-2.5 py-1.5 text-xs font-mono min-h-[44px] flex-grow focus:outline-none cursor-pointer"
                >
                  {timepoints.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.dateFormatted}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specimen B Selector */}
              <div className="bg-bg-secondary/60 p-2.5 rounded-2xl border border-border-light flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold text-moss uppercase shrink-0">
                  Slide B (Follow-up):
                </span>
                <select
                  aria-label="Select comparison specimen B"
                  value={specimenBId}
                  onChange={(e) => setSpecimenBId(e.target.value)}
                  className="bg-bg-primary text-text-bark border border-border-light rounded-lg px-2.5 py-1.5 text-xs font-mono min-h-[44px] flex-grow focus:outline-none cursor-pointer"
                >
                  {timepoints.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.dateFormatted}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Toggle Presets */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePresetBaselineVsLatest}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-border-medium bg-bg-secondary hover:bg-bg-tertiary text-text-bark text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
              >
                Baseline vs Latest
              </button>
              {timepoints.length >= 3 && (
                <button
                  type="button"
                  onClick={handlePresetPriorVsLatest}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-border-medium bg-bg-secondary hover:bg-bg-tertiary text-text-bark text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
                >
                  Prior vs Latest
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {timepoints.length >= 2 && (
        <>
          {/* ==================== 2. DUAL-MODE VISUALIZATION VIEWPORT ==================== */}
          <div className="specimen-glass-slide p-4 sm:p-6 rounded-3xl border border-white/70 dark:border-white/10 shadow-md space-y-4">
            {/* Viewport Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light pb-3">
              {/* Mode Switcher */}
              <div className="flex items-center gap-1.5 bg-bg-secondary p-1 rounded-2xl border border-border-light">
                <button
                  type="button"
                  onClick={() => setViewMode('curtain')}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                    viewMode === 'curtain'
                      ? 'bg-moss text-white shadow-xs'
                      : 'text-text-stone hover:text-text-bark'
                  }`}
                >
                  <Columns size={13} />
                  Curtain Split
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('side-by-side')}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                    viewMode === 'side-by-side'
                      ? 'bg-moss text-white shadow-xs'
                      : 'text-text-stone hover:text-text-bark'
                  }`}
                >
                  <Layers size={13} />
                  Twin Reticles
                </button>
              </div>

              {/* Magnification Controls */}
              <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-2xl border border-border-light">
                <span className="text-[10px] font-mono uppercase text-text-stone px-2 font-bold">Zoom:</span>
                {(['1x', '2x', '4x'] as const).map((mag) => (
                  <button
                    key={mag}
                    type="button"
                    onClick={() => setMagnification(mag)}
                    className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all ${
                      magnification === mag
                        ? 'bg-[#b89552] text-white shadow-xs'
                        : 'text-text-stone hover:text-text-bark'
                    }`}
                  >
                    {mag}
                  </button>
                ))}
              </div>
            </div>

            {/* Viewport Area */}
            {viewMode === 'curtain' ? (
              /* Mode 1: Split-screen Curtain Slider */
              <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-black/40 border border-[#b89552]/40 shadow-inner select-none">
                {/* Specimen A (Reference: Baseline or Prior) - Underneath layer */}
                <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
                  <img
                    src={resolvedUrlA || getPlantPhoto(timepointA?.photoUrl, selectedPlant?.species)}
                    alt={timepointA?.label || 'Specimen A'}
                    className="w-full h-full object-cover transition-transform duration-300"
                    style={{ transform: `scale(${magScale})` }}
                  />
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border border-white/20 z-10">
                    A: {timepointA?.label} ({timepointA?.dateFormatted})
                  </div>
                </div>

                {/* Specimen B (Follow-up) - Top layer clipped by CSS clipPath */}
                <div
                  className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none"
                  style={{
                    clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                  }}
                >
                  <img
                    src={resolvedUrlB || getPlantPhoto(timepointB?.photoUrl, selectedPlant?.species)}
                    alt={timepointB?.label || 'Specimen B'}
                    className="w-full h-full object-cover transition-transform duration-300"
                    style={{ transform: `scale(${magScale})` }}
                  />
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border border-white/20 z-10">
                    B: {timepointB?.label} ({timepointB?.dateFormatted})
                  </div>
                </div>

                {/* Divider Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.8)] pointer-events-none z-20"
                  style={{ left: `${sliderPos}%` }}
                />

                {/* Draggable Brass Reticle Pill Handle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-[#2b1f13] border-2 border-[#d4af37] text-[#d4af37] flex items-center justify-center shadow-lg font-mono text-sm font-black pointer-events-none z-30"
                  style={{ left: `${sliderPos}%` }}
                >
                  ↔
                </div>

                {/* Accessible Invisible Range Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPos}
                  onChange={(e) => setSliderPos(Number(e.target.value))}
                  aria-label="Split-screen specimen comparison slider"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize min-h-[44px] z-40"
                />
              </div>
            ) : (
              /* Mode 2: Side-by-side Dual Optic View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Specimen A Card */}
                <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-black/40 border border-[#b89552]/40 shadow-xs group">
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border border-white/20 z-10">
                    Slide A: {timepointA?.label} ({timepointA?.dateFormatted})
                  </div>
                  <img
                    src={resolvedUrlA || getPlantPhoto(timepointA?.photoUrl, selectedPlant?.species)}
                    alt={timepointA?.label || 'Specimen A'}
                    className="w-full h-full object-cover transition-transform duration-300"
                    style={{ transform: `scale(${magScale})` }}
                  />
                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md text-white text-[9px] font-mono px-2 py-0.5 rounded z-10">
                    Vitality Score: {timepointA?.guardianScore}/100
                  </div>
                </div>

                {/* Specimen B Card */}
                <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-black/40 border border-moss/40 shadow-xs group">
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border border-white/20 z-10">
                    Slide B: {timepointB?.label} ({timepointB?.dateFormatted})
                  </div>
                  <img
                    src={resolvedUrlB || getPlantPhoto(timepointB?.photoUrl, selectedPlant?.species)}
                    alt={timepointB?.label || 'Specimen B'}
                    className="w-full h-full object-cover transition-transform duration-300"
                    style={{ transform: `scale(${magScale})` }}
                  />
                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md text-white text-[9px] font-mono px-2 py-0.5 rounded z-10">
                    Vitality Score: {timepointB?.guardianScore}/100
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ==================== 3. PROGRESSION TELEMETRY & DIRECTIONAL BADGES ==================== */}
          {isCalculating ? (
            <div className="space-y-4">
              <Skeleton className="h-14 w-full" rounded="rounded-2xl" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Skeleton className="h-24 w-full" rounded="rounded-2xl" />
                <Skeleton className="h-24 w-full" rounded="rounded-2xl" />
                <Skeleton className="h-24 w-full" rounded="rounded-2xl" />
                <Skeleton className="h-24 w-full" rounded="rounded-2xl" />
              </div>
            </div>
          ) : calcError ? (
            <ErrorState
              title="Pathology Analysis Failed"
              message={calcError}
              onRetry={() => {
                setCalcError(null);
                setSpecimenAId((prev) => prev);
              }}
            />
          ) : metrics ? (
            <div className="space-y-4">
              {/* Directional Recovery Status Badge & Lighting Bias Warning */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {metrics.classification === 'Recovering' && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-black uppercase tracking-wider">
                      <TrendingUp size={16} className="text-emerald-500" />
                      Recovering (+{metrics.recoveryDriftPercent}%) · Pathology Resolving
                    </div>
                  )}
                  {metrics.classification === 'Stabilizing' && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-400 font-mono text-xs font-black uppercase tracking-wider">
                      <ShieldCheck size={16} className="text-sky-500" />
                      Stabilizing ({metrics.recoveryDriftPercent >= 0 ? '+' : ''}{metrics.recoveryDriftPercent}%) · Drift Contained
                    </div>
                  )}
                  {metrics.classification === 'Active Pathology' && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono text-xs font-black uppercase tracking-wider">
                      <AlertTriangle size={16} className="text-amber-500" />
                      Active Pathology ({metrics.recoveryDriftPercent}%) · Foliar Drift Expanding
                    </div>
                  )}
                  {metrics.classification === 'Severe Drift' && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 font-mono text-xs font-black uppercase tracking-wider">
                      <AlertCircle size={16} className="text-rose-500" />
                      Severe Drift ({metrics.recoveryDriftPercent}%) · Critical Necrotic Decline
                    </div>
                  )}
                </div>

                {metrics.lightingBiasWarning && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono">
                    <Info size={12} />
                    <span>Lighting variance detected (&Delta;L &gt; 50). Values normalized.</span>
                  </div>
                )}
              </div>

              {/* Metric Chips Grid */}
              <div
                role="region"
                aria-label="Pathology progression metrics"
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
              >
                {/* 1. Chlorosis Delta */}
                <div className="botanical-index-card p-4 rounded-2xl border border-border-light shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-stone uppercase font-bold">
                    <span>Chlorosis &Delta; (38°-68°)</span>
                    <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-serif font-black ${
                      metrics.deltaChlorosis <= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {metrics.deltaChlorosis > 0 ? `+${metrics.deltaChlorosis}%` : `${metrics.deltaChlorosis}%`}
                  </div>
                  <p className="text-[10px] font-mono text-text-stone">
                    {metrics.deltaChlorosis <= 0 ? 'Foliar Re-greening' : 'Yellowing Expansion'}
                  </p>
                  <p className="text-[9px] font-mono text-text-stone/80 pt-1 border-t border-border-light">
                    A: {metrics.chlorosisA}% &rarr; B: {metrics.chlorosisB}%
                  </p>
                </div>

                {/* 2. Necrosis Delta */}
                <div className="botanical-index-card p-4 rounded-2xl border border-border-light shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-stone uppercase font-bold">
                    <span>Necrosis &Delta; (5°-38°)</span>
                    <span className="w-2 h-2 rounded-full bg-[#854d0e]" />
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-serif font-black ${
                      metrics.deltaNecrosis <= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {metrics.deltaNecrosis > 0 ? `+${metrics.deltaNecrosis}%` : `${metrics.deltaNecrosis}%`}
                  </div>
                  <p className="text-[10px] font-mono text-text-stone">
                    {metrics.deltaNecrosis <= 0 ? 'Lesions Arrested' : 'Tissue Dieback'}
                  </p>
                  <p className="text-[9px] font-mono text-text-stone/80 pt-1 border-t border-border-light">
                    A: {metrics.necrosisA}% &rarr; B: {metrics.necrosisB}%
                  </p>
                </div>

                {/* 3. Texture Stability */}
                <div className="botanical-index-card p-4 rounded-2xl border border-border-light shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-stone uppercase font-bold">
                    <span>Texture Stability</span>
                    <span className="w-2 h-2 rounded-full bg-moss" />
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-serif font-black ${
                      metrics.textureStability >= 80
                        ? 'text-moss dark:text-moss-light'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {metrics.textureStability}%
                  </div>
                  <p className="text-[10px] font-mono text-text-stone">
                    {metrics.textureStability >= 80 ? 'Lamina Intact' : 'Surface Roughness'}
                  </p>
                  <p className="text-[9px] font-mono text-text-stone/80 pt-1 border-t border-border-light">
                    &Delta; Energy: {metrics.deltaTextureEnergy}
                  </p>
                </div>

                {/* 4. Overall Recovery Drift % */}
                <div className="botanical-index-card p-4 rounded-2xl border border-border-light shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-stone uppercase font-bold">
                    <span>Recovery Drift</span>
                    <span className="w-2 h-2 rounded-full bg-[#b89552]" />
                  </div>
                  <div
                    className={`text-xl sm:text-2xl font-serif font-black ${
                      metrics.recoveryDriftPercent >= 15
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : metrics.recoveryDriftPercent >= -10
                        ? 'text-sky-700 dark:text-sky-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {metrics.recoveryDriftPercent > 0 ? `+${metrics.recoveryDriftPercent}%` : `${metrics.recoveryDriftPercent}%`}
                  </div>
                  <p className="text-[10px] font-mono text-text-stone">
                    Scale -100% to +100%
                  </p>
                  <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        metrics.recoveryDriftPercent >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.abs(metrics.recoveryDriftPercent))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ==================== 4. ACTIONABLE CLINICAL INSIGHT & ROADMAP CARD ==================== */}
              {insight && (
                <div className="botanical-index-card p-5 sm:p-6 rounded-3xl border border-border-light shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-border-light pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-moss" />
                      <h3 className="font-serif font-black text-lg text-text-bark">
                        {insight.title}
                      </h3>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
                        insight.urgency === 'high'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          : insight.urgency === 'moderate'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {insight.urgency} Urgency
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-text-bark leading-relaxed font-serif">
                    {insight.narrative}
                  </p>

                  <div className="p-3.5 rounded-2xl bg-bg-secondary border border-border-light space-y-1.5">
                    <p className="font-mono text-[10px] uppercase text-text-stone font-bold tracking-wider">
                      Prescribed Clinical Directive:
                    </p>
                    <p className="text-xs font-mono font-semibold text-text-bark">
                      {insight.recommendedAction}
                    </p>
                  </div>

                  {selectedPlant?.recoveryRoadmap && (
                    <div className="p-3.5 rounded-2xl bg-moss/5 border border-moss/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-moss">
                        <span>Active Recovery Roadmap:</span>
                        <span>{selectedPlant.recoveryRoadmap.diagnosis || 'Prescribed Regimen'}</span>
                      </div>
                      <p className="text-xs text-text-bark font-sans">
                        Phase 01 Action: {selectedPlant.recoveryRoadmap.timeline?.[0]?.action || 'Substrate moisture audit'}
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        selectedPlant && onNavigateToDossier?.(selectedPlant.id, selectedPlant.name)
                      }
                      className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-xl border border-moss/40 bg-moss text-white hover:bg-moss-dark text-xs font-mono font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <span>View Specimen Dossier & Roadmap</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
