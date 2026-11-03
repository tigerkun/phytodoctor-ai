import { deriveToleranceProfile } from '../lib/environmentalSimulation';

/**
 * The garden dashboard engine — everything the Home dashboard, the gallery
 * groups and the weather banner display is COMPUTED here from data that
 * already exists (plant records, check-in dates, the weather forecast).
 * No new tables: a task list that drifts from the plants it describes is
 * worse than none, and the streak heatmap already set the precedent of
 * deriving views instead of storing them.
 *
 * All functions are pure: plants and weather in, verdicts out. The UI files
 * own Dexie reads and rendering.
 */

// ── Shared plant view ───────────────────────────────────────────────────────

export interface GardenPlant {
  id: string;
  name: string;
  species?: string;
  guardianScore: number;
  status?: 'Stable' | 'Watching' | 'Alert' | 'Recovering';
  createdAt?: Date | string;
  nextWaterDue?: Date | string | null;
  lastCheckInAt?: Date | string | null;
  /** The score before the latest one, when history is handy — powers the
   *  "declining" indicator without a per-plant check-in query. */
  previousScore?: number | null;
  isDemo?: boolean;
}

const ms = (days: number) => days * 86_400_000;
const toDate = (v: Date | string | null | undefined): Date | null =>
  v ? new Date(v) : null;

// ── 3.1 Garden health summary ───────────────────────────────────────────────

export interface GardenHealthSummary {
  totalPlants: number;
  averageScore: number;
  attentionCount: number;
  band: 'thriving' | 'good' | 'attention' | 'critical';
  headline: string;
}

export function summarizeGardenHealth(plants: GardenPlant[]): GardenHealthSummary {
  const live = plants.filter(p => !p.isDemo);
  const totalPlants = live.length;
  if (!totalPlants) {
    return { totalPlants: 0, averageScore: 0, attentionCount: 0, band: 'good', headline: 'Your garden awaits its first specimen' };
  }
  const averageScore = Math.round(live.reduce((sum, p) => sum + (p.guardianScore || 0), 0) / totalPlants);
  const attentionCount = live.filter(p => (p.guardianScore || 0) < 60).length;
  const band = averageScore >= 90 ? 'thriving' : averageScore >= 70 ? 'good' : averageScore >= 50 ? 'attention' : 'critical';
  const headline = attentionCount
    ? `Your garden health: ${averageScore}% — ${attentionCount} plant${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention`
    : `Your garden health: ${averageScore}% — everything is holding steady`;
  return { totalPlants, averageScore, attentionCount, band, headline };
}

// ── 3.2 Priority queue — today's tasks, most urgent first ───────────────────

export type TaskKind = 'critical-health' | 'water-due' | 'check-in-stale' | 'celebrate-recovery';

export interface PriorityTask {
  kind: TaskKind;
  plantId: string;
  plantName: string;
  reason: string;
  /** Lower sorts first: dying plants outrank chores outrank celebrations. */
  urgency: number;
}

export function buildPriorityQueue(plants: GardenPlant[], now: Date = new Date()): PriorityTask[] {
  const tasks: PriorityTask[] = [];
  for (const plant of plants) {
    if (plant.isDemo) continue;
    const score = plant.guardianScore || 0;
    if (score < 50) {
      tasks.push({ kind: 'critical-health', plantId: plant.id, plantName: plant.name, reason: `Health at ${score}% — diagnose now`, urgency: 0 });
      continue; // a critical plant's other chores are noise
    }
    const waterDue = toDate(plant.nextWaterDue);
    if (waterDue && waterDue.getTime() <= now.getTime()) {
      const daysOverdue = Math.floor((now.getTime() - waterDue.getTime()) / ms(1));
      tasks.push({
        kind: 'water-due',
        plantId: plant.id,
        plantName: plant.name,
        reason: daysOverdue >= 1 ? `Water overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}` : 'Water due today',
        urgency: 1 + Math.min(daysOverdue, 7) / 10,
      });
    }
    const lastCheckIn = toDate(plant.lastCheckInAt);
    const staleDays = 30;
    if (!lastCheckIn || now.getTime() - lastCheckIn.getTime() > ms(staleDays)) {
      const ago = lastCheckIn ? Math.floor((now.getTime() - lastCheckIn.getTime()) / ms(1)) : null;
      tasks.push({
        kind: 'check-in-stale',
        plantId: plant.id,
        plantName: plant.name,
        reason: ago === null ? 'Never analyzed — take the first photo' : `Last checked in ${ago} days ago`,
        urgency: 2 + Math.min(ago ?? 99, 60) / 60,
      });
    }
    // Celebrations rank last: recovery crossing 90 is worth a moment, not a chore.
    if (plant.status === 'Recovering' && score >= 90) {
      tasks.push({ kind: 'celebrate-recovery', plantId: plant.id, plantName: plant.name, reason: 'Fully recovered — celebrate it', urgency: 3 });
    }
  }
  return tasks.sort((a, b) => a.urgency - b.urgency);
}

