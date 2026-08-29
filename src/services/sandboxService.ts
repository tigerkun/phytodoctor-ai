import { GameService } from './gameService';

export const ASSESSMENTS_PER_DAY = 2;

export interface SpeciesDossier {
  commonName: string;
  scientificName: string;
  overview: string;
  origin: string;
  hardinessZones: string;
  idealTempMin: number;
  idealTempMax: number;
  idealHumidityMin: number;
  idealHumidityMax: number;
  light: string;
  soil: string;
  soilPh: string;
  watering: string;
  photoperiodHours: number;
  nativeClimate: string;
  pests: string;
}

export interface SiteEnvironment {
  label: string;
  mode: 'location' | 'simulate';
  city?: string;
  biome?: string;
  indoor: boolean;
  datetime: string;
  temp: number;
  humidity: number;
  windSpeed: number;
  rainfallMm: number;
  uvIndex: number;
  photoperiodHours: number;
  soilType: string;
  soilPh: number;
  weather: string;
}

export interface PlacementReport {
  survivalChance: number;
  verdict: string;
  climateScore: number;
  waterScore: number;
  lightScore: number;
  soilScore: number;
  pestScore: number;
  seasonalScore: number;
  summary: string;
  tips: string[];
  risks: string[];
  protocol: string;
}

export const BIOMES = [
  { id: 'tropical', label: 'Tropical rainforest' },
  { id: 'arid', label: 'Arid / desert' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'temperate', label: 'Temperate maritime' },
  { id: 'continental', label: 'Continental' },
  { id: 'boreal', label: 'Boreal / cold' },
] as const;

function capKey() {
  const day = new Date().toISOString().slice(0, 10);
  return `sandbox_assessments_${GameService.getUserId()}_${day}`;
}

export function assessmentsUsedToday() {
  return Number(localStorage.getItem(capKey()) || 0);
}

export function assessmentsLeftToday() {
  return Math.max(0, ASSESSMENTS_PER_DAY - assessmentsUsedToday());
}

export function consumeAssessment() {
  if (assessmentsLeftToday() <= 0) return false;
  localStorage.setItem(capKey(), String(assessmentsUsedToday() + 1));
  return true;
}

async function sandboxApi(body: object) {
  const res = await fetch('/api/sandbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function profileSpecies(species: string): Promise<SpeciesDossier> {
  return sandboxApi({ mode: 'profile', species });
}

export async function assessPlacement(species: string, environment: SiteEnvironment): Promise<PlacementReport> {
  return sandboxApi({ mode: 'assess', species, environment });
}

export async function geocodeCity(query: string) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
  const rows = await res.json();
  if (!rows?.[0]) throw new Error('Could not find that place.');
  return {
    lat: Number(rows[0].lat),
    lon: Number(rows[0].lon),
    label: rows[0].display_name as string,
  };
}

export async function fetchSiteClimate(lat: number, lon: number, city: string): Promise<SiteEnvironment> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,uv_index&daily=sunrise,sunset,precipitation_sum,et0_fao_evapotranspiration&timezone=auto`;
  const data = await fetch(url).then(r => r.json());
  const c = data.current;
  const sunrise = data.daily?.sunrise?.[0];
  const sunset = data.daily?.sunset?.[0];
  let photoperiodHours = 12;
  if (sunrise && sunset) photoperiodHours = Math.round(((new Date(sunset).getTime() - new Date(sunrise).getTime()) / 36e5) * 10) / 10;

  const weatherCode = c.weather_code as number;
  return {
    label: city,
    mode: 'location',
    city,
    indoor: false,
    datetime: c.time || new Date().toISOString(),
    temp: Math.round(c.temperature_2m),
    humidity: Math.round(c.relative_humidity_2m),
    windSpeed: Math.round(c.wind_speed_10m),
    rainfallMm: Number(c.precipitation || data.daily?.precipitation_sum?.[0] || 0),
    uvIndex: Math.round(c.uv_index || 0),
    photoperiodHours,
    soilType: guessSoil(c.temperature_2m, c.relative_humidity_2m),
    soilPh: 6.5,
    weather: weatherLabel(weatherCode),
  };
}

function weatherLabel(code: number) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mixed';
}

function guessSoil(temp: number, humidity: number) {
  if (temp > 30 && humidity < 40) return 'sandy';
  if (humidity > 75) return 'moisture-retentive';
  if (temp < 8) return 'peaty';
  return 'loamy';
}

const BIOME_BASE: Record<string, Omit<SiteEnvironment, 'label' | 'mode' | 'datetime' | 'indoor' | 'biome'>> = {
  tropical: { temp: 28, humidity: 82, windSpeed: 8, rainfallMm: 9, uvIndex: 8, photoperiodHours: 12, soilType: 'loamy', soilPh: 6.2, weather: 'Warm rain / high humidity' },
  arid: { temp: 34, humidity: 22, windSpeed: 18, rainfallMm: 0.2, uvIndex: 10, photoperiodHours: 13, soilType: 'sandy', soilPh: 7.8, weather: 'Hot, dry, intense sun' },
  mediterranean: { temp: 22, humidity: 50, windSpeed: 12, rainfallMm: 1, uvIndex: 7, photoperiodHours: 12, soilType: 'well-draining', soilPh: 7.2, weather: 'Dry summer / mild wet winter type' },
  temperate: { temp: 16, humidity: 68, windSpeed: 14, rainfallMm: 3, uvIndex: 5, photoperiodHours: 12, soilType: 'loamy', soilPh: 6.5, weather: 'Mild, changeable' },
  continental: { temp: 10, humidity: 55, windSpeed: 16, rainfallMm: 2, uvIndex: 4, photoperiodHours: 11, soilType: 'clay', soilPh: 6.8, weather: 'Hot summers / cold winters type' },
  boreal: { temp: 2, humidity: 70, windSpeed: 12, rainfallMm: 2, uvIndex: 3, photoperiodHours: 9, soilType: 'peaty', soilPh: 5.2, weather: 'Short cool summer / long winter' },
};

export function simulateBiome(biomeId: string, when: Date, indoor: boolean): SiteEnvironment {
  const base = BIOME_BASE[biomeId] || BIOME_BASE.temperate;
  const month = when.getMonth();
  const seasonal = Math.sin(((month - 2) / 12) * Math.PI * 2);
  const temp = Math.round(base.temp + (biomeId === 'tropical' || biomeId === 'arid' ? seasonal * 3 : seasonal * 10));
  const photoperiodHours = Math.round((12 + seasonal * (indoor ? 1 : 3.5)) * 10) / 10;
  return {
    ...base,
    temp: indoor ? Math.round(temp * 0.35 + 21) : temp,
    humidity: indoor ? Math.min(70, base.humidity) : base.humidity,
    uvIndex: indoor ? Math.max(1, Math.round(base.uvIndex * 0.25)) : base.uvIndex,
    photoperiodHours: indoor ? 11 : photoperiodHours,
    windSpeed: indoor ? 1 : base.windSpeed,
    rainfallMm: indoor ? 0 : base.rainfallMm,
    weather: indoor ? `${base.weather} (indoor buffered)` : base.weather,
    label: BIOMES.find(b => b.id === biomeId)?.label || biomeId,
    mode: 'simulate',
    biome: biomeId,
    indoor,
    datetime: when.toISOString(),
  };
}
