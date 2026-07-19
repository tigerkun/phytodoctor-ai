import { db, type Plant, type CheckIn, type PhytoCard, type UserGameProfile } from '../db/database';
import { GameService } from '../services/gameService';

export const DEMO_PROFILES = {
  arjun: {
    userId: 'demo-arjun',
    username: 'Arjun',
    seeds: 1240,
    currentStreak: 45,
    longestStreak: 45,
    collectionSize: 4,
    totalXP: 4500,
    discoveredSpecies: ['Monstera deliciosa', 'Sansevieria trifasciata', 'Spathiphyllum', 'Epipremnum aureum'],
    plants: [
      {
        name: 'Big Mama',
        species: 'Monstera deliciosa',
        days: 87,
        health: 94,
        level: 23,
        status: 'Stable' as const,
        photoUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=800&auto=format&fit=crop'
      },
      {
        name: 'Ziggy',
        species: 'Sansevieria trifasciata',
        days: 60,
        health: 97,
        level: 15,
        status: 'Stable' as const,
        photoUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=800&auto=format&fit=crop'
      },
      {
        name: 'Lily',
        species: 'Spathiphyllum',
        days: 45,
        health: 88,
        level: 12,
        status: 'Stable' as const,
        photoUrl: 'https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=800&auto=format&fit=crop'
      },
      {
        name: 'Cascadia',
        species: 'Epipremnum aureum',
        days: 30,
        health: 92,
        level: 8,
        status: 'Stable' as const,
        photoUrl: 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=800&auto=format&fit=crop'
      }
    ]
  },
  priya: {
    userId: 'demo-priya',
    username: 'Priya',
    seeds: 2500,
    currentStreak: 12,
    longestStreak: 30,
    collectionSize: 3,
    totalXP: 8000,
    discoveredSpecies: ['Calathea orbifolia', 'Alocasia amazonica', 'Strelitzia nicolai'],
    plants: [
      {
        name: 'Silver Queen',
        species: 'Calathea orbifolia',
        days: 90,
        health: 98,
        level: 31,
        status: 'Stable' as const,
        photoUrl: 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?q=80&w=800&auto=format&fit=crop'
      },
      {
        name: 'Alocasia',
        species: 'Alocasia amazonica',
        days: 45,
        health: 72,
        level: 28,
        status: 'Recovering' as const,
        photoUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=800&auto=format&fit=crop'
      },
      {
        name: 'Birdie',
        species: 'Strelitzia nicolai',
        days: 120,
        health: 95,
        level: 35,
        status: 'Stable' as const,
        photoUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=800&auto=format&fit=crop'
      }
    ]
  },
  rahul: {
    userId: 'demo-rahul',
    username: 'Rahul',
    seeds: 300,
    currentStreak: 14,
    longestStreak: 14,
    collectionSize: 2,
    totalXP: 1200,
    discoveredSpecies: ['Nephrolepis exaltata', 'Ficus lyrata'],
    plants: [
      {
        name: 'Fernie',
        species: 'Nephrolepis exaltata',
        days: 40,
        health: 82,
        level: 5,
        status: 'Recovering' as const,
        photoUrl: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=800&auto=format&fit=crop'
      },
      {
        name: 'Figgy',
        species: 'Ficus lyrata',
        days: 20,
        health: 65,
        level: 3,
        status: 'Watching' as const,
        photoUrl: 'https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?q=80&w=800&auto=format&fit=crop'
      }
    ]
  }
};

