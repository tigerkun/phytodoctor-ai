import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  HeartPulse,
  ChevronRight,
  ListOrdered,
  Layers,
  Edit3,
  Save,
  Check,
  AlertCircle
} from 'lucide-react';
import { useEcoMode } from '../../hooks/useEcoMode';
import {
  TreatmentService,
  slug,
  type AdherenceMetrics,
  type ToggleTreatmentResult,
} from '../../services/treatmentService';
import type { TreatmentActionRecord } from '../../db/database';
import { triggerHaptic } from '../../utils/hapticAudio';

export interface TreatmentTimelineStep {
  day: string;
  action: string;
  expectedOutcome?: string;
}

export interface RecoveryRoadmapWidgetProps {
  timeline: TreatmentTimelineStep[];
  plantId?: string | null;
  scanId?: string | null;
  species?: string | null;
  diagnosis?: string | null;
  initialGuardianScore?: number | null;
  compact?: boolean;
  className?: string;
  onActionToggled?: (result: ToggleTreatmentResult) => void;
}

export default function RecoveryRoadmapWidget({
  timeline,
  plantId = null,
  scanId = null,
  species = 'Botanical Specimen',
  diagnosis = 'General Recovery Regimen',
  initialGuardianScore = 75,
  compact = false,
  className = '',
  onActionToggled,
}: RecoveryRoadmapWidgetProps) {
  const { shouldDisableAnimations } = useEcoMode();
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'stepper' | 'trajectory'>('stepper');
  const [completedRecords, setCompletedRecords] = useState<Record<number, TreatmentActionRecord>>({});
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [lastRewardToast, setLastRewardToast] = useState<{ seeds: number; boost: number; day: string } | null>(null);
  
  // Note editing state per phase
  const [editingNotePhase, setEditingNotePhase] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  // Hydrate completed records from database
  const loadSavedActions = useCallback(async () => {
    if (!timeline || timeline.length === 0) return;
    try {
      const scopeKey = plantId
        ? `plant:${plantId}`
        : scanId
          ? `scan:${scanId}`
          : `specimen:${slug(species || 'botanical')}`;
      const records = await TreatmentService.getCompletedActions(plantId || scopeKey);
      
      const recordMap: Record<number, TreatmentActionRecord> = {};

      timeline.forEach((step, idx) => {
        const targetKey = TreatmentService.buildTargetKey({
          plantId,
          scanId,
          species,
          diagnosis,
          phaseIndex: idx,
          phaseDay: step.day,
          action: step.action,
        });
        const directMatch = records.find(r => r.targetKey === targetKey && Boolean(r.completedAt))
          || records.find(r => r.phaseIndex === idx && r.action === step.action && Boolean(r.completedAt));
        if (directMatch) {
          recordMap[idx] = directMatch;
        }
      });

      setCompletedRecords(recordMap);
    } catch (err) {
      console.warn('[RecoveryRoadmapWidget] Could not load completed treatment actions:', err);
    }
  }, [timeline, plantId, scanId, species, diagnosis]);

  useEffect(() => {
    loadSavedActions();
  }, [loadSavedActions]);

  const adherenceMetrics: AdherenceMetrics = useMemo(() => {
    const total = timeline.length;
    const completed = Object.keys(completedRecords).length;
    return TreatmentService.calculateAdherence(completed, total);
  }, [timeline.length, completedRecords]);

  const handleToggleStep = async (idx: number) => {
    const step = timeline[idx];
    if (!step || actionLoading !== null) return;

    setActionLoading(idx);
    triggerHaptic();

    try {
      const result = await TreatmentService.toggleTreatmentAction({
        plantId,
        scanId,
        species,
        diagnosis,
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
        setLastRewardToast({
          seeds: result.seedsAwarded,
          boost: result.vitalityBoost,
          day: step.day,
        });
        setTimeout(() => setLastRewardToast(null), 4000);
      }

      if (onActionToggled) {
        onActionToggled(result);
      }
    } catch (err) {
      console.error('[RecoveryRoadmapWidget] Error toggling treatment action:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNote = async (idx: number) => {
    const step = timeline[idx];
    if (!step) return;
    const targetKey = TreatmentService.buildTargetKey({
      plantId,
      scanId,
      species,
      diagnosis,
      phaseIndex: idx,
      phaseDay: step.day,
      action: step.action,
    });
    await TreatmentService.saveActionNote(targetKey, noteDraft);
    setCompletedRecords(prev => {
      if (!prev[idx]) return prev;
      return {
        ...prev,
        [idx]: {
          ...prev[idx],
          notes: noteDraft,
        },
      };
    });
    setEditingNotePhase(null);
    setNoteDraft('');
  };

  if (!timeline || timeline.length === 0) {
    return null;
  }

  const currentPhase = timeline[selectedPhaseIdx] || timeline[0];
  const currentRecord = completedRecords[selectedPhaseIdx];
  const isCurrentCompleted = Boolean(currentRecord?.completedAt);

  // SVG parameters for circular radial progress ring
  const ringRadius = 16;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (adherenceMetrics.adherencePct / 100) * ringCircumference;

  return (
    <div className={`space-y-4 pt-2 border-t border-border-light/70 ${className}`}>
      {/* ── 1. Generative Adherence & Trajectory Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-bg-primary/80 dark:bg-black/20 border border-border-light">
        <div className="flex items-center gap-3.5">
          {/* Adherence Circular Progress Ring */}
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
              <circle
                cx="20"
                cy="20"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                className="text-black/10 dark:text-white/10"
              />
              <circle
                cx="20"
                cy="20"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="text-moss transition-all duration-700 ease-out"
              />
            </svg>
            <span className="absolute text-[11px] font-mono font-black text-text-bark">
              {adherenceMetrics.adherencePct}%
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <HeartPulse size={14} className="text-moss" />
              <h4 className="text-xs font-mono font-black uppercase tracking-wider text-text-bark">
                Clinical Recovery Roadmap ({timeline.length} Phases)
              </h4>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${adherenceMetrics.badgeColor}`}>
                {adherenceMetrics.stageLabel}
              </span>
              <span className="text-[10px] font-mono text-text-stone">
                {adherenceMetrics.completedCount} of {adherenceMetrics.totalCount} applied
              </span>
            </div>
          </div>
        </div>

        {/* Vitality Trajectory Projection & Mode Toggle */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="text-right hidden sm:block">
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-stone block">
              Vitality Trajectory
            </span>
            <span className="text-xs font-mono font-black text-moss">
              {(initialGuardianScore || 75) + adherenceMetrics.vitalityDelta}/100 (+{adherenceMetrics.vitalityDelta} pts)
            </span>
          </div>

          <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-0.5 border border-border-light">
            <button
              type="button"
              onClick={() => setViewMode('stepper')}
              aria-label="Focus Stepper View"
              className={`min-h-[44px] px-3 text-[10px] font-mono font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'stepper'
                  ? 'bg-moss-deep text-white shadow-xs'
                  : 'text-text-stone hover:text-text-bark'
              }`}
            >
              <Layers size={12} />
              <span className="hidden xs:inline">Stepper</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('trajectory')}
              aria-label="Full Trajectory Timeline View"
              className={`min-h-[44px] px-3 text-[10px] font-mono font-bold uppercase rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'trajectory'
                  ? 'bg-moss-deep text-white shadow-xs'
                  : 'text-text-stone hover:text-text-bark'
              }`}
            >
              <ListOrdered size={12} />
              <span className="hidden xs:inline">Timeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Reward / Vitality Toast Banner ── */}
      <AnimatePresence>
        {lastRewardToast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-3 rounded-xl bg-gold/15 dark:bg-gold/20 border border-gold/40 flex items-center justify-between gap-3 text-gold-dark dark:text-gold shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-gold shrink-0 animate-pulse" />
              <p className="text-xs font-mono font-bold">
                Recovery Milestone Checked! +{lastRewardToast.seeds} Seeds &amp; +{lastRewardToast.boost} Vitality Boost awarded!
              </p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
              {lastRewardToast.day}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. Stepper Pills Navigation ── */}
      {viewMode === 'stepper' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center" role="tablist" aria-label="Treatment phase stepper">
            {timeline.map((step, idx) => {
              const isDone = Boolean(completedRecords[idx]?.completedAt);
              const isSelected = selectedPhaseIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`Select treatment stage: ${step.day}`}
                  onClick={() => setSelectedPhaseIdx(idx)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border ${
                    isSelected
                      ? 'bg-moss-deep text-white border-moss shadow-xs'
                      : isDone
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-black/5 dark:bg-white/5 text-text-stone hover:bg-black/10 border-transparent'
                  }`}
                >
                  <span>{step.day || `Phase #${idx + 1}`}</span>
                  {isDone ? (
                    <CheckCircle2 size={13} className={isSelected ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Phase Focus Dossier */}
          {currentPhase && (
            <motion.div
              key={selectedPhaseIdx}
              {...(!shouldDisableAnimations ? { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } } : {})}
              className="p-4 sm:p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-border-light space-y-3.5 relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-moss">
                      Target: {currentPhase.day || `Stage ${selectedPhaseIdx + 1}`}
                    </span>
                    {isCurrentCompleted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono text-[9px] font-bold">
                        <Clock size={10} />
                        {TreatmentService.formatRelativeTime(currentRecord?.completedAt)}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-text-bark leading-snug">
                    {currentPhase.action}
                  </h4>
                </div>

                {/* Primary Action Checkoff Button */}
                <button
                  type="button"
                  onClick={() => handleToggleStep(selectedPhaseIdx)}
                  disabled={actionLoading === selectedPhaseIdx}
                  aria-label={`Mark treatment phase ${currentPhase.day} complete`}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shrink-0 ${
                    isCurrentCompleted
                      ? 'bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                      : 'bg-moss-deep text-white hover:bg-moss active:scale-95 shadow-xs'
                  }`}
                >
                  <CheckCircle2 size={13} className={isCurrentCompleted ? 'text-emerald-500' : 'text-white'} />
                  <span>
                    {isCurrentCompleted
                      ? 'Applied ✓ (Tap to Undo)'
                      : 'Apply Treatment (🌱 +15 Seeds)'}
                  </span>
                </button>
              </div>

              {/* Expected Biological Outcome */}
              {currentPhase.expectedOutcome && (
                <div className="text-[11px] text-text-stone bg-bg-primary/70 dark:bg-black/20 p-3 rounded-xl border border-border-light/60 font-sans leading-relaxed">
                  <span className="font-bold text-moss font-mono text-[9px] uppercase tracking-wider block mb-1">
                    Expected Biological Outcome:
                  </span>
                  {currentPhase.expectedOutcome}
                </div>
              )}

              {/* Field Observation Note */}
              <div className="pt-2 border-t border-border-light/40 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-text-stone">
                    Field Clinical Notes
                  </span>
                  {editingNotePhase !== selectedPhaseIdx ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNotePhase(selectedPhaseIdx);
                        setNoteDraft(currentRecord?.notes || '');
                      }}
                      aria-label="Add observation note for this phase"
                      className="min-h-[44px] px-2 text-[9px] font-mono font-bold uppercase tracking-wider text-moss hover:underline flex items-center gap-1"
                    >
                      <Edit3 size={11} />
                      {currentRecord?.notes ? 'Edit Note' : 'Add Note'}
                    </button>
                  ) : null}
                </div>

                {editingNotePhase === selectedPhaseIdx ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      aria-label="Field observation notes for this recovery step"
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      placeholder="e.g. Applied neem foliar spray; pruned 3 yellowed lower leaves..."
                      className="w-full px-3 py-2 text-xs bg-bg-primary border border-border-light rounded-lg focus:outline-none focus:ring-1 focus:ring-moss font-sans"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingNotePhase(null)}
                        aria-label="Cancel note editing"
                        className="min-h-[44px] px-3 py-1.5 text-[10px] font-mono rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-text-stone"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveNote(selectedPhaseIdx)}
                        aria-label="Save note to clinical log"
                        className="min-h-[44px] px-3.5 py-1.5 bg-moss-deep text-white text-[10px] font-mono font-bold uppercase rounded-lg flex items-center gap-1"
                      >
                        <Save size={12} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : currentRecord?.notes ? (
                  <p className="text-[11px] text-text-bark italic bg-black/5 dark:bg-white/5 p-2 rounded-lg font-sans">
                    “{currentRecord.notes}”
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ── 4. Full Trajectory Timeline View ── */}
      {viewMode === 'trajectory' && (
        <div className="space-y-3 pt-1">
          {timeline.map((step, idx) => {
            const isDone = Boolean(completedRecords[idx]?.completedAt);
            const record = completedRecords[idx];
            return (
              <div
                key={idx}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                  isDone
                    ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-black/5 dark:bg-white/5 border-border-light'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-black uppercase tracking-wider text-moss">
                        {step.day || `Phase #${idx + 1}`}
                      </span>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono text-[9px] font-bold">
                          <Check size={10} />
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
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStep(idx)}
                    disabled={actionLoading === idx}
                    aria-label={`Toggle phase ${step.day} status`}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 ${
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
  );
}
