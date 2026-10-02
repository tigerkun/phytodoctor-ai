/**
 * Arena scoring — pure, and deliberately free of any randomness.
 *
 * This lives in its own module rather than inside the Arena page so it can be
 * tested directly. A scoring function buried in a component can only be
 * checked by string-matching the source, which is a test that passes when the
 * code looks right and fails when it merely reads right.
 *
 * The rule the whole Arena rests on: you win a duel by caring for plants, not
 * by pressing a button. Every input below is something the Keeper actually
 * did, read from their own records. There is no dice anywhere in this file,
 * and `arenaScoring.test.ts` fails if a `Math.random` ever appears.
 */

/**
 * The rival ladder. Each rung is a floor the Keeper's score must clear. It is
 * walked in order, so a player always fights at or just above their level
 * rather than at a wall they cannot pass.
 *
 * These are care benchmarks, not other players. `recordCareOff` predates this
 * page and hardcoded `opponentId: 'bot'`; there is no multiplayer backend
 * behind the careOffs table, so presenting these as real guardians fighting
 * each other would be invented social proof.
 */
export const ARENA_RIVALS = [
  { id: 'windowsill-novice', name: 'The Windowsill Novice', title: 'forgets to water, but tries', threshold: 30, emoji: '🪴' },
  { id: 'balcony-regular', name: 'The Balcony Regular', title: 'outdoors every morning, rain or shine', threshold: 45, emoji: '🌿' },
  { id: 'glasshouse-keeper', name: 'The Glasshouse Keeper', title: 'reads the light before the leaves do', threshold: 58, emoji: '🪞' },
  { id: 'terrace-steward', name: 'The Terrace Steward', title: 'a whole rooftop, nothing neglected', threshold: 70, emoji: '🏡' },
  { id: 'conservator', name: 'The Conservatory Conservator', title: 'propagates, records, and never panics', threshold: 82, emoji: '📜' },
  { id: 'arborist', name: 'The Arborist', title: 'knows every species by its bark', threshold: 92, emoji: '🌳' },
] as const;

export type ArenaRival = (typeof ARENA_RIVALS)[number];

/** Free Keepers get this many duels a week. Must match `canStartCareOff`. */
export const WEEKLY_FREE_DUELS = 3;

/** Seeds credited for a win. Mirrors ECONOMY_CONFIG.EARNING_BASE.arena_win. */
export const ARENA_WIN_SEEDS = 200;

export interface CareStanding {
  bestGuardianScore: number;
  currentStreak: number;
  checkInCount: number;
  discoveredCount: number;
}

/**
 * The score, 0..100.
 *
 *  - best specimen   their healthiest plant's guardian score, up to 55
 *  - streak          consecutive days of care, up to 20
 *  - check-ins       logged care events, up to 15
 *  - discoveries     species found, up to 10
 *
 * Clamped so the ladder thresholds stay meaningful. A Keeper with one healthy
 * plant and a week of streaks reaches the Glasshouse Keeper; the Arborist
 * needs a genuinely broad collection.
 */
export function scoreFromStanding({
  bestGuardianScore,
  currentStreak,
  checkInCount,
  discoveredCount,
}: CareStanding): number {
  const fromPlants = Math.min(55, bestGuardianScore * 0.55);
  const fromStreak = Math.min(20, currentStreak * 2.5);
  const fromCheckIns = Math.min(15, checkInCount * 1.5);
  const fromDiscoveries = Math.min(10, discoveredCount * 2);
  return Math.round(
    Math.max(0, Math.min(100, fromPlants + fromStreak + fromCheckIns + fromDiscoveries))
  );
}

export type DuelOutcome = 'win' | 'loss' | 'draw';

/** The outcome is the score against the rung. No roll, no fudge factor. */
export function resolveDuel(score: number, rival: ArenaRival): DuelOutcome {
  if (score > rival.threshold) return 'win';
  if (score < rival.threshold) return 'loss';
  return 'draw';
}

/** The next rung at or above where the Keeper stands, so there is always a
    fight worth having. Past the top rung they keep facing the hardest one. */
export function nextRival(score: number): ArenaRival {
  return ARENA_RIVALS.find(r => score < r.threshold) ?? ARENA_RIVALS[ARENA_RIVALS.length - 1];
}
