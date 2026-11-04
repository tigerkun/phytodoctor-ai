import { folioMatchesForSpecies } from '../services/libraryEngagement';

/**
 * Pet & human toxicity for the species this app actually knows — CURATED
 * STATIC DATA, not a live lookup. Rationale: pet safety is not a topic for
 * heuristic snippet scraping; the ASPCA's toxic/non-toxic classification of
 * common houseplants is stable public knowledge, so the honest design is a
 * small hand-verified database with the source named and a link out for the
 * authoritative answer. Zero quota, works offline.
 *
 * Matching reuses folioMatchesForSpecies's conservative rules (exact
 * binomial, or a bare genus ONLY when unambiguous in this database) — a
 * wrong "this plant is dangerous" claim is worse than no claim, and so is a
 * wrong "pet-friendly".
 *
 * Severity is a coarse summary of the ASPCA's clinical notes, NOT a
 * diagnosis: 'mild' ≈ GI/oral irritation possible, 'moderate' ≈ distress
 * worth a call, 'severe' ≈ potentially life-threatening, vet now. When in
 * doubt the entry says so and the card always links out.
 */

export type ToxicityTarget = 'cats' | 'dogs' | 'humans';
export type ToxicitySeverity = 'mild' | 'moderate' | 'severe';

export interface ToxicityEntry {
  /** Common display name. */
  name: string;
  /** Binomial (or the name the ASPCA lists under) — matching key. */
  scientific: string;
  /** Empty array = listed NON-toxic (verified pet-friendly). */
  toxicTo: ToxicityTarget[];
  severity: ToxicitySeverity;
  /** One-line clinical consequence, in plain language. */
  note: string;
  /** Names keepers actually type — old taxonomy, trade names. Matched by
   *  EXACT string only (never substring, never genus inference): 'fern'
   *  must not claim Boston Fern's pet-friendliness while Asparagus Fern is
   *  toxic, and 'pothos' must still reach its verdict. */
  aliases?: string[];
}

