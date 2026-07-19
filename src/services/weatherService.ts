const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export interface WeatherData {
  temperature: number;
  humidity: number;
  uvIndex: number;
  precipitation: number;
  description: string;
  forecast: Array<{ date: string; temp: number; humidity: number }>;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const response = await fetch(
    `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=uv_index_max,temperature_2m_max,relative_humidity_2m_max&timezone=auto`
  );
  const data = await response.json();
  
  const forecast = data.daily.time.map((date: string, i: number) => ({
    date,
    temp: data.daily.temperature_2m_max[i],
    humidity: data.daily.relative_humidity_2m_max[i]
  }));

  return {
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    uvIndex: data.daily.uv_index_max[0],
    precipitation: data.current.precipitation,
    description: weatherCodeToString(data.current.weather_code),
    forecast
  };
}

function weatherCodeToString(code: number): string {
  // WMO Weather interpretation codes
  const codes: Record<number, string> = {
    0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog', 48: 'depositing rime fog',
    51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
    61: 'slight rain', 63: 'moderate rain', 65: 'heavy rain',
    71: 'slight snow', 73: 'moderate snow', 75: 'heavy snow',
    95: 'thunderstorm', 96: 'thunderstorm with hail'
  };
  return codes[code] || 'unknown';
}

// Cache weather for 1 hour per location
const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();

export async function getCachedWeather(lat: number, lon: number): Promise<WeatherData> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.data;
  }
  const data = await fetchWeather(lat, lon);
  weatherCache.set(key, { data, timestamp: Date.now() });
  return data;
}
