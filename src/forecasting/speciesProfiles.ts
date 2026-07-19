export interface SpeciesProfile {
  optimalLight: 'direct' | 'indirect' | 'low';
  optimalTemp: [number, number]; // [min, max] °C
  optimalHumidity: [number, number]; // [min, max] %
  waterFrequency: number; // days
  dormancyMonths: number[]; // 0-indexed: [11, 0, 1] is Dec, Jan, Feb
  soilType: 'well-draining' | 'moisture-retentive' | 'sandy' | 'loamy';
  sensitivity: string[];
  source: string;
  preferredPh?: number;
}

export const SPECIES_PROFILES: Record<string, SpeciesProfile> = {
  'Monstera deliciosa': {
    optimalLight: 'indirect',
    optimalTemp: [18, 30],
    optimalHumidity: [40, 65],
    waterFrequency: 7,
    dormancyMonths: [11, 0, 1],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'low_humidity'],
    source: 'RHS Plant Finder'
  },
  'Nephrolepis exaltata': {
    optimalLight: 'indirect',
    optimalTemp: [16, 24],
    optimalHumidity: [50, 80],
    waterFrequency: 4,
    dormancyMonths: [],
    soilType: 'moisture-retentive',
    sensitivity: ['dry_soil', 'low_humidity'],
    source: 'Missouri Botanical Garden'
  },
  'Ficus lyrata': {
    optimalLight: 'indirect',
    optimalTemp: [16, 24],
    optimalHumidity: [30, 65],
    waterFrequency: 10,
    dormancyMonths: [11, 0, 1],
    soilType: 'well-draining',
    sensitivity: ['drafts', 'overwatering', 'relocation'],
    source: 'University of Florida IFAS'
  },
  'Sansevieria trifasciata': {
    optimalLight: 'low',
    optimalTemp: [15, 29],
    optimalHumidity: [30, 50],
    waterFrequency: 14,
    dormancyMonths: [11, 0, 1],
    soilType: 'sandy',
    sensitivity: ['overwatering', 'frost'],
    source: 'RHS Plant Finder'
  },
  'Zamioculcas zamiifolia': {
    optimalLight: 'low',
    optimalTemp: [15, 26],
    optimalHumidity: [30, 50],
    waterFrequency: 14,
    dormancyMonths: [11, 0, 1],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'direct_sun'],
    source: 'Missouri Botanical Garden'
  },
  'Epipremnum aureum': {
    optimalLight: 'indirect',
    optimalTemp: [17, 30],
    optimalHumidity: [40, 60],
    waterFrequency: 7,
    dormancyMonths: [],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'low_light_etiolation'],
    source: 'RHS Plant Finder'
  },
  'Spathiphyllum': {
    optimalLight: 'indirect',
    optimalTemp: [18, 27],
    optimalHumidity: [50, 80],
    waterFrequency: 5,
    dormancyMonths: [],
    soilType: 'moisture-retentive',
    sensitivity: ['dry_soil', 'low_humidity', 'fluoride_tap_water'],
    source: 'University of Florida IFAS'
  },
  'Chlorophytum comosum': {
    optimalLight: 'indirect',
    optimalTemp: [13, 27],
    optimalHumidity: [40, 60],
    waterFrequency: 7,
    dormancyMonths: [],
    soilType: 'well-draining',
    sensitivity: ['tap_water_burn', 'root_bound'],
    source: 'RHS Plant Finder'
  },
  'Dracaena marginata': {
    optimalLight: 'indirect',
    optimalTemp: [18, 24],
    optimalHumidity: [30, 60],
    waterFrequency: 10,
    dormancyMonths: [11, 0, 1],
    soilType: 'well-draining',
    sensitivity: ['fluoride_tap_water', 'overwatering'],
    source: 'Missouri Botanical Garden'
  },
  'Calathea orbifolia': {
    optimalLight: 'indirect',
    optimalTemp: [18, 27],
    optimalHumidity: [50, 80],
    waterFrequency: 5,
    dormancyMonths: [],
    soilType: 'moisture-retentive',
    sensitivity: ['low_humidity', 'tap_water', 'direct_sun'],
    source: 'RHS Plant Finder'
  },
  'Alocasia amazonica': {
    optimalLight: 'indirect',
    optimalTemp: [18, 25],
    optimalHumidity: [60, 80],
    waterFrequency: 5,
    dormancyMonths: [11, 0, 1],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'low_humidity', 'spider_mites'],
    source: 'Missouri Botanical Garden'
  },
  'Hoya carnosa': {
    optimalLight: 'indirect',
    optimalTemp: [16, 26],
    optimalHumidity: [40, 60],
    waterFrequency: 10,
    dormancyMonths: [11, 0, 1],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'cold_roots'],
    source: 'University of Florida IFAS'
  },
  'Philodendron hederaceum': {
    optimalLight: 'indirect',
    optimalTemp: [16, 27],
    optimalHumidity: [40, 60],
    waterFrequency: 7,
    dormancyMonths: [],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'low_light'],
    source: 'RHS Plant Finder'
  },
  'Pilea peperomioides': {
    optimalLight: 'indirect',
    optimalTemp: [13, 24],
    optimalHumidity: [40, 60],
    waterFrequency: 7,
    dormancyMonths: [],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'low_light', 'leaf_drop_relocation'],
    source: 'Missouri Botanical Garden'
  },
  'Begonia maculata': {
    optimalLight: 'indirect',
    optimalTemp: [18, 24],
    optimalHumidity: [45, 65],
    waterFrequency: 5,
    dormancyMonths: [],
    soilType: 'well-draining',
    sensitivity: ['powdery_mildew', 'overwatering', 'direct_sun'],
    source: 'RHS Plant Finder'
  },
  'Strelitzia nicolai': {
    optimalLight: 'direct',
    optimalTemp: [18, 30],
    optimalHumidity: [30, 60],
    waterFrequency: 7,
    dormancyMonths: [],
    soilType: 'well-draining',
    sensitivity: ['low_light_no_bloom', 'overwatering'],
    source: 'University of Florida IFAS'
  },
  'Yucca elephantipes': {
    optimalLight: 'direct',
    optimalTemp: [15, 30],
    optimalHumidity: [20, 50],
    waterFrequency: 14,
    dormancyMonths: [11, 0, 1],
    soilType: 'sandy',
    sensitivity: ['overwatering', 'low_light_legginess'],
    source: 'RHS Plant Finder'
  },
  'Maranta leuconeura': {
    optimalLight: 'indirect',
    optimalTemp: [18, 27],
    optimalHumidity: [50, 80],
    waterFrequency: 5,
    dormancyMonths: [],
    soilType: 'moisture-retentive',
    sensitivity: ['low_humidity', 'tap_water', 'direct_sun'],
    source: 'Missouri Botanical Garden'
  },
  'Peperomia obtusifolia': {
    optimalLight: 'indirect',
    optimalTemp: [16, 24],
    optimalHumidity: [40, 60],
    waterFrequency: 10,
    dormancyMonths: [11, 0, 1],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'cold_drafts'],
    source: 'RHS Plant Finder'
  },
  'Schefflera arboricola': {
    optimalLight: 'indirect',
    optimalTemp: [15, 27],
    optimalHumidity: [40, 60],
    waterFrequency: 7,
    dormancyMonths: [],
    soilType: 'well-draining',
    sensitivity: ['overwatering', 'low_light', 'spider_mites'],
    source: 'University of Florida IFAS'
  }
};
