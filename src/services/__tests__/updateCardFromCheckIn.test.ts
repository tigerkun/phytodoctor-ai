/**
 * Tests for updateCardFromCheckIn — merged logic from reconcile-recovery + origin/main.
 * Covers:
 *  1. Return shape { leveledUp, stageChanged, newLevel, newStage } | null
 *  2. Broader recovery detection: 'watching' OR 'alert' → 'stable' earns a scar
 *     (deliberate choice over origin/main's narrower 'alert'-only detection)
 *  3. battleScars produced as { symptom: string, recoveredAt: string | null } objects
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameService } from '../gameService';
import { db } from '../../db/database';

// Dexie WhereClause chain: .where('field').equals(val).first()
function whereEquals(result: unknown) {
  return { where: () => ({ equals: () => ({ first: async () => result }) }) };
}

// Dexie collection chain: .where('field').toArray() and .where('field').equals(val).count()
function whereToArray(rows: unknown[]) {
  return {
    where: () => ({
      equals: () => ({
        first: async () => rows[0] ?? null,
        toArray: async () => rows,
        count: async () => rows.length,
        modify: async (fn: (x: unknown) => void) => { rows.forEach(fn); return rows.length; }
      })
    })
  };
}

// Minimal factory helpers — only the fields updateCardFromCheckIn reads
function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'card-1',
    plantId: 'plant-1',
    userId: 'user-1',
    level: 1,
    xp: 0,
    xpToNext: 100,
    growthStage: 'sprout',
    currentStreak: 0,
    checkInsTotal: 0,
    checkInsHealthy: 0,
    abilityUnlocked: false,
    stats: {},
    battleScars: [] as { symptom: string; recoveredAt: string | null }[],
    rarity: 'common',
    ...overrides
  };
}

function makeCheckIn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ci-1',
    plantId: 'plant-1',
    timestamp: new Date().toISOString(),
    guardianScore: 70,
    driftStatus: 'stable',
    driftScore: 0.05,
    photoBlob: null,
    synced: false,
    isDemo: false,
    ...overrides
  };
}

function makePlant() {
  return {
    id: 'plant-1',
    name: 'Monstera',
    species: 'Monstera deliciosa',
    status: 'Stable',
    createdAt: new Date(Date.now() - 7 * 86400_000)
  };
}

// Shared seed mocks (earnSeeds path)
function mockSeeds() {
  // applySeedDelta wraps balance writes in a Dexie transaction; pass the scope
  // straight through instead of opening real IndexedDB (absent in tests).
  vi.spyOn(db, 'transaction').mockImplementation(
    (async (_mode: unknown, _tables: unknown, scope: () => Promise<unknown>) => scope()) as any
  );
  vi.spyOn(GameService as any, 'ensureProfile').mockResolvedValue({ seeds: 100, tier: 'free' });
  vi.spyOn(db.userProfile, 'get').mockResolvedValue({ seeds: 100, tier: 'free' } as any);
  vi.spyOn(db.userProfile, 'update').mockResolvedValue(1 as any);
  vi.spyOn(db.seedTransactions, 'add').mockResolvedValue(1 as any);
  vi.spyOn(db.seedTransactions, 'get').mockResolvedValue(undefined);
  vi.spyOn(db.seedSyncOutbox, 'put').mockResolvedValue(1 as any);
}

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage = { getItem: () => 'user-1' } as any;
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => 'test-uuid' },
    writable: true
  });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as any);
});

describe('updateCardFromCheckIn — return shape', () => {
  it('returns null when card and lazy generation both fail', async () => {
    // .where('plantId').equals(plantId).first() → null
    vi.spyOn(db.cards, 'where').mockReturnValue(
      { equals: () => ({ first: async () => null }) } as any
    );
    vi.spyOn(GameService as any, 'generateCardForPlant').mockResolvedValue(null);

    const result = await GameService.updateCardFromCheckIn('plant-1', makeCheckIn() as any);
    expect(result).toBeNull();
  });

  it('returns correct shape on a normal check-in (no level-up)', async () => {
    const card = makeCard();
    vi.spyOn(db.cards, 'where').mockReturnValue(
      { equals: () => ({ first: async () => card }) } as any
    );
    vi.spyOn(db.plants, 'get').mockResolvedValue(makePlant() as any);
    vi.spyOn(db.checkins, 'where').mockReturnValue(
      { equals: () => ({ toArray: async () => [] }) } as any
    );
    vi.spyOn(db.xpLog, 'where').mockReturnValue(
      { equals: () => ({ count: async () => 0 }) } as any
    );
    vi.spyOn(db.cards, 'update').mockResolvedValue(1 as any);
    vi.spyOn(db.xpLog, 'add').mockResolvedValue(1 as any);
    mockSeeds();

    const result = await GameService.updateCardFromCheckIn('plant-1', makeCheckIn() as any);

    expect(result).not.toBeNull();
    expect(typeof result!.leveledUp).toBe('boolean');
    expect(typeof result!.stageChanged).toBe('boolean');
    expect(typeof result!.newLevel).toBe('number');
    expect(typeof result!.newStage).toBe('string');
    expect(result!.leveledUp).toBe(false);
    expect(result!.newLevel).toBe(1);
  });
});

describe('updateCardFromCheckIn — battleScars: broader recovery detection', () => {
  function setupRecovery(prevDriftStatus: string) {
    const card = makeCard({ battleScars: [] });
    const previousCheckIn = makeCheckIn({
      id: 'ci-prev',
      driftStatus: prevDriftStatus,
      timestamp: new Date(Date.now() - 3600_000).toISOString()
    });
    const newCheckIn = makeCheckIn({
      id: 'ci-new',
      driftStatus: 'stable',
      timestamp: new Date().toISOString()
    });

    vi.spyOn(db.cards, 'where').mockReturnValue(
      { equals: () => ({ first: async () => card }) } as any
    );
    vi.spyOn(db.plants, 'get').mockResolvedValue(makePlant() as any);
    vi.spyOn(db.checkins, 'where').mockReturnValue(
      { equals: () => ({ toArray: async () => [previousCheckIn, newCheckIn] }) } as any
    );
    vi.spyOn(db.xpLog, 'where').mockReturnValue(
      { equals: () => ({ count: async () => 0 }) } as any
    );

    let updatedCard: any = null;
    (vi.spyOn(db.cards, 'update') as any).mockImplementation(async (_id: any, data: any) => {
      updatedCard = data;
      return 1;
    });
    vi.spyOn(db.xpLog, 'add').mockResolvedValue(1 as any);
    mockSeeds();

    return { newCheckIn, getUpdatedCard: () => updatedCard };
  }

  it("earns a scar when previous drift was 'watching' → stable (broader detection)", async () => {
    const { newCheckIn, getUpdatedCard } = setupRecovery('watching');
    await GameService.updateCardFromCheckIn('plant-1', newCheckIn as any);

    const updatedCard = getUpdatedCard();
    expect(updatedCard).not.toBeNull();
    expect(Array.isArray(updatedCard.battleScars)).toBe(true);
    expect(updatedCard.battleScars).toHaveLength(1);
    // Must be an object, not a string
    expect(typeof updatedCard.battleScars[0]).toBe('object');
    expect(typeof updatedCard.battleScars[0].symptom).toBe('string');
    // recoveredAt is a non-null ISO string for new scars
    expect(typeof updatedCard.battleScars[0].recoveredAt).toBe('string');
  });

  it("earns a scar when previous drift was 'alert' → stable", async () => {
    const { newCheckIn, getUpdatedCard } = setupRecovery('alert');
    await GameService.updateCardFromCheckIn('plant-1', newCheckIn as any);

    const updatedCard = getUpdatedCard();
    expect(updatedCard.battleScars).toHaveLength(1);
    expect(typeof updatedCard.battleScars[0]).toBe('object');
    expect(typeof updatedCard.battleScars[0].symptom).toBe('string');
  });

  it("does NOT earn a scar when previous drift was 'stable' (no recovery)", async () => {
    const { newCheckIn, getUpdatedCard } = setupRecovery('stable');
    await GameService.updateCardFromCheckIn('plant-1', newCheckIn as any);

    expect(getUpdatedCard().battleScars).toHaveLength(0);
  });
});
