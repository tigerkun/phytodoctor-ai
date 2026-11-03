import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { waterAllDue } from '../../services/gardenActions';
import { wateringDue } from '../../services/notificationService';
import { buildPriorityQueue, type GardenPlant } from '../../services/gardenDashboardService';
import { useToast } from '../Toast';
import { triggerHaptic } from '../../utils/hapticAudio';

/**
 * One-click garden actions for the two assistant surfaces — the assistant
 * answers questions, and these chips let it also perform the acts, straight
 * from the same priority queue the dashboard shows. The loop reuses
 * QuickActionsFab's water-all pattern; navigation chips are plain links.
 *
 * Renders NOTHING when the garden needs nothing: a row of inert chips would
 * be decoration pretending to be usefulness.
 */

const STYLES = {
  glass:
    'px-3 py-1 min-h-[32px] shrink-0 bg-bg-primary border border-border-medium rounded-full text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-moss hover:border-moss transition-all disabled:opacity-40',
  telegraph:
    'min-h-[44px] px-3 py-1.5 shrink-0 bg-[#1c3324] hover:bg-[#254230] border border-[#3b5e43] rounded-md text-[11px] font-serif text-[#d8e6d8] hover:text-[#fff6df] transition-all shadow-xs active:scale-95 disabled:opacity-40',
} as const;

export default function GardenActionChips({ variant = 'glass' }: { variant?: 'glass' | 'telegraph' }) {
  const navigate = useNavigate();
  const { success, info } = useToast();
  const [watering, setWatering] = useState(false);

  const plants = useLiveQuery(() => db.plants.toArray(), []) ?? [];
  const now = useMemo(() => new Date(), [plants]);
  const due = useMemo(
    () => plants.filter(p => !p.isDemo && wateringDue(p, now)),
    [plants, now],
  );
  const tasks = useMemo(
    () => buildPriorityQueue(plants as GardenPlant[], now),
    [plants, now],
  );

  const waterAll = async () => {
    if (watering) return;
    setWatering(true);
    try {
      const result = await waterAllDue();
      if (!result.total) {
        info('Nothing is thirsty right now. 🌿');
        return;
      }
      if (result.failed) {
        // Partial success is the honest outcome: name it, and the chip's
        // due-count stays live so tapping again retries only what failed.
        triggerHaptic('medium');
        info(
          `💧 Watered ${result.watered} of ${result.total} — ${result.failed} failed` +
            ` (${result.failedNames[0]}${result.failedNames.length > 1 ? ' +more' : ''}). Tap again to retry.`,
        );
      } else {
        triggerHaptic('light');
        success(`Watered ${result.watered} plant${result.watered === 1 ? '' : 's'}. 💧`);
      }
    } catch (err) {
      console.error('[assistant-chips] water all failed:', err);
      info('Could not reach the garden data — try again.');
    } finally {
      setWatering(false);
    }
  };

  const critical = tasks.find(t => t.kind === 'critical-health');
  const stale = tasks.find(t => t.kind === 'check-in-stale');
  if (!due.length && !critical && !stale) return null;

  const chip = STYLES[variant];
  return (
    <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Garden quick actions">
      {due.length > 0 && (
        <button type="button" onClick={waterAll} disabled={watering} className={chip}>
          {watering ? 'Watering…' : `💧 Water ${due.length} thirsty`}
        </button>
      )}
      {critical && (
        <button type="button" onClick={() => navigate(`/plant/${critical.plantId}`)} className={chip}>
          🚨 Help {critical.plantName}
        </button>
      )}
      {!critical && stale && (
        <button type="button" onClick={() => navigate(`/plant/${stale.plantId}`)} className={chip}>
          📸 Check in on {stale.plantName}
        </button>
      )}
    </div>
  );
}
