import { describe, it, expect, beforeEach } from 'vitest';
import { TreatmentService } from '../treatmentService';
import { db } from '../../db/database';

describe('TreatmentService unit and persistence tests', () => {
  beforeEach(async () => {
    try {
      if (db.treatmentActions) {
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

    it('generates specimen-scoped key when plantId is null or absent', () => {
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
  });
});
