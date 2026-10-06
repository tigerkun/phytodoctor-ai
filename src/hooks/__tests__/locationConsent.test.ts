import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveWeatherPlace, geocodeCity } from '../../utils/geocode';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The app used to ask for location permission the moment it opened — before
 * the Keeper had seen what it does, on three separate pages — and Home filled
 * the gap with hardcoded Delhi weather whenever the answer came back "no".
 *
 * Both halves of that are the same defect: the app takes something the Keeper
 * has not agreed to share, and then invents the answer when it cannot have it.
 * The fix is that a place is something the Keeper names, and no named place
 * means no weather at all rather than somebody else's.
 */

const hook = readSource('src/hooks/useGeolocation.ts');
const home = readSource('src/pages/Home.tsx');
const hero = readSource('src/components/home/HeroSection.tsx');
const coach = readSource('src/components/home/GardenCoach.tsx');
const bar = stripJsComments(readSource('src/components/home/LocationBar.tsx'));

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function mockFetch(impl: () => Promise<unknown>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

describe('resolving whose weather to load', () => {
  it('uses a device fix without a lookup when there is one', async () => {
    mockFetch(async () => { throw new Error('should not look anything up'); });
    const place = await resolveWeatherPlace('Pune', { latitude: 18.52, longitude: 73.85 });
    expect(place).toEqual({ latitude: 18.52, longitude: 73.85, city: 'Pune' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('geocodes the city the Keeper actually typed', async () => {
    mockFetch(async () => new Response(JSON.stringify([
      { lat: '18.5204', lon: '73.8567', display_name: 'Pune, Maharashtra, India' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const place = await resolveWeatherPlace('Pune', null);
    expect(place).toEqual({ latitude: 18.5204, longitude: 73.8567, city: 'Pune' });
  });

  it('resolves nothing, rather than a default place, when nothing was chosen', async () => {
    mockFetch(async () => { throw new Error('should not look anything up'); });
    // This is the case that used to become Delhi: 28.6139 / 77.2090, shown
    // to every visitor who had not granted a prompt they had barely seen.
    await expect(resolveWeatherPlace('', null)).resolves.toBeNull();
    await expect(resolveWeatherPlace('   ', null)).resolves.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('reports an unresolvable city instead of quietly loading another one', async () => {
    mockFetch(async () => new Response('[]', { status: 200 }));
    await expect(resolveWeatherPlace('Nowherevile', null)).rejects.toThrow(/Could not find/i);
  });

  it('spends no request on an empty box', async () => {
    mockFetch(async () => new Response('[]', { status: 200 }));
    await expect(geocodeCity('   ')).rejects.toThrow(/Enter a city/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('the location hook asks, it does not assume', () => {
  it('never reads a device fix on mount', () => {
    const code = stripJsComments(hook);
    // The mount effect this replaced called getCurrentPosition immediately.
    // Exactly one effect may remain in the file — the unmount guard for the
    // reverse geocode — and it must not touch geolocation.
    const effects = code.match(/useEffect\(/g) || [];
    expect(effects).toHaveLength(1);
    expect(code.match(/useEffect\([\s\S]*?\n {2}\}, \[\]\);/)?.[0]).not.toMatch(/geolocation/);
    expect(code).not.toMatch(/useEffect\([\s\S]{0,400}?getCurrentPosition/);
  });

  it('reaches for a device fix only from inside requestLocation', () => {
    const code = stripJsComments(hook);
    expect(code).toMatch(/const requestLocation = useCallback/);
    expect(code).toMatch(/navigator\.geolocation\.getCurrentPosition/);
    // And nothing outside that function calls it.
    const [before] = code.split('const requestLocation = useCallback');
    expect(before).not.toMatch(/getCurrentPosition/);
  });

  it('treats a typed city as authoritative over a device fix', () => {
    // Otherwise Home keeps fetching one place's coordinates while the UI
    // names another, and nothing on screen can reveal the mismatch.
    expect(stripJsComments(hook)).toMatch(/const updateCity = useCallback[\s\S]*?setLocation\(null\)/);
  });

  it('reports no city at all rather than a placeholder', () => {
    expect(stripJsComments(hook)).toMatch(/city: manualCity \|\| location\?\.city \|\| ''/);
    expect(hook).not.toMatch(/Your Location/);
  });

  it('survives a storage-blocked browser', () => {
    // Private-mode Safari throws on setItem; losing the choice entirely would
    // be worse than losing it across a reload.
    expect(hook).toMatch(/function writeStoredCity[\s\S]*?\n\}/);
    expect(stripJsComments(hook)).toMatch(/function writeStoredCity\(city: string\) \{\s*try \{/);
  });
});

describe('the dashboard does not invent weather', () => {
  it('has no fallback coordinates left in Home', () => {
    // 28.6139 / 77.2090 is New Delhi. Its removal is the whole point.
    expect(home).not.toMatch(/28\.6139/);
    expect(home).not.toMatch(/77\.2090/);
    expect(home).not.toMatch(/'Delhi'/);
    expect(home).toMatch(/resolveWeatherPlace/);
  });

  it('shows a dash rather than an invented temperature and humidity', () => {
    expect(hero).not.toMatch(/'28°C'/);
    expect(hero).not.toMatch(/'62%'/);
    expect(hero).toMatch(/weather\?\.temp != null \? `\$\{Math\.round\(weather\.temp\)\}°C` : '—'/);
  });

  it('gates the coach forecast on real telemetry', () => {
    expect(coach).not.toMatch(/weather\?\.temp \|\| 34/);
    expect(coach).not.toMatch(/weather\?\.humidity \|\| 62/);
    expect(coach).not.toMatch(/'Partly Cloudy'/);
    expect(coach).toMatch(/const hasWeather = weather\?\.temp != null/);
    expect(coach).toMatch(/\{hasWeather \? \(/);
  });
});

describe('the one place a Keeper can name their city', () => {
  it('is rendered on the dashboard and wired to both choices', () => {
    expect(home).toMatch(/<LocationBar/);
    expect(home).toMatch(/onSaveCity=\{updateCity\}/);
    expect(home).toMatch(/onUseDeviceLocation=\{\(\) => \{ void requestLocation\(\)/);
  });

  it('has a labelled field and a separate device button', () => {
    expect(bar).toMatch(/aria-label|<label[\s\S]*?htmlFor="location-city"/);
    expect(bar).toMatch(/id="location-city"/);
    expect(bar).toMatch(/Use my location/);
    expect(bar).toMatch(/onUseDeviceLocation/);
  });

  it('does not fire a lookup before the Keeper submits something', () => {
    expect(bar).toMatch(/function submit[\s\S]*?onSaveCity\(draft\)/);
  });
});