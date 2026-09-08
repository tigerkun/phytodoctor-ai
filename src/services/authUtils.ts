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

export function decodeJwtPayload(credential: string): { sub: string; email: string; name?: string } {
  const b64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return JSON.parse(atob(b64 + pad)) as { sub: string; email: string; name?: string };
}
