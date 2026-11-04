import { describe, it, expect } from 'vitest';
import { TOXICITY_DB, lookupToxicity, aspcaLookupUrl, type ToxicityEntry } from '../toxicity';

/**
 * Pet-safety verdicts are safety-critical content: every entry must carry a
 * clinical note and a valid severity, matching must stay conservative (a
 * wrong "pet-friendly" is as dangerous as a missed warning), and aliases
 * match EXACTLY — 'fern' must never inherit Boston Fern's verdict while
 * Asparagus Fern is toxic.
 */

const VALID_TARGETS = new Set(['cats', 'dogs', 'humans']);
const VALID_SEVERITIES = new Set(['mild', 'moderate', 'severe']);

describe('toxicity database integrity', () => {
  it('the scan found the database it means to check', () => {
    expect(TOXICITY_DB.length).toBeGreaterThan(20);
  });

  it('every entry carries a note, valid severity and valid targets', () => {
    for (const e of TOXICITY_DB) {
      expect(e.note?.trim().length ?? 0, `${e.name} needs a clinical note`).toBeGreaterThan(10);
      expect(VALID_SEVERITIES.has(e.severity), `${e.name}: severity`).toBe(true);
      for (const t of e.toxicTo) {
        expect(VALID_TARGETS.has(t), `${e.name}: target ${t}`).toBe(true);
      }
    }
  });

  it('no duplicate scientific keys and no duplicate aliases', () => {
    const sci = TOXICITY_DB.map(e => e.scientific.toLowerCase());
    expect(new Set(sci).size).toBe(sci.length);
    const aliases = TOXICITY_DB.flatMap(e => (e.aliases ?? []).map(a => a.toLowerCase()));
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it('severe entries exist and are the red-card ones', () => {
    const severe = TOXICITY_DB.filter(e => e.severity === 'severe');
    expect(severe.map(e => e.scientific)).toContain('Cycas revoluta');
    expect(severe.every(e => e.toxicTo.length > 0)).toBe(true);
  });
});

describe('lookupToxicity matching rules', () => {
  it('matches an exact binomial', () => {
    const hit = lookupToxicity('Monstera deliciosa')!;
    expect(hit.toxicTo).toContain('cats');
    expect(hit.severity).toBe('mild');
  });

  it('a bare genus resolves only when unambiguous in the database', () => {
    expect(lookupToxicity('monstera')!.scientific).toBe('Monstera deliciosa');
    // Two ficus entries disagree (both mild, but the rule is the rule).
    expect(lookupToxicity('ficus')).toBeNull();
    expect(lookupToxicity('Ficus lyrata')!.severity).toBe('mild');
  });

  it('a bare ' + "'fern'" + ' can never inherit Boston Fern’s pet-friendly verdict', () => {
    expect(lookupToxicity('fern')).toBeNull();
    expect(lookupToxicity('Nephrolepis exaltata')!.toxicTo).toEqual([]);
    expect(lookupToxicity('boston fern')!.toxicTo).toEqual([]);
  });

  it('aliases match exactly: pothos, sansevieria, mother-in-law’s tongue', () => {
    expect(lookupToxicity('pothos')!.scientific).toBe('Epipremnum aureum');
    expect(lookupToxicity('sansevieria')!.scientific).toBe('Dracaena trifasciata');
    expect(lookupToxicity("mother-in-law's tongue")!.scientific).toBe('Dracaena trifasciata');
    // Devil's ivy with the apostrophe variant from the alias list.
    expect(lookupToxicity('devils ivy')!.scientific).toBe('Epipremnum aureum');
  });

  it('common names match by full phrase, not bare substrings', () => {
    expect(lookupToxicity('golden pothos')!.scientific).toBe('Epipremnum aureum');
    expect(lookupToxicity('snake plant')!.scientific).toBe('Dracaena trifasciata');
    // Substring in the WRONG direction is rejected.
    expect(lookupToxicity('golden')).toBeNull();
  });

  it('an unknown species renders no verdict — the card shows nothing', () => {
    expect(lookupToxicity('Alocasia zebrina')).toBeNull();
    expect(lookupToxicity('')).toBeNull();
    expect(lookupToxicity('   ')).toBeNull();
  });
});

describe('ASPCA link-out', () => {
  it('builds a search URL for the authoritative source', () => {
    expect(aspcaLookupUrl('Monstera deliciosa')).toBe(
      'https://www.aspca.org/search?query=Monstera%20deliciosa%20plant',
    );
  });

  it('every severe entry is covered by a link the UI can build', () => {
    for (const e of TOXICITY_DB.filter(e => e.severity === 'severe')) {
      expect(aspcaLookupUrl(e.scientific)).toMatch(/^https:\/\/www\.aspca\.org\/search\?query=/);
    }
  });
});

describe('entries are honest about targets', () => {
  it('non-toxic entries are truly empty of targets', () => {
    const friendly = TOXICITY_DB.filter(e => e.toxicTo.length === 0);
    expect(friendly.length).toBeGreaterThan(8);
    for (const e of friendly) {
      expect(e.severity).toBe('mild'); // the only honest severity for "no harm"
      expect(e.note.toLowerCase()).toContain('non-toxic');
    }
  });

  it('humans-only toxicity does not exist in the db (pets first, ASPCA scope)', () => {
    const humansOnly = TOXICITY_DB.filter(e => e.toxicTo.length === 1 && e.toxicTo[0] === 'humans');
    expect(humansOnly).toEqual([]);
  });
});

describe('entry shape tolerates the matcher contract', () => {
  it('every entry satisfies the FolioMatchable shape used by the matcher', () => {
    for (const e of TOXICITY_DB as ToxicityEntry[]) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.scientific.length).toBeGreaterThan(0);
    }
  });
});
