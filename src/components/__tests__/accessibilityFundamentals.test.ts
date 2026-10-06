import { describe, expect, it } from 'vitest';
import { globSync } from 'node:fs';
import { readSource, stripJsComments } from '../../test/helpers';
import { TEXT_SIZES, TEXT_SIZE_PX, isTextSize } from '../../utils/textSize';
import { MOTION_PREFERENCES, isMotionPreference } from '../../utils/motionPreference';

/**
 * Accessibility fundamentals that a refactor quietly broke once each, stated
 * as tests. Source-level throughout — there is no DOM environment here (see
 * AGENTS.md) — except the WCAG contrast arithmetic, which is pure maths on
 * the two colours the night skin actually pairs.
 */

// ─── One main landmark, owned by Layout ─────────────────────────────────────

const tsxFiles = globSync('src/**/*.tsx').filter(f => !f.includes('__tests__'));

describe('the document has exactly one main landmark', () => {
  it('the scan found files to check', () => {
    expect(tsxFiles.length).toBeGreaterThan(30);
  });

  it('no page renders its own <main> — Layout owns the only one', () => {
    // axe: "Document should not have more than one main landmark". Home,
    // Vault and Clinic each used to nest a second <main> (as motion.main or
    // plain) inside the one Layout renders, splitting every screen reader's
    // sense of where the page content starts.
    const offenders = tsxFiles
      .filter(f => /<(motion\.main|main)\b/.test(stripJsComments(readSource(f))))
      .filter(f => !f.replaceAll('\\', '/').endsWith('src/components/Layout.tsx'));
    expect(offenders).toEqual([]);
  });
});

// ─── Heading structure ──────────────────────────────────────────────────────

describe('the home page headings form an unbroken ladder', () => {
  it('the hero renders an h1 in both exclusive states', () => {
    // axe: "Page should contain a level-one heading". The signed-in hero had
    // h2s only; the h1 lived in the pre-onboarding landing variant.
    const hero = stripJsComments(readSource('src/components/home/HeroSection.tsx'));
    expect((hero.match(/<h1\b/g) ?? []).length).toBe(2); // empty garden / featured specimen
    expect(hero).toContain('Your sanctuary is empty');
  });

  it('no card heading skips a level inside its section', () => {
    // axe: "Heading levels should only increase by one". The quickstart card
    // title was an h4 under an h2.
    const quickstart = stripJsComments(readSource('src/components/home/QuickstartGuide.tsx'));
    expect(quickstart).not.toMatch(/<h[45]\b/);
    expect(quickstart).toMatch(/<h3\b[^>]*>\s*\{steps\[activeTab\]\.title\}/);
  });
});

// ─── Night contrast: bazaar tabs ────────────────────────────────────────────

