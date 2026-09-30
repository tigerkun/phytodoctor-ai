import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../db/database';
import { flushSeedSyncOutbox, hasPendingSeedSyncs, MAX_SYNC_ATTEMPTS } from '../seedLedger';

/**
 * Regression cover for the seed outbox parking entries as 'dead'.
 *
 * The outage that motivated this: seed-sync answered 500 for every delta
 * (the server's RLS client was sending the caller's JWT in the apikey slot,
 * so the gateway refused it). After MAX_SYNC_ATTEMPTS the entries were parked.
 * Two things then went wrong at once, and neither was visible on screen:
 *
 *  1. flush only ever read 'pending', so parked entries were never retried —
 *     the credits existed solely in the local balance.
 *  2. hasPendingSeedSyncs counted only 'pending' too, so the outbox looked
 *     empty, pullServerProfile ran, and the stale server balance overwrote
 *     seeds the user had actually earned.
 *
 * The local balance in this file is the thing being protected; the server
 * balance is the stale one it must not be replaced by.
 */

type Row = {
  id: string;
  userId: string;
  amount: number;
  source: string;
  description: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'dead';
};

const USER = 'sb_test-user';

let rows: Row[] = [];
let realFetch: typeof globalThis.fetch;

function installFakeOutbox() {
  const matches = (userId: string, status: string) => rows.filter(r => r.userId === userId && r.status === status);

  vi.spyOn(db.seedSyncOutbox, 'where').mockImplementation((() => ({
    equals: (key: [string, string]) => {
      const found = () => matches(key[0], key[1]);
      return {
        count: async () => found().length,
        sortBy: async (_field: string) => [...found()].sort((a, b) => a.createdAt - b.createdAt),
        toArray: async () => found(),
      };
    },
  })) as any);

  vi.spyOn(db.seedSyncOutbox, 'update').mockImplementation((async (id: string, patch: any) => {
    const row = rows.find(r => r.id === id);
    if (row) Object.assign(row, patch);
    return 1;
  }) as any);

  vi.spyOn(db.seedSyncOutbox, 'delete').mockImplementation((async (id: string) => {
    rows = rows.filter(r => r.id !== id);
    return 1;
  }) as any);
}

function addRow(over: Partial<Row> = {}): Row {
  const row: Row = {
    id: over.id ?? `tx-${rows.length + 1}`,
    userId: USER,
    amount: 25,
    source: 'reward',
    description: 'Library quiz',
    createdAt: 1_000 + rows.length,
    attempts: 0,
    status: 'pending',
    ...over,
  };
  rows.push(row);
  return row;
}

/** Server answers with `status` for every sync attempt. */
function serverAnswers(status: number) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: status >= 200 && status < 300, status } as any);
}

beforeEach(() => {
  rows = [];
  realFetch = globalThis.fetch;
  globalThis.localStorage = {
    getItem: (k: string) => (k === 'botanical_guardian_auth_token' ? 'tok' : null),
  } as any;
  installFakeOutbox();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('seed outbox: parked entries are undelivered, not delivered', () => {
  it('reports a dead entry as still pending, so the balance is not clobbered', async () => {
    addRow({ status: 'dead', attempts: MAX_SYNC_ATTEMPTS });
    // The regression: counting only 'pending' answered false here, which let
    // pullServerProfile overwrite the local balance with the stale server one.
    expect(await hasPendingSeedSyncs(USER)).toBe(true);
  });

  it('reports false only once every entry is delivered', async () => {
    expect(await hasPendingSeedSyncs(USER)).toBe(false);
    addRow();
    expect(await hasPendingSeedSyncs(USER)).toBe(true);
    serverAnswers(200);
    await flushSeedSyncOutbox(USER);
    expect(rows).toHaveLength(0);
    expect(await hasPendingSeedSyncs(USER)).toBe(false);
  });
});

describe('seed outbox: recovery after the server comes back', () => {
  it('requeues a dead entry once a delivery proves the server is healthy', async () => {
    addRow({ status: 'dead', attempts: MAX_SYNC_ATTEMPTS });
    // A fresh earning is what produces the successful delivery that unlocks
    // the revival; the dead entry itself is not retried in the same pass.
    addRow({ id: 'tx-fresh' });

    serverAnswers(200);
    await flushSeedSyncOutbox(USER);

    const revived = rows.find(r => r.id !== 'tx-fresh')!;
    expect(revived.status).toBe('pending');
    expect(revived.attempts).toBe(0);

    // Next flush carries the revived credits to the server.
    await flushSeedSyncOutbox(USER);
    expect(rows).toHaveLength(0);
  });

  it('leaves dead entries parked while the server is still failing', async () => {
    addRow({ status: 'dead', attempts: MAX_SYNC_ATTEMPTS });

    serverAnswers(500);
    await flushSeedSyncOutbox(USER);

    // The original protection must survive: a broken server is not hammered
    // with retries just because the revival path now exists.
    expect(rows[0].status).toBe('dead');
  });

  it('parks an entry only after the attempt budget is spent', async () => {
    addRow();
    serverAnswers(500);

    for (let i = 0; i < MAX_SYNC_ATTEMPTS; i++) {
      await flushSeedSyncOutbox(USER);
    }
    expect(rows[0].status).toBe('dead');
    expect(rows[0].attempts).toBe(MAX_SYNC_ATTEMPTS);

    // And the budget is not spent twice over: no further requests are made.
    // Clear first — spyOn returns the existing mock, which still holds the
    // eight calls from the loop above.
    const spy = vi.mocked(globalThis.fetch);
    spy.mockClear();
    await flushSeedSyncOutbox(USER);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('seed outbox: an outage that outlives the budget still pays out', () => {
  it('delivers credits earned during a long outage once the server recovers', async () => {
    // Three quiz rewards earned while seed-sync was returning 500.
    const earned = [addRow({ id: 'tx-a' }), addRow({ id: 'tx-b' }), addRow({ id: 'tx-c' })];

    serverAnswers(500);
    for (let i = 0; i < MAX_SYNC_ATTEMPTS; i++) {
      await flushSeedSyncOutbox(USER);
    }
    expect(rows.every(r => r.status === 'dead')).toBe(true);
    // The local balance still holds all 75 seeds; the server has none of them.
    expect(await hasPendingSeedSyncs(USER)).toBe(true);

    // Server healthy again, and the user earns once more.
    serverAnswers(200);
    addRow({ id: 'tx-d' });
    await flushSeedSyncOutbox(USER);
    expect(rows.every(r => r.status === 'pending')).toBe(true);

    await flushSeedSyncOutbox(USER);
    await flushSeedSyncOutbox(USER);

    // All four reach the server — none were discarded by the parking.
    expect(rows).toHaveLength(0);
    expect(earned).toHaveLength(3);
  });
});
