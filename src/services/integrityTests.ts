import { db } from '../db/database';
import { GameService } from './gameService';
import { ECONOMY_CONFIG } from '../game/ECONOMY_DATA';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export class IntegrityTestSuite {
  static async runAll(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    // Test 1: Seed Exploit Registry
    try {
      const species = 'Test Monstera ' + Math.random();
      const userId = 'user-123';
      
      // Cleanup first
      await db.userProfile.delete(userId);
      await db.plants.where('userId').equals(userId).delete();
      await db.cards.where('userId').equals(userId).delete();
      
      await db.userProfile.add({
        userId: userId,
        username: 'Test User',
        avatarUrl: '',
        equippedTitle: null,
        seeds: 500,
        currentStreak: 0,
        longestStreak: 0,
        collectionSize: 0,
        totalXP: 0,
        tier: 'free',
        discoveredSpecies: []
      });

      // First discovery
      const mockPlant = { 
        id: 'p1', 
        species, 
        userId, 
        name: 'P1', 
        createdAt: new Date(), 
        acquiredAt: new Date(), 
        updatedAt: new Date(),
        status: 'Stable',
        guardianScore: 90
      } as any;
      await db.plants.add(mockPlant);
      await GameService.generateCardForPlant(mockPlant.id, userId);
      const profile1 = await db.userProfile.get(userId);
      const seeds1 = profile1?.seeds || 0;
      
      // Second discovery of SAME species
      const mockPlant2 = { 
        id: 'p2', 
        species, 
        userId, 
        name: 'P2', 
        createdAt: new Date(), 
        acquiredAt: new Date(), 
        updatedAt: new Date(),
        status: 'Stable',
        guardianScore: 90
      } as any;
      await db.plants.add(mockPlant2);
      await GameService.generateCardForPlant(mockPlant2.id, userId);
      const profile2 = await db.userProfile.get(userId);
      const seeds2 = profile2?.seeds || 0;

      const expectedSeeds = 500 + ECONOMY_CONFIG.EARNING_BASE.new_plant;
      results.push({
        name: 'Seed Discovery Exploit',
        passed: seeds1 === expectedSeeds && seeds2 === expectedSeeds,
        message: 'Registry correctly blocked duplicate discovery bonus.'
      });
    } catch (e) {
      results.push({ name: 'Seed Discovery Exploit', passed: false, message: String(e) });
    }

    // Test 2: XP Daily Cap
    try {
      const plantId = 'xp-test-plant';
      const todayDate = new Date();
      const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
      
      // Cleanup
      await db.xpLog.where('plantId').equals(plantId).delete();
      await db.plants.delete(plantId);
      await db.cards.where('plantId').equals(plantId).delete();
      
      const mockPlant = {
        id: plantId,
        species: 'Monstera Deliciosa',
        userId: 'local_user',
        name: 'XP Test Plant',
        createdAt: new Date(),
        acquiredAt: new Date(),
        updatedAt: new Date(),
        status: 'Stable',
        guardianScore: 90
      } as any;
      await db.plants.add(mockPlant);
      
      const checkIn1 = { id: 'c1', guardianScore: 90, photoBlob: new Blob() } as any;
      const checkIn2 = { id: 'c2', guardianScore: 95, photoBlob: new Blob() } as any;

      await GameService.updateCardFromCheckIn(plantId, checkIn1);
      const count1 = await db.xpLog.where('[plantId+date]').equals([plantId, today]).count();
      
      await GameService.updateCardFromCheckIn(plantId, checkIn2);
      const count2 = await db.xpLog.where('[plantId+date]').equals([plantId, today]).count();

      results.push({
        name: 'Daily XP Throttle',
        passed: count1 === 1 && count2 === 1,
        message: 'Composite index [plantId+date] prevented XP double-dipping.'
      });
    } catch (e) {
      results.push({ name: 'Daily XP Throttle', passed: false, message: String(e) });
    }

    return results;
  }
}
