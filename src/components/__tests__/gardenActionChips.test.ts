import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments, tagAround } from '../../test/helpers';

/**
 * The assistant's one-click garden actions. Source-level; each scan first
 * proves it found the structures it means to police.
 */

const chips = stripJsComments(readSource('src/components/assistant/GardenActionChips.tsx'));
const floating = stripJsComments(readSource('src/components/FloatingAssistant.tsx'));
const assistant = stripJsComments(readSource('src/pages/Assistant.tsx'));

describe('GardenActionChips', () => {
  it('the scan found the component it means to check', () => {
    expect(chips).toContain('buildPriorityQueue');
  });

  it('performs the act through the one service write path', () => {
    // Water-all goes through PlantService.waterPlant, the ONE place that
    // writes the watering triple — never an inline Dexie patch.
    expect(chips).toContain('PlantService.waterPlant(plant.id, stamp)');
    expect(chips).toContain('wateringDue(p, stamp)');
  });

  it('renders nothing when the garden needs nothing', () => {
    expect(chips).toContain('if (!due.length && !critical && !stale) return null;');
  });

  it('the water chip is a live button that counts, not decoration', () => {
    const button = tagAround(chips, 'Water ${due.length} thirsty', ['<button']);
    expect(button).toContain('onClick={waterAll}');
    expect(button).toContain('disabled={watering}');
  });

  it('navigation chips target the real plant page', () => {
    expect(chips).toContain('navigate(`/plant/${critical.plantId}`)');
    expect(chips).toContain('navigate(`/plant/${stale.plantId}`)');
  });
});

describe('assistant surfaces brief the model with the garden', () => {
  it('the scan found both surfaces it means to check', () => {
    expect(floating).toContain('chatWithGardener');
    expect(assistant).toContain('chatWithBotanist');
  });

  it('each send path passes a fresh garden briefing', () => {
    // Fresh per send — one Dexie read — not a snapshot from mount.
    expect(floating).toContain('await gardenNow()');
    expect(assistant).toContain('await gardenNow()');
    expect(floating).toContain('buildGardenContext({');
    expect(assistant).toContain('buildGardenContext({');
  });

  it('both surfaces render the action chips', () => {
    expect(floating).toContain('<GardenActionChips variant="glass" />');
    expect(assistant).toContain('<GardenActionChips variant="telegraph" />');
  });

  it('the briefing degrades silently when Dexie is unreachable', () => {
    // The whole briefing build sits in a try/catch: a private-mode Dexie
    // failure must degrade to "no briefing", never break the chat. (Comments
    // are stripped, so the code itself is the evidence.)
    const fnStart = floating.indexOf('const gardenNow = async ()');
    const fn = floating.slice(fnStart, floating.indexOf('};', fnStart));
    expect(fn).toContain('try {');
    expect(fn).toContain('catch {');
    expect(fn).toContain('return undefined');
  });
});