export async function seedDemoGarden(profileKey: keyof typeof DEMO_PROFILES, realUserId?: string) {
  const profileData = DEMO_PROFILES[profileKey];
  const userId = realUserId ?? profileData.userId;

  
  // Seed User Profile
  const storedName = localStorage.getItem('botanical_guardian_user_name') || profileData.username;
  await db.userProfile.put({
    userId,
    username: storedName,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${storedName}`,
    equippedTitle: profileKey === 'priya' ? 'Rarity Hunter' : profileKey === 'arjun' ? 'Consistent Caretaker' : 'The Comeback Kid',
    seeds: profileData.seeds,
    currentStreak: profileData.currentStreak,
    longestStreak: profileData.longestStreak,
    collectionSize: profileData.collectionSize,
    totalXP: profileData.totalXP,
    tier: 'free',
    discoveredSpecies: profileData.discoveredSpecies,
    isDemo: true
  });

  for (const p of profileData.plants) {
    const plantId = crypto.randomUUID();
    const acquiredAt = new Date(Date.now() - p.days * 86400000);
    
    const plant: Plant = {
      id: plantId,
      userId,
      name: p.name,
      species: p.species,
      acquiredAt,
      soilType: 'loamy',
      soilPh: 6.5,
      potSize: '10 inch',
      potMaterial: 'plastic',
      location: 'Demo Garden',
      latitude: null,
      longitude: null,
      hardinessZone: null,
      checkInTime: '09:00',
      baselineSignature: null,
      guardianScore: p.health,
      status: p.status,
      photoUrl: p.photoUrl,
      createdAt: acquiredAt,
      updatedAt: new Date(),
      isDemo: true
    };

    await db.plants.add(plant);
    
    // Create card with specific level/stats
    await db.cards.add({
        id: crypto.randomUUID(),
        userId,
        plantId,
        species: p.species,
        commonName: p.name,
        rarity: p.level > 30 ? 'epic' : p.level > 20 ? 'rare' : 'uncommon',
        growthStage: p.days > 80 ? 'ancient' : p.days > 50 ? 'mature' : 'juvenile',
        stats: {
          attack: 10 + Math.floor(Math.random() * 20),
          defense: 10 + Math.floor(Math.random() * 20),
          health: p.health,
          speed: 10 + Math.floor(Math.random() * 10),
          longevity: p.days
        },
        level: p.level,
        xp: 0,
        xpToNext: 100,
        abilityUnlocked: p.level > 10,
        acquiredAt,
        daysAlive: p.days,
        checkInsTotal: Math.floor(p.days * 0.8),
        checkInsHealthy: Math.floor(p.days * 0.7),
        alertsSurvived: Math.floor(p.days / 30),
        currentStreak: profileData.currentStreak,
        longestStreak: profileData.longestStreak,
        isFavorite: false,
        isFeatured: p.level > 30,
        admirations: Math.floor(Math.random() * 50),
        battleScars: p.status === 'Recovering' ? ['Root Rot Recovery'] : [],
        frameSkin: null,
        altArt: null,
        isDemo: true
    });

    // Seed some check-ins
    const checkInCount = Math.min(10, p.days);
    for (let i = 0; i < checkInCount; i++) {
        const ts = new Date();
        ts.setDate(ts.getDate() - i);
        await db.checkins.add({
            id: crypto.randomUUID(),
            plantId,
            timestamp: ts,
            soilMoisture: 'Moist',
            lightLevel: 'Indirect',
            changes: ['none'],
            photoBlob: null,
            photoUrl: p.photoUrl,
            signature: null,
            guardianScore: p.health - 5 + Math.floor(Math.random() * 10),
            driftScore: 0.02,
            driftStatus: 'stable',
            weatherTemp: 24,
            weatherHumidity: 55,
            weatherDescription: 'clear',
            synced: 1,
            isDemo: true
        });
    }
  }

  // Auth.tsx already sets localStorage keys — nothing to do here
}

export async function clearDemoData() {
  const demoUserIds = Object.values(DEMO_PROFILES).map(p => p.userId);
  
  await db.userProfile.where('userId').anyOf(demoUserIds).delete();
  await db.plants.where('isDemo').equals(1 as any).delete(); // indexing might need update if I added it to schema
  await db.cards.where('isDemo').equals(1 as any).delete();
  await db.checkins.where('isDemo').equals(1 as any).delete();
  
  localStorage.removeItem('botanical_guardian_demo_mode');
  localStorage.removeItem('botanical_guardian_userId'); // Reset to default or empty
}
