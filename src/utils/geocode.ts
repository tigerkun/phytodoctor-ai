/**
 * Place lookup, shared by the site-climate report and the home dashboard.
 *
 * This used to return New York's coordinates for *any* failure — unknown
 * place, offline, Nominatim rate limit — while labelling the result with the
 * user's own query. The site report then described New York's climate under
 * the heading "Mumbai", with nothing on screen to say it was estimated.
 *
 * A Keeper making a horticultural decision deserves to know when the ground
 * under the report is soft. So this throws, and the caller (which already
 * surfaces the message) tells them to try again.
 */
export async function geocodeCity(query: string) {
  const trimmed = query.trim();
  // An empty box is not a place. Fail before spending a rate-limited request.
  if (!trimmed) throw new Error('Enter a city first.');
  let res: Response;
  try {
    res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`);
  } catch {
    throw new Error('Could not reach the place lookup. Check your connection and try again.');
  }
  if (!res.ok) {
    // Nominatim throttles by IP; 429 is the common case for a heavy user.
    throw new Error(res.status === 429
      ? 'The place lookup is busy right now. Try again in a minute.'
      : `The place lookup failed (status ${res.status}). Try again.`);
  }
  const rows = await res.json();
  if (!rows?.[0]) throw new Error(`Could not find "${trimmed}". Try a larger nearby town.`);
  return {
    lat: Number(rows[0].lat),
    lon: Number(rows[0].lon),
    label: rows[0].display_name as string,
  };
}

export interface WeatherPlace {
  latitude: number;
  longitude: number;
  /** What to call the place in the UI and in the weather cache key. */
  city: string;
}

/**
 * Work out whose weather to load, given what the Keeper chose.
 *
 * A device fix wins when there is one — it is a real position and it needs no
 * lookup. Otherwise the typed city has to be geocoded on every load, because
 * a city name alone cannot fetch weather.
 *
 * Returns null when the Keeper has chosen nothing. It does not substitute a
 * default: Home used to fall back to Delhi's coordinates, so every visitor who
 * had not granted the location prompt — which is every visitor on their first
 * visit, before the prompt is even answered — was shown a Delhi forecast
 * labelled with their own garden. A missing location has to read as missing.
 *
 * A city that cannot be resolved throws, for the reason above.
 */
export async function resolveWeatherPlace(
  city: string,
  fix: { latitude: number; longitude: number } | null,
): Promise<WeatherPlace | null> {
  // Number.isFinite, not truthiness: a device parked on the equator (0, 0)
  // has a perfectly valid fix, and `fix.latitude &&` used to discard it.
  if (fix && Number.isFinite(fix.latitude) && Number.isFinite(fix.longitude)) {
    return { latitude: fix.latitude, longitude: fix.longitude, city: city.trim() || 'Your location' };
  }
  const trimmed = city.trim();
  if (!trimmed) return null;

  const cacheKey = `botanical_city_coords_${trimmed.toLowerCase()}`;
  try {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(cacheKey) : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Number.isFinite(parsed?.latitude) && Number.isFinite(parsed?.longitude)) {
        return parsed;
      }
    }
  } catch {
    // Private mode or storage blocked: fall through to network lookup
  }

  const geo = await geocodeCity(trimmed);
  const result: WeatherPlace = { latitude: geo.lat, longitude: geo.lon, city: trimmed };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    }
  } catch {}

  return result;
}