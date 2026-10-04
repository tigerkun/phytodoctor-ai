import type { MarketLedgerRow } from '../types';

/**
 * Cross-device mirror for the market ledger.
 *
 * Purchased tickets and claimed seed-refund codes used to be device-local:
 * clear site data or switch phones and the purchases were gone. The server
 * keeps one JSONB mirror per user (sql/market_ledger.sql) and the client
 * reconciles — pull on visit, push after each change, last-writer-wins on the
 * row's own `updatedAt`.
 *
 * The server is deliberately a dumb mirror. It never merges, because the
 * resolution belongs where the clocks are: `updatedAt` is stamped by the
 * device that made the write, and comparing two device stamps on the server
 * would be comparing against a third clock for no benefit. LWW on the whole
 * row is crude — two devices editing within the same instant could lose one
 * edit — but this state is one player's shopping basket, not a shared
 * document, and the alternative is a field-level merge nobody can reason
 * about when it goes wrong.
 *
 * Everything here degrades silently: local-only accounts never touch the
 * network, an offline or missing-table failure just leaves the local row as
 * the truth, and the next visit reconciles again.
 */

export type SyncOutcome = 'local' | 'server' | 'unavailable';

/** Pick the row that should win, or null for "nothing to do".
 *
 *  Ties go to local so an equal-timestamp race cannot cause churn: rewriting
 *  the mirrors with an identical row would fire the write-back effect and
 *  push the same bytes right back, forever. */
export function resolveLedger(
  local: MarketLedgerRow | null,
  server: MarketLedgerRow | null,
): { winner: 'local' | 'server'; row: MarketLedgerRow } | null {
  if (!server) return null;
  if (!local) return { winner: 'server', row: server };
  const localAt = Number.isFinite(local.updatedAt) ? local.updatedAt : 0;
  const serverAt = Number.isFinite(server.updatedAt) ? server.updatedAt : 0;
  return serverAt > localAt
    ? { winner: 'server', row: server }
    : { winner: 'local', row: local };
}

/** Only Supabase accounts have a device to sync with. Local-only accounts
 *  (no `sb_` prefix) have no server identity at all — same gate as the seed
 *  outbox, so the two sides of the economy never disagree about who syncs. */
export function canSyncMarketLedger(userId: string): boolean {
  return userId.startsWith('sb_') && !!localStorage.getItem('botanical_guardian_auth_token');
}

// Until sql/market_ledger.sql is applied, every sync attempt is a guaranteed
// 500 — harmless, but two failed requests per market visit in the console is
// noise pretending to be a problem. The health probe already knows whether
// the table exists, so ask it once per page load and skip sync until the
// table is there. An unreachable probe reads as "available": being offline
// already fails the sync itself, and a probe outage should not disable a
// working mirror.
let tableChecked = false;
let tableAvailable = true;

/** Read the health probe's verdict. Pure so the decision — the part that
 *  decides whether purchased state syncs at all — is testable with real
 *  payloads rather than asserted as source text. */
export function tableAvailabilityFromProbe(body: unknown, fallback: boolean): boolean {
  const missing = (body as { schema?: { missingOptionalTables?: string[] } } | null)?.schema?.missingOptionalTables;
  if (Array.isArray(missing)) return !missing.includes('market_ledger');
  return fallback;
}

async function ensureServerTable(): Promise<boolean> {
  if (tableChecked) return tableAvailable;
  tableChecked = true;
  try {
    const res = await fetch('/healthz', { headers: { Accept: 'application/json' } });
    if (!res.ok) return tableAvailable;
    const body = await res.json().catch(() => null);
    tableAvailable = tableAvailabilityFromProbe(body, tableAvailable);
  } catch {
    // keep the optimistic default
  }
  return tableAvailable;
}

/** Fetch the server mirror, or null when there is none / it is unreachable. */
export async function pullServerLedger(userId: string): Promise<MarketLedgerRow | null> {
  if (!canSyncMarketLedger(userId)) return null;
  if (!(await ensureServerTable())) return null;
  const token = localStorage.getItem('botanical_guardian_auth_token');
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch('/api/market/ledger', {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return null; // offline
  }
  if (!res.ok) return null; // missing table, expired session, server hiccup
  const body = await res.json().catch(() => null);
  const ledger = body?.ledger;
  if (!ledger || typeof ledger !== 'object' || !Array.isArray(ledger.refunds)) return null;
  return ledger as MarketLedgerRow;
}

/** Overwrite the server mirror with this row. True when the server accepted. */
export async function pushServerLedger(userId: string, row: MarketLedgerRow): Promise<boolean> {
  if (!canSyncMarketLedger(userId)) return false;
  if (!(await ensureServerTable())) return false;
  const token = localStorage.getItem('botanical_guardian_auth_token');
  if (!token) return false;
  let res: Response;
  try {
    res = await fetch('/api/market/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ledger: row, updatedAt: row.updatedAt }),
    });
  } catch {
    return false; // offline
  }
  return res.ok;
}
