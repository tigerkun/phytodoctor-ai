import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The Quick Actions FAB performs real acts (watering, navigation) from a
 * global surface, so a few of its decisions are load-bearing and pinned at
 * the source level: no auth bypass hidden in a gesture, watering through
 * the shared service, eco mode honoured, live badge over stale polling.
 */

const fab = stripJsComments(readSource('src/components/QuickActionsFab.tsx'));
const layout = stripJsComments(readSource('src/components/Layout.tsx'));

describe('quick actions fab', () => {
  it('the scan found the files it means to check', () => {
    expect(fab.length).toBeGreaterThan(1000);
    expect(layout).toContain('QuickActionsFab');
  });

  it('emergency diagnose navigates to the already-public lab — no auth bypass', () => {
    // The long-press is a shortcut, not a key: /lab is a public route by
    // design (the guest lane). The FAB must not touch auth state to get there.
    expect(fab).toMatch(/navigate\('\/lab'\)/);
    expect(fab).not.toMatch(/auth_token|signOut|removeItem\('botanical/);
  });

  it('water all goes through the shared watering core', () => {
    // The one write of the watering triple lives in PlantService.waterPlant;
    // the FAB must not re-derive the fields inline, and "thirsty" must be
    // the same pure predicate the reminder engine uses.
    expect(fab).toMatch(/PlantService\.waterPlant\(plant\.id/);
    expect(fab).toMatch(/wateringDue\(p, now\)/);
    const plantService = stripJsComments(readSource('src/services/plantService.ts'));
    expect(plantService).toMatch(/async waterPlant\(/);
    expect(plantService).toMatch(/wateringIntervalDays \?\? 7/);
  });

  it('the due badge is a live query, not a snapshot', () => {
    expect(fab).toMatch(/useLiveQuery/);
  });

  it('eco mode flattens the animation', () => {
    expect(fab).toMatch(/shouldDisableAnimations/);
  });

  it('placement persists and dismissal stays in the session', () => {
    expect(fab).toContain("localStorage.setItem(POS_KEY");
    expect(fab).toContain("sessionStorage.setItem(DISMISS_KEY");
    // Ctrl+K re-summons: dismissal is never a trap.
    expect(fab).toMatch(/sessionStorage\.removeItem\(DISMISS_KEY\)/);
  });
});
