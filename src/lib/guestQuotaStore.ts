/**
 * Where the guest scan cap actually lives.
 *
 * `GuestQuota` (guestQuota.ts) counts in process memory, which is correct for
 * a single instance and wrong for two: production was observed granting the
 * third scan of the day straight after refusing it, because a second instance
 * answered with its own empty map. The real allowance was 2 x instances.
 *
 * So the store is behind an interface, and the server prefers the shared
 * Postgres one when the table exists. When it does not -- which is the case
 * until sql/guest_scan_quota.sql is run -- it logs a warning and uses memory.
 * Nothing depends on the upgrade having happened.
 */

import { createHash } from 'node:crypto';
import { GuestQuota, type GuestQuotaResult } from './guestQuota';

export interface GuestQuotaStore {
  /** Count one use and report whether it was within the limit. */
  take(ip: string, day: string, action: string): Promise<GuestQuotaResult>;
  /** Which backing store answered, for startup logging. */
  readonly kind: 'memory' | 'supabase';
}

export interface SupabaseLike {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * The address is never handed to a database. A raw IP in a quota table is
 * personal data we do not need; a SHA-256 digest is enough to count against
 * and useless for identifying anyone.
 *
 * The salt keeps the digest from being reversible by brute force over the
 * whole IPv4 space -- without one, `sha256("1.2.3.4")` is a lookup away.
 */
export function digestIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export function bucketKey(action: string, digest: string, day: string): string {
  return `${action}:${digest}:${day}`;
}

/** In-process fallback. Identical semantics to GuestQuota, so its tests cover this too. */
export class MemoryQuotaStore implements GuestQuotaStore {
  readonly kind = 'memory' as const;
  private readonly quota: GuestQuota;

  constructor(limit: number) {
    this.quota = new GuestQuota(limit);
  }

  async take(ip: string, day: string, action: string): Promise<GuestQuotaResult> {
    return this.quota.take(ip, day, action);
  }
}

export class SupabaseQuotaStore implements GuestQuotaStore {
  readonly kind = 'supabase' as const;

  constructor(
    private readonly supabase: SupabaseLike,
    private readonly limit: number,
    private readonly salt: string
  ) {}

  async take(ip: string, day: string, action: string): Promise<GuestQuotaResult> {
    const digest = digestIp(ip, this.salt);
    const { data, error } = await this.supabase.rpc('take_guest_scan', {
      p_bucket: bucketKey(action, digest, day),
      p_action: action,
      p_ip_digest: digest,
      p_day: day,
      p_limit: this.limit,
    });

    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') {
      throw new Error('take_guest_scan returned an unexpected shape');
    }
    return {
      allowed: row.allowed,
      used: Number(row.used),
      limit: Number(row.limit ?? this.limit),
    };
  }
}

export interface CreateStoreOptions {
  supabase: SupabaseLike | null;
  limit: number;
  salt: string;
  log?: (message: string) => void;
}

/**
 * Probe once for the shared store and fall back if it is not there.
 *
 * The probe is a throwaway call that will be denied by the limit, so it both
 * proves the function exists and warms nothing. If Supabase is unreachable --
 * not just missing the table -- we still serve guests from memory rather than
 * locking every signed-out visitor out of the product.
 */
export async function createGuestQuotaStore(options: CreateStoreOptions): Promise<GuestQuotaStore> {
  const { supabase, limit, salt, log = () => {} } = options;

  if (!supabase) {
    log('Guest quota is in-process (no Supabase admin client). The cap is per instance.');
    return new MemoryQuotaStore(limit);
  }

  try {
    const probe = new SupabaseQuotaStore(supabase, 0, salt);
    await probe.take('0.0.0.0', '1970-01-01', '__probe');
    log('Guest quota is shared across instances (sql/guest_scan_quota.sql is applied).');
    return new SupabaseQuotaStore(supabase, limit, salt);
  } catch (err) {
    log(
      'Guest quota is in-process: take_guest_scan is unavailable ' +
        `(${err instanceof Error ? err.message : String(err)}). ` +
        'Run sql/guest_scan_quota.sql to make the cap shared across instances.'
    );
    return new MemoryQuotaStore(limit);
  }
}
