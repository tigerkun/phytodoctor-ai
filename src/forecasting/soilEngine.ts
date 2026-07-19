import { SPECIES_PROFILES } from './speciesProfiles';

export interface SoilRecommendation {
  mixName: string;
  components: { name: string; percentage: number }[];
  reasoning: string[];
  phTarget: number;
}

export class SoilEngine {
  static getRecommendation(
    species: string,
    climateType: 'humid' | 'dry' | 'temperate' = 'temperate',
    potMaterial: 'terracotta' | 'plastic' | 'ceramic' | 'fabric' = 'plastic',
    experienceLevel: 'beginner' | 'intermediate' | 'expert' = 'beginner'
  ): SoilRecommendation {
    const profile = SPECIES_PROFILES[species];
    
    // Default base components
    let components = [
      { name: 'Potting Soil', percentage: 50 },
      { name: 'Perlite', percentage: 30 },
      { name: 'Coco Peat', percentage: 20 }
    ];
    
    const reasoning: string[] = [];
    const phTarget = profile?.preferredPh || 6.5;

    // Rule 1: Species Sensitivity
    if (profile?.sensitivity.includes('overwatering')) {
      components = [
        { name: 'Orchid Bark', percentage: 30 },
        { name: 'Perlite', percentage: 40 },
        { name: 'Coco Coir', percentage: 30 }
      ];
      reasoning.push(`High drainage mix for ${species} to prevent root rot.`);
    }

    // Rule 2: Climate Adjustment
    if (climateType === 'dry') {
      // Increase moisture retention
      components.forEach(c => {
        if (c.name === 'Coco Coir' || c.name === 'Coco Peat' || c.name === 'Potting Soil') c.percentage += 10;
        if (c.name === 'Perlite' || c.name === 'Orchid Bark') c.percentage -= 5;
      });
      reasoning.push('Increased moisture retention for dry climate.');
    } else if (climateType === 'humid') {
      // Increase aeriation
      components.forEach(c => {
        if (c.name === 'Perlite' || c.name === 'Orchid Bark' || c.name === 'Pumice') c.percentage += 10;
        if (c.name === 'Potting Soil') c.percentage -= 10;
      });
      reasoning.push('Extra aeration added for humid environment.');
    }

    // Rule 3: Pot Material
    if (potMaterial === 'terracotta') {
      // Terracotta wicks moisture, need more retention
      const peat = components.find(c => c.name.includes('Peat') || c.name.includes('Coir'));
      if (peat) peat.percentage += 10;
      reasoning.push('Compensating for moisture wicking of terracotta.');
    }

    // Rule 4: User Experience
    if (experienceLevel === 'beginner') {
      components.push({ name: 'Worm Castings', percentage: 5 }); // Gentle fertilizer
      reasoning.push('Added worm castings for organic, slow-release nutrition.');
    }

    // Normalize to 100%
    const total = components.reduce((sum, c) => sum + c.percentage, 0);
    components = components.map(c => ({
      ...c,
      percentage: Math.round((c.percentage / total) * 100)
    }));

    return {
      mixName: `${species} Custom GuardMix`,
      components,
      reasoning,
      phTarget
    };
  }
}
