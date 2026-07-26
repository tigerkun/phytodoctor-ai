export interface DiagnosticPossibility {
  name: string;
  confidence: number;
  description: string;
}

export interface TimelineStep {
  day: string;
  action: string;
  expectedOutcome: string;
}

export interface PlantCare {
  speciesName?: string;
  commonName: string;
  scientificName: string;
  healthStatus: "Healthy" | "Stressed" | "Diseased" | "Infested";
  severity: 1 | 2 | 3 | 4 | 5;
  diagnosis: string;
  differentialDiagnosis: DiagnosticPossibility[];
  treatmentTimeline: TimelineStep[];
  treatmentInstructions: string[];
  watering: string;
  light: string;
  soil: string;
  temperature: string;
  careTips: string[];
  vulnerabilityNotes: string;
  // Location-aware fields
  locationAdvice?: string;
  seasonalCare?: string;
  localPestRisks?: string;
  climateCompatibility?: string;
}

export interface LocationContext {
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  weather?: {
    temp: number;
    humidity: number;
    condition: string;
    windSpeed?: number;
  };
}

export async function identifyPlant(base64Image: string, location?: LocationContext): Promise<PlantCare> {
  const response = await fetch("/api/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image, location }),
  });

  if (response.ok) {
    return await response.json();
  }

  // Surface real error to caller — never swallow it with fake data
  let errorMsg = `Server error (${response.status})`;
  try {
    const parsed = await response.json();
    errorMsg = parsed.error || errorMsg;
  } catch {
    errorMsg = await response.text().then(t => t.substring(0, 200)) || errorMsg;
  }
  throw new Error(errorMsg);
}
