import assert from 'node:assert';
import { GameService } from './gameService';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function checkQuarantine(severity: number, healthStatus: string): boolean {
  if (severity >= 3) return true;
  const hs = (healthStatus || '').toLowerCase();
  return hs.includes('diseas') || hs.includes('infest');
}

function calcNeedleAngle(confidencePct: number): number {
  const pct = clamp(confidencePct, 10, 100);
  return ((pct - 50) / 50) * 24;
}

function calcBeamTilt(confidencePct: number): number {
  const pct = clamp(confidencePct, 10, 100);
  return clamp(((pct - 50) / 50) * 5, -5, 5);
}

function resolveCertainty(id: { confidence?: number; differentialDiagnosis?: Array<{ confidence: number }> } | null): number {
  if (!id) return 0;
  if (typeof id.confidence === 'number') return clamp(id.confidence, 0, 100);
  const topDiff = id.differentialDiagnosis?.[0];
  if (topDiff && typeof topDiff.confidence === 'number') {
    return clamp(topDiff.confidence, 0, 100);
  }
  return 88;
}

async function runCheck() {
  console.log('Running clinic triage & dispensary assert-based self-check...');

  // 1. Check health status scoring
  const healthyScore = GameService.scoreFromScan('Healthy', 1);
  assert(healthyScore >= 80, `Healthy specimen should have score >= 80, got ${healthyScore}`);

  const stressedScore = GameService.scoreFromScan('Stressed', 3);
  assert(stressedScore <= 70, `Stressed specimen should have reduced score, got ${stressedScore}`);

  const diseasedScore = GameService.scoreFromScan('Diseased', 4);
  assert(diseasedScore <= 50, `Diseased specimen should have score <= 50, got ${diseasedScore}`);

  const infestedScore = GameService.scoreFromScan('Infested', 5);
  assert(infestedScore <= 35, `Infested specimen should have score <= 35, got ${infestedScore}`);

  // 2. Hazard quarantine logic verification
  assert.strictEqual(checkQuarantine(3, 'Stressed'), true, 'Severity 3 must trigger quarantine');
  assert.strictEqual(checkQuarantine(4, 'Diseased'), true, 'Severity 4 must trigger quarantine');
  assert.strictEqual(checkQuarantine(5, 'Infested'), true, 'Severity 5 must trigger quarantine');
  assert.strictEqual(checkQuarantine(1, 'Healthy'), false, 'Severity 1 healthy specimen must not trigger quarantine');
  assert.strictEqual(checkQuarantine(2, 'Healthy'), false, 'Severity 2 healthy specimen must not trigger quarantine');
  assert.strictEqual(checkQuarantine(1, 'Infested specimen'), true, 'Infested keyword must trigger quarantine');
  assert.strictEqual(checkQuarantine(2, 'Fungal Disease'), true, 'Diseased keyword must trigger quarantine');

  // 3. Certainty scale clamping
  assert.strictEqual(clamp(95, 10, 100), 95);
  assert.strictEqual(clamp(5, 10, 100), 10);
  assert.strictEqual(clamp(105, 10, 100), 100);

  // 4. Antique Brass Scale needle angle & beam tilt calculations
  assert.strictEqual(calcNeedleAngle(50), 0, 'Center 50% must yield vertical needle angle 0');
  assert.strictEqual(calcNeedleAngle(100), 24, 'Maximum certainty 100% must yield +24 deg sweep');
  assert.ok(Math.abs(calcNeedleAngle(10) - (-19.2)) < 1e-6, 'Low certainty 10% must yield -19.2 deg sweep');

  assert.strictEqual(calcBeamTilt(50), 0, 'Center 50% must yield 0 beam tilt');
  assert.strictEqual(calcBeamTilt(100), 5, 'Maximum certainty must clamp beam tilt to +5 deg');
  assert.strictEqual(calcBeamTilt(10), -4, 'Minimum clamped certainty must yield negative beam tilt');

  // 5. Dynamic certainty resolution
  assert.strictEqual(resolveCertainty(null), 0, 'Null identification must yield 0');
  assert.strictEqual(resolveCertainty({ confidence: 92 }), 92, 'Top level confidence must be respected');
  assert.strictEqual(resolveCertainty({ differentialDiagnosis: [{ confidence: 84 }] }), 84, 'Differential diagnosis fallback must be used');
  assert.strictEqual(resolveCertainty({}), 88, 'Baseline fallback must be 88%');

  // 6. Score to Status mapping
  const getStatus = (score: number) => score >= 80 ? 'Stable' : score >= 55 ? 'Watching' : score >= 35 ? 'Recovering' : 'Alert';
  assert.strictEqual(getStatus(healthyScore), 'Stable');
  assert.strictEqual(getStatus(stressedScore), 'Watching');
  assert.strictEqual(getStatus(diseasedScore), 'Recovering');
  assert.strictEqual(getStatus(infestedScore), 'Alert');

  console.log('✓ All clinic triage & dispensary checks passed successfully.');
}

runCheck().catch((err) => {
  console.error('✗ clinic triage check failed:', err);
  process.exit(1);
});
