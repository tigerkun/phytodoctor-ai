import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_DESTINATIONS, pageTitle } from '../../lib/navRoutes';

/**
 * The two nav bars had drifted into different maps of the same product -- the
 * desktop bar showed Library, the phone bar showed the Vault and an AI Chat tab
 * that duplicated the floating gardener button. Two hand-kept arrays meant
 * every new destination had to be added twice, and nothing failed when it
 * wasn't.
 *
 * These tests read the real component source and fail if either bar goes back
 * to keeping its own list, or if the landmarks that make the app navigable by
 * keyboard and by screen reader quietly disappear.
 */

const read = (relative: string) =>
  readFileSync(join(process.cwd(), 'src', relative), 'utf8');

/** Comments explain the rules in prose, including the old broken ones, so a
 *  grep over raw source matches text that is no longer code. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
}

const navigationBar = stripComments(read('components/home/NavigationBar.tsx'));
const mobileBottomNav = stripComments(read('components/home/MobileBottomNav.tsx'));
const layout = stripComments(read('components/Layout.tsx'));

describe('both nav bars read from one destination list', () => {
  it('reads the component sources it means to check', () => {
    expect(navigationBar.length).toBeGreaterThan(500);
    expect(mobileBottomNav.length).toBeGreaterThan(500);
    expect(layout.length).toBeGreaterThan(500);
  });

  it('has no hand-kept destination array left in either bar', () => {
    // The exact shape both files used to carry: an inline { label, href } pair.
    for (const [name, source] of [['NavigationBar', navigationBar], ['MobileBottomNav', mobileBottomNav]] as const) {
      expect(source, `${name} still declares its own destinations`).not.toMatch(/label:\s*'[^']+',\s*href:/);
    }
  });

  it('derives both bars from navRoutes', () => {
    expect(navigationBar).toContain("from '@/lib/navRoutes'");
    expect(mobileBottomNav).toContain("from '@/lib/navRoutes'");
    expect(navigationBar).toContain('NAV_DESTINATIONS');
    expect(mobileBottomNav).toContain('bottomBarDestinations');
  });
});

describe('navigation uses real links, not click handlers on buttons', () => {
  it('renders destinations as NavLink in both bars', () => {
    // A button has no href, so the browser cannot open the page in a new tab
    // and a packaged app cannot register it as a deep link.
    for (const source of [navigationBar, mobileBottomNav]) {
      expect(source).toContain('<NavLink');
    }
  });

  it('labels both navs as landmarks', () => {
    expect(navigationBar).toContain('aria-label="Primary"');
    expect(mobileBottomNav).toContain('aria-label="Primary"');
  });

  it('gives the bottom-bar icons a full accessible name', () => {
    // The visible label is 8px caps that fit the bar. This is what a screen
    // reader actually says.
    expect(mobileBottomNav).toContain('aria-label={item.label}');
  });
});

describe('the back control works without the browser back button', () => {
  it('puts a back control in the header', () => {
    expect(navigationBar).toContain('useAppBack');
    expect(navigationBar).toContain('goBack');
  });

  it('names the control from the resolved target', () => {
    expect(navigationBar).toContain('aria-label={back.label}');
  });

  it('no longer reads history depth off window.history', () => {
    // In a WebView wrapper window.history.length reports entries from before
    // the app was entered, so it claims history that is not there. The hook
    // mentions the property in its own comment; strip comments or this reads
    // its own explanation as a violation.
    const hook = stripComments(read('hooks/useAppBack.ts'));
    expect(hook).not.toContain('window.history.length');
  });
});

describe('the page is reachable without tabbing through the chrome', () => {
  it('offers a skip link as the first stop', () => {
    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('Skip to main content');
  });

  it('gives main a focus target for the route announcer', () => {
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain('tabIndex={-1}');
  });

  it('announces the page change', () => {
    const announcer = read('components/RouteAnnouncer.tsx');
    expect(announcer).toContain('aria-live="polite"');
    expect(announcer).toContain('pageTitle');
  });
});

describe('the library is still reachable from a phone', () => {
  it('links it from the footer', () => {
    // The bottom bar is capped at five and cannot carry Library. Without a
    // footer link it would be desktop-only by accident.
    expect(layout).toContain('to="/library"');
  });

  it('keeps it out of the bar rather than crowding the tap targets', () => {
    const bottom = NAV_DESTINATIONS.filter(d => d.bottomBar);
    expect(bottom.map(d => d.path)).not.toContain('/library');
  });
});

describe('the dead navigation component is gone', () => {
  it('no longer ships a nav nobody imports', () => {
    // It rendered hardcoded "34°C Delhi" and a fixed 4,250 seed count. Left in
    // the tree it reads like the real header to whoever opens the folder next.
    const path = join(process.cwd(), 'src', 'components', 'Navigation.tsx');
    expect(existsSync(path)).toBe(false);
  });
});

describe('page names stay in step with the routes', () => {
  it('names every route App.tsx defines', () => {
    const app = stripComments(read('App.tsx'));
    const paths = [...app.matchAll(/<Route path="([^"]+)"/g)].map(m => m[1]);

    expect(paths.length).toBeGreaterThan(8);

    const unnamed = paths
      .filter(p => p !== '*')
      .filter(p => pageTitle(p) === 'PhytoDoctor');

    expect(unnamed).toEqual([]);
  });
});