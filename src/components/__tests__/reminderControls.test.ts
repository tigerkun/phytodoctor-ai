import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments, openingTags, tagAround } from '../../test/helpers';

/**
 * The reminder controls added with the quiet-hours / per-plant-override /
 * reset work. Source-level (no DOM in this suite); each scan first proves it
 * found the structures it means to police.
 */

const settings = stripJsComments(readSource('src/pages/Settings.tsx'));
const drawer = stripJsComments(readSource('src/components/home/PlantProfileDrawer.tsx'));

describe('Settings quiet hours', () => {
  it('the scan found the reminder card it means to check', () => {
    expect(settings).toContain('Reminder Rhythm');
  });

  it('offers a custom window that replaces the named slot', () => {
    expect(settings).toContain('Custom Reminder Window');
    // The toggle flips `enabled` through the same handleReminderPref path
    // (savePrefs) as every other rhythm control.
    expect(settings).toContain('enabled: !customWindow.enabled');
    expect(settings).toContain('handleReminderPref({');
  });

  it('selects write hours back through the engine prefs, not ad-hoc storage', () => {
    // The change handler must reach handleReminderPref (savePrefs) — a
    // select that only setState()s would silently lose the window on reload.
    // The label is a ternary over the two field names; both halves ship.
    expect(settings).toContain("'Reminders from hour' : 'Reminders until hour'");
    expect(settings).toContain('customWindow: { ...customWindow, [field]: Number(e.target.value) }');
  });
});

describe('Settings garden reset', () => {
  it('the scan found the danger zone it means to check', () => {
    expect(settings).toContain('Start Fresh');
  });

  it('is a two-step confirm, not a single mis-tap', () => {
    // Step one opens the dialog; step two is an explicit confirm inside it.
    const opener = tagAround(settings, 'Start Fresh…', ['<button']);
    expect(opener).toContain('setResetOpen(true)');
    expect(settings).toContain('role="dialog"');
    expect(settings).toContain('Reset everything');
    expect(settings).toContain('Keep my garden');
  });

  it('the copy is honest about what survives and what returns', () => {
    expect(settings).toContain('Cloud-synced plants return on the next sync');
    expect(settings).toContain('purchases and photos are kept');
    // Account deletion stays a support contact — the documented absence.
    expect(settings).toContain('support contact');
  });

  it('the confirm goes through resetGardenProgress, nothing else', () => {
    expect(settings).toContain('import { resetGardenProgress } from');
    expect(settings).toContain('await resetGardenProgress(userId)');
  });
});

describe('PlantProfileDrawer reminder controls', () => {
  it('the scan found the drawer it means to check', () => {
    expect(drawer).toContain('Care Schedule');
  });

  it('reads the live Dexie row, not the display prop', () => {
    // The prop predates the reminder fields; the toggle must not write blind.
    expect(drawer).toContain('useLiveQuery(() => db.plants.get(plant.id), [plant.id])');
    expect(drawer).toContain('livePlant?.remindersMuted');
  });

  it('the mute is a labelled switch, reachable by keyboard readers', () => {
    const toggle = tagAround(drawer, 'Mute reminders for this plant', ['<button']);
    expect(toggle).toContain('role="switch"');
    expect(toggle).toContain('aria-checked={muted}');
  });

  it('cadence writes the plant’s own interval, with an offline fallback', () => {
    expect(drawer).toContain('PlantService.setWateringInterval(plant.id, days)');
    expect(drawer).toContain('wateringIntervalDays: days');
    expect(drawer).toContain('id="drawer-watering-cadence"');
  });
});
