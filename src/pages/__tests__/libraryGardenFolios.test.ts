import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The plant-aware Library wiring: the folio corpus lives in one data module,
 * the "From your garden" strip only renders real matches, and the badge
 * criteria are fed from the Library's own recorded stats. Source-level; each
 * scan first proves it found the structures it means to police.
 */

const library = stripJsComments(readSource('src/pages/Library.tsx'));
const profile = stripJsComments(readSource('src/pages/Profile.tsx'));
const corpus = stripJsComments(readSource('src/data/phytoNotes.ts'));
const engagement = stripJsComments(readSource('src/services/libraryEngagement.ts'));

describe('folio corpus extraction', () => {
  it('the corpus is a real exported list, not a duplicated constant', () => {
    expect(corpus).toContain('export const PHYTO_NOTES: PhytoNote[] = [');
    expect(library).toContain("from '../data/phytoNotes'");
    expect(library).not.toContain('const PHYTO_NOTES = [');
  });
});

describe('Library "From your garden" strip', () => {
  it('the scan found the strip it means to check', () => {
    expect(library).toContain('From your garden');
  });

  it('matches only against live, non-demo plants', () => {
    expect(library).toContain("folioMatchesForSpecies(PHYTO_NOTES, (dbPlants ?? []).filter(p => !p.isDemo).map(p => p.species))");
  });

  it('renders nothing when there are no matches', () => {
    expect(library).toContain('gardenFolios.length > 0 &&');
  });

  it('names how many of the Keeper’s plants are featured', () => {
    expect(library).toContain('gardenPlantCount');
    expect(library).toContain('of your plant');
  });

  it('a strip click resets filters and jumps to the plate (Surprise-Me contract)', () => {
    expect(library).toContain('const openGardenFolio = (folio: PhytoNote)');
    expect(library).toContain("setActiveFilter('All')");
    expect(library).toContain('togglePlate(key, folio.scientific)');
  });
});

describe('Profile badge feed', () => {
  it('the scan found the badge call site it means to check', () => {
    expect(profile).toContain('evaluateProfileBadges({');
  });

  it('feeds the library stats as badge criteria', () => {
    expect(profile).toContain('quizBestStreak: quizBestStreak()');
    expect(profile).toContain('platesStudied: getStudiedPlates().size');
    expect(profile).toContain('totalPlates: PHYTO_NOTES.length');
    // The denominator must come from the record, not the rounded percentage.
    expect(profile).toContain('quizCorrect: quiz.correct');
  });
});

describe('matcher conservatism', () => {
  it('the matcher guards the ambiguous-genus case in code', () => {
    // (Comments are stripped; the code is the evidence.) A bare genus only
    // resolves when exactly one folio carries it — the guard is the `=== 1`.
    expect(engagement).toContain('export function folioMatchesForSpecies');
    expect(engagement).toContain('genusCounts.get(genus) === 1');
  });
});
