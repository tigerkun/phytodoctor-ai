import { db } from '../db/database';
import type { Plant, ScheduledReminder, ReminderLogEntry, WeatherAdjustment } from '../db/database';
import { activeAdjustments, effectiveNextWaterDue } from './weatherAdjustments';

/**
 * Client-side reminder engine — the counterpart to the server's push
 * daemons, not a duplicate of them. The server owns background push for
 * subscribed cloud accounts (watering + treatment milestones, see server.ts).
 * What it cannot do is reach local-only accounts, fire while the app is
 * open, or honour a per-Keeper rhythm — that is this file's job:
 *
 *  - Reminders are COMPUTED from data already in Dexie (nextWaterDue,
 *    roadmap sequence, check-in cadence), never scheduled per-save. A
 *    schedule that drifts from the plant record is a reminder that lies;
 *    recomputing on each tick cannot drift.
 *  - `reminders` holds only explicitly scheduled custom offsets.
 *  - `reminderLog` is delivery history AND the once-per-(plant,kind)-per-day
 *    dedupe key, so a reminder fires at most once a day however often the
 *    runner ticks.
 *  - Delivery: an in-app toast when the app is visible; a browser
 *    notification (permission-gated) when the tab is in the background.
 *    Server push covers the browser-closed case.
 */

export type ReminderKind = 'watering' | 'treatment' | 'checkin';

export interface ReminderPrefs {
  /** When the Keeper wants to be nudged. The runner only fires inside the
   *  window; if the app isn't open then, the reminder waits for the next
   *  window rather than barging in at midnight. */
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  /** Minimum days between check-in nudges for the same plant. */
  frequency: 'daily' | 'every-2-days' | 'weekly';
  /** Deliver as browser notifications (still permission-gated) when the tab
   *  is hidden, in addition to toasts. */
  localNotifications: boolean;
  /** Optional custom delivery window (hours 0–23) that replaces the named
   *  timeOfDay slot when enabled — "nudges at 8am, not midnight" in the
   *  Keeper's own words. from=22 with to=6 wraps midnight. A degenerate
   *  from===to falls back to the named slot rather than going silent. */
  customWindow?: { enabled: boolean; fromHour: number; toHour: number };
}

const PREFS_KEY = 'phyto_reminder_prefs';
export const DEFAULT_PREFS: ReminderPrefs = {
  timeOfDay: 'morning',
  frequency: 'daily',
  localNotifications: true,
};

import { safeStore } from '../lib/safeStore';

const WINDOWS: Record<ReminderPrefs['timeOfDay'], [number, number]> = {
  morning: [5, 12],
  afternoon: [12, 17],
  evening: [17, 22],
};

export function frequencyDays(frequency: ReminderPrefs['frequency']): number {
  return frequency === 'daily' ? 1 : frequency === 'every-2-days' ? 2 : 7;
}

const clampHour = (h: unknown): number =>
  Math.min(23, Math.max(0, Math.floor(Number(h) || 0)));

export function inPreferredWindow(prefs: ReminderPrefs, now: Date = new Date()): boolean {
  const hour = now.getHours();
  const custom = prefs.customWindow;
  if (custom?.enabled) {
    const from = clampHour(custom.fromHour);
    const to = clampHour(custom.toHour);
    if (from === to) {
      // A zero-length window would silently mute everything forever — never
      // what a misconfigured toggle means. Fall back to the named slot.
      const [f, t] = WINDOWS[prefs.timeOfDay];
      return hour >= f && hour < t;
    }
    return from < to ? hour >= from && hour < to : hour >= from || hour < to;
  }
  const [from, to] = WINDOWS[prefs.timeOfDay];
  return hour >= from && hour < to;
}

// ── Pure evaluators — primitives in, verdict out, no Dexie, no DOM ─────────

export function wateringDue(plant: Pick<Plant, 'nextWaterDue'>, now: Date = new Date()): boolean {
  const due = plant.nextWaterDue;
  if (!due) return false;
  return new Date(due).getTime() <= now.getTime();
}

export function checkInDue(
  lastCheckInAt: Date | null,
  frequency: ReminderPrefs['frequency'],
  now: Date = new Date(),
): boolean {
  if (!lastCheckInAt) return true; // never checked in — the nudge is the point
  const gapDays = (now.getTime() - new Date(lastCheckInAt).getTime()) / 86_400_000;
  return gapDays >= frequencyDays(frequency);
}

