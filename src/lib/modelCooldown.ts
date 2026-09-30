/**
 * Model failover cooldown.
 *
 * The Gemini retry chain is walked in a fixed order, so the slowest model in
 * the chain taxes *every* request: a production /api/sandbox assess measured
 * ~105s wall clock, which is one full 60s timeout on gemini-3.8-flash followed
 * by a fast answer from the next model. Parking a model that just timed out or
 * was capacity-shed turns "every call is slow" into "one call is slow".
 *
 * Kept free of server imports so it can be unit-tested without booting the app.
 */

export const MODEL_CHAIN = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
] as const;

/** Long enough to cover a burst of requests, short enough to self-heal. */
export const MODEL_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * A retired/renamed model is not coming back during the life of a long-running
 * process, so it is parked far longer than a transient capacity shed.
 */
export const MODEL_MISSING_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function cooldownFor(missing: boolean, now = Date.now()): number {
  return now + (missing ? MODEL_MISSING_COOLDOWN_MS : MODEL_COOLDOWN_MS);
}

/**
 * The configured chain minus anything still parked.
 *
 * If every model is cooling down the full chain is returned anyway: a stale
 * cooldown must degrade to "slow", never to a total outage.
 */
export function selectModels(
  now = Date.now(),
  cooldown: Map<string, number> = new Map(),
  configured?: string,
): string[] {
  const chain = configured ? [configured, ...MODEL_CHAIN] : [...MODEL_CHAIN];
  const fresh = chain.filter(m => (cooldown.get(m) ?? 0) <= now);
  return fresh.length ? fresh : chain;
}