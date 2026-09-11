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

/**
 * Hash password using Web Crypto SHA-256. Salted when a salt is provided
 * (current scheme); falls back to the legacy userId-only scheme so accounts
 * created before salting can still sign in and be upgraded.
 * Browser-native, zero deps. Client-side hashing protects against casual
 * impersonation on shared devices only — Supabase (bcrypt, server-side)
 * remains the real auth path once configured.
 */
export async function hashPassword(userId: string, password: string, salt?: string): Promise<string> {
  const payload = salt ? `${userId}:${salt}:${password}` : `${userId}:${password}`;
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
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

export async function verifyPassword(userId: string, password: string, storedHash: string, salt?: string): Promise<boolean> {
  const hash = await hashPassword(userId, password, salt);
  return timingSafeEqualHex(hash, storedHash);
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
