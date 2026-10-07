/**
 * Pure botanical microclimate simulation engine.
 * Calculates physiological strain (thermal, transpirational VPD, photoperiod)
 * for a plant under simulated or live environmental conditions.
 */

export interface MicroclimateInput {
  temperatureC: number;
  humidityPct: number;
  lightLevel: 'Direct' | 'Indirect' | 'Low';
}

export interface PlantToleranceProfile {
  speciesName: string;
  idealTempMinC: number;
  idealTempMaxC: number;
  idealHumidityMinPct: number;
  idealHumidityMaxPct: number;
  idealLight: 'Direct' | 'Indirect' | 'Low';
}

export interface MicroclimateSimulation {
  score: number; // 0–100
  thermalStrain: number; // 0–100 (0 = comfort zone, 100 = lethal threshold)
  humidityStress: number; // 0–100 (0 = balanced VPD, 100 = extreme deficit/saturation)
  lightMismatch: number; // 0–100
  viability: 'Optimal' | 'Favorable' | 'Stressed' | 'Critical';
  statusDescription: string;
  alerts: string[];
}

/**
 * Derives species-specific physiological thresholds from botanical names and scan vitals.
 */
export function deriveToleranceProfile(
  speciesName: string,
  care?: {
    temperatureC?: number | null;
    lightLevel?: 'Direct' | 'Indirect' | 'Low';
    soilMoisture?: 'Dry' | 'Wet' | 'Moist';
  }
): PlantToleranceProfile {
  const clean = (speciesName || '').toLowerCase();
  const isArid = /succulent|cactus|aloe|sansevieria|jade|sedum|agave|snake/i.test(clean);
  const isTropical = /monstera|pothos|ficus|palm|philodendron|calathea|anthurium|fern|orchid/i.test(clean);

  let idealTempMinC = isTropical ? 18 : isArid ? 14 : 15;
  let idealTempMaxC = isTropical ? 28 : isArid ? 32 : 25;

  if (typeof care?.temperatureC === 'number' && Number.isFinite(care.temperatureC)) {
    const base = Math.max(10, Math.min(32, care.temperatureC));
    idealTempMinC = Math.max(10, base - 4);
    idealTempMaxC = Math.max(idealTempMinC + 5, Math.min(38, base + 5));
  }

  const idealHumidityMinPct = isArid ? 25 : isTropical ? 60 : 45;
  const idealHumidityMaxPct = isArid ? 50 : isTropical ? 85 : 70;

  const idealLight: 'Direct' | 'Indirect' | 'Low' = care?.lightLevel
    ? care.lightLevel
    : isArid
      ? 'Direct'
      : isTropical
        ? 'Indirect'
        : 'Indirect';

  return {
    speciesName: speciesName || 'Botanical Specimen',
    idealTempMinC,
    idealTempMaxC,
    idealHumidityMinPct,
    idealHumidityMaxPct,
    idealLight,
  };
}

/**
 * Simulates microclimatic affinity and computes real-time physiological strain.
 */
