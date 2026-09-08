import type { PhytoCard, Plant, Propagation } from '../types';

export interface SpecimenNode {
  id: string;
  cardId?: string;
  plantId?: string;
  name: string;
  species: string;
  rarity: string;
  generation: number; // 0 for F0, 1 for F1, etc.
  generationLabel: string;
  accessionCode: string;
  monogram: string;
  purityScore: number; // 0 to 100
  purityGrade: string;
  isFounder: boolean;
  isExtinct?: boolean;
  stats: {
    attack: number;
    defense: number;
    health: number;
    speed: number;
    longevity: number;
  };
  parentIds: string[];
  childIds: string[];
  acquiredAt?: Date;
  level?: number;
}

export interface LineageTree {
  target: SpecimenNode;
  ancestors: SpecimenNode[];
  offspring: SpecimenNode[];
  maxGenerationalDepth: number;
  totalLineageNodes: number;
  hasCycle: boolean;
  isFounder: boolean;
}

export interface InheritedTraits {
  foliage: {
    name: string;
    allele: string;
    expressionPct: number;
    description: string;
    glyph: string;
  };
  rootVigor: {
    name: string;
    architecture: string;
    vigorModifier: number;
    description: string;
    glyph: string;
  };
  hardiness: {
    name: string;
    zone: string;
    toleranceScore: number;
    description: string;
    glyph: string;
  };
  purity: {
    score: number;
    label: string;
    sealTitle: string;
    apothecaryMotto: string;
  };
  punnettSquare: {
    traitName: string;
    parent1Gametes: [string, string];
    parent2Gametes: [string, string];
    cells: [
      [string, string],
      [string, string]
    ];
    probabilities: { genotype: string; phenotype: string; percentage: number }[];
  };
}

/**
 * Deterministic short hash string from any ID
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Format accession code: ACC-XXXX-Fn
 */
export function formatAccessionCode(id: string, gen: number): string {
  if (!id) return `ACC-0000-F${Math.max(0, gen)}`;
  const hex = hashString(id).toString(16).padStart(4, '0').slice(0, 4).toUpperCase();
  return `ACC-${hex}-F${Math.max(0, gen)}`;
}

/**
 * Extract 2-letter monogram from common name or species
 */
export function extractMonogram(name: string, species?: string): string {
  const clean = (name || species || 'Specimen').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return 'SP';
}

/**
 * Get human-readable generation label
 */
export function getGenerationLabel(gen: number): string {
  if (gen <= 0) return 'F0 (Wild Founder)';
  if (gen === 1) return 'F1 (First Filial)';
  if (gen === 2) return 'F2 (Second Filial)';
  if (gen === 3) return 'F3 (Stabilized Filial)';
  return `F${gen} (Advanced Lineage)`;
}

/**
 * Calculate purity score and badge grade based on generation and lineage
 */
export function calculatePurity(gen: number, isHybrid: boolean): { score: number; grade: string; sealTitle: string; motto: string } {
  if (gen <= 0) {
    return {
      score: 100,
      grade: 'Royal Heirloom Archetype',
      sealTitle: 'ARCHETYPE · 100% UNHYBRIDIZED',
      motto: 'Radices Antiquae, Sanguis Purus'
    };
  }
  if (isHybrid) {
    const score = Math.max(50, Math.min(92, 50 + (gen * 14)));
    return {
      score,
      grade: gen === 1 ? 'F1 Heterosis Cross' : `F${gen} Hybrid Selection`,
      sealTitle: `HETEROSIS VIGOR · F${gen}`,
      motto: 'Concordia Foliorum, Robur Vivum'
    };
  }
  const score = Math.min(99.4, 90 + (gen * 2.3));
  return {
    score: Math.round(score * 10) / 10,
    grade: `F${gen} Domestic Selection`,
    sealTitle: `HEIRLOOM PURITY · ${score.toFixed(1)}%`,
    motto: 'Folia Aeterna, Linea Conservata'
  };
}

/**
 * Build SpecimenNode from card or plant
 */
