import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';
import { vitalityAfterWatering } from '../environmentalSimulation';

/**
 * Structural and logic tests for:
 * 1. POST /api/plants/:id/water and lock-screen push action buttons
 * 2. Treatment roadmap milestone push reminders daemon
 * 3. Daily DB retention cleanup maintenance daemon
 */

const serverSource = stripJsComments(readSource('server.ts'));
const swSource = stripJsComments(readSource('public/sw.js'));

describe('Lock-screen push action & plant watering endpoint', () => {
  it('the scan found all relevant sources to check', () => {
    expect(serverSource.length).toBeGreaterThan(100);
    expect(swSource.length).toBeGreaterThan(100);
  });

  it('registers the authenticated POST /api/plants/:id/water endpoint', () => {
    expect(serverSource).toMatch(/app\.post\(\s*["']\/api\/plants\/:id\/water["']/);
    // Verified to be guarded with apiGate
    expect(serverSource).toMatch(/app\.post\(\s*["']\/api\/plants\/:id\/water["'],\s*express\.json\([^)]*\),\s*apiGate/);
  });

  it('uses vitalityAfterWatering to compute guardian score and updates plant records', () => {
    expect(serverSource).toMatch(/const\s+newScore\s*=\s*vitalityAfterWatering\(/);
    expect(serverSource).toMatch(/last_watered_at:\s*lastWateredAt/);
    expect(serverSource).toMatch(/next_water_due:\s*nextWaterDue/);
    expect(serverSource).toMatch(/guardian_score:\s*newScore/);
    expect(serverSource).toMatch(/res\.json\(\s*\{\s*ok:\s*true,\s*nextWaterDue,\s*newScore\s*\}\s*\)/);
  });

  it('logs watering action in push_alert_log with kind watering-action', () => {
    expect(serverSource).toMatch(/from\(['"]push_alert_log['"]\)\.insert\(\s*\{[\s\S]*?kind:\s*['"]watering-action['"]/);
  });

  it('enriches watering reminder push payload with plantId and mark-watered action', () => {
    expect(serverSource).toMatch(/plantId:\s*first\.id/);
    expect(serverSource).toMatch(/actions:\s*\[\s*\{\s*action:\s*['"]mark-watered['"]/);
  });

  it('service worker binds notification actions and handles mark-watered in background', () => {
    expect(swSource).toMatch(/actions:\s*data\.actions\s*\|\|\s*\[\]/);
    expect(swSource).toMatch(/plantId:\s*data\.plantId\s*\|\|\s*null/);
    expect(swSource).toMatch(/if\s*\(event\.action\s*===\s*['"]mark-watered['"]\)/);
    expect(swSource).toMatch(/fetch\(`\/api\/plants\/\$\{plantId\}\/water`/);
    expect(swSource).toMatch(/credentials:\s*['"]include['"]/);
  });

  it('vitalityAfterWatering correctly updates score across edge cases', () => {
    expect(vitalityAfterWatering(null)).toBe(52);
    expect(vitalityAfterWatering(undefined)).toBe(52);
    expect(vitalityAfterWatering(50)).toBe(52);
    expect(vitalityAfterWatering(99)).toBe(100);
    expect(vitalityAfterWatering(100)).toBe(100);
    expect(vitalityAfterWatering(0)).toBe(2);
    expect(vitalityAfterWatering(-5)).toBe(0);
  });
});

describe('Treatment roadmap milestone push reminders daemon', () => {
  it('defines runTreatmentRoadmapReminders', () => {
    expect(serverSource).toMatch(/async\s+function\s+runTreatmentRoadmapReminders\s*\(\s*\)/);
  });

  it('queries plants with non-null recovery_roadmap and parses timeline', () => {
    expect(serverSource).toMatch(/\.from\(['"]plants['"]\)\s*\.select\(['"][^'"]*recovery_roadmap[^'"]*['"]\)/);
    expect(serverSource).toMatch(/roadmap\.timeline/);
  });

  it('throttles milestones using push_alert_log kind treatment-d{N}', () => {
    expect(serverSource).toMatch(/kindKey\s*=\s*`treatment-d\$\{dayNum\}`/);
    expect(serverSource).toMatch(/push_alert_log/);
  });

  it('wires treatment roadmap reminders into scheduleWateringReminders', () => {
    expect(serverSource).toMatch(/await\s+runWateringReminders\(\);/);
    expect(serverSource).toMatch(/await\s+runTreatmentRoadmapReminders\(\);/);
  });
});

describe('Automated DB retention cleanup daemon', () => {
  it('defines runDailyMaintenance and prunes 90d scan reports, 3d guest quota, and 30d push logs', () => {
    expect(serverSource).toMatch(/async\s+function\s+runDailyMaintenance\s*\(\s*\)/);
    // 90 days for scan_reports
    expect(serverSource).toMatch(/90\s*\*\s*86_400_000/);
    expect(serverSource).toMatch(/from\(['"]scan_reports['"]\)\s*\.delete/);
    // 3 days for guest_scan_quota
    expect(serverSource).toMatch(/3\s*\*\s*86_400_000/);
    expect(serverSource).toMatch(/from\(['"]guest_scan_quota['"]\)\s*\.delete/);
    // 30 days for push_alert_log
    expect(serverSource).toMatch(/30\s*\*\s*86_400_000/);
    expect(serverSource).toMatch(/from\(['"]push_alert_log['"]\)\s*\.delete/);
  });

  it('schedules daily maintenance with unref timers and triggers at boot', () => {
    expect(serverSource).toMatch(/function\s+scheduleDailyMaintenance\s*\(\s*\)/);
    expect(serverSource).toMatch(/setTimeout\(tick,\s*30_000\)\.unref\(\)/);
    expect(serverSource).toMatch(/scheduleDailyMaintenance\(\)/);
  });
});
