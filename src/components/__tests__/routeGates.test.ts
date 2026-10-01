import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_PATHS, isPublicPath } from '../../lib/publicPaths';

/**
 * Two guards protect the private pages: RequireAuth inside App.tsx's route
 * table, and the redirect in Layout. They are different files, so nothing stops
 * someone un-wrapping a route while the other guard still treats it as closed.
 *
 * That is not hypothetical -- it is how the landing page stayed unreachable to
 * every signed-out visitor while App.tsx plainly rendered it un-wrapped. This
 * test reads the real route table and fails if the hand-kept list has drifted
 * from it, so the disagreement is a red build instead of a silent bug.
 */

const appSource = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');

/**
 * Each `<Route .../>` in the table, with whether it is wrapped in RequireAuth.
 * A route can wrap a component that itself ends in `/>`, so the element is read
 * by brace depth rather than by looking for the first `/>`.
 */
function routesInTable(): { path: string; guarded: boolean }[] {
  const routes: { path: string; guarded: boolean }[] = [];
  const lines = appSource.split('\n');
  let buffer: string | null = null;

  for (const line of lines) {
    if (buffer === null && !line.includes('<Route path=')) continue;
    buffer = buffer === null ? line : `${buffer} ${line.trim()}`;

    // Balanced braces and a closing `/>` mean the element is complete.
    const opens = (buffer.match(/\{/g) || []).length;
    const closes = (buffer.match(/\}/g) || []).length;
    if (opens !== closes || !/\/>\s*$/.test(buffer)) continue;

    const path = buffer.match(/path="([^"]+)"/)?.[1];
    if (path) routes.push({ path, guarded: buffer.includes('<RequireAuth>') });
    buffer = null;
  }
  return routes;
}

describe('route gates agree', () => {
  const routes = routesInTable();

  it('finds the route table it is meant to guard', () => {
    expect(routes.length).toBeGreaterThan(8);
  });

  it('lists exactly the routes App.tsx leaves open', () => {
    const open = routes.filter(r => !r.guarded && r.path !== '*').map(r => r.path).sort();
    expect(open).toEqual([...PUBLIC_PATHS].sort());
  });

  it('opens the landing page and the Lab -- the two doors a visitor needs', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/lab')).toBe(true);
    expect(isPublicPath('/lab?tab=dex')).toBe(true);
  });

  it('keeps every private and parameterised route closed', () => {
    for (const r of routes.filter(r => r.guarded || r.path.includes(':'))) {
      expect(isPublicPath(r.path)).toBe(false);
    }
  });

  it('does not let an open prefix swallow a private sibling', () => {
    // '/' must open the landing page without opening everything under it.
    expect(isPublicPath('/collection')).toBe(false);
    expect(isPublicPath('/plant/abc')).toBe(false);
  });
});