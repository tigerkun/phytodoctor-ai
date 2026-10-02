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
    price: 1200,
    // Prices below were minted for a 2000+/day economy; at the 400/day
    // ceiling the old numbers took years to reach. Rebalanced so the shop is
    // a weekly-goal sink rather than a museum.
    type: 'frame',
    rarity: 'common'
  },
  {
    id: 'frame-shimmer-gold',
    name: 'Gilded Shimmer',
    description: 'An animated golden frame that catches the light.',
    price: 4500,
    type: 'frame',
    rarity: 'rare'
  },
  {
    id: 'frame-holographic',
    name: 'Holographic Pulse',
    description: 'Iridescent shifting colors with light particles.',
    price: 15000,
    type: 'frame',
    rarity: 'epic',
    isProOnly: true
  },
  
  // Themes
  {
    id: 'theme-misty-jungle',
    name: 'Misty Jungle',
    description: 'A deep, humid tropical canopy background.',
    price: 6000,
    type: 'theme',
    rarity: 'rare'
  },
  {
    id: 'theme-lunar-garden',
    name: 'Lunar Sanctuary',
    description: 'Bask in the ethereal glow of a midnight moon.',
    price: 18000,
    type: 'theme',
    rarity: 'epic',
    isProOnly: true
  },
  {
    id: 'theme-cyberpunk-neon',
    name: 'Neon Greenhouse',
    description: 'Plants thrive under artificial violet suns.',
    price: 45000,
    type: 'theme',
    rarity: 'legendary',
    isProOnly: true
  },

  // Flairs
  {
    id: 'flair-expert-care',
    name: 'Expert Care Badge',
    description: 'A mark of distinction on your public profile.',
    price: 800,
    type: 'flair',
    rarity: 'common'
  },
  {
    id: 'flair-propagation-king',
    name: 'Propagator Crown',
    description: 'For those who turn one plant into many.',
    price: 3000,
    type: 'flair',
    rarity: 'rare'
  }
];

export const ECONOMY_CONFIG = {
  EARNING_BASE: {
    checkin: 25,
    perfect_checkin: 25, // bonus for >95% score
    // Every single grant must fit inside increment_seeds' 400/day ceiling —
    // the server REJECTS any credit that would push the day over it, and a
    // rejected reward is a lost reward. new_plant paid 1000 and streak_7
    // paid 500: both larger than the ceiling itself, so both were refunded
    // as errors the moment the cap shipped.
    streak_7: 350,
    new_plant: 350,
    alert_resolved: 100,
    arena_win: 200
  },
  CONVENIENCE_COSTS: {
    // Rebalanced for the 400/day ceiling — propagation_basic at 25000 was a
    // 62-day grind for one attempt.
    propagation_basic: 2000,
    time_warp: 2500, // pro only
    stat_reshuffle: 3000, // pro only
    name_change: 500,
    revival_memorial: 10000
  },
  SPENDING: {
    marketplace: 0 // placeholder
  }
};
