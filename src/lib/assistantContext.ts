/**
 * The garden context the assistant is briefed with.
 *
 * The client builds a compact, serializable summary of the live Dexie
 * garden (buildGardenContext) and sends it alongside the messages; the
 * server validates it and injects the prompt block (buildGardenPromptBlock)
 * into /api/chat's system instruction. One module, imported by both sides —
 * server.ts already bundles from src/lib (serpApiClient, guestQuotaStore).
 *
 * Privacy boundary: plant names, species, health scores and care dates are
 * the same class of data /api/guardian/predict already carries (full check-in
 * histories), so this stays inside the established Gemini boundary. What is
 * deliberately NOT here: photos, check-in payloads, notes content.
 *
 * Weather alerts are part of the shape but optional: there is no persisted
 * global location in this app (no default place — see Home.tsx), and a chat
 * bubble must not silently prompt for GPS. Callers that already hold a
 * consented forecast may fill `alerts`; the two shipped surfaces don't.
 */

export const MAX_CONTEXT_PLANTS = 12;
export const MAX_CONTEXT_TASKS = 8;
export const MAX_CONTEXT_ALERTS = 4;
/** JSON size the server accepts for `garden`. The client's own build stays
 *  far under this; the cap keeps a hand-rolled payload from inflating the
 *  prompt budget. */
export const GARDEN_CONTEXT_LIMIT = 8_000;

export interface ContextPlant {
  name: string;
  species?: string;
  /** Guardian score 0-100 as of the build. */
  score: number;
  status?: string;
  /** Human phrase: 'due now', 'overdue by 2 days', 'due in 3 days'. */
  water?: string;
  /** Days since the last care event, when known. */
  lastCareDaysAgo?: number;
}

export interface ContextTask {
  kind: string;
  plantName: string;
  reason: string;
}

export interface ContextAlert {
  kind: string;
  title: string;
  affected: string[];
}

export interface GardenContext {
  /** Total non-demo plants in the garden, even when only some are listed. */
  totalPlants: number;
  plants: ContextPlant[];
  tasks: ContextTask[];
  alerts: ContextAlert[];
  /** Gardener profile's skill lens, when the caller has one. */
  skill?: 'beginner' | 'intermediate' | 'expert';
}

const DAY = 86_400_000;

function waterPhrase(nextWaterDue: unknown, now: Date): string | undefined {
  if (!nextWaterDue) return undefined;
  const due = new Date(nextWaterDue as string | Date);
  if (isNaN(due.getTime())) return undefined;
  const diffDays = Math.floor((due.getTime() - now.getTime()) / DAY);
  if (diffDays < -1) return `overdue by ${-diffDays} days`;
  if (diffDays === -1) return 'overdue by 1 day';
  if (diffDays <= 0) return 'due now';
  if (diffDays === 1) return 'due tomorrow';
  return `due in ${diffDays} days`;
}

interface BuildInputPlant {
  name?: string;
  species?: string;
  guardianScore?: number;
  status?: string;
  nextWaterDue?: Date | string | null;
  lastCheckInAt?: Date | string | null;
  isDemo?: boolean;
}

interface BuildInputTask {
  kind?: string;
  plantName?: string;
  reason?: string;
}

interface BuildInputAlert {
  kind?: string;
  title?: string;
  affectedNames?: string[];
}

/**
 * Compact garden summary for the assistant. Worst plants first, capped —
 * a 40-plant garden must not become a 40-line prompt.
 */
