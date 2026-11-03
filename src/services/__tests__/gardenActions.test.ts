import { describe, it, expect, afterEach, vi } from 'vitest';
import { waterAllDue } from '../gardenActions';
import { db } from '../../db/database';
import * as plantService from '../plantService';

/**
 * The shared water-all loop: one definition of "thirsty", per-plant failure
 * capture. A single cloud-less plant (created offline) must never eat the
 * rest of the garden's watering — that was the whole point of extracting it.
 */

const NOW = new Date('2026-03-15T08:00:00');

afterEach(() => vi.restoreAllMocks());

describe('waterAllDue', () => {
  it('waters every due plant and reports the count', async () => {
    vi.spyOn(db.plants, 'toArray').mockResolvedValue([
      { id: 'a', name: 'Fern', isDemo: false, nextWaterDue: new Date(NOW.getTime() - 60_000) },
      { id: 'b', name: 'Basil', isDemo: false, nextWaterDue: new Date(NOW.getTime() - 60_000) },
      { id: 'c', name: 'Content', isDemo: false, nextWaterDue: new Date(NOW.getTime() + 86_400_000) },
      { id: 'd', name: 'Demo', isDemo: true, nextWaterDue: new Date(NOW.getTime() - 60_000) },
    ] as any);
    const water = vi.spyOn(plantService.PlantService, 'waterPlant').mockResolvedValue();

    const result = await waterAllDue(NOW);
    expect(result.total).toBe(2); // demo + not-due excluded
    expect(result.watered).toBe(2);
    expect(result.failed).toBe(0);
    expect(water).toHaveBeenCalledTimes(2);
  });

  it('one failing plant does not eat the rest — partial success is the truth', async () => {
    vi.spyOn(db.plants, 'toArray').mockResolvedValue([
      { id: 'a', name: 'Cloudless Ivy', isDemo: false, nextWaterDue: new Date(NOW.getTime() - 60_000) },
      { id: 'b', name: 'Fern', isDemo: false, nextWaterDue: new Date(NOW.getTime() - 60_000) },
      { id: 'c', name: 'Basil', isDemo: false, nextWaterDue: new Date(NOW.getTime() - 60_000) },
    ] as any);
    vi.spyOn(plantService.PlantService, 'waterPlant').mockImplementation(async (id: string) => {
      if (id === 'b') throw Object.assign(new Error('not on server'), { code: 'PLANT_NOT_ON_SERVER' });
    });

    const result = await waterAllDue(NOW);
    expect(result.watered).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.failedNames).toEqual(['Fern']);
  });

  it('nothing due reports a zero-total run', async () => {
    vi.spyOn(db.plants, 'toArray').mockResolvedValue([
      { id: 'a', name: 'Content', isDemo: false, nextWaterDue: new Date(NOW.getTime() + 86_400_000) },
    ] as any);
    const result = await waterAllDue(NOW);
    expect(result.total).toBe(0);
    expect(result.watered).toBe(0);
  });
});
