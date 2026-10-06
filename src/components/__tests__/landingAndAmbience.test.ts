import { describe, expect, it } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

describe('Landing Page Specification', () => {
  const landing = stripJsComments(readSource('src/components/home/Landing.tsx'));
  const home = stripJsComments(readSource('src/pages/Home.tsx'));

  it('Home statically imports and renders Landing for un-onboarded visitors', () => {
    expect(home).toMatch(/import\s+Landing.*from\s+['"]@\/components\/home\/Landing['"]/);
    expect(home).toMatch(/if\s*\(!onboarded\)\s*\{\s*return\s*<Landing/);
  });

  it('Landing is always bright — zero dark: variant classes', () => {
    // Landing uses a fixed bright palette (#FAF7F2 ground, white cards, --moss-deep buttons)
    // and must never invert on data-theme="night".
    expect(landing).not.toMatch(/\bdark:[a-zA-Z0-9_-]+/);
  });

  it('Landing has an h1 and an accessible file input with label', () => {
    expect(landing).toMatch(/<h1\b/);
    expect(landing).toMatch(/<label\s+htmlFor=["']landing-scan-file-input["']/);
    expect(landing).toMatch(/<input[^>]*id=["']landing-scan-file-input["']/);
  });

  it('Landing dropzone exposes one real button as its interactive control', () => {
    // A synthetic role="button" div wrapping its own trigger kept tripping
    // Label in Name (rendered text vs accessible name) — the keyboard path is
    // a real button now, and drag remains a pointer-only convenience on the
    // surrounding div.
    expect(landing).toMatch(/<button[^>]*>[\s\S]*?Choose Photo[\s\S]*?<\/button>/);
    expect(landing).toMatch(/onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}/);
    expect(landing).not.toMatch(/role=["']button["']/);
  });

  it('Landing inline free scan is wired to prepareScanImage and identifyPlant', () => {
    expect(landing).toContain('prepareScanImage');
    expect(landing).toContain('identifyPlant');
  });

  it('Landing wires NonPlantReport with alwaysBright for non-plant results', () => {
    expect(landing).toContain('NonPlantReport');
    expect(landing).toMatch(/<NonPlantReport[^>]*alwaysBright/);
    expect(landing).toMatch(/isNonPlant/);
  });

  it('Landing wires the guest handoff to restore diagnosis after signup', () => {
    expect(landing).toContain('stashPendingScan');
    expect(landing).toContain('rememberAuthReturn');
  });

  it('Landing includes touch-ergonomic buttons (min-h-[44px])', () => {
    const minH44Count = (landing.match(/min-h-\[44px\]/g) ?? []).length;
    expect(minH44Count).toBeGreaterThanOrEqual(5);
  });
});

describe('Species-Aware Scan Reports & Non-Plant Safeguards', () => {
  const lab = stripJsComments(readSource('src/pages/BotanicalLab.tsx'));
  const clinic = stripJsComments(readSource('src/pages/Clinic.tsx'));
  const server = stripJsComments(readSource('server.ts'));
  const report = stripJsComments(readSource('src/components/scan/NonPlantReport.tsx'));

  it('NonPlantReport covers human, animal, fungus, non_living and other_living profiles', () => {
    expect(report).toContain('Human Subject Profile');
    expect(report).toContain('Fauna Specimen Observed');
    expect(report).toContain('Fungal Specimen Profile');
    expect(report).toContain('Inanimate Subject Detected');
    expect(report).toContain('Non-Botanical Organism');
  });

  it('NonPlantReport supports alwaysBright mode without emitting dark: classes', () => {
    expect(report).toContain('alwaysBright');
    expect(report).toMatch(/const d = \(cls: string\) => \(alwaysBright \? '' : cls\);/);
  });

  it('NonPlantReport renders mycology care parameters for fungus', () => {
    expect(report).toMatch(/Substrate\s+(&amp;|&)\s+Medium/i);
    expect(report).toMatch(/Moisture\s+(&amp;|&)\s+Humidity/i);
    expect(report).toMatch(/Mycology Field Notes/i);
  });

  it('BotanicalLab dispatches NonPlantReport when route or subject.kind or subjectKind is non-plant', () => {
    expect(lab).toContain('NonPlantReport');
    expect(lab).toMatch(/dexResult\?\.route\s*&&\s*dexResult\.route\s*!==\s*'plant'/);
    expect(lab).toMatch(/subjectKind/);
  });

  it('BotanicalLab handleIndexSpecimen strictly blocks non-plant scans from being saved', () => {
    expect(lab).toContain('Only botanical specimens can be indexed to your sanctuary.');
    expect(lab).toMatch(/const isNonPlant = Boolean/);
  });

  it('Clinic renders NonPlantReport instead of a bare amber banner', () => {
    expect(clinic).toContain('NonPlantReport');
    expect(clinic).toMatch(/<NonPlantReport/);
  });

  it('server identify lowers living-kind divert to 0.45 and contains belt-and-braces guard', () => {
    const rawServer = readSource('server.ts');
    expect(rawServer).toMatch(/LIVING_NON_PLANT\.has\(kind\)\s*&&\s*subjectConfidence\s*>=\s*0\.45/);
    expect(rawServer).toMatch(/Belt-and-braces/i);
  });
});

describe('Garden Ambience Celestial & Atmospheric Layers', () => {
  const ambience = stripJsComments(readSource('src/components/GardenAmbience.tsx'));
  const css = readSource('src/styles/garden-ambience.css');
  const tokens = readSource('src/styles/tokens.css');
  const notes = readSource('DESIGN_NOTES.md');

  it('GardenAmbience publishes data-period on root', () => {
    expect(ambience).toMatch(/data-period=\{timePeriod\}/);
  });

  it('GardenAmbience renders time-period conditional layers', () => {
    expect(ambience).toContain('isNightScene');
    expect(ambience).toContain('isSunScene');
    expect(ambience).toContain('isAfternoonScene');
    expect(ambience).toContain('isDuskScene');
    expect(ambience).toContain('garden-moon');
    expect(ambience).toContain('garden-sun-rays');
    expect(ambience).toContain('garden-cloud');
    expect(ambience).toContain('garden-shooting-star');
    expect(ambience).toContain('garden-firefly');
  });

  it('deepened --gradient-night toward blue-green garden night', () => {
    expect(tokens).toMatch(/--gradient-night:\s*linear-gradient\(180deg,\s*#132225\s*0%,\s*#0A1416\s*100%\);/);
  });

  it('all new animated ambient layers are stilled under prefers-reduced-motion and data-still', () => {
    const motionStillMatch = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\}/);
    expect(motionStillMatch).not.toBeNull();
    const mediaBlock = motionStillMatch![1];
    expect(mediaBlock).toContain('.garden-star');
    expect(mediaBlock).toContain('.garden-moon');
    expect(mediaBlock).toContain('.garden-firefly');
    expect(mediaBlock).toContain('.garden-shooting-star');
    expect(mediaBlock).toContain('.garden-sun-rays');
    expect(mediaBlock).toContain('.garden-cloud');

    const dataStillMatch = css.match(/\.garden-ambience\[data-still='true'\]\s+([\s\S]*?)\{/);
    expect(dataStillMatch).not.toBeNull();
    const dataStillBlock = dataStillMatch![0];
    expect(dataStillBlock).toContain('.garden-star');
    expect(dataStillBlock).toContain('.garden-moon');
    expect(dataStillBlock).toContain('.garden-firefly');
    expect(dataStillBlock).toContain('.garden-shooting-star');
    expect(dataStillBlock).toContain('.garden-sun-rays');
    expect(dataStillBlock).toContain('.garden-cloud');
  });

  it('DESIGN_NOTES documents the extended ~45 node looping budget', () => {
    expect(notes).toContain('~45');
    expect(notes).toMatch(/Compositor-only/i);
    expect(notes).toMatch(/Three-path stilling/i);
  });
});
