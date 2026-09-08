import assert from 'node:assert';

export interface CheckinMock {
  id: string;
  timestamp: Date;
  guardianScore: number;
  soilMoisture?: string;
  lightLevel?: string;
  photoUrl?: string;
}

export interface NoteMock {
  id: string;
  plantId: string;
  content: string;
  category: 'observation' | 'action' | 'milestone';
  tags?: string[];
  createdAt: Date;
}

export function filterDossierNotes(
  notes: NoteMock[],
  query: string,
  category: NoteMock['category'] | 'all',
  selectedTags: string[]
): NoteMock[] {
  const q = query.trim().toLowerCase();
  return notes.filter(n => {
    const matchesSearch = !q || n.content.toLowerCase().includes(q);
    const matchesCat = category === 'all' || n.category === category;
    const matchesTags = selectedTags.length === 0 || selectedTags.every(t => n.tags?.includes(t));
    return matchesSearch && matchesCat && matchesTags;
  });
}

export function extractAllUniqueTags(notes: NoteMock[]): string[] {
  const set = new Set<string>();
  for (const n of notes) {
    if (n.tags) {
      for (const t of n.tags) {
        set.add(t);
      }
    }
  }
  return Array.from(set).sort();
}

export function formatTelemetryChartData(history: CheckinMock[]) {
  return history.map(h => ({
    day: h.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: h.guardianScore
  }));
}

export function getPropagationLimit(tier?: string): number {
  return tier === 'pro' ? 5 : 1;
}

export function runPlantDetailChecks() {
  const mockNotes: NoteMock[] = [
    {
      id: 'n1',
      plantId: 'p1',
      content: 'New leaf unfurling with white variegation sector',
      category: 'observation',
      tags: ['variegation', 'growth'],
      createdAt: new Date('2026-09-01')
    },
    {
      id: 'n2',
      plantId: 'p1',
      content: 'Flushed root system with rainwater and organic compost tea',
      category: 'action',
      tags: ['watering', 'nutrients'],
      createdAt: new Date('2026-09-02')
    },
    {
      id: 'n3',
      plantId: 'p1',
      content: 'First fenestration opened successfully',
      category: 'milestone',
      tags: ['growth', 'mature'],
      createdAt: new Date('2026-09-03')
    }
  ];

  // 1. Tag extraction
  const tags = extractAllUniqueTags(mockNotes);
  assert(tags.length === 5, 'Should extract 5 unique tags');
  assert(tags.includes('variegation') && tags.includes('growth'), 'Contains expected tags');

  // 2. Filter by search query
  const searchResults = filterDossierNotes(mockNotes, 'fenestration', 'all', []);
  assert(searchResults.length === 1 && searchResults[0].id === 'n3', 'Search filter works');

  // 3. Filter by category
  const actionResults = filterDossierNotes(mockNotes, '', 'action', []);
  assert(actionResults.length === 1 && actionResults[0].id === 'n2', 'Category filter works');

  // 4. Filter by tag
  const growthResults = filterDossierNotes(mockNotes, '', 'all', ['growth']);
  assert(growthResults.length === 2, 'Tag filter works');

  // 5. Propagation limits
  assert(getPropagationLimit('pro') === 5, 'Pro limit is 5');
  assert(getPropagationLimit('free') === 1, 'Free limit is 1');
  assert(getPropagationLimit(undefined) === 1, 'Default limit is 1');

  // 6. Chart data mapping
  const mockHistory: CheckinMock[] = [
    { id: 'c1', timestamp: new Date('2026-09-01T10:00:00Z'), guardianScore: 88 },
    { id: 'c2', timestamp: new Date('2026-09-02T10:00:00Z'), guardianScore: 92 }
  ];
  const chart = formatTelemetryChartData(mockHistory);
  assert(chart.length === 2 && chart[0].score === 88 && chart[1].score === 92, 'Chart data mapped correctly');

  return { success: true, count: 6 };
}
