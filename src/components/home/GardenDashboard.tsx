import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ChevronDown, ChevronUp, CloudSun, ShieldCheck, Sprout } from 'lucide-react';
import {
  buildPriorityQueue,
  deriveWeatherAlerts,
  plantsAffectedByAlert,
  summarizeGardenHealth,
  type GardenPlant,
  type WeatherAlert,
} from '../../services/gardenDashboardService';
import { db } from '../../db/database';
import { useToast } from '../Toast';
import {
  WeatherAdjustmentService,
  withEffectiveWatering,
} from '../../services/weatherAdjustments';

/**
 * The proactive garden dashboard: one health headline, the weather alerts
 * that actually threaten this collection, and today's priority queue. All
 * verdicts come from gardenDashboardService — this file is presentation,
 * navigation, and the one-click "apply protection" that turns an alert into
 * a weatherAdjustments row (weatherAdjustments.ts).
 */

const BAND_STYLE: Record<string, string> = {
  thriving: 'border-[#52b788]/40 bg-[#52b788]/10 text-[#2d6a4f] dark:text-[#95d5b2]',
  good: 'border-[#8fbe5f]/40 bg-[#8fbe5f]/10 text-[#4f772d] dark:text-[#c7f9cc]',
  attention: 'border-[#d4a843]/40 bg-[#d4a843]/10 text-[#7a602f] dark:text-[#e8c97a]',
  critical: 'border-[#c45b4a]/40 bg-[#c45b4a]/10 text-[#8f2f26] dark:text-[#e07a5f]',
};

const TASK_EMOJI: Record<string, string> = {
  'critical-health': '🚨',
  'water-due': '💧',
  'check-in-stale': '📸',
  'celebrate-recovery': '🎉',
};

/** What "applied" means to the Keeper, per kind — the consequence, not the
 *  mechanism. Heat is the only kind that moves watering; the others record a
 *  physical act the Keeper performs themselves. */
const PROTECTION_TOAST: Record<WeatherAlert['kind'], string> = {
  frost: 'Marked for 7 days — bring the tropicals in and hold the fertiliser. 🛡',
  heat: 'Heat watering boost on for 7 days — those plants will ask for water sooner. 🛡',
  'dry-air': 'Marked for 7 days — cluster those plants to raise local humidity. 🛡',
};

