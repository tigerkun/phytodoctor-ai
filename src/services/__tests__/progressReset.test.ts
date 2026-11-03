import { describe, it, expect, afterEach, vi } from 'vitest';
import { db } from '../../db/database';
import { resetGardenProgress, GARDEN_TABLES, GARDEN_STORAGE_KEYS } from '../progressReset';

/**
 * The danger-zone reset clears a garden in one transaction. The invariants
 * worth a regression net: everything it names must be a real table (a typo
 * here would throw mid-reset and leave half a garden), the Keeper's own
 * property and purchases are never in the list, and the profile row is reset
 * in place — local-only accounts keep their credentials in it.
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('progress reset table list', () => {
  it('the scan found the service it means to check', () => {
    expect(GARDEN_TABLES).toContain('plants');
    expect(GARDEN_TABLES.length).toBeGreaterThan(10);
  });

  it('names only tables that actually exist in the schema', () => {
    // db.table() throws on an unknown name — exactly the mid-reset crash this
    // list must never cause.
    for (const name of GARDEN_TABLES) {
      expect(() => db.table(name), `table "${name}" must exist`).not.toThrow();
    }
  });

  it('never clears the Keeper’s own property or purchases', () => {
    expect(GARDEN_TABLES).not.toContain('photos'); // their images
    expect(GARDEN_TABLES).not.toContain('subscriptions'); // real Pro purchase
    expect(GARDEN_TABLES).not.toContain('cosmetics'); // bought goods
    expect(GARDEN_TABLES).not.toContain('userProfile'); // reset in place, credentials live there
  });
});

describe('resetGardenProgress', () => {
  function stubTables() {
    const cleared: string[] = [];
    vi.spyOn(db, 'table').mockImplementation(((name: string) => ({
      clear: async () => {
        cleared.push(name);
      },
    })) as any);
    vi.spyOn(db, 'transaction').mockImplementation(
      (async (_mode: any, _tables: any, fn: () => Promise<void>) => {
        await fn();
      }) as any,
    );
    return cleared;
  }

  it('clears every garden table and resets the profile in place', async () => {
    const cleared = stubTables();
    const profile = {
      userId: 'u1',
      username: 'keeper',
      passwordHash: 'sha-hash',
      seeds: 500,
      currentStreak: 4,
      longestStreak: 9,
      collectionSize: 3,
      totalXP: 1200,
      discoveredSpecies: ['Monstera deliciosa'],
      tier: 'free',
    };
    const puts: any[] = [];
    vi.spyOn(db.userProfile, 'get').mockResolvedValue(profile as any);
    vi.spyOn(db.userProfile, 'put').mockImplementation((async (row: any) => {
      puts.push(row);
    }) as any);

    await resetGardenProgress('u1');

    expect(cleared.sort()).toEqual([...GARDEN_TABLES].sort());
    expect(puts).toHaveLength(1);
    expect(puts[0].seeds).toBe(0);
    expect(puts[0].discoveredSpecies).toEqual([]);
    // Identity survives: a local-only account must still be able to sign in.
    expect(puts[0].passwordHash).toBe('sha-hash');
    expect(puts[0].username).toBe('keeper');
  });

  it('sweeps device-local progress markers but not preferences', async () => {
    stubTables();
    // No profile row in this scenario — must not touch real IndexedDB.
    vi.spyOn(db.userProfile, 'get').mockResolvedValue(undefined as any);
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
    });
    store.set('botanical_quiz_accuracy', '{"correct":5,"total":10}');
    store.set('botanical_quiz_attempts_2026-11-04', '3');
    store.set('botanical_guardian_tour_done_u1', '1');
    store.set('phyto_reminder_prefs', '{}'); // a preference, not progress

    await resetGardenProgress('u1');

    for (const key of GARDEN_STORAGE_KEYS) {
      expect(store.has(key), `${key} must be swept`).toBe(false);
    }
    expect(store.has('botanical_quiz_attempts_2026-11-04')).toBe(false);
    expect(store.has('botanical_guardian_tour_done_u1')).toBe(false);
    expect(store.get('phyto_reminder_prefs')).toBe('{}');
    // Re-onboarding is the point of a fresh start.
    expect(store.has('botanical_guardian_onboarded')).toBe(false);
  });

  it('tolerates a missing profile row (fresh account, no login yet)', async () => {
    stubTables();
    vi.spyOn(db.userProfile, 'get').mockResolvedValue(undefined as any);
    const put = vi.spyOn(db.userProfile, 'put').mockImplementation((async () => undefined) as any);

    await expect(resetGardenProgress('nobody')).resolves.toBeUndefined();
    expect(put).not.toHaveBeenCalled();
  });
});
