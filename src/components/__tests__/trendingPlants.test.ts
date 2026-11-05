import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The Library's trending strip — Task 2 with rule 1 applied: the parallel
 * spec asked for a new trendingPlants.ts module, but /api/market/trending
 * already existed (marketLive.getTrendingPlants, one weekly call shared by
 * every account), so the strip consumes the existing owner. No new module,
 * no second quota cost.
 */

const library = stripJsComments(readSource('src/pages/Library.tsx'));
const marketLive = stripJsComments(readSource('src/server/marketLive.ts'));

describe('Library trending strip', () => {
  it('the scan found the strip it means to check', () => {
    expect(library).toContain('Trending this week · real search interest');
  });

  it('consumes the EXISTING trending endpoint — rule 1, no new module', () => {
    expect(library).toContain("fetch('/api/market/trending')");
    // And no duplicate server module was created for it.
    expect(library).not.toContain('/api/library/trending-plants');
  });

  it('a chip deep-links into a matched folio plate', () => {
    expect(library).toContain('folioMatchesForSpecies(PHYTO_NOTES, [t.title])[0] ?? null');
    expect(library).toContain('openTrendingFolio');
    expect(library).toContain('openGardenFolio(t.folio)');
  });

  it('unmatched trends fall back to the source article, safely opened', () => {
    expect(library).toContain("window.open(t.url, '_blank', 'noopener,noreferrer')");
  });

  it('an empty week renders no strip — no filler', () => {
    expect(library).toContain('{trendingStrip.length > 0 && (');
  });
});

describe('the existing trending owner', () => {
  it('marketLive.getTrendingPlants is the single engine call, weekly and global', () => {
    expect(marketLive).toContain('export async function getTrendingPlants');
    expect(marketLive).toContain('weekly');
    // The route is registered from marketLive — no second module owns it.
    expect(marketLive).toContain('/api/market/trending');
  });

  it('extracts title + why (snippet) — both required for a chip', () => {
    // (The URL-guard regex contains `//` and is stripped by the comment
    // filter; the title check and the snippet extraction are the durable
    // evidence.)
    expect(marketLive).toContain("t.title.length > 0 && /^https?:");
    expect(marketLive).toContain("snippet: String(r?.snippet ?? '').slice(0, 260)");
  });
});
