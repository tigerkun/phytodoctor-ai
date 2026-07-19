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

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not available');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode to get city name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const city = data.address?.city || data.address?.town || data.address?.county || 'Unknown';

          setLocation({ latitude, longitude, city });
          localStorage.setItem('botanical_city', city);
        } catch (err) {
          setLocation({ latitude, longitude, city: 'Unknown' });
        }
      },
      (err) => {
        setError(err.message);
        // Try to use stored city
        if (manualCity) {
          setLocation({ latitude: 0, longitude: 0, city: manualCity });
        }
      }
    );
  }, [manualCity]);

  const updateCity = useCallback((city: string) => {
    setManualCity(city);
    localStorage.setItem('botanical_city', city);
  }, []);

  return {
    location,
    error,
    manualCity,
    updateCity,
    city: location?.city || manualCity || 'Your Location'
  };
}
