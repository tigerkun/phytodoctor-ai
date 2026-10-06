/**
 * The canonical scan-report shaper.
 *
 * /api/identify used to return Gemini's JSON with two numeric clamps and a
 * triage stamp, and every client surface then improvised its own report:
 * four divergent isNonPlant checks, invented care values ("Moist",
 * "Indirect bright"), an invented 88% confidence, keyword-sniffed severity,
 * and `treatmentInstructions`↔`careTips` treated as interchangeable. This
 * module owns all of that in one place, on the server, where the analysis
 * actually happens. Clients render `ScanReport`; they do not reshape it.
 *
 * Pure on purpose — no imports from express, supabase or the DOM — so it is
 * unit-testable and importable from both server.ts and the client bundle
 * (the client re-uses the types and the legacy coercion helper only).
 */

import { clampPercent, clampTo, hasScore } from './scoreGuards';

export type ScanRoute = 'plant' | 'living_non_plant' | 'non_living';

export type SubjectKind =
  | 'plant'
  | 'human'
  | 'animal'
  | 'fungus'
  | 'other_living'
  | 'non_living'
  | 'uncertain';

export type HealthStatus = 'Healthy' | 'Stressed' | 'Diseased' | 'Infested';
export type StatusLabel = 'Stable' | 'Watching' | 'Recovering' | 'Alert';

export interface ScanProvenance {
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

export interface ScanReportBase {
  reportVersion: 1;
  route: ScanRoute;
  kind: SubjectKind;
  /** 0–100 integer — the client never converts scales again. */
  subject: { confidencePct: number; description: string };
  /** The name chain (`commonName || speciesName || scientificName`) resolved once, here. */
  displayName: string;
  scientificName: string;
  provenance: ScanProvenance;
  message?: string;
}

export interface PlantScanReport extends ScanReportBase {
  kind: 'plant';
  healthStatus: HealthStatus;
  severity: 1 | 2 | 3 | 4 | 5;
  diagnosis: string;
  differential: { name: string; confidencePct: number; description: string }[];
  timeline: { day: string; action: string; expectedOutcome: string }[];
  /** The one canonical action list: treatment instructions, falling back to careTips. */
  treatmentSteps: string[];
  careTips: string[];
  care: { watering: string; light: string; soil: string; temperature: string };
  /** Care text mined into enums server-side — gameService used to do this per call. */
  careParsed: {
    lightLevel: 'Direct' | 'Indirect' | 'Low';
    soilMoisture: 'Dry' | 'Wet' | 'Moist';
    temperatureC: number | null;
  };
  vulnerabilityNotes: string;
  vitals: { guardianScore: number; statusLabel: StatusLabel };
  /** Model-level, else the top differential, else null — never an invented number. */
  confidencePct: number | null;
  location: {
    locationAdvice: string;
    seasonalCare: string;
    localPestRisks: string;
    climateCompatibility: string;
  } | null;
}

export interface NonPlantProfile {
  title: string;
  subtitle: string;
  chip: string;
  notice: string;
}

export interface NonPlantScanReport extends ScanReportBase {
  kind: Exclude<SubjectKind, 'plant'>;
  profile: NonPlantProfile;
  /** Fungus only: the model's care fields, re-labelled as habitat parameters. */
  mycology: {
    substrate: string;
    moisture: string;
    temperature: string;
    light: string;
    fieldNotes: string[];
  } | null;
}

export type ScanReport = PlantScanReport | NonPlantScanReport;

export interface ShapeScanReportInput {
  /** The raw parsed model payload, untouched. */
  model: Record<string, any>;
  route: ScanRoute;
  subject: { kind: string; confidence: number; description: string };
  provenance: ScanProvenance;
  /** Whether the request carried a location block — gates the location fields. */
  locationProvided?: boolean;
  message?: string;
}

const KIND_LABELS: Record<string, string> = {
  human: 'Human',
  animal: 'Animal',
  fungus: 'Fungus',
  other_living: 'Living organism',
  non_living: 'Inanimate object',
  uncertain: 'Unclassified subject',
};

const NON_PLANT_KINDS: readonly SubjectKind[] = ['human', 'animal', 'fungus', 'other_living', 'non_living', 'uncertain'];

/** A trimmed non-empty string, else the fallback. */
function str(value: unknown, fallback = ''): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > 0 ? s : fallback;
}