export function nextTreatmentStep(
  roadmap: NonNullable<Plant['recoveryRoadmap']> | null | undefined,
  completedPhaseIndexes: Set<number>,
): { stepNumber: number; action: string } | null {
  if (!roadmap?.timeline?.length) return null;
  const idx = roadmap.timeline.findIndex((_, i) => !completedPhaseIndexes.has(i));
  if (idx === -1) return null; // every step done — nothing left to remind
  return { stepNumber: idx + 1, action: roadmap.timeline[idx].action };
}

export function wateringMessage(nickname: string): string {
  return `Your ${nickname} needs water today`;
}

export function treatmentMessage(nickname: string, step: { stepNumber: number; action: string }): string {
  return `Step ${step.stepNumber} of treatment due for ${nickname} — ${step.action}`;
}

export function checkInMessage(nickname: string): string {
  return `Time to check on ${nickname}'s recovery`;
}

// ── What the runner delivers ────────────────────────────────────────────────

export interface DueReminder {
  kind: ReminderKind;
  plantId: string;
  plantName: string;
  title: string;
  body: string;
  stepNumber?: number;
}

function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MASTER_TOGGLE_KEY = 'botanical_notifications_enabled';

function masterEnabled(): boolean {
  const raw = safeStore.getItem(MASTER_TOGGLE_KEY);
  return raw === null ? true : raw === 'true';
}

function pruneCutoff(now: Date): Date {
  return new Date(now.getTime() - 90 * 86_400_000);
}

