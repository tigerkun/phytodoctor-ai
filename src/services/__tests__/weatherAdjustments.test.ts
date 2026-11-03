import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  activeAdjustments,
  hasActive,
  effectiveNextWaterDue,
  withEffectiveWatering,
  WeatherAdjustmentService,
  ADJUSTMENT_DAYS,
  HEAT_WATER_FACTOR,
  HISTORY_RETENTION_DAYS,
} from '../weatherAdjustments';
import { db } from '../../db/database';
import type { WeatherAdjustment } from '../../types';

/**
 * Weather protection rows: expiry is computed at read time, heat is the only
 * kind that moves watering (forward, never back), and the dashboard queue
 * and the reminder engine see the same effective dates.
 */

const NOW = new Date('2026-03-15T12:00:00');
const DAY = 86_400_000;

const row = (over: Partial<WeatherAdjustment> = {}): WeatherAdjustment => ({
  id: over.id ?? crypto.randomUUID(),
  kind: over.kind ?? 'heat',
  plantId: over.plantId ?? 'p1',
  createdAt: over.createdAt ?? new Date(NOW.getTime() - 2 * DAY),
  expiresAt: over.expiresAt ?? new Date(NOW.getTime() + 5 * DAY),
});

describe('activeAdjustments', () => {
  it('the scan found the service it means to check', () => {
    expect(ADJUSTMENT_DAYS).toBe(7);
  });

  it('keeps live rows and silently drops expired ones', () => {
    const rows = [row(), row({ expiresAt: new Date(NOW.getTime() - 1000) })];
    expect(activeAdjustments(rows, NOW)).toHaveLength(1);
    expect(activeAdjustments(rows, NOW)[0].kind).toBe('heat');
  });

  it('the boundary is honest: a row expiring this second is gone', () => {
    const rows = [row({ expiresAt: NOW })];
    expect(activeAdjustments(rows, NOW)).toHaveLength(0);
  });
});

describe('effectiveNextWaterDue', () => {
  const plant = {
    id: 'p1',
    // Watered 6 days ago on a 7-day cadence: stored due is tomorrow.
    lastWateredAt: new Date(NOW.getTime() - 6 * DAY),
    nextWaterDue: new Date(NOW.getTime() + 1 * DAY),
    wateringIntervalDays: 7,
  };

  it('leaves the stored date alone without an adjustment', () => {
    expect(effectiveNextWaterDue(plant, [], NOW)).toEqual(plant.nextWaterDue);
  });

  it('pulls watering forward under an active heat adjustment', () => {
    // 6 days elapsed × 7-day interval × 2/3 → due ~4.67 days after watering,
    // which is already ~1.33 days in the past: due now.
    const boosted = effectiveNextWaterDue(plant, [row()], NOW)!;
    expect(boosted.getTime()).toBeCloseTo(
      plant.lastWateredAt!.getTime() + 7 * HEAT_WATER_FACTOR * DAY,
      -2,
    );
    expect(boosted.getTime()).toBeLessThan(NOW.getTime());
  });

  it('never pushes watering LATER than the stored date', () => {
    // Watered this morning: the boosted date is later than the stored one.
    const fresh = { ...plant, lastWateredAt: new Date(NOW.getTime() - 2 * 3600_000) };
    const due = effectiveNextWaterDue(fresh, [row()], NOW);
    expect(due).toEqual(fresh.nextWaterDue);
  });

  it('cannot scale a cadence that has no last-watering anchor', () => {
    const unwatered = { ...plant, lastWateredAt: null, nextWaterDue: new Date(NOW.getTime() + DAY) };
    expect(effectiveNextWaterDue(unwatered, [row()], NOW)).toEqual(unwatered.nextWaterDue);
  });

  it('frost and dry-air never touch the schedule', () => {
    for (const kind of ['frost', 'dry-air'] as const) {
      expect(effectiveNextWaterDue(plant, [row({ kind })], NOW)).toEqual(plant.nextWaterDue);
    }
  });

  it('an expired heat row is not a heat row', () => {
    expect(effectiveNextWaterDue(plant, [row({ expiresAt: new Date(NOW.getTime() - 1000) })], NOW))
      .toEqual(plant.nextWaterDue);
  });
});

describe('withEffectiveWatering', () => {
  it('is a no-op without an active heat row (same references)', () => {
    const plants = [{ id: 'p1', nextWaterDue: new Date(NOW.getTime() + DAY) }];
    expect(withEffectiveWatering(plants, [], NOW)).toBe(plants);
  });

  it('maps heat-boosted dates so the queue and the engine agree', () => {
    const plants = [{
      id: 'p1',
      lastWateredAt: new Date(NOW.getTime() - 6 * DAY),
      nextWaterDue: new Date(NOW.getTime() + DAY),
      wateringIntervalDays: 7,
    }];
    const [mapped] = withEffectiveWatering(plants, [row()], NOW);
    expect(mapped).not.toBe(plants[0]);
    expect(mapped.nextWaterDue!.getTime()).toBeLessThan(NOW.getTime());
  });
});

