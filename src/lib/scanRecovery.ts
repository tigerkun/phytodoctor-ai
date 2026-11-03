/**
 * One classifier for scan failures, shared by the Clinic's triage flow and
 * the Lab's dex scan. Transport errors already arrive with specific wording
 * from geminiService ("took too long", "Could not reach the analysis
 * service") and server failures surface as "Server error (status)" — this
 * turns those into a recovery card: what happened in plain language, and
 * what the Keeper can do about it.
 *
 * Unknown errors pass through with their real message as the title. The
 * card never replaces the actual failure with stand-in copy — it frames it.
 */

export interface ScanRecovery {
  kind: 'busy' | 'timeout' | 'offline' | 'rate-limited' | 'invalid-image' | 'server' | 'unknown';
  /** Short headline for what went wrong. */
  title: string;
  /** What to do about it, in the Keeper's language. */
  advice: string;
}

const MATCHERS: [RegExp, ScanRecovery][] = [
  [/already running|in flight/,
    { kind: 'busy', title: 'A scan is already running.', advice: 'Give it a moment to finish before starting another.' }],
  [/took too long|timed out|timeout/,
    { kind: 'timeout', title: 'Connection timed out.', advice: 'Check your internet and try again.' }],
  [/could not reach|failed to fetch|network error|offline/,
    { kind: 'offline', title: 'You appear to be offline.', advice: 'Check your internet connection and try again.' }],
  [/429|rate limit|too many|limit reached|slow down/,
    { kind: 'rate-limited', title: 'Too many scans.', advice: 'Wait 60 seconds or upgrade to Pro.' }],
  [/image decode|unable to read|not a plant|only living specimens|does not look like|clearer leaf/,
    { kind: 'invalid-image', title: "This doesn't look like a readable plant photo.", advice: 'Try a clearer shot with the leaf in focus.' }],
  [/server error \(5|temporarily unavailable|bad day/,
    { kind: 'server', title: "Our AI is having a bad day. We've been notified.", advice: 'Try again in 5 minutes.' }],
];

export function classifyScanError(err: unknown): ScanRecovery {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const m = message.toLowerCase();
  for (const [pattern, recovery] of MATCHERS) {
    if (pattern.test(m)) return recovery;
  }
  return {
    kind: 'unknown',
    title: message || 'The scan could not be completed.',
    advice: 'Check the photo and try again — if it keeps failing, contact support.',
  };
}

/** The ?query= payload that hands a failed scan to the support chat,
 *  so the Keeper does not have to retype what already went wrong. */
export function supportQuery(kind: ScanRecovery['kind'], message: string): string {
  const trimmed = message.length > 140 ? `${message.slice(0, 140)}…` : message;
  return `My plant scan failed (${kind}). The scan said: "${trimmed}". Can you help me get it working?`;
}
