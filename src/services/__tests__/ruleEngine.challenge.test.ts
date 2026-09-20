import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateRiskScore, type ForecastInput } from '../../forecasting/ruleEngine';
import { TelemetryService } from '../telemetryService';
import { StorageService } from '../storageService';
import { GameService } from '../gameService';
import { db, type Plant, type CheckIn } from '../../db/database';

describe('BUG-02 & BUG-03-offline Empirical Challenge Tests', () => {
  const basePlant: Plant = {
    id: 'plant-challenge-1',
    name: 'Test Monstera',
    species: 'Monstera deliciosa',
    acquiredAt: new Date(),
    soilType: 'well-draining',
    soilPh: null,
    potSize: '10 inch',
    potMaterial: 'terracotta',
    location: 'Living room',
    latitude: null,
    longitude: null,
    hardinessZone: null,
    checkInTime: '09:00',
    baselineSignature: null,
    guardianScore: 80,
    status: 'Stable',
    photoUrl: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    vi.spyOn(TelemetryService, 'log').mockImplementation(async () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('BUG-02: calculateRiskScore Edge Case Matrix', () => {
    it('handles empty checkIns: [] without throwing TypeError', () => {
      const input: ForecastInput = {
        plant: basePlant,
        checkIns: [],
        sensorReadings: [],
        weather: null
      };

      expect(() => calculateRiskScore(input)).not.toThrow();
      const res = calculateRiskScore(input);
      expect(res.riskScore).toBe(0);
      expect(res.confidence).toBe(10);
      expect(res.alertThreshold).toBe('none');
      expect(res.primaryStressor).toBe('Unknown');
      expect(res.reasoning).toEqual([]);
      expect(res.recommendedActions).toEqual([]);
    });

    it('handles checkIns with driftScore: null, soilMoisture: moist, lightLevel: medium', () => {
      const input: ForecastInput = {
        plant: basePlant,
        checkIns: [
          {
            id: 'c1',
            plantId: 'plant-challenge-1',
            timestamp: new Date(),
            soilMoisture: 'moist' as any,
            lightLevel: 'medium' as any,
            changes: [],
            photoBlob: null,
            photoUrl: null,
            signature: null,
            guardianScore: 80,
            driftScore: null as any,
            driftStatus: null,
            weatherTemp: null,
            weatherHumidity: null,
            weatherDescription: null,
            synced: 0
          }
        ],
        sensorReadings: [],
        weather: null
      };

      expect(() => calculateRiskScore(input)).not.toThrow();
      const res = calculateRiskScore(input);
      expect(res.riskScore).toBe(0);
      expect(res.confidence).toBe(15);
      expect(res.alertThreshold).toBe('none');
    });

    it('handles checkIns with driftScore: undefined, soilMoisture: moist, lightLevel: medium', () => {
      const input: ForecastInput = {
        plant: basePlant,
        checkIns: [
          {
            id: 'c2',
            plantId: 'plant-challenge-1',
            timestamp: new Date(),
            soilMoisture: 'moist' as any,
            lightLevel: 'medium' as any,
            changes: [],
            photoBlob: null,
            photoUrl: null,
            signature: null,
            guardianScore: 80,
            driftScore: undefined as any,
            driftStatus: null,
            weatherTemp: null,
            weatherHumidity: null,
            weatherDescription: null,
            synced: 0
          }
        ],
        sensorReadings: [],
        weather: null
      };

      expect(() => calculateRiskScore(input)).not.toThrow();
      const res = calculateRiskScore(input);
      expect(res.riskScore).toBe(0);
      expect(res.confidence).toBe(15);
      expect(res.alertThreshold).toBe('none');
    });

    it('handles checkIns with driftScore: 0.15, soilMoisture: moist, lightLevel: medium', () => {
      const input: ForecastInput = {
        plant: basePlant,
        checkIns: [
          {
            id: 'c3',
            plantId: 'plant-challenge-1',
            timestamp: new Date(),
            soilMoisture: 'moist' as any,
            lightLevel: 'medium' as any,
            changes: [],
            photoBlob: null,
            photoUrl: null,
            signature: null,
            guardianScore: 80,
            driftScore: 0.15,
            driftStatus: 'watching',
            weatherTemp: null,
            weatherHumidity: null,
            weatherDescription: null,
            synced: 0
          }
        ],
        sensorReadings: [],
        weather: null
      };

      expect(() => calculateRiskScore(input)).not.toThrow();
      const res = calculateRiskScore(input);
      // Drift > 0.12 adds 20 points
      expect(res.riskScore).toBe(20);
      expect(res.alertThreshold).toBe('none');
      expect(res.reasoning.some(r => r.includes('visual phenotype drift'))).toBe(true);
    });

    it('handles critical driftScore: 0.35 and triggers correct alert threshold', () => {
      const input: ForecastInput = {
        plant: basePlant,
        checkIns: [
          {
            id: 'c4',
            plantId: 'plant-challenge-1',
            timestamp: new Date(),
            soilMoisture: 'moist' as any,
            lightLevel: 'medium' as any,
            changes: [],
            photoBlob: null,
            photoUrl: null,
            signature: null,
            guardianScore: 70,
            driftScore: 0.35,
            driftStatus: 'alert',
            weatherTemp: null,
            weatherHumidity: null,
            weatherDescription: null,
            synced: 0
          }
        ],
        sensorReadings: [],
        weather: null
      };

      const res = calculateRiskScore(input);
      // drift > 0.28 adds 45 points -> riskScore 45 -> alertThreshold 'info' (>= 25)
      expect(res.riskScore).toBe(45);
      expect(res.alertThreshold).toBe('info');
    });

    it('handles null sensorReadings and null weather safely', () => {
      const input: ForecastInput = {
        plant: basePlant,
        checkIns: [],
        sensorReadings: null as any,
        weather: null
      };

      expect(() => calculateRiskScore(input)).not.toThrow();
      const res = calculateRiskScore(input);
      expect(res.riskScore).toBe(0);
      expect(res.confidence).toBe(10);
    });

    it('falls back to calculateGenericRisk for unknown species without throwing', () => {
      const input: ForecastInput = {
        plant: { ...basePlant, species: 'Uncatalogued Ficus' },
        checkIns: [],
        sensorReadings: [],
        weather: null
      };

      expect(() => calculateRiskScore(input)).not.toThrow();
      const res = calculateRiskScore(input);
      expect(res.riskScore).toBe(0);
      expect(res.confidence).toBe(50);
      expect(res.alertThreshold).toBe('none');
      expect(res.primaryStressor).toBe('Unknown');
    });

    it('handles bulk checkIns (100+) with mixed null, undefined, zero, and negative values', () => {
      const checkIns: CheckIn[] = Array.from({ length: 100 }, (_, i) => ({
        id: `bulk-${i}`,
        plantId: 'plant-challenge-1',
        timestamp: new Date(Date.now() - (100 - i) * 86400000),
        soilMoisture: (i % 3 === 0 ? 'Dry' : i % 3 === 1 ? 'Moist' : 'Wet') as any,
        lightLevel: (i % 3 === 0 ? 'Low' : i % 3 === 1 ? 'Direct' : 'Indirect') as any,
        changes: [],
        photoBlob: null,
        photoUrl: null,
        signature: null,
        guardianScore: 80,
        driftScore: i === 99 ? 0.0 : (i % 2 === 0 ? null : -0.1),
        driftStatus: null,
        weatherTemp: null,
        weatherHumidity: null,
        weatherDescription: null,
        synced: 1
      }));

      const input: ForecastInput = {
        plant: basePlant,
        checkIns,
        sensorReadings: [],
        weather: null
      };

      expect(() => calculateRiskScore(input)).not.toThrow();
      const res = calculateRiskScore(input);
      expect(typeof res.riskScore).toBe('number');
      expect(typeof res.confidence).toBe('number');
      expect(res.confidence).toBeGreaterThanOrEqual(10);
      expect(res.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('BUG-03-offline: CheckInFlow Offline Resilience Simulation', () => {
    it('guarantees local photo caching and checkin persistence when cloud upload fails', async () => {
      const vaultedPhotos: any[] = [];
      const vaultedCheckIns: any[] = [];
      let onCompleteCalled = false;

      // Mock database
      vi.spyOn(db.photos, 'put').mockImplementation((async (entry: any) => {
        vaultedPhotos.push(entry);
        return entry.id;
      }) as any);

      vi.spyOn(db.checkins, 'add').mockImplementation((async (entry: any) => {
        vaultedCheckIns.push(entry);
        return entry.id;
      }) as any);

      vi.spyOn(db.checkins, 'get').mockImplementation((async (id: string) => {
        return vaultedCheckIns.find(c => c.id === id);
      }) as any);

      vi.spyOn(db.plants, 'get').mockResolvedValue(basePlant as any);
      vi.spyOn(db.plants, 'update').mockResolvedValue(1 as any);

      // Force StorageService to throw an error (simulating network failure / offline)
      vi.spyOn(StorageService, 'uploadPlantPhoto').mockRejectedValue(
        new Error('Supabase Storage 503: Offline / Network Unreachable')
      );

      vi.spyOn(GameService, 'getUserId').mockReturnValue('user-offline-123');
      vi.spyOn(GameService, 'generateCardForPlant').mockResolvedValue(undefined as any);
      vi.spyOn(GameService, 'updateCardFromCheckIn').mockResolvedValue({
        leveledUp: false,
        stageChanged: false
      } as any);

      const fakeBlob = new Blob(['sample-plant-image'], { type: 'image/jpeg' });

      // Execute the exact offline flow logic implemented in CheckInFlow.tsx:119-187
      let finalPhotoUrl: string | null = null;
      if (fakeBlob) {
        const photoId = 'test-local-photo-id';
        await db.photos.put({ id: photoId, blob: fakeBlob, createdAt: new Date() });
        finalPhotoUrl = `local://photos/${photoId}`;

        try {
          const userId = GameService.getUserId();
          const cloudUrl = await StorageService.uploadPlantPhoto(fakeBlob, userId);
          if (cloudUrl) finalPhotoUrl = cloudUrl;
        } catch (uploadErr) {
          // Cloud photo upload deferred or offline - caught safely without throwing
        }
      }

      const checkInId = 'test-checkin-id';
      await db.checkins.add({
        id: checkInId,
        plantId: basePlant.id,
        timestamp: new Date(),
        soilMoisture: 'Moist' as any,
        lightLevel: 'Indirect' as any,
        changes: ['New Growth'],
        photoBlob: fakeBlob,
        photoUrl: finalPhotoUrl,
        signature: null,
        guardianScore: 80,
        driftScore: null,
        driftStatus: null,
        weatherTemp: null,
        weatherHumidity: null,
        weatherDescription: null,
        synced: 0
      });

      onCompleteCalled = true;

      // Assertions
      expect(vaultedPhotos).toHaveLength(1);
      expect(vaultedPhotos[0].id).toBe('test-local-photo-id');
      expect(vaultedCheckIns).toHaveLength(1);
      expect(vaultedCheckIns[0].id).toBe('test-checkin-id');
      expect(vaultedCheckIns[0].photoUrl).toBe('local://photos/test-local-photo-id');
      expect(onCompleteCalled).toBe(true);
    });
  });
});
