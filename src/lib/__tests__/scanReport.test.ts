import { describe, expect, it } from 'vitest';
import {
  coerceLegacyToReport,
  guardianScoreFromScan,
  normalizeHealthStatus,
  parseCareText,
  parseWateringIntervalDays,
  shapeScanReport,
  statusLabelFromScore,
  type NonPlantScanReport,
  type PlantScanReport,
  type ScanProvenance,
} from '../scanReport';

const PROVENANCE: ScanProvenance = {
  verdict: 'self_captured',
  checks: { captureMetadata: 'pass', containerForensics: 'clean', modelJudgment: 'clean' },
  reasons: [],
  container: 'jpeg',
  resolution: '2000x1500',
};

const PLANT_MODEL = {
  commonName: 'Monstera',
  scientificName: 'Monstera deliciosa',
  healthStatus: 'Diseased',
  severity: 3,
  diagnosis: 'Leaf blight with chlorotic margins.',
  differentialDiagnosis: [
    { name: 'Leaf blight', confidence: 120, description: 'primary' },
    { name: 'Overwatering', confidence: 0.4, description: 'secondary' },
  ],
  treatmentTimeline: [
    { day: 'Day 1', action: 'Prune affected leaves', expectedOutcome: 'Spread contained' },
  ],
  treatmentInstructions: ['Prune', 'Isolate', 'Treat'],
  careTips: ['Check humidity'],
  watering: 'Water when the top 5cm of soil is dry — currently overwatered',
  light: 'Bright indirect light',
  soil: 'Airy aroid mix',
  temperature: '18-24°C',
  vulnerabilityNotes: 'Prone to root rot.',
  confidence: 0.87,
  locationAdvice: 'Thrives indoors in Pune.',
  seasonalCare: 'Reduce watering in winter.',
  localPestRisks: 'Spider mites in dry summers.',
  climateCompatibility: 'Native to Mexican cloud forests — keep humid.',
};

function shapePlant(overrides: Record<string, unknown> = {}, locationProvided = true) {
  return shapeScanReport({
    model: { ...PLANT_MODEL, ...overrides },
    route: 'plant',
    subject: { kind: 'plant', confidence: 0.95, description: 'A monstera leaf.' },
    provenance: PROVENANCE,
    locationProvided,
  }) as PlantScanReport;
}

describe('plant report shaping', () => {
  it('resolves the name chain once, server-side', () => {
    const r = shapePlant();
    expect(r.displayName).toBe('Monstera');
    expect(r.scientificName).toBe('Monstera deliciosa');
  });

  it('falls back through the name chain and stamps an honest default', () => {
    const r = shapePlant({ commonName: '', scientificName: '' });
    expect(r.displayName).toBe('Botanical Specimen');
    const r2 = shapePlant({ commonName: '', speciesName: 'Monstera deliciosa', scientificName: '' });
    expect(r2.displayName).toBe('Monstera deliciosa');
  });

  it('validates the health status enum and mines free text', () => {
    expect(normalizeHealthStatus('Healthy')).toBe('Healthy');
    expect(normalizeHealthStatus('Fungal Disease')).toBe('Diseased');
    expect(normalizeHealthStatus('Severely infested')).toBe('Infested');
    expect(normalizeHealthStatus('Mild stress')).toBe('Stressed');
    expect(normalizeHealthStatus('')).toBe('Healthy');
  });

  it('clamps the model severity and derives one when omitted', () => {
    expect(shapePlant({ severity: 9 }).severity).toBe(5);
    const omitted = shapePlant({ severity: undefined });
    expect(omitted.severity).toBe(4); // Diseased default
    expect(omitted.vitals.guardianScore).toBe(guardianScoreFromScan('Diseased', null));
  });

  it('maps vitals by the one policy and exposes the dashboard label', () => {
    const r = shapePlant({ severity: 3 });
    expect(r.vitals.guardianScore).toBe(110 - 3 * 18);
    expect(r.vitals.statusLabel).toBe('Watching');
    expect(shapePlant({ severity: 4 }).vitals.statusLabel).toBe('Recovering');
    expect(statusLabelFromScore(95)).toBe('Stable');
    expect(statusLabelFromScore(0)).toBe('Alert');
  });

  it('clamps differential confidences from both scales', () => {
    const r = shapePlant();
    expect(r.differential[0].confidencePct).toBe(100); // 120 clamped
    expect(r.differential[1].confidencePct).toBe(40);  // 0.4 treated as a fraction
  });

  it('computes report confidence from the model, else the top differential, else null', () => {
    expect(shapePlant().confidencePct).toBe(87);
    expect(shapePlant({ confidence: undefined }).confidencePct).toBe(100); // top differential, clamped
    const noSignals = shapePlant({ confidence: undefined, differentialDiagnosis: [] });
    expect(noSignals.confidencePct).toBeNull(); // never an invented 88
  });

  it('mines care text into the enums gameService persists', () => {
    const r = shapePlant();
    expect(r.careParsed).toEqual({ lightLevel: 'Indirect', soilMoisture: 'Wet', temperatureC: 18 });
    expect(parseCareText({ watering: 'keep dry', light: 'low light', temperature: 'none' })).toEqual({
      lightLevel: 'Low',
      soilMoisture: 'Dry',
      temperatureC: null,
    });
    // Fahrenheit strings must not poison the Celsius reading: the explicit
    // Celsius unit wins, and a range contributes its start.
    expect(parseCareText({
      watering: 'keep dry',
      light: 'bright',
      temperature: '65°F to 75°F (18°C to 24°C)',
    }).temperatureC).toBe(18);
    expect(parseCareText({
      watering: 'keep dry',
      light: 'bright',
      temperature: '18-24°C',
    }).temperatureC).toBe(18);
  });

  it('carries the canonical step list: instructions first, careTips as fallback', () => {
    expect(shapePlant().treatmentSteps).toEqual(['Prune', 'Isolate', 'Treat']);
    const fallback = shapePlant({ treatmentInstructions: [] });
    expect(fallback.treatmentSteps).toEqual(['Check humidity']);
  });

  it('gates the location block on the request having carried a location', () => {
    expect(shapePlant().location?.locationAdvice).toBe('Thrives indoors in Pune.');
    expect(shapePlant({}, false).location).toBeNull();
    expect(shapePlant({ locationAdvice: '', seasonalCare: '', localPestRisks: '', climateCompatibility: '' }, true).location).toBeNull();
  });

  it('parses watering text into estimated interval days', () => {
    expect(parseWateringIntervalDays('Water every 5-7 days')).toBe(5);
    expect(parseWateringIntervalDays('Water weekly')).toBe(7);
    expect(parseWateringIntervalDays('Water twice weekly')).toBe(3);
    expect(parseWateringIntervalDays('Water twice a week')).toBe(3);
    expect(parseWateringIntervalDays('Water every other day')).toBe(2);
    expect(parseWateringIntervalDays('Water every 2-3 weeks')).toBe(14);
    expect(parseWateringIntervalDays('Water bi-weekly or every 2 weeks')).toBe(14);
    expect(parseWateringIntervalDays('Water once a month')).toBe(28);
    expect(parseWateringIntervalDays('Mist daily')).toBe(1);
    expect(parseWateringIntervalDays('')).toBe(7);
    expect(shapePlant().wateringIntervalDays).toBe(7);
  });
});

