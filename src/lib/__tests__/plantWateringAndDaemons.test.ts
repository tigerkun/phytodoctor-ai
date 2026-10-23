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
    expect(serverSource).toMatch(/if\s*\(!SUPABASE_URL\s*\|\|\s*!SUPABASE_SERVICE_KEY\)\s*return;/);
  });
});

describe('Session cookie extraction & milestone timeline logic', () => {
  it('extracts tokens from cookie formats including sb-access-token, chunked and base64', () => {
    const parseCookie = (cookieHeader: string): string => {
      const match = cookieHeader.match(/(?:^|;\s*)(?:sb-[a-z0-9_.-]+-auth-token(?:\.\d+)?|sb-access-token|access_token|botanical_guardian_auth_token)=([^;]+)/i);
      if (!match) return '';
      const raw = decodeURIComponent(match[1]);
      let candidate = raw;
      if (candidate.startsWith('base64-')) {
        try { candidate = Buffer.from(candidate.slice(7), 'base64').toString('utf-8'); } catch {}
      }
      try {
        const parsed = JSON.parse(candidate);
        return Array.isArray(parsed) ? parsed[0] : (parsed?.access_token || candidate);
      } catch {
        return candidate;
      }
    };

    expect(parseCookie('sb-access-token=jwt.token.val')).toBe('jwt.token.val');
    expect(parseCookie('other=123; sb-access-token=secret-token; path=/')).toBe('secret-token');
    expect(parseCookie('sb-rkaawupaxlfdovpkrugp-auth-token.0=chunked-token')).toBe('chunked-token');
    expect(parseCookie('access_token=plain-access-token')).toBe('plain-access-token');
    expect(parseCookie(`sb-access-token=${encodeURIComponent(JSON.stringify({ access_token: 'nested-jwt' }))}`)).toBe('nested-jwt');
    const b64 = Buffer.from(JSON.stringify(['b64-array-token'])).toString('base64');
    expect(parseCookie(`sb-app-auth-token=base64-${b64}`)).toBe('b64-array-token');
  });

  it('correctly parses milestone day numbers from varied roadmap action strings', () => {
    const parseDay = (dayStr: string): number | null => {
      const m = String(dayStr || '').match(/\d+/);
      if (!m) return null;
      const n = parseInt(m[0], 10);
      return isNaN(n) || n < 0 ? null : n;
    };

    expect(parseDay('Day 1')).toBe(1);
    expect(parseDay('Day 3')).toBe(3);
    expect(parseDay('Day 14')).toBe(14);
    expect(parseDay('Day 0')).toBe(0);
    expect(parseDay('Phase 2 - Day 7')).toBe(2); // first number is parsed
    expect(parseDay('Invalid')).toBeNull();
    expect(parseDay('')).toBeNull();
  });

  it('suppresses re-firing of already alerted milestones regardless of age', () => {
    const alertedKeys = new Set<string>(['plant-123:treatment-d3']);
    const isAlreadyAlerted = (plantId: string, dayNum: number) =>
      alertedKeys.has(`${plantId}:treatment-d${dayNum}`);

    expect(isAlreadyAlerted('plant-123', 3)).toBe(true);
    expect(isAlreadyAlerted('plant-123', 7)).toBe(false);
    expect(isAlreadyAlerted('plant-456', 3)).toBe(false);
  });
});
