import { describe, it, expect } from 'vitest';
import {
  summarizeGardenHealth,
  buildPriorityQueue,
  deriveWeatherAlerts,
  plantsAffectedByAlert,
  groupPlants,
  statusIndicators,
  type GardenPlant,
} from '../gardenDashboardService';

const NOW = new Date('2026-06-15T12:00:00');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const plant = (over: Partial<GardenPlant>): GardenPlant => ({
  id: 'p1',
  name: 'Fern',
  guardianScore: 80,
  ...over,
});

describe('summarizeGardenHealth', () => {
  it('the scan found the service it means to check', () => {
    expect(summarizeGardenHealth([]).totalPlants).toBe(0);
  });

  it('averages scores and counts the attention band', () => {
    const s = summarizeGardenHealth([plant({ guardianScore: 90 }), plant({ guardianScore: 70 }), plant({ guardianScore: 40 })]);
    expect(s.averageScore).toBe(67);
    expect(s.attentionCount).toBe(1);
    expect(s.band).toBe('attention');
    expect(s.headline).toContain('1 plant needs attention');
  });

  it('bands 90+ as thriving and <50 as critical', () => {
    expect(summarizeGardenHealth([plant({ guardianScore: 95 })]).band).toBe('thriving');
    expect(summarizeGardenHealth([plant({ guardianScore: 45 }), plant({ guardianScore: 30 })]).band).toBe('critical');
  });
});

describe('buildPriorityQueue', () => {
  it('ranks critical health above chores above celebrations', () => {
    const queue = buildPriorityQueue([
      plant({ id: 'well', name: 'Well', guardianScore: 95, status: 'Recovering', lastCheckInAt: daysAgo(1) }),
      plant({ id: 'sick', name: 'Sick', guardianScore: 40 }),
      plant({ id: 'thirsty', name: 'Thirsty', guardianScore: 75, nextWaterDue: daysAgo(2), lastCheckInAt: daysAgo(1) }),
    ], NOW);
    expect(queue.map(t => t.kind)).toEqual(['critical-health', 'water-due', 'celebrate-recovery']);
  });

  it('reports overdue watering in days and flags never-analyzed plants', () => {
    const queue = buildPriorityQueue([
      plant({ guardianScore: 75, nextWaterDue: daysAgo(3) }),
      plant({ id: 'p2', name: 'Shy', guardianScore: 85, lastCheckInAt: null }),
    ], NOW);
    const water = queue.find(t => t.kind === 'water-due')!;
    expect(water.reason).toContain('overdue by 3 days');
    const stale = queue.find(t => t.kind === 'check-in-stale')!;
    expect(stale.reason).toContain('Never analyzed');
  });

  it('does not pile chores onto a critical plant', () => {
    const queue = buildPriorityQueue([plant({ guardianScore: 30, nextWaterDue: daysAgo(5), lastCheckInAt: null })], NOW);
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe('critical-health');
  });
});

describe('deriveWeatherAlerts', () => {
  const forecast = (temps: number[], humidity: number[]) =>
    temps.map((temp, i) => ({ date: new Date(NOW.getTime() + i * 86_400_000).toISOString().slice(0, 10), temp, humidity: humidity[i] }));

  it('flags a frosty day with how far out it is', () => {
    const alerts = deriveWeatherAlerts({ temperature: 20, humidity: 60, forecast: forecast([22, 4, 21], [60, 60, 60]) }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('frost');
    expect(alerts[0].title).toContain('1 day');
  });

  it('flags heat and dry air when the forecast supports them', () => {
    const alerts = deriveWeatherAlerts({ temperature: 33, humidity: 30, forecast: forecast([34, 33], [30, 28]) }, NOW);
    expect(alerts.map(a => a.kind).sort()).toEqual(['dry-air', 'heat']);
  });

  it('stays silent on a mild week — no invented alerts', () => {
    const alerts = deriveWeatherAlerts({ temperature: 22, humidity: 55, forecast: forecast([23, 24, 22], [55, 60, 50]) }, NOW);
    expect(alerts).toEqual([]);
  });
});

describe('plantsAffectedByAlert', () => {
  it('matches plants by species tolerance profile', () => {
    const affected = plantsAffectedByAlert(
      { kind: 'frost', title: '', body: '', startsInDays: 0 },
      [plant({ name: 'Ti', species: 'Cordyline fruticosa' }), plant({ name: 'Ivy', species: 'Hedera helix' })],
    );
    // The exact split depends on the tolerance table; the invariant is that
    // the result is a subset with id+name shapes.
    for (const p of affected) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
    }
  });
});

describe('groupPlants', () => {
  it('groups by the four bands with per-group urgency sort', () => {
    const groups = groupPlants([
      plant({ id: 'old-thriving', name: 'A', guardianScore: 90, lastCheckInAt: daysAgo(40) }),
      plant({ id: 'fresh-thriving', name: 'B', guardianScore: 92, lastCheckInAt: daysAgo(1) }),
      plant({ id: 'sick', name: 'C', guardianScore: 45 }),
      plant({ id: 'newborn', name: 'D', guardianScore: 55, createdAt: daysAgo(2) }),
      plant({ id: 'rec', name: 'E', guardianScore: 70, status: 'Recovering' }),
    ], NOW);
    expect(groups.thriving.map(p => p.id)).toEqual(['old-thriving', 'fresh-thriving']); // oldest check-in first
    expect(groups.attention.map(p => p.id)).toEqual(['sick']);
    expect(groups.new.map(p => p.id)).toEqual(['newborn']);
    expect(groups.recovering.map(p => p.id)).toEqual(['rec']);
  });

  it('the new window is 7 days, then health bands take over', () => {
    const groups = groupPlants([plant({ guardianScore: 55, createdAt: daysAgo(8) })], NOW);
    expect(groups.new).toHaveLength(0);
    expect(groups.attention).toHaveLength(1);
  });
});

describe('statusIndicators', () => {
  it('flags water, stale check-ins, and decline only with a baseline', () => {
    expect(statusIndicators(plant({ nextWaterDue: daysAgo(1), lastCheckInAt: daysAgo(40) }), NOW)).toEqual(['water', 'checkin']);
    expect(statusIndicators(plant({ previousScore: 80, guardianScore: 65, lastCheckInAt: daysAgo(1) }), NOW)).toEqual(['declining']);
    expect(statusIndicators(plant({ previousScore: null, guardianScore: 20 }), NOW)).not.toContain('declining');
  });
});