// ── 6.1/6.3 Weather alerts from the forecast ────────────────────────────────
// The forecast carries daily maxima (open-meteo daily fields), so thresholds
// are phrased against what the data can honestly support: a cold DAY, a hot
// DAY, dry air. No invented rain forecast — the daily payload has none.

export interface WeatherAlert {
  kind: 'frost' | 'heat' | 'dry-air';
  title: string;
  body: string;
  /** Days from today the condition first occurs (0 = today). */
  startsInDays: number;
}

export function deriveWeatherAlerts(
  weather: { temperature: number; humidity: number; forecast: Array<{ date: string; temp: number; humidity: number }> },
  now: Date = new Date(),
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const dayIndex = (date: string) => {
    const d = new Date(date);
    return Math.max(0, Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / ms(1)));
  };

  const frost = weather.forecast
    .map(f => ({ ...f, idx: dayIndex(f.date) }))
    .filter(f => f.temp <= 5)
    .sort((a, b) => a.idx - b.idx)[0];
  if (frost) {
    alerts.push({
      kind: 'frost',
      title: frost.idx === 0 ? 'Cold day today — protect the tropicals' : `Cold snap in ${frost.idx} day${frost.idx === 1 ? '' : 's'}`,
      body: `Daytime high only ${Math.round(frost.temp)}°C. Move cold-sensitive plants away from windows and skip fertilising.`,
      startsInDays: frost.idx,
    });
  }

  const heat = weather.forecast
    .map(f => ({ ...f, idx: dayIndex(f.date) }))
    .filter(f => f.temp >= 32)
    .sort((a, b) => a.idx - b.idx)[0];
  if (heat) {
    alerts.push({
      kind: 'heat',
      title: heat.idx === 0 ? 'Heat today — water goes further' : `Heat wave in ${heat.idx} day${heat.idx === 1 ? '' : 's'}`,
      body: `Daytime high ${Math.round(heat.temp)}°C. Check soil moisture more often and keep tender plants out of direct sun.`,
      startsInDays: heat.idx,
    });
  }

  const dry = weather.forecast
    .map(f => ({ ...f, idx: dayIndex(f.date) }))
    .filter(f => f.humidity > 0 && f.humidity < 35)
    .sort((a, b) => a.idx - b.idx)[0];
  if (dry) {
    alerts.push({
      kind: 'dry-air',
      title: 'Dry air coming — group your plants',
      body: `Humidity dropping to ${Math.round(dry.humidity)}%. Clustering plants raises local humidity; ferns and calatheas will thank you.`,
      startsInDays: dry.idx,
    });
  }

  return alerts;
}

/** Which of the Keeper's plants an alert actually threatens, from each
 *  species' tolerance profile — tropicals feel frost, humidity-lovers feel
 *  dry air, chill-intolerant species feel heat. */
export function plantsAffectedByAlert(
  alert: WeatherAlert,
  plants: GardenPlant[],
): { id: string; name: string }[] {
  return plants
    .filter(p => !p.isDemo)
    .filter(p => {
      const t = deriveToleranceProfile(p.species ?? '', {});
      if (alert.kind === 'frost') return t.idealTempMinC >= 10; // warmth-demanding species
      if (alert.kind === 'heat') return t.idealTempMaxC <= 28; // heat-shy species
      return t.idealHumidityMinPct >= 60; // humidity-hungry species
    })
    .map(p => ({ id: p.id, name: p.name }));
}

// ── 5.1/5.2 Gallery grouping + urgency sort ─────────────────────────────────

