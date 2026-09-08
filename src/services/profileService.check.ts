import assert from 'node:assert';
import {
  evaluateProfileBadges,
  calculateLevelProgression,
  getStreakMultiplier,
  formatFolioSerial,
  parseSettingToggle,
  type ProfileBadgeCriteria,
  type ProfileBadgeStatus
} from './profileUtils';


export async function runProfileSelfChecks() {
  console.log('--- Running Profile & Fellowship Ledger Self-Checks ---');

  // 1. XP-to-level curve verification
  console.log('1. Testing XP-to-Level Progression Curve...');
  const lvl0 = calculateLevelProgression(0);
  assert.strictEqual(lvl0.currentLevel, 1, '0 XP must map to Level 1');
  assert.strictEqual(lvl0.title, 'Sprout');
  assert.strictEqual(lvl0.xpProgress, 0);
  assert.strictEqual(lvl0.xpToNext, 100);
  assert.strictEqual(lvl0.isMaxLevel, false);

  const lvl50 = calculateLevelProgression(50);
  assert.strictEqual(lvl50.currentLevel, 1, '50 XP must remain at Level 1');
  assert.strictEqual(lvl50.xpProgress, 50, '50 XP should be 50% to Level 2 (100 XP required)');
  assert.strictEqual(lvl50.xpToNext, 50);

  const lvl100 = calculateLevelProgression(100);
  assert.strictEqual(lvl100.currentLevel, 2, '100 XP must level up to Level 2');
  assert.strictEqual(lvl100.title, 'Germinator');
  assert.strictEqual(lvl100.xpProgress, 0, '100 XP exactly starts Level 2 at 0%');

  const lvl175 = calculateLevelProgression(175);
  assert.strictEqual(lvl175.currentLevel, 2, '175 XP is Level 2');
  // Level 2 span: 100 to 250 (span 150). (175 - 100) / 150 = 75 / 150 = 50%
  assert.strictEqual(lvl175.xpProgress, 50);
  assert.strictEqual(lvl175.xpToNext, 75);

  const lvl700 = calculateLevelProgression(700);
  assert.strictEqual(lvl700.currentLevel, 5, '700 XP must reach Level 5');
  assert.strictEqual(lvl700.title, 'Leaf-Bearer');

  // Max level cap and beyond
  console.log('1b. Testing Level 25 Max Cap and Post-Cap Progression...');
  const lvlCap = calculateLevelProgression(43000);
  assert.strictEqual(lvlCap.currentLevel, 25, '43,000 XP must reach max Level 25');
  assert.strictEqual(lvlCap.title, 'Eternal Bloom');
  assert.strictEqual(lvlCap.xpProgress, 100, 'Max level must pin progress at 100%');
  assert.strictEqual(lvlCap.xpToNext, 0, 'Max level must have 0 XP to next');
  assert.strictEqual(lvlCap.isMaxLevel, true);

  const lvlBeyond = calculateLevelProgression(65000);
  assert.strictEqual(lvlBeyond.currentLevel, 25, '65,000 XP must remain at max Level 25');
  assert.strictEqual(lvlBeyond.xpProgress, 100);
  assert.strictEqual(lvlBeyond.xpToNext, 0);
  assert.strictEqual(lvlBeyond.isMaxLevel, true);
  assert.strictEqual(lvlBeyond.nextTitle, 'Guild Master Supreme');

  // Boundary / Degenerate numeric inputs
  console.log('1c. Testing Negative and NaN XP Resilience...');
  const lvlNeg = calculateLevelProgression(-250);
  assert.strictEqual(lvlNeg.currentLevel, 1, 'Negative XP must safely clamp to Level 1');
  assert.strictEqual(lvlNeg.totalXP, 0);

  const lvlNaN = calculateLevelProgression(NaN);
  assert.strictEqual(lvlNaN.currentLevel, 1, 'NaN XP must safely clamp to Level 1');
  assert.strictEqual(lvlNaN.totalXP, 0);
  assert.strictEqual(lvlNaN.xpProgress, 0);

  // 2. Badge unlocking criteria
  console.log('2. Testing Badge Unlocking Criteria & Boundaries...');
  const noviceBadges = evaluateProfileBadges({
    currentStreak: 2,
    cardCount: 1,
    tier: 'free',
    totalXP: 25,
    mythicCount: 0
  });
  assert.strictEqual(noviceBadges.find(b => b.id === 'week_one')?.unlocked, false);
  assert.strictEqual(noviceBadges.find(b => b.id === 'collector')?.unlocked, false);
  assert.strictEqual(noviceBadges.find(b => b.id === 'scholar_pro')?.unlocked, false);
  assert.strictEqual(noviceBadges.find(b => b.id === 'advancer')?.unlocked, false);
  assert.strictEqual(noviceBadges.find(b => b.id === 'centurion')?.unlocked, false);
  assert.strictEqual(noviceBadges.find(b => b.id === 'mythic_patron')?.unlocked, false);

  // Strict boundary checks
  const boundary6 = evaluateProfileBadges({ currentStreak: 6, cardCount: 4, tier: 'free', totalXP: 99, mythicCount: 0 });
  assert.strictEqual(boundary6.find(b => b.id === 'week_one')?.unlocked, false, 'Streak of 6 days should not unlock week_one');
  assert.strictEqual(boundary6.find(b => b.id === 'collector')?.unlocked, false, '4 cards should not unlock collector');
  assert.strictEqual(boundary6.find(b => b.id === 'centurion')?.unlocked, false, '99 XP should not unlock centurion');

  const boundary7 = evaluateProfileBadges({ currentStreak: 7, cardCount: 5, tier: 'pro', totalXP: 100, mythicCount: 1 });
  assert.strictEqual(boundary7.find(b => b.id === 'week_one')?.unlocked, true, 'Streak of 7 days unlocks week_one');
  assert.strictEqual(boundary7.find(b => b.id === 'collector')?.unlocked, true, '5 cards unlocks collector');
  assert.strictEqual(boundary7.find(b => b.id === 'scholar_pro')?.unlocked, true, 'pro tier unlocks scholar_pro');
  assert.strictEqual(boundary7.find(b => b.id === 'centurion')?.unlocked, true, '100 XP unlocks centurion');
  assert.strictEqual(boundary7.find(b => b.id === 'advancer')?.unlocked, false, '100 XP should not unlock advancer');
  assert.strictEqual(boundary7.find(b => b.id === 'mythic_patron')?.unlocked, true, '1 mythic unlocks mythic_patron');

  const veteranBadges = evaluateProfileBadges({
    currentStreak: 8,
    cardCount: 6,
    tier: 'pro',
    totalXP: 1200,
    mythicCount: 1
  });
  assert.strictEqual(veteranBadges.find(b => b.id === 'week_one')?.unlocked, true);
  assert.strictEqual(veteranBadges.find(b => b.id === 'collector')?.unlocked, true);
  assert.strictEqual(veteranBadges.find(b => b.id === 'scholar_pro')?.unlocked, true);
  assert.strictEqual(veteranBadges.find(b => b.id === 'advancer')?.unlocked, true);
  assert.strictEqual(veteranBadges.find(b => b.id === 'centurion')?.unlocked, true);
  assert.strictEqual(veteranBadges.find(b => b.id === 'mythic_patron')?.unlocked, true);

  // 3. Streak and passport visa calculations
  console.log('3. Testing Passport Visa & Streak Multipliers...');
  assert.strictEqual(getStreakMultiplier(-5), 1.0, 'Negative streak days return 1.0');
  assert.strictEqual(getStreakMultiplier(NaN), 1.0, 'NaN streak days return 1.0');
  assert.strictEqual(getStreakMultiplier(0), 1.0);
  assert.strictEqual(getStreakMultiplier(3), 1.0);
  assert.strictEqual(getStreakMultiplier(6), 1.0);
  assert.strictEqual(getStreakMultiplier(7), 2.0);
  assert.strictEqual(getStreakMultiplier(10), 2.0);
  assert.strictEqual(getStreakMultiplier(13), 2.0);
  assert.strictEqual(getStreakMultiplier(14), 2.5);
  assert.strictEqual(getStreakMultiplier(29), 2.5);
  assert.strictEqual(getStreakMultiplier(30), 3.0);
  assert.strictEqual(getStreakMultiplier(59), 3.0);
  assert.strictEqual(getStreakMultiplier(60), 3.5);
  assert.strictEqual(getStreakMultiplier(65), 3.5);
  assert.strictEqual(getStreakMultiplier(99), 3.5);
  assert.strictEqual(getStreakMultiplier(100), 5.0);
  assert.strictEqual(getStreakMultiplier(105), 5.0);

  // 4. Folio serial formatting
  console.log('4. Testing Passport Folio Serial Generator...');
  const serial1 = formatFolioSerial('local_user');
  const serial2 = formatFolioSerial('local_user');
  assert.strictEqual(serial1, serial2, 'Folio serial must be deterministic for the same user ID');
  assert.ok(serial1.startsWith('FOLIO-') && serial1.endsWith('-GM'), 'Serial format must conform to official standard');
  assert.strictEqual(formatFolioSerial(''), 'FOLIO-0182-GM', 'Empty string must fall back gracefully to default hash');
  assert.strictEqual(formatFolioSerial(null), 'FOLIO-0182-GM', 'null must fall back gracefully to default hash');

  // 5. Settings toggle serialization
  console.log('5. Testing Audio/Haptic/Notification Toggle Parsers...');
  assert.strictEqual(parseSettingToggle(null, true), true);
  assert.strictEqual(parseSettingToggle(null, false), false);
  assert.strictEqual(parseSettingToggle(undefined, true), true);
  assert.strictEqual(parseSettingToggle('true'), true);
  assert.strictEqual(parseSettingToggle('false'), false);
  assert.strictEqual(parseSettingToggle('invalid'), false);

  console.log('All Profile & Fellowship Ledger self-checks passed successfully!');
  return true;
}

// Auto-run if executed directly via tsx
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('profileService.check.ts')) {
  runProfileSelfChecks().catch(err => {
    console.error('Self-check failed:', err);
    process.exit(1);
  });
}
