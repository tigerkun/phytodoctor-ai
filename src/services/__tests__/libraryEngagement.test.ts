import { describe, it, expect, beforeEach } from 'vitest';
import {
  quizStreakMultiplier,
  quizSeedsFor,
  recordQuizOutcome,
  quizAccuracy,
  markPlateStudied,
  getStudiedPlates,
  libraryStats,
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