describe('WeatherAdjustmentService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('applyProtection writes one 7-day row per plant', async () => {
    const puts: WeatherAdjustment[] = [];
    vi.spyOn(db.weatherAdjustments, 'bulkPut').mockImplementation((async (rows: any) => {
      puts.push(...rows);
    }) as any);
    const n = await WeatherAdjustmentService.applyProtection(
      'frost',
      ['a', 'b'],
      NOW,
    );
    expect(n).toBe(2);
    expect(puts).toHaveLength(2);
    expect(new Set(puts.map(r => r.plantId))).toEqual(new Set(['a', 'b']));
    for (const r of puts) {
      expect(r.kind).toBe('frost');
      expect(new Date(r.expiresAt).getTime()).toBe(NOW.getTime() + ADJUSTMENT_DAYS * DAY);
    }
  });

  it('applyProtection with nobody to protect writes nothing', async () => {
    const put = vi.spyOn(db.weatherAdjustments, 'bulkPut').mockResolvedValue(undefined as any);
    expect(await WeatherAdjustmentService.applyProtection('heat', [])).toBe(0);
    expect(put).not.toHaveBeenCalled();
  });

  it('protectionExpiry returns the latest live expiry for a kind', async () => {
    vi.spyOn(db.weatherAdjustments, 'toArray').mockResolvedValue([
      row({ kind: 'heat', expiresAt: new Date(NOW.getTime() + 3 * DAY) }),
      row({ kind: 'heat', plantId: 'p2', expiresAt: new Date(NOW.getTime() + 6 * DAY) }),
      row({ kind: 'frost', expiresAt: new Date(NOW.getTime() + 9 * DAY) }),
      row({ kind: 'dry-air', expiresAt: new Date(NOW.getTime() - DAY) }), // expired
    ] as any);
    expect(await WeatherAdjustmentService.protectionExpiry('heat', NOW)).toEqual(new Date(NOW.getTime() + 6 * DAY));
    expect(await WeatherAdjustmentService.protectionExpiry('frost', NOW)).toEqual(new Date(NOW.getTime() + 9 * DAY));
    expect(await WeatherAdjustmentService.protectionExpiry('dry-air', NOW)).toBeNull();
  });

  it('hasActive matches plant and kind together', () => {
    const rows = [row({ plantId: 'p1', kind: 'heat' })];
    expect(hasActive(rows, 'p1', 'heat', NOW)).toBe(true);
    expect(hasActive(rows, 'p1', 'frost', NOW)).toBe(false);
    expect(hasActive(rows, 'p2', 'heat', NOW)).toBe(false);
  });

  it('revertProtection deletes only the ACTIVE rows of a kind — no 7-day lock-in', async () => {
    const deleted: string[] = [];
    vi.spyOn(WeatherAdjustmentService, 'allActive').mockResolvedValue([
      row({ id: 'live-1', kind: 'heat', expiresAt: new Date(NOW.getTime() + DAY) }),
      row({ id: 'live-2', kind: 'heat', plantId: 'p2', expiresAt: new Date(NOW.getTime() + DAY) }),
      row({ id: 'old-frost', kind: 'frost', expiresAt: new Date(NOW.getTime() + DAY) }),
    ]);
    vi.spyOn(db.weatherAdjustments, 'bulkDelete').mockImplementation((async (ids: string[]) => {
      deleted.push(...ids);
    }) as any);

    const n = await WeatherAdjustmentService.revertProtection('heat', NOW);
    expect(n).toBe(2);
    expect(deleted.sort()).toEqual(['live-1', 'live-2']);
    await expect(WeatherAdjustmentService.revertProtection('dry-air', NOW)).resolves.toBe(0);
  });

  it('pruneExpired drops only rows that expired beyond the 30-day history window', async () => {
    const cutoffArg = vi.fn();
    vi.spyOn(db.weatherAdjustments, 'where').mockImplementation(((field: string) => {
      expect(field).toBe('expiresAt');
      return {
        below: (cutoff: Date) => {
          cutoffArg(cutoff);
          return { delete: async () => 3 };
        },
      };
    }) as any);

    await WeatherAdjustmentService.pruneExpired(NOW);
    expect(cutoffArg.mock.calls[0][0].getTime()).toBe(
      NOW.getTime() - HISTORY_RETENTION_DAYS * DAY,
    );
  });

  it('recentApplicationCount counts creations inside the window, expiry aside', async () => {
    vi.spyOn(db.weatherAdjustments, 'where').mockImplementation(((field: string) => {
      expect(field).toBe('kind');
      return {
        equals: (k: string) => ({
          // The index query owns kind-matching — the heat bucket holds only
          // heat rows; the service just counts creations inside the window.
          toArray: async () =>
            k === 'heat'
              ? [
                  row({ createdAt: new Date(NOW.getTime() - 2 * DAY) }),
                  row({ createdAt: new Date(NOW.getTime() - 29 * DAY) }),
                  row({ createdAt: new Date(NOW.getTime() - 40 * DAY) }), // outside window
                ]
              : [],
        }),
      };
    }) as any);

    expect(await WeatherAdjustmentService.recentApplicationCount('heat', NOW)).toBe(2);
    expect(await WeatherAdjustmentService.recentApplicationCount('frost', NOW)).toBe(0);
  });

  it('applyProtection still succeeds when history pruning fails', async () => {
    vi.spyOn(db.weatherAdjustments, 'bulkPut').mockResolvedValue(undefined as any);
    vi.spyOn(WeatherAdjustmentService, 'pruneExpired').mockRejectedValue(new Error('housekeeping down'));
    await expect(
      WeatherAdjustmentService.applyProtection('heat', ['p1'], NOW),
    ).resolves.toBe(1);
  });
});
