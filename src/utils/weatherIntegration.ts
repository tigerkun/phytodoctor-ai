interface WeatherData {
  temp: number;
  humidity: number;
  condition: string;
  icon: string;
  rainProbability: number;
  windSpeed: number;
  uvIndex: number;
}

const CACHE_DURATION = 3600000; // 1 hour

async function fetchWeatherFromOpenWeather(lat: number, lon: number): Promise<WeatherData> {
  // Using public API (no key required for basic requests)
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,weather_code,wind_speed_10m&temperature_unit=celsius`
  );

  const data = await response.json();
  const current = data.current;

  return {
    temp: Math.round(current.temperature_2m),
    humidity: current.relative_humidity_2m,
    condition: getWeatherCondition(current.weather_code),
    icon: getWeatherIcon(current.weather_code),
    rainProbability: 0,
    windSpeed: current.wind_speed_10m,
    uvIndex: 0
  };
}

function getWeatherCondition(code: number): string {
  // WMO Weather codes
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Drizzle';
  if (code >= 71 && code <= 85) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain';
  if (code >= 85 && code <= 86) return 'Snow Shower';
  if (code >= 80 && code <= 82) return 'Rain Shower';
  if (code >= 90 && code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
  if (code >= 71 && code <= 86) return '❄️';
  if (code >= 90 && code <= 99) return '⛈️';
  return '🌦️';
}

export async function fetchWeather(lat: number, lon: number, city: string): Promise<WeatherData> {
  const cacheKey = `weather_${city}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  const weather = await fetchWeatherFromOpenWeather(lat, lon);

  localStorage.setItem(cacheKey, JSON.stringify({
    data: weather,
    timestamp: Date.now()
  }));

  return weather;
}

export function generateWeatherAdvice(weather: WeatherData, plants: string[]): string[] {
  const advice: string[] = [];

  if (weather.humidity < 30) {
    advice.push('🌫️ Low humidity detected. Consider misting your tropical plants.');
  }

  if (weather.humidity > 80 && weather.condition.includes('Rain')) {
    advice.push('☔ Monsoon/heavy rain coming. Hold off on watering your plants.');
  }

  if (weather.temp > 35) {
    advice.push('🌡️ Heat wave! Move sensitive plants away from direct sun.');
  }

  if (weather.temp < 10) {
    advice.push('❄️ Cold snap incoming. Protect tender plants from frost.');
  }

  if (weather.windSpeed > 20) {
    advice.push('💨 Strong winds. Bring outdoor planters to shelter.');
  }

  if (advice.length === 0) {
    advice.push('✨ Perfect conditions for plant care today!');
  }

  return advice;
}

export function getWateringRecommendation(weather: WeatherData, lastWatered: Date): string {
  const daysSinceWater = Math.floor((Date.now() - lastWatered.getTime()) / (1000 * 60 * 60 * 24));

  if (weather.rainProbability > 50 && weather.condition.includes('Rain')) {
    return 'Hold off watering - rain incoming!';
  }

  if (weather.humidity > 70) {
    return 'Soil likely moist. Wait another day.';
  }

  if (weather.humidity < 30 && weather.temp > 25) {
    return 'Low humidity and heat. Water soon!';
  }

  if (daysSinceWater >= 7) {
    return 'Time to water!';
  }

  return `Water in ${7 - daysSinceWater} days`;
}
