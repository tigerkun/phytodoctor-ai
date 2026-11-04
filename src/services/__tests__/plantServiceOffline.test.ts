import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlantService } from '../plantService';
import { GameService } from '../gameService';
import { db } from '../../db/database';
import type { Plant } from '../../types';

/**
 * The session-aware offline-first contract. A CONFIGURED Supabase client is
 * not a CLOUD session: local-only accounts (`sb_…` ids) have no session, and
 * before the resolveCloudSession gate every plant path they touched failed —
 * inserts with a non-uuid user_id, RLS-zero updates, and fetches that
 * broadcast an empty garden over their real local plants.
 *
 * Supabase is mocked at the module boundary so both states are reachable:
 * `state.sessionUserId = null` (local account) vs a uuid (cloud session).
 */

const state = vi.hoisted(() => ({ sessionUserId: null as string | null }));

vi.mock('../../lib/supabase', () => {
  const chain = {
    select: (..._args: unknown[]) => chain,
    order: async () => ({ data: [], error: null }),
    eq: () => chain,
    update: () => chain,
    insert: () => chain,
    delete: () => chain,
    single: () => chain,
    then: (resolve: (v: unknown) => void) => {
      resolve({ data: [{ id: 'cloud-plant' }], error: null });
    },
  };
  return {
    supabase: {
      auth: {
        getSession: async () => ({
          data: { session: state.sessionUserId ? { user: { id: state.sessionUserId } } : null },
        }),
      },
      from: vi.fn(() => chain),
    },
  };
});

import { supabase } from '../../lib/supabase';

const FERN = {
  id: 'fern-1',
  userId: 'sb_test-user',
  name: 'Verification Fern',
  species: 'Nephrolepis exaltata',
  guardianScore: 85,
  status: 'Stable' as const,
  nextWaterDue: new Date('2026-11-10T08:00:00'),
  createdAt: new Date('2026-11-01T08:00:00'),
  updatedAt: new Date('2026-11-04T08:00:00'),
};

/** Node test env has no localStorage; GameService.getUserId reads it. */
function stubLocalStorage() {
  const store = new Map<string, string>([['botanical_guardian_userId', 'sb_test-user']]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
  });
  return store;
}

function stubLocalTable(fern: any = FERN) {
  vi.spyOn(db.plants, 'bulkGet').mockResolvedValue([] as any);
  vi.spyOn(db.plants, 'bulkPut').mockResolvedValue(undefined as any);
  vi.spyOn(db.plants, 'where').mockReturnValue({
    equals: () => ({ toArray: async () => [fern] }),
  } as any);
  vi.spyOn(db.plants, 'get').mockResolvedValue(fern as any);
  const update = vi.spyOn(db.plants, 'update').mockResolvedValue(1);
  const put = vi.spyOn(db.plants, 'put').mockResolvedValue('fern-1');
  return { update, put };
}

describe('plantService offline-first (no cloud session)', () => {
  beforeEach(() => {
    state.sessionUserId = null;
    stubLocalStorage();
    vi.mocked(supabase!.from).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('the scan found the service it means to check', () => {
    expect(GameService.getUserId()).toBe('sb_test-user');
    expect(supabase).toBeTruthy();
  });

  it('fetchPlants returns the local plants instead of an RLS-empty list', async () => {
    stubLocalTable();
    const all = await PlantService.fetchPlants();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Verification Fern');
    // The cloud was never queried — a configured client without a session
    // must not even ask.
    expect(supabase!.from).not.toHaveBeenCalled();
  });

  it('addPlant goes through Dexie with the local id, never a uuid insert', async () => {
    const { put } = stubLocalTable();
    const created = await PlantService.addPlant({ name: 'Verification Fern', species: 'Nephrolepis exaltata' });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0].userId).toBe('sb_test-user');
    expect(created.name).toBe('Verification Fern');
    expect(supabase!.from).not.toHaveBeenCalled();
  });

  it('updatePlant (mute, cadence, watering) is local-only and does not throw', async () => {
    const { update } = stubLocalTable();
    await PlantService.updatePlant('fern-1', { remindersMuted: true });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toBe('fern-1');
    expect(supabase!.from).not.toHaveBeenCalled();
  });

  it('waterPlant records the watering locally', async () => {
    const { update } = stubLocalTable();
    await PlantService.waterPlant('fern-1', new Date('2026-11-05T08:00:00'));
    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][1] as Partial<Plant>;
    expect(patch.lastWateredAt).toBeTruthy();
    expect(patch.nextWaterDue).toBeTruthy();
  });

  it('deletePlant skips the cloud delete for local plants', async () => {
    stubLocalTable();
    vi.spyOn(db.plants, 'delete').mockResolvedValue(undefined as any);
    vi.spyOn(db.checkins, 'where').mockReturnValue({ equals: () => ({ delete: async () => 0 }) } as any);
    vi.spyOn(db.predictions, 'where').mockReturnValue({ equals: () => ({ delete: async () => 0 }) } as any);
    vi.spyOn(db.sensorReadings, 'where').mockReturnValue({ equals: () => ({ delete: async () => 0 }) } as any);
    vi.spyOn(db.alerts, 'where').mockReturnValue({ equals: () => ({ delete: async () => 0 }) } as any);
    vi.spyOn(db.notes, 'where').mockReturnValue({ equals: () => ({ delete: async () => 0 }) } as any);
    await PlantService.deletePlant('fern-1');
    expect(supabase!.from).not.toHaveBeenCalled();
  });
});

describe('plantService cloud path (live session)', () => {
  beforeEach(() => {
    state.sessionUserId = '11111111-2222-3333-4444-555555555555';
    stubLocalStorage();
    vi.mocked(supabase!.from).mockClear();
    vi.spyOn(db.plants, 'bulkGet').mockResolvedValue([] as any);
    vi.spyOn(db.plants, 'bulkPut').mockResolvedValue(undefined as any);
    vi.spyOn(db.plants, 'where').mockReturnValue({
      equals: () => ({ toArray: async () => [] }),
    } as any);
  });

  afterEach(() => {
    state.sessionUserId = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetchPlants with a session reads the cloud (unchanged behaviour)', async () => {
    const all = await PlantService.fetchPlants();
    expect(supabase!.from).toHaveBeenCalledWith('plants');
    expect(all).toEqual([]);
  });

  it('addPlant with a session inserts to the cloud with the session uuid', async () => {
    const { put } = stubLocalTable();
    await PlantService.addPlant({ name: 'Cloud Fern', species: 'Nephrolepis exaltata' });
    expect(supabase!.from).toHaveBeenCalledWith('plants');
    // The local mirror still happens (the merged list is what the UI sees).
    expect(put).toHaveBeenCalled();
  });
});
