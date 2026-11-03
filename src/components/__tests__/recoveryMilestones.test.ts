import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The advancement plan's gaps were filled with specific mechanics, and each
 * mechanic is a decision a tidy refactor could quietly undo. These scans pin
 * them at the source level, the same way routeGates and formLabels do.
 */

const checkInFlow = stripJsComments(readSource('src/components/CheckInFlow.tsx'));
const streakPopup = stripJsComments(readSource('src/components/game/StreakPopup.tsx'));
const types = stripJsComments(readSource('src/types.ts'));
const geminiService = stripJsComments(readSource('src/services/geminiService.ts'));
const lab = stripJsComments(readSource('src/pages/BotanicalLab.tsx'));
const rewards = stripJsComments(readSource('src/components/game/RewardNotification.tsx'));

describe('recovery milestones', () => {
  it('the scan found the files it means to check', () => {
    expect(checkInFlow.length).toBeGreaterThan(1000);
    expect(streakPopup.length).toBeGreaterThan(500);
  });

  it('once-ness lives on the plant record, not a new Dexie table', () => {
    // Optional field on Plant — no schema bump, existing records read as undefined.
    expect(types).toMatch(/milestoneLog\?\s*:\s*\{\s*kind:\s*string;\s*at:\s*string\s*\}\s*\[\]/);
  });

  it('celebrates exactly the four plan milestones, once each', () => {
    // Detection lives in rewardService (pure, unit-tested); the flow wires it.
    const rewardService = stripJsComments(readSource('src/services/rewardService.ts'));
    for (const kind of ['first_improvement', 'halfway', 'recovered', 'anniversary']) {
      expect(rewardService, `missing milestone kind ${kind}`).toContain(`'${kind}'`);
    }
    // The dedupe set is built from the log before any milestone can fire.
    expect(checkInFlow).toMatch(/new Set\(\(plant\.milestoneLog \|\| \[\]\)\.map/);
    expect(checkInFlow).toContain('detectRecoveryMilestones');
  });

  it('pays milestone seeds through the idempotent ledger, keyed per check-in', () => {
    // The amount comes from RECOVERY_MILESTONES metadata; the idempotency
    // key ${checkInId}:${kind} keeps a retried check-in from double-paying.
    expect(checkInFlow).toMatch(/earnSeeds\(RECOVERY_MILESTONES\[kind\]\.seeds,\s*'checkin',[\s\S]*?\$\{checkInId\}:\$\{kind\}/);
  });

  it('never blocks the check-in on a celebration failure', () => {
    expect(checkInFlow).toMatch(/milestone celebration failed/);
  });
});

describe('streak heatmap', () => {
  it('computes from existing check-ins — no new table, no new writes', () => {
    // Key-only reads over the compound index: check-in rows carry the raw
    // photo Blob, and the heatmap must not materialise a month of them.
    expect(streakPopup).toContain("where('[plantId+timestamp]')");
    expect(streakPopup).toContain('.keys()');
    expect(streakPopup).not.toMatch(/loginHistory/);
  });

  it('draws a 30-day grid with today ringed', () => {
    expect(streakPopup).toContain('grid-cols-10');
    expect(streakPopup).toContain('i === 29');
    expect(streakPopup).toMatch(/aria-label="Check-ins over the last 30 days"/);
  });

  it('the milestone log survives Supabase round-trips', () => {
    const plantService = stripJsComments(readSource('src/services/plantService.ts'));
    // Both merge sites preserve the client-only field, or fetchPlants wipes
    // it and every milestone re-fires and re-pays on the next check-in.
    expect(plantService.match(/milestoneLog/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('scan hardening', () => {
  it('identifyPlant is single-flight', () => {
    expect(geminiService).toMatch(/identifyInFlight/);
    expect(geminiService).toContain('A scan is already running');
  });

  it('identifyPlant consults the result cache before the in-flight guard', () => {
    // A cached verdict is instant and must not be blocked by an unrelated
    // scan still running — so the cache lookup has to come first in the body.
    expect(geminiService).toMatch(/const cached = scanCache\.get\(cacheKey\)/);
    expect(geminiService).toMatch(/scanCache\.put\(cacheKey, result\)/);
    expect(geminiService.indexOf('scanCache.get(cacheKey)')).toBeLessThan(
      geminiService.indexOf('identifyInFlight = true')
    );
    // Cache hits are logged — quota saved without a trace is invisible.
    expect(geminiService).toContain('scan cache hit');
  });

  it('a failed scan keeps the photo and offers a real retry', () => {
    // The catch no longer wipes the mounted image…
    expect(lab).toMatch(/runIdentifyOnPrepared/);
    expect(lab).toMatch(/retryDexScan/);
    // …and the error card surfaces the actual failure, not stand-in copy.
    expect(lab).toContain('{scanError}');
    expect(lab).not.toContain('Could not analyse plant — please try again');
  });

  it('the scan overlay is a real progressbar', () => {
    expect(lab).toMatch(/role="progressbar"/);
    expect(lab).toMatch(/aria-valuenow=/);
  });

  it('both diagnosis flows classify failures and offer a support handoff', () => {
    const clinic = stripJsComments(readSource('src/pages/Clinic.tsx'));
    // Shared classifier, not two private copies of the same ladder.
    expect(clinic).toContain('classifyScanError');
    expect(lab).toContain('classifyScanError');
    // Both surfaces can hand the failure to support with details attached.
    expect(clinic).toContain('Contact Support');
    expect(lab).toContain('Contact Support');
    // Console context names the bucket — the raw error alone says nothing
    // about which recovery path the Keeper was offered.
    expect(lab).toMatch(/console\.error\('\[lab\] identify failed'/);
    expect(clinic).toMatch(/console\.error\('\[clinic\] diagnosis failed'/);
  });
});

describe('reward celebration tiers', () => {
  it('confetti scales with the payout and stays quiet for small rewards', () => {
    expect(rewards).toMatch(/seeds >= 100/);
    expect(rewards).toMatch(/seeds >= 50/);
    expect(rewards).toMatch(/useEcoMode\(\)/);
  });
});

describe('advancement leftovers', () => {
  const phytoCard = stripJsComments(readSource('src/components/game/PhytoCard.tsx'));
  const gallery = stripJsComments(readSource('src/components/home/PlantGallery.tsx'));
  const gameService = stripJsComments(readSource('src/services/gameService.ts'));
  const telemetry = stripJsComments(readSource('src/components/scan/PlantTelemetryCard.tsx'));

  it('the scan found the files it means to check', () => {
    expect(phytoCard.length).toBeGreaterThan(1000);
    expect(gallery.length).toBeGreaterThan(1000);
    expect(gameService.length).toBeGreaterThan(1000);
    expect(telemetry.length).toBeGreaterThan(1000);
  });

  it('tier and cosmetics writes commit atomically', () => {
    // upgradeToPro: the subscription row and the profile tier land together,
    // or neither does — either half alone misstates what was paid for.
    expect(gameService).toMatch(/db\.transaction\('rw',\s*\[db\.subscriptions,\s*db\.userProfile\]/);
    // equipItem: featured frame, unequip siblings, equip, profile title.
    expect(gameService).toMatch(/db\.transaction\('rw',\s*\[db\.cards,\s*db\.cosmetics,\s*db\.userProfile\]/);
  });

  it('the scan result decomposes confidence into factors the model produced', () => {
    // Subject clarity and the separation between the top two differentials —
    // read off the report, never invented.
    expect(telemetry).toMatch(/Subject clarity:/);
    expect(telemetry).toMatch(/Lead over runner-up:/);
    expect(telemetry).toContain('separationPct');
    expect(telemetry).toContain('subjectPct');
  });

  it('the Clinic brass scale hosts the factor breakdown, tooltips included', () => {
    const clinic = stripJsComments(readSource('src/pages/Clinic.tsx'));
    // Four factors, all sourced: two measured on-device, two from the model.
    for (const label of ['Photo Sharpness', 'Exposure', 'Species Match', 'Symptom Clarity']) {
      expect(clinic, `missing factor ${label}`).toContain(label);
    }
    // Every factor explains itself on hover, not just when it fails.
    expect(clinic).toMatch(/title=\{f\.tooltip\}/);
    // The breakdown collapses into the scale itself, not beside it.
    expect(clinic).toMatch(/<AntiqueBrassScale confidencePct=\{ConfidencePct\}>/);
    expect(clinic).toContain('subjectClarityPct={identification?.subject?.confidencePct ?? null}');
  });

  it('PhytoCard opens no live queries; the page reads cosmetics once', () => {
    // Zero subscriptions in the card: every card on a page wears the same
    // theme and flair, so any per-card query is N identical reads. The card
    // is purely presentational and imports no Dexie at all.
    expect(phytoCard).not.toContain('useLiveQuery');
    expect(phytoCard).not.toContain('dexie-react-hooks');
    // The one shared subscription lives in the page: theme + flair from a
    // single indexed read, keyed on the card record's owner id.
    expect(checkInFlow).toMatch(/db\.cosmetics\.where\('userId'\)/);
    // Cosmetic flags are booleans at write time — the old `equipped: 1`
    // comparison never matched a true, leaving theme and flair inert.
    expect(phytoCard).not.toMatch(/equipped:\s*1/);
    expect(checkInFlow).not.toMatch(/equipped:\s*1/);
    // Memoized against unrelated DB writes.
    expect(phytoCard).toContain('React.memo(PhytoCard)');
  });

  it('the check-in row and plant rewrite commit together', () => {
    expect(checkInFlow).toMatch(/db\.transaction\('rw',\s*\[db\.checkins,\s*db\.plants\]/);
  });

  it('gallery cards carry a diagnose quick action that reaches the lab', () => {
    expect(gallery).toMatch(/aria-label=\{`Diagnose \$\{plant\.nickname\} in the lab`\}/);
    // Deep-link: the pathology bench takes a plantId preselect, so the card's
    // own specimen is the one under the lens when it lands.
    expect(gallery).toContain('navigate(`/lab?tab=pathology&plantId=${plant.id}`)');
    // Touch shows it always; desktop reveals on hover — never an invisible target.
    expect(gallery).toMatch(/opacity-100 sm:opacity-0 sm:group-hover:opacity-100/);
  });
});
