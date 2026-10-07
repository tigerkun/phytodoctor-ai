import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openingTags, classNameOf, stripJsComments } from '../../test/helpers';

const telemetrySource = readFileSync(
  join(process.cwd(), 'src/components/scan/PlantTelemetryCard.tsx'),
  'utf8'
);
const labSource = readFileSync(
  join(process.cwd(), 'src/pages/BotanicalLab.tsx'),
  'utf8'
);
const plantDetailSource = readFileSync(
  join(process.cwd(), 'src/pages/PlantDetail.tsx'),
  'utf8'
);

describe('PlantTelemetryCard generative UI structure and safety', () => {
  it('the scan found files to check', () => {
    expect(telemetrySource.length).toBeGreaterThan(100);
    expect(labSource.length).toBeGreaterThan(100);
    expect(plantDetailSource.length).toBeGreaterThan(100);
  });

  it('all interactive buttons in PlantTelemetryCard meet the 44px touch minimum', () => {
    const tags = openingTags(stripJsComments(telemetrySource)).filter(
      t => t.tag.startsWith('<button')
    );
    expect(tags.length).toBeGreaterThanOrEqual(4);

    const tooSmall = tags
      .map(t => classNameOf(t.tag))
      .flatMap(cls => [...cls.matchAll(/min-h-\[(\d+)px\]/g)].map(m => m[0]))
      .filter(declared => Number(declared.match(/\d+/)![0]) < 44);

    expect(tooSmall, `under-sized controls in PlantTelemetryCard: ${tooSmall.join(', ')}`).toEqual([]);
  });

  it('all range inputs declare explicit accessibility labels', () => {
    const rangeInputs = openingTags(stripJsComments(telemetrySource), ['<input']).filter(
      t => t.tag.includes('type="range"')
    );
    expect(rangeInputs.length).toBeGreaterThanOrEqual(2);
    for (const input of rangeInputs) {
      expect(input.tag).toMatch(/aria-label="[^"]+"/);
    }
  });

  it('defensively accesses careParsed and vitals against partial or legacy reports', () => {
    expect(telemetrySource).toContain('report?.careParsed');
    expect(telemetrySource).toContain('report?.vitals');
    expect(telemetrySource).not.toMatch(/report\.careParsed\./);
  });

  it('BotanicalLab strictly guards PlantTelemetryCard against null dexResult during upload', () => {
    const cleanLab = stripJsComments(labSource);
    expect(cleanLab).toMatch(/\{dexResult\?\.report\?\.kind === 'plant' && \(\s*<PlantTelemetryCard report=\{dexResult\.report\}/);
  });

  it('PlantDetail differentiates overdue hydration vs due today with distinct states', () => {
    const cleanDetail = stripJsComments(plantDetailSource);
    expect(cleanDetail).toMatch(/daysUntilWater < 0\s*\?/);
    expect(cleanDetail).toContain('Overdue by');
    expect(cleanDetail).toContain('Water due today');
  });

  it('PlantDetail microclimate light controls meet the 44px touch minimum', () => {
    const cleanDetail = stripJsComments(plantDetailSource);
    const workbenchLight = cleanDetail.match(/setSimLight\(l\)[^>]*className=\{`([^`]+)`\}/);
    expect(workbenchLight).not.toBeNull();
    expect(workbenchLight![1]).toContain('min-h-[44px]');
  });

  it('PlantTelemetryCard supports live ambient weather seeding and displays the (Live) badge', () => {
    const cleanTelemetry = stripJsComments(telemetrySource);
    expect(cleanTelemetry).toContain('hasLiveWeather');
    expect(cleanTelemetry).toContain('(Live)');
    expect(cleanTelemetry).toContain('ambientWeather');
  });

  it('BotanicalLab passes scan ambientWeather into PlantTelemetryCard', () => {
    const cleanLab = stripJsComments(labSource);
    expect(cleanLab).toContain('ambientWeather=');
    expect(cleanLab).toContain('dexResult.report.weather');
  });

  it('PlantDetail seeds microclimate from latest check-in or location weather and provides accessible Reset Baseline', () => {
    const cleanDetail = stripJsComments(plantDetailSource);
    expect(cleanDetail).toContain('latestCheckIn?.weatherTemp');
    expect(cleanDetail).toContain('latestCheckIn?.weatherHumidity');
    expect(cleanDetail).toContain('getCachedWeather');
    expect(cleanDetail).toContain('Reset Baseline');

    const resetBtn = cleanDetail.match(/Reset Baseline[\s\S]*?<\/button>/) || cleanDetail.match(/<button[^>]*>[^<]*Reset Baseline/);
    expect(resetBtn).not.toBeNull();
    expect(cleanDetail).toMatch(/Reset Baseline[\s\S]*?min-h-\[44px\]|<button[^>]*min-h-\[44px\][^>]*>[^<]*Reset Baseline/);
  });
});