export function buildGardenContext(input: {
  plants: BuildInputPlant[];
  tasks: BuildInputTask[];
  alerts?: BuildInputAlert[];
  skill?: GardenContext['skill'];
}, now: Date = new Date()): GardenContext | null {
  const live = (input.plants || []).filter(p => p && p.name && !p.isDemo);
  if (!live.length) return null;

  const plants: ContextPlant[] = live
    .map(p => ({
      name: String(p.name),
      ...(p.species ? { species: String(p.species) } : {}),
      score: Math.max(0, Math.min(100, Math.round(Number(p.guardianScore ?? 0)))),
      ...(p.status ? { status: String(p.status) } : {}),
      ...(waterPhrase(p.nextWaterDue, now) ? { water: waterPhrase(p.nextWaterDue, now)! } : {}),
      ...(p.lastCheckInAt
        ? {
            lastCareDaysAgo: Math.max(0, Math.floor(
              (now.getTime() - new Date(p.lastCheckInAt as string | Date).getTime()) / DAY,
            )),
          }
        : {}),
    }))
    // Worst health first — the plants the advice is most likely about.
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_CONTEXT_PLANTS);

  const tasks: ContextTask[] = (input.tasks || [])
    .filter(t => t && t.kind && t.plantName)
    .slice(0, MAX_CONTEXT_TASKS)
    .map(t => ({ kind: String(t.kind), plantName: String(t.plantName), reason: String(t.reason ?? '') }));

  const alerts: ContextAlert[] = (input.alerts || [])
    .filter(a => a && a.kind && a.title)
    .slice(0, MAX_CONTEXT_ALERTS)
    .map(a => ({ kind: String(a.kind), title: String(a.title), affected: (a.affectedNames ?? []).map(String) }));

  return {
    totalPlants: live.length,
    plants,
    tasks,
    alerts,
    ...(input.skill ? { skill: input.skill } : {}),
  };
}

/**
 * The system-prompt block for a garden context. Server-safe: the payload is
 * client-supplied, so every field is coerced defensively and hard-capped.
 * Returns null when there is nothing usable — the assistant then behaves
 * exactly as it did before this module existed.
 */
export function buildGardenPromptBlock(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const garden = raw as GardenContext;
  if (!Array.isArray(garden.plants) || garden.plants.length === 0) return null;

  const plants = garden.plants.slice(0, MAX_CONTEXT_PLANTS);
  const tasks = Array.isArray(garden.tasks) ? garden.tasks.slice(0, MAX_CONTEXT_TASKS) : [];
  const alerts = Array.isArray(garden.alerts) ? garden.alerts.slice(0, MAX_CONTEXT_ALERTS) : [];

  const lines: string[] = [];
  lines.push(
    `THE KEEPER'S GARDEN (live data, ${plants.length} of ${Math.max(plants.length, Math.floor(Number(garden.totalPlants)) || plants.length)} plants shown):`,
  );
  for (const p of plants) {
    if (!p || typeof p.name !== 'string') continue;
    const bits = [
      `${p.name}${typeof p.species === 'string' && p.species ? ` (${p.species})` : ''}`,
      `health ${Math.max(0, Math.min(100, Math.round(Number(p.score) || 0)))}%`,
      typeof p.status === 'string' && p.status ? p.status : null,
      typeof p.water === 'string' ? `water ${p.water}` : null,
      typeof p.lastCareDaysAgo === 'number' && Number.isFinite(p.lastCareDaysAgo)
        ? `last care ${Math.max(0, Math.floor(p.lastCareDaysAgo))} days ago`
        : null,
    ].filter(Boolean);
    lines.push(`- ${bits.join('; ')}`);
  }
  if (tasks.length) {
    lines.push("TODAY'S PRIORITY TASKS (garden's own queue):");
    for (const t of tasks) {
      if (!t || typeof t.plantName !== 'string') continue;
      lines.push(`- [${typeof t.kind === 'string' ? t.kind : 'task'}] ${t.plantName}${typeof t.reason === 'string' && t.reason ? ` — ${t.reason}` : ''}`);
    }
  }
  if (alerts.length) {
    lines.push('WEATHER PROTECTION (consented forecast):');
    for (const a of alerts) {
      if (!a || typeof a.title !== 'string') continue;
      const who = Array.isArray(a.affected) && a.affected.length ? ` — affects: ${a.affected.slice(0, 6).join(', ')}` : '';
      lines.push(`- ${a.title}${who}`);
    }
  }
  if (garden.skill === 'beginner' || garden.skill === 'intermediate' || garden.skill === 'expert') {
    lines.push(
      garden.skill === 'beginner'
        ? 'KEEPER EXPERIENCE: beginner — plain language, small concrete steps, no jargon without a one-line explanation.'
        : garden.skill === 'expert'
          ? 'KEEPER EXPERIENCE: expert — technical depth welcome, skip basic care explanations.'
          : 'KEEPER EXPERIENCE: intermediate — standard depth, define specialised terms.',
    );
  }
  lines.push(
    'CONTEXT RULES: reference these actual plants by name when relevant; never invent plants, names, or history that is not in this list; if asked about a plant not listed, say you do not have its record and ask for details; trust this data over any assumption about the garden.',
  );
  return lines.join('\n');
}
