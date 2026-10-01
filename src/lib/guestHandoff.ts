/**
 * The guest handoff.
 *
 * A visitor diagnoses a plant without an account, presses "Index to Sanctuary",
 * and is asked to sign up. If the sign-up form throws away where they were and
 * what they found, the funnel leaks at exactly the moment it should convert --
 * they came back to a home page with nothing on it.
 *
 * So two things cross the sign-up wall in sessionStorage: the page to return
 * to, and the diagnosis itself. Both are read once and cleared, so a later
 * visit never resurrects a stale scan.
 */

const RETURN_KEY = 'phyto_auth_return';
const SCAN_KEY = 'phyto_guest_pending_scan';

/** How long a guest diagnosis stays worth restoring. */
const SCAN_TTL_MS = 30 * 60 * 1000;

export interface PendingScan {
  image: string;
  result: unknown;
  at: number;
}

/** Remember where to send the visitor once they have an account. */
export function rememberAuthReturn(pathname: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, pathname);
  } catch {
    // Private mode / storage disabled: the fallback is the default landing.
  }
}

export function consumeAuthReturn(fallback: string): string {
  try {
    const stored = sessionStorage.getItem(RETURN_KEY);
    if (stored && stored.startsWith('/')) {
      sessionStorage.removeItem(RETURN_KEY);
      return stored;
    }
  } catch {
    // ignore
  }
  return fallback;
}

/** Stash the diagnosis a guest is about to be asked to keep. */
export function stashPendingScan(image: string, result: unknown) {
  try {
    sessionStorage.setItem(SCAN_KEY, JSON.stringify({ image, result, at: Date.now() }));
  } catch {
    // A photo too large for sessionStorage just means no restore -- never a
    // failed save. The visitor still has the result on screen.
  }
}

/**
 * Return the stashed diagnosis if it is still fresh, and clear it either way:
 * this is a one-time handoff, not a history.
 */
export function takePendingScan(): PendingScan | null {
  try {
    const raw = sessionStorage.getItem(SCAN_KEY);
    sessionStorage.removeItem(SCAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingScan;
    if (!parsed?.image || !parsed.result || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > SCAN_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingScan() {
  try {
    sessionStorage.removeItem(SCAN_KEY);
  } catch {
    // ignore
  }
}