export function createSpecimenNode(
  id: string,
  card?: PhytoCard,
  plant?: Plant,
  generation: number = 0,
  isHybrid: boolean = false
): SpecimenNode {
  const name = card?.commonName || plant?.name || plant?.species || 'Botanical Specimen';
  const species = card?.species || plant?.species || 'Unknown Plant';
  const rarity = card?.rarity || 'common';
  const purity = calculatePurity(generation, isHybrid);

  const stats = card?.stats || {
    attack: 50,
    defense: 50,
    health: 50,
    speed: 50,
    longevity: 50
  };

  return {
    id,
    cardId: card?.id,
    plantId: card?.plantId || plant?.id,
    name,
    species,
    rarity,
    generation,
    generationLabel: getGenerationLabel(generation),
    accessionCode: formatAccessionCode(id, generation),
    monogram: extractMonogram(name, species),
    purityScore: purity.score,
    purityGrade: purity.grade,
    isFounder: generation === 0,
    stats,
    parentIds: [],
    childIds: [],
    acquiredAt: card?.acquiredAt || plant?.createdAt,
    level: card?.level || 1
  };
}

/**
 * Build the full Lineage Tree with circular reference protection and missing parent stubs.
 */
export function buildLineageTree(
  targetId: string,
  allCards: PhytoCard[],
  allPropagations: Propagation[],
  allPlants: Plant[] = []
): LineageTree {
  // 1. Index maps for O(1) lookups
  const cardById = new Map<string, PhytoCard>();
  const cardByPlantId = new Map<string, PhytoCard>();
  allCards.forEach(c => {
    cardById.set(c.id, c);
    if (c.plantId) cardByPlantId.set(c.plantId, c);
  });

  const plantById = new Map<string, Plant>();
  allPlants.forEach(p => plantById.set(p.id, p));

  // Resolve target card/plant
  let targetCard = cardById.get(targetId);
  let targetPlant = plantById.get(targetId);

  if (!targetCard && targetPlant) {
    targetCard = cardByPlantId.get(targetPlant.id);
  } else if (targetCard && !targetPlant && targetCard.plantId) {
    targetPlant = plantById.get(targetCard.plantId);
  }

  // Canonical target ID is card id if found, else provided id
  const canonicalTargetId = targetCard ? targetCard.id : targetId;

  // Build propagation mappings
  // Baby ID -> Propagation record
  const babyToPropMap = new Map<string, Propagation>();
  // Parent ID -> list of successful propagations
  const parentToPropsMap = new Map<string, Propagation[]>();

  allPropagations.forEach(prop => {
    if (prop.babyCardId) {
      babyToPropMap.set(prop.babyCardId, prop);
    }
    if (prop.success) {
      // Direct parent
      if (prop.parentCardId) {
        const list = parentToPropsMap.get(prop.parentCardId) || [];
        list.push(prop);
        parentToPropsMap.set(prop.parentCardId, list);
      }
      // Hybrid co-parents
      if (prop.isHybrid && prop.hybridParents) {
        prop.hybridParents.forEach(hp => {
          if (hp && hp !== prop.parentCardId) {
            const list = parentToPropsMap.get(hp) || [];
            list.push(prop);
            parentToPropsMap.set(hp, list);
          }
        });
      }
    }
  });

  // Cycle detection and cache
  const visitedAncestors = new Set<string>();
  let hasCycle = false;

  // Helper to determine generation depth and parents recursively with cycle guard
  function resolveAncestors(nodeId: string, currentDepth: number): { gen: number; parents: SpecimenNode[] } {
    if (visitedAncestors.has(nodeId)) {
      hasCycle = true;
      return { gen: 0, parents: [] };
    }
    visitedAncestors.add(nodeId);

    const prop = babyToPropMap.get(nodeId);
    if (!prop) {
      // No parent recorded -> F0 founder
      return { gen: 0, parents: [] };
    }

    const parentIds: string[] = [];
    if (prop.parentCardId) parentIds.push(prop.parentCardId);
    if (prop.isHybrid && prop.hybridParents) {
      prop.hybridParents.forEach(hp => {
        if (hp && !parentIds.includes(hp)) parentIds.push(hp);
      });
    }

    if (parentIds.length === 0) {
      return { gen: 0, parents: [] };
    }

    const resolvedParents: SpecimenNode[] = [];
    let maxParentGen = 0;

    for (const pId of parentIds) {
      const pCard = cardById.get(pId);
      const pPlant = pCard?.plantId ? plantById.get(pCard.plantId) : undefined;
      const { gen: pGen, parents: grandParents } = resolveAncestors(pId, currentDepth + 1);

      let pNode: SpecimenNode;
      if (pCard) {
        pNode = createSpecimenNode(pId, pCard, pPlant, pGen, prop.isHybrid);
      } else {
        // Missing parent stub (archival / wild progenitor)
        pNode = {
          id: pId,
          name: 'Archival Ancestor Stemma',
          species: 'Wild Botanical Strain',
          rarity: 'rare',
          generation: pGen,
          generationLabel: getGenerationLabel(pGen),
          accessionCode: formatAccessionCode(pId, pGen),
          monogram: 'WA',
          purityScore: 98,
          purityGrade: 'Archival Founder Strain',
          isFounder: pGen === 0,
          isExtinct: true,
          stats: { attack: 45, defense: 55, health: 50, speed: 40, longevity: 60 },
          parentIds: [],
          childIds: [nodeId]
        };
      }
      pNode.parentIds = grandParents.map(g => g.id);
      resolvedParents.push(pNode);
      if (pGen > maxParentGen) maxParentGen = pGen;
    }

    return { gen: maxParentGen + 1, parents: resolvedParents };
  }

  const { gen: targetGeneration, parents: directParents } = resolveAncestors(canonicalTargetId, 0);

  // Create target node
  const isHybrid = Boolean(babyToPropMap.get(canonicalTargetId)?.isHybrid);
  const targetNode = createSpecimenNode(
    canonicalTargetId,
    targetCard,
    targetPlant,
    targetGeneration,
    isHybrid
  );
  targetNode.parentIds = directParents.map(p => p.id);

  // Traverse Offspring (Descendants) with cycle guard
  const visitedDescendants = new Set<string>([canonicalTargetId]);
  const offspringList: SpecimenNode[] = [];

  function resolveDescendants(parentId: string, parentGen: number) {
    const props = parentToPropsMap.get(parentId) || [];
    for (const prop of props) {
      const babyId = prop.babyCardId;
      if (!babyId || visitedDescendants.has(babyId)) {
        if (babyId && visitedDescendants.has(babyId)) hasCycle = true;
        continue;
      }
      visitedDescendants.add(babyId);

      const babyCard = cardById.get(babyId);
      const babyPlant = babyCard?.plantId ? plantById.get(babyCard.plantId) : undefined;
      const childGen = parentGen + 1;
      const childNode = createSpecimenNode(
        babyId,
        babyCard,
        babyPlant,
        childGen,
        prop.isHybrid
      );
      childNode.parentIds = [parentId];
      offspringList.push(childNode);

      // Recurse for grandchildren
      resolveDescendants(babyId, childGen);
    }
  }

  resolveDescendants(canonicalTargetId, targetGeneration);
  targetNode.childIds = offspringList.filter(o => o.parentIds.includes(canonicalTargetId)).map(o => o.id);

  // Collect all ancestors in order of generational depth
  const ancestorList: SpecimenNode[] = [];
  function collectAncestors(parents: SpecimenNode[]) {
    for (const p of parents) {
      if (!ancestorList.some(a => a.id === p.id)) {
        ancestorList.push(p);
      }
      // Look up parent's parents if available
      const grandProps = babyToPropMap.get(p.id);
      if (grandProps?.parentCardId) {
        const gpCard = cardById.get(grandProps.parentCardId);
        if (gpCard && !ancestorList.some(a => a.id === gpCard.id)) {
          const gpNode = createSpecimenNode(gpCard.id, gpCard, undefined, Math.max(0, p.generation - 1), grandProps.isHybrid);
          ancestorList.push(gpNode);
        }
      }
    }
  }
  collectAncestors(directParents);

  const maxDepth = Math.max(
    targetGeneration,
    ...offspringList.map(o => o.generation),
    ...ancestorList.map(a => a.generation)
  );

  return {
    target: targetNode,
    ancestors: ancestorList,
    offspring: offspringList,
    maxGenerationalDepth: maxDepth,
    totalLineageNodes: 1 + ancestorList.length + offspringList.length,
    hasCycle,
    isFounder: targetGeneration === 0 && directParents.length === 0
  };
}

