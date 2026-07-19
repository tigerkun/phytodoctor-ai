export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'frame' | 'theme' | 'flair' | 'particle';
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  isProOnly?: boolean;
}

export const SEED_MULTIPLIERS = {
  free: 1.0,
  pro: 1.5,
};

export const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  // Frames
  {
    id: 'frame-sage-glow',
    name: 'Sage Glow Border',
    description: 'A gentle green radiance for your most prized plant.',
    price: 15000,
    type: 'frame',
    rarity: 'common'
  },
  {
    id: 'frame-shimmer-gold',
    name: 'Gilded Shimmer',
    description: 'An animated golden frame that catches the light.',
    price: 75000,
    type: 'frame',
    rarity: 'rare'
  },
  {
    id: 'frame-holographic',
    name: 'Holographic Pulse',
    description: 'Iridescent shifting colors with light particles.',
    price: 250000,
    type: 'frame',
    rarity: 'epic',
    isProOnly: true
  },
  
  // Themes
  {
    id: 'theme-misty-jungle',
    name: 'Misty Jungle',
    description: 'A deep, humid tropical canopy background.',
    price: 120000,
    type: 'theme',
    rarity: 'rare'
  },
  {
    id: 'theme-lunar-garden',
    name: 'Lunar Sanctuary',
    description: 'Bask in the ethereal glow of a midnight moon.',
    price: 500000,
    type: 'theme',
    rarity: 'epic',
    isProOnly: true
  },
  {
    id: 'theme-cyberpunk-neon',
    name: 'Neon Greenhouse',
    description: 'Plants thrive under artificial violet suns.',
    price: 1250000,
    type: 'theme',
    rarity: 'legendary',
    isProOnly: true
  },

  // Flairs
  {
    id: 'flair-expert-care',
    name: 'Expert Care Badge',
    description: 'A mark of distinction on your public profile.',
    price: 25000,
    type: 'flair',
    rarity: 'common'
  },
  {
    id: 'flair-propagation-king',
    name: 'Propagator Crown',
    description: 'For those who turn one plant into many.',
    price: 100000,
    type: 'flair',
    rarity: 'rare'
  }
];

export const ECONOMY_CONFIG = {
  EARNING_BASE: {
    checkin: 25,
    perfect_checkin: 25, // bonus for >95% score
    streak_7: 500,
    new_plant: 1000,
    alert_resolved: 150,
    arena_win: 250
  },
  CONVENIENCE_COSTS: {
    propagation_basic: 25000,
    time_warp: 50000, // pro only
    stat_reshuffle: 75000, // pro only
    name_change: 15000,
    revival_memorial: 150000
  },
  SPENDING: {
    marketplace: 0 // placeholder
  }
};
