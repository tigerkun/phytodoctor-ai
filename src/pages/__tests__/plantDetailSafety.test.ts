import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The PlantDetail Pet Safety card: prominent (above the field guides),
 * three honest states (toxic / pet-friendly / no verdict = no card), and
 * always linked to the ASPCA's own list for the authoritative answer.
 * Source-level; each scan first proves it found the structures it polices.
 */

const detail = stripJsComments(readSource('src/pages/PlantDetail.tsx'));
const toxicity = stripJsComments(readSource('src/data/toxicity.ts'));

describe('PlantDetail Pet Safety card', () => {
  it('the scan found the card it means to check', () => {
    expect(detail).toContain('Pet Safety —');
    expect(detail).toContain('lookupToxicity(plant.species)');
  });

  it('renders from the verdict, gated so no-verdict species show nothing', () => {
    // (Comments are stripped; the code is the evidence.) The memo returns
    // null for unknown species and the card is behind `{toxicity && (` —
    // null renders nothing, never a guess.
    expect(detail).toContain('plant?.species ? lookupToxicity(plant.species) : null');
    expect(detail).toContain('{toxicity && (');
  });

  it('sits ABOVE the field guides — a missed warning costs more than a visible one', () => {
    const safety = detail.indexOf('Pet Safety —');
    const guides = detail.indexOf('Field Guides —');
    expect(safety).toBeGreaterThan(-1);
    expect(guides).toBeGreaterThan(-1);
    expect(safety).toBeLessThan(guides);
  });

  it('the toxic branch names targets and scales the language to severity', () => {
    expect(detail).toContain("⚠️ Toxic to {toxicity.toxicTo.join(', ')}");
    expect(detail).toContain("toxicity.severity === 'severe' && ' — veterinary emergency risk'");
    expect(detail).toContain("toxicity.severity === 'moderate' && ' — worth a vet call'");
    expect(detail).toContain('{toxicity.note}');
  });

  it('the pet-friendly branch is its own calm state', () => {
    expect(detail).toContain('Pet-friendly — listed non-toxic to cats, dogs and people.');
    expect(detail).toContain('<PawPrint');
  });

  it('always links to the ASPCA for the authoritative answer', () => {
    expect(detail).toContain('href={aspcaLookupUrl(toxicity.scientific)}');
    expect(detail).toContain('rel="noopener noreferrer"');
    expect(detail).toContain("Confirm on the ASPCA's list");
  });
});

describe('toxicity data is curated, not scraped', () => {
  it('the scan found the data module it means to check', () => {
    expect(toxicity).toContain('TOXICITY_DB: ToxicityEntry[]');
  });

  it('documents the design: static, source-named, conservative matching', () => {
    expect(toxicity).toContain('folioMatchesForSpecies');
    expect(toxicity).toContain('aspca.org/search');
    // The alias layer is exact-match only — no genus inference on common names.
    expect(toxicity).toContain("a.toLowerCase() === s");
  });
});