/** Turns a fraction (0-1) or a percentage (0-100) into a 0-100 integer. */
function toConfidencePct(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const pct = n > 1 ? n : n * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

export function normalizeHealthStatus(raw: unknown): HealthStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'healthy' || s === 'stressed' || s === 'diseased' || s === 'infested') {
    return s.charAt(0).toUpperCase() + s.slice(1) as HealthStatus;
  }
  // Free-text statuses ("Fungal Disease", "Mild stress") are mined by keyword —
  // the same heuristic Clinic used to run privately, now the one policy.
  if (s.includes('infest')) return 'Infested';
  if (s.includes('diseas')) return 'Diseased';
  if (s.includes('stress') || s.includes('wilt')) return 'Stressed';
  return 'Healthy';
}

/** severity defaults when the model omitted one, derived from the status. */
function severityFromStatus(status: HealthStatus): 1 | 2 | 3 | 4 | 5 {
  switch (status) {
    case 'Infested':
    case 'Diseased':
      return 4;
    case 'Stressed':
      return 2;
    default:
      return 1;
  }
}

/**
 * healthStatus/severity → a 0-100 guardian score, and the score → the
 * dashboard's status label. This used to live in gameService (`scoreFromScan`)
 * while Clinic re-derived parts of it by substring; it is the one policy now.
 */
export function guardianScoreFromScan(status: HealthStatus, severity: number | null): number {
  if (severity !== null && severity !== undefined) {
    return Math.max(8, Math.min(99, 110 - severity * 18));
  }
  const map: Record<HealthStatus, number> = { Healthy: 92, Stressed: 68, Diseased: 45, Infested: 28 };
  return map[status];
}

export function statusLabelFromScore(score: number): StatusLabel {
  if (score >= 80) return 'Stable';
  if (score >= 55) return 'Watching';
  if (score >= 35) return 'Recovering';
  return 'Alert';
}

/** Care text → the enums the dashboard stores. Moved out of gameService. */
export function parseCareText(care: { watering: string; light: string; temperature: string }) {
  const lightLevel = /indirect|filtered|sheer/i.test(care.light)
    ? 'Indirect'
    : /low|shade/i.test(care.light)
      ? 'Low'
      : /direct|full sun/i.test(care.light)
        ? 'Direct'
        : 'Indirect';
  // An explicit overwatering statement outranks watering ADVICE that happens
  // to contain the word "dry" ("water when the top 5cm is dry — currently
  // overwatered" is a wet pot, and the old ordering called it dry).
  const soilMoisture = /overwater/i.test(care.watering)
    ? 'Wet'
    : /dry|underwater/i.test(care.watering)
      ? 'Dry'
      : /wet|waterlog|soggy/i.test(care.watering)
        ? 'Wet'
        : 'Moist';
  // Celsius first when the string offers both scales ("65°F to 75°F
  // (18°C to 24°C)") — the bare digits would otherwise store Fahrenheit.
  const celsius = care.temperature.match(/(-?\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?))?\s*(?:°\s*)?C\b/i);
  if (celsius) {
    return {
      lightLevel: lightLevel as 'Direct' | 'Indirect' | 'Low',
      soilMoisture: soilMoisture as 'Dry' | 'Wet' | 'Moist',
      temperatureC: Number(celsius[1]),
    };
  }
  const tempMatch = care.temperature.match(/-?\d+(?:\.\d+)?/);
  return {
    lightLevel: lightLevel as 'Direct' | 'Indirect' | 'Low',
    soilMoisture: soilMoisture as 'Dry' | 'Wet' | 'Moist',
    temperatureC: tempMatch ? Number(tempMatch[0]) : null,
  };
}

