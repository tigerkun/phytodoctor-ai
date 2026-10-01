import { describe, it, expect, vi } from 'vitest';
import {
  MemoryQuotaStore,
  SupabaseQuotaStore,
  createGuestQuotaStore,
  digestIp,
  bucketKey,
  type SupabaseLike,
} from '../guestQuotaStore';

const DAY = '2026-10-01';

function rpcReturning(rows: unknown, error: { message: string } | null = null) {
  return vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: rows, error }));
}

describe('digestIp', () => {
  it('is stable and hides the address', () => {
    const a = digestIp('203.0.113.7', 'salt');
    const b = digestIp('203.0.113.7', 'salt');
    expect(a).toBe(b);
    expect(a).not.toContain('203.0.113.7');
    expect(a.length).toBe(32);
  });

  it('separates the same address under a different salt', () => {
    // Without a salt, sha256 of an IPv4 address is a rainbow-table lookup away
    // from being reversible, which is why one is mixed in.
    expect(digestIp('203.0.113.7', 'a')).not.toBe(digestIp('203.0.113.7', 'b'));
  });
});

describe('bucketKey', () => {
  it('is scoped by action and day so they cannot share a counter', () => {
    expect(bucketKey('identify', 'd', DAY)).toBe(`identify:d:${DAY}`);
    expect(bucketKey('identify', 'd', DAY)).not.toBe(bucketKey('chat', 'd', DAY));
  });
});

describe('MemoryQuotaStore', () => {
  it('keeps the in-process semantics', async () => {
    const store = new MemoryQuotaStore(2);
    expect((await store.take('1.1.1.1', DAY, 'identify')).allowed).toBe(true);
    expect((await store.take('1.1.1.1', DAY, 'identify')).allowed).toBe(true);
    const denied = await store.take('1.1.1.1', DAY, 'identify');
    expect(denied.allowed).toBe(false);
    expect(denied.used).toBe(2);
  });
});

describe('SupabaseQuotaStore', () => {
  it('sends the hashed address, never the raw one', async () => {
    const rpc = rpcReturning([{ allowed: true, used: 1, limit: 2 }]);
    const store = new SupabaseQuotaStore({ rpc } as unknown as SupabaseLike, 2, 'pepper');
    await store.take('198.51.100.9', DAY, 'identify');

    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_ip_digest).toBe(digestIp('198.51.100.9', 'pepper'));
    expect(JSON.stringify(args)).not.toContain('198.51.100.9');
    expect(args.p_bucket).toBe(bucketKey('identify', args.p_ip_digest as string, DAY));
    expect(args.p_limit).toBe(2);
  });

  it('accepts a single row object as well as an array', async () => {
    const rpc = rpcReturning({ allowed: false, used: 2, limit: 2 });
    const store = new SupabaseQuotaStore({ rpc } as unknown as SupabaseLike, 2, 'pepper');
    const r = await store.take('1.1.1.1', DAY, 'identify');
    expect(r).toEqual({ allowed: false, used: 2, limit: 2 });
  });

  it('throws on a database error instead of silently allowing', async () => {
    const rpc = rpcReturning([], { message: 'boom' });
    const store = new SupabaseQuotaStore({ rpc } as unknown as SupabaseLike, 2, 'pepper');
    await expect(store.take('1.1.1.1', DAY, 'identify')).rejects.toThrow('boom');
  });

  it('throws on an unexpected shape rather than trusting it', async () => {
    const rpc = rpcReturning([{ nonsense: true }]);
    const store = new SupabaseQuotaStore({ rpc } as unknown as SupabaseLike, 2, 'pepper');
    await expect(store.take('1.1.1.1', DAY, 'identify')).rejects.toThrow(/unexpected shape/);
  });
});

describe('createGuestQuotaStore', () => {
  it('uses the shared store once the function answers', async () => {
    const rpc = rpcReturning([{ allowed: false, used: 0, limit: 0 }]);
    const logs: string[] = [];
    const store = await createGuestQuotaStore({
      supabase: { rpc } as unknown as SupabaseLike,
      limit: 2,
      salt: 'pepper',
      log: (m) => logs.push(m),
    });
    expect(store.kind).toBe('supabase');
    expect(logs.join(' ')).toMatch(/shared across instances/);
  });

  // The state the app is in right now: the SQL has not been run.
  it('falls back to memory when take_guest_scan does not exist', async () => {
    const rpc = rpcReturning([], { message: 'function public.take_guest_scan does not exist' });
    const logs: string[] = [];
    const store = await createGuestQuotaStore({
      supabase: { rpc } as unknown as SupabaseLike,
      limit: 2,
      salt: 'pepper',
      log: (m) => logs.push(m),
    });
    expect(store.kind).toBe('memory');
    expect(logs.join(' ')).toMatch(/sql\/guest_scan_quota\.sql/);
  });

  it('falls back to memory when Supabase is unreachable, not just when the table is missing', async () => {
    const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => {
      throw new Error('ECONNREFUSED');
    });
    const store = await createGuestQuotaStore({
      supabase: { rpc } as unknown as SupabaseLike,
      limit: 2,
      salt: 'pepper',
    });
    expect(store.kind).toBe('memory');
  });

  it('falls back to memory with no admin client at all', async () => {
    const store = await createGuestQuotaStore({ supabase: null, limit: 2, salt: 'pepper' });
    expect(store.kind).toBe('memory');
    // Still actually caps, so the fallback is not a free pass.
    expect((await store.take('1.1.1.1', DAY, 'identify')).allowed).toBe(true);
    expect((await store.take('1.1.1.1', DAY, 'identify')).allowed).toBe(true);
    expect((await store.take('1.1.1.1', DAY, 'identify')).allowed).toBe(false);
  });

  it('probes with a zero limit so it leaves no row behind', async () => {
    const rpc = rpcReturning([{ allowed: false, used: 0, limit: 0 }]);
    await createGuestQuotaStore({
      supabase: { rpc } as unknown as SupabaseLike,
      limit: 2,
      salt: 'pepper',
    });
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_limit).toBe(0);
    expect(args.p_action).toBe('__probe');
  });
});
