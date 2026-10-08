import { describe, it, expect, vi } from 'vitest';
import {
  rgbToHsv,
  extractPathologySignatureFromPixels,
  computeComparativePathology,
  extractPathologySignature,
  generateClinicalInsight,
  type PathologySignature,
  type PathologyMetrics,
} from '../pathologyProgressionService';
import type { PlantSignature } from '../driftDetector';

describe('pathologyProgressionService — Empirical Adversarial Stress Suite', () => {
  describe('1. Hue Boundary & Color Space Wrap-Around Testing', () => {
    it('converts all 6 RGB hue sectors accurately and wraps correctly at 0° and 360°', () => {
      // Sector 0 (Red -> Yellow): R max, G increasing
      expect(rgbToHsv(255, 0, 0)[0]).toBeCloseTo(0, 2);
      expect(rgbToHsv(255, 128, 0)[0]).toBeCloseTo(30.12, 1);

      // Sector 1 (Yellow -> Green): G max, R decreasing
      expect(rgbToHsv(255, 255, 0)[0]).toBeCloseTo(60, 2);
      expect(rgbToHsv(128, 255, 0)[0]).toBeCloseTo(89.88, 1);

      // Sector 2 (Green -> Cyan): G max, B increasing
      expect(rgbToHsv(0, 255, 0)[0]).toBeCloseTo(120, 2);
      expect(rgbToHsv(0, 255, 128)[0]).toBeCloseTo(150.12, 1);

      // Sector 3 (Cyan -> Blue): B max, G decreasing
      expect(rgbToHsv(0, 255, 255)[0]).toBeCloseTo(180, 2);
      expect(rgbToHsv(0, 128, 255)[0]).toBeCloseTo(209.88, 1);

      // Sector 4 (Blue -> Magenta): B max, R increasing
      expect(rgbToHsv(0, 0, 255)[0]).toBeCloseTo(240, 2);
      expect(rgbToHsv(128, 0, 255)[0]).toBeCloseTo(270.12, 1);

      // Sector 5 (Magenta -> Red): R max, B decreasing
      expect(rgbToHsv(255, 0, 255)[0]).toBeCloseTo(300, 2);
      // Close to 360° boundary
      const near360 = rgbToHsv(255, 0, 2);
      expect(near360[0]).toBeGreaterThan(359);
      expect(near360[0]).toBeLessThan(360);
    });

    it('rigorously tests exact boundary transitions: Red (0-5°), Necrosis (5-38°), Chlorosis (38-68°), Chlorophyll (68-165°)', () => {
      const createPixel = (h: number, s: number, v: number): Uint8ClampedArray => {
        // Inverse HSV to RGB helper for targeted testing
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;
        if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
        else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
        else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }

        const arr = new Uint8ClampedArray(4);
        arr[0] = Math.round((r + m) * 255);
        arr[1] = Math.round((g + m) * 255);
        arr[2] = Math.round((b + m) * 255);
        arr[3] = 255;
        return arr;
      };

      // 1. Red vs Necrosis boundary at 5.0° (with S=0.5, V=0.5)
      // Just below 5°: Hue ~ 4.0° -> Not necrotic (red foliar tint / anthocyanin)
      const pRed = createPixel(4.0, 0.5, 0.5);
      const sigRed = extractPathologySignatureFromPixels(pRed, 1, 1);
      expect(sigRed.necrosisFraction).toBe(0);
      expect(sigRed.chlorosisFraction).toBe(0);

      // At/above 5°: Hue ~ 6.0° -> Necrotic
      const pNecrotic = createPixel(6.0, 0.5, 0.5);
      const sigNecrotic = extractPathologySignatureFromPixels(pNecrotic, 1, 1);
      expect(sigNecrotic.necrosisFraction).toBe(1);

      // 2. Necrosis vs Chlorosis boundary at 38.0° (with S=0.5, V=0.5)
      // At 37.0°: Necrotic
      const pNec37 = createPixel(37.0, 0.5, 0.5);
      const sigNec37 = extractPathologySignatureFromPixels(pNec37, 1, 1);
      expect(sigNec37.necrosisFraction).toBe(1);
      expect(sigNec37.chlorosisFraction).toBe(0);

      // At 39.0°: Chlorotic
      const pChl39 = createPixel(39.0, 0.5, 0.5);
      const sigChl39 = extractPathologySignatureFromPixels(pChl39, 1, 1);
      expect(sigChl39.necrosisFraction).toBe(0);
      expect(sigChl39.chlorosisFraction).toBe(1);

      // 3. Chlorosis vs Chlorophyll boundary at 68.0° (with S=0.5, V=0.5)
      // At 67.0°: Chlorotic
      const pChl67 = createPixel(67.0, 0.5, 0.5);
      const sigChl67 = extractPathologySignatureFromPixels(pChl67, 1, 1);
      expect(sigChl67.chlorosisFraction).toBe(1);
      expect(sigChl67.chlorophyllFraction).toBe(0);

      // At 69.0°: Chlorophyll
      const pGreen69 = createPixel(69.0, 0.5, 0.5);
      const sigGreen69 = extractPathologySignatureFromPixels(pGreen69, 1, 1);
      expect(sigGreen69.chlorosisFraction).toBe(0);
      expect(sigGreen69.chlorophyllFraction).toBe(1);

      // 4. Chlorophyll upper boundary at 165.0°
      // At 164.0°: Chlorophyll
      const pGreen164 = createPixel(164.0, 0.5, 0.5);
      const sigGreen164 = extractPathologySignatureFromPixels(pGreen164, 1, 1);
      expect(sigGreen164.chlorophyllFraction).toBe(1);

      // At 168.0°: Beyond green foliage (cyan/teal spectrum)
      const pCyan168 = createPixel(168.0, 0.5, 0.5);
      const sigCyan168 = extractPathologySignatureFromPixels(pCyan168, 1, 1);
      expect(sigCyan168.chlorophyllFraction).toBe(0);
      expect(sigCyan168.chlorosisFraction).toBe(0);
      expect(sigCyan168.necrosisFraction).toBe(0);
    });
  });

  describe('2. Extreme Luminance & Saturation Stress-Testing', () => {
    it('completely rejects pixels with transparent alpha (A < 128) and accepts A >= 128', () => {
      const pixels = new Uint8ClampedArray(4 * 2);
      // Pixel 0: green but A = 127 (should be rejected)
      pixels[0] = 0; pixels[1] = 200; pixels[2] = 0; pixels[3] = 127;
      // Pixel 1: chlorotic yellow and A = 128 (should be accepted)
      pixels[4] = 200; pixels[5] = 200; pixels[6] = 20; pixels[7] = 128;

      const sig = extractPathologySignatureFromPixels(pixels, 2, 1);
      // Only Pixel 1 is valid
      expect(sig.chlorophyllFraction).toBe(0);
      expect(sig.chlorosisFraction).toBe(1);
    });

    it('correctly filters out specular highlights (V > 0.96 && S < 0.08) and crushed black (V < 0.08)', () => {
      const pixels = new Uint8ClampedArray(4 * 3);
      // Pixel 0: pure white specular highlight (V=1.0, S=0)
      pixels[0] = 255; pixels[1] = 255; pixels[2] = 255; pixels[3] = 255;
      // Pixel 1: deep shadow pitch black (V=0.03, S=0)
      pixels[4] = 8; pixels[5] = 8; pixels[6] = 8; pixels[7] = 255;
      // Pixel 2: healthy green (V=0.5, S=0.6)
      pixels[8] = 30; pixels[9] = 160; pixels[10] = 30; pixels[11] = 255;

      const sig = extractPathologySignatureFromPixels(pixels, 3, 1);
      // Pixels 0 and 1 are filtered, only Pixel 2 is counted
      expect(sig.chlorophyllFraction).toBe(1);
      expect(sig.chlorosisFraction).toBe(0);
      expect(sig.necrosisFraction).toBe(0);
    });

    it('handles degenerate images where 100% of pixels are invalid without NaN or crash', () => {
      // 100% transparent
      const transparent = new Uint8ClampedArray(16 * 16 * 4);
      const sigTrans = extractPathologySignatureFromPixels(transparent, 16, 16);
      expect(sigTrans.chlorosisFraction).toBe(0);
      expect(sigTrans.necrosisFraction).toBe(0);
      expect(sigTrans.chlorophyllFraction).toBe(0);
      expect(Number.isNaN(sigTrans.luminance)).toBe(false);

      // 100% white glare
      const white = new Uint8ClampedArray(16 * 16 * 4);
      white.fill(255);
      const sigWhite = extractPathologySignatureFromPixels(white, 16, 16);
      expect(sigWhite.chlorosisFraction).toBe(0);
      expect(sigWhite.necrosisFraction).toBe(0);
      expect(sigWhite.chlorophyllFraction).toBe(0);
      expect(sigWhite.luminance).toBeCloseTo(255, 1);

      // 100% black shadow (V = 0, A = 255)
      const black = new Uint8ClampedArray(16 * 16 * 4);
      for (let i = 3; i < black.length; i += 4) black[i] = 255;
      const sigBlack = extractPathologySignatureFromPixels(black, 16, 16);
      expect(sigBlack.chlorosisFraction).toBe(0);
      expect(sigBlack.necrosisFraction).toBe(0);
      expect(sigBlack.chlorophyllFraction).toBe(0);
      expect(sigBlack.luminance).toBe(0);
    });

    it('detects dark necrotic rot lesions even at low V (0.08 <= V <= 0.22, S >= 0.10)', () => {
      const pixels = new Uint8ClampedArray(4);
      // Dark brown-black rot: R=45, G=25, B=15, A=255 -> V ~ 0.176, S ~ 0.66
      pixels[0] = 45; pixels[1] = 25; pixels[2] = 15; pixels[3] = 255;
      const sig = extractPathologySignatureFromPixels(pixels, 1, 1);
      expect(sig.necrosisFraction).toBe(1);
    });
  });

  describe('3. Extreme Deltas, Metric Clamping & Boundary Stability', () => {
    const makeSig = (
      chlorosis: number,
      necrosis: number,
      chlorophyll: number,
      textureEnergy = 10,
      luminance = 100
    ): PathologySignature => ({
      hsvHistogram: new Array(48).fill(0),
      leafContours: 1,
      meanRgb: [100, 100, 100],
      textureEnergy,
      luminance,
      computedAt: new Date(),
      chlorosisFraction: chlorosis,
      necrosisFraction: necrosis,
      chlorophyllFraction: chlorophyll,
    });

    it('strictly clamps maximum recovery to +100.0% under extreme positive delta (100% chlorosis -> 100% chlorophyll)', () => {
      const sigA = makeSig(1.0, 0.0, 0.0, 25.0); // 100% chlorosis, high rough texture
      const sigB = makeSig(0.0, 0.0, 1.0, 5.0);  // 100% chlorophyll, smoothed texture

      const metrics = computeComparativePathology(sigA, sigB);
      // Raw: deltaChlorophyll(+100)*1.0 - deltaChlorosis(-100)*1.25 = +225%
      expect(metrics.deltaChlorophyll).toBe(100);
      expect(metrics.deltaChlorosis).toBe(-100);
      expect(metrics.recoveryDriftPercent).toBe(100.0); // Strictly clamped to +100.0%
      expect(metrics.classification).toBe('Recovering');
    });

    it('strictly clamps acute decline to -100.0% under extreme negative delta (100% chlorophyll -> 100% necrosis)', () => {
      const sigA = makeSig(0.0, 0.0, 1.0, 5.0);
      const sigB = makeSig(0.0, 1.0, 0.0, 50.0); // 100% necrosis with rough texture explosion

      const metrics = computeComparativePathology(sigA, sigB);
      // Raw: deltaChlorophyll(-100)*1.0 - deltaNecrosis(+100)*2.0 - textureShift = -300% - penalty
      expect(metrics.deltaChlorophyll).toBe(-100);
      expect(metrics.deltaNecrosis).toBe(100);
      expect(metrics.recoveryDriftPercent).toBe(-100.0); // Strictly clamped to -100.0%
      expect(metrics.classification).toBe('Severe Drift');
    });

    it('maintains strict [-100.0, +100.0] invariant across 500 randomized parameter vectors', () => {
      for (let i = 0; i < 500; i++) {
        const cA = Math.random();
        const nA = Math.random() * (1 - cA);
        const gA = 1 - cA - nA;
        const eA = Math.random() * 50;

        const cB = Math.random();
        const nB = Math.random() * (1 - cB);
        const gB = 1 - cB - nB;
        const eB = Math.random() * 50;

        const res = computeComparativePathology(
          makeSig(cA, nA, gA, eA),
          makeSig(cB, nB, gB, eB)
        );

        expect(res.recoveryDriftPercent).toBeGreaterThanOrEqual(-100);
        expect(res.recoveryDriftPercent).toBeLessThanOrEqual(100);
        expect(Number.isNaN(res.recoveryDriftPercent)).toBe(false);
        expect(res.textureStability).toBeGreaterThanOrEqual(0);
        expect(res.textureStability).toBeLessThanOrEqual(100);
        expect(['Recovering', 'Stabilizing', 'Active Pathology', 'Severe Drift']).toContain(res.classification);
      }
    });

    it('correctly clamps texture stability to 0% when texture variance explodes massively', () => {
      const sigA = makeSig(0.1, 0.0, 0.9, 1.0);
      const sigB = makeSig(0.1, 0.0, 0.9, 500.0); // Massive texture delta

      const metrics = computeComparativePathology(sigA, sigB);
      expect(metrics.textureStability).toBe(0.0);
    });

    it('does not penalize recovery when texture becomes smoother (deltaTextureEnergy < 0)', () => {
      // Plant heals: foliage texture energy decreases from 20.0 to 5.0
      const sigA = makeSig(0.2, 0.0, 0.8, 20.0);
      const sigB = makeSig(0.0, 0.0, 1.0, 5.0);

      const metrics = computeComparativePathology(sigA, sigB);
      expect(metrics.deltaTextureEnergy).toBe(-15.0);
      // deltaChlorophyll: +20, deltaChlorosis: -20
      // raw: 20 * 1.0 - (-20) * 1.25 - 0 - 0 = 45%
      expect(metrics.recoveryDriftPercent).toBe(45.0);
    });
  });

  describe('4. Clinical Tier Assignment & Precedence Matrix', () => {
    const makeSig = (c: number, n: number, g: number) => ({
      hsvHistogram: new Array(48).fill(0),
      leafContours: 1,
      meanRgb: [100, 100, 100] as [number, number, number],
      textureEnergy: 10,
      luminance: 100,
      computedAt: new Date(),
      chlorosisFraction: c,
      necrosisFraction: n,
      chlorophyllFraction: g,
    });

    it('Severe Drift precedence: deltaNecrosis >= 12 triggers Severe Drift even if chlorophyll expands', () => {
      // Acute necrotic lesion surge (+13%) accompanied by general growth (+20% green)
      const sigA = makeSig(0.05, 0.02, 0.70);
      const sigB = makeSig(0.05, 0.15, 0.90); // deltaNecrosis = +13%, deltaChlorophyll = +20%

      const metrics = computeComparativePathology(sigA, sigB);
      expect(metrics.deltaNecrosis).toBe(13.0);
      // Despite raw recovery being 20 - 26 = -6% (normally Stabilizing), acute necrosis overrides!
      expect(metrics.classification).toBe('Severe Drift');
    });

    it('Active Pathology precedence: deltaChlorosis >= 6 triggers Active Pathology even if recovery score is >= 15%', () => {
      // Specimen with overall green foliage expansion but spreading chlorotic margins
      // deltaChlorophyll = +30%, deltaChlorosis = +6.0%, deltaNecrosis = 0
      // rawRecovery = 30 - (6 * 1.25) = 22.5% (>= 15% would be Recovering)
      const sigA = makeSig(0.05, 0.0, 0.60);
      const sigB = makeSig(0.11, 0.0, 0.90);

      const metrics = computeComparativePathology(sigA, sigB);
      expect(metrics.deltaChlorosis).toBe(6.0);
      expect(metrics.recoveryDriftPercent).toBe(22.5);
      // Active foliar chlorosis progression must prevent a false "Recovering" badge!
      expect(metrics.classification).toBe('Active Pathology');
    });

    it('tests precise numerical boundaries between all 4 tiers', () => {
      // 1. Exactly at Severe Drift boundary: -50.1% vs -50.0%
      // Base: c=0, n=0, g=1.0
      // To get recoveryDriftPercent = -50.1%: deltaChlorophyll = -50.1
      const sigSev = makeSig(0, 0, 0.499);
      const resSev = computeComparativePathology(makeSig(0, 0, 1.0), sigSev);
      expect(resSev.recoveryDriftPercent).toBe(-50.1);
      expect(resSev.classification).toBe('Severe Drift');

      const sigAct = makeSig(0, 0, 0.500);
      const resAct = computeComparativePathology(makeSig(0, 0, 1.0), sigAct);
      expect(resAct.recoveryDriftPercent).toBe(-50.0);
      expect(resAct.classification).toBe('Active Pathology');

      // 2. Exactly at Active Pathology boundary: -10.1% vs -10.0%
      const sigAct2 = makeSig(0, 0, 0.899);
      const resAct2 = computeComparativePathology(makeSig(0, 0, 1.0), sigAct2);
      expect(resAct2.recoveryDriftPercent).toBe(-10.1);
      expect(resAct2.classification).toBe('Active Pathology');

      const sigStab = makeSig(0, 0, 0.900);
      const resStab = computeComparativePathology(makeSig(0, 0, 1.0), sigStab);
      expect(resStab.recoveryDriftPercent).toBe(-10.0);
      expect(resStab.classification).toBe('Stabilizing');

      // 3. Exactly at Recovering boundary: +14.9% vs +15.0%
      const sigStab2 = makeSig(0, 0, 0.50);
      const resStab2 = computeComparativePathology(sigStab2, makeSig(0, 0, 0.649));
      expect(resStab2.recoveryDriftPercent).toBe(14.9);
      expect(resStab2.classification).toBe('Stabilizing');

      const resRec = computeComparativePathology(sigStab2, makeSig(0, 0, 0.650));
      expect(resRec.recoveryDriftPercent).toBe(15.0);
      expect(resRec.classification).toBe('Recovering');
    });
  });

  describe('5. Environmental Illumination Bias Detection', () => {
    const makeSigWithLum = (lum?: number): PathologySignature => ({
      hsvHistogram: new Array(48).fill(0),
      leafContours: 1,
      meanRgb: [100, 100, 100],
      textureEnergy: 10,
      luminance: lum as number,
      computedAt: new Date(),
      chlorosisFraction: 0.1,
      necrosisFraction: 0.05,
      chlorophyllFraction: 0.85,
    });

    it('triggers lightingBiasWarning when |deltaLum| > 50 and stays silent at <= 50', () => {
      // Exactly 50.0: no warning
      const res50 = computeComparativePathology(makeSigWithLum(100), makeSigWithLum(150));
      expect(res50.lightingBiasWarning).toBe(false);

      // 50.1: triggers warning
      const res50_1 = computeComparativePathology(makeSigWithLum(100), makeSigWithLum(150.1));
      expect(res50_1.lightingBiasWarning).toBe(true);

      // Negative delta -51.0: triggers warning
      const resNeg51 = computeComparativePathology(makeSigWithLum(151), makeSigWithLum(100));
      expect(resNeg51.lightingBiasWarning).toBe(true);

      // Undefined luminance in legacy signatures: safely false
      const resUndef = computeComparativePathology(makeSigWithLum(undefined), makeSigWithLum(100));
      expect(resUndef.lightingBiasWarning).toBe(false);
    });
  });

  describe('6. Resource Cleanup & Exception Resilience (PERF-02)', () => {
    it('always closes ImageBitmap in finally block even if canvas context acquisition throws', async () => {
      const mockClose = vi.fn();
      const mockBitmap = {
        width: 224,
        height: 224,
        close: mockClose,
      };

      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      // Mock canvas getContext returning null to trigger exception
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(null),
      };

      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      };

      const dummyBlob = new Blob(['sample-bytes'], { type: 'image/jpeg' });

      await expect(extractPathologySignature(dummyBlob)).rejects.toThrow(
        'Failed to acquire 2D canvas context'
      );

      // Critical invariant: bitmap.close() MUST be called in finally block
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });
});
