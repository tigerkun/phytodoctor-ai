import { db, type Prediction } from '../db/database';
import { getCachedWeather } from '../services/weatherService';
import { calculateRiskScore, type ForecastInput } from '../forecasting/ruleEngine';
import { geminiForecast } from '../forecasting/geminiFallback';

export async function runGuardianDossier(plantId: string) {
  const plant = await db.plants.get(plantId);
  if (!plant) return;

  const checkIns = await db.checkins.where('plantId').equals(plantId).sortBy('timestamp');
  const sensorReadings = await db.sensorReadings.where('plantId').equals(plantId).toArray();

  // Get location
  let lat = plant.latitude;
  let lon = plant.longitude;

  if (!lat || !lon) {
     const geoReading = await db.sensorReadings
        .where({ plantId, sensorType: 'geolocation' })
        .last();
     if (geoReading) {
        lat = geoReading.value.latitude;
        lon = geoReading.value.longitude;
        await db.plants.update(plantId, { latitude: lat, longitude: lon });
     }
  }

  let weather = null;
  if (lat && lon) {
     try {
        weather = await getCachedWeather(lat, lon);
     } catch (e) {
        console.error('Weather fetch skipped', e);
     }
  }

  const input: ForecastInput = { plant, checkIns, sensorReadings, weather };
  let forecast = calculateRiskScore(input);

  // Escalate to Gemini if confidence is low
  if (forecast.confidence < 60) {
     forecast = await geminiForecast(input, forecast);
  }

  // Save prediction
  const prediction: Prediction = {
     id: crypto.randomUUID(),
     plantId,
     predictedAt: new Date(),
     riskScore: forecast.riskScore,
     primaryStressor: forecast.primaryStressor,
     confidence: forecast.confidence,
     reasoning: forecast.reasoning,
    triggeredAlert: forecast.alertThreshold !== 'none' ? 1 : 0,
    alertSentAt: forecast.alertThreshold !== 'none' ? new Date() : null,
     outcome: 'pending',
     outcomeRecordedAt: null,
     modelVersion: (forecast as any).modelVersion || 'rule-engine-v1'
  };

  await db.predictions.add(prediction);

  // If critical or warning, generate an Alert record
  if (forecast.alertThreshold !== 'none') {
     await db.alerts.add({
        id: crypto.randomUUID(),
        predictionId: prediction.id,
        plantId,
        title: forecast.alertThreshold === 'critical' ? 'Urgent Biosphere Alert' : 'Preventive Care Protocol',
        body: forecast.reasoning[0] || 'System detected emerging stress pattern.',
        severity: forecast.alertThreshold as any,
        sentAt: new Date(),
        readAt: null,
        actedAt: null,
        dismissedAt: null
     });
  }

  return forecast;
}
