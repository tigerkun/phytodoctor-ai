// Global card game configuration and data
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const SPECIES_DIFFICULTY: Record<string, number> = {
  'Epipremnum aureum': 1,        // Common
  'Chlorophytum comosum': 1,
  'Sansevieria trifasciata': 1,
  'Monstera deliciosa': 2,       // Uncommon base
  'Ficus lyrata': 3,
  'Philodendron hederaceum': 2,
  'Spathiphyllum': 2,
  'Calathea orbifolia': 4,       // Epic base
  'Alocasia amazonica': 4,       // Epic base
  'Begonia maculata': 3,
  'Amorphophallus titanum': 5,   // Legendary base
};

export const MYTHIC_SPECIES = ['Rafflesia arnoldii', 'Welwitschia mirabilis'];

export interface RarityConfig {
  label: string;
  color: string;
  borderColor: string;
  shadow: string;
}

export const RARITY_CONFIGS: Record<RarityTier, RarityConfig> = {
  common: {
    label: 'Common',
    color: '#8B7355',
    borderColor: 'border-[#8B7355]',
    shadow: 'shadow-black/10'
  },
  uncommon: {
    label: 'Uncommon',
    color: '#A8A8A8',
    borderColor: 'border-[#A8A8A8]',
    shadow: 'shadow-[#A8A8A8]/30'
  },
  rare: {
    label: 'Rare',
    color: '#D4AF37',
    borderColor: 'border-[#D4AF37]',
    shadow: 'shadow-[#D4AF37]/40'
  },
  epic: {
    label: 'Epic',
    color: '#9D4EDD',
    borderColor: 'border-transparent',
    shadow: 'shadow-purple-500/50'
  },
  legendary: {
    label: 'Legendary',
    color: '#FFD700',
    borderColor: 'border-transparent',
    shadow: 'shadow-white/30'
  },
  mythic: {
    label: 'Mythic',
    color: '#FFD700',
    borderColor: 'border-[#FFD700]',
    shadow: 'shadow-[#FFD700]/60'
  }
};
