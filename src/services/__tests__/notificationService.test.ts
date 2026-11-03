import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  frequencyDays,
  inPreferredWindow,
  reminderWindowStart,
  wateringDue,
  checkInDue,
  nextTreatmentStep,
  wateringMessage,
  treatmentMessage,
  checkInMessage,
  NotificationService,
  DEFAULT_PREFS,
} from '../notificationService';
import { db } from '../../db/database';

const NOON = new Date('2026-03-15T12:30:00');
const MORNING = new Date('2026-03-15T08:00:00');
const NIGHT = new Date('2026-03-15T23:30:00');

/** `where(...)` stub answering every shape evaluate() asks of it. */
const emptyCollection = () => ({
  above: () => ({ toArray: async () => [] }),
  below: () => ({ delete: async () => 0 }),
  equals: () => ({
    first: async () => undefined,
    toArray: async () => [],
    sortBy: async () => [],
  }),
});

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

describe('custom reminder window', () => {
  it('replaces the named slot when enabled', () => {
    const custom = { ...DEFAULT_PREFS, customWindow: { enabled: true, fromHour: 8, toHour: 20 } };
    expect(inPreferredWindow(custom, MORNING)).toBe(true); // 08:00 — boundary included
    expect(inPreferredWindow(custom, NOON)).toBe(true);
    expect(inPreferredWindow(custom, NIGHT)).toBe(false);
  });

  it('wraps midnight when from is later than to', () => {
    const custom = { ...DEFAULT_PREFS, customWindow: { enabled: true, fromHour: 22, toHour: 6 } };
    expect(inPreferredWindow(custom, NIGHT)).toBe(true);
    expect(inPreferredWindow(custom, new Date('2026-03-15T02:00:00'))).toBe(true);
    expect(inPreferredWindow(custom, NOON)).toBe(false);
  });

  it('a degenerate from===to falls back to the named slot instead of going silent', () => {
    const morning = { ...DEFAULT_PREFS, timeOfDay: 'morning' as const };
    const custom = { ...morning, customWindow: { enabled: true, fromHour: 9, toHour: 9 } };
    expect(inPreferredWindow(custom, MORNING)).toBe(true); // morning slot: 05–12
    expect(inPreferredWindow(custom, NOON)).toBe(false);
  });

  it('clamps out-of-range hours rather than trusting them', () => {
    // 99 → 23, -3 → 0: a 23→0 wrap where only the 23:xx hour qualifies.
    const custom = { ...DEFAULT_PREFS, customWindow: { enabled: true, fromHour: 99, toHour: -3 } };
    expect(inPreferredWindow(custom, NIGHT)).toBe(true);
    expect(inPreferredWindow(custom, NOON)).toBe(false);
  });
});

describe('reminder window start (defer, never skip)', () => {
  it('names the moment the current window opened', () => {
    const start = reminderWindowStart(DEFAULT_PREFS, MORNING);
    expect(start).not.toBeNull();
    expect(start!.getHours()).toBe(5); // morning window opens at 05:00
    expect(reminderWindowStart(DEFAULT_PREFS, NIGHT)).toBeNull();
  });

  it('a custom window wrapping midnight opened yesterday evening', () => {
    const prefs = { ...DEFAULT_PREFS, customWindow: { enabled: true, fromHour: 22, toHour: 6 } };
    const at2am = new Date('2026-03-15T02:00:00');
    const start = reminderWindowStart(prefs, at2am)!;
    expect(start.getDate()).toBe(14); // March 14, 22:00
    expect(start.getHours()).toBe(22);
    expect(reminderWindowStart(prefs, NOON)).toBeNull();
  });

  it('inPreferredWindow agrees with the window start', () => {
    expect(inPreferredWindow(DEFAULT_PREFS, MORNING)).toBe(reminderWindowStart(DEFAULT_PREFS, MORNING) !== null);
    expect(inPreferredWindow(DEFAULT_PREFS, NIGHT)).toBe(reminderWindowStart(DEFAULT_PREFS, NIGHT) !== null);
  });

  it('a reminder due before the window opens is HELD, not skipped — and labelled', async () => {
    // Due yesterday evening; the morning window opens at 05:00; now 08:00.
    vi.spyOn(db.plants, 'toArray').mockResolvedValue([
      { id: 'p1', name: 'Fern', nextWaterDue: new Date('2026-03-14T19:00:00') },
    ] as any);
    vi.spyOn(db.weatherAdjustments, 'toArray').mockResolvedValue([] as any);
    vi.spyOn(db.reminderLog, 'where').mockReturnValue(emptyCollection() as any);
    vi.spyOn(db.reminders, 'where').mockReturnValue(emptyCollection() as any);

    const due = await NotificationService.evaluate(MORNING);
    const watering = due.find(d => d.plantId === 'p1' && d.kind === 'watering');
    expect(watering).toBeDefined();
    expect(watering!.body).toBe('Your Fern needs water today (held for your reminder window)');
  });

  it('a reminder that became due inside the window carries no held note', async () => {
    vi.spyOn(db.plants, 'toArray').mockResolvedValue([
      { id: 'p1', name: 'Fern', nextWaterDue: new Date('2026-03-15T06:30:00') },
    ] as any);
    vi.spyOn(db.weatherAdjustments, 'toArray').mockResolvedValue([] as any);
    vi.spyOn(db.reminderLog, 'where').mockReturnValue(emptyCollection() as any);
    vi.spyOn(db.reminders, 'where').mockReturnValue(emptyCollection() as any);

    const due = await NotificationService.evaluate(MORNING);
    expect(due.find(d => d.plantId === 'p1')!.body).toBe('Your Fern needs water today');
  });
});

