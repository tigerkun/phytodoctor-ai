import { describe, it, expect } from 'vitest';
import { evaluateProfileBadges } from '../profileUtils';

/**
 * The three honest-gamification badges (quiz streak, quiz accuracy, folio
 * reading) computed alongside the original six. Pure criteria — everything
 * comes from device-local stats the Library already records.
 */

const BASE = {
  currentStreak: 0,
  cardCount: 0,
  tier: 'free' as const,
  totalXP: 0,
  mythicCount: 0,
};

const byId = (badges: ReturnType<typeof evaluateProfileBadges>, id: string) =>
  badges.find(b => b.id === id)!;

describe('the three library badges', () => {
  it('the scan found the badges it means to check', () => {
    const badges = evaluateProfileBadges(BASE);
    expect(badges.filter(b => ['quiz_climber', 'quiz_master', 'folio_botanist'].includes(b.id))).toHaveLength(3);
  });

  it('Moss Pole Climber unlocks at a 7-answer streak', () => {
    expect(byId(evaluateProfileBadges(BASE), 'quiz_climber').unlocked).toBe(false);
    expect(byId(evaluateProfileBadges({ ...BASE, quizBestStreak: 6 }), 'quiz_climber').unlocked).toBe(false);
    expect(byId(evaluateProfileBadges({ ...BASE, quizBestStreak: 7 }), 'quiz_climber').unlocked).toBe(true);
  });

  it('Puzzle Master demands BOTH the denominator and the accuracy', () => {
    // 9/10 correct is 90% — but under 25 answers, so no badge: a lucky week
    // must not read as mastery.
    expect(byId(evaluateProfileBadges({ ...BASE, quizCorrect: 9, quizTotal: 10 }), 'quiz_master').unlocked).toBe(false);
  });

  it('Puzzle Master arithmetic is exact', () => {
    expect(byId(evaluateProfileBadges({ ...BASE, quizCorrect: 22, quizTotal: 25 }), 'quiz_master').unlocked).toBe(false); // 88%
    expect(byId(evaluateProfileBadges({ ...BASE, quizCorrect: 23, quizTotal: 25 }), 'quiz_master').unlocked).toBe(true);  // 92%
    expect(byId(evaluateProfileBadges({ ...BASE, quizCorrect: 24, quizTotal: 30 }), 'quiz_master').unlocked).toBe(false); // 80%
  });

  it('Folio Botanist requires the corpus to exist and be fully studied', () => {
    // No corpus total passed: the badge stays locked — zero divided by zero
    // must never read as completion.
    expect(byId(evaluateProfileBadges({ ...BASE, platesStudied: 0 }), 'folio_botanist').unlocked).toBe(false);
    expect(byId(evaluateProfileBadges({ ...BASE, platesStudied: 14, totalPlates: 14 }), 'folio_botanist').unlocked).toBe(true);
    expect(byId(evaluateProfileBadges({ ...BASE, platesStudied: 13, totalPlates: 14 }), 'folio_botanist').unlocked).toBe(false);
  });

  it('the original six badges still evaluate (no accidental eviction)', () => {
    const badges = evaluateProfileBadges({ ...BASE, currentStreak: 7, cardCount: 5, totalXP: 100 });
    for (const id of ['week_one', 'collector', 'scholar_pro', 'advancer', 'centurion', 'mythic_patron']) {
      expect(badges.some(b => b.id === id), `badge ${id} must still exist`).toBe(true);
    }
    expect(byId(evaluateProfileBadges({ ...BASE, currentStreak: 7 }), 'week_one').unlocked).toBe(true);
  });
});
