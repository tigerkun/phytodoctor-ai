import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, CloudSun, Sprout } from 'lucide-react';
import {
  buildPriorityQueue,
  deriveWeatherAlerts,
  plantsAffectedByAlert,
  summarizeGardenHealth,
  type GardenPlant,
} from '../../services/gardenDashboardService';

/**
 * The proactive garden dashboard: one health headline, the weather alerts
 * that actually threaten this collection, and today's priority queue. All
 * verdicts come from gardenDashboardService — this file is presentation and
 * navigation only.
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

export default function GardenDashboard({ plants, weather }: {
  plants: GardenPlant[];
  weather?: { temperature: number; humidity: number; forecast: Array<{ date: string; temp: number; humidity: number }> } | null;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const summary = useMemo(() => summarizeGardenHealth(plants), [plants]);
  const tasks = useMemo(() => buildPriorityQueue(plants), [plants]);
  const alerts = useMemo(
    () => (weather?.forecast?.length ? deriveWeatherAlerts(weather) : []),
    [weather],
  );

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

      {/* Weather alerts — only what threatens THIS collection */}
      {alerts.map(alert => {
        const affected = plantsAffectedByAlert(alert, plants);
        return (
          <div
            key={alert.kind}
            className="px-5 py-3 rounded-2xl border border-[#7aa5c4]/40 bg-[#7aa5c4]/10 flex items-start gap-3"
          >
            <CloudSun size={18} className="shrink-0 mt-0.5 text-[#3d6b8f]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#2c4a63] dark:text-[#a9cce3]">{alert.title}</p>
              <p className="text-[11px] text-[#4a6a85] dark:text-[#8fb8d4] leading-snug">{alert.body}</p>
              {affected.length > 0 && (
                <p className="text-[10px] font-mono mt-1 text-[#3d6b8f] dark:text-[#a9cce3]">
                  {affected.length} plant{affected.length === 1 ? '' : 's'} need{affected.length === 1 ? 's' : ''} protection: {affected.slice(0, 3).map(p => p.name).join(', ')}{affected.length > 3 ? '…' : ''}
                </p>
              )}
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
