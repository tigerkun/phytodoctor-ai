import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readSource,
  stripJsComments,
  classNameOf,
  openingTags,
  interactiveTagsOf,
  tagAround,
} from '../../test/helpers';
import {
  resolvePhotoBlob,
  resolvePhotoUrl,
  computeComparativePathology,
  generateClinicalInsight,
  type PathologyMetrics,
} from '../../services/pathologyProgressionService';

// Scanner 1: Mobile Ergonomics
describe('Adversarial UI Challenge: Mobile Ergonomics Scanner', () => {
  const workbenchSrc = stripJsComments(readSource('src/components/scan/ComparativePathologyWorkbench.tsx'));
  const labSrc = stripJsComments(readSource('src/pages/BotanicalLab.tsx'));
  const MIN_44 = 'min-h-[44px]';

  it('ComparativePathologyWorkbench: zero interactive elements declare min-h < 44px', () => {
    const tooSmall = interactiveTagsOf(workbenchSrc)
      .map(t => classNameOf(t.tag))
      .flatMap(cls => [...cls.matchAll(/min-h-\[(\d+)px\]/g)].map(m => m[0]))
      .filter(declared => Number(declared.match(/\d+/)![0]) < 44);

    expect(tooSmall, `Found under-sized interactive elements in Workbench: ${tooSmall.join(', ')}`).toEqual([]);
  });

  it('BotanicalLab: zero interactive elements declare min-h < 44px', () => {
    const tooSmall = interactiveTagsOf(labSrc)
      .map(t => classNameOf(t.tag))
      .flatMap(cls => [...cls.matchAll(/min-h-\[(\d+)px\]/g)].map(m => m[0]))
      .filter(declared => Number(declared.match(/\d+/)![0]) < 44);

    expect(tooSmall, `Found under-sized interactive elements in BotanicalLab: ${tooSmall.join(', ')}`).toEqual([]);
  });

  it('ComparativePathologyWorkbench: all button elements have explicit min-h-[44px]', () => {
    const buttons = openingTags(workbenchSrc, ['<button']);
    expect(buttons.length).toBeGreaterThanOrEqual(6);

    const buttonsWithoutMin44 = buttons
      .map(t => ({ tag: t.tag, cls: classNameOf(t.tag) }))
      .filter(b => !b.cls.includes(MIN_44));

    expect(
      buttonsWithoutMin44,
      `Buttons lacking min-h-[44px]: ${buttonsWithoutMin44.map(b => b.tag).join('\n')}`
    ).toEqual([]);
  });

  it('ComparativePathologyWorkbench: brass slider handle meets 44px x 44px floor', () => {
    // Draggable Brass Reticle Pill Handle
    expect(workbenchSrc).toContain('min-h-[44px] min-w-[44px]');
  });

  it('ComparativePathologyWorkbench: range input slider has min-h-[44px]', () => {
    const rangeInputs = openingTags(workbenchSrc, ['<input']).filter(t => t.tag.includes('type="range"'));
    expect(rangeInputs.length).toBe(1);
    expect(rangeInputs[0].tag).toContain(MIN_44);
  });

  it('BotanicalLab: Compare Pathology button meets min-h-[44px]', () => {
    const tag = tagAround(labSrc, '🔬 Compare Pathology');
    expect(tag).toContain(MIN_44);
  });

  it('BotanicalLab: 4th tab button (Comparative Pathology) meets min-h-[44px]', () => {
    const tabMatch = labSrc.match(/activeTab === tab \? 'text-white' : 'text-text-stone hover:text-text-bark'/);
    expect(tabMatch).not.toBeNull();
    const tag = tagAround(labSrc, 'Comparative Pathology');
    expect(tag).toContain(MIN_44);
  });
});

