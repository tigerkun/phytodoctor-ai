import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  imaggaEnabled,
  imaggaStatus,
  evaluateImaggaTags,
  assessImageWithImagga,
  _resetImaggaStateForTests,
  type ImaggaTag,
} from '../imaggaClient';

describe('imaggaClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetImaggaStateForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetImaggaStateForTests();
    vi.restoreAllMocks();
  });

  describe('imaggaEnabled and credentials', () => {
    it('returns false when IMAGGA_API_KEY or IMAGGA_API_SECRET is missing', () => {
      delete process.env.IMAGGA_API_KEY;
      delete process.env.IMAGGA_API_SECRET;
      expect(imaggaEnabled()).toBe(false);

      process.env.IMAGGA_API_KEY = 'test_key';
      delete process.env.IMAGGA_API_SECRET;
      expect(imaggaEnabled()).toBe(false);

      delete process.env.IMAGGA_API_KEY;
      process.env.IMAGGA_API_SECRET = 'test_secret';
      expect(imaggaEnabled()).toBe(false);
    });

    it('returns false if keys are empty strings or whitespace only', () => {
      process.env.IMAGGA_API_KEY = '   ';
      process.env.IMAGGA_API_SECRET = 'test_secret';
      expect(imaggaEnabled()).toBe(false);
    });

    it('returns true when both credentials are provided and breaker is clear', () => {
      process.env.IMAGGA_API_KEY = 'test_key';
      process.env.IMAGGA_API_SECRET = 'test_secret';
      expect(imaggaEnabled()).toBe(true);

      const status = imaggaStatus();
      expect(status.enabled).toBe(true);
      expect(status.requestsUsed).toBe(0);
      expect(status.disabledReason).toBeNull();
    });
  });

  describe('evaluateImaggaTags: botanical vs non-plant classification', () => {
    it('identifies confident botanical specimens (Monstera case)', () => {
      const tags: ImaggaTag[] = [
        { name: 'leaf', confidence: 96.1 },
        { name: 'plant', confidence: 92.4 },
        { name: 'foliage', confidence: 85.0 },
        { name: 'houseplant', confidence: 78.5 },
      ];

      const result = evaluateImaggaTags(tags);
      expect(result.plantMax).toBeCloseTo(96.1);
      expect(result.objectMax).toBe(0);
      expect(result.isClearlyNonPlant).toBe(false);
      expect(result.evidence).toContain('leaf (96.1)');
      expect(result.evidence).toContain('plant (92.4)');
    });

    it('diverts unambiguous inanimate objects (Pizza case)', () => {
      const tags: ImaggaTag[] = [
        { name: 'pizza', confidence: 100.0 },
        { name: 'food', confidence: 85.4 },
        { name: 'dish', confidence: 78.2 },
        { name: 'meal', confidence: 72.0 },
      ];

      const result = evaluateImaggaTags(tags);
      expect(result.plantMax).toBe(0);
      expect(result.objectMax).toBe(100.0);
      expect(result.isClearlyNonPlant).toBe(true);
      expect(result.evidence).toContain('pizza (100.0)');
      expect(result.evidence).toContain('food (85.4)');
    });

    it('protects plants with companion furniture/room object tags', () => {
      // Monstera on a coffee table in a living room
      const tags: ImaggaTag[] = [
        { name: 'houseplant', confidence: 94.0 },
        { name: 'leaf', confidence: 89.2 },
        { name: 'table', confidence: 80.0 },
        { name: 'room', confidence: 75.0 },
        { name: 'interior', confidence: 71.0 },
      ];

      const result = evaluateImaggaTags(tags);
      expect(result.plantMax).toBe(94.0);
      expect(result.objectMax).toBe(75.0);
      // Because plantMax >= 30, it is NOT diverted as clearly non-plant!
      expect(result.isClearlyNonPlant).toBe(false);
    });

    it('preserves conservative bias for marginal non-plant images (Wind-farm case)', () => {
      // No object tag reaches the 70.0 divert threshold
      const tags: ImaggaTag[] = [
        { name: 'sky', confidence: 64.0 },
        { name: 'landscape', confidence: 58.2 },
        { name: 'mountain', confidence: 45.0 },
      ];

      const result = evaluateImaggaTags(tags);
      expect(result.plantMax).toBe(0);
      expect(result.objectMax).toBe(64.0);
      // 64 < 70 threshold, so it does NOT divert — proceeds to Gemini triage
      expect(result.isClearlyNonPlant).toBe(false);
      expect(result.evidence).toContain('sky (64.0)');
    });

    it('ignores weak tags below the evidence threshold (30%)', () => {
      const tags: ImaggaTag[] = [
        { name: 'plant', confidence: 25.0 },
        { name: 'car', confidence: 28.0 },
      ];

      const result = evaluateImaggaTags(tags);
      expect(result.plantMax).toBe(0);
      expect(result.objectMax).toBe(0);
      expect(result.isClearlyNonPlant).toBe(false);
      expect(result.evidence).toBe('');
    });

    it('formats evidence with up to 10 top tags', () => {
      const tags: ImaggaTag[] = Array.from({ length: 15 }, (_, i) => ({
        name: `tag${i}`,
        confidence: 90 - i,
      }));

      const result = evaluateImaggaTags(tags);
      const parts = result.evidence.split(', ');
      expect(parts.length).toBe(10);
      expect(parts[0]).toBe('tag0 (90.0)');
      expect(parts[9]).toBe('tag9 (81.0)');
    });
  });

  describe('assessImageWithImagga: runtime & circuit breaker', () => {
    it('returns null immediately without fetch if credentials are absent', async () => {
      delete process.env.IMAGGA_API_KEY;
      delete process.env.IMAGGA_API_SECRET;

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const result = await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('performs upload and tag read on valid response', async () => {
      process.env.IMAGGA_API_KEY = 'test_key';
      process.env.IMAGGA_API_SECRET = 'test_secret';

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ result: { upload_id: 'up_12345' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              tags: [
                { tag: { en: 'leaf' }, confidence: 95.5 },
                { tag: { en: 'plant' }, confidence: 91.0 },
              ],
            },
          }),
        } as Response);

      const result = await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      expect(result).not.toBeNull();
      expect(result?.plantMax).toBeCloseTo(95.5);
      expect(result?.isClearlyNonPlant).toBe(false);

      const status = imaggaStatus();
      expect(status.requestsUsed).toBe(2);
      expect(status.disabledReason).toBeNull();
    });

    it('trips circuit breaker immediately on HTTP 402 or 429 quota exhaustion', async () => {
      process.env.IMAGGA_API_KEY = 'test_key';
      process.env.IMAGGA_API_SECRET = 'test_secret';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      } as Response);

      const first = await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      expect(first).toBeNull();

      const status = imaggaStatus();
      expect(status.enabled).toBe(false);
      expect(status.disabledReason).toContain('quota exhausted');

      // Subsequent call does not even attempt fetch
      fetchSpy.mockClear();
      const second = await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      expect(second).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('trips circuit breaker after 3 consecutive transport failures', async () => {
      process.env.IMAGGA_API_KEY = 'test_key';
      process.env.IMAGGA_API_SECRET = 'test_secret';

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      // 1st failure
      await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      expect(imaggaStatus().enabled).toBe(true);

      // 2nd failure
      await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      expect(imaggaStatus().enabled).toBe(true);

      // 3rd failure: trips breaker
      await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      const status = imaggaStatus();
      expect(status.enabled).toBe(false);
      expect(status.disabledReason).toContain('3 consecutive failures');
    });

    it('trips breaker when in-memory counter reaches free plan limit (100)', async () => {
      process.env.IMAGGA_API_KEY = 'test_key';
      process.env.IMAGGA_API_SECRET = 'test_secret';

      // Simulate 50 successful scans (100 requests)
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ result: { upload_id: 'up_123', tags: [] } }),
        } as Response);

      for (let i = 0; i < 50; i++) {
        await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      }

      expect(imaggaStatus().requestsUsed).toBe(100);

      // 51st attempt trips breaker without fetching
      fetchSpy.mockClear();
      const result = await assessImageWithImagga('aW1hZ2VkYXRh', 'image/jpeg');
      expect(result).toBeNull();
      expect(imaggaStatus().enabled).toBe(false);
      expect(imaggaStatus().disabledReason).toContain('100/month plan limit');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('server.ts /api/identify integration contracts', () => {
    it('wires Imagga pre-screen and prompt enrichment correctly in server.ts', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');

      // Import contract
      expect(serverCode).toContain('import { assessImageWithImagga, imaggaStatus } from "./src/lib/imaggaClient";');

      // Execution contract before Gemini call
      expect(serverCode).toMatch(/const imagga = await assessImageWithImagga\(base64Data, mimeType\);/);

      // Pre-screen divert contract
      expect(serverCode).toContain('if (imagga?.isClearlyNonPlant)');
      expect(serverCode).toContain("route: 'non_living'");
      expect(serverCode).toContain('void persistScanReport(report, req);');

      // Prompt enrichment contract
      expect(serverCode).toContain('IMAGE ANALYSIS SERVICE EVIDENCE');
      expect(serverCode).toContain('Top tags: ${imagga.evidence}');
    });
  });
});
