import { useEffect, useRef, useState, useCallback } from 'react';

const CITY_KEY = 'botanical_city';

function readStoredCity(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(CITY_KEY) || '';
  } catch {
    return '';
  }
}

function writeStoredCity(city: string) {
  try {
    if (city) localStorage.setItem(CITY_KEY, city);
    else localStorage.removeItem(CITY_KEY);
  } catch {
    // Private-mode Safari and storage-blocked iframes throw on setItem. The
    // choice still works for this session; it just will not survive a reload.
  }
}

/**
 * Where the Keeper is, on their own terms.
 *
 * This hook used to call `getCurrentPosition` on mount, on every page that
 * imports it. That is a permission prompt the moment the app opens — before
 * the Keeper has seen what the app does, let alone chosen to share anything —
 * and the browser's answer is sticky, so the one prompt they got was the one
 * they could least usefully act on.
 *
 * Nothing here runs a lookup until the Keeper asks for one. `requestLocation`
 * is wired to a button; `updateCity` is wired to a text field.
 *
 * A device fix is a real position, but a typed city is a deliberate answer,
 * so a typed city is authoritative once given: it clears the fix. Otherwise
 * Home kept fetching weather for the coordinates while the UI named the
 * typed one — a mismatch nothing on screen could reveal or correct.
 */
export function useGeolocation() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    city: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [manualCity, setManualCity] = useState<string>(readStoredCity);

  // The reverse geocode below is a network round-trip, so the page can unmount
  // while it is in flight. Guarding stops a late answer writing to a component
  // that is gone; nothing else needs guarding, because only a deliberate click
  // starts the request now.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const requestLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const message = 'This browser will not share your location. Type your city instead.';
      setError(message);
      throw new Error(message);
    }

    setLocating(true);
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      if (!mounted.current) return null;

      const { latitude, longitude } = position.coords;
      let city = 'Unknown';
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );
        if (response.ok) {
          const data = await response.json();
          city = data?.address?.city
            || data?.address?.town
            || data?.address?.village
            || data?.address?.county
            || 'Unknown';
        }
      } catch {
        // The label is cosmetic; the coordinates are the whole answer. Losing
        // the reverse lookup must not throw away a fix the user waited for.
      }
      if (!mounted.current) return null;

      setLocation({ latitude, longitude, city });
      if (city !== 'Unknown') {
        setManualCity(city);
        writeStoredCity(city);
      }
      return city;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not get your location.';
      if (mounted.current) setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      if (mounted.current) setLocating(false);
    }
  }, []);

  const updateCity = useCallback((city: string) => {
    const trimmed = city.trim();
    setManualCity(trimmed);
    writeStoredCity(trimmed);
    setLocation(null);
    setError(null);
  }, []);

  return {
    location,
    error,
    locating,
    manualCity,
    updateCity,
    requestLocation,
    /** True once the Keeper has named a place, by typing or by device fix. */
    hasPlace: Boolean(manualCity.trim() || location),
    // A manual choice is authoritative once made. Preferring `location.city`
    // meant that after picking a city by hand the UI still showed the GPS one,
    // which is the other half of the "my city keeps changing" symptom.
    city: manualCity || location?.city || '',
  };
}