/**
 * Calculate inherited phenotypes and Punnett square matrix
 */
export function calculateInheritedTraits(
  target: SpecimenNode,
  parent1?: SpecimenNode | null,
  parent2?: SpecimenNode | null
): InheritedTraits {
  const isFounder = target.generation === 0 || (!parent1 && !parent2);

  // 1. Foliage Variegation
  let foliageName = 'Wildtype Emerald Monolith';
  let foliageAllele = 'V/V (Homozygous Dominant)';
  let foliagePct = 12;
  let foliageDesc = 'Saturated uniform dark forest chlorophyll, dense light harvesting index.';

  if (target.rarity === 'mythic' || (parent1?.rarity === 'mythic' || parent2?.rarity === 'mythic')) {
    foliageName = 'Albo-Splattered Chimera';
    foliageAllele = 'Vc/V (Chimeric Macro-Sectoring)';
    foliagePct = 88;
    foliageDesc = 'Radical L1/L2 meristematic sectoring with pure parchment-white foliar islands.';
  } else if (target.rarity === 'legendary' || target.stats.speed > 70) {
    foliageName = 'Aureo-Variegated Reticulation';
    foliageAllele = 'Va/v (Aureo Incomplete Dominant)';
    foliagePct = 68;
    foliageDesc = 'Luminescent golden-amber marbling radiating along secondary veining networks.';
  } else if (target.rarity === 'rare' || target.stats.defense > 60) {
    foliageName = 'Mint Glaucous Striation';
    foliageAllele = 'Vm/V (Mint Allele Co-Dominant)';
    foliagePct = 42;
    foliageDesc = 'Subtle glaucous wax frosting creating silvery mint leaf striations.';
  } else if (!isFounder) {
    foliageName = 'Heritage Mottled Vigor';
    foliageAllele = 'V/v (Heterozygous Carrier)';
    foliagePct = 34;
    foliageDesc = 'Balanced photosynthetic yield with localized chloroplastic mottling.';
  }

  // 2. Root Vigor & Rhizome Architecture
  let rootArch = 'Fibrous Capillary Network';
  let rootVigorMod = Math.round(target.stats.health * 0.25 + target.stats.longevity * 0.15);
  let rootDesc = 'Dense fine-root radial mat optimizing hydraulic conductance across standard soil strata.';

  if (target.stats.longevity >= 75) {
    rootArch = 'Lignified Taproot Anchor';
    rootDesc = 'Deep vertical bedrock anchor with drought-resistant lignified vascular core.';
  } else if (target.stats.health >= 75) {
    rootArch = 'Mycorrhizal Tuberous Rhizome';
    rootDesc = 'Stoloniferous storage tubers exhibiting profound fungal mutualism and nutrient reservoirs.';
  } else if (target.stats.speed >= 65) {
    rootArch = 'Velamen Aerial Tendrils';
    rootDesc = 'Multilayered spongy velamen radicum specialized for rapid atmospheric vapor harvesting.';
  }

  // 3. Environmental Hardiness
  let zone = 'USDA Zone 9b – 11b (Subtropical)';
  let hardinessScore = Math.min(99, Math.round(target.stats.defense * 0.6 + target.stats.longevity * 0.4));
  let hardinessDesc = 'Standard frost-sensitive conservatory canopy; thrives in humid, filtered daylight.';

  if (target.stats.defense >= 80) {
    zone = 'USDA Zone 6a – 10a (Sub-Zero Enduring)';
    hardinessDesc = 'Extreme osmotic freeze-tolerance, thickened cuticular wax armor resilient against desiccation.';
  } else if (target.stats.defense >= 60) {
    zone = 'USDA Zone 8a – 11a (Temperate Hardy)';
    hardinessDesc = 'Resilient xylem conduits capable of enduring dry spells and fluctuating moisture.';
  }

  // 4. Purity Rating
  const purity = calculatePurity(target.generation, Boolean(parent1 && parent2));

  // 5. Mendelian Punnett Square for Primary Allele (Variegation Gene V/v)
  const p1GameteA = isFounder ? 'V' : (parent1?.rarity === 'mythic' ? 'Vc' : 'V');
  const p1GameteB = isFounder ? 'V' : (parent1?.generation && parent1.generation > 1 ? 'v' : 'V');
  const p2GameteA = isFounder ? 'V' : (parent2 ? (parent2.rarity === 'mythic' ? 'Vc' : 'V') : 'v');
  const p2GameteB = isFounder ? 'V' : (parent2 ? 'v' : 'v');

  const cell00 = `${p1GameteA}${p2GameteA}`;
  const cell01 = `${p1GameteA}${p2GameteB}`;
  const cell10 = `${p1GameteB}${p2GameteA}`;
  const cell11 = `${p1GameteB}${p2GameteB}`;

  // Tally probabilities
  const gridCells = [cell00, cell01, cell10, cell11];
  const countMap = new Map<string, number>();
  gridCells.forEach(g => {
    const sorted = g.split('').sort().join('');
    countMap.set(sorted, (countMap.get(sorted) || 0) + 1);
  });

  const probabilities = Array.from(countMap.entries()).map(([genotype, count]) => {
    let phenotype = 'Standard Green';
    if (genotype.includes('Vc')) phenotype = 'Chimeric Albo';
    else if (genotype === 'VV') phenotype = 'Purebred Dominant';
    else if (genotype.includes('V') && genotype.includes('v')) phenotype = 'Variegated Carrier';
    else if (genotype === 'vv') phenotype = 'Recessive Wild';
    return {
      genotype,
      phenotype,
      percentage: (count / 4) * 100
    };
  });

  return {
    foliage: {
      name: foliageName,
      allele: foliageAllele,
      expressionPct: foliagePct,
      description: foliageDesc,
      glyph: '🌿'
    },
    rootVigor: {
      name: rootArch,
      architecture: rootArch,
      vigorModifier: rootVigorMod,
      description: rootDesc,
      glyph: '℥'
    },
    hardiness: {
      name: `${zone}`,
      zone,
      toleranceScore: hardinessScore,
      description: hardinessDesc,
      glyph: '℞'
    },
    purity: {
      score: purity.score,
      label: purity.grade,
      sealTitle: purity.sealTitle,
      apothecaryMotto: purity.motto
    },
    punnettSquare: {
      traitName: 'Variegation Chimera Allele (V/v)',
      parent1Gametes: [p1GameteA, p1GameteB],
      parent2Gametes: [p2GameteA, p2GameteB],
      cells: [
        [cell00, cell01],
        [cell10, cell11]
      ],
      probabilities
    }
  };
}

