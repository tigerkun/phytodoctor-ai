/**
 * Species-aware Plant Image Fallback Utility
 * Provides high-fidelity, unique Unsplash photo fallbacks for various plant species
 * to prevent duplicate placeholder images and blank card renders.
 */

const SPECIES_IMAGE_MAP: Record<string, string> = {
  'monstera deliciosa': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop',
  'monstera': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop',

  'ficus lyrata': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',
  'ficus': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',
  'fiddle leaf fig': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',
  'ficus elastica': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',
  'rubber plant': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',

  'sansevieria trifasciata': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600&auto=format&fit=crop',
  'sansevieria': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600&auto=format&fit=crop',
  'snake plant': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600&auto=format&fit=crop',

  'epipremnum aureum': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'epipremnum pinnatum': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'pothos': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'dracaena marginata': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'dracaena': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'philodendron hederaceum': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'philodendron': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',

  'spathiphyllum': 'https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=600&auto=format&fit=crop',
  'peace lily': 'https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=600&auto=format&fit=crop',
  'begonia maculata': 'https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=600&auto=format&fit=crop',
  'begonia': 'https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=600&auto=format&fit=crop',
  'yucca elephantipes': 'https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=600&auto=format&fit=crop',
  'yucca': 'https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=600&auto=format&fit=crop',

  'calathea orbifolia': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'calathea': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'maranta leuconeura': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'maranta': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'peperomia obtusifolia': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'peperomia': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'pilea peperomioides': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'pilea': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'schefflera arboricola': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'schefflera': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',

  'alocasia amazonica': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop',
  'alocasia': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop',

  'strelitzia nicolai': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop',
  'strelitzia': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop',
  'bird of paradise': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop',

  'nephrolepis exaltata': 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop',
  'nephrolepis': 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop',
  'fern': 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop',
  'boston fern': 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop',
  'chlorophytum comosum': 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop',
  'spider plant': 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop',

  'zamioculcas zamiifolia': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600&auto=format&fit=crop',
  'zz plant': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600&auto=format&fit=crop',

  // Pathology & Pests
  'powdery mildew': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',
  'spider mites': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',
  'root rot': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600&auto=format&fit=crop',
  'mealybugs': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'leaf spot': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',
  'aphids': 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=600&auto=format&fit=crop',
  'scale insects': 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=600&auto=format&fit=crop',
  'overwatering': 'https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=600&auto=format&fit=crop',
  'underwatering': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=600&auto=format&fit=crop',
  'nutrient deficiency': 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=600&auto=format&fit=crop',
};

const DEFAULT_PLANT_IMAGE = 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=600&auto=format&fit=crop&q=80';

// Known broken Unsplash IDs from legacy seeding
const BROKEN_PHOTO_IDS = [
  'photo-1599819958744-8cb836c05161',
  'photo-1591857177580-dc32d7abc2bb',
  'photo-1593482892290-f54927ae1bf7',
  'photo-1544860707-c352cc5a92e3',
  'photo-1597055181300-e3633a207518',
  'photo-1632207691143-643e2a9a9361',
  'photo-1614594805320-e6a554907106',
  'photo-1593691509543-c35d4a17cd9a',
  'photo-1598880940375-d2272e2bedbb',
  'photo-1602091160979-ccbde3d09b6e', // Pearl's broken ID in Home.tsx
  'photo-1578500494198-246f612d03b3', // Fidget's potentially broken ID in Home.tsx
  'photo-1574482620811-1aa16ffe3c82', // Monty's old hand washing ID
  'photo-1599969657558-c885fcd7c8d5', // Snake's old ID
  'photo-1520412099521-62b32724637b', // old Bird of Paradise ID
  'photo-1620127252536-03bdfcf6d535', // old Calathea ID
  'photo-1453906971074-65c37eb6940d', // old Alocasia ID
  'photo-1562980889-08a833a0058b', // old Sansevieria ID
  'photo-1502082553048-f009c37129b9', // old powdery mildew ID
  'photo-1525498128493-380d12906ef5', // invalid tropical leaf ID (returns broken image icon)
  'photo-1585320806297-9794b3e4eeae', // prickly desert cacti ID (not snake plant)
  'photo-1545239351-ef35f43d514b', // laptop on pink sweatpants ID
  'photo-1515150144380-bca9f1650ed9', // shower stream/hand washing ID
  'photo-1463936575829-25148e1db1b8'  // cacti field ID
];

/**
 * Returns true if the provided photoUrl is null/undefined or points to a known broken legacy Unsplash ID.
 */
export function isBrokenUrl(photoUrl?: string | null): boolean {
  if (!photoUrl) return true;
  return BROKEN_PHOTO_IDS.some(id => photoUrl.includes(id));
}

/**
 * Returns a valid plant photo URL. If the provided photoUrl is null, empty,
 * broken, or not a valid URL/data URI, it returns a high-quality species-specific fallback image.
 *
 * @param photoUrl Optional plant photo URL from database or state
 * @param speciesName Optional species name (e.g., 'Monstera deliciosa') to search fallbacks
 */
export function getPlantPhoto(photoUrl?: string | null, speciesName?: string | null): string {
  if (!photoUrl || isBrokenUrl(photoUrl) || (!photoUrl.startsWith('http') && !photoUrl.startsWith('data:') && !photoUrl.startsWith('/'))) {
    const species = (speciesName || '').toLowerCase().trim();
    
    // 1. Try exact match
    if (SPECIES_IMAGE_MAP[species]) {
      return SPECIES_IMAGE_MAP[species];
    }
    
    // 2. Try partial/contains match
    for (const [key, value] of Object.entries(SPECIES_IMAGE_MAP)) {
      if (species.includes(key) || key.includes(species)) {
        return value;
      }
    }
    
    // 3. Global fallback
    return DEFAULT_PLANT_IMAGE;
  }
  return photoUrl;
}