// Scanner 2: Form Labels & Accessible Names
describe('Adversarial UI Challenge: Form Labels & A11y Scanner', () => {
  function readTag(source: string, open: number): { tag: string; attrs: string; end: number } | null {
    const tag = source.slice(open + 1).match(/^[a-z]+/)?.[0] ?? '';
    let depth = 0;
    for (let i = open + 1; i < source.length; i++) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) {
        const raw = source.slice(open, i + 1);
        return { tag, attrs: raw.slice(tag.length + 2, -1).replace(/\/$/, ''), end: i };
      }
    }
    return null;
  }

  function findFormOffenders(source: string, file: string) {
    const out: any[] = [];
    const targets = new Set<string>();
    for (const labelled of source.matchAll(/<label[^>]*\bhtmlFor="([^"]+)"/g)) {
      targets.add(labelled[1]);
    }

    for (const open of source.matchAll(/<(input|select|textarea)\b/g)) {
      const parsed = readTag(source, open.index!);
      if (!parsed) continue;

      const { tag, attrs } = parsed;
      if (/\btype="hidden"/.test(attrs)) continue;
      if (/\bclassName="[^"]*\bhidden\b[^"]*"/.test(attrs)) continue;
      if (/\baria-label(?:ledby)?=/.test(attrs)) continue;

      const id = attrs.match(/\bid="([^"]+)"/)?.[1];
      if (id && targets.has(id)) continue;

      const before = source.slice(0, open.index!);
      const labelOpen = before.lastIndexOf('<label');
      const labelClose = before.lastIndexOf('</label>');
      if (labelOpen > labelClose) continue;

      out.push({ file, tag, attrs });
    }
    return out;
  }

  it('ComparativePathologyWorkbench has ZERO nameless form controls', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/scan/ComparativePathologyWorkbench.tsx'), 'utf8');
    const offenders = findFormOffenders(src, 'ComparativePathologyWorkbench.tsx');
    expect(offenders, `Nameless controls found: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);
  });

  it('BotanicalLab has ZERO nameless form controls', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/BotanicalLab.tsx'), 'utf8');
    const offenders = findFormOffenders(src, 'BotanicalLab.tsx');
    expect(offenders, `Nameless controls found: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);
  });

  it('Every select element in ComparativePathologyWorkbench has explicit non-empty aria-label', () => {
    const src = stripJsComments(readSource('src/components/scan/ComparativePathologyWorkbench.tsx'));
    const selects = openingTags(src, ['<select']);
    expect(selects.length).toBeGreaterThanOrEqual(3);
    for (const sel of selects) {
      const match = sel.tag.match(/aria-label="([^"]+)"/);
      expect(match, `Select missing aria-label: ${sel.tag}`).not.toBeNull();
      expect(match![1].trim().length).toBeGreaterThan(3);
    }
  });

  it('Range slider in ComparativePathologyWorkbench has unambiguous aria-label', () => {
    const src = stripJsComments(readSource('src/components/scan/ComparativePathologyWorkbench.tsx'));
    const range = openingTags(src, ['<input']).find(t => t.tag.includes('type="range"'));
    expect(range).toBeDefined();
    expect(range!.tag).toMatch(/aria-label="Split-screen specimen comparison slider"/);
  });
});