export const TOXICITY_DB: ToxicityEntry[] = [
  // ── Severe: the ones worth a red card ──────────────────────────────────────
  {
    name: 'Sago Palm',
    scientific: 'Cycas revoluta',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'severe',
    note: 'Every part is poisonous — seeds worst. Ingestion is a veterinary emergency; can cause liver failure.',
  },
  {
    name: 'Dieffenbachia (Dumb Cane)',
    scientific: 'Dieffenbachia seguine',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'severe',
    note: 'Raphide crystals numb and swell the mouth and throat; large ingestions need prompt medical attention.',
  },
  {
    name: 'English Ivy',
    scientific: 'Hedera helix',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'moderate',
    note: 'Leaves and berries irritate the gut; dermatitis on repeated skin contact.',
  },

  // ── Moderate ───────────────────────────────────────────────────────────────
  {
    name: 'Peace Lily',
    scientific: 'Spathiphyllum wallisii',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'moderate',
    note: 'Calcium oxalate crystals — intense mouth burning, drooling, difficulty chewing.',
  },
  {
    name: 'Flamingo Flower',
    scientific: 'Anthurium andraeanum',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'moderate',
    note: 'Same oxalate crystal mechanism — oral irritation and swelling.',
  },
  {
    name: 'Snake Plant',
    scientific: 'Dracaena trifasciata',
    toxicTo: ['cats', 'dogs'],
    severity: 'moderate',
    note: 'Saponins — vomiting and diarrhoea in pets; mildly irritating to humans if eaten.',
    aliases: ['sansevieria', 'sansevieria trifasciata', "mother-in-law's tongue", 'mother in law tongue'],
  },

  // ── Mild (the aroids: oxalates, uncomfortable but rarely dangerous) ───────
  {
    name: 'Monstera',
    scientific: 'Monstera deliciosa',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'mild',
    note: 'Calcium oxalate — mouth irritation and drooling; rarely serious.',
  },
  {
    name: 'Heartleaf Philodendron',
    scientific: 'Philodendron hederaceum',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'mild',
    note: 'Oxalate crystals — oral irritation, drooling, mild GI upset.',
  },
  {
    name: 'Golden Pothos',
    scientific: 'Epipremnum aureum',
    toxicTo: ['cats', 'dogs'],
    severity: 'mild',
    note: 'Oxalate crystals — chewing causes mouth irritation and mild vomiting.',
    aliases: ['pothos', "devil's ivy", 'epipremnum', 'devils ivy'],
  },
  {
    name: 'ZZ Plant',
    scientific: 'Zamioculcas zamiifolia',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'mild',
    note: 'Oxalate crystals — transient mouth and skin irritation.',
  },
  {
    name: 'Chinese Evergreen',
    scientific: 'Aglaonema modestum',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'mild',
    note: 'Oxalate crystals — oral irritation, drooling.',
  },
  {
    name: 'Fiddle Leaf Fig',
    scientific: 'Ficus lyrata',
    toxicTo: ['cats', 'dogs'],
    severity: 'mild',
    note: 'Ficus latex — irritating sap; drooling and skin reaction on contact.',
  },
  {
    name: 'Weeping Fig',
    scientific: 'Ficus benjamina',
    toxicTo: ['cats', 'dogs'],
    severity: 'mild',
    note: 'Ficus latex — drooling and vomiting on chewing; sap irritates skin.',
  },
  {
    name: 'Aloe Vera',
    scientific: 'Aloe vera',
    toxicTo: ['cats', 'dogs'],
    severity: 'mild',
    note: 'The leaf latex (anthraquinones) causes vomiting and diarrhoea in pets.',
  },
  {
    name: 'Jade Plant',
    scientific: 'Crassula ovata',
    toxicTo: ['cats', 'dogs'],
    severity: 'moderate',
    note: 'Unknown principle — vomiting and lethargy; large ingestions warrant a vet call.',
  },
  {
    name: 'Begonia',
    scientific: 'Begonia semperflorens',
    toxicTo: ['cats', 'dogs'],
    severity: 'mild',
    note: 'Soluble oxalates, worst in the roots — oral irritation and vomiting.',
  },
  {
    name: 'Wandering Dude',
    scientific: 'Tradescantia zebrina',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'mild',
    note: 'Mainly contact dermatitis on skin; mild GI upset if chewed.',
  },
  {
    name: 'Yucca',
    scientific: 'Yucca gigantea',
    toxicTo: ['cats', 'dogs', 'humans'],
    severity: 'moderate',
    note: 'Saponins — vomiting and diarrhoea in pets.',
  },

  // ── Verified pet-friendly (ASPCA non-toxic lists) ─────────────────────────
  {
    name: 'Boston Fern',
    scientific: 'Nephrolepis exaltata',
    toxicTo: [],
    severity: 'mild',
    note: 'Listed non-toxic to cats, dogs and people by the ASPCA.',
  },
  {
    name: 'Calathea',
    scientific: 'Goeppertia orbifolia',
    toxicTo: [],
    severity: 'mild',
    note: 'Prayer plants are listed non-toxic to pets and people.',
  },
  {
    name: 'Spider Plant',
    scientific: 'Chlorophytum comosum',
    toxicTo: [],
    severity: 'mild',
    note: 'Listed non-toxic; even mildly hallucinogenic for some cats, without harm.',
  },
  {
    name: 'Areca Palm',
    scientific: 'Dypsis lutescens',
    toxicTo: [],
    severity: 'mild',
    note: 'Listed non-toxic to pets and people.',
  },
  {
    name: 'Parlor Palm',
    scientific: 'Chamaedorea elegans',
    toxicTo: [],
    severity: 'mild',
    note: 'Listed non-toxic to pets and people.',
  },
  {
    name: 'Moth Orchid',
    scientific: 'Phalaenopsis amabilis',
    toxicTo: [],
    severity: 'mild',
    note: 'Listed non-toxic to pets and people.',
  },
  {
    name: 'African Violet',
    scientific: 'Saintpaulia ionantha',
    toxicTo: [],
    severity: 'mild',
    note: 'Listed non-toxic to pets and people.',
  },
  {
    name: 'Baby Rubber Plant',
    scientific: 'Peperomia obtusifolia',
    toxicTo: [],
    severity: 'mild',
    note: 'Peperomias are listed non-toxic to pets and people.',
  },
  {
    name: 'Chinese Money Plant',
    scientific: 'Pilea peperomioides',
    toxicTo: [],
    severity: 'mild',
    note: 'Widely listed non-toxic to pets and people.',
  },
  {
    name: 'Prayer Plant',
    scientific: 'Maranta leuconeura',
    toxicTo: [],
    severity: 'mild',
    note: 'Listed non-toxic to pets and people.',
  },
];

/** The ASPCA's own lookup for the authoritative answer — always linked. */
export function aspcaLookupUrl(scientific: string): string {
  return `https://www.aspca.org/search?query=${encodeURIComponent(`${scientific} plant`)}`;
}

/**
 * Toxicity verdict for a user-entered species, layered most-strict first:
 *  1. conservative scientific matching (folioMatchesForSpecies rules);
 *  2. exact alias hit ('pothos', 'sansevieria', 'mother-in-law's tongue');
 *  3. exact or full-phrase-contained common name ('golden pothos' ⊇ 'pothos'
 *     is NOT allowed — containment runs user ⊇ name only, so a bare 'fern'
 *     can never inherit Boston Fern's pet-friendly verdict).
 * Returns null when the database has no verdict; the UI then shows nothing
 * rather than guessing.
 */
export function lookupToxicity(species: string): ToxicityEntry | null {
  const s = species.trim().toLowerCase();
  if (!s) return null;

  const byScientific = folioMatchesForSpecies(TOXICITY_DB, [species]);
  if (byScientific.length) return byScientific[0];

  const byAlias = TOXICITY_DB.find(e =>
    (e.aliases ?? []).some(a => a.toLowerCase() === s),
  );
  if (byAlias) return byAlias;

  return TOXICITY_DB.find(e => {
    const name = e.name.toLowerCase();
    return name === s || s.includes(name);
  }) ?? null;
}
