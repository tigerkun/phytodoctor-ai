import { evaluateProfileBadges, type ProfileBadgeCriteria, type ProfileBadgeStatus } from './profileUtils';
import { safeStore } from '../lib/safeStore';

/**
 * Badge-earned celebrations. `evaluateProfileBadges` is pure and renders on
 * the Profile page; this module is the moment-of-earning half: callers
 * recompute the criteria right after a stat changes (a quiz solve, a folio
 * studied) and get back only the badges that unlocked since the last check.
 *
 * The celebrated set is device-local (safeStore) and records every badge
 * currently unlocked, not just the fresh ones — so a badge stays celebrated
 * even if its stat later dips (accuracy drops below 90%) and re-earns.
 *
 * Scope note: only the three Library-driven badges fire from here — the
 * Profile-derived six (streak, XP, tier) have their own celebration paths,
 * and their criteria are not all visible where quizzes run.
 */

const CELEBRATED_KEY = 'botanical_badges_celebrated';

function celebrated(): Set<string> {
  try {
    const raw = JSON.parse(safeStore.getItem(CELEBRATED_KEY) || '[]') as string[];
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function markCelebrated(ids: string[]): void {
  try {
    safeStore.setItem(CELEBRATED_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // private mode — badges would re-celebrate next session; harmless
  }
}

/** Badges that just unlocked and were never celebrated. */
export function newlyEarnedBadges(criteria: ProfileBadgeCriteria): ProfileBadgeStatus[] {
  const unlocked = evaluateProfileBadges(criteria).filter(b => b.unlocked);
  const seen = celebrated();
  const fresh = unlocked.filter(b => !seen.has(b.id));
  if (fresh.length) markCelebrated(unlocked.map(b => b.id));
  return fresh;
}

/** Test/setting helper: forget what has been celebrated. */
export function resetBadgeCelebrations(): void {
  try {
    safeStore.removeItem(CELEBRATED_KEY);
  } catch {
    // private mode
  }
}