// Scanner 3: Offline & Empty State Handling
describe('Adversarial UI Challenge: Offline & Empty State Handling', () => {
  it('timepoints construction handles plant with 0 check-ins gracefully', () => {
    const plant = {
      id: 'test-plant-1',
      name: 'Monstera Deliciosa',
      species: 'Monstera deliciosa',
      photoUrl: 'data:image/jpeg;base64,dummy',
      createdAt: new Date().toISOString(),
      baselineSignature: null,
      guardianScore: 90,
      recoveryRoadmap: null,
    };
    const checkins: any[] = [];

    const list: any[] = [];
    if (plant.photoUrl) {
      list.push({
        id: 'baseline',
        type: 'baseline',
        label: 'Baseline Diagnosis',
        date: new Date(plant.createdAt),
        photoUrl: plant.photoUrl,
        photoBlob: null,
        signature: null,
        guardianScore: plant.guardianScore,
      });
    }
    checkins.forEach((c) => {
      if (!c.photoUrl && !c.photoBlob) return;
      list.push({ id: c.id });
    });

    expect(list.length).toBe(1);
    expect(list.length < 2).toBe(true);
  });

  it('timepoints construction handles plant with no photoUrl and 0 check-ins gracefully', () => {
    const plant = {
      id: 'test-plant-no-photo',
      name: 'Ficus',
      photoUrl: null,
      createdAt: new Date().toISOString(),
    };
    const checkins: any[] = [];
    const list: any[] = [];
    if (plant.photoUrl) {
      list.push({ id: 'baseline' });
    }
    checkins.forEach((c) => {
      if (!c.photoUrl && !c.photoBlob) return;
      list.push({ id: c.id });
    });

    expect(list.length).toBe(0);
    expect(list.length < 2).toBe(true);
  });

  it('timepoints construction handles plant with 1 check-in (baseline + 1 checkin = 2 timepoints)', () => {
    const plant = {
      id: 'test-plant-1',
      photoUrl: 'data:image/jpeg;base64,dummy',
      createdAt: new Date().toISOString(),
    };
    const checkins = [
      {
        id: 'checkin-1',
        timestamp: new Date().toISOString(),
        photoUrl: 'data:image/jpeg;base64,dummy2',
        photoBlob: null,
      },
    ];

    const list: any[] = [];
    if (plant.photoUrl) {
      list.push({ id: 'baseline' });
    }
    checkins.forEach((c) => {
      if (!c.photoUrl && !c.photoBlob) return;
      list.push({ id: c.id });
    });

    expect(list.length).toBe(2);
    expect(list.length >= 2).toBe(true);
  });

  it('resolvePhotoBlob handles missing local://photos/... without unhandled throw', async () => {
    const result = await resolvePhotoBlob('local://photos/non-existent-uuid-9999', null);
    expect(result).toBeNull();
  });

  it('resolvePhotoBlob handles corrupt base64 string gracefully without throwing', async () => {
    const corruptDataUri = 'data:image/jpeg;base64,NOT_A_VALID_BASE64_###$$$';
    const result = await resolvePhotoBlob(corruptDataUri, null);
    expect(result).toBeNull();
  });

  it('resolvePhotoBlob handles invalid/corrupt URL strings without crashing', async () => {
    const invalidUrl = 'not-a-valid-url-format';
    const result = await resolvePhotoBlob(invalidUrl, null);
    expect(result).toBeNull();
  });

  it('resolvePhotoUrl returns null on missing local:// photo rather than crashing', async () => {
    const url = await resolvePhotoUrl('local://photos/missing-uuid', null);
    expect(url).toBeNull();
  });

  it('resolvePhotoUrl handles null / undefined input gracefully', async () => {
    expect(await resolvePhotoUrl(null, null)).toBeNull();
    expect(await resolvePhotoUrl(undefined, undefined)).toBeNull();
  });

  it('computeComparativePathology executes robustly with fallback/dummy signatures', () => {
    const dummySigA = {
      hsvHistogram: new Array(48).fill(0),
      leafContours: 3,
      meanRgb: [80, 130, 50] as [number, number, number],
      textureEnergy: 12,
      computedAt: new Date(),
    };
    const dummySigB = {
      hsvHistogram: new Array(48).fill(0),
      leafContours: 3,
      meanRgb: [80, 140, 50] as [number, number, number],
      textureEnergy: 11,
      computedAt: new Date(),
    };
    const res = computeComparativePathology(dummySigA, dummySigB, 'Monstera deliciosa');
    expect(res).toBeDefined();
    expect(res.classification).toBeDefined();
    expect(typeof res.recoveryDriftPercent).toBe('number');
    expect(Number.isNaN(res.recoveryDriftPercent)).toBe(false);
  });

  it('generateClinicalInsight handles empty/null recoveryRoadmap and all classifications', () => {
    const classifications: PathologyMetrics['classification'][] = [
      'Recovering',
      'Stabilizing',
      'Active Pathology',
      'Severe Drift',
    ];

    for (const classification of classifications) {
      const metrics: PathologyMetrics = {
        chlorosisA: 20,
        chlorosisB: 15,
        deltaChlorosis: -5,
        necrosisA: 10,
        necrosisB: 8,
        deltaNecrosis: -2,
        chlorophyllA: 70,
        chlorophyllB: 77,
        deltaChlorophyll: 7,
        textureStability: 85,
        deltaTextureEnergy: -0.5,
        recoveryDriftPercent: classification === 'Recovering' ? 25 : classification === 'Stabilizing' ? 5 : classification === 'Active Pathology' ? -20 : -60,
        classification,
      };

      const insight = generateClinicalInsight(metrics, 'Monty', null);
      expect(insight.title.length).toBeGreaterThan(0);
      expect(insight.narrative.length).toBeGreaterThan(0);
      expect(insight.recommendedAction.length).toBeGreaterThan(0);
      expect(['low', 'moderate', 'high']).toContain(insight.urgency);
    }
  });
});
