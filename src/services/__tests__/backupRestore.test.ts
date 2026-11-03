import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseBackup, restoreBackup } from '../backupRestore';
import { db } from '../../db/database';

/**
 * The restore half of the Settings export — the safety net under the reset.
 * Parse refuses non-backups loudly; restore is one transaction per file and
 * skips tables the current schema no longer has.
 */

const VALID = JSON.stringify({
  exportedAt: '2026-11-04T00:00:00.000Z',
  plants: [{ id: 'p1', name: 'Fern' }],
  notes: [{ id: 'n1', content: 'hello' }],
});

describe('parseBackup', () => {
  it('the scan found the service it means to check', () => {
    expect(() => parseBackup(VALID)).not.toThrow();
  });

  it('refuses non-objects and table-less files loudly', () => {
    expect(() => parseBackup('nope')).toThrow(/not a PhytoDoctor backup/);
    expect(() => parseBackup('[1,2]')).toThrow(/not a PhytoDoctor backup/);
    expect(() => parseBackup('{"exportedAt":"2026-01-01"}')).toThrow(/holds no table data/);
    expect(() => parseBackup('{"plants":"not-an-array"}')).toThrow(/holds no table data/);
  });

  it('keeps only array-valued tables and reports the export date', () => {
    const { tables, exportedAt } = parseBackup('{"exportedAt":"2026-01-01","plants":[1],"stray":"x"}');
    expect(Object.keys(tables)).toEqual(['plants']);
    expect(exportedAt).toBe('2026-01-01');
  });
});

describe('restoreBackup', () => {
  afterEach(() => vi.restoreAllMocks());

  it('clears and refills every matching table in one transaction', async () => {
    const ops: string[] = [];
    vi.spyOn(db, 'table').mockImplementation(((name: string) => ({
      clear: async () => void ops.push(`clear:${name}`),
      bulkPut: async (rows: unknown[]) => void ops.push(`put:${name}:${rows.length}`),
    })) as any);
    vi.spyOn(db, 'transaction').mockImplementation(
      (async (_m: any, _t: any, fn: () => Promise<void>) => {
        await fn();
      }) as any,
    );

    const count = await restoreBackup(VALID);
    expect(count).toBe(2);
    expect(ops).toEqual(['clear:plants', 'put:plants:1', 'clear:notes', 'put:notes:1']);
  });

  it('skips tables the current schema no longer has', async () => {
    const ops: string[] = [];
    vi.spyOn(db, 'table').mockImplementation(((name: string) => {
      if (name === 'prehistoricTable') throw new Error('Table does not exist');
      return {
        clear: async () => void ops.push(`clear:${name}`),
        bulkPut: async (rows: unknown[]) => void ops.push(`put:${name}:${rows.length}`),
      };
    }) as any);
    vi.spyOn(db, 'transaction').mockImplementation(
      (async (_m: any, _t: any, fn: () => Promise<void>) => {
        await fn();
      }) as any,
    );

    const count = await restoreBackup('{"plants":[1],"prehistoricTable":[2]}');
    expect(count).toBe(1);
    expect(ops).toEqual(['clear:plants', 'put:plants:1']);
  });

  it('a file whose tables all vanished is an error, not a silent no-op', async () => {
    vi.spyOn(db, 'table').mockImplementation((() => {
      throw new Error('Table does not exist');
    }) as any);
    await expect(restoreBackup('{"prehistoricTable":[1]}')).rejects.toThrow(/No tables/);
  });
});
