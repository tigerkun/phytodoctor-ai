import { db } from '../db/database';
import type { WeatherAdjustment } from '../types';

/**
 * One-click weather protection — the actable half of the garden dashboard's
 * weather alerts. The dashboard detects frost, heat and dry air
 * (gardenDashboardService.deriveWeatherAlerts) and maps them to the plants
 * each condition actually threatens; this module records that the Keeper
 * responded, for seven days, and lets the one kind that CAN move a schedule
 * move it:
 *
 *  - heat: watering is pulled forward to ~⅔ of the plant's own interval —
 *    "water about 50% more often", phrased as an interval so it composes
 *    with the cadence instead of overriding it.
 *  - frost / dry-air: no schedule change. Bringing plants indoors and
 *    clustering pots are physical acts; recording the protection buys the
 *    Keeper a quiet card instead of a nagging one, and the truth that no
 *    watering advice follows is deliberate.
 *
 * Like the reminder engine, due-ness is COMPUTED: expired rows are filtered
 * at read time (activeAdjustments), never reaped by a timer.
 */

export const ADJUSTMENT_DAYS = 7;
/** Heat watering factor: 2/3 interval ≈ 50% more frequent watering. */
export const HEAT_WATER_FACTOR = 2 / 3;

export type AdjustmentKind = WeatherAdjustment['kind'];

// ── Pure core — rows in, verdicts out, no Dexie, no DOM ─────────────────────

export function activeAdjustments(
  rows: WeatherAdjustment[],
  now: Date = new Date(),
): WeatherAdjustment[] {
  const t = now.getTime();
  return rows.filter(r => new Date(r.expiresAt).getTime() > t);
}

export function hasActive(
  rows: WeatherAdjustment[],
  plantId: string,
  kind: AdjustmentKind,
  now: Date = new Date(),
): boolean {
  return activeAdjustments(rows, now).some(r => r.plantId === plantId && r.kind === kind);
}

/**
 * The next-water date the reminder engine and the dashboard queue honour:
 * pulled forward under an active heat adjustment, the stored date otherwise.
 * Never pushes watering LATER — a protection that defers care during weather
 * stress would be advice pointing the wrong way.
 */
export function effectiveNextWaterDue(
  plant: {
    id: string;
    nextWaterDue?: Date | string | null;
    lastWateredAt?: Date | string | null;
    wateringIntervalDays?: number | null;
  },
  rows: WeatherAdjustment[],
  now: Date = new Date(),
): Date | null {
  const stored = plant.nextWaterDue ? new Date(plant.nextWaterDue) : null;
  if (!hasActive(rows, plant.id, 'heat', now)) return stored;
  const last = plant.lastWateredAt ? new Date(plant.lastWateredAt) : null;
  if (!last) return stored; // no cadence anchor — nothing to scale
  const interval = plant.wateringIntervalDays ?? 7;
  const boosted = new Date(last.getTime() + interval * HEAT_WATER_FACTOR * 86_400_000);
  return boosted < (stored ?? boosted) ? boosted : stored;
}

/**
 * Queue-facing view: the same plants with heat-adjusted watering dates
 * applied, so the dashboard's task list and the reminder engine agree on
 * what "due" means during a heat wave. Plants without a change are returned
 * untouched (same reference) so React memoisation keeps working.
 */
export function withEffectiveWatering<
  T extends {
    id: string;
    nextWaterDue?: Date | string | null;
    lastWateredAt?: Date | string | null;
    wateringIntervalDays?: number | null;
  },
>(plants: T[], rows: WeatherAdjustment[], now: Date = new Date()): T[] {
  if (!activeAdjustments(rows, now).some(r => r.kind === 'heat')) return plants;
  return plants.map(p => {
    const due = effectiveNextWaterDue(p, rows, now);
    if (!due) return p;
    const current = p.nextWaterDue ? new Date(p.nextWaterDue).getTime() : null;
    return current === due.getTime() ? p : { ...p, nextWaterDue: due };
  });
}

// ── Dexie CRUD — thin, the logic lives above ────────────────────────────────

export const WeatherAdjustmentService = {
  /** One row per plant, all sharing an expiry exactly ADJUSTMENT_DAYS out. */
  async applyProtection(kind: AdjustmentKind, plantIds: string[], now: Date = new Date()): Promise<number> {
    if (!plantIds.length) return 0;
    const expiresAt = new Date(now.getTime() + ADJUSTMENT_DAYS * 86_400_000);
    const rows: WeatherAdjustment[] = plantIds.map(plantId => ({
      id: crypto.randomUUID(),
      kind,
      plantId,
      createdAt: now,
      expiresAt,
    }));
    await db.weatherAdjustments.bulkPut(rows);
    return rows.length;
  },

  async activeForPlant(plantId: string, now: Date = new Date()): Promise<WeatherAdjustment[]> {
    const rows = await db.weatherAdjustments.where('plantId').equals(plantId).toArray();
    return activeAdjustments(rows as WeatherAdjustment[], now);
  },

  async allActive(now: Date = new Date()): Promise<WeatherAdjustment[]> {
    const rows = await db.weatherAdjustments.toArray();
    return activeAdjustments(rows as WeatherAdjustment[], now);
  },

  /** The latest expiry still covering a kind — powers the dashboard's
   *  "Protected until" chip. */
  async protectionExpiry(kind: AdjustmentKind, now: Date = new Date()): Promise<Date | null> {
    const rows = (await this.allActive(now)).filter(r => r.kind === kind);
    let latest: Date | null = null;
    for (const r of rows) {
      const expiresAt = new Date(r.expiresAt);
      if (!latest || expiresAt > latest) latest = expiresAt;
    }
    return latest;
  },
};
