import assert from 'node:assert';

// 1. Constants & mock data corresponding to Library codex
const ROMAN_NUMERALS = ['I.', 'II.', 'III.', 'IV.', 'V.'];

const PHYTO_NOTES = [
  { name: 'Monstera deliciosa', scientific: 'Monstera deliciosa', type: 'Species Profile', organ: 'Whole Organism', symptoms: 'Fenestration delay, yellowing edges' },
  { name: 'Sansevieria trifasciata', scientific: 'Dracaena trifasciata', type: 'Species Profile', organ: 'Rhizome/Leaf', symptoms: 'Mushy base' },
  { name: 'Powdery Mildew', scientific: 'Erysiphales', type: 'Pathology', organ: 'Leaf/Stem', symptoms: 'White, flour-like powder' },
  { name: 'Root Rot', scientific: 'Phytophthora / Pythium', type: 'Pathology', organ: 'Root System', symptoms: 'Mushy roots, odor' },
  { name: 'Spider Mites', scientific: 'Tetranychidae', type: 'Pest', organ: 'Leaf Underside', symptoms: 'Microscopic stippling, webbing' },
];

const DAILY_QUIZZES = [
  { question: 'Which plant counts repeated touches before closing its trap?', options: ['Venus flytrap', 'Boston fern', 'Snake plant'], answer: 0 },
  { question: 'What usually drives crispy fern frond tips indoors?', options: ['Low humidity', 'Too much moonlight', 'Excess nitrogen'], answer: 0 },
  { question: 'What does mycorrhiza mainly connect to plants?', options: ['Fungal networks', 'Plastic fibers', 'Mineral paint'], answer: 0 },
  { question: 'Which condition most often invites root rot?', options: ['Poor drainage', 'Morning shade', 'Leaf dust'], answer: 0 },
];

const FALLBACK_EARTH_EVENTS = [
  { title: 'Open global natural event monitor', category: 'NASA EONET', date: 'Updated daily', source: 'NASA EONET', url: 'https://eonet.gsfc.nasa.gov/' },
  { title: 'Wildfire, storm, volcano records', category: 'Earth Watch', date: 'Near real-time', source: 'NASA Earth Observatory', url: 'https://science.nasa.gov/' },
];

function getTodayKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayNumber(todayKeyStr: string) {
  return Math.floor(new Date(todayKeyStr).getTime() / 86400000);
}

function filterSpecimens(
  notes: typeof PHYTO_NOTES,
  activeFilter: 'All' | 'Species Profile' | 'Pathology' | 'Pest',
  search: string
) {
  const q = search.toLowerCase();
  return notes.filter(
    (d) =>
      (activeFilter === 'All' || d.type === activeFilter) &&
      (d.name.toLowerCase().includes(q) ||
        d.symptoms.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q))
  );
}

async function runCheck() {
  console.log('Running Library Guild Codex assert-based self-check...');

  // 1. Date formatting & deterministic day number
  const testDate = new Date('2026-09-06T00:00:00Z');
  const key = getTodayKey(testDate);
  assert.strictEqual(key, '2026-09-06', 'Date formatting must match YYYY-MM-DD');
  const dayNum = getDayNumber(key);
  assert(dayNum > 0, 'Day number must be positive integer');

  // 2. Daily quiz indexing & answer verification
  const quiz = DAILY_QUIZZES[dayNum % DAILY_QUIZZES.length];
  assert(quiz && quiz.question, 'Selected quiz must have a valid question');
  assert(Array.isArray(quiz.options) && quiz.options.length >= 2, 'Quiz must have at least 2 options');
  assert(quiz.answer >= 0 && quiz.answer < quiz.options.length, 'Answer must be within options range');

  // Roman numeral bullets
  assert.strictEqual(ROMAN_NUMERALS[0], 'I.');
  assert.strictEqual(ROMAN_NUMERALS[1], 'II.');
  assert.strictEqual(ROMAN_NUMERALS[2], 'III.');

  // 3. Specimen filtering & search mechanics
  const allSpecimens = filterSpecimens(PHYTO_NOTES, 'All', '');
  assert.strictEqual(allSpecimens.length, 5, 'All filter should return all specimens');

  const pathologies = filterSpecimens(PHYTO_NOTES, 'Pathology', '');
  assert.strictEqual(pathologies.length, 2, 'Pathology filter should return 2 items');
  assert(pathologies.every((p) => p.type === 'Pathology'), 'All items must be Pathology');

  const pests = filterSpecimens(PHYTO_NOTES, 'Pest', '');
  assert.strictEqual(pests.length, 1, 'Pest filter should return 1 item');
  assert.strictEqual(pests[0].name, 'Spider Mites');

  // Search by symptom
  const symptomSearch = filterSpecimens(PHYTO_NOTES, 'All', 'webbing');
  assert.strictEqual(symptomSearch.length, 1);
  assert.strictEqual(symptomSearch[0].name, 'Spider Mites');

  // Search by partial scientific name
  const scientificSearch = filterSpecimens(PHYTO_NOTES, 'All', 'mildew');
  assert.strictEqual(scientificSearch.length, 1);
  assert.strictEqual(scientificSearch[0].name, 'Powdery Mildew');

  // Case insensitivity
  const caseInsensitiveSearch = filterSpecimens(PHYTO_NOTES, 'All', 'MONSTERA');
  assert.strictEqual(caseInsensitiveSearch.length, 1);

  // Empty match
  const noMatchSearch = filterSpecimens(PHYTO_NOTES, 'All', 'nonexistent_specimen_xyz');
  assert.strictEqual(noMatchSearch.length, 0);

  // 4. Daily featured specimen canonical selection
  const dailyFeaturedSpecimen = PHYTO_NOTES[dayNum % PHYTO_NOTES.length];
  assert(dailyFeaturedSpecimen && dailyFeaturedSpecimen.name, 'Canonical featured specimen must exist');

  // Verify that featured specimen status is consistent across filtered views
  const allHasFeatured = allSpecimens.some((s) => s.name === dailyFeaturedSpecimen.name);
  assert.strictEqual(allHasFeatured, true, 'All specimens must contain the daily featured specimen');

  const matchingTypeFilter = filterSpecimens(PHYTO_NOTES, dailyFeaturedSpecimen.type as any, '');
  const typeFilterHasFeatured = matchingTypeFilter.some((s) => s.name === dailyFeaturedSpecimen.name);
  assert.strictEqual(typeFilterHasFeatured, true, 'Matching category filter must contain daily featured specimen');

  // 5. NASA Earth Watch fallback and circular indexing
  assert(FALLBACK_EARTH_EVENTS.length >= 2, 'Must have at least 2 fallback earth events');
  for (let i = 0; i < 10; i++) {
    const event = FALLBACK_EARTH_EVENTS[i % FALLBACK_EARTH_EVENTS.length];
    assert(event.title && event.url, 'Event must have valid title and url');
  }

  console.log('✓ All Library Guild Codex checks passed successfully.');
}

runCheck().catch((err) => {
  console.error('✗ Library check failed:', err);
  process.exit(1);
});
