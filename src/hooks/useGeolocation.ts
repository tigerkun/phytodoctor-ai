import { useEffect, useState, useCallback } from 'react';

export function useGeolocation() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    city: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [manualCity, setManualCity] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('botanical_city') || '';
    }
    return '';
  });

  // Runs once per mount. It used to depend on `manualCity`, which `updateCity`
  // also sets, so every manual choice re-armed the effect: it called
  // getCurrentPosition again (re-prompting for location permission) and, on
  // success, overwrote localStorage and the displayed city with the GPS value
  // a moment later. The mount-time value is read below, which is the stored
  // preference that matters for the permission-denied fallback.
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not available');
      return;
    }

    // The reverse geocode is a network round-trip, so a manual choice made
    // while it is in flight used to lose: the lookup resolved afterwards and
    // overwrote the city the user had just picked. Bailing on cancel makes the
    // manual answer win regardless of who answers first.
    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        const { latitude, longitude } = position.coords;

        // Reverse geocode to get city name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          if (cancelled) return;
          const city = data.address?.city || data.address?.town || data.address?.county || 'Unknown';

          setLocation({ latitude, longitude, city });
          localStorage.setItem('botanical_city', city);
        } catch (err) {
          if (cancelled) return;
          setLocation({ latitude, longitude, city: 'Unknown' });
        }
      },
      (err) => {
        if (cancelled) return;
        setError(err.message);
        // Try to use stored city
        if (manualCity) {
          setLocation({ latitude: 0, longitude: 0, city: manualCity });
        }
      }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCity = useCallback((city: string) => {
    setManualCity(city);
    localStorage.setItem('botanical_city', city);
  }, []);

  return {
    location,
    error,
    manualCity,
    updateCity,
    // A manual choice is authoritative once made. Preferring `location.city`
    // meant that after picking a city by hand the UI still showed the GPS one,
    // which is the other half of the "my city keeps changing" symptom.
    city: manualCity || location?.city || 'Your Location'
  };
}
