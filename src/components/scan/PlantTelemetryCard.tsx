import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  Layers,
  Sliders,
  Sun,
  Thermometer,
  Zap,
  HeartPulse,
  Clock,
  Sparkles,
  Edit3,
  Save,
  ListOrdered,
  Check,
} from 'lucide-react';
import { useEcoMode } from '../../hooks/useEcoMode';
import type { PlantScanReport } from '../../lib/scanReport';
import {
  deriveToleranceProfile,
  inferLightFromWeather,
  simulateMicroclimate,
  type MicroclimateInput,
} from '../../lib/environmentalSimulation';
import {
  TreatmentService,
  slug,
  type AdherenceMetrics,
} from '../../services/treatmentService';
import type { TreatmentActionRecord } from '../../db/database';
import { triggerHaptic } from '../../utils/hapticAudio';

export interface TelemetryAmbientWeather {
  temperatureC?: number | null;
  humidityPct?: number | null;
  lightLevel?: 'Direct' | 'Indirect' | 'Low' | null;
}

export interface PlantTelemetryCardProps {
  report: PlantScanReport;
  className?: string;
  compact?: boolean;
  ambientWeather?: TelemetryAmbientWeather | null;
  plantId?: string | null;
  scanId?: string | null;
}

export default function PlantTelemetryCard({
  report,
  className = '',
  compact = false,
  ambientWeather = null,
  plantId = null,
  scanId = null,
}: PlantTelemetryCardProps) {
  const { shouldDisableAnimations } = useEcoMode();
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'stepper' | 'trajectory'>('stepper');
  const [showSimulator, setShowSimulator] = useState(false);
  const [completedRecords, setCompletedRecords] = useState<Record<number, TreatmentActionRecord>>({});
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rewardToast, setRewardToast] = useState<{ seeds: number; boost: number; day: string } | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  // Environmental simulation state: prefer live ambient weather from the scan or props,
  // falling back to parsed care guidelines and soil moisture heuristic.
  const careParsed = report?.careParsed;
  const reportWeather = report?.weather ?? report?.location?.weather;
  const weatherTemp =
    (ambientWeather && typeof ambientWeather.temperatureC === 'number' && Number.isFinite(ambientWeather.temperatureC) ? ambientWeather.temperatureC : null)
    ?? (reportWeather && typeof reportWeather.temp === 'number' && Number.isFinite(reportWeather.temp) ? reportWeather.temp : null);

  const weatherHumidity =
    (ambientWeather && typeof ambientWeather.humidityPct === 'number' && Number.isFinite(ambientWeather.humidityPct) ? ambientWeather.humidityPct : null)
    ?? (reportWeather && typeof reportWeather.humidity === 'number' && Number.isFinite(reportWeather.humidity) ? reportWeather.humidity : null);

  const weatherLight =
    (ambientWeather && ambientWeather.lightLevel ? ambientWeather.lightLevel : null)
    ?? (reportWeather?.condition ? inferLightFromWeather(reportWeather.condition) : null);

  const hasLiveWeather = typeof weatherHumidity === 'number' && Number.isFinite(weatherHumidity);

  const initialTemp = typeof weatherTemp === 'number' && Number.isFinite(weatherTemp)
    ? Math.round(weatherTemp)
    : (careParsed?.temperatureC ?? 22);

  const initialHumidity = typeof weatherHumidity === 'number' && Number.isFinite(weatherHumidity)
    ? Math.round(weatherHumidity)
    : (careParsed?.soilMoisture === 'Wet' ? 75 : careParsed?.soilMoisture === 'Dry' ? 35 : 55);

  const initialLight = weatherLight ?? careParsed?.lightLevel ?? 'Indirect';

  const [simEnv, setSimEnv] = useState<MicroclimateInput>({
    temperatureC: initialTemp,
    humidityPct: initialHumidity,
    lightLevel: initialLight,
  });

  // Re-sync simulation baseline if report prop changes
  React.useEffect(() => {
    setSimEnv({
      temperatureC: initialTemp,
      humidityPct: initialHumidity,
      lightLevel: initialLight,
    });
  }, [initialTemp, initialHumidity, initialLight, report?.scientificName, report?.displayName]);

  const toleranceProfile = useMemo(
    () => deriveToleranceProfile(report?.scientificName || report?.displayName || 'Plant', report?.careParsed),
    [report?.scientificName, report?.displayName, report?.careParsed]
  );

  const simulation = useMemo(
    () => simulateMicroclimate(simEnv, toleranceProfile),
    [simEnv, toleranceProfile]
  );

  const timeline = report?.timeline || [];

  const loadSavedActions = React.useCallback(async () => {
    if (!timeline || timeline.length === 0) return;
    try {
      const scopeKey = plantId
        ? `plant:${plantId}`
        : scanId
          ? `scan:${scanId}`
          : `specimen:${slug(report?.scientificName || report?.displayName || 'plant')}`;
      const records = await TreatmentService.getCompletedActions(plantId || scopeKey);
      const recordMap: Record<number, TreatmentActionRecord> = {};

      timeline.forEach((step, idx) => {
        const targetKey = TreatmentService.buildTargetKey({
          plantId,
          scanId,
          species: report?.scientificName || report?.displayName,
          diagnosis: report?.diagnosis,
          phaseIndex: idx,
          phaseDay: step.day,
          action: step.action,
        });
        const match = records.find(r => r.targetKey === targetKey && Boolean(r.completedAt))
          || records.find(r => r.phaseIndex === idx && r.action === step.action && Boolean(r.completedAt));
        if (match) recordMap[idx] = match;
      });
      setCompletedRecords(recordMap);
    } catch {
      // safe fallback
    }
  }, [timeline, plantId, scanId, report?.scientificName, report?.displayName, report?.diagnosis]);

  React.useEffect(() => {
    loadSavedActions();
  }, [loadSavedActions]);

  const toggleStep = async (idx: number) => {
    const step = timeline[idx];
    if (!step || actionLoading !== null) return;
    setActionLoading(idx);
    triggerHaptic();
    try {
      const result = await TreatmentService.toggleTreatmentAction({
        plantId,
        scanId,
        species: report?.scientificName || report?.displayName,
        diagnosis: report?.diagnosis,
        phaseIndex: idx,
        phaseDay: step.day,
        action: step.action,
        expectedOutcome: step.expectedOutcome,
        timeline,
      });
      setCompletedRecords(prev => {
        const next = { ...prev };
        if (result.isCompleted) {
          next[idx] = result.record;
        } else {
          delete next[idx];
        }
        return next;
      });
      if (result.newlyAwarded) {
        setRewardToast({
          seeds: result.seedsAwarded,
          boost: result.vitalityBoost,
          day: step.day,
        });
        setTimeout(() => setRewardToast(null), 4000);
      }
    } catch (err) {
      console.warn('[PlantTelemetryCard] Failed to toggle treatment:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNote = async () => {
    const step = timeline[selectedPhaseIdx];
    if (!step) return;
    const targetKey = TreatmentService.buildTargetKey({
      plantId,
      scanId,
      species: report?.scientificName || report?.displayName,
      diagnosis: report?.diagnosis,
      phaseIndex: selectedPhaseIdx,
      phaseDay: step.day,
      action: step.action,
    });
    await TreatmentService.saveActionNote(targetKey, noteDraft);
    setCompletedRecords(prev => {
      if (!prev[selectedPhaseIdx]) return prev;
      return {
        ...prev,
        [selectedPhaseIdx]: {
          ...prev[selectedPhaseIdx],
          notes: noteDraft,
        },
      };
    });
    setEditingNote(false);
    setNoteDraft('');
  };

  const adherence = useMemo(() => {
    return TreatmentService.calculateAdherence(
      Object.keys(completedRecords).length,
      timeline.length
    );
  }, [completedRecords, timeline.length]);

  const currentPhase = timeline[selectedPhaseIdx] || timeline[0];
  const currentRecord = completedRecords[selectedPhaseIdx];
  const isCurrentCompleted = Boolean(currentRecord?.completedAt);

  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (adherence.adherencePct / 100) * ringCircumference;

  return (
    <div className={`rounded-2xl border border-[#b4a58c]/35 dark:border-[#8fb58f]/20 bg-bg-secondary/40 backdrop-blur-xs p-4 sm:p-6 space-y-6 text-text-bark ${className}`}>
      {/* ── 1. Telemetry Envelope Gauges ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-moss" />
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-moss">
              Physiological Telemetry Envelope
            </span>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-text-stone">
            Vitality: {report?.vitals?.guardianScore ?? 80}/100 · {report?.vitals?.statusLabel ?? 'Stable'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Temperature */}
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border-light">
            <div className="flex items-center justify-between text-text-stone text-[9px] font-mono uppercase tracking-wider mb-1">
              <span>Thermal Zone</span>
              <Thermometer size={12} className="text-amber-500" />
            </div>
            <p className="text-xs font-bold truncate">
              {careParsed?.temperatureC !== null && careParsed?.temperatureC !== undefined ? `${careParsed.temperatureC}°C` : report?.care?.temperature || 'Ambient'}
            </p>
            <span className="text-[9px] text-text-stone truncate block">
              {toleranceProfile.idealTempMinC}–{toleranceProfile.idealTempMaxC}°C ideal
            </span>
          </div>

          {/* Hydration */}
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border-light">
            <div className="flex items-center justify-between text-text-stone text-[9px] font-mono uppercase tracking-wider mb-1">
              <span>Hydration</span>
              <Droplets size={12} className="text-blue-500" />
            </div>
            <p className="text-xs font-bold truncate">
              {careParsed?.soilMoisture || 'Moist'} ({report?.wateringIntervalDays || 7}d)
            </p>
            <span className="text-[9px] text-text-stone truncate block">
              {report?.care?.watering ? report.care.watering.slice(0, 26) + '…' : 'Regular cycle'}
            </span>
          </div>

          {/* Photoperiod */}
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border-light">
            <div className="flex items-center justify-between text-text-stone text-[9px] font-mono uppercase tracking-wider mb-1">
              <span>Light Exposure</span>
              <Sun size={12} className="text-yellow-500" />
            </div>
            <p className="text-xs font-bold truncate">{careParsed?.lightLevel || 'Indirect'}</p>
            <span className="text-[9px] text-text-stone truncate block">
              {report?.care?.light ? report.care.light.slice(0, 24) : 'Natural exposure'}
            </span>
          </div>

          {/* Substrate */}
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border-light">
            <div className="flex items-center justify-between text-text-stone text-[9px] font-mono uppercase tracking-wider mb-1">
              <span>Substrate</span>
              <Layers size={12} className="text-emerald-500" />
            </div>
            <p className="text-xs font-bold truncate">
              {report?.care?.soil ? report.care.soil.split(',')[0].slice(0, 18) : 'Potting loam'}
            </p>
            <span className="text-[9px] text-text-stone truncate block">Porous percolation</span>
          </div>
        </div>
      </div>

      {/* ── 2. Interactive Clinical Recovery Timeline ── */}
      {timeline.length > 0 && (
        <div className="space-y-3.5 pt-2 border-t border-border-light/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border-light/60">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                  <circle
                    cx="18"
                    cy="18"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-black/10 dark:text-white/10"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="text-moss transition-all duration-500 ease-out"
                  />
                </svg>
                <span className="absolute text-[10px] font-mono font-black text-text-bark">
                  {adherence.adherencePct}%
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <HeartPulse size={13} className="text-moss" />
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-moss">
                    Clinical Recovery Roadmap ({timeline.length} Phases)
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border ${adherence.badgeColor}`}>
                    {adherence.stageLabel}
                  </span>
                  <span className="text-[9px] font-mono text-text-stone">
                    {adherence.completedCount} of {adherence.totalCount} completed
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="text-right hidden sm:block">
                <span className="text-[8px] font-mono uppercase tracking-wider text-text-stone block">
                  Recovery Trajectory
                </span>
                <span className="text-[11px] font-mono font-black text-moss">
                  Vitality: {(report?.vitals?.guardianScore ?? 80) + adherence.vitalityDelta}/100 (+{adherence.vitalityDelta})
                </span>
              </div>
              <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-0.5 border border-border-light">
                <button
                  type="button"
                  onClick={() => setViewMode('stepper')}
                  aria-label="Stepper Phase View"
                  className={`min-h-[44px] px-2.5 text-[9px] font-mono font-bold uppercase rounded-md transition-all flex items-center gap-1 ${
                    viewMode === 'stepper'
                      ? 'bg-moss-deep text-white shadow-xs'
                      : 'text-text-stone hover:text-text-bark'
                  }`}
                >
                  <Layers size={11} />
                  <span>Stepper</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('trajectory')}
                  aria-label="Full Recovery Trajectory View"
                  className={`min-h-[44px] px-2.5 text-[9px] font-mono font-bold uppercase rounded-md transition-all flex items-center gap-1 ${
                    viewMode === 'trajectory'
                      ? 'bg-moss-deep text-white shadow-xs'
                      : 'text-text-stone hover:text-text-bark'
                  }`}
                >
                  <ListOrdered size={11} />
                  <span>Trajectory</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reward Toast */}
          <AnimatePresence>
            {rewardToast && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-2.5 rounded-lg bg-gold/15 dark:bg-gold/20 border border-gold/40 flex items-center justify-between text-gold-dark dark:text-gold text-xs font-mono font-bold shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-gold" />
                  <span>+{rewardToast.seeds} Seeds &amp; +{rewardToast.boost} Vitality Boost awarded!</span>
                </div>
                <span className="text-[9px] uppercase font-bold">{rewardToast.day}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── View A: Stepper Pills Navigation ── */}
          {viewMode === 'stepper' && (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Recovery phase milestones">
                {timeline.map((step, idx) => {
                  const isDone = Boolean(completedRecords[idx]?.completedAt);
                  const isSelected = selectedPhaseIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-label={`Select treatment stage ${step.day}`}
                      onClick={() => {
                        setSelectedPhaseIdx(idx);
                        setEditingNote(false);
                      }}
                      className={`min-h-[44px] px-3.5 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 border ${
                        isSelected
                          ? 'bg-moss-deep text-white border-moss shadow-xs'
                          : isDone
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-black/5 dark:bg-white/5 text-text-stone hover:bg-black/10 border-transparent'
                      }`}
                    >
                      <span>{step.day || `Phase #${idx + 1}`}</span>
                      {isDone ? (
                        <CheckCircle2 size={11} className={isSelected ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'} />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Current Phase Active Dossier */}
              {currentPhase && (
                <motion.div
                  key={selectedPhaseIdx}
                  {...(!shouldDisableAnimations ? { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } } : {})}
                  className="p-3.5 sm:p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border-light space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-black uppercase tracking-wider text-moss">
                          Target: {currentPhase.day || `Stage ${selectedPhaseIdx + 1}`}
                        </span>
                        {isCurrentCompleted && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono text-[9px] font-bold">
                            <Clock size={10} />
                            {TreatmentService.formatRelativeTime(currentRecord?.completedAt)}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-text-bark leading-snug">
                        {currentPhase.action}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleStep(selectedPhaseIdx)}
                      disabled={actionLoading === selectedPhaseIdx}
                      aria-label={`Mark treatment phase ${currentPhase.day} action complete`}
                      className={`min-h-[44px] px-3.5 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                        isCurrentCompleted
                          ? 'bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                          : 'bg-moss-deep text-white hover:bg-moss active:scale-95 shadow-xs'
                      }`}
                    >
                      <CheckCircle2 size={12} className={isCurrentCompleted ? 'text-emerald-500' : 'text-white'} />
                      <span>
                        {isCurrentCompleted
                          ? 'Applied ✓ (Tap to Undo)'
                          : 'Apply Treatment (🌱 +15 Seeds)'}
                      </span>
                    </button>
                  </div>

                  {currentPhase.expectedOutcome && (
                    <div className="text-[11px] text-text-stone bg-bg-primary/60 p-2.5 rounded-lg border border-border-light/50 font-sans leading-relaxed">
                      <span className="font-bold text-moss font-mono text-[9px] uppercase tracking-wider block mb-0.5">
                        Expected Biological Outcome:
                      </span>
                      {currentPhase.expectedOutcome}
                    </div>
                  )}

                  {/* Field Observation Note */}
                  <div className="pt-1.5 border-t border-border-light/40 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-text-stone">
                        Field Clinical Notes
                      </span>
                      {!editingNote ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNote(true);
                            setNoteDraft(currentRecord?.notes || '');
                          }}
                          aria-label="Add observation note for this phase"
                          className="min-h-[44px] px-2 text-[9px] font-mono font-bold uppercase tracking-wider text-moss hover:underline flex items-center gap-1"
                        >
                          <Edit3 size={10} />
                          {currentRecord?.notes ? 'Edit Note' : 'Add Note'}
                        </button>
                      ) : null}
                    </div>

                    {editingNote ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          aria-label="Field observation notes for this recovery step"
                          value={noteDraft}
                          onChange={e => setNoteDraft(e.target.value)}
                          placeholder="e.g. Applied neem foliar wash; pruned spotted leaves..."
                          className="w-full px-2.5 py-1.5 text-xs bg-bg-primary border border-border-light rounded-md focus:outline-none focus:ring-1 focus:ring-moss font-sans"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingNote(false)}
                            aria-label="Cancel note editing"
                            className="min-h-[44px] px-3 py-1 text-[10px] font-mono rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-text-stone"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveNote}
                            aria-label="Save note to clinical log"
                            className="min-h-[44px] px-3 py-1 bg-moss-deep text-white text-[10px] font-mono font-bold uppercase rounded-md flex items-center gap-1"
                          >
                            <Save size={11} />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : currentRecord?.notes ? (
                      <p className="text-[10px] text-text-bark italic bg-black/5 dark:bg-white/5 p-1.5 rounded font-sans">
                        “{currentRecord.notes}”
                      </p>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* ── View B: Full Trajectory Timeline View ── */}
          {viewMode === 'trajectory' && (
            <div className="space-y-2.5 pt-1">
              {timeline.map((step, idx) => {
                const isDone = Boolean(completedRecords[idx]?.completedAt);
                const record = completedRecords[idx];
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition-all ${
                      isDone
                        ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-black/5 dark:bg-white/5 border-border-light/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-black uppercase tracking-wider text-moss">
                            {step.day || `Phase #${idx + 1}`}
                          </span>
                          {isDone && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono text-[8px] font-bold">
                              <Check size={9} />
                              {TreatmentService.formatRelativeTime(record?.completedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-text-bark leading-snug">
                          {step.action}
                        </p>
                        {step.expectedOutcome && (
                          <p className="text-[10px] text-text-stone font-sans">
                            Outcome: {step.expectedOutcome}
                          </p>
                        )}
                        {record?.notes && (
                          <p className="text-[10px] text-text-bark italic font-sans mt-1">
                            Note: “{record.notes}”
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleStep(idx)}
                        disabled={actionLoading === idx}
                        aria-label={`Toggle phase ${step.day} status`}
                        className={`min-h-[44px] px-3.5 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                          isDone
                            ? 'bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                            : 'bg-moss-deep text-white hover:bg-moss'
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        <span>{isDone ? 'Applied ✓' : 'Mark Done'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 3. Differential Diagnosis Spectrum ── */}
      {report.differential && report.differential.length > 0 && !compact && (
        <div className="space-y-2.5 pt-2 border-t border-border-light/60">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-moss">
              Differential Pathology Spectrum
            </span>
            <span className="text-[9px] font-mono text-text-stone">Probability distribution</span>
          </div>

          <div className="space-y-2">
            {report.differential.map((diff, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-bark truncate">{diff.name}</span>
                  <span className="font-mono text-[10px] text-text-stone font-bold shrink-0 ml-2">
                    {diff.confidencePct}% match
                  </span>
                </div>
                <div className="h-2 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      i === 0 ? 'bg-moss' : 'bg-[#b89542]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(4, diff.confidencePct))}%` }}
                  />
                </div>
                {diff.description && (
                  <p className="text-[10px] text-text-stone line-clamp-1 italic">{diff.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Interactive Real-Time Microclimate Care Simulator ── */}
      <div className="pt-2 border-t border-border-light/60">
        <button
          type="button"
          onClick={() => setShowSimulator(prev => !prev)}
          className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-wider text-text-bark"
        >
          <div className="flex items-center gap-2">
            <Sliders size={13} className="text-moss" />
            <span>Interactive Microclimate Care Simulator</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-stone">
            <span>Simulated Vitality: {simulation.score}/100</span>
            {showSimulator ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        <AnimatePresence>
          {showSimulator && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-3 space-y-4"
            >
              {/* Simulation Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/5 dark:bg-white/5 p-3.5 rounded-xl border border-border-light">
                {/* Temp Slider */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-text-stone">Temp (°C)</span>
                    <span className="font-bold text-moss">{simEnv.temperatureC}°C</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    step="1"
                    aria-label="Simulate Temperature in Celsius"
                    value={simEnv.temperatureC}
                    onChange={e => setSimEnv(s => ({ ...s, temperatureC: Number(e.target.value) }))}
                    className="w-full accent-moss cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-text-stone mt-0.5">
                    <span>5°C</span>
                    <span>Ideal: {toleranceProfile.idealTempMinC}-{toleranceProfile.idealTempMaxC}°C</span>
                    <span>40°C</span>
                  </div>
                </div>

                {/* Humidity Slider */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-text-stone">
                      Humidity (%) {hasLiveWeather ? (
                        <span title="Seeded from live local weather" className="text-moss font-bold">(Live)</span>
                      ) : (
                        <span title="Seeded from the scan, not measured">≈</span>
                      )}
                    </span>
                    <span className="font-bold text-moss">{simEnv.humidityPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    step="5"
                    aria-label="Simulate Relative Humidity Percentage"
                    value={simEnv.humidityPct}
                    onChange={e => setSimEnv(s => ({ ...s, humidityPct: Number(e.target.value) }))}
                    className="w-full accent-moss cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-text-stone mt-0.5">
                    <span>10%</span>
                    <span>Ideal: {toleranceProfile.idealHumidityMinPct}-{toleranceProfile.idealHumidityMaxPct}%</span>
                    <span>95%</span>
                  </div>
                </div>

                {/* Light Level Selector */}
                <div>
                  <span className="text-[10px] font-mono text-text-stone block mb-1">Light Exposure</span>
                  <div className="flex gap-1">
                    {(['Low', 'Indirect', 'Direct'] as const).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setSimEnv(s => ({ ...s, lightLevel: l }))}
                        className={`flex-1 min-h-[44px] py-1.5 text-[10px] font-mono font-bold uppercase rounded-md transition-all ${
                          simEnv.lightLevel === l
                            ? 'bg-moss-deep text-white shadow-xs'
                            : 'bg-black/5 dark:bg-white/5 text-text-stone hover:bg-black/10'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulation Result Telemetry Readout */}
              <div className="p-3.5 rounded-xl bg-bg-primary/80 border border-border-light space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={13} className="text-moss" />
                    <span className="text-[10px] font-mono font-bold uppercase text-text-bark">
                      Simulation Outlook: {simulation.viability} ({simulation.score}/100)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimEnv({
                      temperatureC: initialTemp,
                      humidityPct: initialHumidity,
                      lightLevel: initialLight,
                    })}
                    className="text-[10px] font-mono text-text-stone hover:text-moss underline p-1 min-h-[44px] inline-flex items-center"
                  >
                    Reset Baseline
                  </button>
                </div>

                <p className="text-xs text-text-stone font-sans leading-relaxed">
                  {simulation.statusDescription}
                </p>

                {simulation.alerts.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {simulation.alerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
