import type { Plant, CheckIn, SensorReading } from '../db/database';
import type { WeatherData } from '../services/weatherService';
import { SPECIES_PROFILES, type SpeciesProfile } from './speciesProfiles';
import { TelemetryService } from '../services/telemetryService';

export interface ForecastInput {
  plant: Plant;
  checkIns: CheckIn[];
  sensorReadings: SensorReading[];
  weather: WeatherData | null;
}

export interface ForecastResult {
  riskScore: number; // 0-100
  primaryStressor: 'Light' | 'Water' | 'Humidity' | 'Temperature' | 'Nutrition' | 'Unknown';
  confidence: number; // 0-100
  reasoning: string[];
  recommendedActions: string[];
  alertThreshold: 'none' | 'info' | 'warning' | 'critical';
  modelVersion?: string;
}

export function calculateRiskScore(input: ForecastInput): ForecastResult {
  const { plant, checkIns, weather } = input;
  const result = ((): ForecastResult => {
    const profile = SPECIES_PROFILES[plant.species];
    const stressors: string[] = [];
    const reasoning: string[] = [];
    const actions: string[] = [];
    let riskScore = 0;
    
    if (!profile) {
      return calculateGenericRisk(input);
    }
    
    // 1. Light analysis (last 7 days of check-ins)
    const recentCheckIns = checkIns.slice(-7);
    const lowLightCount = recentCheckIns.filter(c => c.lightLevel === 'Low').length;
    const directLightCount = recentCheckIns.filter(c => c.lightLevel === 'Direct').length;
    const indirectLightCount = recentCheckIns.filter(c => c.lightLevel === 'Indirect').length;
    
    // Profile values are lowercase, check-in values are Capitalized
    const optimalLight = profile.optimalLight.charAt(0).toUpperCase() + profile.optimalLight.slice(1);

    if (optimalLight === 'Indirect' && directLightCount >= 3) {
      stressors.push('Light');
      reasoning.push(`${directLightCount} days with direct light exposure. Specimen typically prefers filtered indirect light.`);
      actions.push('Relocate to a more filtered light environment');
      riskScore += 25;
    }
    if (optimalLight === 'Indirect' && lowLightCount >= 5) {
      stressors.push('Light');
      reasoning.push(`${lowLightCount} days with low light. Insufficient frequency for metabolic stability.`);
      actions.push('Provide brighter indirect light or supplemental grow lamp');
      riskScore += 20;
    }
    if (optimalLight === 'Direct' && lowLightCount >= 4) {
      stressors.push('Light');
      reasoning.push(`Sub-optimal irradiance detected (${lowLightCount} days). This species requires solar saturation.`);
      actions.push('Move to a south-facing window with direct exposure');
      riskScore += 30;
    }
    
    // 2. Moisture analysis (last 5 check-ins)
    const moisturePattern = checkIns.slice(-5).map(c => c.soilMoisture);
    const wetCount = moisturePattern.filter(m => m === 'Wet').length;
    const dryCount = moisturePattern.filter(m => m === 'Dry').length;
    
    if (profile.soilType === 'well-draining' && wetCount >= 4) {
      stressors.push('Water');
      reasoning.push(`Soil saturation maintained for ${wetCount} consecutive intervals. High risk of anaerobic root conditions.`);
      actions.push('Suspend hydration until soil depth is verified dry. Confirm pot drainage.');
      riskScore += 35;
    }
    if (profile.soilType === 'moisture-retentive' && dryCount >= 3) {
      stressors.push('Water');
      reasoning.push(`Critical substrate desiccation. This species requires constant moisture levels.`);
      actions.push('Rehydrate substrate immediately via deep irrigation');
      riskScore += 25;
    }
    
    // 3. Visual drift (The Deterministic Signal)
    const latestCheckIn = checkIns[checkIns.length - 1];
    // Calibration: Only alert if drift exceeds measured baseline variance (0.12)
    if (latestCheckIn?.driftScore !== null) {
      const drift = latestCheckIn.driftScore;
      if (drift > 0.12) {
        stressors.push('Unknown');
        const severity = drift > 0.28 ? 'Critical' : 'Watching';
        reasoning.push(`${severity} visual phenotype drift detected (${(drift * 100).toFixed(1)}%). Signatures differ from established baseline.`);
        actions.push('Perform close manual inspection for chlorosis, lesions, or microscopic pests.');
        riskScore += drift > 0.28 ? 45 : 20;
      }
    }
    
    // 4. Weather forecast & Seasonality
    if (weather) {
      const currentMonth = new Date().getMonth();
      const isDormant = profile.dormancyMonths.includes(currentMonth);

      const hotDays = weather.forecast.filter(d => d.temp > profile.optimalTemp[1]).length;
      if (hotDays >= 3) {
        stressors.push('Temperature');
        reasoning.push(`${hotDays}-day heatwave forecasted above species threshold (${profile.optimalTemp[1]}°C).`);
        actions.push('Increase ventilation and monitor humidity closely during peak temps');
        riskScore += 15;
      }
      
      if (weather.humidity < profile.optimalHumidity[0]) {
        stressors.push('Humidity');
        reasoning.push(`Forecasted humidity (${weather.humidity}%) significantly below botanical survival range (${profile.optimalHumidity[0]}%).`);
        actions.push('Activate humidification protocol or group specimens');
        riskScore += 10;
      }

      if (isDormant && wetCount >= 4) {
        reasoning.push('Specimen is in seasonal dormancy. Metabolic water demand is significantly reduced.');
        actions.push('Halve watering volume until growth season resumes');
        riskScore += 15;
      }
    }
    
    // Cap and classify
    riskScore = Math.min(100, riskScore);
    
    let alertThreshold: 'none' | 'info' | 'warning' | 'critical' = 'none';
    if (riskScore >= 75) alertThreshold = 'critical';
    else if (riskScore >= 50) alertThreshold = 'warning';
    else if (riskScore >= 25) alertThreshold = 'info';
    
    // Confidence increases with data volume
    const dataDepth = Math.min(10, checkIns.length);
    const confidence = Math.min(100, (dataDepth * 5) + (reasoning.length * 10) + 10);
    
    return {
      riskScore,
      primaryStressor: (stressors[0] as any) || 'Unknown',
      confidence,
      reasoning,
      recommendedActions: actions,
      alertThreshold,
      modelVersion: 'hardened-rule-engine-v2'
    };
  })();

  TelemetryService.log('rule_hit', result.riskScore, `${plant.species}`);
  return result;
}

function calculateGenericRisk(input: ForecastInput): ForecastResult {
  const { checkIns } = input;
  const recent = checkIns.slice(-5);
  
  let riskScore = 0;
  const reasoning: string[] = [];
  
  const wetCount = recent.filter(c => c.soilMoisture === 'Wet').length;
  const dryCount = recent.filter(c => c.soilMoisture === 'Dry').length;
  
  if (wetCount >= 4) {
    riskScore += 25;
    reasoning.push('Persistent soil saturation detected.');
  }
  if (dryCount >= 4) {
    riskScore += 20;
    reasoning.push('Persistent soil desiccation detected.');
  }
  
  return {
    riskScore: Math.min(100, riskScore),
    primaryStressor: riskScore > 0 ? 'Water' : 'Unknown',
    confidence: 50,
    reasoning,
    recommendedActions: riskScore > 0 ? ['Review standard care routine'] : [],
    alertThreshold: riskScore >= 50 ? 'warning' : 'none'
  };
}
