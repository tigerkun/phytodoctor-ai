import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openingTags, classNameOf, stripJsComments } from '../../test/helpers';

const widgetSource = readFileSync(
  join(process.cwd(), 'src/components/scan/RecoveryRoadmapWidget.tsx'),
  'utf8'
);
const telemetrySource = readFileSync(
  join(process.cwd(), 'src/components/scan/PlantTelemetryCard.tsx'),
  'utf8'
);
const plantDetailSource = readFileSync(
  join(process.cwd(), 'src/pages/PlantDetail.tsx'),
  'utf8'
);
const labSource = readFileSync(
  join(process.cwd(), 'src/pages/BotanicalLab.tsx'),
  'utf8'
);
const historySource = readFileSync(
  join(process.cwd(), 'src/components/scan/ScanHistoryPanel.tsx'),
  'utf8'
);
const dbSource = readFileSync(
  join(process.cwd(), 'src/db/database.ts'),
  'utf8'
);
const plantServiceSource = readFileSync(
  join(process.cwd(), 'src/services/plantService.ts'),
  'utf8'
);

describe('Recovery Roadmap Generative UI and Dexie persistence structure', () => {
  it('the scan found all relevant source files to check', () => {
    expect(widgetSource.length).toBeGreaterThan(100);
    expect(telemetrySource.length).toBeGreaterThan(100);
    expect(plantDetailSource.length).toBeGreaterThan(100);
    expect(labSource.length).toBeGreaterThan(100);
    expect(historySource.length).toBeGreaterThan(100);
    expect(dbSource.length).toBeGreaterThan(100);
    expect(plantServiceSource.length).toBeGreaterThan(100);
  });

  it('all interactive buttons in RecoveryRoadmapWidget meet the 44px touch target minimum', () => {
    const cleanWidget = stripJsComments(widgetSource);
    const tags = openingTags(cleanWidget).filter(t => t.tag.startsWith('<button'));
    expect(tags.length).toBeGreaterThanOrEqual(6);

    const tooSmall = tags
      .map(t => classNameOf(t.tag))
      .flatMap(cls => [...cls.matchAll(/min-h-\[(\d+)px\]/g)].map(m => m[0]))
      .filter(declared => Number(declared.match(/\d+/)![0]) < 44);

    expect(tooSmall, `under-sized controls in RecoveryRoadmapWidget: ${tooSmall.join(', ')}`).toEqual([]);
  });

  it('RecoveryRoadmapWidget controls declare explicit accessibility aria-labels', () => {
    const cleanWidget = stripJsComments(widgetSource);
    const buttons = openingTags(cleanWidget).filter(t => t.tag.startsWith('<button'));
    const labeledButtons = buttons.filter(t => t.tag.includes('aria-label='));
    expect(labeledButtons.length).toBeGreaterThanOrEqual(4);

    const inputs = openingTags(cleanWidget).filter(t => t.tag.startsWith('<input'));
    for (const input of inputs) {
      expect(input.tag).toMatch(/aria-label="[^"]+"/);
    }
  });

  it('RecoveryRoadmapWidget renders adherence ring, relative timestamps, and biological outcome', () => {
    const cleanWidget = stripJsComments(widgetSource);
    expect(cleanWidget).toContain('adherenceMetrics.adherencePct');
    expect(cleanWidget).toContain('strokeDasharray');
    expect(cleanWidget).toContain('strokeDashoffset');
    expect(cleanWidget).toContain('formatRelativeTime');
    expect(cleanWidget).toContain('expectedOutcome');
  });

  it('PlantTelemetryCard has persisted recovery roadmap with 44px touch targets', () => {
    const cleanTelemetry = stripJsComments(telemetrySource);
    expect(cleanTelemetry).toContain('TreatmentService');
    expect(cleanTelemetry).toContain('loadSavedActions');
    expect(cleanTelemetry).toContain('toggleStep');
    expect(cleanTelemetry).toContain('formatRelativeTime');

    const tags = openingTags(cleanTelemetry).filter(t => t.tag.startsWith('<button'));
    expect(tags.length).toBeGreaterThanOrEqual(4);

    const tooSmall = tags
      .map(t => classNameOf(t.tag))
      .flatMap(cls => [...cls.matchAll(/min-h-\[(\d+)px\]/g)].map(m => m[0]))
      .filter(declared => Number(declared.match(/\d+/)![0]) < 44);

    expect(tooSmall, `under-sized controls in PlantTelemetryCard: ${tooSmall.join(', ')}`).toEqual([]);
  });

  it('PlantDetail embeds RecoveryRoadmapWidget with treatmentTimeline in health timeline tab', () => {
    const cleanDetail = stripJsComments(plantDetailSource);
    expect(cleanDetail).toContain('RecoveryRoadmapWidget');
    expect(cleanDetail).toContain('treatmentTimeline');
    expect(cleanDetail).toContain('Clinical Rehabilitation &amp; Roadmap Trajectory');
    expect(cleanDetail).toContain('onActionToggled');
  });

  it('BotanicalLab passes plantId to PlantTelemetryCard and associates scan actions upon indexing', () => {
    const cleanLab = stripJsComments(labSource);
    expect(cleanLab).toMatch(/<PlantTelemetryCard report=\{dexResult\.report\}[\s\S]*?plantId=\{dexResult\?\.plantId/);
    expect(cleanLab).toContain('associateScanWithPlant((plantReport as any)?.id, plant.id, species)');
    expect(cleanLab).toContain('onIndexPlant={async (report, scanId) =>');
  });

  it('ScanHistoryPanel passes scanId and plantId to PlantTelemetryCard and binds indexed plant ID', () => {
    const cleanHistory = stripJsComments(historySource);
    expect(cleanHistory).toContain('scanId={item.id}');
    expect(cleanHistory).toContain('plantId=');
    expect(cleanHistory).toContain('(plant as any).id = (indexed as any).id');
    expect(cleanHistory).toContain('onIndexPlant(plant, item.id)');
  });

  it('database declares treatmentActions table and schema version 23', () => {
    const cleanDb = stripJsComments(dbSource);
    expect(cleanDb).toMatch(/treatmentActions!\s*:\s*Table<TreatmentActionRecord>/);
    expect(cleanDb).toMatch(/version\(23\)\.stores\(\{\s*treatmentActions:\s*'id, plantId, targetKey, completedAt, \[plantId\+targetKey\]'/);
  });

  it('PlantService preserves recoveryRoadmap locally across remote merges and specimen creation', () => {
    const cleanService = stripJsComments(plantServiceSource);
    expect(cleanService).toContain('local.recoveryRoadmap');
    expect(cleanService).toContain('recoveryRoadmap: input.recoveryRoadmap ?? null');
  });
});
