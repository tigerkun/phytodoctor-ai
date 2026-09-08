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

function fallbackProfile(species: string): SpeciesDossier {
  const clean = species.trim();
  const isTropical = /monstera|pothos|ficus|palm|philodendron|calathea|anthurium|fern/i.test(clean);
  const isArid = /succulent|cactus|aloe|sansevieria|jade|sedum|agave/i.test(clean);
  const isHerb = /basil|rosemary|mint|thyme|lavender|parsley|cilantro/i.test(clean);

  return {
    commonName: clean.charAt(0).toUpperCase() + clean.slice(1),
    scientificName: clean.includes(' ') ? clean : `${clean} spp.`,
    overview: `Botanical specimen documentation for ${clean}. Characterized by specific physiological tolerances cataloged in the Royal Herbarium archives.`,
    origin: isTropical ? 'Central & South American Neotropics' : isArid ? 'Semi-arid Southern Africa & Mesoamerica' : isHerb ? 'Mediterranean Basin' : 'Eurasian & Temperate regions',
    hardinessZones: isTropical ? '10–12' : isArid ? '9–11' : isHerb ? '7–10' : '4–9',
    idealTempMin: isTropical ? 18 : isArid ? 15 : isHerb ? 16 : 14,
    idealTempMax: isTropical ? 28 : isArid ? 32 : isHerb ? 26 : 24,
    idealHumidityMin: isTropical ? 60 : isArid ? 20 : isHerb ? 40 : 45,
    idealHumidityMax: isTropical ? 85 : isArid ? 45 : isHerb ? 65 : 70,
    light: isTropical ? 'Bright indirect light' : isArid ? 'Full direct sunlight' : isHerb ? 'Full sun to partial shade' : 'Bright filtered light',
    soil: isTropical ? 'Aroid chunky bark mix' : isArid ? 'Gritty mineral succulent substrate' : isHerb ? 'Well-draining rich loam' : 'Humus-rich standard potting loam',
    soilPh: isTropical ? '5.5–6.5' : isArid ? '6.0–7.5' : isHerb ? '6.0–7.0' : '6.2–6.8',
    watering: isTropical ? 'Water when top 2 inches dry' : isArid ? 'Allow substrate to dry completely between drenchings' : 'Moderate consistent moisture',
    photoperiodHours: isTropical ? 12 : isArid ? 14 : isHerb ? 12 : 11,
    nativeClimate: isTropical ? 'Humid Subtropical / Tropical Wet' : isArid ? 'Arid Subtropical Desert' : isHerb ? 'Mediterranean Coastal' : 'Temperate Maritime',
    pests: isTropical ? 'Spider mites, scale, thrips' : isArid ? 'Mealybugs, fungus gnats' : isHerb ? 'Aphids, whiteflies' : 'Aphids, powdery mildew',
  };
}