function nonPlantProfile(
  kind: Exclude<SubjectKind, 'plant'>,
  displayName: string,
  scientificName: string,
): NonPlantProfile {
  switch (kind) {
    case 'human':
      return {
        title: 'Human Subject Profile',
        subtitle: scientificName && scientificName !== displayName
          ? `${displayName} (${scientificName})`
          : displayName || scientificName || 'Homo sapiens',
        chip: 'Homo sapiens · Biological Subject',
        notice: 'This clinic diagnoses botanical specimens only. No plant pathology or horticultural care plan can be generated for human subjects.',
      };
    case 'animal':
      return {
        title: 'Fauna Specimen Observed',
        subtitle: scientificName && scientificName !== displayName
          ? `${displayName} (${scientificName})`
          : displayName || scientificName || 'Animalia',
        chip: 'Kingdom Animalia · Fauna',
        notice: 'PhytoDoctor AI specializes exclusively in flora. For animal wellbeing, seek professional veterinary care.',
      };
    case 'fungus':
      return {
        title: 'Fungal Specimen Profile',
        subtitle: displayName !== 'Fungus' ? displayName : scientificName || 'Kingdom Fungi',
        chip: 'Kingdom Fungi · Mycology',
        notice: 'Fungi belong to kingdom Fungi, biologically distinct from plants. Standard botanical therapies do not apply, but habitat parameters below are mycology-grade.',
      };
    case 'non_living':
      return {
        title: 'Inanimate Subject Detected',
        subtitle: displayName,
        chip: 'Non-Living Material',
        notice: 'Only living specimens can be analysed. Point the lens at a live leaf, stem, flower or tree to receive a botanical diagnosis.',
      };
    case 'other_living':
      return {
        title: 'Non-Botanical Organism',
        subtitle: displayName,
        chip: 'Living Organism · Non-Plant',
        notice: 'This specimen appears to be a living organism outside the plant kingdom. PhytoDoctor AI provides clinical analysis for plants only.',
      };
    default:
      return {
        title: 'Non-Plant Specimen',
        subtitle: displayName,
        chip: 'Uncertain Taxonomy',
        notice: 'PhytoDoctor AI diagnoses plants only. Please submit an image focused clearly on a botanical subject.',
      };
  }
}

