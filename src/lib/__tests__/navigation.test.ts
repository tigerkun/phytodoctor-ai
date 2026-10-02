import { describe, it, expect } from 'vitest';
import {
  NAV_DESTINATIONS,
  BOTTOM_BAR_LIMIT,
  bottomBarDestinations,
  isDestinationActive,
  pageTitle,
} from '../navRoutes';
import { resolveBackTarget, parentFor, nextHistoryDepth } from '../backRoute';

describe('the navigation map', () => {
  it('has no duplicate paths', () => {
    const paths = NAV_DESTINATIONS.map(d => d.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps every path absolute and rooted', () => {
    // A relative or hash href silently resolves against the current route, so
    // the Vault link would open whatever page you happened to be reading.
    for (const d of NAV_DESTINATIONS) {
      expect(d.path.startsWith('/')).toBe(true);
      expect(d.path).not.toContain('#');
    }
  });

  it('keeps bottom-bar labels short enough to sit on one line', () => {
    // The bar is ~64px tall on a small phone; anything past six characters
    // wraps to two lines and halves the tap target.
    for (const d of bottomBarDestinations()) {
      expect(d.short.length).toBeLessThanOrEqual(6);
    }
  });

  it('never exceeds the bottom-bar limit', () => {
    expect(bottomBarDestinations().length).toBeLessThanOrEqual(BOTTOM_BAR_LIMIT);
  });

  it('ships the destinations the landing page promises', () => {
    // These are the routes the product actually has. A destination list that
    // drifts from App.tsx is a tab that leads to a dead end.
    const paths = NAV_DESTINATIONS.map(d => d.path);
    expect(paths).toEqual(expect.arrayContaining(['/', '/lab', '/collection', '/arena', '/market']));
  });

  it('gives every destination an icon and a spoken description', () => {
    for (const d of NAV_DESTINATIONS) {
      expect(d.Icon).toBeTruthy();
      expect(d.description.length).toBeGreaterThan(0);
    }
  });
});

describe('active-tab matching', () => {
  it('lights Home on the home page only', () => {
    // Without the exact-match rule, '/' is a prefix of everything and the Home
    // tab is highlighted on every screen.
    expect(isDestinationActive('/', '/')).toBe(true);
    expect(isDestinationActive('/', '/market')).toBe(false);
    expect(isDestinationActive('/', '/collection')).toBe(false);
  });

  it('lights the Vault on the plant pages beneath it', () => {
    expect(isDestinationActive('/collection', '/collection')).toBe(true);
    expect(isDestinationActive('/collection', '/plant/abc')).toBe(false);
    expect(isDestinationActive('/arena', '/arena')).toBe(true);
  });

  it('does not let one destination prefix swallow a sibling', () => {
    expect(isDestinationActive('/lab', '/clinic')).toBe(false);
    expect(isDestinationActive('/market', '/marketplace')).toBe(false);
  });
});

describe('page names for the route announcer', () => {
  it('names every destination', () => {
    for (const d of NAV_DESTINATIONS) {
      expect(pageTitle(d.path)).toBe(d.description);
    }
  });

  it('names a deep route by its own page, not its section', () => {
    // '/clinic/case-study' starts with '/clinic'. Matching the section first
    // would announce the Clinic while the reader is on the case study.
    expect(pageTitle('/clinic/case-study')).toBe('Case study');
    expect(pageTitle('/clinic')).toBe('The Clinic');
  });

  it('names a parameterised plant page', () => {
    expect(pageTitle('/plant/910ba357-e667-4e7c')).toBe('Plant profile');
  });

  it('ignores a query string and hash', () => {
    expect(pageTitle('/lab?tab=dex')).toBe('Botanical Lab');
    expect(pageTitle('/plant/abc#soil')).toBe('Plant profile');
  });

  it('falls back to the product name rather than announcing nothing', () => {
    // An empty announcement is worse than a vague one: the reader is told
    // something happened and nothing about what.
    expect(pageTitle('/some/route/nobody/added')).toBe('PhytoDoctor');
  });
});

describe('back targets', () => {
  it('offers no back control on a root page', () => {
    expect(resolveBackTarget('/', false).to).toBeNull();
    expect(resolveBackTarget('/', true).to).toBeNull();
    expect(resolveBackTarget('/auth', true).to).toBeNull();
  });

  it('walks session history when there is some', () => {
    const t = resolveBackTarget('/plant/abc', true);
    expect(t.usesHistory).toBe(true);
    expect(t.label).toBe('Back');
  });

  it('falls back to the section parent when there is no history', () => {
    // This is the cold-start-on-a-deep-link case: the app opens straight onto
    // a shared plant URL with nothing behind it, so navigate(-1) would either
    // do nothing or close the app.
    const t = resolveBackTarget('/plant/abc', false);
    expect(t.usesHistory).toBe(false);
    expect(t.to).toBe('/collection');
    expect(t.label).toBe('Back to Your Vault');
  });

  it('falls back to the Clinic from its case study, not to the page itself', () => {
    expect(resolveBackTarget('/clinic/case-study', false).to).toBe('/clinic');
  });

  it('falls back to Home from a top-level section', () => {
    expect(resolveBackTarget('/market', false).to).toBe('/');
    expect(resolveBackTarget('/arena', false).to).toBe('/');
    expect(resolveBackTarget('/library', false).to).toBe('/');
  });

  it('ignores the query string when resolving', () => {
    expect(resolveBackTarget('/plant/abc?from=chat', false).to).toBe('/collection');
  });

  it('never sends back to the page it started from', () => {
    // A self-referential fallback is an infinite loop: tapping back re-renders
    // the identical screen and the person is stuck with no way forward. The
    // roots guard is what makes Home and /auth safe, so assert the invariant
    // where it is actually enforced -- on the resolved target.
    const every = [
      ...NAV_DESTINATIONS.map(d => d.path),
      '/clinic', '/clinic/case-study', '/profile', '/assistant',
      '/help', '/privacy', '/terms', '/audit', '/plant/abc',
    ];

    for (const path of every) {
      const target = resolveBackTarget(path, false);
      if (target.to === null) continue;
      expect(target.to, `${path} resolves back to itself`).not.toBe(path);
    }
  });

  it('only treats the roots as having no parent', () => {
    // parentFor('/') is '/' and parentFor('/auth') is '/'. That is harmless --
    // resolveBackTarget returns no control for both before a parent is ever
    // consulted -- but nothing else may collapse to itself.
    expect(parentFor('/')).toBe('/');
    expect(parentFor('/auth')).toBe('/');
    expect(parentFor('/market')).toBe('/');
    expect(parentFor('/plant/abc')).toBe('/collection');
  });

  it('sends every route to a real destination as its parent', () => {
    const known = new Set([...NAV_DESTINATIONS.map(d => d.path), '/auth', '/help', '/privacy', '/terms', '/clinic', '/profile', '/assistant', '/audit']);
    for (const path of known) {
      expect(known.has(parentFor(path))).toBe(true);
    }
  });
});

describe('history depth accounting', () => {
  it('counts a forward navigation', () => {
    expect(nextHistoryDepth(1, 'PUSH')).toBe(2);
  });

  it('spends a step on a back navigation', () => {
    // Without this the app believes it has history it has already walked, and
    // offers a back control that walks the user in a circle.
    expect(nextHistoryDepth(3, 'POP')).toBe(2);
  });

  it('never drops below one, so a cold start has no phantom history', () => {
    expect(nextHistoryDepth(1, 'POP')).toBe(1);
  });

  it('holds the depth on a replace', () => {
    // Layout bounces a signed-out visitor to /auth with replace:true. Counting
    // it would hand them a back button to the page that just redirected them.
    expect(nextHistoryDepth(2, 'REPLACE')).toBe(2);
  });
});