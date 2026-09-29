import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  isCurrentHashScheme,
  generateSalt,
} from '../authUtils';

const userId = 'dXNlckBheWxvYWRAdGVzdA'; // generateLocalUserId('user@payload.test')

async function legacySha256(uid: string, password: string, salt?: string) {
  const payload = salt ? `${uid}:${salt}:${password}` : `${uid}:${password}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('local password hashing', () => {
  it('produces a self-describing PBKDF2 hash with a distinct salt per account', async () => {
    const a = await hashPassword('Hunter2!A');
    const b = await hashPassword('Hunter2!A');

    expect(isCurrentHashScheme(a)).toBe(true);
    // Same password, different salts — the stored digests must not match.
    expect(a).not.toBe(b);
  });

  it('records the scheme and an iteration count above OWASP’s SHA-256 floor', async () => {
    const [, iterations] = (await hashPassword('Hunter2!A')).split('$');
    expect(Number(iterations)).toBeGreaterThanOrEqual(600_000);
  });

  it('accepts the correct password and rejects the wrong one', async () => {
    const stored = await hashPassword('Hunter2!A');
    expect(await verifyPassword(userId, 'Hunter2!A', stored)).toBe(true);
    expect(await verifyPassword(userId, 'Hunter2!B', stored)).toBe(false);
  });

  it('never stores the password itself', async () => {
    expect(await hashPassword('Hunter2!A')).not.toContain('Hunter2!A');
  });

  it('ignores a stale salt column once the hash carries its own', async () => {
    const stored = await hashPassword('Hunter2!A');
    // A leftover passwordSalt on the record must not break verification.
    expect(await verifyPassword(userId, 'Hunter2!A', stored, generateSalt())).toBe(true);
  });

  it('verifies a legacy salted SHA-256 account so it can be upgraded in place', async () => {
    const salt = generateSalt();
    const stored = await legacySha256(userId, 'OldPass1!', salt);

    expect(isCurrentHashScheme(stored)).toBe(false);
    expect(await verifyPassword(userId, 'OldPass1!', stored, salt)).toBe(true);
    expect(await verifyPassword(userId, 'Wrong!', stored, salt)).toBe(false);
  });

  it('verifies a legacy unsalted SHA-256 account', async () => {
    const stored = await legacySha256(userId, 'AncientPass1!');

    expect(await verifyPassword(userId, 'AncientPass1!', stored)).toBe(true);
    expect(await verifyPassword(userId, 'Nope!', stored)).toBe(false);
  });

  it('fails closed on a malformed current-scheme hash', async () => {
    expect(await verifyPassword(userId, 'Hunter2!A', 'pbkdf2-sha256$notanumber$salt$deadbeef')).toBe(false);
    expect(await verifyPassword(userId, 'Hunter2!A', 'pbkdf2-sha256$600000$onlythree')).toBe(false);
  });
});
