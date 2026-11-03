import { describe, it, expect } from 'vitest';
import {
  buildGardenContext,
  buildGardenPromptBlock,
  MAX_CONTEXT_PLANTS,
  MAX_CONTEXT_TASKS,
  GARDEN_CONTEXT_LIMIT,
} from '../assistantContext';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The garden briefing shared by the chat client and /api/chat. The build
 * side caps and phrases; the prompt side re-validates because the payload
 * crossed a network boundary and the server may not trust it.
 */

const NOW = new Date('2026-03-15T12:00:00');
const DAY = 86_400_000;

const plant = (over: Record<string, unknown> = {}) => ({
  name: 'Fern',
  species: 'Nephrolepis exaltata',
  guardianScore: 72,
  status: 'Stable',
  nextWaterDue: new Date(NOW.getTime() + 2 * DAY),
  lastCheckInAt: new Date(NOW.getTime() - 9 * DAY),
  ...over,
});

describe('buildGardenContext', () => {
  it('the scan found the module it means to check', () => {
    expect(GARDEN_CONTEXT_LIMIT).toBeGreaterThan(1000);
    expect(MAX_CONTEXT_PLANTS).toBeLessThan(50);
  });

  it('returns null for an empty or demo-only garden', () => {
    expect(buildGardenContext({ plants: [], tasks: [] }, NOW)).toBeNull();
    expect(buildGardenContext({ plants: [plant({ isDemo: true })], tasks: [] }, NOW)).toBeNull();
    expect(buildGardenContext({ plants: [plant({ name: '' })], tasks: [] }, NOW)).toBeNull();
  });

  it('phrases watering honestly against now', () => {
    const ctx = buildGardenContext({
      plants: [
        plant({ name: 'A', nextWaterDue: new Date(NOW.getTime() - 3 * DAY) }),
        plant({ name: 'B', nextWaterDue: new Date(NOW.getTime() + 30 * 60_000) }),
        plant({ name: 'C', nextWaterDue: null }),
      ],
      tasks: [],
    }, NOW)!;
    const byName = Object.fromEntries(ctx.plants.map(p => [p.name, p]));
    expect(byName.A.water).toBe('overdue by 3 days');
    expect(byName.B.water).toBe('due now');
    expect(byName.C.water).toBeUndefined();
  });

  it('caps the plant list with the worst first', () => {
    const many = Array.from({ length: 30 }, (_, i) => plant({ name: `P${i}`, guardianScore: 50 + i }));
    const ctx = buildGardenContext({ plants: many, tasks: [] }, NOW)!;
    expect(ctx.plants).toHaveLength(MAX_CONTEXT_PLANTS);
    expect(ctx.totalPlants).toBe(30);
    expect(ctx.plants[0].name).toBe('P0'); // score 50 — the worst
    expect(ctx.plants[0].score).toBeLessThanOrEqual(ctx.plants[1].score);
  });

  it('caps tasks and records the gardener skill lens', () => {
    const tasks = Array.from({ length: 20 }, (_, i) => ({ kind: 'water-due', plantName: `P${i}`, reason: 'r' }));
    const ctx = buildGardenContext({ plants: [plant()], tasks, skill: 'beginner' }, NOW)!;
    expect(ctx.tasks).toHaveLength(MAX_CONTEXT_TASKS);
    expect(ctx.skill).toBe('beginner');
  });

  it('scores are clamped to 0-100', () => {
    const ctx = buildGardenContext({ plants: [plant({ guardianScore: 444 })], tasks: [] }, NOW)!;
    expect(ctx.plants[0].score).toBe(100);
  });
});

describe('buildGardenPromptBlock', () => {
  it('refuses garbage without throwing', () => {
    expect(buildGardenPromptBlock(undefined)).toBeNull();
    expect(buildGardenPromptBlock(null)).toBeNull();
    expect(buildGardenPromptBlock('garden')).toBeNull();
    expect(buildGardenPromptBlock([])).toBeNull();
    expect(buildGardenPromptBlock({ plants: [] })).toBeNull();
    expect(buildGardenPromptBlock({ nope: true })).toBeNull();
  });

  it('names real plants and forbids invention', () => {
    const ctx = buildGardenContext({ plants: [plant()], tasks: [{ kind: 'water-due', plantName: 'Fern', reason: 'Water due today' }], skill: 'expert' }, NOW)!;
    const block = buildGardenPromptBlock(ctx)!;
    expect(block).toContain("THE KEEPER'S GARDEN");
    expect(block).toContain('Fern (Nephrolepis exaltata)');
    expect(block).toContain('health 72%');
    expect(block).toContain('[water-due] Fern — Water due today');
    expect(block).toContain('never invent plants');
    expect(block).toContain('KEEPER EXPERIENCE: expert');
  });

  it('re-caps whatever arrives, even past the client caps', () => {
    const hostile = {
      totalPlants: 5000,
      plants: Array.from({ length: 100 }, (_, i) => ({ name: `P${i}`, score: 50 })),
      tasks: Array.from({ length: 100 }, (_, i) => ({ kind: 'k', plantName: `P${i}` })),
    };
    const block = buildGardenPromptBlock(hostile)!;
    expect(block!.match(/^- /gm)!.length).toBe(MAX_CONTEXT_PLANTS + MAX_CONTEXT_TASKS);
  });

  it('survives hostile field types', () => {
    const block = buildGardenPromptBlock({
      totalPlants: 'lots',
      plants: [{ name: 42, score: 'high', water: 7 }],
      tasks: ['water everything'],
    });
    // Numbered name coerces or is skipped, but nothing throws and no task line lies.
    expect(block).not.toBeNull();
    expect(block).not.toContain('[water everything]');
  });
});

describe('chat garden wiring (source level)', () => {
  const server = stripJsComments(readSource('server.ts'));
  const chatService = stripJsComments(readSource('src/services/chatService.ts'));

  it('the scan found the chat route it means to check', () => {
    expect(server).toContain('app.post("/api/chat"');
  });

  it('the server validates the garden payload and injects the shared block', () => {
    expect(server).toContain("import { buildGardenPromptBlock, GARDEN_CONTEXT_LIMIT } from \"./src/lib/assistantContext\";");
    expect(server).toContain('JSON.stringify(garden).length > GARDEN_CONTEXT_LIMIT');
    expect(server).toContain('buildGardenPromptBlock(garden)');
    // The block must ride into the system instruction, not a side channel.
    expect(server).toContain('systemPrompt += `\\n\\n${gardenBlock}`');
  });

  it('the client sends the garden only when it built one', () => {
    expect(chatService).toContain('JSON.stringify(garden ? { messages, garden } : { messages })');
    expect(chatService).toContain("from '../lib/assistantContext'");
  });
});
