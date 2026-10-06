import { describe, it, expect } from 'vitest';
import { resolveWeatherPlace } from '../geocode';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Challenger Empirical Verifications — closed findings.
 *
 * Every finding in this file was first written as a reproduction of a real
 * bug, then the bug was fixed, and the assertions flipped to pin the FIXED
 * behaviour so none of them can silently regress.
 */

const read = (p: string): string => fs.readFileSync(path.resolve(process.cwd(), p), 'utf-8');

describe('Challenger Empirical Verifications', () => {
  describe('Finding 7: zero-coordinate fixes are valid placements', () => {
    it('accepts { latitude: 0, longitude: 0 } — Null Island is a real place', async () => {
      const result = await resolveWeatherPlace('', { latitude: 0, longitude: 0 });
      expect(result).toEqual({ latitude: 0, longitude: 0, city: 'Your location' });
    });

    it('accepts { latitude: 0, longitude: 36.8 } — a point on the Equator', async () => {
      const result = await resolveWeatherPlace('', { latitude: 0, longitude: 36.8 });
      expect(result).toEqual({ latitude: 0, longitude: 36.8, city: 'Your location' });
    });

    it('accepts { latitude: 51.5, longitude: 0 } — a point on the Prime Meridian', async () => {
      const result = await resolveWeatherPlace('', { latitude: 51.5, longitude: 0 });
      expect(result).toEqual({ latitude: 51.5, longitude: 0, city: 'Your location' });
    });

    it('still prefers ordinary coordinates and rejects a missing fix', async () => {
      expect(await resolveWeatherPlace('', { latitude: 12.9, longitude: 77.5 })).toEqual({
        latitude: 12.9,
        longitude: 77.5,
        city: 'Your location',
      });
      // No fix and no city: nothing to resolve, and no geocode request spent.
      expect(await resolveWeatherPlace('', null)).toBeNull();
    });
  });

  describe('Finding 5: imagePipeline releases its bitmap on every path', () => {
    it('closes the bitmap in a finally block, so a canvas failure cannot leak it', () => {
      const content = read('src/utils/imagePipeline.ts');
      expect(content).toContain('createImageBitmap');
      expect(content).toMatch(/finally\s*\{[^}]*bitmap\?\.close\(\)/s);
      // No unguarded close() calls left in the try body — the finally owns it.
      expect(content.match(/bitmap\.close\(\)/g) ?? []).toEqual([]);
      expect(content.match(/bitmap\?\.close\(\)/g) ?? []).toHaveLength(1);
    });
  });

  describe('Finding 2: a coach purchase grants a persisted supply', () => {
    it('handlePurchase writes the item to the persisted shelf, keyed by itemId', () => {
      const content = read('src/components/home/GardenCoach.tsx');
      const handlePurchaseMatch = content.match(/const handlePurchase = async \(([^)]+)\) => \{([\s\S]*?)\n\s*\};/);
      expect(handlePurchaseMatch).not.toBeNull();

      const body = handlePurchaseMatch![2];
      // The itemId the caller paid for must appear in the grant, and the
      // grant must be persisted before it is shown.
      expect(body).toContain('itemId');
      expect(body).toContain('COACH_SHELF_KEY');
      expect(body).toContain('localStorage.setItem(COACH_SHELF_KEY');
      // The seed spend still happens, and a failed spend rolls the grant back.
      expect(body).toContain('GameService.spendSeeds');
      expect(body).toMatch(/localStorage\.setItem\(COACH_SHELF_KEY, JSON\.stringify\(readShelf\(\)\)\)/);
    });
  });

  describe('Finding 3: care-plan claims survive leaving the dashboard', () => {
    it('the plan effect rehydrates today\'s claimed steps from the claim store', () => {
      const content = read('src/components/home/GardenCoach.tsx');
      // Fresh plans still start undone — the claims are merged on top.
      expect(content).toMatch(/done:\s*false/);
      // …and the merge is the persisted claim store, scoped per user/plant/day.
      expect(content).toContain('PLAN_CLAIMS_KEY');
      expect(content).toContain('readClaimedTexts(selectedPlant?.id)');
      // Both reward paths — single step and mark-all — persist their claims.
      // (Three matches: the two call sites plus the function's own definition.)
      expect(content.match(/persistClaimedTexts\(/g) ?? []).toHaveLength(3);
    });
  });

  describe('Finding 4: the service worker precaches the fonts the app actually ships', () => {
    it('precache holds the self-hosted faces and the dead Google URL is gone', () => {
      const content = read('public/sw.js');
      expect(content).toContain('/fonts/plus-jakarta-sans-latin.woff2');
      expect(content).toContain('/fonts/cormorant-garamond-latin.woff2');
      expect(content).toContain('/fonts/cormorant-garamond-italic-latin.woff2');
      expect(content).not.toContain('fonts.googleapis.com');
      expect(content).not.toContain('fonts.gstatic.com');
    });

    it('treats /fonts/ as immutable content, cache-first', () => {
      const content = read('public/sw.js');
      expect(content).toContain("url.pathname.startsWith('/fonts/')");
    });
  });
});
