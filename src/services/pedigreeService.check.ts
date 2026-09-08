import assert from 'node:assert';
import { 
  calculateGenerationDepth, 
  deriveInheritedTraits,
  type PropagationRecordMock,
  type CardDisplayMock
} from './pedigreeUtils';

export function runPedigreeChecks() {
  console.log('--- Running Pedigree Lineage Self-Checks ---');

  const mockProps: PropagationRecordMock[] = [
    { id: 'p1', parentCardId: 'founder-1', babyCardId: 'progeny-1', success: true, createdAt: new Date() },
    { id: 'p2', parentCardId: 'progeny-1', babyCardId: 'progeny-2', success: true, createdAt: new Date() },
    { id: 'p3', parentCardId: 'progeny-2', babyCardId: 'progeny-3', success: true, createdAt: new Date() }
  ];

  // 1. Founder Depth (F0)
  const founderResult = calculateGenerationDepth('founder-1', mockProps);
  assert.strictEqual(founderResult.generation, 0);
  assert.strictEqual(founderResult.label, 'F0 (Founder Strain)');
  assert.strictEqual(founderResult.ancestors.length, 0);

  // 2. F1 Progeny Depth
  const f1Result = calculateGenerationDepth('progeny-1', mockProps);
  assert.strictEqual(f1Result.generation, 1);
  assert.strictEqual(f1Result.ancestors[0], 'founder-1');

  // 3. F3 Great-Grandchild Depth
  const f3Result = calculateGenerationDepth('progeny-3', mockProps);
  assert.strictEqual(f3Result.generation, 3);
  assert.strictEqual(f3Result.ancestors.length, 3);

  // 4. Circular Reference Protection
  const cycleProps: PropagationRecordMock[] = [
    { id: 'c1', parentCardId: 'card-a', babyCardId: 'card-b', success: true, createdAt: new Date() },
    { id: 'c2', parentCardId: 'card-b', babyCardId: 'card-a', success: true, createdAt: new Date() }
  ];
  const cycleResult = calculateGenerationDepth('card-b', cycleProps);
  assert.strictEqual(cycleResult.generation, 2, 'Should terminate without infinite loop');

  // 5. Inherited Traits (Founder vs Clonal vs Hybrid)
  const founderCard: CardDisplayMock = { id: 'founder-1', plantId: 'p1', name: 'Monstera Deliciosa', species: 'Monstera deliciosa' };
  const progenyCard: CardDisplayMock = { id: 'progeny-1', plantId: 'p2', name: 'Monstera Sprout', species: 'Monstera deliciosa' };
  const hybridParentCard: CardDisplayMock = { id: 'parent-b', plantId: 'p3', name: 'Alocasia Polly', species: 'Alocasia amazonica' };

  const founderTraits = deriveInheritedTraits(founderCard);
  assert.strictEqual(founderTraits.length, 3);
  assert.strictEqual(founderTraits[0].purity, 100);

  const clonalTraits = deriveInheritedTraits(progenyCard, founderCard);
  assert.strictEqual(clonalTraits.length, 3);
  assert(clonalTraits[0].inheritance.includes('Monstera Deliciosa'));

  const hybridTraits = deriveInheritedTraits(progenyCard, founderCard, hybridParentCard);
  assert.strictEqual(hybridTraits.length, 3);
  assert(hybridTraits[0].inheritance.includes('Cross:'));

  console.log('All Pedigree Lineage self-checks passed successfully!');
  return { success: true, count: 5 };
}

if (process.argv[1]?.includes('pedigreeService.check')) {
  runPedigreeChecks();
}
