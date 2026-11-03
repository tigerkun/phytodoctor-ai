import { describe, it, expect } from 'vitest';
import {
  frequencyDays,
  inPreferredWindow,
  wateringDue,
  checkInDue,
  nextTreatmentStep,
  wateringMessage,
  treatmentMessage,
  checkInMessage,
  NotificationService,
  DEFAULT_PREFS,
} from '../notificationService';

const NOON = new Date('2026-03-15T12:30:00');
const MORNING = new Date('2026-03-15T08:00:00');
const NIGHT = new Date('2026-03-15T23:30:00');

describe('reminder windows and cadence', () => {
  it('the scan found the service it means to check', () => {
    expect(frequencyDays('daily')).toBe(1);
  });

  it('fires only inside the preferred window', () => {
    const morning = { ...DEFAULT_PREFS, timeOfDay: 'morning' as const };
    expect(inPreferredWindow(morning, MORNING)).toBe(true);
    expect(inPreferredWindow(morning, NOON)).toBe(false);
    expect(inPreferredWindow(morning, NIGHT)).toBe(false);
  });

  it('maps the frequency ladder to days', () => {
    expect(frequencyDays('daily')).toBe(1);
    expect(frequencyDays('every-2-days')).toBe(2);
    expect(frequencyDays('weekly')).toBe(7);
  });

  it('prefs round-trip through the store', () => {
    NotificationService.savePrefs({ timeOfDay: 'evening', frequency: 'weekly', localNotifications: false });
    expect(NotificationService.prefs()).toEqual({ timeOfDay: 'evening', frequency: 'weekly', localNotifications: false });
    // Restore defaults for the other tests in this file.
    NotificationService.savePrefs(DEFAULT_PREFS);
    expect(NotificationService.prefs()).toEqual(DEFAULT_PREFS);
  });
});

describe('wateringDue', () => {
  it('is due when nextWaterDue has passed', () => {
    const plant = { nextWaterDue: new Date(NOON.getTime() - 60_000) };
    expect(wateringDue(plant, NOON)).toBe(true);
  });

  it('is not due before the date, or when it is unknown', () => {
    expect(wateringDue({ nextWaterDue: new Date(NOON.getTime() + 3_600_000) }, NOON)).toBe(false);
    expect(wateringDue({ nextWaterDue: null }, NOON)).toBe(false);
  });
});

describe('checkInDue', () => {
  it('a plant never checked in is due immediately', () => {
    expect(checkInDue(null, 'daily', NOON)).toBe(true);
  });

  it('respects the cadence from the last check-in', () => {
    const twoDaysAgo = new Date(NOON.getTime() - 2 * 86_400_000);
    expect(checkInDue(twoDaysAgo, 'daily', NOON)).toBe(true);
    expect(checkInDue(twoDaysAgo, 'every-2-days', NOON)).toBe(true);
    expect(checkInDue(twoDaysAgo, 'weekly', NOON)).toBe(false);
  });
});

describe('nextTreatmentStep', () => {
  const roadmap = {
    timeline: [
      { day: 'Day 1', action: 'Remove affected leaves', expectedOutcome: 'Clean canopy' },
      { day: 'Day 3', action: 'Apply neem spray', expectedOutcome: 'Coated underside' },
      { day: 'Day 7', action: 'Re-inspect', expectedOutcome: 'No spread' },
    ],
  };

  it('starts at step 1 with nothing completed', () => {
    expect(nextTreatmentStep(roadmap, new Set())?.stepNumber).toBe(1);
  });

  it('advances past completed phases and rests when all are done', () => {
    expect(nextTreatmentStep(roadmap, new Set([0]))?.stepNumber).toBe(2);
    expect(nextTreatmentStep(roadmap, new Set([0, 1]))?.action).toBe('Re-inspect');
    expect(nextTreatmentStep(roadmap, new Set([0, 1, 2]))).toBeNull();
  });

  it('tolerates a missing roadmap', () => {
    expect(nextTreatmentStep(null, new Set())).toBeNull();
  });
});

describe('reminder copy', () => {
  it('matches the promised phrasing', () => {
    expect(wateringMessage('Monstera')).toBe('Your Monstera needs water today');
    expect(treatmentMessage('Monstera', { stepNumber: 2, action: 'Apply neem spray' })).toBe(
      'Step 2 of treatment due for Monstera — Apply neem spray',
    );
    expect(checkInMessage('Monstera')).toBe("Time to check on Monstera's recovery");
  });
});
