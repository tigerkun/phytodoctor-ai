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
 * Hash password using Web Crypto SHA-256 with a per-user salt (the userId).
 * Returns hex string. Browser-native, zero deps.
 * ponytail: This is client-side hashing — it stops password impersonation on
 * shared devices. It does NOT replace server-side hashing when a real backend
 * auth service exists. Upgrade path: move to bcrypt/argon2 on the server.
 */
export async function hashPassword(userId: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(userId + ':' + password);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(userId: string, password: string, storedHash: string): Promise<boolean> {
  const hash = await hashPassword(userId, password);
  return hash === storedHash;
}
