import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractSignature,
  classifyDrift,
  computeDrift,
  analyzePlantHealth,
  type PlantSignature
} from '../driftDetector';
import { TelemetryService } from '../telemetryService';

describe('DriftDetector Empirical Challenge Tests', () => {
  beforeEach(() => {
    vi.spyOn(TelemetryService, 'log').mockImplementation(async () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PERF-02: GPU ImageBitmap Memory Leak & Cleanup', () => {
    it('calls bitmap.close() after successful signature extraction', async () => {
      const mockBitmapClose = vi.fn();
      const mockBitmap = {
        width: 224,
        height: 224,
        close: mockBitmapClose,
      };

      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      const fakePixels = new Uint8ClampedArray(224 * 224 * 4);
      // Fill with some dummy RGB data (e.g. green pixels)
      for (let i = 0; i < fakePixels.length; i += 4) {
        fakePixels[i] = 30;      // R
        fakePixels[i + 1] = 180; // G
        fakePixels[i + 2] = 40;  // B
        fakePixels[i + 3] = 255; // A
      }

      const mockDrawImage = vi.fn();
      const mockGetImageData = vi.fn().mockReturnValue({ data: fakePixels });
      const mockCtx = {
        drawImage: mockDrawImage,
        getImageData: mockGetImageData,
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
      };

      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      };

      const dummyBlob = new Blob(['mock'], { type: 'image/jpeg' });
      const signature = await extractSignature(dummyBlob);

      expect(mockDrawImage).toHaveBeenCalledWith(mockBitmap, 0, 0, 224, 224);
      expect(mockGetImageData).toHaveBeenCalledWith(0, 0, 224, 224);
      expect(mockBitmapClose).toHaveBeenCalledTimes(1);
      expect(signature).toBeDefined();
      expect(signature.hsvHistogram).toHaveLength(48);
      expect(signature.meanRgb[1]).toBe(180);
      expect(signature.luminance).toBeGreaterThan(0);
    });

    it('calls bitmap.close() in finally block even when getImageData throws an error', async () => {
      const mockBitmapClose = vi.fn();
      const mockBitmap = {
        width: 224,
        height: 224,
        close: mockBitmapClose,
      };

      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      const mockGetImageData = vi.fn().mockImplementation(() => {
        throw new Error('Canvas SecurityError: tainted canvas');
      });

      const mockCtx = {
        drawImage: vi.fn(),
        getImageData: mockGetImageData,
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
      };

      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      };

      const dummyBlob = new Blob(['mock'], { type: 'image/jpeg' });

      await expect(extractSignature(dummyBlob)).rejects.toThrow('Canvas SecurityError: tainted canvas');
      // Crucial verification: bitmap.close() must still have been called despite the throw
      expect(mockBitmapClose).toHaveBeenCalledTimes(1);
    });

    it('calls bitmap.close() in finally block even when drawImage throws an error', async () => {
      const mockBitmapClose = vi.fn();
      const mockBitmap = {
        width: 224,
        height: 224,
        close: mockBitmapClose,
      };

      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      const mockCtx = {
        drawImage: vi.fn().mockImplementation(() => {
          throw new Error('GPU Context Lost');
        }),
        getImageData: vi.fn(),
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
      };

      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      };

      const dummyBlob = new Blob(['mock'], { type: 'image/jpeg' });

      await expect(extractSignature(dummyBlob)).rejects.toThrow('GPU Context Lost');
      expect(mockBitmapClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('PERF-01: yieldToMain and Main-Thread Yielding', () => {
    it('executes cleanly in Node environment without requestIdleCallback (setTimeout fallback)', async () => {
      // Ensure requestIdleCallback is undefined
      const originalRIC = (globalThis as any).requestIdleCallback;
      delete (globalThis as any).requestIdleCallback;

      const mockBitmap = {
        width: 224,
        height: 224,
        close: vi.fn(),
      };
      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      const fakePixels = new Uint8ClampedArray(224 * 224 * 4);
      const mockCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: fakePixels }),
      };
      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue({
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(mockCtx),
        }),
      };

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      const start = performance.now();
      const signature = await extractSignature(new Blob(['test']));
      const elapsed = performance.now() - start;

      expect(signature).toBeDefined();
      expect(setTimeoutSpy).toHaveBeenCalled();
      // Verify that setTimeout was called multiple times across chunked loops
      expect(setTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(10);

      if (originalRIC) {
        (globalThis as any).requestIdleCallback = originalRIC;
      }
    });

    it('uses requestIdleCallback when available in browser environment', async () => {
      const mockIdleCallback = vi.fn((cb: any) => {
        return setTimeout(cb, 0);
      });
      (globalThis as any).requestIdleCallback = mockIdleCallback;

      const mockBitmap = {
        width: 224,
        height: 224,
        close: vi.fn(),
      };
      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      const fakePixels = new Uint8ClampedArray(224 * 224 * 4);
      const mockCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: fakePixels }),
      };
      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue({
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(mockCtx),
        }),
      };

      const signature = await extractSignature(new Blob(['test']));
      expect(signature).toBeDefined();
      // 50k pixels / 8192 chunks = 6 yields in loop 1
      // + 6 yields in mask loop
      // + 224 / 32 = 6 yields in contour loop
      // + 222 / 32 = 6 yields in texture energy loop
      // Total should be around 24 yields
      expect(mockIdleCallback.mock.calls.length).toBeGreaterThanOrEqual(18);

      delete (globalThis as any).requestIdleCallback;
    });
  });

  describe('Edge Values & Logic: classifyDrift and analyzePlantHealth', () => {
    it('accurately classifies drift at exact threshold boundaries', () => {
      // Threshold 1: 0.12 (boundary between 'stable' and 'watching')
      expect(classifyDrift(0.0)).toBe('stable');
      expect(classifyDrift(0.05)).toBe('stable');
      expect(classifyDrift(0.119)).toBe('stable');
      expect(classifyDrift(0.12)).toBe('watching');
      expect(classifyDrift(0.15)).toBe('watching');
      expect(classifyDrift(0.20)).toBe('watching');

      // Threshold 2: 0.28 (boundary between 'watching' and 'alert')
      expect(classifyDrift(0.279)).toBe('watching');
      expect(classifyDrift(0.28)).toBe('alert');
      expect(classifyDrift(0.30)).toBe('alert');
      expect(classifyDrift(0.85)).toBe('alert');
      expect(classifyDrift(1.0)).toBe('alert');
    });

    it('computes expected drift score for identical signatures', () => {
      const dummySig: PlantSignature = {
        hsvHistogram: new Array(48).fill(1 / 48),
        leafContours: 5,
        meanRgb: [100, 150, 80],
        textureEnergy: 12.5,
        computedAt: new Date(),
        luminance: 130,
      };

      const drift = computeDrift(dummySig, dummySig);
      expect(drift).toBeCloseTo(0.0, 5);
      expect(classifyDrift(drift)).toBe('stable');
    });

    it('analyzePlantHealth establishes baseline when baseline is null', async () => {
      const mockBitmap = {
        width: 224,
        height: 224,
        close: vi.fn(),
      };
      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      const fakePixels = new Uint8ClampedArray(224 * 224 * 4);
      const mockCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: fakePixels }),
      };
      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue({
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(mockCtx),
        }),
      };

      const res = await analyzePlantHealth(new Blob(['test']), null);
      expect(res.driftScore).toBe(0);
      expect(res.driftStatus).toBe('stable');
      expect(res.reasoning[0]).toBe('Baseline established.');
    });

    it('analyzePlantHealth detects luminance variance (>50) and emits bias warning', async () => {
      const mockBitmap = {
        width: 224,
        height: 224,
        close: vi.fn(),
      };
      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      // Create white image (luminance ~ 255)
      const brightPixels = new Uint8ClampedArray(224 * 224 * 4);
      brightPixels.fill(255);

      const mockCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: brightPixels }),
      };
      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue({
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(mockCtx),
        }),
      };

      // Baseline with low luminance (0)
      const darkBaseline: PlantSignature = {
        hsvHistogram: new Array(48).fill(1 / 48),
        leafContours: 0,
        meanRgb: [0, 0, 0],
        textureEnergy: 0,
        computedAt: new Date(),
        luminance: 10,
      };

      const res = await analyzePlantHealth(new Blob(['bright']), darkBaseline);
      expect(res.biasWarning).toContain('Significant lighting variance detected');
    });
    it('calls bitmap.close() even when getContext returns null', async () => {
      const mockBitmapClose = vi.fn();
      const mockBitmap = {
        width: 224,
        height: 224,
        close: mockBitmapClose,
      };

      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(null),
      };

      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      };

      const dummyBlob = new Blob(['mock'], { type: 'image/jpeg' });

      await expect(extractSignature(dummyBlob)).rejects.toThrow();
      expect(mockBitmapClose).toHaveBeenCalledTimes(1);
    });

    it('handles all-black (zeros) and all-white (max) images without NaN or division by zero', async () => {
      const mockBitmap = {
        width: 224,
        height: 224,
        close: vi.fn(),
      };
      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

      // All black
      const blackPixels = new Uint8ClampedArray(224 * 224 * 4); // all 0
      const mockCtxBlack = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({ data: blackPixels }),
      };
      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue({
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(mockCtxBlack),
        }),
      };

      const blackSig = await extractSignature(new Blob(['black']));
      expect(blackSig.hsvHistogram.some(v => Number.isNaN(v))).toBe(false);
      expect(Number.isNaN(blackSig.textureEnergy)).toBe(false);
      expect(Number.isNaN(blackSig.luminance!)).toBe(false);

      // Compare black to black
      const blackDrift = computeDrift(blackSig, blackSig);
      expect(Number.isNaN(blackDrift)).toBe(false);
      expect(blackDrift).toBeCloseTo(0, 4);

      // Unknown species test in analyzePlantHealth
      const resUnknown = await analyzePlantHealth(new Blob(['test']), blackSig, 'NonExistentSpecies');
      expect(resUnknown.driftStatus).toBe('stable');
      expect(Number.isNaN(resUnknown.driftScore)).toBe(false);
    });
  });
});
