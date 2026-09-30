/**
 * Guards for numbers that come back from Gemini on a fixed scale.
 *
 * The response schemas declare these as bare `Type.NUMBER`, which carries no
 * range — the API will happily return 137 or -8. Nothing downstream
 * tolerates that. `riskScore` picks an alert severity by threshold
 * (`>= 75` is critical), so 150 and 8 both read as "maximally dangerous".
 * The Vault factor bars render `width: ${v}%`, the dossier's climate
 * score subtracts for falling outside `idealTempMin..idealTempMax` on each
 * side independently so an inverted pair penalises twice, and Clinic's
 * `isQuarantineRequired` is a bare `severity >= 3`.
 *
 * Clamping at the API boundary means every consumer downstream — rules,
 * thresholds, bars, grades — can treat these as being on scale.
 */

function toFiniteNumber(value: unknown): number | null {
  // `Number(null)` and `Number('')` are both 0, which would turn a field the
  // model omitted into a real score at the bottom of the scale — a missing
  // severity would read as "healthy" and a missing pest score as "worst".
  // Both are missing data, not zero.
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Clamps a value into [min, max], substituting `fallback` if it is not finite. */
export function clampTo(value: unknown, min: number, max: number, fallback = min): number {
  const n = toFiniteNumber(value);
  if (n === null) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Clamps a model-supplied percentage into 0-100. */
export function clampPercent(value: unknown, fallback = 0): number {
  return clampTo(value, 0, 100, fallback);
}

/** Clamps a model-supplied fraction into 0-1. */
export function clampUnit(value: unknown, fallback = 0): number {
  return clampTo(value, 0, 1, fallback);
}

/**
 * True when a score was actually supplied and can be clamped.
 *
 * Clamping a field the model omitted would substitute the floor of the scale,
 * which is a confident wrong answer rather than a visible gap: a missing
 * survivalChance would read as "0% survivability", and a missing severity as
 * "mild". Leave those absent so the client can show the omission and its own
 * fallbacks can engage.
 */
export function hasScore(value: unknown): boolean {
  return toFiniteNumber(value) !== null;
}

/**
 * Clamps the named keys of a parsed model payload in place, leaving every
 * other field untouched. Returns the same object for chaining.
 */
export function clampPercentFields<T extends Record<string, unknown>>(
  payload: T,
  keys: readonly (keyof T)[],
  fallback = 0,
): T {
  for (const key of keys) {
    if (key in payload) {
      payload[key] = clampPercent(payload[key], fallback) as T[keyof T];
    }
  }
  return payload;
}

/**
 * Returns `[min, max]` with the values ordered. A model that reports
 * `idealTempMin: 32, idealTempMax: 12` has the right numbers in the wrong
 * order; swapping is more faithful than discarding them, and it stops
 * callers that range-check each side independently from penalising twice.
 */
export function orderRange(min: unknown, max: unknown): [number, number] {
  const lo = toFiniteNumber(min);
  const hi = toFiniteNumber(max);
  if (lo === null || hi === null) return lo === null ? [0, hi ?? 0] : [lo, lo];
  return lo <= hi ? [lo, hi] : [hi, lo];
}
