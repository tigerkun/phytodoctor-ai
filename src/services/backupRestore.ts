import { db } from '../db/database';

/**
 * The restore half of the Settings data export — the safety net under the
 * "Start Fresh" reset. The export ships every Dexie table as one JSON file;
 * this module parses that file back in. Best-effort by design: unknown
 * tables in the file are skipped (the schema moved on), and Date fields
 * arrive as ISO strings, which the app's `new Date(x)` reads tolerate.
 * Photos are excluded from exports, so they are absent here too.
 */

export function parseBackup(raw: string): { tables: Record<string, unknown[]>; exportedAt: string | null } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('That file is not a PhytoDoctor backup.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('That file is not a PhytoDoctor backup.');
  }
  const tables: Record<string, unknown[]> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'exportedAt') continue;
    if (Array.isArray(value)) tables[key] = value;
  }
  if (!Object.keys(tables).length) {
    throw new Error('The backup holds no table data.');
  }
  return {
    tables,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
  };
}

/**
 * Restore a Settings export. Each table named in the file is cleared and
 * refilled in one transaction — a crash mid-restore leaves the previous
 * state, not half of the backup. Returns how many tables were restored.
 */
export async function restoreBackup(raw: string): Promise<number> {
  const { tables } = parseBackup(raw);
  const names = Object.keys(tables).filter(name => {
    try {
      db.table(name); // throws for a table the current schema no longer has
      return true;
    } catch {
      return false;
    }
  });
  if (!names.length) throw new Error('No tables in the backup match this app version.');
  await db.transaction('rw', names.map(n => db.table(n)), async () => {
    for (const name of names) {
      await db.table(name).clear();
      await db.table(name).bulkPut(tables[name] as unknown[]);
    }
  });
  return names.length;
}
