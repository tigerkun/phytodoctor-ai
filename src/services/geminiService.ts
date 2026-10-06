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

// The report contract lives in src/lib/scanReport — one shape shared by the
// server (which produces it) and every client surface (which renders it).
export type { ScanReport, PlantScanReport, NonPlantScanReport } from '../lib/scanReport';
import { coerceLegacyToReport, type ScanReport } from '../lib/scanReport';
export { coerceLegacyToReport };

/**
 * Identify a plant from a photo.
 *
 * The server caps each Gemini attempt at 60s and falls through up to four
 * models, so a scan can legitimately run for minutes on a cold path. Without
 * a client-side deadline the fetch hung until the browser gave up on its own
 * schedule and the UI sat on a spinner with no way to tell a slow scan from a
 * dead one. 120s is comfortably past the worst server-side case, so this only
 * fires when the connection itself is stuck.
 */
const IDENTIFY_TIMEOUT_MS = 120_000;

/**
 * What the scan found before any botany: the subject triage and the photo's
 * provenance ride along on every plant response, and a non-plant scan swaps
 * the botanical payload for a route + message instead.
 */
export interface IdentifySubject {
  kind: string;
  subjectKind?: string;
  confidence: number;
  description?: string;
}

export interface IdentifyProvenance {
  verdict: 'self_captured' | 'unverified' | 'likely_synthetic';
  checks: {
    captureMetadata: 'pass' | 'absent';
    containerForensics: 'clean' | 'flagged';
    modelJudgment: 'clean' | 'flagged' | 'absent';
  };
  reasons: string[];
  container: string;
  resolution: string | null;
}

export type IdentifyResult = PlantCare & {
  /** Absent on payloads from before the triage existed; treated as plant. */
  route?: 'plant' | 'non_living' | 'living_non_plant';
  subject?: IdentifySubject;
  subjectKind?: string;
  provenance?: IdentifyProvenance;
  /** Human-readable explanation, present on the non-plant routes. */
  message?: string;
  /**
   * The backend-shaped, versioned report. Live responses always carry it —
   * /api/identify shapes every route server-side, and this is what surfaces
   * should render. Only the guest pending-scan restore path can lack it,
   * where identifyPlant coerces the legacy payload instead.
   */
  report: ScanReport;
};

export async function identifyPlant(base64Image: string, location?: LocationContext): Promise<IdentifyResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IDENTIFY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("/api/identify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem('botanical_guardian_auth_token') || ''}`,
      },
      body: JSON.stringify({ image: base64Image, location }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new Error('The scan took too long and was cancelled. Check your connection and try again.');
    }
    throw new Error('Could not reach the analysis service. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) {
    const parsed = await response.json();
    // Live responses always carry the server-shaped report. A payload without
    // one can only be a legacy scan restored from the guest handoff — coerce
    // it once here so every consumer can rely on `.report` existing.
    if (parsed?.report) return parsed as IdentifyResult;
    return { ...parsed, report: coerceLegacyToReport(parsed) } as IdentifyResult;
  }

  // Surface real error to caller — never swallow it with fake data
  let errorMsg = `Server error (${response.status})`;
  try {
    const rawText = await response.text();
    try {
      const parsed = JSON.parse(rawText);
      errorMsg = parsed.error || errorMsg;
    } catch {
      errorMsg = rawText.substring(0, 200) || errorMsg;
    }
  } catch {
    // Fall back to default status message if text read fails
  }
  throw new Error(errorMsg);
}