/**
 * Pure mathematical SVG Bézier curve calculations for botanical vine connectors.
 * Generates smooth natural S-curves between coordinates with bud node positioning.
 */
export function calculateVineBranchPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { pathString: string; midBudX: number; midBudY: number; angle: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  // Natural botanical curve with slight organic bowing
  const bow = dx > 0 ? 15 : -15;
  const cx1 = x1 + bow;
  const cy1 = y1 + dy * 0.45;
  const cx2 = x2 - bow;
  const cy2 = y2 - dy * 0.45;

  const pathString = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

  // Midpoint at t = 0.5 for bud/leaf germination node
  const t = 0.5;
  const midBudX = Math.round(
    Math.pow(1 - t, 3) * x1 +
    3 * Math.pow(1 - t, 2) * t * cx1 +
    3 * (1 - t) * Math.pow(t, 2) * cx2 +
    Math.pow(t, 3) * x2
  );
  const midBudY = Math.round(
    Math.pow(1 - t, 3) * y1 +
    3 * Math.pow(1 - t, 2) * t * cy1 +
    3 * (1 - t) * Math.pow(t, 2) * cy2 +
    Math.pow(t, 3) * y2
  );

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return { pathString, midBudX, midBudY, angle };
}

export interface PropagationRecordMock {
  id: string;
  parentCardId: string;
  babyCardId: string;
  isHybrid?: boolean;
  hybridParents?: string[];
  success: boolean;
  createdAt: Date;
}

