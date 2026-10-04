import { describe, it, expect } from 'vitest';
import { readSource } from '../../test/helpers';

/**
 * The site is installable (manifest + icons + service worker), which is the
 * path toward the native-app wrapper the project's owner has said they want.
 * The worker is the risky part: it sits between every request and the
 * network, and its two historical bugs — atomic-kill installs and replayed
 * empty API responses — both came from policy lines, not typos.
 *
 * These tests pin the policy lines of `public/sw.js` and the registration
 * gate in `main.tsx` at the source level (no DOM test environment — see
 * AGENTS.md). Each has been mutation-verified: reverting the policy turns
 * exactly the matching assertion red.
 */

const sw = readSource('public/sw.js');
const main = readSource('src/main.tsx');
const manifest = JSON.parse(readSource('public/manifest.json'));
const indexHtml = readSource('index.html');

describe('service worker registration', () => {
  it('is gated to production builds', () => {
    // In dev, Vite serves unhashed modules that mutate on every save; the
    // runtime cache would hold stale module graphs and HMR would fight it.
    // That reads as "my changes are not applying", not as a caching bug.
    expect(main).toMatch(/if \('serviceWorker' in navigator && import\.meta\.env\.PROD\)/);
  });

  it('registers the worker at the root scope', () => {
    expect(main).toContain("navigator.serviceWorker.register('/sw.js')");
  });
});

describe('the worker fetch policy', () => {
  it('never caches /api responses', () => {
    // v1.8 runtime-cached GET /api/ responses: an empty request board was
    // cached and replayed forever, so a posted request never appeared.
    // Authenticated responses must never be stored at all.
    expect(sw).toMatch(/pathname\.startsWith\('\/api\/'\)\) return;/);
  });

  it('serves cache-first only for immutable content', () => {
    // Content-hashed build output and the font CDNs can never change meaning
    // under a URL. Everything else same-origin is network-first, so
    // deployable files (OG image, manifest, icons) track the site without a
    // worker version bump — v1.x froze them at first-visit bytes.
    expect(sw).toMatch(/url\.pathname\.startsWith\('\/assets\/'\)/);
    expect(sw).toMatch(/fonts\.googleapis\.com/);
    expect(sw).toMatch(/fonts\.gstatic\.com/);
    expect(sw).toMatch(/if \(immutable\) \{/);
  });

  it('goes network-first for navigations, cache as offline fallback', () => {
    expect(sw).toMatch(/event\.request\.mode === 'navigate'/);
    expect(sw).toMatch(/caches\.match\('\/index\.html'\)/);
  });

  it('refreshes the stored copy on every fresh network response', () => {
    // The network-first branch must write its response back, or the offline
    // fallback silently ages forever. Both response branches (immutable and
    // network-first) clone-and-store what they fetch.
    expect(sw).toMatch(/if \(res\.ok\) \{\s*const copy = res\.clone\(\);/);
    expect(sw.match(/cache\.put\(/g)!.length).toBe(2);
  });

  it('versions its cache and evicts old copies on activate', () => {
    expect(sw).toMatch(/const CACHE_NAME = 'phyto-guard-v[\d.]+'/);
    expect(sw).toMatch(/keys\.filter\(\(key\) => key !== CACHE_NAME\)\.map\(\(key\) => caches\.delete\(key\)\)/);
  });

  it('installs without dying on a single missing asset', () => {
    // cache.addAll() is atomic; one 404 used to kill every install (a dead
    // texture URL took the whole worker down). Precache must be allSettled.
    expect(sw).toMatch(/Promise\.allSettled\(/);
  });

  it('registers each worker handler exactly once, at the top level', () => {
    // The push listener once lived inside the fetch handler, so a push
    // arriving before any fetch found no listener and was dropped. Five
    // handlers, one registration each — nothing nested, nothing duplicated.
    const handlers = [...sw.matchAll(/self\.addEventListener\('([a-z]+)'/g)].map((m) => m[1]);
    expect(handlers.sort()).toEqual(['activate', 'fetch', 'install', 'notificationclick', 'push']);
  });
});

describe('the install manifest', () => {
  it('carries the fields installability requires', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toMatch(/^#/);
  });

  it('ships a maskable icon and at least one 512px PNG', () => {
    // Android adaptive launchers stretch icons to their own mask; without a
    // maskable variant the crest is cropped at the edges on install.
    const pngs = manifest.icons.filter((i: { type: string }) => i.type === 'image/png');
    expect(pngs.some((i: { sizes: string }) => i.sizes.includes('512x512'))).toBe(true);
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  });

  it('matches the theme colour the document declares', () => {
    // A mismatch shows one colour on the splash and another in the installed
    // title bar.
    const meta = indexHtml.match(/<meta name="theme-color" content="([^"]+)"/);
    expect(meta, 'index.html has no theme-color meta').not.toBeNull();
    expect(meta![1]).toBe(manifest.theme_color);
  });
});
