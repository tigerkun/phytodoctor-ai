import { describe, it, expect, beforeEach } from 'vitest';
import { TreatmentService } from '../treatmentService';
import { db } from '../../db/database';

describe('TreatmentService unit and persistence tests', () => {
  beforeEach(async () => {
    TreatmentService.clearMemoryStore();
    try {
      if (typeof indexedDB !== 'undefined' && db.treatmentActions) {
        await db.treatmentActions.clear();
      }
    } catch {
      // test runner in-memory fallback
    }
  });

  describe('buildTargetKey', () => {
    it('generates consistent scoped key when plantId is present', () => {
      const key = TreatmentService.buildTargetKey({
        plantId: 'plant-uuid-123',
        phaseIndex: 0,
        phaseDay: 'Day 1-3',
        action: 'Flush substrate with clean rainwater',
      });
      expect(key).toBe('plant:plant-uuid-123:p0:day-1-3:flush-substrate-with-clean-rainwater');
    });

    it('generates scan-scoped key when plantId is absent but scanId is present', () => {
      const key = TreatmentService.buildTargetKey({
        scanId: 'scan-uuid-456',
        species: 'Monstera deliciosa',
        phaseIndex: 0,
        phaseDay: 'Day 1-3',
        action: 'Isolate specimen in high humidity tent',
      });
      expect(key).toBe('scan:scan-uuid-456:p0:day-1-3:isolate-specimen-in-high-humidity-tent');
    });

    it('generates specimen-scoped key when plantId and scanId are absent', () => {
      const key = TreatmentService.buildTargetKey({
        species: 'Monstera deliciosa',
        phaseIndex: 1,
        phaseDay: 'Day 7',
        action: 'Apply cold-pressed neem foliar emulsion',
      });
      expect(key).toBe('specimen:monstera-deliciosa:p1:day-7:apply-cold-pressed-neem-foliar-emulsion');
    });

    it('handles missing or empty string fields safely', () => {
      const key = TreatmentService.buildTargetKey({
        phaseIndex: 2,
        phaseDay: '',
        action: '',
      });
      expect(key).toBe('specimen:botanical:p2:phase-3:action');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns empty string for null, undefined, or empty inputs', () => {
      expect(TreatmentService.formatRelativeTime(null)).toBe('');
      expect(TreatmentService.formatRelativeTime(undefined)).toBe('');
      expect(TreatmentService.formatRelativeTime('')).toBe('');
      expect(TreatmentService.formatRelativeTime('invalid-date')).toBe('');
    });

    it('formats recent events as "Applied just now"', () => {
      const justNow = new Date(Date.now() - 10_000).toISOString();
      expect(TreatmentService.formatRelativeTime(justNow)).toBe('Applied just now');
    });

    it('formats events within the hour as minutes ago', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
      expect(TreatmentService.formatRelativeTime(tenMinutesAgo)).toBe('Applied 10m ago');
    });

    it('formats events within 24 hours as hours ago', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600_000).toISOString();
      expect(TreatmentService.formatRelativeTime(threeHoursAgo)).toBe('Applied 3h ago');
    });

    it('formats events around 1 day ago as yesterday', () => {
      const yesterday = new Date(Date.now() - 26 * 3600_000).toISOString();
      expect(TreatmentService.formatRelativeTime(yesterday)).toBe('Applied yesterday');
    });

    it('formats events within a week as days ago', () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString();
      expect(TreatmentService.formatRelativeTime(fourDaysAgo)).toBe('Applied 4d ago');
    });
  });

  describe('calculateAdherence', () => {
    it('calculates 0% adherence when no steps are completed', () => {
      const metrics = TreatmentService.calculateAdherence(0, 3);
      expect(metrics.adherencePct).toBe(0);
      expect(metrics.stageLabel).toBe('Stage 0 · Regimen Pending');
      expect(metrics.isFullyCompleted).toBe(false);
      expect(metrics.vitalityDelta).toBe(0);
    });

    it('calculates partial adherence with stage 1 or stage 2 indicators', () => {
      const stage1 = TreatmentService.calculateAdherence(1, 4);
      expect(stage1.adherencePct).toBe(25);
      expect(stage1.stageLabel).toBe('Stage 1 · Active Rehabilitation');
      expect(stage1.vitalityDelta).toBe(3);

      const stage2 = TreatmentService.calculateAdherence(2, 3);
      expect(stage2.adherencePct).toBe(67);
      expect(stage2.stageLabel).toBe('Stage 2 · High Clinical Adherence');
      expect(stage2.vitalityDelta).toBe(8);
    });

    it('calculates 100% adherence and full completion when all steps are done', () => {
      const completed = TreatmentService.calculateAdherence(3, 3);
      expect(completed.adherencePct).toBe(100);
      expect(completed.stageLabel).toBe('Stage 3 · Regimen Complete · Recovery Optimal');
      expect(completed.isFullyCompleted).toBe(true);
      expect(completed.vitalityDelta).toBe(12);
    });

    it('defends against division by zero and negative inputs', () => {
      const empty = TreatmentService.calculateAdherence(0, 0);
      expect(empty.adherencePct).toBe(0);
      expect(empty.isFullyCompleted).toBe(false);

      const clamped = TreatmentService.calculateAdherence(5, 3);
      expect(clamped.completedCount).toBe(3);
      expect(clamped.adherencePct).toBe(100);
    });
  });

  describe('toggleTreatmentAction & anti-spamming economics', () => {
    it('records completion timestamp, awards seeds and sets vitality bonus on first check', async () => {
      const result = await TreatmentService.toggleTreatmentAction({
        plantId: 'test-plant-1',
        species: 'Ficus elastica',
        diagnosis: 'Root stress',
        phaseIndex: 0,
        phaseDay: 'Day 1-3',
        action: 'Aerate soil surface with sterile probe',
        expectedOutcome: 'Facilitates gas exchange',
      });

      expect(result.isCompleted).toBe(true);
      expect(result.newlyAwarded).toBe(true);
      expect(result.seedsAwarded).toBe(15);
      expect(result.vitalityBoost).toBe(4);
      expect(result.record.completedAt).toBeTruthy();
      expect(result.record.vitalityBonusAwarded).toBe(true);
    });

    it('un-marks as completed when toggled again without duplicate reward', async () => {
      const actionParams = {
        plantId: 'test-plant-2',
        species: 'Monstera deliciosa',
        diagnosis: 'Chlorosis',
        phaseIndex: 1,
        phaseDay: 'Day 7',
        action: 'Calibrate light exposure',
      };

      // 1. Initial completion
      const first = await TreatmentService.toggleTreatmentAction(actionParams);
      expect(first.isCompleted).toBe(true);
      expect(first.newlyAwarded).toBe(true);
      expect(first.seedsAwarded).toBe(15);

      // 2. Un-mark
      const second = await TreatmentService.toggleTreatmentAction(actionParams);
      expect(second.isCompleted).toBe(false);
      expect(second.newlyAwarded).toBe(false);
      expect(second.seedsAwarded).toBe(0);

      // 3. Re-mark: should NOT grant free seeds again
      const third = await TreatmentService.toggleTreatmentAction(actionParams);
      expect(third.isCompleted).toBe(true);
      expect(third.newlyAwarded).toBe(false);
      expect(third.seedsAwarded).toBe(0);
      expect(third.vitalityBoost).toBe(0);
    });

    it('attaches and persists field observation notes', async () => {
      const targetKey = TreatmentService.buildTargetKey({
        plantId: 'test-plant-3',
        phaseIndex: 0,
        phaseDay: 'Day 1',
        action: 'Prune dead tips',
      });

      await TreatmentService.toggleTreatmentAction({
        plantId: 'test-plant-3',
        phaseIndex: 0,
        phaseDay: 'Day 1',
        action: 'Prune dead tips',
      });

      await TreatmentService.saveActionNote(targetKey, 'Pruned 4 dry leaves, stems green inside');
      const rec = await TreatmentService.getActionByKey(targetKey);
      expect(rec?.notes).toBe('Pruned 4 dry leaves, stems green inside');
    });

    it('migrates scan-scoped checkoffs over to newly indexed plantId via associateScanWithPlant', async () => {
      const scanId = 'scan-temp-789';
      const plantId = 'plant-indexed-999';

      const scanResult = await TreatmentService.toggleTreatmentAction({
        scanId,
        species: 'Ficus lyrata',
        phaseIndex: 0,
        phaseDay: 'Day 1',
        action: 'Foliar dust wipe with microfiber cloth',
      });
      expect(scanResult.isCompleted).toBe(true);

      const beforeMigration = await TreatmentService.getCompletedActions(plantId);
      expect(beforeMigration.length).toBe(0);

      await TreatmentService.associateScanWithPlant(scanId, plantId);

      const afterMigration = await TreatmentService.getCompletedActions(plantId);
      expect(afterMigration.length).toBe(1);
      expect(afterMigration[0].plantId).toBe(plantId);
      expect(afterMigration[0].targetKey).toContain(`plant:${plantId}:`);
    });

    it('migrates specimen-scoped checkoffs over to newly indexed plantId via associateScanWithPlant', async () => {
      const species = 'Monstera Deliciosa';
      const plantId = 'plant-indexed-123';

      const actionResult = await TreatmentService.toggleTreatmentAction({
        species,
        phaseIndex: 1,
        phaseDay: 'Day 3',
        action: 'Wipe foliage with neem oil',
      });
      expect(actionResult.isCompleted).toBe(true);

      const beforeMigration = await TreatmentService.getCompletedActions(plantId);
      expect(beforeMigration.length).toBe(0);

      await TreatmentService.associateScanWithPlant(null, plantId, species);

      const afterMigration = await TreatmentService.getCompletedActions(plantId);
      expect(afterMigration.length).toBe(1);
      expect(afterMigration[0].plantId).toBe(plantId);
      expect(afterMigration[0].targetKey).toContain(`plant:${plantId}:`);
    });

    it('migrates both scan-scoped and specimen-scoped actions simultaneously', async () => {
      const scanId = 'scan-temp-456';
      const species = 'Calathea orbifolia';
      const plantId = 'plant-indexed-789';

      await TreatmentService.toggleTreatmentAction({
        scanId,
        phaseIndex: 0,
        phaseDay: 'Day 1',
        action: 'Increase ambient humidity',
      });
      await TreatmentService.toggleTreatmentAction({
        species,
        phaseIndex: 1,
        phaseDay: 'Day 4',
        action: 'Mist with distilled water',
      });

      await TreatmentService.associateScanWithPlant(scanId, plantId, species);

      const migrated = await TreatmentService.getCompletedActions(plantId);
      expect(migrated.length).toBe(2);
      expect(migrated.every(m => m.plantId === plantId && m.targetKey.startsWith(`plant:${plantId}:`))).toBe(true);
    });

    it('matches specimen actions with raw unslugged prefix, slugged prefix, and bare species name', async () => {
      const species = 'Monstera Deliciosa';
      await TreatmentService.toggleTreatmentAction({
        species,
        phaseIndex: 0,
        phaseDay: 'Day 1',
        action: 'Clean leaf surface',
      });

      const fromRaw = await TreatmentService.getCompletedActions(`specimen:${species}`);
      expect(fromRaw.length).toBe(1);

      const fromSlugged = await TreatmentService.getCompletedActions('specimen:monstera-deliciosa');
      expect(fromSlugged.length).toBe(1);

      const fromBare = await TreatmentService.getCompletedActions(species);
      expect(fromBare.length).toBe(1);
    });

    it('handles scanId with leading scan: prefix cleanly during association', async () => {
      const rawScanId = 'scan:camera-feed-999';
      const plantId = 'plant-prefixed-999';

      await TreatmentService.toggleTreatmentAction({
        scanId: rawScanId,
        phaseIndex: 0,
        phaseDay: 'Day 1',
        action: 'Soil aeration test',
      });

      await TreatmentService.associateScanWithPlant(rawScanId, plantId);
      const migrated = await TreatmentService.getCompletedActions(plantId);
      expect(migrated.length).toBe(1);
      expect(migrated[0].plantId).toBe(plantId);
      expect(migrated[0].targetKey).toContain(`plant:${plantId}:`);
    });

    it('deduplicates actions cleanly if plant already has the same targetKey', async () => {
      const scanId = 'scan-dup-test';
      const plantId = 'plant-dup-test';

      // 1. Action completed under scanId
      await TreatmentService.toggleTreatmentAction({
        scanId,
        phaseIndex: 0,
        phaseDay: 'Day 1',
        action: 'Pruning old foliage',
      });

      // 2. Same action already completed under plantId directly
      await TreatmentService.toggleTreatmentAction({
        plantId,
        phaseIndex: 0,
        phaseDay: 'Day 1',
        action: 'Pruning old foliage',
      });

      await TreatmentService.associateScanWithPlant(scanId, plantId);
      const migrated = await TreatmentService.getCompletedActions(plantId);
      expect(migrated.length).toBe(1);
    });
  });
});
