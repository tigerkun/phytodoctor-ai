import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments, tagAround } from '../../test/helpers';

/**
 * The ten operational refinements' UI wiring. Source-level; each scan first
 * proves it found the structures it means to police.
 */

const settings = stripJsComments(readSource('src/pages/Settings.tsx'));
const dashboard = stripJsComments(readSource('src/components/home/GardenDashboard.tsx'));
const floating = stripJsComments(readSource('src/components/FloatingAssistant.tsx'));
const assistant = stripJsComments(readSource('src/pages/Assistant.tsx'));
const library = stripJsComments(readSource('src/pages/Library.tsx'));
const gallery = stripJsComments(readSource('src/components/home/PlantGallery.tsx'));
const drawer = stripJsComments(readSource('src/components/home/PlantProfileDrawer.tsx'));

describe('reset safety net (Settings)', () => {
  it('the scan found the reset modal it means to check', () => {
    expect(settings).toContain('Reset this garden?');
  });

  it('offers a backup download beside the reset confirm', () => {
    expect(settings).toContain('Download backup first');
    expect(settings).toContain('cannot be undone');
  });

  it('offers restore next to export, under the spec backup filename', () => {
    expect(settings).toContain('restoreBackup(');
    expect(settings).toContain('type="file"');
    expect(settings).toContain('best-effort');
    expect(settings).toContain('phytodoctor-backup-');
  });

  it('keeps a weather protection history section', () => {
    expect(settings).toContain('Weather Protection History');
    expect(settings).toContain('useLiveQuery(() => db.weatherAdjustments.toArray(), [])');
    expect(settings).toContain('HISTORY_RETENTION_DAYS');
  });
});

describe('assistant privacy (Settings + both surfaces)', () => {
  it('the toggle reaches the shared accessor, not ad-hoc storage', () => {
    expect(settings).toContain('setAssistantContextEnabled(');
    expect(settings).toContain('aria-label="Toggle assistant garden context"');
  });

  it('both surfaces disclose the data flow and gate the briefing', () => {
    for (const surface of [floating, assistant]) {
      expect(surface).toContain('if (!assistantContextEnabled()) return undefined;');
      expect(surface).toContain('🌿 Personalized with your garden · off in Settings');
    }
  });

  it('both surfaces surface a truncated briefing', () => {
    for (const surface of [floating, assistant]) {
      expect(surface).toContain('Garden brief truncated');
    }
  });

  it('the drawer chat can file the last reply to the notebook', () => {
    // Real plant id when the caller passed one — never a made-up slug.
    expect(floating).toContain('plantId: plantIdParam || \'botanical-consultation\'');
    const button = tagAround(floating, '📝 Save last reply', ['<button']);
    expect(button).toContain('saveLastReply');
    expect(floating).toContain('GameService.getUserId()');
  });
});

describe('weather undo + history (dashboard)', () => {
  it('the scan found the protected chip it means to check', () => {
    expect(dashboard).toContain('Protected until');
  });

  it('a covered alert can be undone — no 7-day lock-in on a misclick', () => {
    const button = tagAround(dashboard, "'Undo'", ['<button']);
    expect(button).toContain('revertProtection(alert)');
    expect(dashboard).toContain('your usual watering schedule is back');
  });

  it('shows the recent application pattern in both states', () => {
    // Two render sites: covered and uncovered — both read the same counter.
    expect(dashboard.match(/applied \{recentCount\(alert\.kind\)\}× in the last 30 days/g)?.length).toBe(2);
  });
});

describe('badge progress + celebrations (Library)', () => {
  it('the scan found the progress region it means to check', () => {
    expect(library).toContain('aria-label="Badge progress"');
  });

  it('shows all three thresholds with real, capped numbers', () => {
    for (const label of ['Moss Pole Climber', 'Puzzle Master', 'Folio Botanist']) {
      expect(library).toContain(label);
    }
    expect(library).toContain('Math.min(bestStreak, 7)');
    expect(library).toContain('Math.min(studiedPlates.size, PHYTO_NOTES.length)');
  });

  it('celebrates at the moment of earning, with fresh values', () => {
    expect(library).toContain('announceBadges({ bestStreak: Math.max(bestStreak, streak + (isCorrect ? 1 : 0)) })');
    expect(library).toContain('markPlateStudied(scientific, true)');
    // The call rides the opening branch of togglePlate, after the write.
    expect(library.indexOf('announceBadges();')).toBeGreaterThan(library.indexOf('markPlateStudied(scientific, true);'));
  });
});

describe('custom-cadence visibility', () => {
  it('the gallery tags plants whose cadence a human chose', () => {
    expect(gallery).toContain('plant.wateringIntervalCustom');
    expect(gallery).toContain('every {plant.wateringIntervalDays ?? 7}d');
  });

  it('the drawer says so in place, where the control lives', () => {
    expect(drawer).toContain('livePlant?.wateringIntervalCustom');
    expect(drawer).toContain('Custom cadence');
  });

  it('the flag is client-only and survives cloud round-trips', () => {
    const service = stripJsComments(readSource('src/services/plantService.ts'));
    expect(service).toContain('wateringIntervalCustom: true');
    expect(service).toContain("(merged as any).wateringIntervalCustom = true");
    // And it must NOT map to Postgres — no column exists for it.
    expect(service).not.toContain('watering_interval_custom');
  });
});

describe('partial water-all feedback', () => {
  it('both chip surfaces share one loop with per-plant failure capture', () => {
    const chips = stripJsComments(readSource('src/components/assistant/GardenActionChips.tsx'));
    const fab = stripJsComments(readSource('src/components/QuickActionsFab.tsx'));
    for (const surface of [chips, fab]) {
      expect(surface).toContain('await waterAllDue()');
      expect(surface).toContain('Watered ${result.watered} of ${result.total}');
    }
    const service = stripJsComments(readSource('src/services/gardenActions.ts'));
    expect(service).toContain('failedNames.push(plant.name || plant.id)');
  });
});

describe('quiet-hours defer copy (Settings)', () => {
  it('tells the Keeper the defer rule in plain words', () => {
    expect(settings).toContain('wait for your window — nothing is skipped');
  });
});