export const NotificationService = {
  prefs(): ReminderPrefs {
    try {
      const raw = safeStore.getItem(PREFS_KEY);
      return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  },

  savePrefs(prefs: ReminderPrefs): void {
    safeStore.setItem(PREFS_KEY, JSON.stringify(prefs));
  },

  /** Explicit custom schedules — the only writes to `reminders`. Implicit
   *  due-ness is computed, never stored. Re-scheduling the same (plant,
   *  kind) replaces the previous custom offset. */
  async scheduleWateringReminder(plantId: string, days = 1): Promise<string> {
    return NotificationService.putSchedule(plantId, 'watering', days);
  },

  async scheduleTreatmentReminder(plantId: string, days: number, stepNumber?: number): Promise<string> {
    return NotificationService.putSchedule(plantId, 'treatment', days, stepNumber);
  },

  async scheduleCheckInReminder(plantId: string, days = 2): Promise<string> {
    return NotificationService.putSchedule(plantId, 'checkin', days);
  },

  async cancelReminder(id: string): Promise<void> {
    await db.reminders.delete(id);
  },

  async listReminders(plantId?: string): Promise<ScheduledReminder[]> {
    if (plantId) return db.reminders.where('plantId').equals(plantId).toArray();
    return db.reminders.toArray();
  },

  async putSchedule(plantId: string, kind: ReminderKind, days: number, stepNumber?: number): Promise<string> {
    await db.reminders.where('[plantId+kind]').equals([plantId, kind]).delete();
    const reminder: ScheduledReminder = {
      id: crypto.randomUUID(),
      plantId,
      kind,
      dueAt: new Date(Date.now() + days * 86_400_000),
      stepNumber,
      createdAt: new Date(),
    };
    await db.reminders.put(reminder);
    return reminder.id;
  },

  /**
   * Everything due right now, cross-referenced against what was already
   * delivered today. Reads Dexie; delivers nothing.
   */
  async evaluate(now: Date = new Date()): Promise<DueReminder[]> {
    const prefs = NotificationService.prefs();
    if (!masterEnabled() || !inPreferredWindow(prefs, now)) return [];

    const plants = await db.plants.toArray();
    // Weather protections (weatherAdjustments.ts) — only heat moves
    // watering, pulling it forward; expiry is filtered at read time.
    let adjustments: WeatherAdjustment[] = [];
    try {
      adjustments = activeAdjustments(await db.weatherAdjustments.toArray(), now);
    } catch {
      // Table unreachable (private mode, mid-upgrade) — no adjustment is
      // the safe default: the stored schedule is honoured as-is.
    }
    const deliveredToday = new Set(
      (await db.reminderLog.where('firedAt').above(startOfToday(now)).toArray())
        .map(r => `${r.plantId}:${r.kind}`),
    );
    const due: DueReminder[] = [];

    for (const plant of plants) {
      if (!plant.name) continue;
      // Per-plant mute (the profile drawer's toggle): the engine stays quiet
      // about this plant entirely. The care facts don't change — it still
      // shows in due counts and the task queue — only the nudges stop.
      if (plant.remindersMuted) continue;
      const key = `${plant.id}:watering`;
      const custom = await db.reminders.where('[plantId+kind]').equals([plant.id, 'watering']).first();
      const effectiveDue = effectiveNextWaterDue(plant, adjustments, now);
      if (
        !deliveredToday.has(key) &&
        (wateringDue({ nextWaterDue: effectiveDue }, now) || (custom && new Date(custom.dueAt).getTime() <= now.getTime()))
      ) {
        due.push({ kind: 'watering', plantId: plant.id, plantName: plant.name, title: 'Watering due', body: wateringMessage(plant.name) });
      }

      // Check-in nudges are recovery-flavoured by design — the recovering
      // and roadmap'd plants are the ones that need the ritual.
      const inRecovery = plant.status === 'Recovering' || !!plant.recoveryRoadmap;
      if (inRecovery && !deliveredToday.has(`${plant.id}:checkin`)) {
        const lastCheckIn = await db.checkins.where('plantId').equals(plant.id).sortBy('timestamp');
        const last = lastCheckIn[lastCheckIn.length - 1]?.timestamp ?? null;
        const custom = await db.reminders.where('[plantId+kind]').equals([plant.id, 'checkin']).first();
        const customDue = custom && new Date(custom.dueAt).getTime() <= now.getTime();
        if (customDue || checkInDue(last ? new Date(last) : null, prefs.frequency, now)) {
          due.push({ kind: 'checkin', plantId: plant.id, plantName: plant.name, title: 'Check-in time', body: checkInMessage(plant.name) });
        }
      }

      if (!deliveredToday.has(`${plant.id}:treatment`) && plant.recoveryRoadmap) {
        const records = await db.treatmentActions.where('plantId').equals(plant.id).toArray();
        const step = nextTreatmentStep(plant.recoveryRoadmap, new Set(records.map(r => r.phaseIndex)));
        if (step) {
          due.push({ kind: 'treatment', plantId: plant.id, plantName: plant.name, title: 'Treatment step due', body: treatmentMessage(plant.name, step), stepNumber: step.stepNumber });
        }
      }
    }

    // Explicit treatment schedules with no implicit step due still fire.
    const treatmentCustoms = await db.reminders.where('kind').equals('treatment').toArray();
    for (const c of treatmentCustoms) {
      if (due.some(d => d.plantId === c.plantId && d.kind === 'treatment')) continue;
      if (deliveredToday.has(`${c.plantId}:treatment`)) continue;
      if (new Date(c.dueAt).getTime() <= now.getTime()) {
        const plant = plants.find(p => p.id === c.plantId);
        const name = plant?.name ?? 'your plant';
        due.push({ kind: 'treatment', plantId: c.plantId, plantName: name, title: 'Treatment step due', body: `Treatment reminder for ${name}`, stepNumber: c.stepNumber });
      }
    }

    return due;
  },

  /**
   * One pass: evaluate, deliver through the callback (toast when visible,
   * browser notification when the tab is hidden and permission allows),
   * log every delivery, prune history older than 90 days.
   * Returns how many reminders were delivered.
   */
  async runOnce(
    notify: (reminder: DueReminder) => void,
    now: Date = new Date(),
  ): Promise<number> {
    const due = await NotificationService.evaluate(now);
    if (!due.length) return 0;

    const prefs = NotificationService.prefs();
    const canNotify =
      prefs.localNotifications &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      typeof document !== 'undefined' &&
      document.hidden;

    const entries: ReminderLogEntry[] = [];
    for (const reminder of due) {
      let channel: ReminderLogEntry['channel'] = 'toast';
      if (canNotify) {
        try {
          new Notification(reminder.title, {
            body: reminder.body,
            tag: `phyto-${reminder.kind}-${reminder.plantId}`,
          });
          channel = 'notification';
        } catch {
          // Notification constructor can throw (SW-less contexts, autofocus
          // policies). The toast below still fires — a missed banner must
          // not swallow the reminder.
        }
      }
      notify(reminder);
      entries.push({
        id: crypto.randomUUID(),
        plantId: reminder.plantId,
        kind: reminder.kind,
        message: reminder.body,
        channel,
        firedAt: now,
      });
    }
    await db.reminderLog.bulkPut(entries);
    await db.reminderLog.where('firedAt').below(pruneCutoff(now)).delete();
    return due.length;
  },
};