export function shapeScanReport(input: ShapeScanReportInput): ScanReport {
  const { model, route, subject, provenance } = input;
  // The canonical verdict. A plant route is a plant report even when the
  // model's own triage came back 'uncertain' — the divert gates already
  // decided this payload belongs to the botanical flow.
  const kind: SubjectKind = route === 'plant'
    ? 'plant'
    : (NON_PLANT_KINDS.includes(subject.kind as SubjectKind)
        ? (subject.kind as SubjectKind)
        : 'uncertain');

  const confidencePct = toConfidencePct(subject.confidence) ?? 0;
  const description = str(subject.description);

  const scientificName = str(model.scientificName ?? model.scientific);
  const displayName = str(model.commonName)
    || str(model.speciesName)
    || scientificName
    || (route === 'plant' ? 'Botanical Specimen' : KIND_LABELS[kind] || 'Unclassified subject');

  const base: ScanReportBase = {
    reportVersion: 1,
    route,
    kind,
    subject: { confidencePct, description },
    displayName,
    scientificName,
    provenance,
    ...(input.message ? { message: input.message } : {}),
  };

  if (route === 'plant') {
    const healthStatus = normalizeHealthStatus(model.healthStatus);
    const severity = (hasScore(model.severity)
      ? clampTo(model.severity, 1, 5, 1)
      : severityFromStatus(healthStatus)) as 1 | 2 | 3 | 4 | 5;

    const differential = (Array.isArray(model.differentialDiagnosis) ? model.differentialDiagnosis : [])
      .slice(0, 6)
      .map((d: any) => ({
        name: str(d?.name, 'Unnamed suspect'),
        confidencePct: toConfidencePct(d?.confidence) ?? 0,
        description: str(d?.description),
      }));

    const careTips = (Array.isArray(model.careTips) ? model.careTips : [])
      .filter((t: unknown) => str(t))
      .map((t: unknown) => str(t));
    const instructions = (Array.isArray(model.treatmentInstructions) ? model.treatmentInstructions : [])
      .filter((t: unknown) => str(t))
      .map((t: unknown) => str(t));

    const care = {
      watering: str(model.watering),
      light: str(model.light),
      soil: str(model.soil),
      temperature: str(model.temperature),
    };

    const guardianScore = guardianScoreFromScan(
      healthStatus,
      hasScore(model.severity) ? severity : null,
    );
    const confidence =
      toConfidencePct(model.confidence) ??
      (differential.length > 0 ? differential[0].confidencePct : null);

    const locationFields = {
      locationAdvice: str(model.locationAdvice),
      seasonalCare: str(model.seasonalCare),
      localPestRisks: str(model.localPestRisks),
      climateCompatibility: str(model.climateCompatibility),
    };
    const hasLocation = input.locationProvided === true &&
      Object.values(locationFields).some(v => v.length > 0);

    return {
      ...base,
      kind: 'plant',
      healthStatus,
      severity,
      diagnosis: str(model.diagnosis),
      differential,
      timeline: (Array.isArray(model.treatmentTimeline) ? model.treatmentTimeline : [])
        .slice(0, 8)
        .map((s: any) => ({
          day: str(s?.day),
          action: str(s?.action),
          expectedOutcome: str(s?.expectedOutcome),
        })),
      treatmentSteps: instructions.length > 0 ? instructions.slice(0, 10) : careTips.slice(0, 10),
      careTips: careTips.slice(0, 8),
      care,
      careParsed: parseCareText(care),
      vulnerabilityNotes: str(model.vulnerabilityNotes),
      vitals: { guardianScore, statusLabel: statusLabelFromScore(guardianScore) },
      confidencePct: confidence,
      location: hasLocation ? locationFields : null,
    };
  }

  const nonPlantKind = kind as Exclude<SubjectKind, 'plant'>;
  const mycology = nonPlantKind === 'fungus'
    ? (str(model.soil) || str(model.watering) || str(model.temperature) || str(model.light) ||
       (Array.isArray(model.careTips) && model.careTips.some((t: unknown) => str(t))))
      ? {
          substrate: str(model.soil),
          moisture: str(model.watering),
          temperature: str(model.temperature),
          light: str(model.light),
          fieldNotes: (Array.isArray(model.careTips) ? model.careTips : [])
            .filter((t: unknown) => str(t))
            .map((t: unknown) => str(t))
            .slice(0, 4),
        }
      : null
    : null;

  return {
    ...base,
    kind: nonPlantKind,
    profile: nonPlantProfile(nonPlantKind, displayName, scientificName),
    mycology,
  };
}

/**
 * Adapts a pre-shaper payload (a guest scan stashed before this contract
 * existed, restored from sessionStorage) into the closest ScanReport. The
 * restore path is the only legitimate caller — live responses are always
 * shaped server-side.
 */
export function coerceLegacyToReport(legacy: any): ScanReport {
  const subject = legacy?.subject || {};
  const subjectKind = String(
    subject.kind || subject.subjectKind || legacy?.subjectKind || 'uncertain'
  ).toLowerCase();
  // BUG-11: When legacy.route is absent (scans stashed before the shaper
  // existed), infer the route from subject.kind rather than blindly defaulting
  // to 'plant'. A stored non-plant result would otherwise be reshaped as a
  // plant report and render vitals that don't exist.
  const NON_LIVING_KINDS = new Set(['non_living']);
  const LIVING_NON_PLANT_KINDS = new Set(['fungus', 'animal', 'human', 'other_living']);
  const route: ScanRoute =
    legacy?.route === 'non_living' || legacy?.route === 'living_non_plant'
      ? legacy.route
      : NON_LIVING_KINDS.has(subjectKind)
        ? 'non_living'
        : LIVING_NON_PLANT_KINDS.has(subjectKind)
          ? 'living_non_plant'
          : 'plant';
  return shapeScanReport({
    model: legacy,
    route,
    subject: {
      kind: subjectKind,
      confidence: Number(subject.confidence ?? subject.subjectConfidence ?? 0),
      description: str(subject.description ?? subject.subjectDescription ?? legacy?.message),
    },
    provenance: legacy?.provenance ?? {
      verdict: 'unverified',
      checks: { captureMetadata: 'absent', containerForensics: 'clean', modelJudgment: 'absent' },
      reasons: [],
      container: '',
      resolution: null,
    },
    message: str(legacy?.message) || undefined,
  });
}
