/**
 * Library engagement helpers — the retention maths for the daily quiz and
 * the folio plates. Pure calculations plus device-local storage (via the
 * shared safeStore); no Dexie tables. Everything the Library displays
 * (streak multiplier, speed bonus, accuracy, plates studied) is computed
 * here so the page stays presentation.
 */
import { safeStore } from '../lib/safeStore';

const ACCURACY_KEY = 'botanical_quiz_accuracy';
const STUDIED_KEY = 'botanical_plates_studied';

/** Streak multiplier: +10% per consecutive solve, capped at 2.0×. A streak
 *  of ten already doubles the daily payout; beyond that is vanity. */
export function quizStreakMultiplier(streak: number): number {
  return Math.min(2, Math.round((1 + Math.max(0, streak) * 0.1) * 10) / 10);
}

export const SPEED_BONUS_MS = 10_000;
export const SPEED_BONUS_SEEDS = 5;

/** Seeds for a correct solve: the 25-seed base scaled by the streak
 *  multiplier, plus the speed bonus when the answer landed under 10s. */
export function quizSeedsFor(streakBefore: number, correct: boolean, elapsedMs: number): number {
  if (!correct) return 0;
  const base = 25 * quizStreakMultiplier(streakBefore);
  const speed = elapsedMs < SPEED_BONUS_MS ? SPEED_BONUS_SEEDS : 0;
  return Math.round(base) + speed;
}

interface AccuracyRecord {
  correct: number;
  total: number;
}

function readAccuracy(): AccuracyRecord {
  try {
    const raw = JSON.parse(safeStore.getItem(ACCURACY_KEY) || '') as AccuracyRecord;
    if (typeof raw?.correct === 'number' && typeof raw?.total === 'number') return raw;
  } catch { /* first run or corrupted — start clean */ }
  return { correct: 0, total: 0 };
}

/** Record one answered question; returns the running accuracy percentage. */
export function recordQuizOutcome(correct: boolean): number {
  const rec = readAccuracy();
  const next: AccuracyRecord = { correct: rec.correct + (correct ? 1 : 0), total: rec.total + 1 };
  try { safeStore.setItem(ACCURACY_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next.total === 0 ? 0 : Math.round((next.correct / next.total) * 100);
}

export function quizAccuracy(): number {
  const rec = readAccuracy();
  return rec.total === 0 ? 0 : Math.round((rec.correct / rec.total) * 100);
}

/** Folio plates the Keeper has marked as studied, keyed by the case's
 *  scientific name (stable across reorders). */
export function getStudiedPlates(): Set<string> {
  try {
    const raw = JSON.parse(safeStore.getItem(STUDIED_KEY) || '[]') as string[];
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

export function markPlateStudied(scientific: string, studied: boolean): Set<string> {
  const studied_ = getStudiedPlates();
  if (studied) studied_.add(scientific);
  else studied_.delete(scientific);
  try { safeStore.setItem(STUDIED_KEY, JSON.stringify([...studied_])); } catch { /* private mode */ }
  return studied_;
}

export function libraryStats(streak: number, bestStreak: number, totalPlates: number): {
  streak: number;
  bestStreak: number;
  accuracyPct: number;
  platesStudied: number;
  totalPlates: number;
} {
  return {
    streak,
    bestStreak,
    accuracyPct: quizAccuracy(),
    platesStudied: getStudiedPlates().size,
    totalPlates,
  };
}
