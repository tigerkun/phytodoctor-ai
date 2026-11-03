import { db } from '../db/database';

/**
 * The danger-zone reset behind Settings → "Start fresh on this device".
 *
 * Deliberately local-only. It clears the garden tables in Dexie and the
 * device-local progress markers (quiz stats, starter grant, tour flag), and
 * touches nothing on the server: a signed-in account re-syncs its cloud
 * profile and plants on the next fetch. The Settings copy says so plainly
 * rather than pretending the reset reaches the cloud — true account deletion
 * stays a support contact, per the same documented absence as paid-tier
 * provisioning.
 *
 * Kept on purpose: `photos` (the Keeper's own images), `subscriptions` and
 * `cosmetics` (real purchases survive a garden reset), and the `userProfile`
 * row itself — a local-only account's credentials live there, so its game
 * fields are reset in place instead of the row being deleted.
 */

export const GARDEN_TABLES = [
  'plants',
  'checkins',
  'predictions',
  'sensorReadings',
  'alerts',
  'metrics',
  'cards',
  'xpLog',
  'seedTransactions',
  'careOffs',
  'propagations',
  'notes',
  'dailyRewardCaps',
  'levelProgress',
  'streakRecords',
  'rewardHistory',
  'discoveryRecords',
  'streakFreezes',
  'seedSyncOutbox',
  'sanctuaryStock',
  'marketLedger',
  'treatmentActions',
  'reminders',
  'reminderLog',
  'weatherAdjustments',
] as const;

/** Device-local progress markers that should die with the garden: quiz
 *  stats and streaks, the studied-plates ledger, the one-time starter grant
 *  (a fresh garden may claim it again — that is what "start over" means),
 *  and the per-day quiz attempt counters, swept by prefix. */
export const GARDEN_STORAGE_KEYS = [
  'botanical_quiz_accuracy',
  'botanical_quiz_streak',
  'botanical_quiz_best_streak',
  'botanical_plates_studied',
  'claimed_starter_bonus',
] as const;

const QUIZ_ATTEMPTS_PREFIX = 'botanical_quiz_attempts_';

export async function resetGardenProgress(userId: string | null): Promise<void> {
  // One transaction: a crash mid-reset must not leave half a garden.
  const tables = GARDEN_TABLES.map(name => db.table(name));
  await db.transaction('rw', tables, async () => {
    for (const name of GARDEN_TABLES) {
      await db.table(name).clear();
    }
    if (!userId) return;
    const profile = await db.userProfile.get(userId);
    if (profile) {
      // Reset the game fields, keep the identity fields (username,
      // passwordHash, tier, experienceLevel) — see the header note.
      await db.userProfile.put({
        ...profile,
        seeds: 0,
        currentStreak: 0,
        longestStreak: 0,
        collectionSize: 0,
        totalXP: 0,
        discoveredSpecies: [],
      });
    }
  });

  for (const key of GARDEN_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* private mode */ }
  }
  try {
    const dayScoped: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(QUIZ_ATTEMPTS_PREFIX)) dayScoped.push(key);
    }
    for (const key of dayScoped) localStorage.removeItem(key);
    if (userId) localStorage.removeItem(`botanical_guardian_tour_done_${userId}`);
    // The fresh garden re-onboards: the landing page takes it from here.
    localStorage.removeItem('botanical_guardian_onboarded');
  } catch { /* private mode */ }
}
