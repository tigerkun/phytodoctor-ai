import { describe, it, expect } from 'vitest';
import { resolveLedger, tableAvailabilityFromProbe } from '../marketLedgerSync';
import { readSource, stripJsComments } from '../../test/helpers';
import type { MarketLedgerRow } from '../../types';

/**
 * Cross-device mirror for purchased market state. The resolver is a real unit
 * test — it is a pure function over plain rows, so it gets real objects, not
 * source matching. Everything touching fetch/localStorage is pinned at the
 * source level (no DOM test environment — see AGENTS.md).
 */

function row(over: Partial<MarketLedgerRow>): MarketLedgerRow {
  return {
    userId: 'sb_test',
    refunds: [],
    claimedItemIds: [],
    tickets: [],
    wishlist: [],
    cart: [],
    updatedAt: 1000,
    ...over,
  };
}

describe('resolveLedger', () => {
  it('adopts the server row when there is nothing local', () => {
    // A new device: the purchases live only on the mirror.
    const server = row({ updatedAt: 500, tickets: ['sprout_saver'] });
    expect(resolveLedger(null, server)).toEqual({ winner: 'server', row: server });
  });

  it('is a no-op when the server has no row', () => {
    const local = row({});
    expect(resolveLedger(local, null)).toBeNull();
    expect(resolveLedger(null, null)).toBeNull();
  });

  it('takes the newer row, whichever side wrote it', () => {
    const local = row({ updatedAt: 2000, cart: [{ id: 'drop-1' }] });
    const server = row({ updatedAt: 3000, tickets: ['garden_pass'] });
    expect(resolveLedger(local, server)?.winner).toBe('server');
    expect(resolveLedger({ ...local, updatedAt: 4000 }, server)?.winner).toBe('local');
  });

  it('resolves ties to local, so nothing churns', () => {
    // Equal stamps mean the two sides already agree; adopting the server row
    // would re-fire the mirrors, the write-back, and a push of identical
    // bytes — forever.
    const local = row({ updatedAt: 2000 });
    const server = row({ updatedAt: 2000 });
    expect(resolveLedger(local, server)?.winner).toBe('local');
  });

  it('treats a missing timestamp as the oldest possible', () => {
    const local = row({ updatedAt: 1 });
    const server = row({ updatedAt: undefined as unknown as number });
    expect(resolveLedger(local, server)?.winner).toBe('local');
    expect(resolveLedger(null, server)?.winner).toBe('server');
  });
});

describe('the sync wiring', () => {
  const service = stripJsComments(readSource('src/services/marketLedgerSync.ts'));
  const market = stripJsComments(readSource('src/pages/Market.tsx'));
  const server = stripJsComments(readSource('server.ts'));
  const sql = readSource('sql/market_ledger.sql');

  it('only syncs Supabase accounts that hold a session token', () => {
    // Local-only accounts have no server identity; the same gate as the seed
    // outbox, so both halves of the economy agree on who syncs.
    expect(service).toMatch(/userId\.startsWith\('sb_'\) && !!localStorage\.getItem\('botanical_guardian_auth_token'\)/);
  });

  it('skips sync entirely while the mirror table is unapplied', () => {
    // Without the table every attempt is a guaranteed 500 — harmless but
    // noisy. The health probe already knows what exists; ask it once and
    // stay quiet until the table appears.
    expect(service).toMatch(/if \(!\(await ensureServerTable\(\)\)\) return (null|false);/);
    expect(service.match(/ensureServerTable\(\)\)\) return/g)!.length).toBe(2);
  });

  it('reads the probe verdict with real payloads', () => {
    const probe = { schema: { missingOptionalTables: ['market_ledger', 'guest_scan_quota'] } };
    expect(tableAvailabilityFromProbe(probe, true)).toBe(false);

    const ready = { schema: { missingOptionalTables: ['guest_scan_quota'] } };
    expect(tableAvailabilityFromProbe(ready, true)).toBe(true);

    // A probe that fails or speaks an unknown shape must not disable a
    // working mirror — the fallback stands.
    expect(tableAvailabilityFromProbe(null, true)).toBe(true);
    expect(tableAvailabilityFromProbe({ schema: {} }, false)).toBe(false);
  });

  it('degrades silently: no throw on offline, missing table, or junk payload', () => {
    expect(service).toMatch(/catch \{\s*return null;/);
    expect(service).toMatch(/catch \{\s*return false;/);
    expect(service).toMatch(/if \(!res\.ok\) return null;/);
    expect(service).toMatch(/!Array\.isArray\(ledger\.refunds\)/);
  });

  it('reconciles after local hydration and mirrors the write-back', () => {
    expect(market).toMatch(/const serverRow = await pullServerLedger\(userId\);/);
    expect(market).toMatch(/const resolution = resolveLedger\(row \?\? null, serverRow\);/);
    expect(market).toMatch(/void pushServerLedger\(userId, row\);/);
  });

  it('pushes on a debounce, not on every state write', () => {
    // A basket tweak bursts several state writes; none is urgent enough to
    // need a POST each.
    expect(market).toMatch(/setTimeout\(\(\) => \{ void pushServerLedger\(userId, row\); \}, 1500\)/);
  });

  it('the server mirror is a per-user dumb store', () => {
    expect(server).toMatch(/app\.get\("\/api\/market\/ledger", apiGate/);
    expect(server).toMatch(/app\.post\("\/api\/market\/ledger", express\.json\(\{ limit: '64kb' \}\), apiGate/);
    expect(server).toMatch(/onConflict: 'user_id'/);
    // It validates shape rather than trusting the body.
    expect(server).toMatch(/fields\.every\(\(f\) => Array\.isArray\(ledger\[f\]\)\)/);
  });

  it('the probe knows the table can be missing', () => {
    // Unapplied SQL is a feature that quietly does not turn on, not an
    // outage -- so it rides in the optional list.
    expect(server).toMatch(/'market_ledger',/);
  });

  it('the table is closed to clients by policy', () => {
    // Purchased state reaches the server only through the validated route.
    expect(sql).toMatch(/alter table public\.market_ledger enable row level security;/);
    expect(sql).not.toMatch(/create policy/);
  });
});
