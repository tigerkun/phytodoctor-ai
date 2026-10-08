import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openingTags, classNameOf, stripJsComments } from '../../test/helpers';
import {
  computeComparativePathology,
  type PathologyMetrics,
} from '../../services/pathologyProgressionService';

const workbenchSource = readFileSync(
  join(process.cwd(), 'src/components/scan/ComparativePathologyWorkbench.tsx'),
  'utf8'
);
const labSource = readFileSync(
  join(process.cwd(), 'src/pages/BotanicalLab.tsx'),
  'utf8'
);
const serviceSource = readFileSync(
  join(process.cwd(), 'src/services/pathologyProgressionService.ts'),
  'utf8'
);

describe('ComparativePathologyWorkbench structural, ergonomic, and a11y tests', () => {
  it('the scan found all relevant source files to check', () => {
    expect(workbenchSource.length).toBeGreaterThan(500);
    expect(labSource.length).toBeGreaterThan(500);
    expect(serviceSource.length).toBeGreaterThan(500);
  });

  describe('Mobile ergonomics & touch target floor (min-h-[44px])', () => {
    it('all interactive buttons in ComparativePathologyWorkbench meet the 44px touch minimum', () => {
      const cleanWorkbench = stripJsComments(workbenchSource);
      const tags = openingTags(cleanWorkbench).filter(t => t.tag.startsWith('<button'));
      expect(tags.length).toBeGreaterThanOrEqual(6);

      const tooSmall = tags
        .map(t => classNameOf(t.tag))
        .flatMap(cls => [...cls.matchAll(/min-h-\[(\d+)px\]/g)].map(m => m[0]))
        .filter(declared => Number(declared.match(/\d+/)![0]) < 44);

      expect(tooSmall, `under-sized controls in ComparativePathologyWorkbench: ${tooSmall.join(', ')}`).toEqual([]);
    });

    it('every button styled by padding in ComparativePathologyWorkbench includes explicit min-h-[44px]', () => {
      const cleanWorkbench = stripJsComments(workbenchSource);
      const undersized = openingTags(cleanWorkbench)
        .filter(t => /\bpy-|\bmin-h-|\bh-/.test(t.tag))
        .map(t => classNameOf(t.tag))
        .filter(cls => cls.trim().length > 0 && !cls.includes('min-h-[44px]'));

      expect(undersized, `Workbench controls left to their padding: ${undersized.join(' | ')}`).toEqual([]);
    });

    it('the compare pathology button in BotanicalLab sanctuary cards meets the 44px touch floor', () => {
      const cleanLab = stripJsComments(labSource);
      const compareBtnMatch = cleanLab.match(/🔬 Compare Pathology[\s\S]*?<\/button>|<button[^>]*>[^<]*🔬 Compare Pathology/);
      expect(compareBtnMatch).not.toBeNull();
      expect(cleanLab).toMatch(/🔬 Compare Pathology[\s\S]*?min-h-\[44px\]|<button[^>]*min-h-\[44px\][^>]*>[^<]*🔬 Compare Pathology/);
    });
  });

  describe('Form controls and accessibility labels (formLabels & ARIA)', () => {
    it('range slider declares explicit accessible aria-label and min-h-[44px]', () => {
      const cleanWorkbench = stripJsComments(workbenchSource);
      const rangeInputs = openingTags(cleanWorkbench, ['<input']).filter(t =>
        t.tag.includes('type="range"')
      );
      expect(rangeInputs.length).toBeGreaterThanOrEqual(1);

      for (const input of rangeInputs) {
        expect(input.tag).toMatch(/aria-label="[^"]+"/);
        expect(input.tag).toContain('min-h-[44px]');
      }
    });

    it('all select elements declare explicit aria-label attributes', () => {
      const cleanWorkbench = stripJsComments(workbenchSource);
      const selects = openingTags(cleanWorkbench, ['<select']);
      expect(selects.length).toBeGreaterThanOrEqual(3);

      for (const sel of selects) {
        expect(sel.tag).toMatch(/aria-label="[^"]+"/);
      }
    });

    it('telemetry readouts are housed in an accessible region with aria-label', () => {
      const cleanWorkbench = stripJsComments(workbenchSource);
      expect(cleanWorkbench).toContain('role="region"');
      expect(cleanWorkbench).toContain('aria-label="Pathology progression metrics"');
    });
  });

  describe('Visual progression features & telemetry chips', () => {
    it('supports split-screen curtain slider with clipPath', () => {
      expect(workbenchSource).toContain('clipPath');
      expect(workbenchSource).toContain('polygon(0 0');
      expect(workbenchSource).toContain('sliderPos');
    });

    it('supports twin reticles side-by-side view with magnification scaling', () => {
      expect(workbenchSource).toContain('Twin Reticles');
      expect(workbenchSource).toContain('transform: `scale(${magScale})`');
      expect(workbenchSource).toContain('magnification');
    });

    it('renders all 4 required progression metric chips', () => {
      expect(workbenchSource).toMatch(/Chlorosis (?:Δ|&Delta;) \(38°-68°\)/);
      expect(workbenchSource).toMatch(/Necrosis (?:Δ|&Delta;) \(5°-38°\)/);
      expect(workbenchSource).toContain('Texture Stability');
      expect(workbenchSource).toContain('Recovery Drift');
    });

    it('renders all 4 directional recovery classifications with distinct badges', () => {
      expect(workbenchSource).toContain('Recovering');
      expect(workbenchSource).toContain('Stabilizing');
      expect(workbenchSource).toContain('Active Pathology');
      expect(workbenchSource).toContain('Severe Drift');
    });

    it('connects to recovery roadmap and displays clinical insights', () => {
      expect(workbenchSource).toContain('insight.title');
      expect(workbenchSource).toContain('insight.narrative');
      expect(workbenchSource).toContain('insight.recommendedAction');
      expect(workbenchSource).toContain('recoveryRoadmap');
    });
  });

  describe('BotanicalLab page integration and deep linking', () => {
    it('declares pathology in the activeTab union and initial tab parser', () => {
      const cleanLab = stripJsComments(labSource);
      expect(cleanLab).toMatch(/activeTab.*'dex'\s*\|\s*'sanctuary'\s*\|\s*'pathology'\s*\|\s*'history'/);
      expect(cleanLab).toContain("searchParams.get('tab') === 'pathology'");
    });

    it('renders 4 tabs including Comparative Pathology with Microscope icon', () => {
      const cleanLab = stripJsComments(labSource);
      expect(cleanLab).toContain("'dex', 'sanctuary', 'pathology', 'history'");
      expect(cleanLab).toContain('Comparative Pathology');
      expect(cleanLab).toContain('<Microscope');
    });

    it('renders ComparativePathologyWorkbench when activeTab is pathology', () => {
      const cleanLab = stripJsComments(labSource);
      expect(cleanLab).toMatch(/\{activeTab === 'pathology' && \(\s*<ComparativePathologyWorkbench/);
    });

    it('provides empty state fallback when plant has fewer than two observation points', () => {
      expect(workbenchSource).toContain('timepoints.length < 2');
      expect(workbenchSource).toContain('<EmptyState');
    });
  });

  describe('Pure mathematical pathology computation contract', () => {
    it('computes comparative pathology deterministically with 4-tier classification', () => {
      const sigA = {
        hsvHistogram: new Array(48).fill(0),
        leafContours: 4,
        meanRgb: [80, 130, 50] as [number, number, number],
        textureEnergy: 15,
        computedAt: new Date(),
        chlorosisFraction: 0.30,
        necrosisFraction: 0.05,
        chlorophyllFraction: 0.65,
      };

      const sigB = {
        hsvHistogram: new Array(48).fill(0),
        leafContours: 4,
        meanRgb: [80, 150, 50] as [number, number, number],
        textureEnergy: 12,
        computedAt: new Date(),
        chlorosisFraction: 0.10,
        necrosisFraction: 0.04,
        chlorophyllFraction: 0.86,
      };

      const result: PathologyMetrics = computeComparativePathology(sigA, sigB);

      expect(result.chlorosisA).toBe(30);
      expect(result.chlorosisB).toBe(10);
      expect(result.deltaChlorosis).toBe(-20);
      expect(result.deltaChlorophyll).toBe(21);
      expect(result.classification).toBe('Recovering');
      expect(result.recoveryDriftPercent).toBeGreaterThanOrEqual(15);
    });
  });
});
