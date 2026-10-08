import { describe, it, expect } from 'vitest';
import {
  rgbToHsv,
  extractPathologySignatureFromPixels,
  computeComparativePathology,
  generateClinicalInsight,
  resolvePhotoBlob,
  resolvePhotoUrl,
  type PathologySignature,
  type PathologyMetrics,
} from '../pathologyProgressionService';
import type { PlantSignature } from '../driftDetector';

describe('pathologyProgressionService', () => {
  describe('rgbToHsv color space conversion', () => {
    it('converts pure red correctly', () => {
      const [h, s, v] = rgbToHsv(255, 0, 0);
      expect(h).toBeCloseTo(0, 1);
      expect(s).toBeCloseTo(1, 1);
      expect(v).toBeCloseTo(1, 1);
    });

    it('converts chlorotic yellow (Hue ~ 60°) correctly', () => {
      const [h, s, v] = rgbToHsv(255, 255, 0);
      expect(h).toBeCloseTo(60, 1);
      expect(s).toBeCloseTo(1, 1);
      expect(v).toBeCloseTo(1, 1);
    });

    it('converts healthy chlorophyll green (Hue ~ 120°) correctly', () => {
      const [h, s, v] = rgbToHsv(0, 255, 0);
      expect(h).toBeCloseTo(120, 1);
      expect(s).toBeCloseTo(1, 1);
      expect(v).toBeCloseTo(1, 1);
    });

    it('converts necrotic brown (Hue in 5°-38° band) correctly', () => {
      const [h, s, v] = rgbToHsv(139, 69, 19);
      expect(h).toBeGreaterThanOrEqual(5);
      expect(h).toBeLessThan(38);
      expect(s).toBeGreaterThan(0.5);
      expect(v).toBeLessThanOrEqual(0.6);
    });

    it('handles black and white bounds without NaN', () => {
      const [hBlack, sBlack, vBlack] = rgbToHsv(0, 0, 0);
      expect(hBlack).toBe(0);
      expect(sBlack).toBe(0);
      expect(vBlack).toBe(0);

      const [hWhite, sWhite, vWhite] = rgbToHsv(255, 255, 255);
      expect(hWhite).toBe(0);
      expect(sWhite).toBe(0);
      expect(vWhite).toBe(1);
    });
  });

  describe('extractPathologySignatureFromPixels pure computation', () => {
    it('filters out transparent alpha pixels from tissue calculations', () => {
      const width = 10;
      const height = 10;
      const pixels = new Uint8ClampedArray(width * height * 4);

      // Fill with transparent brown pixels (alpha = 0)
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 139;
        pixels[i + 1] = 69;
        pixels[i + 2] = 19;
        pixels[i + 3] = 0; // Transparent
      }

      const sig = extractPathologySignatureFromPixels(pixels, width, height);
      expect(sig.necrosisFraction).toBe(0);
      expect(sig.chlorosisFraction).toBe(0);
      expect(sig.chlorophyllFraction).toBe(0);
    });

    it('correctly quantifies chlorotic tissue in yellow foliar band (38°-68°)', () => {
      const width = 20;
      const height = 20;
      const pixels = new Uint8ClampedArray(width * height * 4);

      // Fill with chlorotic yellow (R=220, G=220, B=20, A=255) -> Hue ~59°
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 220;
        pixels[i + 1] = 220;
        pixels[i + 2] = 20;
        pixels[i + 3] = 255;
      }

      const sig = extractPathologySignatureFromPixels(pixels, width, height);
      expect(sig.chlorosisFraction).toBeGreaterThan(0.9);
      expect(sig.necrosisFraction).toBe(0);
      expect(sig.chlorophyllFraction).toBe(0);
    });

    it('correctly quantifies healthy chlorophyll foliage (68°-165°)', () => {
      const width = 20;
      const height = 20;
      const pixels = new Uint8ClampedArray(width * height * 4);

      // Fill with foliage green (R=34, G=139, B=34, A=255) -> Forest Green
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 34;
        pixels[i + 1] = 139;
        pixels[i + 2] = 34;
        pixels[i + 3] = 255;
      }

      const sig = extractPathologySignatureFromPixels(pixels, width, height);
      expect(sig.chlorophyllFraction).toBeGreaterThan(0.9);
      expect(sig.chlorosisFraction).toBe(0);
      expect(sig.necrosisFraction).toBe(0);
    });

    it('correctly quantifies necrotic lesions (5°-38° brown / low V)', () => {
      const width = 20;
      const height = 20;
      const pixels = new Uint8ClampedArray(width * height * 4);

      // Fill with necrotic lesion brown (R=100, G=50, B=20, A=255)
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 100;
        pixels[i + 1] = 50;
        pixels[i + 2] = 20;
        pixels[i + 3] = 255;
      }

      const sig = extractPathologySignatureFromPixels(pixels, width, height);
      expect(sig.necrosisFraction).toBeGreaterThan(0.9);
      expect(sig.chlorosisFraction).toBe(0);
      expect(sig.chlorophyllFraction).toBe(0);
    });

    it('handles all-black or empty image safely without NaN', () => {
      const width = 16;
      const height = 16;
      const pixels = new Uint8ClampedArray(width * height * 4);
      // All 0s
      const sig = extractPathologySignatureFromPixels(pixels, width, height);
      expect(Number.isNaN(sig.chlorosisFraction)).toBe(false);
      expect(Number.isNaN(sig.necrosisFraction)).toBe(false);
      expect(Number.isNaN(sig.chlorophyllFraction)).toBe(false);
      expect(Number.isNaN(sig.textureEnergy)).toBe(false);
      expect(sig.hsvHistogram.length).toBe(48);
    });
  });

  describe('computeComparativePathology delta analytics & classification', () => {
    const createMockSignature = (
      chlorosis: number,
      necrosis: number,
      chlorophyll: number,
      textureEnergy = 12.0,
      luminance = 120
    ): PathologySignature => ({
      hsvHistogram: new Array(48).fill(0),
      leafContours: 3,
      meanRgb: [100, 140, 60],
      textureEnergy,
      luminance,
      computedAt: new Date(),
      chlorosisFraction: chlorosis,
      necrosisFraction: necrosis,
      chlorophyllFraction: chlorophyll,
    });

    it('classifies positive recovery when chlorosis recedes and chlorophyll expands', () => {
      const sigA = createMockSignature(0.35, 0.05, 0.60, 20.0); // Baseline: chlorotic
      const sigB = createMockSignature(0.10, 0.05, 0.85, 14.0); // Follow-up: healed

      const result = computeComparativePathology(sigA, sigB);

      expect(result.deltaChlorosis).toBeCloseTo(-25.0, 1);
      expect(result.deltaChlorophyll).toBeCloseTo(+25.0, 1);
      expect(result.deltaNecrosis).toBeCloseTo(0, 1);
      expect(result.textureStability).toBeGreaterThanOrEqual(70);
      expect(result.recoveryDriftPercent).toBeGreaterThanOrEqual(15);
      expect(result.classification).toBe('Recovering');
    });

    it('classifies Active Pathology when chlorosis expands', () => {
      const sigA = createMockSignature(0.05, 0.02, 0.90, 10.0);
      const sigB = createMockSignature(0.18, 0.03, 0.78, 12.0); // Yellowing spreading

      const result = computeComparativePathology(sigA, sigB);

      expect(result.deltaChlorosis).toBeCloseTo(+13.0, 1);
      expect(result.deltaChlorophyll).toBeCloseTo(-12.0, 1);
      expect(result.recoveryDriftPercent).toBeLessThan(-10);
      expect(result.recoveryDriftPercent).toBeGreaterThanOrEqual(-50);
      expect(result.classification).toBe('Active Pathology');
    });

    it('classifies Severe Drift when necrosis expands significantly', () => {
      const sigA = createMockSignature(0.05, 0.02, 0.90, 10.0);
      const sigB = createMockSignature(0.20, 0.18, 0.50, 30.0); // Acute necrosis spread

      const result = computeComparativePathology(sigA, sigB);

      expect(result.deltaNecrosis).toBeGreaterThanOrEqual(12);
      expect(result.classification).toBe('Severe Drift');
    });

    it('classifies Stabilizing when differences are minimal', () => {
      const sigA = createMockSignature(0.10, 0.02, 0.85, 12.0);
      const sigB = createMockSignature(0.11, 0.02, 0.84, 12.2);

      const result = computeComparativePathology(sigA, sigB);

      expect(Math.abs(result.recoveryDriftPercent)).toBeLessThan(10);
      expect(result.classification).toBe('Stabilizing');
    });

    it('emits lightingBiasWarning when luminance shifts by more than 50', () => {
      const sigA = createMockSignature(0.10, 0.02, 0.85, 12.0, 80);
      const sigB = createMockSignature(0.10, 0.02, 0.85, 12.0, 145); // +65 lum diff

      const result = computeComparativePathology(sigA, sigB);
      expect(result.lightingBiasWarning).toBe(true);
    });

    it('falls back to 48-bin hsvHistogram when signatures lack detailed pathology properties', () => {
      const legacySigA: PlantSignature = {
        hsvHistogram: new Array(48).fill(0),
        leafContours: 2,
        meanRgb: [80, 140, 50],
        textureEnergy: 10,
        computedAt: new Date(),
      };
      // Set chlorosis bin (bin 2)
      legacySigA.hsvHistogram[2] = 0.25;

      const legacySigB: PlantSignature = {
        hsvHistogram: new Array(48).fill(0),
        leafContours: 2,
        meanRgb: [80, 160, 50],
        textureEnergy: 10,
        computedAt: new Date(),
      };
      legacySigB.hsvHistogram[2] = 0.05; // chlorosis dropped

      const result = computeComparativePathology(legacySigA, legacySigB);
      expect(result.deltaChlorosis).toBeLessThan(0);
      expect(result.classification).toBeDefined();
    });
  });

  describe('generateClinicalInsight', () => {
    const baseMetrics: PathologyMetrics = {
      chlorosisA: 30,
      chlorosisB: 10,
      deltaChlorosis: -20,
      necrosisA: 5,
      necrosisB: 5,
      deltaNecrosis: 0,
      chlorophyllA: 65,
      chlorophyllB: 85,
      deltaChlorophyll: 20,
      textureStability: 92,
      deltaTextureEnergy: -4,
      recoveryDriftPercent: 45,
      classification: 'Recovering',
    };

    it('generates recovery insight linking to active roadmap action', () => {
      const roadmap = {
        diagnosis: 'Bacterial Leaf Spot',
        timeline: [
          { day: 'Day 1-3', action: 'Substrate aeration and copper soap application', expectedOutcome: 'Halt lesions' },
        ],
      };

      const insight = generateClinicalInsight(baseMetrics, 'Monty', roadmap);
      expect(insight.title).toBe('Positive Foliar Remission');
      expect(insight.urgency).toBe('low');
      expect(insight.narrative).toContain('Monty');
      expect(insight.narrative).toContain('+45.0%');
      expect(insight.recommendedAction).toContain('copper soap application');
    });

    it('generates severe drift insight with high urgency', () => {
      const severeMetrics: PathologyMetrics = {
        ...baseMetrics,
        deltaNecrosis: 15,
        recoveryDriftPercent: -65,
        classification: 'Severe Drift',
      };

      const insight = generateClinicalInsight(severeMetrics, 'Fern');
      expect(insight.title).toBe('Critical Tissue Breakdown');
      expect(insight.urgency).toBe('high');
      expect(insight.narrative).toContain('Acute necrotic tissue expansion');
      expect(insight.recommendedAction).toContain('Isolate specimen');
    });

    it('handles null roadmap without crashing', () => {
      const insight = generateClinicalInsight(baseMetrics, 'Pothos', null);
      expect(insight.title).toBe('Positive Foliar Remission');
      expect(insight.recommendedAction).toBeDefined();
    });
  });

  describe('resolvePhotoBlob and resolvePhotoUrl offline resolution', () => {
    it('returns provided Blob directly', async () => {
      const blob = new Blob(['sample-image-data'], { type: 'image/jpeg' });
      const resolved = await resolvePhotoBlob(null, blob);
      expect(resolved).toBe(blob);
    });

    it('converts base64 data URI to Blob', async () => {
      // Small 1x1 GIF / JPEG base64
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      const resolved = await resolvePhotoBlob(dataUri, null);
      expect(resolved).toBeInstanceOf(Blob);
      expect(resolved?.type).toBe('image/png');
    });

    it('returns null for null inputs', async () => {
      const resolved = await resolvePhotoBlob(null, null);
      expect(resolved).toBeNull();
    });

    it('passes through http URLs for resolvePhotoUrl', async () => {
      const url = 'https://example.com/photos/plant.jpg';
      const resolved = await resolvePhotoUrl(url, null);
      expect(resolved).toBe(url);
    });
  });
});
