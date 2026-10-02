import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The market page's request board had all four states required of it and only
 * had two: a list, and a hard-coded sentence for "no requests". A failed fetch
 * rendered the same sentence as a genuinely empty board, because the catch
 * swallowed every error and a non-ok response did nothing at all — so a 500
 * and "nobody has asked anything" were indistinguishable on screen.
 *
 * These are source-level tests, matching routeGates.test.ts. There is no DOM
 * environment in this project and adding one is a dependency decision that is
 * not this change's to make, so rather than pretend to render the component,
 * these assert on the shape of the source. That catches the specific failure
 * mode worth catching — an empty branch quietly reverting to bare text, or a
 * control losing its label — which is exactly how both bugs arrived.
 */

const marketSource = readFileSync(join(process.cwd(), 'src/pages/Market.tsx'), 'utf8');

/** The RequestBoard component's source, by brace depth from its declaration. */
function requestBoardSource(): string {
  const start = marketSource.indexOf('function RequestBoard(');
  expect(start, 'RequestBoard not found in Market.tsx').toBeGreaterThan(-1);

  // The parameter list has its own braces (the destructure and the inline prop
  // type), so counting from the first `{` would stop at the end of the
  // signature. The body opens after the parameter list closes.
  const bodyStart = marketSource.indexOf(') {', start);
  expect(bodyStart, 'RequestBoard body not found').toBeGreaterThan(-1);

  let depth = 0;
  for (let i = bodyStart + 1; i < marketSource.length; i++) {
    if (marketSource[i] === '{') depth++;
    else if (marketSource[i] === '}') {
      depth--;
      if (depth === 0) return marketSource.slice(start, i + 1);
    }
  }
  throw new Error('RequestBoard braces never balanced');
}

/** Every form control in a chunk, with its id and any aria-label. */
function controlsIn(source: string): { tag: string; id?: string; ariaLabel?: string }[] {
  const out: { tag: string; id?: string; ariaLabel?: string }[] = [];
  const re = /<(input|select|textarea)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const attrs = m[2];
    out.push({
      tag: m[1],
      id: attrs.match(/\bid="([^"]+)"/)?.[1],
      ariaLabel: attrs.match(/\baria-label="([^"]+)"/)?.[1],
    });
  }
  return out;
}

describe('request board renders all four data states', () => {
  const board = requestBoardSource();

  it('shows a loading placeholder before the first response arrives', () => {
    expect(board).toContain('SkeletonList');
    // `loaded` starts false, so the skeleton is what a player sees first.
    expect(board).toMatch(/!loaded\s*&&/);
  });

  it('distinguishes a failed load from an empty board', () => {
    expect(board).toContain('ErrorState');
    expect(board).toContain('loadError');

    // The load used to do nothing at all on a non-ok response, so a 401/500
    // silently rendered as "empty". It must record the failure now.
    expect(board).toMatch(/if\s*\(!r\.ok\)/);
    expect(board).toMatch(/setLoadError\(/);
  });

  it('offers a retry that actually re-fetches', () => {
    // Retrying has to bump the nonce the effect depends on; calling load()
    // directly from the handler would work too, but the nonce is what is
    // wired, so assert the wiring rather than the intent.
    expect(board).toMatch(/onRetry=\{\(\)\s*=>\s*setLoadNonce\(/);
    expect(board).toMatch(/useEffect\(\(\)\s*=>\s*\{?\s*load\(\)/);
    expect(board).toContain('[loadNonce]');
  });

  it('offers a next step when the board is genuinely empty', () => {
    expect(board).toContain('EmptyState');
    // An empty state with no action is just grey text again.
    expect(board).toMatch(/action=\{\{[\s\S]*?onClick:/);
  });

  it('announces list changes to assistive technology', () => {
    expect(board).toContain('aria-live="polite"');
  });
});

describe('request board controls are labelled', () => {
  const board = requestBoardSource();
  const controls = controlsIn(requestBoardSource());

  it('finds the controls to check', () => {
    // If this ever drops to zero the assertions below pass vacuously.
    expect(controls.length).toBeGreaterThanOrEqual(3);
  });

  it.each(controls.map(c => [c.tag, c.id ?? c.ariaLabel ?? '(none)']))(
    '%s labelled "%s" is reachable by a screen reader',
    (_tag, name) => {
      // Either a real <label htmlFor>, or an explicit aria-label. Placeholder
      // text is not one: it vanishes on first keystroke and is not reliably
      // announced, which is how all three of these controls shipped unlabelled.
      const hasLabel =
        board.includes(`htmlFor="${name}"`) || board.includes(`for="${name}"`);
      const hasAria = controls.find(c => c.id === name)?.ariaLabel !== undefined;
      expect(hasLabel || hasAria, `control "${name}" has no <label htmlFor> or aria-label`).toBe(true);
    }
  );
});

describe('empty states offer an action, not just a sentence', () => {
  /**
   * Every remaining `filteredProducts.length === 0` branch in the market page.
   * These are the "nothing matches" cases, and each used to render a single
   * line of grey text telling the player to go and loosen a filter themselves.
   */
  it('the stall grid replaces bare-text empties with EmptyState', () => {
    const gridBranches = marketSource.split('filteredProducts.length === 0').length - 1;
    expect(gridBranches).toBeGreaterThan(0);

    // Every one of those branches must sit next to an <EmptyState>.
    const emptyStateCount = marketSource.split('<EmptyState').length - 1;
    expect(emptyStateCount).toBeGreaterThanOrEqual(gridBranches);

    // And the old bare-text copy must be gone entirely.
    expect(marketSource).not.toContain('loosen the search or filter');
  });
});