export function simulateMicroclimate(
  input: MicroclimateInput,
  profile: PlantToleranceProfile
): MicroclimateSimulation {
  const temp = Number.isFinite(input.temperatureC) ? input.temperatureC : 22;
  const humidity = Math.max(0, Math.min(100, Number.isFinite(input.humidityPct) ? input.humidityPct : 50));
  const light = input.lightLevel || 'Indirect';

  // 1. Thermal strain
  let thermalStrain = 0;
  if (temp < profile.idealTempMinC) {
    thermalStrain = (profile.idealTempMinC - temp) * 9;
  } else if (temp > profile.idealTempMaxC) {
    thermalStrain = (temp - profile.idealTempMaxC) * 8;
  }
  thermalStrain = Math.max(0, Math.min(100, Math.round(thermalStrain)));

  // 2. Transpiration / humidity strain (Vapor Pressure Deficit surrogate)
  let humidityStress = 0;
  if (humidity < profile.idealHumidityMinPct) {
    humidityStress = (profile.idealHumidityMinPct - humidity) * 1.5;
  } else if (humidity > profile.idealHumidityMaxPct) {
    humidityStress = (humidity - profile.idealHumidityMaxPct) * 1.2;
  }
  humidityStress = Math.max(0, Math.min(100, Math.round(humidityStress)));

  // 3. Light mismatch with normalized levels
  let lightMismatch = 0;
  const normalizeLight = (val: unknown): 'Low' | 'Indirect' | 'Direct' => {
    const s = String(val || '').toLowerCase();
    if (s.includes('indirect') || s.includes('filtered') || s.includes('sheer')) return 'Indirect';
    if (s.includes('direct') || s.includes('full sun')) return 'Direct';
    if (s.includes('low') || s.includes('shade')) return 'Low';
    return 'Indirect';
  };
  const normIdealLight = normalizeLight(profile.idealLight);
  const normCurrentLight = normalizeLight(light);
  if (normIdealLight !== normCurrentLight) {
    const levels = ['Low', 'Indirect', 'Direct'] as const;
    const diff = Math.abs(levels.indexOf(normIdealLight) - levels.indexOf(normCurrentLight));
    lightMismatch = diff === 1 ? 35 : 75;
  }

  // 4. Combined score
  const totalStrain = thermalStrain * 0.45 + humidityStress * 0.35 + lightMismatch * 0.20;
  const score = Math.max(10, Math.min(99, Math.round(100 - totalStrain)));

  // 5. Viability classification
  let viability: MicroclimateSimulation['viability'] = 'Optimal';
  if (score < 45) viability = 'Critical';
  else if (score < 65) viability = 'Stressed';
  else if (score < 80) viability = 'Favorable';

  // 6. Biological alert messages
  const alerts: string[] = [];
  if (temp < 10) {
    alerts.push('Chilling stress: cellular turgor loss and cold injury threshold breached.');
  } else if (temp < profile.idealTempMinC) {
    alerts.push(`Thermal deficit: ambient temperature is below species comfort minimum (${profile.idealTempMinC}°C).`);
  } else if (temp > 32) {
    alerts.push('Thermal strain: stomatal closure initiated to restrict transpirational loss.');
  } else if (temp > profile.idealTempMaxC) {
    alerts.push(`Thermal excess: ambient temperature exceeds species comfort ceiling (${profile.idealTempMaxC}°C).`);
  }

  if (humidity < 35) {
    alerts.push('High Vapor Pressure Deficit (VPD): dry air accelerates leaf tip desiccation.');
  } else if (humidity < profile.idealHumidityMinPct) {
    alerts.push(`Sub-optimal humidity: below species transpiration threshold (${profile.idealHumidityMinPct}%).`);
  } else if (humidity > 85) {
    alerts.push('Saturated boundary layer: reduced transpiration heightens fungal spore susceptibility.');
  } else if (humidity > profile.idealHumidityMaxPct) {
    alerts.push(`Elevated ambient humidity: above species tolerance range (${profile.idealHumidityMaxPct}%).`);
  }

  if (lightMismatch >= 50) {
    // "Photoperiod" means day LENGTH; this is light-intensity mismatch.
    // The copy says what the simulation actually computes.
    alerts.push(`Light exposure mismatch: specimen thrives under ${normIdealLight.toLowerCase()} light.`);
  }

  let statusDescription = 'Microclimatic parameters align with physiological equilibrium.';
  if (viability === 'Critical') {
    statusDescription = 'Severe abiotic stress detected across multiple environmental axes.';
  } else if (viability === 'Stressed') {
    statusDescription = 'Sub-optimal ambient conditions; moderate physiological strain.';
  } else if (viability === 'Favorable') {
    statusDescription = 'Viable growing envelope with minor microclimatic variance.';
  }

  return {
    score,
    thermalStrain,
    humidityStress,
    lightMismatch,
    viability,
    statusDescription,
    alerts,
  };
}

/**
 * The vitality nudge a logged watering earns.
 *
 * Deliberately small and named: PlantDetail used to inline a bare "+2", an
 * untested policy decision. A watering log is a care event, not a diagnosis —
 * it may nudge vitality upward but can never manufacture health.
 */
export function vitalityAfterWatering(currentScore: number | null | undefined): number {
  const base = typeof currentScore === 'number' && Number.isFinite(currentScore) ? currentScore : 50;
  return Math.min(100, Math.max(0, Math.round(base + 2)));
}