export default function GardenDashboard({ plants, weather }: {
  plants: GardenPlant[];
  weather?: { temperature: number; humidity: number; forecast: Array<{ date: string; temp: number; humidity: number }> } | null;
}) {
  const navigate = useNavigate();
  const { success, info } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  // Active weather protections, expiry-filtered at read time. The queue is
  // built from the EFFECTIVE dates so the dashboard and the reminder engine
  // agree on what "due" means during a heat wave.
  const adjustments = useLiveQuery(() => db.weatherAdjustments.toArray(), []) ?? [];
  const queuePlants = useMemo(
    () => withEffectiveWatering(plants, adjustments),
    [plants, adjustments],
  );

  const summary = useMemo(() => summarizeGardenHealth(plants), [plants]);
  const tasks = useMemo(() => buildPriorityQueue(queuePlants), [queuePlants]);
  const alerts = useMemo(
    () => (weather?.forecast?.length ? deriveWeatherAlerts(weather) : []),
    [weather],
  );

  /** Latest expiry still covering a kind — powers the "Protected until" chip. */
  const protectedUntil = (kind: WeatherAlert['kind']): Date | null => {
    const rows = adjustments.filter(r => r.kind === kind);
    if (!rows.length) return null;
    const now = Date.now();
    const live = rows.filter(r => new Date(r.expiresAt).getTime() > now);
    if (!live.length) return null;
    return live.reduce<Date>(
      (latest, r) => (new Date(r.expiresAt) > latest ? new Date(r.expiresAt) : latest),
      new Date(0),
    );
  };

  const applyProtection = async (alert: WeatherAlert) => {
    if (applying) return;
    const affected = plantsAffectedByAlert(alert, plants);
    if (!affected.length) return;
    setApplying(alert.kind);
    try {
      await WeatherAdjustmentService.applyProtection(alert.kind, affected.map(p => p.id));
      success(PROTECTION_TOAST[alert.kind]);
    } catch {
      info('Could not save the protection — try again from the dashboard.');
    } finally {
      setApplying(null);
    }
  };

  if (!summary.totalPlants) return null;
  const visibleTasks = expanded ? tasks : tasks.slice(0, 3);

  return (
    <div className="space-y-3" role="region" aria-label="Garden dashboard">
      {/* Health headline */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        className={`w-full text-left px-5 py-4 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${BAND_STYLE[summary.band]}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Sprout size={20} className="shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-serif font-bold text-sm truncate">{summary.headline}</p>
            <p className="text-[10px] font-mono uppercase tracking-widest opacity-70">
              {tasks.length} task{tasks.length === 1 ? '' : 's'} today · tap for the queue
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
      </button>

      {/* Weather alerts — only what threatens THIS collection. Applying
          protection records a 7-day weatherAdjustment row per affected
          plant; heat is the only kind that also moves watering. */}
      {alerts.map(alert => {
        const affected = plantsAffectedByAlert(alert, plants);
        const until = protectedUntil(alert.kind);
        return (
          <div
            key={alert.kind}
            className="px-5 py-3 rounded-2xl border border-[#7aa5c4]/40 bg-[#7aa5c4]/10 flex items-start gap-3"
          >
            <CloudSun size={18} className="shrink-0 mt-0.5 text-[#3d6b8f]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#2c4a63] dark:text-[#a9cce3]">{alert.title}</p>
              <p className="text-[11px] text-[#4a6a85] dark:text-[#8fb8d4] leading-snug">{alert.body}</p>
              {until ? (
                <p className="text-[10px] font-mono mt-1 text-[#3d6b8f] dark:text-[#a9cce3] flex items-center gap-1">
                  <ShieldCheck size={12} aria-hidden="true" />
                  Protected until {until.toLocaleDateString()} — {affected.length} plant{affected.length === 1 ? '' : 's'} covered
                </p>
              ) : affected.length > 0 ? (
                <>
                  <p className="text-[10px] font-mono mt-1 text-[#3d6b8f] dark:text-[#a9cce3]">
                    {affected.length} plant{affected.length === 1 ? '' : 's'} need{affected.length === 1 ? 's' : ''} protection: {affected.slice(0, 3).map(p => p.name).join(', ')}{affected.length > 3 ? '…' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => applyProtection(alert)}
                    disabled={applying === alert.kind}
                    className="mt-2 min-h-9 px-3 rounded-lg border border-[#3d6b8f]/50 text-[#2c4a63] dark:text-[#a9cce3] text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-[#7aa5c4]/20 transition-colors disabled:opacity-50"
                  >
                    {applying === alert.kind ? 'Applying…' : `Apply protection to ${affected.length}`}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Priority queue */}
      {expanded && (
        <motion.ul
          initial={false}
          className="space-y-1.5"
          aria-label="Today's priority tasks"
        >
          {visibleTasks.map(task => (
            <li key={`${task.kind}-${task.plantId}`}>
              <button
                type="button"
                onClick={() => navigate(`/plant/${task.plantId}`)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-border-light bg-bg-primary/60 hover:border-moss/40 flex items-center gap-3 text-left transition-colors"
              >
                <span aria-hidden="true" className="text-base shrink-0">{TASK_EMOJI[task.kind]}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-text-bark truncate">{task.plantName}</span>
                  <span className="block text-[10px] text-text-stone truncate">{task.reason}</span>
                </span>
                {task.kind === 'critical-health' && <AlertTriangle size={14} className="text-[#c45b4a] shrink-0" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="px-4 py-3 text-[11px] text-text-stone">
              Nothing needs you today. The garden is content. 🌿
            </li>
          )}
        </motion.ul>
      )}
    </div>
  );
}