export type GalleryGroup = 'attention' | 'recovering' | 'thriving' | 'new';

export const GROUP_LABELS: Record<GalleryGroup, string> = {
  attention: '🚨 Needs Attention',
  recovering: '📈 Recovering',
  thriving: '✅ Thriving',
  new: '🆕 New',
};

export interface GroupedPlants {
  attention: GardenPlant[];
  recovering: GardenPlant[];
  thriving: GardenPlant[];
  new: GardenPlant[];
}


export function groupPlants<T extends GardenPlant>(plants: T[], now: Date = new Date()): Record<GalleryGroup, T[]> {
  const groups: Record<GalleryGroup, T[]> = { attention: [], recovering: [], thriving: [], new: [] };
  for (const plant of plants) {
    if (plant.isDemo) continue;
    const score = plant.guardianScore || 0;
    const created = toDate(plant.createdAt);
    const isNew = !!created && now.getTime() - created.getTime() < ms(7);
    if (isNew) groups.new.push(plant);
    else if (score < 60) groups.attention.push(plant);
    else if (plant.status === 'Recovering' || (score >= 60 && score < 80)) groups.recovering.push(plant);
    else groups.thriving.push(plant);
  }
  // 5.2 — urgency sort within each group: the sick by lowest score, the
  // thriving by oldest check-in (neglected favourites first), the new by
  // newest arrival, recovering by lowest score.
  groups.attention.sort((a, b) => a.guardianScore - b.guardianScore);
  groups.recovering.sort((a, b) => a.guardianScore - b.guardianScore);
  groups.thriving.sort((a, b) => {
    const aT = toDate(a.lastCheckInAt)?.getTime() ?? 0;
    const bT = toDate(b.lastCheckInAt)?.getTime() ?? 0;
    return aT - bT;
  });
  groups.new.sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
  return groups;
}

// ── 5.4 Per-card status indicators ──────────────────────────────────────────

export type StatusKind = 'water' | 'checkin' | 'declining';

export function statusIndicators(plant: GardenPlant, now: Date = new Date()): StatusKind[] {
  const out: StatusKind[] = [];
  const waterDue = toDate(plant.nextWaterDue);
  if (waterDue && waterDue.getTime() <= now.getTime()) out.push('water');
  const lastCheckIn = toDate(plant.lastCheckInAt);
  if (!lastCheckIn || now.getTime() - lastCheckIn.getTime() > ms(30)) out.push('checkin');
  // "Declining" needs a baseline: only claimed when history is available.
  if (typeof plant.previousScore === 'number' && plant.previousScore > 0 && plant.guardianScore <= plant.previousScore - 10) {
    out.push('declining');
  }
  return out;
}

export const STATUS_META: Record<StatusKind, { emoji: string; label: string }> = {
  water: { emoji: '💧', label: 'Water needed' },
  checkin: { emoji: '📸', label: 'Needs check-in' },
  declining: { emoji: '⚠️', label: 'Health declining' },
};

// ── 7.1 Gardener profile — the lens every recommendation is tuned through ──
// Stored, not computed: this is preference, not plant fact. localStorage
// with a memory fallback (the reminder engine's safeStore pattern) because a
// privacy-mode browser must not crash the dashboard.

export interface GardenerProfile {
  light: 'bright' | 'moderate' | 'low';
  humidity: 'high' | 'moderate' | 'dry';
  space: 'apartment' | 'house' | 'balcony';
  skill: 'beginner' | 'intermediate' | 'expert';
}

const PROFILE_KEY = 'phyto_gardener_profile';
export const DEFAULT_GARDENER_PROFILE: GardenerProfile = {
  light: 'moderate',
  humidity: 'moderate',
  space: 'apartment',
  skill: 'intermediate',
};

const profileMemory = new Map<string, string>();

export function gardenerProfile(): GardenerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY) ?? profileMemory.get(PROFILE_KEY) ?? null;
    return raw ? { ...DEFAULT_GARDENER_PROFILE, ...JSON.parse(raw) } : DEFAULT_GARDENER_PROFILE;
  } catch {
    return DEFAULT_GARDENER_PROFILE;
  }
}

export function saveGardenerProfile(profile: GardenerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    profileMemory.set(PROFILE_KEY, JSON.stringify(profile));
  }
}
