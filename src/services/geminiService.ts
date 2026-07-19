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
}

export async function identifyPlant(base64Image: string): Promise<PlantCare> {
  const response = await fetch("/api/identify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to identify plant");
  }

  return response.json();
}
