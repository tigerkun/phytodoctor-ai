import assert from 'node:assert';
import { isValidEmail, evaluatePasswordStrength, generateLocalUserId } from './authUtils';

export function runAuthChecks() {
  console.log('--- Running Sanctuary Gatekeeper Auth Self-Checks ---');

  // 1. Email validation
  assert.strictEqual(isValidEmail('gardener@kew.org'), true);
  assert.strictEqual(isValidEmail('botanist.fellow@sanctuary.botanic'), true);
  assert.strictEqual(isValidEmail('invalid-email'), false);
  assert.strictEqual(isValidEmail('missing@domain'), false);
  assert.strictEqual(isValidEmail(''), false);

  // 2. Password strength scoring
  const weak = evaluatePasswordStrength('short');
  assert.strictEqual(weak.score, 0);
  assert.strictEqual(weak.isFullyValid, false);

  const medium = evaluatePasswordStrength('longerthan');
  assert.strictEqual(medium.score, 1);
  assert.strictEqual(medium.isFullyValid, false);

  const almost = evaluatePasswordStrength('LongerThanWord');
  assert.strictEqual(almost.score, 2);
  assert.strictEqual(almost.isFullyValid, false);

  const strong = evaluatePasswordStrength('Sanctuary2026');
  assert.strictEqual(strong.score, 3);
  assert.strictEqual(strong.isFullyValid, true);

  // 3. User ID generation consistency
  const id1 = generateLocalUserId('Botanist@Sanctuary.org');
  const id2 = generateLocalUserId('botanist@sanctuary.org');
  assert.strictEqual(id1, id2, 'Email should be normalized to lowercase');
  assert(!id1.includes('='), 'Padding characters should be stripped');

  console.log('All Sanctuary Gatekeeper Auth self-checks passed successfully!');
  return { success: true, count: 3 };
}

if (process.argv[1]?.includes('authService.check')) {
  runAuthChecks();
}