export interface CardDisplayMock {
  id: string;
  plantId?: string;
  commonName?: string;
  name?: string;
  species: string;
  generation?: number;
  combatPower?: number;
  rarity?: string;
}

/**
 * Calculates generation index (F0, F1, F2...) by traversing parent lineage with cycle protection.
 */
export function calculateGenerationDepth(
  targetId: string,
  propagations: Array<{ parentCardId: string; babyCardId: string; success?: boolean }>,
  maxDepth = 20
): { generation: number; label: string; ancestors: string[] } {
  const visited = new Set<string>();
  const ancestors: string[] = [];
  let currentId: string | undefined = targetId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    const match = propagations.find(p => p.babyCardId === currentId && (p.success ?? true));
    if (match) {
      ancestors.push(match.parentCardId);
      currentId = match.parentCardId;
      depth++;
    } else {
      break;
    }
  }

  const label = depth === 0 ? 'F0 (Founder Strain)' : `F${depth} (${depth === 1 ? 'First Gen Progeny' : 'Cultivated Lineage'})`;
  return { generation: depth, label, ancestors };
}

function getMockDisplayName(card?: CardDisplayMock): string {
  return card?.commonName || card?.name || card?.species || 'Botanical Specimen';
}

/**
 * Derives inherited trait breakdown from parent cards.
 */