describe('non-plant report shaping', () => {
  it('profiles a human with taxonomy and the boundary notice', () => {
    const r = shapeScanReport({
      model: { commonName: 'Human', scientificName: 'Homo sapiens' },
      route: 'living_non_plant',
      subject: { kind: 'human', confidence: 0.96, description: 'A person\u2019s face fills the frame.' },
      provenance: PROVENANCE,
    }) as NonPlantScanReport;
    expect(r.kind).toBe('human');
    expect(r.profile.title).toBe('Human Subject Profile');
    expect(r.profile.subtitle).toBe('Human (Homo sapiens)');
    expect(r.subject.confidencePct).toBe(96);
    expect(r.mycology).toBeNull();
  });

  it('gives a fungus its mycology block only when the model supplied care fields', () => {
    const withCare = shapeScanReport({
      model: { commonName: 'Oyster mushroom', soil: 'Hardwood sawdust', watering: 'Mist twice daily', careTips: ['Grow in shade'] },
      route: 'living_non_plant',
      subject: { kind: 'fungus', confidence: 0.8, description: '' },
      provenance: PROVENANCE,
    }) as NonPlantScanReport;
    expect(withCare.mycology?.substrate).toBe('Hardwood sawdust');
    expect(withCare.mycology?.fieldNotes).toEqual(['Grow in shade']);

    const bare = shapeScanReport({
      model: {},
      route: 'living_non_plant',
      subject: { kind: 'fungus', confidence: 0.8, description: '' },
      provenance: PROVENANCE,
    }) as NonPlantScanReport;
    expect(bare.mycology).toBeNull();
  });

  it('defaults the inanimate display name and keeps the uncertain kind honest', () => {
    const inanimate = shapeScanReport({
      model: {},
      route: 'non_living',
      subject: { kind: 'non_living', confidence: 0.9, description: 'A coffee mug.' },
      provenance: PROVENANCE,
    }) as NonPlantScanReport;
    expect(inanimate.displayName).toBe('Inanimate object');
    expect(inanimate.profile.title).toBe('Inanimate Subject Detected');

    const uncertain = shapeScanReport({
      model: {},
      route: 'living_non_plant',
      subject: { kind: 'uncertain', confidence: 0.2, description: '' },
      provenance: PROVENANCE,
    }) as NonPlantScanReport;
    expect(uncertain.kind).toBe('uncertain');
    expect(uncertain.profile.chip).toBe('Uncertain Taxonomy');
  });
});

describe('legacy coercion (guest pending-scan restore only)', () => {
  it('coerces a pre-shaper non-plant payload into a shaped report', () => {
    const legacy = {
      route: 'living_non_plant',
      subject: { kind: 'human', subjectConfidence: 0.93, subjectDescription: 'A face.' },
      commonName: 'Human',
      scientificName: 'Homo sapiens',
      message: 'That looks like a person.',
    };
    const r = coerceLegacyToReport(legacy);
    expect(r.kind).toBe('human');
    expect(r.subject.confidencePct).toBe(93);
    expect(r.subject.description).toBe('A face.');
    expect(r.message).toBe('That looks like a person.');
  });

  it('treats a payload with no triage at all as an unverified plant', () => {
    const r = coerceLegacyToReport({ commonName: 'Fern', diagnosis: 'Looks fine.' });
    expect(r.route).toBe('plant');
    expect(r.kind).toBe('plant');
    expect(r.provenance.verdict).toBe('unverified');
  });
});
