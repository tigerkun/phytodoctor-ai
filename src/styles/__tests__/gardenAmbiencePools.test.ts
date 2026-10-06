import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../garden-ambience.css', import.meta.url)), 'utf8');

/** Pull the declarations of one rule out of the stylesheet. */
function rule(selector: string): Record<string, string> {
  // The selector must be followed immediately by the brace, or a lookup for
  // `.garden-pool` happily matches the head of `.garden-pool--moss`.
  const match = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`).exec(css);
  expect(match, `rule ${selector} was not found`).not.toBeNull();
  const open = match!.index + match![0].length - 1;
  const close = css.indexOf('}', open);
  const decls: Record<string, string> = {};
  // A comment with no `;` in it welds itself to the next declaration and
  // steals that declaration's key, so strip comments before splitting.
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const line of body.split(';')) {
    const idx = line.indexOf(':');
    if (idx > 0) decls[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return decls;
}

const POOLS = ['moss', 'gold', 'sage', 'clay'] as const;
const poolRules = Object.fromEntries(POOLS.map(name => [name, rule(`.garden-pool--${name}`)]));

/** `min(46vmax, 70vh)` and friends, resolved against a viewport box. */
function resolveSize(value: string, vw: number, vh: number): number {
  const min = /^min\((.+),\s*(.+)\)$/.exec(value);
  if (!min) throw new Error(`pool size "${value}" is no longer a min() of viewport units`);
  const one = (token: string) => {
    const n = /^(-?[\d.]+)(vmax|vh|vw|%)$/.exec(token.trim());
    if (!n) throw new Error(`unsupported pool size unit in "${token}"`);
    const num = Number(n[1]);
    if (n[2] === 'vh') return (num / 100) * vh;
    if (n[2] === 'vw') return (num / 100) * vw;
    if (n[2] === 'vmax') return (num / 100) * Math.max(vw, vh);
    return (num / 100) * vw; // % of the wrapper's own width
  };
  return Math.min(one(min[1]), one(min[2]));
}

/**
 * Where a pool's centre lands, given a viewport. The wrapper is
 * `inset: -20%`, so it is 140% of the viewport on each axis and starts at -20%
 * of the viewport size — the pool's percentage offsets resolve against that
 * larger box, not against the frame.
 */
function centreOf(pool: Record<string, string>, vw: number, vh: number) {
  const boxW = vw * 1.4;
  const boxH = vh * 1.4;
  const top = (parseFloat(pool.top) / 100) * boxH;
  const left = (parseFloat(pool.left) / 100) * boxW;
  return { x: -vw * 0.2 + left, y: -vh * 0.2 + top, size: resolveSize(pool.width, vw, vh) };
}

const VIEWPORTS = [
  { label: 'desktop', w: 1440, h: 1000 },
  { label: 'laptop', w: 1280, h: 800 },
  { label: 'wide', w: 2560, h: 1080 },
  { label: 'tablet', w: 834, h: 1112 },
  { label: 'phone', w: 390, h: 844 },
];

describe('garden ambience light pools', () => {
  // The regression this exists for: every pool used to be placed with a `vmax`
  // offset, and vmax is the viewport's LONGER axis. On a landscape screen that
  // made the pools travel with viewport width while their wrapper stayed
  // proportional, so all four landed off-screen and the atmosphere the design
  // notes rely on never appeared. Percentage offsets track the wrapper, so
  // they cannot drift apart from it at any aspect ratio.
  it.each(POOLS)('positions the %s pool with percentages, not viewport offsets', name => {
    const pool = poolRules[name];
    expect(pool.top, `${name} has no top offset`).toMatch(/%$/);
    expect(pool.left, `${name} has no left offset`).toMatch(/%$/);
    expect(`${pool.top} ${pool.left}`).not.toMatch(/v(max|h|w)/);
  });

  it.each(POOLS)('keeps the %s pool on screen at every viewport size', name => {
    for (const { label, w, h } of VIEWPORTS) {
      const { x, y } = centreOf(poolRules[name], w, h);
      expect(x, `${name} pool centre is off the left/right edge on ${label} (${w}x${h})`)
        .toBeGreaterThan(-w * 0.15);
      expect(x, `${name} pool centre is off the left/right edge on ${label} (${w}x${h})`)
        .toBeLessThan(w * 1.15);
      expect(y, `${name} pool centre is off the top/bottom edge on ${label} (${w}x${h})`)
        .toBeGreaterThan(-h * 0.15);
      expect(y, `${name} pool centre is off the top/bottom edge on ${label} (${w}x${h})`)
        .toBeLessThan(h * 1.15);
    }
  });

  it.each(POOLS)('caps the %s pool against vh so it cannot outgrow the frame', name => {
    const pool = poolRules[name];
    expect(pool.width, `${name} is not bounded by vh`).toContain('vh');
    expect(pool.height).toBe(pool.width);
    for (const { w, h } of VIEWPORTS) {
      expect(resolveSize(pool.width, w, h), `${name} is larger than the frame on ${w}x${h}`)
        .toBeLessThan(Math.max(w, h));
    }
  });

  // Without the centring repeated in every keyframe stop, the drift animation
  // overwrites the base transform and the pool jumps to the wrapper's corner
  // the instant it starts animating.
  it.each(['garden-drift-a', 'garden-drift-b', 'garden-drift-c'])(
    'keeps the -50%/-50% centring in every stop of %s', keyframe => {
      const at = css.indexOf(`@keyframes ${keyframe}`);
      expect(at, `${keyframe} was not found`).toBeGreaterThan(-1);
      const body = css.slice(at, css.indexOf('}', css.indexOf('}', at) + 1) + 1);
      const stops = body.match(/^\s*[\d%, ]+\{[^}]*\}/gm) ?? [];
      expect(stops.length, `${keyframe} has too few stops to drift through`).toBeGreaterThan(1);
      for (const stop of stops) {
        // Either bare (`translate3d(-50%, -50%, 0)`) or wrapped in calc with a
        // drift offset added on top — both must carry the centring.
        expect(stop.match(/-50%/g)?.length ?? 0,
          `a stop in ${keyframe} drops the centring translate: ${stop.trim()}`).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it('centres the resting pool so the reduced-motion still frame is not in a corner', () => {
    expect(rule('.garden-pool').transform).toBe('translate(-50%, -50%)');
  });

  it('animates every pool, so each one actually drifts', () => {
    for (const name of POOLS) {
      expect(poolRules[name].animation, `${name} never drifts`).toMatch(/garden-drift-/);
    }
  });
});