/** WCAG 2.1 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('bazaar tabs are legible on the night ground', () => {
  const css = readSource('src/styles/page-skins.css');

  it('the scan found the night override to check', () => {
    expect(css).toMatch(/:root\[data-theme="night"\] \.bazaar-tab \{/);
  });

  it('the night ink clears 4.5:1 on the near-black page', () => {
    // axe measured the day ink at 3.53:1 on #0f1419 — the help centre has no
    // bazaar-mast behind its bar, so the tabs sit straight on the page.
    // `(?<![-\w])` keeps the match off `border-color:`, which would otherwise
    // win on a greedy backtracking pass.
    const ink = css.match(/:root\[data-theme="night"\] \.bazaar-tab \{[^}]*?(?<![-\w])color:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(ink, 'the night override declares no hex colour').toBeTruthy();
    expect(contrastRatio(ink!, '#0f1419')).toBeGreaterThanOrEqual(4.5);
  });

  it('documents why the override exists: the day ink really does fail', () => {
    expect(contrastRatio('#7a6a50', '#0f1419')).toBeLessThan(4.5);
  });

  it('keeps the muted text token above 4.5:1 on the light ground', () => {
    // The footer, captions and timestamps all ride --text-muted. Its day
    // value #9C8E80 measured 2.97:1 on #faf7f2 — axe flagged it on every
    // page — and was darkened in place rather than per-component.
    const tokens = readSource('src/styles/tokens.css');
    const day = tokens.match(/--text-muted:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(day, 'the day token declares no hex colour').toBeTruthy();
    expect(contrastRatio(day!, '#faf7f2')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#9C8E80', '#faf7f2')).toBeLessThan(4.5); // the old value
  });
});

// ─── White-text CTAs on the accent fills ────────────────────────────────────

describe('white-text CTAs sit on fills that hold 4.5:1', () => {
  const tokens = readSource('src/styles/tokens.css');

  it('declares deep fill tokens for both accents', () => {
    // Night re-brightens --moss and --terracotta for glow, which drops white
    // text on bg-moss/bg-terracotta to 2.3-3.6:1 — Lighthouse caught it on
    // the lab page with a fresh profile. The deep variants exist purely as
    // white-text fills.
    expect(tokens).toMatch(/--moss-deep:\s*#3D5A3D/);
    expect(tokens).toMatch(/--terracotta-deep:\s*#B0552F/);
  });

  it('holds white text above 4.5:1 in both themes', () => {
    for (const fill of ['#3D5A3D', '#466B46', '#B0552F']) {
      expect(contrastRatio(fill, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('no lab CTA pairs bare bg-moss or bg-terracotta with white text', () => {
    const lab = stripJsComments(readSource('src/pages/BotanicalLab.tsx'));
    // `hover:bg-moss text-white` is fine — the resting fill is the deep one
    // and hover is transient state feedback — so hover-prefixed fills are
    // excluded from the ban.
    expect(lab).not.toMatch(/(?<![-\w])(?<!hover:)bg-moss(?![\w/-])[^"']*text-white/);
    expect(lab).not.toMatch(/(?<![-\w])(?<!hover:)bg-terracotta(?![\w/-])[^"']*text-white/);
  });

  it('the eyepiece is named by what it shows, not around it', () => {
    // Label in Name (WCAG 2.5.3) plus the decorative reticle numerals hidden
    // from the name computation.
    const lab = stripJsComments(readSource('src/pages/BotanicalLab.tsx'));
    expect(lab).toMatch(/aria-label=\{`Activate the microscope eyepiece[^`]*\$\{/);
    expect(lab).toMatch(/<svg\s+aria-hidden="true"\s+className="absolute inset-0 w-full h-full pointer-events-none text-\[#2d4a33\]/);
  });

  it('the welcome kicker and auth brass ink pass in both themes', () => {
    const home = stripJsComments(readSource('src/pages/Home.tsx'));
    expect(home).toMatch(/text-\[#6B6156\] dark:text-\[#9A9086\]/);
    expect(contrastRatio('#9A9086', '#121619')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#7A756D', '#121619')).toBeLessThan(4.5); // the old pair

    const auth = stripJsComments(readSource('src/pages/Auth.tsx'));
    expect(auth).toMatch(/text-\[#6d5628\] dark:text-\[#c9a86a\]/);
    expect(contrastRatio('#6d5628', '#f5f0e4')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#c9a86a', '#191410')).toBeGreaterThanOrEqual(4.5);
  });
});

// ─── Text size ──────────────────────────────────────────────────────────────

describe('the text-size setting', () => {
  it('offers four sizes and maps each to a root font size', () => {
    expect(TEXT_SIZES).toEqual(['small', 'default', 'large', 'extra-large']);
    expect(Object.values(TEXT_SIZE_PX)).toEqual([14, 16, 18, 20]);
  });

  it('rejects unknown values instead of applying them', () => {
    expect(isTextSize('large')).toBe(true);
    expect(isTextSize('enormous')).toBe(false);
  });

  it('is applied to <html> before the app first renders', () => {
    // Applying after paint would draw the page at 16px and visibly reflow.
    const boot = stripJsComments(readSource('src/main.tsx'));
    expect(boot.indexOf('initTextSize()')).toBeGreaterThan(-1);
    expect(boot.indexOf('initTextSize()')).toBeLessThan(boot.indexOf('runDbMigration()'));
  });

  it('has a labelled, per-option-announced control in Profile settings', () => {
    const profile = stripJsComments(readSource('src/pages/Profile.tsx'));
    expect(profile).toMatch(/role="group" aria-label="Text size"/);
    // aria-pressed, not aria-selected: these are toggle buttons, and a
    // screen reader must hear which one is in force.
    expect(profile).toMatch(/aria-pressed=\{textSize === size\}/);
  });
});

// ─── Motion preference ──────────────────────────────────────────────────────

describe('the motion-preference setting', () => {
  it('has three honest positions and rejects everything else', () => {
    expect(MOTION_PREFERENCES).toEqual(['auto', 'reduced', 'full']);
    expect(isMotionPreference('reduced')).toBe(true);
    expect(isMotionPreference('wobbly')).toBe(false);
  });

  it('is layered over the OS setting inside useEcoMode', () => {
    const hook = stripJsComments(readSource('src/hooks/useEcoMode.ts'));
    expect(hook).toContain("getMotionPreference()");
    // 'reduced' forces it on, 'full' forces it off, 'auto' defers to the OS.
    expect(hook).toMatch(/preference === 'reduced' \|\| \(preference === 'auto' && mediaQuery\.matches\)/);
    expect(hook).toContain('MOTION_PREFERENCE_EVENT');
  });

  it('reaches the CSS-only ambient layers through data attributes', () => {
    // CSS cannot read localStorage. The component publishes the resolved
    // preference; the stylesheet stills on it, exactly as it does under the
    // prefers-reduced-motion media query.
    const ambience = stripJsComments(readSource('src/components/GardenAmbience.tsx'));
    expect(ambience).toMatch(/data-motion=\{motionPreference\}/);
    expect(ambience).toMatch(/data-still=\{still \? 'true' : undefined\}/);

    const css = readSource('src/styles/garden-ambience.css');
    expect(css).toMatch(/\.garden-ambience\[data-still='true'\] \.garden-pool/);
    // 'full' must beat the OS switch too — the media query releases the
    // layers when the Keeper explicitly chose motion.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.garden-ambience:not\(\[data-motion='full'\]\) \.garden-pool/);
  });

  it('has a labelled, per-option-announced control in Profile settings', () => {
    const profile = stripJsComments(readSource('src/pages/Profile.tsx'));
    expect(profile).toMatch(/role="group" aria-label="Garden motion"/);
    expect(profile).toMatch(/aria-pressed=\{motionPreference === preference\}/);
  });
});

// ─── Live regions for async changes ─────────────────────────────────────────

describe('async place and weather changes are announced', () => {
  it('the location bar exposes a live region and a status line', () => {
    // A saved city, a landed GPS fix and a failed lookup all re-render the
    // bar long after the page loaded; silent text replacement is invisible
    // to a screen reader mid-paragraph.
    const bar = stripJsComments(readSource('src/components/home/LocationBar.tsx'));
    expect(bar).toContain('aria-live="polite"');
    expect(bar).toMatch(/<p role="status"/);
  });
});

// ─── The keyboard path ──────────────────────────────────────────────────────

describe('the keyboard path starts somewhere sensible', () => {
  it('the skip link is the first focusable thing on every page', () => {
    const layout = stripJsComments(readSource('src/components/Layout.tsx'));
    const skip = layout.indexOf('href="#main-content"');
    expect(skip, 'Layout renders no skip link').toBeGreaterThan(-1);
    const nav = layout.indexOf('<NavigationBar');
    const main = layout.indexOf('<main');
    expect(skip).toBeLessThan(nav);
    expect(skip).toBeLessThan(main);
  });

  it('its target accepts programmatic focus without painting a page-wide ring', () => {
    // tabIndex={-1} and focus:outline-none are a pair on <main>: the tab index
    // lets the skip link land focus there, and the outline rule keeps that
    // programmatic move from drawing a ring around the entire page.
    const layout = stripJsComments(readSource('src/components/Layout.tsx'));
    expect(layout).toMatch(/<main\s+id="main-content"\s+tabIndex=\{-1\}/);
    expect(layout).toMatch(/focus:outline-none/);
  });

  it('a global :focus-visible ring exists so keyboard focus is never invisible', () => {
    const base = readSource('src/index.css');
    expect(base).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px/);
  });
});
