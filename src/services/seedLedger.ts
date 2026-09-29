import { db, type SeedTransaction } from '../db/database';

// A 5xx storm (or a broken RPC, which this project has shipped before) used to
// make every outbox entry retry forever. After this many server failures an
// entry is parked as dead instead of retrying on every flush.
export const MAX_SYNC_ATTEMPTS = 8;

/**
 * Apply a signed seed delta to the local profile atomically with its ledger
 * row and outbox entry, then attempt an immediate flush.
 *
 * This is the ONE write path for balance changes: GameService.earnSeeds /
 * spendSeeds and RewardService grants all funnel through it, so a credit made
 * by any engine reaches the server exactly once. The amount is FINAL — any
 * tier/level/streak multipliers are the caller's business.
 *
 * Only 'sb_' (Supabase) users are enqueued; local-only accounts have no server
 * identity to reconcile with, which matches the pre-existing sync gating.
 */
export async function applySeedDelta(opts: {
  userId: string;
  amount: number;
  source: SeedTransaction['source'];
  description: string;
  transactionId: string;
}): Promise<void> {
  const { userId, amount, source, description, transactionId } = opts;

  const transaction: SeedTransaction = {
    id: transactionId,
    userId,
    amount,
    source,
    description,
    createdAt: new Date()
  };
  const enqueued = userId.startsWith('sb_');

  // Atomic local apply: the balance, the ledger row and the outbox entry
  // commit together or not at all, so a crash can never credit the balance
  // without recording the delta that keeps the server in sync.
  await db.transaction('rw', [db.userProfile, db.seedTransactions, db.seedSyncOutbox], async () => {
    if (await db.seedTransactions.get(transactionId)) return; // replay
    const profile = await db.userProfile.get(userId);
    if (!profile) throw new Error(`User not found: ${userId}`);
    if (amount < 0 && Math.abs(amount) > profile.seeds) {
      throw new Error(`Insufficient seeds. You need ${(Math.abs(amount) - profile.seeds).toLocaleString()} more.`);
    }
    await db.userProfile.update(userId, { seeds: profile.seeds + amount });
    await db.seedTransactions.add(transaction);
    if (enqueued) {
      await db.seedSyncOutbox.put({
        id: transactionId,
        userId,
        amount,
        source,
        description,
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending'
      });
    }
  });

  if (enqueued) {
    await flushSeedSyncOutbox(userId);
  }
}

/**
 * Deliver queued deltas to the server in FIFO order.
 *
 * Rules per entry:
 *  - 2xx            → delivered, remove.
 *  - 400/402/409/422→ the server refused the delta permanently; remove and let
 *                     the next pullServerProfile reconcile the balance.
 *  - 401/408/425/429→ retrying with the same token right now cannot succeed
 *                     (session expired / timed out / rate limited). Leave the
 *                     entry untouched and stop this pass.
 *  - 5xx            → count the failure; park as dead past MAX_SYNC_ATTEMPTS.
 *  - network error  → stop; the 'online' event and the next flush retry.
 */
export async function flushSeedSyncOutbox(userId: string): Promise<void> {
  if (!userId.startsWith('sb_')) return;
  const token = localStorage.getItem('botanical_guardian_auth_token');
  if (!token) return;

  // Chronological order: deltas are balance-relative, so a spend must not
  // reach the server before the earn it depends on. The outbox primary key is
  // a random UUID and must not decide ordering.
  const pending = await db.seedSyncOutbox
    .where('[userId+status]')
    .equals([userId, 'pending'])
    .sortBy('createdAt');

  for (const item of pending) {
    if (item.attempts >= MAX_SYNC_ATTEMPTS) {
      await db.seedSyncOutbox.update(item.id, { status: 'dead' });
      continue;
    }
    let res: Response;
    try {
      res = await fetch('/api/economy/seed-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ delta: item.amount, source: item.source, description: item.description, transactionId: item.id })
      });
    } catch {
      break; // offline
    }

    if (res.ok) {
      await db.seedSyncOutbox.delete(item.id);
      continue;
    }

    if (res.status === 400 || res.status === 402 || res.status === 409 || res.status === 422) {
      await db.seedSyncOutbox.delete(item.id);
      continue;
    }

    if (res.status === 401 || res.status === 408 || res.status === 425 || res.status === 429) {
      break;
    }

    const attempts = item.attempts + 1;
    await db.seedSyncOutbox.update(item.id, { attempts, lastError: `HTTP ${res.status}` });
    if (attempts >= MAX_SYNC_ATTEMPTS) {
      await db.seedSyncOutbox.update(item.id, { status: 'dead' });
    }
  }
}

/**
 * True while deltas are queued. The server balance lags the local one during
 * this window, so pullServerProfile must not overwrite the local balance with
 * the stale server value.
 */
export async function hasPendingSeedSyncs(userId: string): Promise<boolean> {
  return (await db.seedSyncOutbox.where('[userId+status]').equals([userId, 'pending']).count()) > 0;
}
