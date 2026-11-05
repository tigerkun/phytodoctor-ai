import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The research surfaces' wiring: conservation + treatment research on
 * PlantDetail, seasonal care on Home. Each is on-demand or cheaply cached,
 * each surfaces error bodies as honest notes, and each states its
 * assumptions in words rather than hiding them.
 */

const detail = stripJsComments(readSource('src/pages/PlantDetail.tsx'));
const home = stripJsComments(readSource('src/pages/Home.tsx'));
const card = stripJsComments(readSource('src/components/home/SeasonalCareCard.tsx'));

describe('PlantDetail conservation section', () => {
  it('the scan found the section it means to check', () => {
    expect(detail).toContain('Conservation —');
    expect(detail).toContain('/api/library/conservation?species=');
  });

  it('is on-demand with a 180-day client cache', () => {
    expect(detail).toContain('{!conservation && (');
    expect(detail).toContain('phyto_conservation_');
    expect(detail).toContain('180 * 86_400_000');
  });

  it('labels the heuristic read and links the source', () => {
    expect(detail).toContain('Heuristic read of search results');
    expect(detail).toContain('{conservation.source || \u0027Source\u0027}');
  });

  it('a no-listing species gets an honest empty line, not a guess', () => {
    expect(detail).toContain('No conservation listing surfaced');
  });
});

describe('PlantDetail treatment research', () => {
  it('is gated on the plant\u2019s own diagnosis — the pest is not a guess', () => {
    expect(detail).toContain('plant?.recoveryRoadmap?.diagnosis?.trim() || null');
    expect(detail).toContain('{diagnosis && (');
  });

  it('is on-demand with a 14-day client cache keyed by diagnosis + species', () => {
    expect(detail).toContain('phyto_pest_treatments_');
    expect(detail).toContain('14 * 86_400_000');
    expect(detail).toContain('params = new URLSearchParams({ pest: diagnosis, species: plant.species })');
  });

  it('renders the effectiveness hint only when the engine supplied one', () => {
    expect(detail).toContain('{t.effectiveness && (');
  });
});

describe('Home seasonal care card', () => {
  it('the scan found the card it means to check', () => {
    expect(home).toContain('<SeasonalCareCard />');
    expect(card).toContain('Seasonal care —');
  });

  it('derives the season from the calendar, stated as northern-hemisphere', () => {
    // The assumption is ON the card, not in a comment — a southern-hemisphere
    // keeper must be able to see it and adjust.
    expect(card).toContain('seasonForMonth(new Date().getMonth() + 1)');
    expect(card).toContain('northern-hemisphere calendar');
  });

  it('takes climate from the collection\u2019s hardiness zones, honestly labelled', () => {
    expect(card).toContain('p.hardinessZone');
    expect(card).toContain("(assumed — set a hardiness zone on a plant to refine)");
  });

  it('caches 90 days per (season, climate) and surfaces error bodies', () => {
    expect(card).toContain('phyto_seasonal_');
    expect(card).toContain('90 * 86_400_000');
    expect(card).toContain('data.error ?? null');
  });
});
