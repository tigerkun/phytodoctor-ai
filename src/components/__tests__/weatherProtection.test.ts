import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments, tagAround } from '../../test/helpers';

/**
 * The garden dashboard's one-click weather protection. Source-level; each
 * scan first proves it found the structures it means to police.
 */

const dashboard = stripJsComments(readSource('src/components/home/GardenDashboard.tsx'));

describe('GardenDashboard weather protection', () => {
  it('the scan found the dashboard it means to check', () => {
    expect(dashboard).toContain('deriveWeatherAlerts');
    expect(dashboard).toContain('plantsAffectedByAlert');
  });

  it('an uncovered alert offers a one-click apply naming the count', () => {
    const button = tagAround(dashboard, 'Apply protection to', ['<button']);
    expect(button).toContain('applyProtection(alert)');
    expect(button).toContain('disabled={applying === alert.kind}');
  });

  it('applying writes through the adjustment service, never ad-hoc rows', () => {
    expect(dashboard).toContain('WeatherAdjustmentService.applyProtection(');
    // The affected set is the service's own verdict, not a dashboard guess.
    expect(dashboard).toContain('plantsAffectedByAlert(alert, plants)');
  });

  it('a covered alert shows its expiry instead of nagging again', () => {
    expect(dashboard).toContain('Protected until');
    expect(dashboard).toContain('toLocaleDateString()');
    // And the apply button is gone while covered: the covered branch (a
    // fragment with the chip + undo row) and the button branch are exclusive
    // arms of the same conditional.
    expect(dashboard).toMatch(/\? \(\s*<>[\s\S]*Protected until[\s\S]*?\) : affected\.length > 0 \? \(/);
  });

  it('the task queue honours effective dates so the dashboard and engine agree', () => {
    expect(dashboard).toContain('withEffectiveWatering(plants, adjustments)');
    expect(dashboard).toContain('buildPriorityQueue(queuePlants)');
  });
});
