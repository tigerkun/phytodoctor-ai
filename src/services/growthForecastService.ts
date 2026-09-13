export interface GrowthForecast {
  hasEnoughData: boolean;
  currentTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  ifUnchanged: { timeframe: string; prediction: string } | null;
  ifFixed: { fix: string; timeframe: string; prediction: string } | null;
  confidence: 'low' | 'medium' | 'high';
}

export async function forecastGrowth(input: {
  plantId: string;
  species: string;
  checkInHistory: Array<{ date: string; driftScore: number | null; driftStatus: string | null; symptoms: string[] }>;
}): Promise<GrowthForecast> {
  const response = await fetch('/api/predict-growth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Forecast unavailable.');
  return data;
}
