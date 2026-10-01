import { describe, it, expect, afterEach, vi } from 'vitest';
import { geocodeCity, type SiteEnvironment } from '../sandboxService';

/**
 * The site report is a horticultural decision: "will this species survive at my
 * location". It used to answer that question with New York's coordinates under
 * the Keeper's own city name whenever the lookup failed -- unknown place,
 * offline, rate-limited -- and the report carried nothing saying it was
 * estimated. The failure mode worth pinning is that one: a wrong location must
 * never come back looking like a right one.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function mockFetch(impl: () => Promise<unknown>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

describe('geocodeCity', () => {
  it('resolves a real place to its coordinates', async () => {
    mockFetch(async () => new Response(JSON.stringify([
      { lat: '19.076', lon: '72.8777', display_name: 'Mumbai, Maharashtra, India' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await geocodeCity('Mumbai');
    expect(result.label).toContain('Mumbai');
    expect(result.lat).toBeCloseTo(19.076);
    expect(result.lon).toBeCloseTo(72.8777);
  });

  it('throws for a place it cannot find, rather than inventing coordinates', async () => {
    mockFetch(async () => new Response('[]', { status: 200 }));
    await expect(geocodeCity('Nowherevile')).rejects.toThrow(/Could not find/i);
  });

  it('throws when the lookup service is unreachable, naming no city at all', async () => {
    mockFetch(async () => { throw new TypeError('Failed to fetch'); });
    // The old behaviour returned 40.7128/-74.0060 here labelled "Mumbai".
    await expect(geocodeCity('Mumbai')).rejects.toThrow(/connection/i);
  });

  it('explains a rate limit instead of silently returning some other place', async () => {
    mockFetch(async () => new Response('rate limited', { status: 429 }));
    await expect(geocodeCity('Mumbai')).rejects.toThrow(/busy/i);
  });

  it('rejects a 200 that carries no usable coordinates', async () => {
    mockFetch(async () => new Response('[]', { status: 200 }));
    await expect(geocodeCity(' ')).rejects.toThrow();
  });
});

describe('estimated site readings are labelled', () => {
  it('carries the estimated flag so the UI can admit the numbers are a guess', () => {
    const live: SiteEnvironment = {
      label: 'Mumbai', mode: 'location', city: 'Mumbai', indoor: false,
      datetime: '2026-09-30T10:00', temp: 30, humidity: 80, windSpeed: 12,
      rainfallMm: 2, uvIndex: 8, photoperiodHours: 12, soilType: 'loam',
      soilPh: 6.5, weather: 'Rain',
    };
    // A live reading is not flagged.
    expect(live.estimated).toBeUndefined();

    // The biome estimate the weather fallback produces must be flagged, so a
    // temperate substitute can never be presented as this Keeper's sky.
    const estimated: SiteEnvironment = { ...live, temp: 18, weather: 'Clear', estimated: true };
    expect(estimated.estimated).toBe(true);
  });
});