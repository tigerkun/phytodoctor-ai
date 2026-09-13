export interface PlantVoice {
  message: string;
  tone: 'content' | 'concerned' | 'urgent';
  suggestedAction?: string;
}

export async function generatePlantVoice(input: {
  diagnosis: { primarySymptom?: string; diagnosis?: string };
  plantName: string;
  species: string;
  driftStatus: 'stable' | 'declining' | 'critical';
  previousMessage?: string;
}): Promise<PlantVoice> {
  const response = await fetch('/api/plant-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Plant voice is unavailable.');
  return data;
}
