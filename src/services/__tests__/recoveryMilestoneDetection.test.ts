import { describe, it, expect } from 'vitest';
import { detectRecoveryMilestones, milestoneMessage, RECOVERY_MILESTONES } from '../rewardService';

describe('detectRecoveryMilestones', () => {
  it('the scan found the detector it means to check', () => {
    expect(detectRecoveryMilestones(50, 60, 1, new Set())).toEqual(['first_improvement']);
  });

  it('first improvement requires a baseline and a real jump', () => {
    // A first-ever reading has no baseline: +10 from nothing is not improvement.
    expect(detectRecoveryMilestones(0, 45, 1, new Set())).not.toContain('first_improvement');
    expect(detectRecoveryMilestones(50, 59, 1, new Set())).not.toContain('first_improvement');
    expect(detectRecoveryMilestones(50, 60, 1, new Set())).toContain('first_improvement');
  });

  it('halfway fires on crossing 70, not on sitting above it', () => {
    expect(detectRecoveryMilestones(69, 70, 1, new Set())).toContain('halfway');
    expect(detectRecoveryMilestones(70, 71, 1, new Set())).not.toContain('halfway');
    expect(detectRecoveryMilestones(75, 80, 1, new Set())).not.toContain('halfway');
  });

  it('recovered fires on crossing 90 only', () => {
    expect(detectRecoveryMilestones(89, 90, 1, new Set())).toContain('recovered');
    expect(detectRecoveryMilestones(90, 92, 1, new Set())).not.toContain('recovered');
  });

  it('anniversary fires at 30 days kept', () => {
    expect(detectRecoveryMilestones(50, 52, 29, new Set())).not.toContain('anniversary');
    expect(detectRecoveryMilestones(50, 52, 30, new Set())).toContain('anniversary');
  });

  it('once-ness: seen milestones never re-fire', () => {
    const seen = new Set(['halfway', 'recovered']);
    const won = detectRecoveryMilestones(65, 95, 40, seen);
    expect(won).toEqual(['first_improvement', 'anniversary']);
  });

  it('a single strong check-in can win several milestones at once', () => {
    const won = detectRecoveryMilestones(60, 95, 30, new Set());
    expect(won).toContain('halfway');
    expect(won).toContain('recovered');
    expect(won).toContain('anniversary');
  });
});

describe('milestone copy and badges', () => {
  it('every milestone carries a badge and seeds', () => {
    for (const meta of Object.values(RECOVERY_MILESTONES)) {
      expect(meta.badge.length).toBeGreaterThan(0);
      expect(meta.seeds).toBeGreaterThan(0);
    }
  });

  it('uses the promised phrasing', () => {
    expect(milestoneMessage('halfway', 'Fern')).toBe('Fern is halfway to recovery! 🌿');
    expect(milestoneMessage('recovered', 'Fern')).toBe('Fern has fully recovered! 🎉');
  });
});
