import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readSource, stripJsComments } from '../../test/helpers';
import { MAX_SCAN_EDGE, SCAN_JPEG_QUALITY } from '../imagePipeline';

/**
 * The scan upload pipeline, pinned at source level (there is no DOM here, so
 * the canvas path itself is exercised only in the browser).
 *
 * The regression this guards: every scan path used to FileReader the raw
 * camera file straight into base64. A modern phone photo inflated to 4-11MB
 * of payload — minutes on mobile data — and anything over 6MB died at the
 * server's hard cap (413) before the AI ever saw it. Two of the three scan
 * paths also skipped the Keeper's location, so the payload's location-aware
 * fields (local pest risks, seasonal care) came back empty.
 */

const lab = stripJsComments(readSource('src/pages/BotanicalLab.tsx'));
const clinic = stripJsComments(readSource('src/pages/Clinic.tsx'));

describe('scan uploads are prepared, not raw', () => {
  it('the pipeline caps the longest edge and uses a sane JPEG quality', () => {
    // 2048px keeps diagnosis quality; the cap exists for bandwidth, and
    // quality below 0.8 starts smudging the exact symptoms the model reads.
    expect(MAX_SCAN_EDGE).toBe(2048);
    expect(SCAN_JPEG_QUALITY).toBeGreaterThanOrEqual(0.8);
    expect(SCAN_JPEG_QUALITY).toBeLessThanOrEqual(0.9);
  });

  it('all three scan paths run the image through the pipeline', () => {
    const files = ['src/pages/BotanicalLab.tsx', 'src/pages/Clinic.tsx'];
    for (const f of files) {
      const src = stripJsComments(readSource(f));
      expect(src, `${f} never imports the pipeline`).toContain('prepareScanImage');
      // The old FileReader-then-upload pattern is what the pipeline replaced.
      expect(src, `${f} still uploads a raw FileReader result`).not.toMatch(/reader\.result as string/);
      expect(src, `${f} still drives uploads from readAsDataURL`).not.toMatch(/readAsDataURL\(/);
    }
    // The lab has two distinct scan paths (new specimen + photo check-in).
    expect(lab.match(/prepareScanImage\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('every identify call carries the Keeper\'s place when one is chosen', () => {
    // The schema's locationAdvice/seasonalCare/localPestRisks fields are
    // derived from the location block; a scan without it gets honest empty
    // fields instead of hallucinated ones.
    for (const [name, src] of [['lab', lab], ['clinic', clinic]] as const) {
      const calls = src.match(/identifyPlant\(/g)?.length ?? 0;
      expect(calls, `${name} calls identifyPlant`).toBeGreaterThan(0);
      for (const call of src.match(/identifyPlant\([^)]*\)/g) ?? []) {
        expect(call, `${name} scan skips the location context: ${call}`).toMatch('locationCtx');
      }
    }
  });

  it('the archived photo keeps the original file; only the AI upload is optimised', () => {
    // The cloud copy is the keeper's record — downscaling it would throw
    // away pixels forever to save one upload.
    expect(lab).toMatch(/uploadPlantPhoto\(file, userId\)/);
  });
});

describe('route loading reserves its height', () => {
  it('the lazy-route fallback is taller than the fold', () => {
    // The short spinner fallback let ~50px of footer peek over the bottom
    // edge, then shoved it down when the chunk landed: 0.17 CLS on the lab.
    // The trace now reads 0.00.
    const app = stripJsComments(readSource('src/App.tsx'));
    expect(app).toMatch(/min-h-\[110dvh\]/);
  });
});

describe('brand fonts are self-hosted', () => {
  const fontsCss = readFileSync('src/styles/fonts.css', 'utf8');
  const indexHtml = readFileSync('index.html', 'utf8');
  const indexCss = readFileSync('src/index.css', 'utf8');

  it('the Google Fonts import is gone', () => {
    // It chained font discovery behind two network round-trips, it failed
    // entirely offline (this app is offline-first), and the late swap was
    // the single largest layout shift on the lab page.
    expect(indexCss).not.toContain('fonts.googleapis.com');
  });

  it('all three faces are declared and the two criticals are preloaded', () => {
    expect(fontsCss.match(/@font-face/g)?.length).toBe(3);
    expect(fontsCss.match(/font-display:\s*swap/g)?.length).toBe(3);
    expect(indexHtml.match(/rel="preload" href="\/fonts\//g)?.length).toBe(2);
    expect(indexHtml).toContain('cormorant-garamond-latin.woff2');
    expect(indexHtml).toContain('plus-jakarta-sans-latin.woff2');
  });

  it('the font files actually exist in public', () => {
    for (const f of ['cormorant-garamond-latin', 'cormorant-garamond-italic-latin', 'plus-jakarta-sans-latin']) {
      expect(() => readFileSync(`public/fonts/${f}.woff2`), `${f}.woff2 missing`).not.toThrow();
    }
  });
});
