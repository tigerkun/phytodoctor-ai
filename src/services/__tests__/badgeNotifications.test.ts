import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { newlyEarnedBadges, resetBadgeCelebrations } from '../badgeNotifications';
import { safeStore } from '../../lib/safeStore';

/**
 * Badge-earned celebrations fire exactly once per unlock, remember what was
 * celebrated even if the stat later dips, and pass fresh values through.
 */

const BASE = {
  currentStreak: 0,
  cardCount: 0,
  tier: 'free' as const,
  totalXP: 0,
  mythicCount: 0,
};

beforeEach(() => resetBadgeCelebrations());
afterEach(() => vi.restoreAllMocks());

describe('newlyEarnedBadges', () => {
  it('the scan found the service it means to check', () => {
    expect(newlyEarnedBadges(BASE)).toEqual([]);
  });

  it('a fresh unlock is returned once, then remembered', () => {
    const criteria = { ...BASE, quizBestStreak: 7 };
    const fresh = newlyEarnedBadges(criteria);
    expect(fresh.map(b => b.id)).toEqual(['quiz_climber']);
    // Same criteria again: already celebrated, nothing new.
    expect(newlyEarnedBadges(criteria)).toEqual([]);
  });

  it('a badge that dips below threshold and re-earns does NOT re-celebrate', () => {
    newlyEarnedBadges({ ...BASE, quizBestStreak: 7 });
    // Streak snapped back to 3 — badge lost. Re-earn it later.
    expect(newlyEarnedBadges({ ...BASE, quizBestStreak: 3 })).toEqual([]);
    const again = newlyEarnedBadges({ ...BASE, quizBestStreak: 9 });
    expect(again).toEqual([]);
  });

  it('marks every currently-unlocked badge, not just the fresh one', () => {
    // Two unlock in the same instant: both are fresh.
    const both = newlyEarnedBadges({ ...BASE, quizBestStreak: 7, quizCorrect: 25, quizTotal: 25 });
    expect(both.map(b => b.id).sort()).toEqual(['quiz_climber', 'quiz_master']);
    // And neither re-fires.
    expect(newlyEarnedBadges({ ...BASE, quizBestStreak: 7, quizCorrect: 25, quizTotal: 25 })).toEqual([]);
  });

  it('a storage failure on the celebrated-set write must not throw', () => {
    vi.spyOn(safeStore, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => newlyEarnedBadges({ ...BASE, quizBestStreak: 7 })).not.toThrow();
  });
});
