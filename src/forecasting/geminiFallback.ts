import type { ForecastInput, ForecastResult } from './ruleEngine';
import { TelemetryService } from '../services/telemetryService';

export async function geminiForecast(
  input: ForecastInput,
  ruleResult: ForecastResult
): Promise<ForecastResult> {
  // If confidence is high, skip LLM
  if (ruleResult.confidence >= 60) {
    return ruleResult; 
  }
  
  try {
    await TelemetryService.log('gemini_hit', 'Request Initiated', input.plant.species);
    const response = await fetch('/api/guardian/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        species: input.plant.species,
        checkins: input.checkIns.slice(-10), // Send last 10 for context
        sensorData: input.sensorReadings.slice(-20),
        weather: input.weather
      })
    });

    if (!response.ok) throw new Error('API request failed');
    
    const json = await response.json();
    
    return {
      riskScore: json.riskScore,
      primaryStressor: json.primaryStressor,
      confidence: json.confidence * 100, // API returns 0-1, we use 0-100
      reasoning: [json.reasoning],
      recommendedActions: [json.protocolRecommendation],
      alertThreshold: json.riskScore >= 75 ? 'critical' : 
                      json.riskScore >= 50 ? 'warning' : 
                      json.riskScore >= 25 ? 'info' : 'none',
      modelVersion: 'gemini-1.5-flash-api'
    } as any;
  } catch (e) {
    console.error('Gemini analysis failed', e);
    return ruleResult;
  }
}
