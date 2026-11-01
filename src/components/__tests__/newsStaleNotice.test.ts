import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * When the SerpApi ceiling is hit (or the wire fails outright), the news
 * carousel serves a saved roundup. The badge alone -- eight pixels of
 * "Archive" -- was the only honest signal, and a past revision could have
 * labeled that roundup "Live Top 10", which is precisely the false info an
 * operator was promised would never appear.
 *
 * Source-level test, matching feedbackStates.test.ts: there is no DOM
 * environment in this project and adding one is a dependency decision that is
 * not this change's to make. These assert on the shape of the source, which
 * catches the specific regression -- the badge or the notice unhooking from
 * the isLive gate -- without pretending to render the component.
 */

const carouselSource = readFileSync(
  join(process.cwd(), 'src/components/library/EnvironmentalNewsCarousel.tsx'),
  'utf8'
);

describe('environmental news carousel states the wire honestly', () => {
  it('the scan found something to check', () => {
    expect(carouselSource).toContain('EnvironmentalNewsCarouselProps');
    expect(carouselSource).toContain('stale?: boolean');
    expect(carouselSource).toContain('FALLBACK_ENVIRONMENTAL_NEWS');
  });

  it('computes isLive from the stale flag AND non-empty items, once', () => {
    // Both halves matter: a stale flag alone misses the quota-day empty
    // payload, and an item count alone misses yesterday's cached dispatch.
    const gates = carouselSource.match(/!stale && items\.length > 0/g) ?? [];
    expect(gates.length, 'isLive gate must exist exactly once').toBe(1);
    expect(carouselSource).toContain('const isLive = !stale && items.length > 0;');
  });

  it('the Live Top 10 badge renders only under isLive', () => {
    // The label must sit inside the isLive ternary -- any other placement is
    // how the roundup gets presented as a live feed. Exactly one occurrence
    // in the file keeps a second unguarded copy from drifting in later.
    const labels = carouselSource.match(/'Live Top 10'/g) ?? [];
    expect(labels.length, 'Live Top 10 must appear exactly once').toBe(1);
    expect(carouselSource).toContain("{isLive ? 'Live Top 10' : 'Archive'}");
  });

  it('shows the resting-wire notice whenever the feed is not live', () => {
    expect(carouselSource).toContain('{!isLive && (');
    expect(carouselSource).toContain('The wire is resting today');
  });

  it('the saved roundup is real evergreen content, not an empty shell', () => {
    const fallbackStart = carouselSource.indexOf('FALLBACK_ENVIRONMENTAL_NEWS: EnvironmentalNewsItem[] = [');
    expect(fallbackStart, 'fallback bank not found').toBeGreaterThan(-1);
    const fallbackBlock = carouselSource.slice(fallbackStart, fallbackStart + 900);
    expect(fallbackBlock.match(/link: '/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