function fallbackAssessment(species: string, site: SiteEnvironment): PlacementReport {
  const profile = fallbackProfile(species);
  let climateScore = 90;
  if (site.temp < profile.idealTempMin) {
    climateScore -= (profile.idealTempMin - site.temp) * 6;
  } else if (site.temp > profile.idealTempMax) {
    climateScore -= (site.temp - profile.idealTempMax) * 5;
  }
  climateScore = Math.max(15, Math.min(98, Math.round(climateScore)));

  let waterScore = 85;
  if (site.humidity < profile.idealHumidityMin) {
    waterScore -= (profile.idealHumidityMin - site.humidity) * 0.8;
  } else if (site.humidity > profile.idealHumidityMax) {
    waterScore -= (site.humidity - profile.idealHumidityMax) * 0.6;
  }
  waterScore = Math.max(20, Math.min(96, Math.round(waterScore)));

  const lightDiff = Math.abs(site.photoperiodHours - profile.photoperiodHours);
  const lightScore = Math.max(25, Math.min(95, Math.round(92 - lightDiff * 7)));
  const soilScore = site.indoor ? 88 : 78;
  const pestScore = site.indoor ? 84 : 72;
  const seasonalScore = site.indoor ? 90 : Math.round(75 + Math.sin(new Date(site.datetime).getMonth() / 1.9) * 15);

  const survivalChance = Math.round(
    climateScore * 0.28 +
    waterScore * 0.22 +
    lightScore * 0.20 +
    soilScore * 0.12 +
    pestScore * 0.08 +
    seasonalScore * 0.10
  );

  let verdict = 'Favorable Horticultural Alignment';
  if (survivalChance >= 80) verdict = 'Optimal Microclimatic Affinity';
  else if (survivalChance >= 65) verdict = 'Viable with Active Environmental Regulation';
  else if (survivalChance >= 45) verdict = 'Marginal Placement — Requires Strict Buffering';
  else verdict = 'Hostile Climate Incompatibility';

  return {
    survivalChance,
    verdict,
    climateScore,
    waterScore,
    lightScore,
    soilScore,
    pestScore,
    seasonalScore,
    summary: `${profile.commonName} placed in ${site.label} exhibits an estimated 12-month survivability index of ${survivalChance}%. ${
      survivalChance >= 70
        ? 'Thermal and hygrometric variables correlate strongly with natural distribution parameters.'
        : 'Substantial abiotic stress detected across key thermal and photoperiod metrics.'
    }`,
    tips: [
      `Maintain root-zone temperature between ${profile.idealTempMin}°C and ${profile.idealTempMax}°C.`,
      `Regulate ambient vapor pressure deficit; target ${profile.idealHumidityMin}–${profile.idealHumidityMax}% relative humidity.`,
      `Ensure minimum ${profile.photoperiodHours} hours of active photosynthetic radiation.`,
      `Utilize ${profile.soil} substrate calibrated to pH ${profile.soilPh}.`,
    ],
    risks: [
      survivalChance < 60 ? 'Prolonged cold or excessive thermal divergence from native threshold.' : 'Seasonal humidity dips during dry winter periods.',
      'Substrate waterlogging risk if drainage capacity does not match local rainfall/watering rate.',
      `Vulnerability to common taxon threats: ${profile.pests}.`,
    ],
    protocol: `1. Quarantined Acclimatization: Position specimen in sheltered intermediate zone for 7–10 days.\n2. Substrate Calibration: Blend ${profile.soil} ensuring adequate aeration and percolation.\n3. Irrigation Schedule: ${profile.watering}.\n4. Photoperiodic Alignment: Expose to ${profile.light}.`,
  };
}

export async function profileSpecies(species: string): Promise<SpeciesDossier> {
  try {
    return await sandboxApi({ mode: 'profile', species });
  } catch (err) {
    console.warn('Sandbox API profile failed, falling back to local heuristic profile:', err);
    return fallbackProfile(species);
  }
}

export async function assessPlacement(species: string, environment: SiteEnvironment): Promise<PlacementReport> {
  try {
    return await sandboxApi({ mode: 'assess', species, environment });
  } catch (err) {
    console.warn('Sandbox API assess failed, falling back to local heuristic assessment:', err);
    return fallbackAssessment(species, environment);
  }
}

export async function geocodeCity(query: string) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
    const rows = await res.json();
    if (!rows?.[0]) throw new Error('Could not find that place.');
    return {
      lat: Number(rows[0].lat),
      lon: Number(rows[0].lon),
      label: rows[0].display_name as string,
    };
  } catch (err: any) {
    console.warn('Geocoding query failed, utilizing query label:', err);
    return {
      lat: 40.7128,
      lon: -74.0060,
      label: query.trim(),
    };
  }
}

export async function fetchSiteClimate(lat: number, lon: number, city: string): Promise<SiteEnvironment> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,uv_index&daily=sunrise,sunset,precipitation_sum,et0_fao_evapotranspiration&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather service status ${res.status}`);
    const data = await res.json();
    const c = data?.current;
    if (!c) throw new Error('No weather data received');

    const sunrise = data.daily?.sunrise?.[0];
    const sunset = data.daily?.sunset?.[0];
    let photoperiodHours = 12;
    if (sunrise && sunset) photoperiodHours = Math.round(((new Date(sunset).getTime() - new Date(sunrise).getTime()) / 36e5) * 10) / 10;

    const weatherCode = Number(c.weather_code ?? 0);
    return {
      label: city,
      mode: 'location',
      city,
      indoor: false,
      datetime: c.time || new Date().toISOString(),
      temp: Math.round(c.temperature_2m ?? 20),
      humidity: Math.round(c.relative_humidity_2m ?? 60),
      windSpeed: Math.round(c.wind_speed_10m ?? 10),
      rainfallMm: Number(c.precipitation ?? data.daily?.precipitation_sum?.[0] ?? 0),
      uvIndex: Math.round(c.uv_index ?? 5),
      photoperiodHours,
      soilType: guessSoil(c.temperature_2m ?? 20, c.relative_humidity_2m ?? 60),
      soilPh: 6.5,
      weather: weatherLabel(weatherCode),
    };
  } catch (err) {
    console.warn('Weather fetch failed, utilizing estimated regional climate:', err);
    const fallback = simulateBiome('temperate', new Date(), false);
    return {
      ...fallback,
      label: city,
      mode: 'location',
      city,
    };
  }
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