describe('per-plant mute', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a muted plant produces no reminders even when overdue', async () => {
    const overdue = new Date(MORNING.getTime() - 60_000);
    vi.spyOn(db.plants, 'toArray').mockResolvedValue([
      { id: 'p1', name: 'Muted Monstera', nextWaterDue: overdue, remindersMuted: true },
      { id: 'p2', name: 'Thirsty Ficus', nextWaterDue: overdue },
    ] as any);
    vi.spyOn(db.weatherAdjustments, 'toArray').mockResolvedValue([] as any);
    vi.spyOn(db.reminderLog, 'where').mockReturnValue(emptyCollection() as any);
    vi.spyOn(db.reminders, 'where').mockReturnValue(emptyCollection() as any);

    const due = await NotificationService.evaluate(MORNING);
    expect(due.some(d => d.plantId === 'p1')).toBe(false);
    expect(due.some(d => d.plantId === 'p2' && d.kind === 'watering')).toBe(true);
  });
});

describe('weather adjustments in the engine', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a heat adjustment makes a not-yet-due plant due', async () => {
    // Watered 6 days ago on a 7-day cadence: the stored due is tomorrow, but
    // the heat boost (×2/3) puts the effective due ~1.3 days in the past.
    const last = new Date(MORNING.getTime() - 6 * 86_400_000);
    vi.spyOn(db.plants, 'toArray').mockResolvedValue([
      {
        id: 'p1',
        name: 'Sunbaked Fern',
        lastWateredAt: last,
        nextWaterDue: new Date(MORNING.getTime() + 86_400_000),
        wateringIntervalDays: 7,
      },
    ] as any);
    vi.spyOn(db.weatherAdjustments, 'toArray').mockResolvedValue([
      {
        id: 'w1',
        kind: 'heat',
        plantId: 'p1',
        createdAt: new Date(MORNING.getTime() - 86_400_000),
        expiresAt: new Date(MORNING.getTime() + 6 * 86_400_000),
      },
    ] as any);
    vi.spyOn(db.reminderLog, 'where').mockReturnValue(emptyCollection() as any);
    vi.spyOn(db.reminders, 'where').mockReturnValue(emptyCollection() as any);

    const due = await NotificationService.evaluate(MORNING);
    expect(due.some(d => d.plantId === 'p1' && d.kind === 'watering')).toBe(true);
  });

  it('without adjustments the stored schedule is honoured as-is', async () => {
    vi.spyOn(db.plants, 'toArray').mockResolvedValue([
      {
        id: 'p1',
        name: 'Content Fern',
        lastWateredAt: new Date(MORNING.getTime() - 6 * 86_400_000),
        nextWaterDue: new Date(MORNING.getTime() + 86_400_000),
        wateringIntervalDays: 7,
      },
    ] as any);
    vi.spyOn(db.weatherAdjustments, 'toArray').mockResolvedValue([] as any);
    vi.spyOn(db.reminderLog, 'where').mockReturnValue(emptyCollection() as any);
    vi.spyOn(db.reminders, 'where').mockReturnValue(emptyCollection() as any);

    const due = await NotificationService.evaluate(MORNING);
    expect(due.some(d => d.plantId === 'p1' && d.kind === 'watering')).toBe(false);
  });
});
