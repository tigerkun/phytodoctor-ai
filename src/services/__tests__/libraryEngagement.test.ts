import { describe, it, expect, beforeEach } from 'vitest';
import {
  quizStreakMultiplier,
  quizSeedsFor,
  recordQuizOutcome,
  quizAccuracy,
  markPlateStudied,
  getStudiedPlates,
  libraryStats,
  quizRecord,
  quizBestStreak,
  folioMatchesForSpecies,
} from '../libraryEngagement';
import { safeStore } from '../../lib/safeStore';

describe('quiz streak multiplier', () => {
  it('the scan found the service it means to check', () => {
    expect(quizStreakMultiplier(0)).toBe(1);
  });

  it('grows 10% per solve and caps at 2.0', () => {
    expect(quizStreakMultiplier(3)).toBe(1.3);
    expect(quizStreakMultiplier(10)).toBe(2);
    expect(quizStreakMultiplier(50)).toBe(2);
  });
});

describe('quizSeedsFor', () => {
  it('scales the base by the streak multiplier', () => {
    expect(quizSeedsFor(0, true, 30_000)).toBe(25);
    expect(quizSeedsFor(10, true, 30_000)).toBe(50);
  });

  it('adds the speed bonus only under 10 seconds', () => {
    expect(quizSeedsFor(0, true, 9_999)).toBe(30);
    expect(quizSeedsFor(0, true, 10_000)).toBe(25);
  });

  it('a wrong answer pays nothing, whatever the streak', () => {
    expect(quizSeedsFor(10, false, 1_000)).toBe(0);
  });
});

describe('accuracy + studied plates (localStorage)', () => {
  beforeEach(() => {
    safeStore.removeItem('botanical_quiz_accuracy');
    safeStore.removeItem('botanical_plates_studied');
  });

  it('tracks running accuracy', () => {
    expect(recordQuizOutcome(true)).toBe(100);
    expect(recordQuizOutcome(false)).toBe(50);
    expect(recordQuizOutcome(true)).toBe(67);
    expect(quizAccuracy()).toBe(67);
  });

  it('marks and unmarks studied plates by scientific name', () => {
    markPlateStudied('Botrytis cinerea', true);
    markPlateStudied('Tetranychidae', true);
    markPlateStudied('Botrytis cinerea', false);
    const studied = getStudiedPlates();
    expect(studied.has('Botrytis cinerea')).toBe(false);
    expect(studied.has('Tetranychidae')).toBe(true);
  });

  it('stats aggregate streak, accuracy and plates', () => {
    recordQuizOutcome(true);
    markPlateStudied('Tetranychidae', true);
    const s = libraryStats(4, 9, 16);
    expect(s).toEqual({ streak: 4, bestStreak: 9, accuracyPct: 100, platesStudied: 1, totalPlates: 16 });
  });
});

describe('quiz record + best streak (badge feed)', () => {
  beforeEach(() => {
    safeStore.removeItem('botanical_quiz_accuracy');
    safeStore.removeItem('botanical_quiz_best_streak');
  });

  it('quizRecord exposes the denominator, not just the percentage', () => {
    expect(quizRecord()).toEqual({ correct: 0, total: 0 });
    recordQuizOutcome(true);
    recordQuizOutcome(true);
    recordQuizOutcome(false);
    expect(quizRecord()).toEqual({ correct: 2, total: 3 });
    expect(quizAccuracy()).toBe(67);
  });

  it('quizBestStreak owns its key and clamps garbage', () => {
    expect(quizBestStreak()).toBe(0);
    safeStore.setItem('botanical_quiz_best_streak', '9');
    expect(quizBestStreak()).toBe(9);
    safeStore.setItem('botanical_quiz_best_streak', '-4');
    expect(quizBestStreak()).toBe(0);
  });
});

describe('folioMatchesForSpecies', () => {
  const folios = [
    { name: 'Monstera deliciosa', scientific: 'Monstera deliciosa' },
    { name: 'Ficus lyrata', scientific: 'Ficus lyrata' },
    { name: 'Root Rot', scientific: 'Phytophthora root rot' },
    { name: 'Ficus rubiginosa', scientific: 'Ficus rubiginosa' },
  ];

  it('the scan found the matcher it means to check', () => {
    expect(folioMatchesForSpecies(folios, [])).toEqual([]);
  });

  it('matches an exact binomial and a longer varietal name', () => {
    const hits = folioMatchesForSpecies(folios, ['Monstera deliciosa', 'Monstera Deliciosa Variegata']);
    expect(hits).toHaveLength(1);
    expect(hits[0].scientific).toBe('Monstera deliciosa');
  });

  it('a bare genus resolves only when the corpus is unambiguous', () => {
    const hits = folioMatchesForSpecies(folios, ['monstera']);
    expect(hits).toHaveLength(1);
    expect(hits[0].scientific).toBe('Monstera deliciosa');
    // Two ficus folios: 'ficus' alone must not guess.
    expect(folioMatchesForSpecies(folios, ['ficus'])).toEqual([]);
  });

  it('matches the exact binomial even when the genus is ambiguous', () => {
    const hits = folioMatchesForSpecies(folios, ['Ficus lyrata']);
    expect(hits).toHaveLength(1);
    expect(hits[0].scientific).toBe('Ficus lyrata');
  });

  it('no species, empty garden, or non-matching genus renders nothing', () => {
    expect(folioMatchesForSpecies(folios, ['  '])).toEqual([]);
    expect(folioMatchesForSpecies(folios, ['Begonia maculata'])).toEqual([]);
    expect(folioMatchesForSpecies([], ['Monstera deliciosa'])).toEqual([]);
  });

  it('returns matches in corpus order regardless of plant order', () => {
    const hits = folioMatchesForSpecies(folios, ['Ficus lyrata', 'monstera deliciosa']);
    expect(hits.map(f => f.scientific)).toEqual(['Monstera deliciosa', 'Ficus lyrata']);
  });

  it('does not recommend a folio for a different species in the same genus', () => {
    // 'Monstera adansonii' is NOT 'Monstera deliciosa' — the deliciosa
    // plate's advice would be wrong for it, and a wrong "this is your plant"
    // is worse than no recommendation at all.
    expect(folioMatchesForSpecies(folios, ['Monstera adansonii'])).toEqual([]);
  });
});
