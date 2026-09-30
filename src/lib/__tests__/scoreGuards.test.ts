import { describe, it, expect } from 'vitest';
import { clampTo, clampPercent, clampUnit, clampPercentFields, orderRange } from '../scoreGuards';

describe('clampTo', () => {
  it('clamps a 1-5 severity scale', () => {
    // Clinic treats severity >= 3 as "quarantine required", so 9 must not
    // exist and 0 must not read as a healthy plant.
    expect(clampTo(9, 1, 5, 1)).toBe(5);
    expect(clampTo(0, 1, 5, 1)).toBe(1);
    expect(clampTo(3, 1, 5, 1)).toBe(3);
  });

  it('falls back to the floor when the value is not finite', () => {
    expect(clampTo(undefined, 1, 5, 1)).toBe(1);
    expect(clampTo('abc', 1, 5, 2)).toBe(2);
  });
});

describe('clampPercent', () => {
  it('leaves in-range values untouched', () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(100)).toBe(100);
  });

  it('caps a score above 100', () => {
    // A riskScore of 150 would otherwise read as maximally critical when the
    // real problem is that the model ran past its own scale.
    expect(clampPercent(150)).toBe(100);
  });

  it('floors a negative score', () => {
    // -8 would otherwise fall through every severity threshold as "no risk".
    expect(clampPercent(-8)).toBe(0);
  });

  it('falls back on values that are not finite numbers', () => {
    expect(clampPercent(undefined, 42)).toBe(42);
    expect(clampPercent(null, 42)).toBe(42);
    expect(clampPercent('nonsense', 42)).toBe(42);
    expect(clampPercent(NaN, 42)).toBe(42);
    expect(clampPercent(Infinity, 42)).toBe(42);
  });

  it('accepts numeric strings, which JSON models sometimes emit', () => {
    expect(clampPercent('72.5')).toBe(72.5);
  });
});

describe('clampUnit', () => {
  it('keeps fractions inside 0-1', () => {
    expect(clampUnit(0)).toBe(0);
    expect(clampUnit(0.87)).toBe(0.87);
    expect(clampUnit(1)).toBe(1);
  });

  it('clamps out-of-range fractions', () => {
    // The client renders confidence as `* 100`, so 2 would display as 200%.
    expect(clampUnit(2)).toBe(1);
    expect(clampUnit(-0.5)).toBe(0);
  });

  it('falls back on non-finite values', () => {
    expect(clampUnit(NaN, 0.5)).toBe(0.5);
  });
});

describe('clampPercentFields', () => {
  it('clamps every named key and leaves the rest alone', () => {
    const payload = {
      riskScore: 140,
      confidence: 0.4,
      primaryStressor: 'Humidity',
      reasoning: 'Low humidity for 9 days.',
    };
    const out = clampPercentFields(payload, ['riskScore'] as const);
    expect(out.riskScore).toBe(100);
    expect(out.confidence).toBe(0.4);
    expect(out.primaryStressor).toBe('Humidity');
  });

  it('ignores keys the payload does not carry', () => {
    const out = clampPercentFields({ a: 10 }, ['a', 'missing'] as never);
    expect(out.a).toBe(10);
    expect('missing' in out).toBe(false);
  });
});

describe('orderRange', () => {
  it('leaves an already-ordered pair alone', () => {
    expect(orderRange(18, 24)).toEqual([18, 24]);
  });

  it('swaps an inverted pair instead of discarding it', () => {
    // The dossier's climate score range-checks each side independently, so an
    // inverted pair subtracts the penalty twice for one condition.
    expect(orderRange(32, 12)).toEqual([12, 32]);
  });

  it('collapses gracefully when a bound is missing', () => {
    expect(orderRange(undefined, 24)).toEqual([0, 24]);
    expect(orderRange(18, undefined)).toEqual([18, 18]);
    expect(orderRange(null, null)).toEqual([0, 0]);
  });
});
