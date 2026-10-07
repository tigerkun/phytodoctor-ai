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
} from 'lucide-react';
import { useEcoMode } from '../../hooks/useEcoMode';
import type { PlantScanReport } from '../../lib/scanReport';
import {
  deriveToleranceProfile,
  simulateMicroclimate,
  type MicroclimateInput,
} from '../../lib/environmentalSimulation';

interface PlantTelemetryCardProps {
  report: PlantScanReport;
  className?: string;
  compact?: boolean;
}

export default function PlantTelemetryCard({ report, className = '', compact = false }: PlantTelemetryCardProps) {
  const { shouldDisableAnimations } = useEcoMode();
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const [showSimulator, setShowSimulator] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  // Environmental simulation state (seeded safely from scan vitals)
  const careParsed = report?.careParsed;
  const initialTemp = careParsed?.temperatureC ?? 22;
  const initialHumidity = careParsed?.soilMoisture === 'Wet' ? 75 : careParsed?.soilMoisture === 'Dry' ? 35 : 55;
  const initialLight = careParsed?.lightLevel ?? 'Indirect';

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
    setSelectedPhaseIdx(0);
    setCompletedSteps({});
  }, [initialTemp, initialHumidity, initialLight, report?.scientificName, report?.displayName]);

  const toleranceProfile = useMemo(
    () => deriveToleranceProfile(report?.scientificName || report?.displayName || 'Plant', report?.careParsed),
    [report?.scientificName, report?.displayName, report?.careParsed]
  );

  const simulation = useMemo(
    () => simulateMicroclimate(simEnv, toleranceProfile),
    [simEnv, toleranceProfile]
  );

  const toggleStep = (idx: number) => {
    setCompletedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const timeline = report?.timeline || [];
  const currentPhase = timeline[selectedPhaseIdx] || timeline[0];

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
        <div className="space-y-3 pt-2 border-t border-border-light/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-moss" />
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-moss">
                Clinical Recovery Roadmap ({timeline.length} Phases)
              </span>
            </div>
            <span className="text-[9px] font-mono text-text-stone">
              Phase {selectedPhaseIdx + 1} of {timeline.length}
            </span>
          </div>

          {/* Phase Stepper Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {timeline.map((step, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPhaseIdx(idx)}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                  selectedPhaseIdx === idx
                    ? 'bg-moss-deep text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 text-text-stone hover:bg-black/10'
                }`}
              >
                <span>{step.day || `Phase #${idx + 1}`}</span>
                {completedSteps[idx] && <CheckCircle2 size={11} className="text-emerald-300" />}
              </button>
            ))}
          </div>

          {/* Current Phase Active Dossier */}
          {currentPhase && (
            <motion.div
              key={selectedPhaseIdx}
              {...(!shouldDisableAnimations ? { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } } : {})}
              className="p-3.5 sm:p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-border-light space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[9px] font-mono font-black uppercase tracking-wider text-moss">
                    Target: {currentPhase.day || `Stage ${selectedPhaseIdx + 1}`}
                  </span>
                  <h4 className="text-xs font-bold text-text-bark mt-0.5 leading-snug">
                    {currentPhase.action}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => toggleStep(selectedPhaseIdx)}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                    completedSteps[selectedPhaseIdx]
                      ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                      : 'bg-black/10 dark:bg-white/10 text-text-stone hover:text-text-bark'
                  }`}
                >
                  <CheckCircle2 size={11} />
                  {completedSteps[selectedPhaseIdx] ? 'Applied ✓' : 'Mark Done'}
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
            </motion.div>
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
                    <span className="text-text-stone">Humidity (%) <span title="Seeded from the scan, not measured">≈</span></span>
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
