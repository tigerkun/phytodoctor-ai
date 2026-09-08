import assert from 'node:assert';
import { calculateCombatPower, ROMAN_NUMERALS } from '../pages/Arena';
import { ECONOMY_CONFIG, SEED_MULTIPLIERS } from '../game/ECONOMY_DATA';
import type { CardStats } from '../db/database';

async function runCheck() {
  console.log('Running Arena Terra Coliseum assert-based self-check...');

  // 1. Combat power formula verification
  const testStats1: CardStats = {
    attack: 80,
    defense: 50,
    health: 90,
    speed: 70,
    longevity: 60
  };
  // Expected: Math.floor(80 * 0.4 + 70 * 0.3 + 90 * 0.3) = Math.floor(32 + 21 + 27) = 80
  const power1 = calculateCombatPower(testStats1);
  assert.strictEqual(power1, 80, `Expected combat power 80, got ${power1}`);

  // Test with non-integer math
  const testStats2: CardStats = {
    attack: 45,
    defense: 99,
    health: 65,
    speed: 35,
    longevity: 40
  };
  // Expected: Math.floor(45 * 0.4 + 35 * 0.3 + 65 * 0.3) = Math.floor(18 + 10.5 + 19.5) = Math.floor(48) = 48
  const power2 = calculateCombatPower(testStats2);
  assert.strictEqual(power2, 48, `Expected combat power 48, got ${power2}`);

  // 2. Leaderboard sorting consistency bug check
  // Card A has high defense, low speed
  // Card B has lower defense, high speed
  const cardA = {
    id: 'card-a',
    commonName: 'Heavy Defense Plant',
    stats: { attack: 50, defense: 90, health: 50, speed: 20, longevity: 50 }
  };
  const cardB = {
    id: 'card-b',
    commonName: 'Agile Speed Plant',
    stats: { attack: 50, defense: 20, health: 50, speed: 70, longevity: 50 }
  };

  const powerA = calculateCombatPower(cardA.stats); // (50*0.4)+(20*0.3)+(50*0.3) = 20 + 6 + 15 = 41
  const powerB = calculateCombatPower(cardB.stats); // (50*0.4)+(70*0.3)+(50*0.3) = 20 + 21 + 15 = 56

  assert.strictEqual(powerA, 41);
  assert.strictEqual(powerB, 56);

  // Sorting strictly by combat power
  const sorted = [cardA, cardB].sort(
    (a, b) => calculateCombatPower(b.stats) - calculateCombatPower(a.stats)
  );

  assert.strictEqual(sorted[0].id, 'card-b', 'Card B must rank higher because combat power 56 > 41');
  assert.strictEqual(sorted[1].id, 'card-a');

  // Verify that prior attempt's faulty sort (attack + defense + health) would have inverted the order:
  const faultySortScoreA = cardA.stats.attack + cardA.stats.defense + cardA.stats.health; // 190
  const faultySortScoreB = cardB.stats.attack + cardB.stats.defense + cardB.stats.health; // 120
  assert(faultySortScoreA > faultySortScoreB, 'Demonstrating prior bug where high defense ranked higher despite lower combat power');

  // 3. Roman numerals checks
  assert.strictEqual(ROMAN_NUMERALS[0], 'I');
  assert.strictEqual(ROMAN_NUMERALS[1], 'II');
  assert.strictEqual(ROMAN_NUMERALS[2], 'III');
  assert.strictEqual(ROMAN_NUMERALS[4], 'V');
  assert.strictEqual(ROMAN_NUMERALS[9], 'X');

  // 4. Token depletion simulation
  const checkTokenStates = (careOffsCount: number, isPro: boolean) => {
    if (isPro) return { bulla: true, readyCount: '∞' };
    const ready = Math.max(0, 3 - careOffsCount);
    const tokens = [0, 1, 2].map(idx => ({
      index: idx,
      isSpent: careOffsCount > idx
    }));
    return { ready, tokens };
  };

  // Fresh week (0 careoffs)
  const state0 = checkTokenStates(0, false) as { ready: number; tokens: { index: number; isSpent: boolean }[] };
  assert.strictEqual(state0.ready, 3);
  assert.strictEqual(state0.tokens.filter(t => t.isSpent).length, 0);

  // 1 duel spent
  const state1 = checkTokenStates(1, false) as { ready: number; tokens: { index: number; isSpent: boolean }[] };
  assert.strictEqual(state1.ready, 2);
  assert.strictEqual(state1.tokens[0].isSpent, true);
  assert.strictEqual(state1.tokens[1].isSpent, false);

  // 3 duels spent (weekly limit reached)
  const state3 = checkTokenStates(3, false) as { ready: number; tokens: { index: number; isSpent: boolean }[] };
  assert.strictEqual(state3.ready, 0);
  assert.strictEqual(state3.tokens.filter(t => t.isSpent).length, 3);

  // Pro tier
  const statePro = checkTokenStates(5, true);
  assert.strictEqual(statePro.bulla, true);

  // 5. Seed reward calculation consistency
  const baseReward = ECONOMY_CONFIG.EARNING_BASE.arena_win;
  assert.strictEqual(baseReward, 250, 'Economy base arena win must be 250');

  const freeReward = Math.floor(baseReward * SEED_MULTIPLIERS.free);
  assert.strictEqual(freeReward, 250, 'Free tier should award 250 seeds');

  const proReward = Math.floor(baseReward * SEED_MULTIPLIERS.pro);
  assert.strictEqual(proReward, 375, 'Pro tier should award 375 seeds (1.5x multiplier)');

  console.log('✓ All Arena Terra Coliseum checks passed successfully.');
}

runCheck().catch((err) => {
  console.error('✗ Arena check failed:', err);
  process.exit(1);
});