export function deriveInheritedTraits(
  subjectCard: CardDisplayMock,
  parentCard?: CardDisplayMock,
  otherParentCard?: CardDisplayMock
): Array<{ trait: string; inheritance: string; purity: number; glyph: string }> {
  if (!parentCard) {
    return [
      { trait: 'Wild Chlorophyll Expression', inheritance: 'Original Founder Genome', purity: 100, glyph: '🜄' },
      { trait: 'Native Biome Resilience', inheritance: 'Direct Environmental Adaptation', purity: 100, glyph: '🜃' },
      { trait: 'Archetype Baseline Vigor', inheritance: 'Unmodified Gene Pool', purity: 100, glyph: '🜂' }
    ];
  }

  const pName = getMockDisplayName(parentCard);

  if (otherParentCard) {
    const oName = getMockDisplayName(otherParentCard);
    return [
      { trait: 'Hybrid Leaf Variegation', inheritance: `Cross: ${pName} × ${oName}`, purity: 88, glyph: '🜁' },
      { trait: 'Heterosis Vigor Vector', inheritance: 'Biparental Recombination', purity: 94, glyph: '🜂' },
      { trait: 'Abiotic Climate Hardiness', inheritance: 'Polygenic Synergistic Trait', purity: 91, glyph: '🜃' }
    ];
  }

  return [
    { trait: 'Clonal Foliage Symmetry', inheritance: `Direct cutting from ${pName}`, purity: 99, glyph: '🜄' },
    { trait: 'Meristem Cell Memory', inheritance: 'Direct Vegetative Propagation', purity: 98, glyph: '🜃' },
    { trait: 'Phenotypic Stability Index', inheritance: 'Faithful Maternal Line', purity: 96, glyph: '🜂' }
  ];
}
