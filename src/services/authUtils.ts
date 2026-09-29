export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function evaluatePasswordStrength(password: string): {
  lengthValid: boolean;
  upperValid: boolean;
  numberValid: boolean;
  score: number;
  isFullyValid: boolean;
} {
  const lengthValid = password.length >= 8;
  const upperValid = /[A-Z]/.test(password);
  const numberValid = /[0-9]/.test(password);
  const score = [lengthValid, upperValid, numberValid].filter(Boolean).length;
  return {
    lengthValid,
    upperValid,
    numberValid,
    score,
    isFullyValid: lengthValid && upperValid && numberValid
  };
}

export function generateLocalUserId(email: string): string {
  const clean = email.toLowerCase().trim();
  if (typeof btoa !== 'undefined') {
    return btoa(clean).replace(/=/g, '');
  }
  return Buffer.from(clean).toString('base64').replace(/=/g, '');
}



/**
 * Per-user random salt (32 hex chars). Generated at signup and stored in
 * IndexedDB next to the password hash, so two users with the same password
 * (or the same email on different devices) never share a hash.
 */
export function generateSalt(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Iteration count for the local scheme. OWASP's floor for PBKDF2-HMAC-SHA256
 * is 600,000; this is deliberately higher because the work happens on the
 * user's own device at sign-in, where a few hundred milliseconds is a fair
 * price to make an offline crack of a stolen laptop far more expensive.
 */
const PBKDF2_ITERATIONS = 600_000;

/**
 * Hash format tag, stored as a prefix on the digest so a stored hash states
 * which scheme produced it. Verification reads the tag rather than guessing,
 * and Auth.tsx re-hashes with the current scheme after a successful legacy
 * sign-in, so every account migrates itself on its next login.
 */
const SCHEME = 'pbkdf2-sha256';

/**
 * The original scheme: one unsalted-or-salted SHA-256 over the password.
 * A single fast round is trivial to brute-force offline — roughly billions of
 * guesses per second on a GPU. Retained only to verify and then upgrade
 * accounts that predate PBKDF2; never used for a new signup.
 */
async function legacySha256(userId: string, password: string, salt?: string): Promise<string> {
  const payload = salt ? `${userId}:${salt}:${password}` : `${userId}:${password}`;
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)));
}

/**
 * Derive a key with PBKDF2-HMAC-SHA256 and return the iteration count and
 * salt alongside the digest, so a future iteration-count bump stays
 * verifiable without invalidating anyone's password.
 */
async function derivePbkdf2(password: string, salt: string, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

/**
 * Hash a password for local-only auth mode.
 *
 * Browser-native, zero deps. This is the fallback path used when Supabase is
 * not configured; Supabase (bcrypt, server-side) remains the real auth path
 * and is what production uses. Local hashing protects a shared device, not a
 * stolen database — a determined attacker with the raw device still gets the
 * password back, so the iteration count is the only defence here.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const digest = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  // The scheme, iteration count and salt all travel inside the hash, so a
  // stored record is self-describing: verification never has to guess which
  // scheme produced it, and raising the iteration count later does not
  // invalidate anyone's password.
  return `${SCHEME}$${PBKDF2_ITERATIONS}$${salt}$${digest}`;
}

export function isCurrentHashScheme(storedHash: string | undefined): boolean {
  return typeof storedHash === 'string' && storedHash.startsWith(`${SCHEME}$`);
}

// Length-safe, constant-time hex comparison so hash checks don't leak
// timing information.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a password against a stored hash, whatever scheme produced it.
 *
 * `salt` is the caller's legacy `passwordSalt` column and is only consulted
 * for pre-PBKDF2 accounts, whose digest was computed over
 * `userId:salt:password`. Current hashes carry their own salt.
 */
export async function verifyPassword(userId: string, password: string, storedHash: string, salt?: string): Promise<boolean> {
  if (isCurrentHashScheme(storedHash)) {
    // The stored hash carries its own salt and iteration count, so a scheme
    // change never needs a matching column update and verification cannot be
    // thrown off by a stale or missing salt on the record.
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const [, iterStr, hashSalt, digest] = parts;
    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations < 1) return false;
    const candidate = await derivePbkdf2(password, hashSalt, iterations);
    return timingSafeEqualHex(candidate, digest);
  }
  // Legacy account: accept the old digest so the user can still get in and be
  // upgraded. Never accept the unsalted scheme unless that is literally what
  // is stored, which the caller signals by passing no salt.
  const candidate = await legacySha256(userId, password, salt);
  return timingSafeEqualHex(candidate, storedHash);
}

// ── Brute-force throttle (per device, per email) ───────────────────────────
// Client-side only — a determined attacker can clear localStorage. Real
// protection comes from Supabase's built-in rate limiting once configured.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60_000;

function failKey(email: string) {
  return `auth_fail_${email.toLowerCase().trim()}`;
}

export function getAuthLockout(email: string): number {
  const lockedUntil = Number(localStorage.getItem(`${failKey(email)}_lock`) || 0);
  return Math.max(0, lockedUntil - Date.now());
}

export function recordAuthFailure(email: string): void {
  const key = failKey(email);
  const fails = Number(localStorage.getItem(key) || 0) + 1;
  if (fails >= MAX_ATTEMPTS) {
    localStorage.setItem(`${key}_lock`, String(Date.now() + LOCKOUT_MS));
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, String(fails));
  }
}

export function clearAuthFailures(email: string): void {
  localStorage.removeItem(failKey(email));
  localStorage.removeItem(`${failKey(email)}_lock`);
}
